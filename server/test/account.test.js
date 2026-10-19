const { test, before, after, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const bcrypt = require("bcryptjs");
const User = require("../src/models/User");
const loginLimiter = require("../src/lib/loginLimiter");
const { ADMIN, startServer, createAdmin, request, signIn } = require("./helpers");

let server;
before(async () => {
  server = await startServer();
});
after(() => server.stop());
beforeEach(async () => {
  loginLimiter.resetAll();
  await User.deleteMany({});
  await createAdmin();
});

test("account routes need a signed-in admin", async () => {
  const signedOut = await request(server.base, "PATCH", "/api/admin/account", { body: { name: "X" } });
  assert.equal(signedOut.status, 401);

  await User.create({ name: "Visitor", email: "visitor@example.com", password: await bcrypt.hash("visitor pass 123", 10) });
  const { cookie } = await signIn(server.base, { email: "visitor@example.com", password: "visitor pass 123" });
  const notAdmin = await request(server.base, "PATCH", "/api/admin/account", {
    cookie,
    body: { name: "X", currentPassword: "visitor pass 123" },
  });
  assert.equal(notAdmin.status, 403);
});

test("changing name and email needs the current password", async () => {
  const { cookie } = await signIn(server.base);
  const wrong = await request(server.base, "PATCH", "/api/admin/account", {
    cookie,
    body: { name: "New Name", currentPassword: "not it" },
  });
  assert.equal(wrong.status, 400);
  assert.equal((await User.findOne({ email: ADMIN.email })).name, ADMIN.name);
});

test("name and email change, and the new email signs in", async () => {
  const { cookie } = await signIn(server.base);
  const res = await request(server.base, "PATCH", "/api/admin/account", {
    cookie,
    body: { name: "  Chiamaka  ", email: " New@Example.com ", currentPassword: ADMIN.password },
  });
  assert.equal(res.status, 200);
  assert.equal(res.body.user.name, "Chiamaka");
  assert.equal(res.body.user.email, "new@example.com");
  await signIn(server.base, { email: "new@example.com", password: ADMIN.password });
});

test("invalid or taken email addresses are refused", async () => {
  await User.create({ name: "Other", email: "taken@example.com", password: "x" });
  const { cookie } = await signIn(server.base);
  const invalid = await request(server.base, "PATCH", "/api/admin/account", {
    cookie,
    body: { email: "not-an-email", currentPassword: ADMIN.password },
  });
  const taken = await request(server.base, "PATCH", "/api/admin/account", {
    cookie,
    body: { email: "taken@example.com", currentPassword: ADMIN.password },
  });
  assert.equal(invalid.status, 400);
  assert.equal(taken.status, 409);
});

test("new passwords must be 12 to 72 characters", async () => {
  const { cookie } = await signIn(server.base);
  for (const newPassword of ["short", "x".repeat(73), 123456789012345]) {
    const res = await request(server.base, "PUT", "/api/admin/account/password", {
      cookie,
      body: { currentPassword: ADMIN.password, newPassword },
    });
    assert.equal(res.status, 400, `accepted ${String(newPassword).slice(0, 10)}`);
  }
});

test("changing the password signs out other sessions but keeps this one", async () => {
  const laptop = await signIn(server.base);
  const phone = await signIn(server.base);
  const newPassword = "a much longer new password";

  const wrong = await request(server.base, "PUT", "/api/admin/account/password", {
    cookie: laptop.cookie,
    body: { currentPassword: "not it", newPassword },
  });
  assert.equal(wrong.status, 400);

  const res = await request(server.base, "PUT", "/api/admin/account/password", {
    cookie: laptop.cookie,
    body: { currentPassword: ADMIN.password, newPassword },
  });
  assert.equal(res.status, 200);
  assert.ok(res.cookie, "no new cookie for this session");

  assert.equal((await request(server.base, "GET", "/api/auth/me", { cookie: phone.cookie })).status, 401);
  assert.equal((await request(server.base, "GET", "/api/auth/me", { token: phone.body.token })).status, 401);
  assert.equal((await request(server.base, "GET", "/api/auth/me", { cookie: res.cookie })).status, 200);

  const oldPassword = await request(server.base, "POST", "/api/auth/login", {
    body: { email: ADMIN.email, password: ADMIN.password },
  });
  assert.equal(oldPassword.status, 401);
  await signIn(server.base, { email: ADMIN.email, password: newPassword });
});
