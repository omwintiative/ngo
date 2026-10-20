// FAQ lists (Admin · FAQ).
const { test, before, after, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
// helpers first: it sets the stand-in settings the app needs at load time
const { startServer, createAdmin, request, signIn } = require("./helpers");
const Faq = require("../src/models/Faq");

let server;
let cookie;

before(async () => {
  server = await startServer();
  await createAdmin();
  ({ cookie } = await signIn(server.base));
});
after(() => server.stop());
beforeEach(() => Faq.deleteMany({}));

const api = (method, path, body) => request(server.base, method, path, { cookie, body });

test("faqs: 'not found' until saved, then public in order, trimmed; saving again replaces the list", async () => {
  assert.equal((await request(server.base, "GET", "/api/faqs/home")).status, 404);
  assert.equal((await api("GET", "/api/admin/faqs/home")).body.faq, null);

  const saved = await api("PUT", "/api/admin/faqs/home", {
    items: [
      { question: " What is OMWI? ", answer: " A maternal welfare initiative. " },
      { question: "How do I donate?", answer: "Go to the Donate page." },
    ],
  });
  assert.equal(saved.status, 200);
  const page = await request(server.base, "GET", "/api/faqs/home");
  assert.deepEqual(page.body.items, [
    { question: "What is OMWI?", answer: "A maternal welfare initiative." },
    { question: "How do I donate?", answer: "Go to the Donate page." },
  ]);
  assert.equal((await request(server.base, "GET", "/api/faqs/contact")).status, 404, "each page has its own list");

  await api("PUT", "/api/admin/faqs/home", { items: [{ question: "Only one?", answer: "Yes." }] });
  assert.equal((await request(server.base, "GET", "/api/faqs/home")).body.items.length, 1);
  assert.equal(await Faq.countDocuments(), 1);
});

test("faqs: invalid lists are refused; unknown pages are 'not found'; only the admin saves", async () => {
  const one = (question, answer) => ({ items: [{ question, answer }] });
  assert.equal((await api("PUT", "/api/admin/faqs/home", { items: [] })).status, 400);
  assert.equal((await api("PUT", "/api/admin/faqs/home", { items: "nope" })).status, 400);
  assert.equal((await api("PUT", "/api/admin/faqs/home", one("Question", "  "))).status, 400);
  assert.equal((await api("PUT", "/api/admin/faqs/home", one("x".repeat(201), "Answer"))).status, 400);
  assert.equal((await api("PUT", "/api/admin/faqs/home", one("Question", "x".repeat(2001)))).status, 400);
  const tooMany = Array.from({ length: 31 }, () => ({ question: "Q", answer: "A" }));
  assert.equal((await api("PUT", "/api/admin/faqs/home", { items: tooMany })).status, 400);

  assert.equal((await api("PUT", "/api/admin/faqs/other", one("Q", "A"))).status, 404);
  assert.equal((await request(server.base, "GET", "/api/faqs/other")).status, 404);
  assert.equal((await request(server.base, "PUT", "/api/admin/faqs/home", { body: one("Q", "A") })).status, 401);
  assert.equal(await Faq.countDocuments(), 0);
});
