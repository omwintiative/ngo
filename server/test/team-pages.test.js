// Team (Admin · Team) and text pages (Admin · Privacy Policy). Cloudinary is
// replaced by a stand-in, so no real files are uploaded or deleted.
const { test, before, after, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const { Writable } = require("node:stream");
// helpers first: it sets the stand-in settings the app needs at load time
const { startServer, createAdmin, request, signIn } = require("./helpers");
const cloudinary = require("../src/config/cloudinary");
const TeamMember = require("../src/models/TeamMember");
const Page = require("../src/models/Page");

let server;
let cookie;
const uploads = [];
const deletions = [];

before(async () => {
  cloudinary.uploader.upload_stream = (options, callback) => {
    const n = uploads.length + 1;
    uploads.push(options);
    return new Writable({
      write(chunk, encoding, done) {
        done();
      },
      final(done) {
        callback(null, { secure_url: `https://res.cloudinary.com/test/${options.folder}/${n}.jpg`, public_id: `${options.folder}/${n}` });
        done();
      },
    });
  };
  cloudinary.uploader.destroy = async (publicId) => {
    deletions.push(publicId);
    return { result: "ok" };
  };
  server = await startServer();
  await createAdmin();
  ({ cookie } = await signIn(server.base));
});
after(() => server.stop());
beforeEach(async () => {
  await TeamMember.deleteMany({});
  await Page.deleteMany({});
  uploads.length = 0;
  deletions.length = 0;
});

const api = (method, path, body) => request(server.base, method, path, { cookie, body });
const memberForm = (fields, withPhoto = false) => {
  const form = new FormData();
  for (const [key, value] of Object.entries(fields)) form.append(key, value);
  if (withPhoto) form.append("photo", new Blob([new Uint8Array([0xff, 0xd8, 0xff, 0xe0])], { type: "image/jpeg" }), "portrait.jpg");
  return form;
};

test("team: add people in order, with and without a portrait; the public list has no storage details", async () => {
  const first = await api("POST", "/api/admin/team", memberForm({ name: "Chiamaka Osuji, BScN, RN", role: "Founder", photoAlt: "Chiamaka smiling" }, true));
  assert.equal(first.status, 201);
  assert.equal(uploads[0].folder, "omwi/team");
  assert.match(first.body.member.photoUrl, /^https:\/\/res\.cloudinary\.com\//);
  const second = await api("POST", "/api/admin/team", memberForm({ name: "Full name", role: "Role" }));
  assert.equal(second.body.member.photoUrl, "");

  const list = await request(server.base, "GET", "/api/team");
  assert.deepEqual(list.body.map((m) => m.name), ["Chiamaka Osuji, BScN, RN", "Full name"]);
  assert.equal(list.body[0].photoPublicId, undefined, "storage details stay private");
});

test("team: a name is required; only the admin can change the team", async () => {
  assert.equal((await api("POST", "/api/admin/team", memberForm({ role: "Role" }))).status, 400);
  assert.equal((await api("POST", "/api/admin/team", memberForm({ name: "x".repeat(101) }))).status, 400);
  assert.equal((await request(server.base, "POST", "/api/admin/team", { body: memberForm({ name: "Signed out" }) })).status, 401);
  assert.equal(await TeamMember.countDocuments(), 0);
});

test("team: edit keeps fields left out, a new portrait replaces the old one, reorder, delete", async () => {
  const ids = [];
  for (const name of ["A", "B", "C"]) ids.push((await api("POST", "/api/admin/team", memberForm({ name, role: "Role" }, name === "A"))).body.member.id);

  const edited = await api("PATCH", `/api/admin/team/${ids[0]}`, memberForm({ role: "Founder" }, true));
  assert.equal(edited.body.member.name, "A");
  assert.equal(edited.body.member.role, "Founder");
  assert.equal(edited.body.member.photoUrl, "https://res.cloudinary.com/test/omwi/team/2.jpg");
  await new Promise((resolve) => setTimeout(resolve, 50));
  assert.deepEqual(deletions, ["omwi/team/1"], "the old portrait is removed");
  assert.equal((await api("PATCH", `/api/admin/team/${ids[0]}`, memberForm({ name: " " }))).status, 400);

  const order = await api("PUT", "/api/admin/team/order", { ids: [ids[2], ids[0], ids[1]] });
  assert.deepEqual(order.body.members.map((m) => m.name), ["C", "A", "B"]);
  assert.equal((await api("PUT", "/api/admin/team/order", { ids: [ids[0]] })).status, 400);

  assert.equal((await api("DELETE", `/api/admin/team/${ids[0]}`)).status, 200);
  assert.deepEqual(deletions, ["omwi/team/1", "omwi/team/2"]);
  assert.equal((await api("DELETE", `/api/admin/team/${ids[0]}`)).status, 404);
  assert.equal((await request(server.base, "GET", "/api/team")).body.length, 2);
});

test("pages: the privacy policy is 'not found' until saved, then public; only the admin saves it", async () => {
  assert.equal((await request(server.base, "GET", "/api/pages/privacy-policy")).status, 404);
  assert.equal((await api("GET", "/api/admin/pages/privacy-policy")).body.page, null);

  assert.equal((await api("PUT", "/api/admin/pages/privacy-policy", { body: "  " })).status, 400);
  assert.equal((await request(server.base, "PUT", "/api/admin/pages/privacy-policy", { body: { body: "Hi" } })).status, 401);
  assert.equal((await api("PUT", "/api/admin/pages/other", { body: "Hi" })).status, 404);

  const saved = await api("PUT", "/api/admin/pages/privacy-policy", { body: "## What we collect\n\nYour name." });
  assert.equal(saved.status, 200);
  const page = await request(server.base, "GET", "/api/pages/privacy-policy");
  assert.equal(page.body.body, "## What we collect\n\nYour name.");
  assert.ok(page.body.updatedAt);

  await api("PUT", "/api/admin/pages/privacy-policy", { body: "Changed." });
  assert.equal((await request(server.base, "GET", "/api/pages/privacy-policy")).body.body, "Changed.");
  assert.equal(await Page.countDocuments(), 1);
});
