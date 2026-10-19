const { test, before, after, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const Donation = require("../src/models/Donation");
const ManualContribution = require("../src/models/ManualContribution");
const { startOfMonthInNigeria } = require("../src/routes/adminRoutes");
const { importManualContributions, importPaystackHistory } = require("../src/lib/importDonations");
const { startServer, createAdmin, request, signIn } = require("./helpers");

let server;
let cookie;
let admin;
before(async () => {
  server = await startServer();
  admin = await createAdmin();
  ({ cookie } = await signIn(server.base));
});
after(() => server.stop());
beforeEach(() => Donation.deleteMany({}));

const DAY = 24 * 60 * 60 * 1000;
const paystackGift = (overrides = {}) =>
  Donation.create({
    donorName: "Adaeze Okafor",
    donorEmail: "adaeze@example.com",
    amount: 10000,
    method: "paystack",
    status: "paid",
    paidAt: new Date(),
    paystackReference: `ref_${Math.random().toString(36).slice(2)}`,
    ...overrides,
  });

const api = (method, path, body) => request(server.base, method, path, { cookie, body });

test("public Contributors list: paid, not anonymous, not hidden; first name and initial only", async () => {
  await paystackGift({ donorName: "Adaeze  Chioma okafor", paidAt: new Date("2026-09-28") });
  await paystackGift({ donorName: "Bola", paidAt: new Date("2026-07-02") });
  await paystackGift({ donorName: "Anon Donor", anonymous: true });
  await paystackGift({ donorName: "Hidden Donor", showOnContributors: false });
  await paystackGift({ donorName: "Pending Donor", status: "pending", paidAt: undefined });
  await paystackGift({ donorName: "Failed Donor", status: "failed" });

  const res = await request(server.base, "GET", "/api/contributors");
  assert.equal(res.status, 200);
  assert.deepEqual(res.body.map((p) => p.name), ["Adaeze O.", "Bola"]);
  assert.equal(res.body[0].date, "2026-09-28T00:00:00.000Z");
  const text = JSON.stringify(res.body);
  assert.doesNotMatch(text, /example\.com|10000|amount|email/i);
});

test("an anonymous gift can never be switched onto the Contributors page", async () => {
  const gift = await paystackGift({ anonymous: true });
  assert.equal(gift.showOnContributors, false);
  const res = await api("PATCH", `/api/admin/donations/${gift._id}`, { showOnContributors: true });
  assert.equal(res.status, 200);
  assert.equal(res.body.donation.showOnContributors, false);
});

test("admin donation routes need the signed-in admin", async () => {
  assert.equal((await request(server.base, "GET", "/api/admin/donations")).status, 401);
  assert.equal((await request(server.base, "GET", "/api/admin/summary")).status, 401);
});

test("list: newest first, with status, method, hidden and search filters", async () => {
  await paystackGift({ donorName: "Old Paid", paidAt: new Date(Date.now() - 10 * DAY) });
  await paystackGift({ donorName: "New Paid", donorEmail: "new@example.com", paidAt: new Date() });
  const stale = await paystackGift({ donorName: "Left Checkout", status: "pending", paidAt: undefined });
  await Donation.collection.updateOne({ _id: stale._id }, { $set: { createdAt: new Date(Date.now() - 2 * DAY) } });
  await paystackGift({ donorName: "Still Paying", status: "pending", paidAt: undefined });
  await paystackGift({ donorName: "Hidden One", showOnContributors: false });
  await Donation.create({ donorName: "Tunde Bank", amount: 25000, method: "bank-transfer", status: "paid", paidAt: new Date(Date.now() - DAY) });

  const all = await api("GET", "/api/admin/donations");
  assert.equal(all.status, 200);
  assert.equal(all.body.total, 6);
  const dates = all.body.donations.map((d) => new Date(d.date).getTime());
  assert.deepEqual(dates, [...dates].sort((a, b) => b - a));
  assert.equal(all.body.donations.find((d) => d.donorName === "Left Checkout").status, "not-completed");

  const names = async (query) => (await api("GET", `/api/admin/donations?${query}`)).body.donations.map((d) => d.donorName).sort();
  assert.deepEqual(await names("status=not-completed"), ["Left Checkout"]);
  assert.deepEqual(await names("status=pending"), ["Still Paying"]);
  assert.deepEqual(await names("method=recorded"), ["Tunde Bank"]);
  assert.deepEqual(await names("hidden=true"), ["Hidden One"]);
  assert.deepEqual(await names("q=new%40example"), ["New Paid"]);
  assert.deepEqual(await names("q=.*"), [], "search text is literal, not a pattern");
});

test("record a bank transfer: checked, saved as received, and editable", async () => {
  const bad = await api("POST", "/api/admin/donations", { donorName: "", amount: 100, paidAt: "2026-09-01", method: "bank-transfer" });
  assert.equal(bad.status, 400);
  const future = await api("POST", "/api/admin/donations", { donorName: "T", amount: 100, paidAt: "2999-01-01", method: "cash" });
  assert.equal(future.status, 400);
  const notRecorded = await api("POST", "/api/admin/donations", { donorName: "T", amount: 100, paidAt: "2026-09-01", method: "paystack" });
  assert.equal(notRecorded.status, 400);

  const res = await api("POST", "/api/admin/donations", {
    donorName: "Tunde Adeyemi",
    amount: "25000",
    paidAt: "2026-09-24",
    method: "bank-transfer",
    bankReference: "FT123",
    note: "Monthly gift",
    showOnContributors: true,
  });
  assert.equal(res.status, 201);
  const gift = res.body.donation;
  assert.equal(gift.status, "paid");
  assert.equal(gift.donorEmail, "", "email is optional");
  assert.equal(gift.amount, 25000);
  assert.equal(gift.editable, true);

  const saved = await Donation.findById(gift.id);
  assert.equal(String(saved.createdBy), String(admin._id));

  const edit = await api("PATCH", `/api/admin/donations/${gift.id}`, { amount: 30000, donorEmail: "tunde@example.com", note: "Corrected" });
  assert.equal(edit.status, 200);
  assert.equal(edit.body.donation.amount, 30000);
  assert.equal(edit.body.donation.note, "Corrected");

  assert.equal((await api("DELETE", `/api/admin/donations/${gift.id}`)).status, 200);
  assert.equal(await Donation.countDocuments({ _id: gift.id }), 0);
});

test("Paystack donations: only the switch and note change; no deleting", async () => {
  const gift = await paystackGift();
  for (const body of [{ amount: 1 }, { status: "failed" }, { donorName: "X" }, { anonymous: true }]) {
    assert.equal((await api("PATCH", `/api/admin/donations/${gift._id}`, body)).status, 400, JSON.stringify(body));
  }
  const ok = await api("PATCH", `/api/admin/donations/${gift._id}`, { showOnContributors: false, note: "Asked by phone" });
  assert.equal(ok.status, 200);
  assert.equal(ok.body.donation.showOnContributors, false);
  assert.equal(ok.body.donation.amount, 10000);
  assert.equal((await api("DELETE", `/api/admin/donations/${gift._id}`)).status, 400);
  assert.equal((await api("GET", "/api/admin/donations/not-an-id")).status, 404);
});

test("dashboard summary: this month's paid gifts, donors and first-time donors", async () => {
  const monthStart = startOfMonthInNigeria();
  const lastMonth = new Date(monthStart.getTime() - 3 * DAY);
  const thisMonth = new Date(monthStart.getTime() + 60 * 1000);
  await paystackGift({ donorEmail: "repeat@example.com", amount: 5000, paidAt: lastMonth });
  await paystackGift({ donorEmail: "repeat@example.com", amount: 10000, paidAt: thisMonth });
  await paystackGift({ donorEmail: "first@example.com", amount: 2500, paidAt: thisMonth });
  await Donation.create({ donorName: "Cash Giver", amount: 1000, method: "cash", status: "paid", paidAt: thisMonth });
  await paystackGift({ donorEmail: "unpaid@example.com", status: "pending", paidAt: undefined });

  const res = await api("GET", "/api/admin/summary");
  assert.equal(res.status, 200);
  assert.deepEqual(res.body.donationsThisMonth, { total: 13500, count: 3 });
  assert.deepEqual(res.body.donorsThisMonth, { count: 3, firstTime: 2 });
  assert.equal(res.body.recentDonations.length, 5);
});

test("start of month is counted in Nigerian time", () => {
  // 31 Oct 2026, 23:30 UTC is already 1 Nov in Lagos
  assert.equal(startOfMonthInNigeria(new Date("2026-10-31T23:30:00Z")).toISOString(), "2026-10-31T23:00:00.000Z");
  assert.equal(startOfMonthInNigeria(new Date("2026-10-15T12:00:00Z")).toISOString(), "2026-09-30T23:00:00.000Z");
});

test("import: old bank transfers and Paystack history come in once, Paystack donors hidden", async () => {
  await ManualContribution.deleteMany({});
  await ManualContribution.create({ contributorName: "Kemi Ade", contributorEmail: "kemi@example.com", amount: 20000, transferDate: new Date("2026-08-01"), createdBy: admin._id });
  await paystackGift({ paystackReference: "ref_existing", donorName: "Already Here", status: "paid" });

  const pages = {
    1: { status: true, meta: { pageCount: 2 }, data: [
      { reference: "ref_existing", status: "success", amount: 999, paid_at: "2026-06-01T10:00:00Z", customer: { email: "x@example.com" } },
      { reference: "ref_no_date", status: "success", amount: 100, customer: { email: "nodate@example.com" } },
      { reference: "ref_old_1", status: "success", amount: 500000, currency: "NGN", channel: "card", paid_at: "2026-05-01T10:00:00Z", customer: { first_name: "Ibrahim", last_name: "Musa", email: "IBRAHIM@example.com" } },
    ] },
    2: { status: true, meta: { pageCount: 2 }, data: [
      { reference: "ref_old_2", status: "success", amount: 100000, paid_at: "2026-04-01T10:00:00Z", customer: { email: "noname@example.com" } },
    ] },
  };
  const fakeRequest = async (path) => {
    const page = Number(new URL(`https://x${path}`).searchParams.get("page"));
    return { ok: true, ...pages[page] };
  };

  assert.equal(await importManualContributions(), 1);
  assert.equal(await importPaystackHistory(fakeRequest), 2);
  // Running again adds nothing
  assert.equal(await importManualContributions(), 0);
  assert.equal(await importPaystackHistory(fakeRequest), 0);

  const existing = await Donation.findOne({ paystackReference: "ref_existing" });
  assert.equal(existing.donorName, "Already Here", "existing records are not changed");
  const ibrahim = await Donation.findOne({ paystackReference: "ref_old_1" });
  assert.equal(ibrahim.donorName, "Ibrahim Musa");
  assert.equal(ibrahim.donorEmail, "ibrahim@example.com");
  assert.equal(ibrahim.amount, 5000);
  assert.equal(ibrahim.showOnContributors, false);
  const kemi = await Donation.findOne({ method: "bank-transfer" });
  assert.equal(kemi.donorName, "Kemi Ade");
  assert.equal(kemi.status, "paid");
  assert.equal(kemi.showOnContributors, true);

});
