// Paystack: calls to its API, webhook signature checks, and the one rule for
// marking a donation paid. A donation is only "paid" when Paystack's own
// record says success AND the amount and currency match what we saved, so a
// tampered or mixed-up payment never counts.
const crypto = require("crypto");

const PAYSTACK_API = "https://api.paystack.co";

// Returns { ok, status, data, meta, message } from Paystack's reply.
const paystackRequest = async (path, { method = "GET", body } = {}) => {
  const response = await fetch(`${PAYSTACK_API}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await response.json().catch(() => ({}));
  return {
    ok: response.ok && json.status === true,
    status: response.status,
    data: json.data,
    meta: json.meta,
    message: json.message,
  };
};

// Paystack signs each webhook: HMAC SHA512 of the raw body with the secret
// key, hex, in the x-paystack-signature header.
const isValidSignature = (rawBody, signature) => {
  const secret = process.env.PAYSTACK_SECRET_KEY;
  if (!secret || !rawBody || typeof signature !== "string") return false;
  const expected = Buffer.from(crypto.createHmac("sha512", secret).update(rawBody).digest("hex"));
  const given = Buffer.from(signature);
  return expected.length === given.length && crypto.timingSafeEqual(expected, given);
};

const toKobo = (naira) => Math.round(naira * 100);

// Apply Paystack's transaction record to our donation. Safe to run twice
// (the verify call and the webhook can both arrive).
const applyPaystackResult = async (donation, transaction) => {
  if (!transaction || donation.status === "paid") return donation;

  if (transaction.status === "success") {
    const sameAmount = Number(transaction.amount) === toKobo(donation.amount);
    const sameCurrency = (transaction.currency || "NGN") === donation.currency;
    if (!sameAmount || !sameCurrency) {
      console.error(
        `Paystack ${donation.paystackReference}: amount or currency does not match the donation; not marked paid.`,
      );
      return donation;
    }
    donation.status = "paid";
    donation.paidAt = transaction.paid_at ? new Date(transaction.paid_at) : new Date();
    donation.channel = String(transaction.channel || "").slice(0, 40);
    await donation.save();
  } else if (transaction.status === "failed" || transaction.status === "reversed") {
    donation.status = "failed";
    await donation.save();
  } else if (transaction.status === "abandoned") {
    donation.status = "not-completed";
    await donation.save();
  }
  return donation;
};

module.exports = { paystackRequest, isValidSignature, applyPaystackResult, toKobo };
