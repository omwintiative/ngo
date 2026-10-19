const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const { startServer, createAdmin, request, signIn } = require("./helpers");

let server;
let cookie;
before(async () => {
  server = await startServer();
  await createAdmin();
  ({ cookie } = await signIn(server.base));
});
after(() => server.stop());

const postWithFile = (file, name = "photo") => {
  const form = new FormData();
  form.append("title", "Test post");
  form.append("description", "Text");
  form.append("image1", file, name);
  return request(server.base, "POST", "/api/blogs", { cookie, body: form });
};

test("an address that is not a valid id is 'not found', not a server error", async () => {
  for (const [method, path] of [
    ["GET", "/api/blogs/not-an-id"],
    ["DELETE", "/api/blogs/not-an-id"],
    ["PUT", "/api/contributors/manual-payments/not-an-id"],
    ["DELETE", "/api/contributors/manual-payments/not-an-id"],
  ]) {
    const res = await request(server.base, method, path, { cookie, body: method === "PUT" ? {} : undefined });
    assert.equal(res.status, 404, `${method} ${path}`);
    assert.equal(res.body.error, undefined);
  }
});

test("blog uploads must be images", async () => {
  const res = await postWithFile(new Blob(["just text"], { type: "text/plain" }), "notes.txt");
  assert.equal(res.status, 400);
  assert.match(res.body.message, /JPEG, PNG or WebP/);
});

test("blog images over 5 MB are refused", async () => {
  const big = new Blob([new Uint8Array(5 * 1024 * 1024 + 1)], { type: "image/jpeg" });
  const res = await postWithFile(big, "big.jpg");
  assert.equal(res.status, 400);
  assert.match(res.body.message, /5 MB/);
});

test("only the admin can post", async () => {
  const form = new FormData();
  form.append("title", "T");
  form.append("description", "D");
  const res = await request(server.base, "POST", "/api/blogs", { body: form });
  assert.equal(res.status, 401);
});
