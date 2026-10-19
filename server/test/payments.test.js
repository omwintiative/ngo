const { test, before, after, beforeEach, afterEach } = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const Donation = require("../src/models/Donation");
const { startServer, request, fakePaystack } = require("./helpers");

let server;
let paystack;
before(async () => {
  server = await startServer();
});
after(() => server.stop());
beforeEach(() => Donation.deleteMany({}));
afterEach(() => paystack?.restore());

let nextRef = 0;
const initializeOk = () =>
  fakePaystack((path) => {
    if (path === "/transaction/initialize") {
      nextRef += 1;
      return {
        json: {
          status: true,
          data: { authorization_url: "https://checkout.paystack.com/abc", access_code: "abc", reference: `ref_${nextRef}` },
        },
      };
    }
    throw new Error(`unexpected Paystack call ${path}`);
  });

const verifyReturns = (transaction) =>
  fakePaystack((path) => {
    if (path.startsWith("/transaction/verify/")) return { json: { status: true, data: transaction } };
    throw new Error(`unexpected Paystack call ${path}`);
  });

const donate = (body) => request(server.base, "POST", "/api/payments/paystack/initialize", { body });

const pendingDonation = (overrides = {}) =>
  Donation.create({
    donorName: "Adaeze Okafor",
    donorEmail: "adaeze@example.com",
    amount: 10000,
    method: "paystack",
    status: "pending",
    paystackReference: "ref_known",
    ...overrides,
  });

const signedWebhook = (payload, secret = process.env.PAYSTACK_SECRET_KEY) => {
  const raw = JSON.stringify(payload);
  const signature = crypto.createHmac("sha512", secret).update(raw).digest("hex");
  return request(server.base, "POST", "/api/payments/paystack/webhook", {
    body: raw,
    headers: { "x-paystack-signature": signature },
  });
};

test("starting a donation saves it as pending with the donor's choices", async () => {
  paystack = initializeOk();
  const res = await donate({ amount: 5000, email: " Ngozi@Example.com ", name: "Ngozi Eze", phone: "+234 800", anonymous: true });
  assert.equal(res.status, 200);
  assert.match(res.body.authorizationUrl, /^https:\/\/checkout\.paystack\.com\//);

  assert.equal(paystack.calls.length, 1);
  assert.equal(paystack.calls[0].body.amount, 500000, "Paystack must get kobo");
  assert.equal(paystack.calls[0].body.email, "ngozi@example.com");

  const saved = await Donation.findOne({ paystackReference: res.body.reference });
  assert.equal(saved.status, "pending");
  assert.equal(saved.amount, 5000);
  assert.equal(saved.donorName, "Ngozi Eze");
  assert.equal(saved.phone, "+234 800");
  assert.equal(saved.anonymous, true);
  assert.equal(saved.showOnContributors, false, "anonymous donors are never listed");
});

test("a donation without a name (old site) is kept but never listed", async () => {
  paystack = initializeOk();
  const res = await donate({ amount: 1000, email: "old@example.com" });
  assert.equal(res.status, 200);
  const saved = await Donation.findOne({ paystackReference: res.body.reference });
  assert.equal(saved.anonymous, true);
});

test("bad email or amount is refused before Paystack is called", async () => {
  paystack = initializeOk();
  for (const body of [
    { amount: 1000, email: "nope" },
    { amount: 0, email: "a@b.co" },
    { amount: -5, email: "a@b.co" },
    { amount: "lots", email: "a@b.co" },
    { amount: 1000, email: { $gt: "" } },
  ]) {
    assert.equal((await donate(body)).status, 400, JSON.stringify(body));
  }
  assert.equal(paystack.calls.length, 0);
  assert.equal(await Donation.countDocuments(), 0);
});

test("if Paystack refuses, nothing is saved and the donor gets a plain message", async () => {
  paystack = fakePaystack(() => ({ status: 400, json: { status: false, message: "Invalid key" } }));
  const res = await donate({ amount: 1000, email: "a@b.co", name: "A B" });
  assert.equal(res.status, 502);
  assert.doesNotMatch(res.body.message, /Invalid key/);
  assert.equal(await Donation.countDocuments(), 0);
});

test("verify marks a donation paid only when Paystack says success and the amount matches", async () => {
  await pendingDonation();
  paystack = verifyReturns({ status: "success", amount: 1000000, currency: "NGN", paid_at: "2026-09-28T13:32:00Z", channel: "card" });
  const res = await request(server.base, "GET", "/api/payments/paystack/verify/ref_known");
  assert.equal(res.status, 200);
  assert.deepEqual(res.body, { status: "paid", amount: 10000, currency: "NGN" });

  const saved = await Donation.findOne({ paystackReference: "ref_known" });
  assert.equal(saved.status, "paid");
  assert.equal(saved.channel, "card");
  assert.equal(saved.paidAt.toISOString(), "2026-09-28T13:32:00.000Z");
});

test("verify does not mark paid when the amount or currency differs", async () => {
  await pendingDonation();
  paystack = verifyReturns({ status: "success", amount: 100, currency: "NGN" });
  const lower = await request(server.base, "GET", "/api/payments/paystack/verify/ref_known");
  assert.equal(lower.body.status, "pending");
  paystack.restore();

  paystack = verifyReturns({ status: "success", amount: 1000000, currency: "USD" });
  const currency = await request(server.base, "GET", "/api/payments/paystack/verify/ref_known");
  assert.equal(currency.body.status, "pending");
  assert.equal((await Donation.findOne({ paystackReference: "ref_known" })).status, "pending");
});

test("verify reports failed and abandoned payments", async () => {
  await pendingDonation();
  paystack = verifyReturns({ status: "failed", amount: 1000000 });
  assert.equal((await request(server.base, "GET", "/api/payments/paystack/verify/ref_known")).body.status, "failed");
  paystack.restore();

  await pendingDonation({ paystackReference: "ref_left" });
  paystack = verifyReturns({ status: "abandoned", amount: 1000000 });
  assert.equal((await request(server.base, "GET", "/api/payments/paystack/verify/ref_left")).body.status, "not-completed");
});

test("verify: unknown or odd references are 'not found' and never reach Paystack", async () => {
  paystack = verifyReturns({ status: "success" });
  for (const ref of ["nope", "bad%20ref%3Cscript%3E"]) {
    assert.equal((await request(server.base, "GET", `/api/payments/paystack/verify/${ref}`)).status, 404);
  }
  assert.equal(paystack.calls.length, 0);
});

test("verify does not call Paystack again once a donation is paid, and shows no donor details", async () => {
  await pendingDonation({ status: "paid", paidAt: new Date() });
  paystack = verifyReturns({ status: "failed" });
  const res = await request(server.base, "GET", "/api/payments/paystack/verify/ref_known");
  assert.equal(res.body.status, "paid");
  assert.equal(paystack.calls.length, 0);
  assert.doesNotMatch(JSON.stringify(res.body), /adaeze/i);
});

test("verify: if Paystack cannot be reached, say so without changing anything", async () => {
  await pendingDonation();
  paystack = fakePaystack(() => ({ status: 500, json: { status: false } }));
  const res = await request(server.base, "GET", "/api/payments/paystack/verify/ref_known");
  assert.equal(res.status, 502);
  assert.equal((await Donation.findOne({ paystackReference: "ref_known" })).status, "pending");
});

test("webhook: a signed charge.success marks the donation paid, once", async () => {
  await pendingDonation();
  const payload = { event: "charge.success", data: { reference: "ref_known", status: "success", amount: 1000000, currency: "NGN", channel: "ussd", paid_at: "2026-09-28T13:32:00Z" } };
  assert.equal((await signedWebhook(payload)).status, 200);
  assert.equal((await signedWebhook(payload)).status, 200);
  const all = await Donation.find({ paystackReference: "ref_known" });
  assert.equal(all.length, 1);
  assert.equal(all[0].status, "paid");
  assert.equal(all[0].channel, "ussd");
});

test("webhook: unsigned or wrongly signed messages are refused and change nothing", async () => {
  await pendingDonation();
  const payload = { event: "charge.success", data: { reference: "ref_known", status: "success", amount: 1000000 } };
  const unsigned = await request(server.base, "POST", "/api/payments/paystack/webhook", { body: payload });
  const wrongKey = await signedWebhook(payload, "sk_test_someone_else");
  assert.equal(unsigned.status, 401);
  assert.equal(wrongKey.status, 401);
  assert.equal((await Donation.findOne({ paystackReference: "ref_known" })).status, "pending");
});

test("webhook: wrong amount, unknown references and other events are accepted but ignored", async () => {
  await pendingDonation();
  const wrongAmount = await signedWebhook({ event: "charge.success", data: { reference: "ref_known", status: "success", amount: 1 } });
  const unknown = await signedWebhook({ event: "charge.success", data: { reference: "ref_other", status: "success", amount: 1000000 } });
  const otherEvent = await signedWebhook({ event: "transfer.success", data: { reference: "ref_known" } });
  assert.deepEqual([wrongAmount.status, unknown.status, otherEvent.status], [200, 200, 200]);
  assert.equal((await Donation.findOne({ paystackReference: "ref_known" })).status, "pending");
  assert.equal(await Donation.countDocuments(), 1);
});
