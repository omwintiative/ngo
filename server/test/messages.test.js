const { test, before, after, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const Message = require("../src/models/Message");
const contactRoutes = require("../src/routes/contactRoutes");
const { startServer, createAdmin, request, signIn } = require("./helpers");

let server;
let cookie;
before(async () => {
  server = await startServer();
  await createAdmin();
  ({ cookie } = await signIn(server.base));
});
after(() => server.stop());
beforeEach(async () => {
  await Message.deleteMany({});
  contactRoutes.resetLimits();
});

const send = (body) => request(server.base, "POST", "/api/contact", { body });
const valid = {
  name: "Amaka Uche",
  email: "Amaka@Example.com",
  subject: "Volunteering at the next outreach",
  message: "Hello OMWI team,\n\nI would like to volunteer.",
  website: "",
};
const api = (method, path, body) => request(server.base, method, path, { cookie, body });

test("a Contact message is saved as new", async () => {
  const res = await send(valid);
  assert.equal(res.status, 201);
  const saved = await Message.findOne();
  assert.equal(saved.email, "amaka@example.com");
  assert.equal(saved.status, "new");
  assert.equal(saved.message, valid.message);
});

test("subject is optional; name, a valid email and a message are not", async () => {
  assert.equal((await send({ ...valid, subject: "" })).status, 201);
  for (const body of [
    { ...valid, name: "" },
    { ...valid, email: "not-an-email" },
    { ...valid, email: { $ne: "" } },
    { ...valid, message: "   " },
    { ...valid, message: "x".repeat(5001) },
    { ...valid, subject: "x".repeat(151) },
  ]) {
    assert.equal((await send(body)).status, 400, JSON.stringify(body).slice(0, 60));
  }
  assert.equal(await Message.countDocuments(), 1);
});

test("the spam trap: robots get a normal answer, nothing is saved", async () => {
  const res = await send({ ...valid, website: "http://spam.example" });
  assert.equal(res.status, 201);
  assert.equal(await Message.countDocuments(), 0);
});

test("at most 5 messages an hour from one email address", async () => {
  for (let i = 0; i < 5; i += 1) assert.equal((await send(valid)).status, 201);
  const sixth = await send({ ...valid, email: "AMAKA@example.com" });
  assert.equal(sixth.status, 429);
  assert.equal((await send({ ...valid, email: "someone@example.com" })).status, 201);
  assert.equal(await Message.countDocuments(), 6);
});

test("admin: list newest first, filter and search; signed-out visitors get nothing", async () => {
  assert.equal((await request(server.base, "GET", "/api/admin/messages")).status, 401);

  await Message.create({ ...valid, name: "Older", createdAt: new Date(Date.now() - 60000) });
  await Message.create({ ...valid, name: "Bisi O.", email: "bisi@example.com", subject: "Partnership with our clinic", status: "handled" });

  const all = await api("GET", "/api/admin/messages");
  assert.equal(all.status, 200);
  assert.deepEqual(all.body.messages.map((m) => m.name), ["Bisi O.", "Older"]);
  assert.deepEqual((await api("GET", "/api/admin/messages?status=new")).body.messages.map((m) => m.name), ["Older"]);
  assert.deepEqual((await api("GET", "/api/admin/messages?q=clinic")).body.messages.map((m) => m.name), ["Bisi O."]);
  assert.equal((await api("GET", "/api/admin/messages?q=(")).status, 200, "search text is literal");
});

test("admin: open, mark handled and back, delete", async () => {
  const saved = await Message.create(valid);
  const one = await api("GET", `/api/admin/messages/${saved._id}`);
  assert.equal(one.body.message.message, valid.message);

  assert.equal((await api("PATCH", `/api/admin/messages/${saved._id}`, {})).status, 400);
  const handled = await api("PATCH", `/api/admin/messages/${saved._id}`, { handled: true });
  assert.equal(handled.body.message.status, "handled");
  assert.ok(handled.body.message.handledAt);
  const reopened = await api("PATCH", `/api/admin/messages/${saved._id}`, { handled: false });
  assert.equal(reopened.body.message.status, "new");
  assert.equal(reopened.body.message.handledAt, null);

  assert.equal((await api("DELETE", `/api/admin/messages/${saved._id}`)).status, 200);
  assert.equal((await api("GET", `/api/admin/messages/${saved._id}`)).status, 404);
  assert.equal((await api("GET", "/api/admin/messages/not-an-id")).status, 404);
});

test("dashboard summary counts new messages and lists the latest three", async () => {
  for (const name of ["A", "B", "C", "D"]) await Message.create({ ...valid, name });
  await Message.create({ ...valid, name: "Done", status: "handled" });
  const res = await api("GET", "/api/admin/summary");
  assert.equal(res.status, 200);
  assert.equal(res.body.newMessages, 4);
  assert.equal(res.body.latestMessages.length, 3);
  assert.equal(res.body.latestMessages[0].name, "Done");
  assert.equal(res.body.latestMessages[0].message, undefined, "the summary does not include message text");
});
