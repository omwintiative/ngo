// One-time copy of the old donation records into Donation (API-PLAN.md,
// Part B). Run with scripts/import-donations.js on launch day. Safe to run
// more than once: existing records are never changed or duplicated.
const ManualContribution = require("../models/ManualContribution");
const Donation = require("../models/Donation");
const { paystackRequest } = require("./paystack");

const PAGE_SIZE = 100;
const MAX_PAGES = 50;

// Bank transfers the admin recorded on the old site.
const importManualContributions = async () => {
  let added = 0;
  for (const old of await ManualContribution.find().lean()) {
    const result = await Donation.updateOne(
      { legacyId: `manual:${old._id}` },
      {
        $setOnInsert: {
          donorName: old.contributorName,
          donorEmail: old.contributorEmail || "",
          amount: old.amount,
          method: "bank-transfer",
          status: "paid",
          paidAt: old.transferDate,
          createdBy: old.createdBy,
          showOnContributors: true,
        },
      },
      { upsert: true },
    );
    added += result.upsertedCount;
  }
  return added;
};

// Successful Paystack payments made through the old site. Their donors were
// never asked about the Contributors page, so they start hidden; the admin
// can switch each one on.
const importPaystackHistory = async (request = paystackRequest) => {
  let added = 0;
  let page = 1;
  let pageCount = 1;
  do {
    const result = await request(`/transaction?status=success&perPage=${PAGE_SIZE}&page=${page}`);
    if (!result.ok) throw new Error(`Paystack transactions page ${page} failed: ${result.status} ${result.message || ""}`);
    for (const tx of result.data || []) {
      if (tx.status !== "success" || !tx.reference) continue;
      const paidAt = new Date(tx.paid_at || tx.created_at);
      if (Number.isNaN(paidAt.getTime())) {
        console.warn(`Skipped Paystack ${tx.reference}: no payment date.`);
        continue;
      }
      const customer = tx.customer || {};
      const name = `${customer.first_name || ""} ${customer.last_name || ""}`.trim();
      const update = await Donation.updateOne(
        { paystackReference: String(tx.reference) },
        {
          $setOnInsert: {
            donorName: name || customer.email || "Unknown donor",
            donorEmail: (customer.email || "").toLowerCase(),
            amount: (Number(tx.amount) || 0) / 100,
            currency: tx.currency || "NGN",
            method: "paystack",
            status: "paid",
            channel: String(tx.channel || "").slice(0, 40),
            paidAt,
            showOnContributors: false,
            legacyId: `paystack:${tx.reference}`,
          },
        },
        { upsert: true },
      );
      added += update.upsertedCount;
    }
    pageCount = Number(result.meta?.pageCount) || 1;
    page += 1;
  } while (page <= pageCount && page <= MAX_PAGES);
  return added;
};

module.exports = { importManualContributions, importPaystackHistory };
