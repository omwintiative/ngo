// Every gift in one list (API-PLAN.md, Part B; Figma Admin · Donations):
// Paystack donations, saved when the donor starts the checkout and marked
// paid only after Paystack confirms them, plus bank transfers and cash gifts
// the admin records (shown as "Received").
const mongoose = require("mongoose");

const METHODS = ["paystack", "bank-transfer", "cash"];
// "failed": Paystack declined the payment. "not-completed": the donor left
// the checkout without paying (see ABANDONED_AFTER_MS).
const STATUSES = ["pending", "paid", "failed", "not-completed"];

// A Paystack checkout still "pending" after this long was left unpaid; the
// admin sees it as "Not completed" (Figma Admin · Donations).
const ABANDONED_AFTER_MS = 24 * 60 * 60 * 1000;

const donationSchema = new mongoose.Schema(
  {
    donorName: { type: String, required: true, trim: true, maxlength: 120 },
    // Optional for recorded gifts (Figma: "Email address (optional)").
    donorEmail: { type: String, trim: true, lowercase: true, maxlength: 254, default: "" },
    phone: { type: String, trim: true, maxlength: 30, default: "" },
    // Naira. Paystack works in kobo; convert at the edge (x100).
    amount: { type: Number, required: true, min: 0 },
    currency: { type: String, default: "NGN" },
    method: { type: String, enum: METHODS, required: true },
    status: { type: String, enum: STATUSES, default: "pending" },
    paystackReference: { type: String, unique: true, sparse: true },
    // How the donor paid on Paystack's checkout: card, bank, ussd, bank_transfer…
    channel: { type: String, trim: true, maxlength: 40, default: "" },
    // From the bank alert, for recorded transfers (optional).
    bankReference: { type: String, trim: true, maxlength: 100, default: "" },
    paidAt: { type: Date },
    // Donor asked not to be named. Then showOnContributors is always false.
    anonymous: { type: Boolean, default: false },
    // Admin's switch for the public Contributors page.
    showOnContributors: { type: Boolean, default: true },
    // Private admin note, never public.
    note: { type: String, trim: true, maxlength: 2000, default: "" },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    // Marks records copied in once from the old data, so the import can run
    // twice without making duplicates.
    legacyId: { type: String, unique: true, sparse: true },
  },
  { timestamps: true },
);

donationSchema.pre("validate", function keepAnonymousHidden(next) {
  if (this.anonymous) this.showOnContributors = false;
  next();
});

// What the admin sees: an old unpaid checkout counts as "not-completed".
donationSchema.methods.displayStatus = function displayStatus(now = Date.now()) {
  if (this.status === "pending" && now - this.createdAt.getTime() > ABANDONED_AFTER_MS) {
    return "not-completed";
  }
  return this.status;
};

module.exports = mongoose.model("Donation", donationSchema);
module.exports.METHODS = METHODS;
module.exports.ABANDONED_AFTER_MS = ABANDONED_AFTER_MS;
