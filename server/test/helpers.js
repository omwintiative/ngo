// Test setup. `npm test` loads server/.env.test (never committed), which holds
// MONGODB_URI for the separate test database in MongoDB Atlas. Every run uses
// the database named "omwi-test" and empties it first, so even a wrong
// connection string could never touch the live data (which is not named that).
const assert = require("node:assert/strict");
const bcrypt = require("bcryptjs");
const mongoose = require("mongoose");

const TEST_DB = "omwi-test";

// Values the app needs at load time. Fake: the tests never reach Cloudinary
// or Paystack.
process.env.JWT_SECRET = "test-only-secret";
process.env.PAYSTACK_SECRET_KEY = "sk_test_only";
process.env.PAYSTACK_CALLBACK_URL = "https://example.org/thank-you";
process.env.CLOUDINARY_CLOUD_NAME ||= "test";
process.env.CLOUDINARY_API_KEY ||= "test";
process.env.CLOUDINARY_API_SECRET ||= "test";
delete process.env.CORS_ORIGIN;

const app = require("../src/app");
const User = require("../src/models/User");
const loginLimiter = require("../src/lib/loginLimiter");

const ADMIN = { name: "Test Admin", email: "admin@example.com", password: "correct horse battery" };

async function startServer() {
  assert.ok(process.env.MONGODB_URI, "MONGODB_URI missing: create server/.env.test (see API-PLAN.md)");
  await mongoose.connect(process.env.MONGODB_URI, { dbName: TEST_DB });
  assert.equal(mongoose.connection.name, TEST_DB);
  await mongoose.connection.dropDatabase();
  await User.init(); // unique email index
  loginLimiter.resetAll();

  const server = await new Promise((resolve) => {
    const s = app.listen(0, () => resolve(s));
  });
  const base = `http://127.0.0.1:${server.address().port}`;

  return {
    base,
    async stop() {
      await new Promise((resolve) => server.close(resolve));
      await mongoose.disconnect();
    },
  };
}

async function createAdmin(overrides = {}) {
  const data = { ...ADMIN, ...overrides };
  return User.create({
    name: data.name,
    email: data.email,
    password: await bcrypt.hash(data.password, 10),
    role: "admin",
  });
}

// fetch wrapper: JSON in, { status, body, cookie, setCookie } out.
async function request(base, method, path, { body, cookie, token, headers = {} } = {}) {
  const init = { method, headers: { ...headers } };
  if (body !== undefined) {
    if (body instanceof FormData) init.body = body;
    else {
      init.body = typeof body === "string" ? body : JSON.stringify(body);
      init.headers["Content-Type"] = "application/json";
    }
  }
  if (cookie) init.headers.Cookie = cookie;
  if (token) init.headers.Authorization = `Bearer ${token}`;
  const res = await fetch(base + path, init);
  const text = await res.text();
  let parsed = null;
  try {
    parsed = text ? JSON.parse(text) : null;
  } catch {
    parsed = text;
  }
  const setCookie = res.headers.getSetCookie();
  const session = setCookie.find((c) => c.startsWith("omwi_session="));
  return { status: res.status, body: parsed, setCookie: session || null, cookie: session ? session.split(";")[0] : null };
}

async function signIn(base, credentials = ADMIN) {
  const res = await request(base, "POST", "/api/auth/login", {
    body: { email: credentials.email, password: credentials.password },
  });
  assert.equal(res.status, 200, `sign-in failed: ${JSON.stringify(res.body)}`);
  return res;
}

// Stand-in for Paystack's API: the app's calls to api.paystack.co are answered
// by `handler(path, init)`, which returns { status, json }. Every other
// request (the tests calling the app) goes through as normal. Returns the
// list of calls made, and restore().
const realFetch = globalThis.fetch;
function fakePaystack(handler) {
  const calls = [];
  globalThis.fetch = async (url, init = {}) => {
    const href = String(url);
    if (!href.startsWith("https://api.paystack.co")) return realFetch(url, init);
    const path = href.slice("https://api.paystack.co".length);
    calls.push({ path, method: init.method || "GET", body: init.body ? JSON.parse(init.body) : undefined });
    const { status = 200, json } = await handler(path, init);
    return new Response(JSON.stringify(json), { status, headers: { "Content-Type": "application/json" } });
  };
  return { calls, restore: () => (globalThis.fetch = realFetch) };
}

module.exports = { ADMIN, startServer, createAdmin, request, signIn, fakePaystack };
