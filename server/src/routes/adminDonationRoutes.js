// Admin · Donations (Figma): one list of every gift, the details screen, and
// Record a bank transfer. Mounted at /api/admin/donations, admin only.
// Paystack amounts and statuses come from Paystack and cannot be changed
// here (refunds happen in the Paystack dashboard); the admin can only switch
// the Contributors listing and keep a private note. Recorded bank transfers
// and cash gifts can be edited and deleted.
const express = require("express");
const mongoose = require("mongoose");
const auth = require("../middleware/auth");
const adminOnly = require("../middleware/admin");
const Donation = require("../models/Donation");
const { serverError } = require("../lib/http");

const router = express.Router();
router.use(auth, adminOnly);

const RECORDED_METHODS = ["bank-transfer", "cash"];
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const toAdminJSON = (d) => ({
  id: d._id,
  donorName: d.donorName,
  donorEmail: d.donorEmail,
  phone: d.phone,
  amount: d.amount,
  currency: d.currency,
  method: d.method,
  channel: d.channel,
  status: d.displayStatus(),
  paystackReference: d.paystackReference || "",
  bankReference: d.bankReference,
  // When the money arrived; for an unpaid checkout, when it was started.
  date: d.paidAt || d.createdAt,
  anonymous: d.anonymous,
  showOnContributors: d.showOnContributors,
  note: d.note,
  editable: RECORDED_METHODS.includes(d.method),
  createdAt: d.createdAt,
});

const escapeRegex = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const notFound = (res) => res.status(404).json({ message: "Donation not found." });

// Check and clean the fields of a recorded gift. `partial` allows leaving
// fields out (editing). Returns { values } or { error }.
const readRecordedGift = (body, { partial = false } = {}) => {
  const values = {};
  const has = (key) => body[key] !== undefined;

  if (has("donorName") || !partial) {
    const name = typeof body.donorName === "string" ? body.donorName.trim() : "";
    if (!name || name.length > 120) return { error: "Enter the donor’s full name." };
    values.donorName = name;
  }
  if (has("donorEmail")) {
    const email = typeof body.donorEmail === "string" ? body.donorEmail.trim().toLowerCase() : "";
    if (email && (!EMAIL_PATTERN.test(email) || email.length > 254)) return { error: "Enter a valid email address." };
    values.donorEmail = email;
  }
  if (has("amount") || !partial) {
    const amount = Math.round(Number(body.amount) * 100) / 100;
    if (!Number.isFinite(amount) || amount <= 0) return { error: "Enter the amount received." };
    values.amount = amount;
  }
  if (has("paidAt") || !partial) {
    const date = new Date(body.paidAt);
    if (Number.isNaN(date.getTime())) return { error: "Choose the date the money was received." };
    if (date.getTime() > Date.now() + 24 * 60 * 60 * 1000) return { error: "The date received cannot be in the future." };
    values.paidAt = date;
  }
  if (has("method") || !partial) {
    if (!RECORDED_METHODS.includes(body.method)) return { error: "Choose how it was paid." };
    values.method = body.method;
  }
  if (has("bankReference")) {
    const ref = typeof body.bankReference === "string" ? body.bankReference.trim() : "";
    if (ref.length > 100) return { error: "The bank reference is too long." };
    values.bankReference = ref;
  }
  return { values };
};

// Fields the admin can set on any donation.
const readListingFields = (body) => {
  const values = {};
  if (body.note !== undefined) {
    const note = typeof body.note === "string" ? body.note.trim() : "";
    if (note.length > 2000) return { error: "The note is too long." };
    values.note = note;
  }
  if (body.showOnContributors !== undefined) values.showOnContributors = body.showOnContributors === true;
  if (body.anonymous !== undefined) values.anonymous = body.anonymous === true;
  return { values };
};

// List with the filters on the Figma Donations screen. All matching rows
// come back at once (paging and CSV export happen in the browser).
router.get("/", async (req, res) => {
  try {
    const { status, method, hidden, q } = req.query;
    const filter = {};
    const cutoff = new Date(Date.now() - Donation.ABANDONED_AFTER_MS);

    if (method === "paystack") filter.method = "paystack";
    else if (method === "recorded") filter.method = { $in: RECORDED_METHODS };
    if (hidden === "true") filter.showOnContributors = false;

    if (status === "paid" || status === "failed") filter.status = status;
    else if (status === "pending") Object.assign(filter, { status: "pending", createdAt: { $gte: cutoff } });
    else if (status === "not-completed") {
      filter.$or = [{ status: "not-completed" }, { status: "pending", createdAt: { $lt: cutoff } }];
    }

    if (typeof q === "string" && q.trim()) {
      const pattern = new RegExp(escapeRegex(q.trim().slice(0, 100)), "i");
      const search = [{ donorName: pattern }, { donorEmail: pattern }, { paystackReference: pattern }];
      filter.$and = [...(filter.$and || []), { $or: search }];
    }

    const donations = await Donation.find(filter);
    const rows = donations
      .map(toAdminJSON)
      .sort((a, b) => new Date(b.date) - new Date(a.date));
    return res.json({ donations: rows, total: rows.length });
  } catch (error) {
    return serverError(res, error);
  }
});

router.get("/:id", async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return notFound(res);
    const donation = await Donation.findById(req.params.id);
    if (!donation) return notFound(res);
    return res.json({ donation: toAdminJSON(donation) });
  } catch (error) {
    return serverError(res, error);
  }
});

// Record a bank transfer or cash gift. It counts as received at once.
router.post("/", async (req, res) => {
  try {
    const gift = readRecordedGift(req.body);
    if (gift.error) return res.status(400).json({ message: gift.error });
    const listing = readListingFields(req.body);
    if (listing.error) return res.status(400).json({ message: listing.error });

    const donation = await Donation.create({
      donorEmail: "",
      ...gift.values,
      ...listing.values,
      status: "paid",
      createdBy: req.user._id,
    });
    return res.status(201).json({ message: "Transfer saved.", donation: toAdminJSON(donation) });
  } catch (error) {
    return serverError(res, error);
  }
});

router.patch("/:id", async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return notFound(res);
    const donation = await Donation.findById(req.params.id);
    if (!donation) return notFound(res);

    const listing = readListingFields(req.body);
    if (listing.error) return res.status(400).json({ message: listing.error });

    let giftValues = {};
    if (RECORDED_METHODS.includes(donation.method)) {
      const gift = readRecordedGift(req.body, { partial: true });
      if (gift.error) return res.status(400).json({ message: gift.error });
      giftValues = gift.values;
    } else {
      const locked = ["donorName", "donorEmail", "amount", "paidAt", "method", "status", "bankReference", "anonymous"];
      if (locked.some((key) => req.body[key] !== undefined)) {
        return res.status(400).json({
          message: "Paystack donations come from Paystack: only the Contributors switch and the note can change.",
        });
      }
    }

    donation.set({ ...giftValues, ...listing.values });
    await donation.save();
    return res.json({ message: "Saved.", donation: toAdminJSON(donation) });
  } catch (error) {
    return serverError(res, error);
  }
});

router.delete("/:id", async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return notFound(res);
    const donation = await Donation.findById(req.params.id);
    if (!donation) return notFound(res);
    if (!RECORDED_METHODS.includes(donation.method)) {
      return res.status(400).json({ message: "Paystack donations cannot be deleted; refunds happen in the Paystack dashboard." });
    }
    await donation.deleteOne();
    return res.json({ message: "Deleted." });
  } catch (error) {
    return serverError(res, error);
  }
});

module.exports = router;
