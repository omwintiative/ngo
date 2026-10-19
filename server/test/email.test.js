// Part E: password reset by email and new-message alerts. Resend is replaced
// by a stand-in that records the emails instead of sending them.
const { test, before, after, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const { ADMIN, startServer, createAdmin, request, signIn } = require("./helpers");
const User = require("../src/models/User");
const Message = require("../src/models/Message");
const authRoutes = require("../src/routes/authRoutes");
const contactRoutes = require("../src/routes/contactRoutes");
const loginLimiter = require("../src/lib/loginLimiter");

let server;
const sent = [];
const realFetch = globalThis.fetch;

before(async () => {
  process.env.RESEND_API_KEY = "re_test_only";
  process.env.EMAIL_FROM = "OMWI website <no-reply@omwinitiative.org>";
  process.env.MESSAGE_ALERT_TO = "info@omwinitiative.org";
  process.env.ADMIN_SITE_URL = "http://localhost:4321/admin/";
  globalThis.fetch = async (url, init = {}) => {
    if (String(url) !== "https://api.resend.com/emails") return realFetch(url, init);
    sent.push({ headers: init.headers, ...JSON.parse(init.body) });
    return new Response(JSON.stringify({ id: `email_${sent.length}` }), { status: 200 });
  };
  server = await startServer();
});
after(async () => {
  globalThis.fetch = realFetch;
  await server.stop();
});
beforeEach(async () => {
  sent.length = 0;
  await User.deleteMany({});
  await Message.deleteMany({});
  await createAdmin();
  authRoutes.resetLimits();
  contactRoutes.resetLimits();
  loginLimiter.resetAll();
});

// Emails go out in the background; wait for them.
const settle = async (count) => {
  for (let i = 0; i < 50 && sent.length < count; i += 1) await new Promise((r) => setTimeout(r, 20));
  await new Promise((r) => setTimeout(r, 50));
};
const forgot = (email) => request(server.base, "POST", "/api/auth/forgot-password", { body: { email } });
const reset = (token, newPassword) => request(server.base, "POST", "/api/auth/reset-password", { body: { token, newPassword } });
const tokenFrom = (email) => email.text.match(/reset-password\?token=([a-f0-9]{64})/)[1];
const NEW_PASSWORD = "a brand new admin password";

test("forgot password: the same answer for every address; only the admin gets a link", async () => {
  await User.create({ name: "Visitor", email: "visitor@example.com", password: "x" });
  const answers = [];
  for (const email of ["nobody@example.com", "visitor@example.com", ADMIN.email.toUpperCase()]) {
    const res = await forgot(email);
    assert.equal(res.status, 200);
    answers.push(res.body);
  }
  assert.deepEqual(answers[0], answers[1]);
  assert.deepEqual(answers[1], answers[2]);

  await settle(1);
  assert.equal(sent.length, 1);
  assert.equal(sent[0].to, ADMIN.email);
  assert.equal(sent[0].from, process.env.EMAIL_FROM);
  assert.equal(sent[0].headers.Authorization, "Bearer re_test_only");
  assert.match(sent[0].text, /http:\/\/localhost:4321\/admin\/reset-password\?token=[a-f0-9]{64}/);

  const stored = await User.findOne({ email: ADMIN.email });
  assert.notEqual(stored.passwordResetTokenHash, tokenFrom(sent[0]), "only a hash of the token is stored");
});

test("at most 3 reset emails an hour for one address", async () => {
  for (let i = 0; i < 5; i += 1) assert.equal((await forgot(ADMIN.email)).status, 200);
  await settle(3);
  assert.equal(sent.length, 3);
});

test("reset: the link sets a new password once and signs out every session", async () => {
  const before = await signIn(server.base);
  await forgot(ADMIN.email);
  await settle(1);
  const token = tokenFrom(sent[0]);

  const weak = await reset(token, "short");
  assert.equal(weak.status, 400);

  const res = await reset(token, NEW_PASSWORD);
  assert.equal(res.status, 200);
  assert.equal((await request(server.base, "GET", "/api/auth/me", { cookie: before.cookie })).status, 401);
  assert.equal(
    (await request(server.base, "POST", "/api/auth/login", { body: { email: ADMIN.email, password: ADMIN.password } })).status,
    401,
  );
  await signIn(server.base, { email: ADMIN.email, password: NEW_PASSWORD });

  assert.equal((await reset(token, "yet another long password")).status, 400, "the link works once");
});

test("reset: expired, unknown or malformed links are refused", async () => {
  await forgot(ADMIN.email);
  await settle(1);
  const token = tokenFrom(sent[0]);
  await User.updateOne({ email: ADMIN.email }, { passwordResetExpires: new Date(Date.now() - 1000) });
  assert.equal((await reset(token, NEW_PASSWORD)).status, 400);
  assert.equal((await reset("f".repeat(64), NEW_PASSWORD)).status, 400);
  assert.equal((await reset({ $ne: "" }, NEW_PASSWORD)).status, 400);
  await signIn(server.base);
});

test("a reset clears a sign-in pause", async () => {
  for (let i = 0; i < loginLimiter.MAX_FAILURES; i += 1) {
    await request(server.base, "POST", "/api/auth/login", { body: { email: ADMIN.email, password: "wrong" } });
  }
  await forgot(ADMIN.email);
  await settle(1);
  assert.equal((await reset(tokenFrom(sent[0]), NEW_PASSWORD)).status, 200);
  await signIn(server.base, { email: ADMIN.email, password: NEW_PASSWORD });
});

test("a new Contact message is emailed to the team, with Reply-To the visitor", async () => {
  const res = await request(server.base, "POST", "/api/contact", {
    body: { name: "Amaka Uche", email: "amaka@example.com", subject: "Volunteering\r\nBcc: someone@evil.example", message: "Hello OMWI team" },
  });
  assert.equal(res.status, 201);
  await settle(1);
  assert.equal(sent.length, 1);
  assert.equal(sent[0].to, "info@omwinitiative.org");
  assert.equal(sent[0].reply_to, "amaka@example.com");
  assert.doesNotMatch(sent[0].subject, /[\r\n]/, "no line breaks in the subject");
  assert.match(sent[0].text, /Hello OMWI team/);

  // The spam trap sends nothing
  await request(server.base, "POST", "/api/contact", {
    body: { name: "Bot", email: "bot@example.com", message: "Buy now", website: "http://spam.example" },
  });
  await settle(2);
  assert.equal(sent.length, 1);
});

test("without email settings nothing is sent and nothing breaks", async () => {
  const key = process.env.RESEND_API_KEY;
  delete process.env.RESEND_API_KEY;
  try {
    assert.equal((await forgot(ADMIN.email)).status, 200);
    assert.equal((await request(server.base, "POST", "/api/contact", { body: { name: "A", email: "a@example.com", message: "Hi" } })).status, 201);
    await settle(1);
    assert.equal(sent.length, 0);
  } finally {
    process.env.RESEND_API_KEY = key;
  }
});
