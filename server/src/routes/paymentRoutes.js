// Paystack donations (API-PLAN.md, Part B).
// 1. initialize: the Donate page starts a checkout; we save a pending Donation.
// 2. verify: the Thank you page asks whether that payment went through.
// 3. webhook: Paystack tells us directly, in case the donor closed the tab.
const express = require("express");
const auth = require("../middleware/auth");
const adminOnly = require("../middleware/admin");
const Donation = require("../models/Donation");
const { serverError } = require("../lib/http");
const { paystackRequest, isValidSignature, applyPaystackResult, toKobo } = require("../lib/paystack");

const router = express.Router();

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
// Paystack references are letters, digits and a few separators.
const REFERENCE_PATTERN = /^[A-Za-z0-9._=-]{1,100}$/;

const configured = () => Boolean(process.env.PAYSTACK_SECRET_KEY && process.env.PAYSTACK_CALLBACK_URL);

router.post("/paystack/initialize", async (req, res) => {
  try {
    if (!configured()) {
      console.error("Paystack is not configured: PAYSTACK_SECRET_KEY or PAYSTACK_CALLBACK_URL missing.");
      return res.status(503).json({ message: "Online giving is not available right now. Please try again later." });
    }

    const { email, amount, name, phone, anonymous } = req.body;
    const donorEmail = typeof email === "string" ? email.trim().toLowerCase() : "";
    const amountValue = Math.round(Number(amount) * 100) / 100;

    if (!EMAIL_PATTERN.test(donorEmail) || donorEmail.length > 254) {
      return res.status(400).json({ message: "Enter a valid email address." });
    }
    if (!Number.isFinite(amountValue) || amountValue <= 0) {
      return res.status(400).json({ message: "Enter an amount to give." });
    }
    const donorName = typeof name === "string" ? name.trim() : "";
    if (donorName.length > 120 || (typeof phone === "string" && phone.trim().length > 30)) {
      return res.status(400).json({ message: "Please shorten your name or phone number." });
    }

    const result = await paystackRequest("/transaction/initialize", {
      method: "POST",
      body: {
        email: donorEmail,
        amount: toKobo(amountValue),
        callback_url: process.env.PAYSTACK_CALLBACK_URL,
      },
    });
    if (!result.ok || !result.data?.reference) {
      console.error("Paystack initialize failed:", result.status, result.message);
      return res.status(502).json({ message: "We could not start the payment. Please try again." });
    }

    await Donation.create({
      // The old site sends no name: keep the gift, but never show it publicly.
      donorName: donorName || donorEmail,
      donorEmail,
      phone: typeof phone === "string" ? phone.trim() : "",
      amount: amountValue,
      method: "paystack",
      status: "pending",
      paystackReference: result.data.reference,
      anonymous: anonymous === true || !donorName,
    });

    return res.json({
      message: "Payment initialized successfully.",
      authorizationUrl: result.data.authorization_url,
      reference: result.data.reference,
      accessCode: result.data.access_code,
    });
  } catch (error) {
    return serverError(res, error, "We could not start the payment. Please try again.");
  }
});

// Public: the Thank you page passes the ?reference= Paystack added to its
// address. Answers only with the outcome, never donor details.
router.get("/paystack/verify/:reference", async (req, res) => {
  try {
    const { reference } = req.params;
    const donation = REFERENCE_PATTERN.test(reference)
      ? await Donation.findOne({ paystackReference: reference })
      : null;
    if (!donation) {
      return res.status(404).json({ message: "We could not find that payment." });
    }

    if (donation.status !== "paid") {
      const result = await paystackRequest(`/transaction/verify/${encodeURIComponent(reference)}`);
      if (!result.ok) {
        console.error("Paystack verify failed:", result.status, result.message);
        return res.status(502).json({ message: "We could not confirm the payment yet. Please refresh in a moment." });
      }
      await applyPaystackResult(donation, result.data);
    }

    return res.json({ status: donation.displayStatus(), amount: donation.amount, currency: donation.currency });
  } catch (error) {
    return serverError(res, error);
  }
});

// Paystack's server calls this. Anything without a valid signature is refused.
// Answer 200 for events we do not need, so Paystack stops retrying them; a
// 500 (database down) makes Paystack retry later, which is what we want.
router.post("/paystack/webhook", async (req, res) => {
  if (!isValidSignature(req.rawBody, req.get("x-paystack-signature"))) {
    return res.status(401).json({ message: "Invalid signature." });
  }
  try {
    const { event, data } = req.body || {};
    if (event === "charge.success" && data?.reference) {
      const donation = await Donation.findOne({ paystackReference: String(data.reference) });
      if (donation) await applyPaystackResult(donation, data);
      else console.warn(`Paystack webhook for an unknown reference: ${data.reference}`);
    }
    return res.sendStatus(200);
  } catch (error) {
    return serverError(res, error);
  }
});

// Old site's admin list, read live from Paystack. TODO at launch: remove
// (the new admin reads saved Donations).
const PAYSTACK_PAGE_SIZE = 100;
const PAYSTACK_MAX_PAGES = 50;

router.get("/paystack/transactions", auth, adminOnly, async (req, res) => {
  try {
    if (!process.env.PAYSTACK_SECRET_KEY) {
      return res.status(503).json({ message: "Paystack is not configured." });
    }

    const allTransactions = [];
    let page = 1;
    let pageCount = 1;

    do {
      const result = await paystackRequest(
        `/transaction?status=success&perPage=${PAYSTACK_PAGE_SIZE}&page=${page}`,
      );
      if (!result.ok) {
        console.error("Paystack transactions failed:", result.status, result.message);
        return res.status(502).json({ message: "Unable to fetch Paystack transactions." });
      }
      allTransactions.push(...(result.data || []));
      pageCount = Number(result.meta?.pageCount) || 1;
      page += 1;
    } while (page <= pageCount && page <= PAYSTACK_MAX_PAGES);

    const successfulTransactions = allTransactions
      .filter((transaction) => transaction.status === "success")
      .map((transaction) => ({
        id: transaction.id,
        contributorName:
          transaction.customer?.first_name || transaction.customer?.last_name
            ? `${transaction.customer?.first_name || ""} ${transaction.customer?.last_name || ""}`.trim()
            : transaction.customer?.email || "Unknown Contributor",
        contributorEmail: transaction.customer?.email || "N/A",
        amount: (transaction.amount || 0) / 100,
        transferDate: transaction.paid_at || transaction.created_at,
        reference: transaction.reference,
      }));

    return res.json({ transactions: successfulTransactions });
  } catch (error) {
    return serverError(res, error, "Unable to fetch Paystack transactions.");
  }
});

module.exports = router;
