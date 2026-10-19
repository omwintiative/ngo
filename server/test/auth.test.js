const { test, before, after, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const User = require("../src/models/User");
const loginLimiter = require("../src/lib/loginLimiter");
const { ADMIN, startServer, createAdmin, request, signIn } = require("./helpers");

let server;
before(async () => {
  server = await startServer();
  await createAdmin();
});
after(() => server.stop());
beforeEach(() => loginLimiter.resetAll());

test("sign-in sets a secure, HttpOnly, SameSite=Strict session cookie", async () => {
  const res = await signIn(server.base);
  assert.ok(res.setCookie, "no session cookie");
  assert.match(res.setCookie, /HttpOnly/i);
  assert.match(res.setCookie, /Secure/i);
  assert.match(res.setCookie, /SameSite=Strict/i);
  assert.match(res.setCookie, /Path=\//);
  assert.doesNotMatch(res.setCookie, /Expires=/, "ends when the browser closes");
  // Old site still gets its token and user until launch
  assert.ok(res.body.token);
  assert.equal(res.body.user.email, ADMIN.email);
  assert.equal(res.body.user.password, undefined);
});

test("'Keep me signed in' keeps the cookie for 30 days", async () => {
  const res = await request(server.base, "POST", "/api/auth/login", {
    body: { email: ADMIN.email, password: ADMIN.password, remember: true },
  });
  assert.equal(res.status, 200);
  const expires = new Date(res.setCookie.match(/Expires=([^;]+)/)[1]).getTime();
  const days = (expires - Date.now()) / (24 * 60 * 60 * 1000);
  assert.ok(days > 29.9 && days <= 30, `expires in ${days} days`);
  assert.equal((await request(server.base, "GET", "/api/auth/me", { cookie: res.cookie })).status, 200);
});

test("wrong password or unknown email gives the same 401", async () => {
  const wrong = await request(server.base, "POST", "/api/auth/login", {
    body: { email: ADMIN.email, password: "not it" },
  });
  const unknown = await request(server.base, "POST", "/api/auth/login", {
    body: { email: "nobody@example.com", password: "not it" },
  });
  assert.equal(wrong.status, 401);
  assert.equal(unknown.status, 401);
  assert.deepEqual(wrong.body, unknown.body);
  assert.equal(wrong.cookie, null);
});

test("missing or non-text credentials give 400", async () => {
  const res = await request(server.base, "POST", "/api/auth/login", { body: { email: { $ne: "" }, password: "x" } });
  assert.equal(res.status, 400);
});

test("/me works with the cookie and with a Bearer token, and not without", async () => {
  const { cookie, body } = await signIn(server.base);
  const viaCookie = await request(server.base, "GET", "/api/auth/me", { cookie });
  const viaToken = await request(server.base, "GET", "/api/auth/me", { token: body.token });
  const none = await request(server.base, "GET", "/api/auth/me");
  assert.equal(viaCookie.status, 200);
  assert.equal(viaCookie.body.user.email, ADMIN.email);
  assert.equal(viaCookie.body.user.password, undefined);
  assert.equal(viaCookie.body.user.sessionVersion, undefined);
  assert.equal(viaToken.status, 200);
  assert.equal(none.status, 401);
});

test("a forged or tampered session is refused", async () => {
  const { cookie } = await signIn(server.base);
  const tampered = cookie.slice(0, -3) + (cookie.endsWith("abc") ? "xyz" : "abc");
  const res = await request(server.base, "GET", "/api/auth/me", { cookie: tampered });
  assert.equal(res.status, 401);
});

test("sign-out clears the cookie", async () => {
  const res = await request(server.base, "POST", "/api/auth/logout");
  assert.equal(res.status, 200);
  assert.ok(res.setCookie);
  assert.match(res.setCookie, /omwi_session=;/);
  assert.match(res.setCookie, /Expires=Thu, 01 Jan 1970/);
});

test("sign-in pauses after 5 wrong passwords, even with the right one", async () => {
  for (let i = 0; i < loginLimiter.MAX_FAILURES; i += 1) {
    const res = await request(server.base, "POST", "/api/auth/login", {
      body: { email: ADMIN.email, password: `wrong ${i}` },
    });
    assert.equal(res.status, 401);
  }
  const locked = await request(server.base, "POST", "/api/auth/login", {
    body: { email: ADMIN.email.toUpperCase(), password: ADMIN.password },
  });
  assert.equal(locked.status, 429);
  assert.equal(locked.cookie, null);

  // Other addresses are not affected
  await User.create({ name: "Other", email: "other@example.com", password: "x", role: "user" });
  const other = await request(server.base, "POST", "/api/auth/login", {
    body: { email: "other@example.com", password: "wrong" },
  });
  assert.equal(other.status, 401);
});

test("a body that is not valid JSON gives 400, not a server error", async () => {
  const res = await request(server.base, "POST", "/api/auth/login", { body: "{not json" });
  assert.equal(res.status, 400);
  assert.equal(typeof res.body.message, "string");
  assert.doesNotMatch(JSON.stringify(res.body), /stack|SyntaxError|at /);
});
