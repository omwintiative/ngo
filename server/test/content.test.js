// Part D: blog categories and drafts, and the gallery. Cloudinary is replaced
// by a stand-in, so no real files are uploaded or deleted.
const { test, before, after, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const { Writable } = require("node:stream");
// helpers first: it sets the stand-in settings the app needs at load time
const { startServer, createAdmin, request, signIn } = require("./helpers");
const cloudinary = require("../src/config/cloudinary");
const Blog = require("../src/models/Blog");
const Category = require("../src/models/Category");
const GalleryPhoto = require("../src/models/GalleryPhoto");

let server;
let cookie;
let admin;
const uploads = [];
const deletions = [];
let failDelete = false;
let failUpload = false;

before(async () => {
  cloudinary.uploader.upload_stream = (options, callback) => {
    const n = uploads.length + 1;
    uploads.push(options);
    return new Writable({
      write(chunk, encoding, done) {
        done();
      },
      final(done) {
        if (failUpload) {
          callback(new Error("cloud_name is disabled"));
          return done();
        }
        callback(null, {
          secure_url: `https://res.cloudinary.com/test/${options.folder}/${n}.jpg`,
          public_id: `${options.folder}/${n}`,
          width: 1200,
          height: 800,
        });
        done();
      },
    });
  };
  cloudinary.uploader.destroy = async (publicId) => {
    if (failDelete) throw new Error("Cloudinary down");
    deletions.push(publicId);
    return { result: "ok" };
  };
  server = await startServer();
  admin = await createAdmin();
  ({ cookie } = await signIn(server.base));
});
after(() => server.stop());
beforeEach(async () => {
  await Blog.deleteMany({});
  await Category.deleteMany({});
  await GalleryPhoto.deleteMany({});
  uploads.length = 0;
  deletions.length = 0;
  failDelete = false;
  failUpload = false;
});

const api = (method, path, body) =>
  request(server.base, method, path, { cookie, body });
const jpeg = () =>
  new Blob([new Uint8Array([0xff, 0xd8, 0xff, 0xe0])], { type: "image/jpeg" });
const postForm = (fields, withImage = false) => {
  const form = new FormData();
  for (const [key, value] of Object.entries(fields)) form.append(key, value);
  if (withImage) form.append("image1", jpeg(), "photo.jpg");
  return form;
};
const photoForm = (alt, withPhoto = true) => {
  const form = new FormData();
  if (alt !== undefined) form.append("alt", alt);
  if (withPhoto) form.append("photo", jpeg(), "outreach.jpg");
  return form;
};

test("blog: drafts stay out of public lists and links; old posts with no status stay public", async () => {
  const draft = await api(
    "POST",
    "/api/blogs",
    postForm({
      title: "Draft post",
      description: "Text",
      status: "draft",
      category: "Newborn Care",
    }),
  );
  assert.equal(draft.status, 201);
  const live = await api(
    "POST",
    "/api/blogs",
    postForm(
      {
        title: "Live post",
        description: "Text",
        status: "published",
        category: "OMWI News",
        imageAlt: "Mothers at an outreach",
      },
      true,
    ),
  );
  assert.equal(live.status, 201);
  assert.equal(live.body.images.length, 1);
  assert.equal(live.body.imageAlt, "Mothers at an outreach");
  // A post saved before status existed
  await Blog.collection.insertOne({
    title: "Old post",
    description: "Text",
    images: [],
    createdBy: admin._id,
    createdAt: new Date(0),
  });

  const list = await request(server.base, "GET", "/api/blogs");
  assert.deepEqual(
    list.body.map((p) => p.title),
    ["Live post", "Old post"],
  );
  assert.equal(list.body[0].category, "OMWI News");
  assert.equal(list.body[0].createdBy.name, "Test Admin");
  assert.equal(
    list.body[0].createdBy.email,
    undefined,
    "the author's email is never public",
  );

  assert.equal(
    (await request(server.base, "GET", `/api/blogs/${draft.body._id}`)).status,
    404,
  );
  assert.equal(
    (await request(server.base, "GET", `/api/blogs/${live.body._id}`)).status,
    200,
  );

  const adminList = await api("GET", "/api/admin/blogs");
  assert.equal(adminList.body.total, 3);
  assert.deepEqual(
    (await api("GET", "/api/admin/blogs?status=draft")).body.posts.map(
      (p) => p.title,
    ),
    ["Draft post"],
  );
  assert.deepEqual(
    (await api("GET", "/api/admin/blogs?status=published")).body.posts.map(
      (p) => p.title,
    ),
    ["Live post", "Old post"],
  );
  assert.deepEqual(
    (
      await api("GET", "/api/admin/blogs?category=Newborn%20Care")
    ).body.posts.map((p) => p.title),
    ["Draft post"],
  );
  assert.deepEqual(
    (await api("GET", "/api/admin/blogs?q=live")).body.posts.map(
      (p) => p.title,
    ),
    ["Live post"],
  );
  assert.equal(
    (await request(server.base, "GET", "/api/admin/blogs")).status,
    401,
  );

  const summary = await api("GET", "/api/admin/summary");
  assert.deepEqual(summary.body.posts, { published: 2, drafts: 1 });
});

test("blog: publishing a draft, and the old site's form still works", async () => {
  const draft = await api(
    "POST",
    "/api/blogs",
    postForm({ title: "Soon", description: "Text", status: "draft" }),
  );
  const publish = await api(
    "PUT",
    `/api/blogs/${draft.body._id}`,
    postForm({ status: "published" }),
  );
  assert.equal(publish.status, 200);
  assert.equal(publish.body.title, "Soon", "fields left out stay as they were");
  assert.equal(
    (await request(server.base, "GET", `/api/blogs/${draft.body._id}`)).status,
    200,
  );

  // Old site: title and description only, and empty fields mean "no change"
  const old = await api(
    "POST",
    "/api/blogs",
    postForm({ title: "Old form", description: "Text" }),
  );
  assert.equal(old.body.status, "published");
  const edited = await api(
    "PUT",
    `/api/blogs/${old.body._id}`,
    postForm({ title: "", description: "New text" }),
  );
  assert.equal(edited.body.title, "Old form");
  assert.equal(edited.body.description, "New text");
});

test("blog: unknown categories, statuses and empty titles are refused", async () => {
  for (const fields of [
    { title: "T", description: "D", category: "Sports" },
    { title: "T", description: "D", status: "secret" },
    { title: "   ", description: "D" },
    { title: "T", description: "D", imageAlt: "x".repeat(251) },
  ]) {
    assert.equal(
      (await api("POST", "/api/blogs", postForm(fields))).status,
      400,
      JSON.stringify(fields),
    );
  }
  assert.equal(await Blog.countDocuments(), 0);
});

test("blog: web addresses are made from the title, unique, and fixed once published", async () => {
  const first = await api(
    "POST",
    "/api/blogs",
    postForm({
      title: "What Ọmụgwọ means!",
      description: "Text",
      status: "published",
    }),
  );
  assert.equal(first.body.slug, "what-omugwo-means");
  const second = await api(
    "POST",
    "/api/blogs",
    postForm({
      title: "What ọmụgwọ means",
      description: "Text",
      status: "draft",
    }),
  );
  assert.equal(second.body.slug, "what-omugwo-means-2");

  // Found by web address or by id; a draft's address is not public
  assert.equal(
    (await request(server.base, "GET", "/api/blogs/what-omugwo-means")).body
      .title,
    "What Ọmụgwọ means!",
  );
  assert.equal(
    (await request(server.base, "GET", "/api/blogs/what-omugwo-means-2"))
      .status,
    404,
  );
  assert.equal(
    (await request(server.base, "GET", "/api/blogs/Not%20An%20Address")).status,
    404,
  );

  // A draft's address can be chosen, but not one already in use or badly formed
  assert.equal(
    (
      await api(
        "PUT",
        `/api/blogs/${second.body._id}`,
        postForm({ status: "draft", slug: "what-omugwo-means" }),
      )
    ).status,
    409,
  );
  assert.equal(
    (
      await api(
        "PUT",
        `/api/blogs/${second.body._id}`,
        postForm({ status: "draft", slug: "Bad Address" }),
      )
    ).status,
    400,
  );
  const renamed = await api(
    "PUT",
    `/api/blogs/${second.body._id}`,
    postForm({ status: "draft", slug: "/blog/caring-after-birth" }),
  );
  assert.equal(renamed.body.slug, "caring-after-birth");

  // Published: the address stays even when the title changes
  const locked = await api(
    "PUT",
    `/api/blogs/${first.body._id}`,
    postForm({
      status: "published",
      title: "A new title",
      slug: "a-new-title",
    }),
  );
  assert.equal(locked.status, 400);
  const retitled = await api(
    "PUT",
    `/api/blogs/${first.body._id}`,
    postForm({
      status: "published",
      title: "A new title",
      slug: "what-omugwo-means",
    }),
  );
  assert.equal(retitled.status, 200);
  assert.equal(retitled.body.slug, "what-omugwo-means");
  assert.ok(retitled.body.publishedAt);
});

test("blog: drafts may be unfinished; publishing needs a title and text", async () => {
  const empty = await api("POST", "/api/blogs", postForm({ status: "draft" }));
  assert.equal(empty.status, 201);
  assert.equal(empty.body.slug, undefined, "no address until there is a title");
  const titled = await api(
    "PUT",
    `/api/blogs/${empty.body._id}`,
    postForm({ status: "draft", title: "Half written", description: "" }),
  );
  assert.equal(titled.body.slug, "half-written");
  const publish = await api(
    "PUT",
    `/api/blogs/${empty.body._id}`,
    postForm({ status: "published", title: "Half written", description: "" }),
  );
  assert.equal(publish.status, 400);
  assert.equal(
    (
      await api(
        "PUT",
        `/api/blogs/${empty.body._id}`,
        postForm({ status: "draft", summary: "x".repeat(301) }),
      )
    ).status,
    400,
  );
  assert.equal(
    (
      await api(
        "PUT",
        `/api/blogs/${empty.body._id}`,
        postForm({ status: "draft", publishAt: "not a date" }),
      )
    ).status,
    400,
  );

  // The admin can open any post, drafts included; the public cannot
  const opened = await api("GET", `/api/admin/blogs/${empty.body._id}`);
  assert.equal(opened.body.post.title, "Half written");
  assert.equal(
    (await api("GET", "/api/admin/blogs/000000000000000000000000")).status,
    404,
  );
  assert.equal(
    (await request(server.base, "GET", `/api/admin/blogs/${empty.body._id}`))
      .status,
    401,
  );
});

test("blog: when the photo cannot be uploaded, the post is not saved and the admin is told why", async () => {
  failUpload = true;
  const res = await api(
    "POST",
    "/api/blogs",
    postForm(
      { title: "With a photo", description: "Text", status: "draft" },
      true,
    ),
  );
  assert.equal(res.status, 500);
  assert.match(res.body.message, /photo could not be uploaded/);
  assert.equal(await Blog.countDocuments(), 0);
});

test("blog: a post scheduled for later stays hidden until its date", async () => {
  const later = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
  const scheduled = await api(
    "POST",
    "/api/blogs",
    postForm({
      title: "Tomorrow",
      description: "Text",
      status: "published",
      publishAt: later,
      summary: "Short summary",
    }),
  );
  assert.equal(scheduled.status, 201);
  assert.equal(scheduled.body.summary, "Short summary");
  assert.equal(
    (await request(server.base, "GET", "/api/blogs")).body.length,
    0,
  );
  assert.equal(
    (await request(server.base, "GET", "/api/blogs/tomorrow")).status,
    404,
  );

  // Publishing needs a date: cleared is refused, an earlier date goes live
  assert.equal(
    (
      await api(
        "PUT",
        `/api/blogs/${scheduled.body._id}`,
        postForm({ status: "published", publishAt: "" }),
      )
    ).status,
    400,
  );
  const earlier = new Date(Date.now() - 60 * 1000).toISOString();
  const now = await api(
    "PUT",
    `/api/blogs/${scheduled.body._id}`,
    postForm({ status: "published", publishAt: earlier }),
  );
  assert.equal(now.status, 200);
  assert.equal(
    (await request(server.base, "GET", "/api/blogs/tomorrow")).status,
    200,
  );
  // A draft may leave the date empty
  assert.equal(
    (
      await api(
        "PUT",
        `/api/blogs/${scheduled.body._id}`,
        postForm({ status: "draft", publishAt: "" }),
      )
    ).status,
    200,
  );
});

test("categories: start with the design's five; add, rename (posts follow), remove only when unused", async () => {
  const start = await request(server.base, "GET", "/api/categories");
  assert.deepEqual(
    start.body.map((c) => c.name),
    [
      "Maternal Health",
      "Newborn Care",
      "Menstrual Health",
      "Mental Wellness",
      "OMWI News",
    ],
  );

  const added = await api("POST", "/api/admin/categories", {
    name: "  Community   Stories ",
  });
  assert.equal(added.status, 201);
  assert.equal(added.body.category.name, "Community Stories");
  assert.equal(
    (await api("POST", "/api/admin/categories", { name: "community stories" }))
      .status,
    409,
  );
  assert.equal(
    (await api("POST", "/api/admin/categories", { name: " " })).status,
    400,
  );
  assert.equal(
    (
      await request(server.base, "POST", "/api/admin/categories", {
        body: { name: "Signed out" },
      })
    ).status,
    401,
  );

  // Posts may use the new category; unknown ones are refused
  const post = await api(
    "POST",
    "/api/blogs",
    postForm({
      title: "Story",
      description: "Text",
      status: "published",
      category: "Community Stories",
    }),
  );
  assert.equal(post.body.category, "Community Stories");
  assert.equal(
    (
      await api(
        "POST",
        "/api/blogs",
        postForm({ title: "X", description: "Y", category: "Sports" }),
      )
    ).status,
    400,
  );

  // Renaming moves its posts along
  const renamed = await api(
    "PATCH",
    `/api/admin/categories/${added.body.category.id}`,
    { name: "Stories" },
  );
  assert.equal(renamed.body.category.name, "Stories");
  assert.equal((await Blog.findById(post.body._id)).category, "Stories");
  assert.equal(
    (
      await api("PATCH", `/api/admin/categories/${added.body.category.id}`, {
        name: "OMWI News",
      })
    ).status,
    409,
  );

  // Removing is refused while a post uses it
  const blocked = await api(
    "DELETE",
    `/api/admin/categories/${added.body.category.id}`,
  );
  assert.equal(blocked.status, 409);
  assert.match(blocked.body.message, /1 post uses this category/);
  await api(
    "PUT",
    `/api/blogs/${post.body._id}`,
    postForm({
      status: "published",
      category: "",
      publishAt: new Date().toISOString(),
    }),
  );
  assert.equal(
    (await api("DELETE", `/api/admin/categories/${added.body.category.id}`))
      .status,
    200,
  );
  assert.equal(
    (await request(server.base, "GET", "/api/categories")).body.length,
    5,
  );
});

test("blog: an optional author name is saved and shown publicly", async () => {
  const post = await api(
    "POST",
    "/api/blogs",
    postForm({
      title: "By a guest",
      description: "Text",
      status: "published",
      authorName: "  Ngozi E.  ",
    }),
  );
  assert.equal(post.body.authorName, "Ngozi E.");
  assert.equal(
    (await request(server.base, "GET", "/api/blogs/by-a-guest")).body
      .authorName,
    "Ngozi E.",
  );
  const cleared = await api(
    "PUT",
    `/api/blogs/${post.body._id}`,
    postForm({
      status: "published",
      authorName: "",
      publishAt: new Date().toISOString(),
    }),
  );
  assert.equal(cleared.body.authorName, "");
  assert.equal(
    (
      await api(
        "POST",
        "/api/blogs",
        postForm({ title: "T", description: "D", authorName: "x".repeat(101) }),
      )
    ).status,
    400,
  );
});

test("gallery: upload with a description, newest first, public list", async () => {
  const first = await api(
    "POST",
    "/api/admin/gallery",
    photoForm("Mothers at an outreach"),
  );
  assert.equal(first.status, 201);
  const second = await api(
    "POST",
    "/api/admin/gallery",
    photoForm("A volunteer with a baby"),
  );
  assert.equal(second.status, 201);
  assert.equal(uploads[0].folder, "omwi/gallery");

  const list = await request(server.base, "GET", "/api/gallery");
  assert.equal(list.status, 200);
  assert.deepEqual(
    list.body.map((p) => p.alt),
    ["A volunteer with a baby", "Mothers at an outreach"],
  );
  assert.match(list.body[0].url, /^https:\/\/res\.cloudinary\.com\//);
  assert.equal(list.body[0].width, 1200);
  assert.equal(
    list.body[0].publicId,
    undefined,
    "storage details stay private",
  );
});

test("gallery: a description and an image file are required; only the admin can upload", async () => {
  assert.equal(
    (await api("POST", "/api/admin/gallery", photoForm(""))).status,
    400,
  );
  assert.equal(
    (await api("POST", "/api/admin/gallery", photoForm("No file", false)))
      .status,
    400,
  );
  const text = new FormData();
  text.append("alt", "A text file");
  text.append(
    "photo",
    new Blob(["hello"], { type: "text/plain" }),
    "notes.txt",
  );
  assert.equal((await api("POST", "/api/admin/gallery", text)).status, 400);
  const two = photoForm("Two files");
  two.append("photo", jpeg(), "second.jpg");
  assert.equal((await api("POST", "/api/admin/gallery", two)).status, 400);
  assert.equal(
    (
      await request(server.base, "POST", "/api/admin/gallery", {
        body: photoForm("Signed out"),
      })
    ).status,
    401,
  );
  assert.equal(uploads.length, 0, "nothing reached Cloudinary");
  assert.equal(await GalleryPhoto.countDocuments(), 0);
});

test("gallery: edit the description, reorder, delete (with the file)", async () => {
  const ids = [];
  for (const alt of ["A", "B", "C"])
    ids.push(
      (await api("POST", "/api/admin/gallery", photoForm(alt))).body.photo.id,
    );

  const edit = await api("PATCH", `/api/admin/gallery/${ids[0]}`, {
    alt: "A, described better",
  });
  assert.equal(edit.body.photo.alt, "A, described better");
  assert.equal(
    (await api("PATCH", `/api/admin/gallery/${ids[0]}`, { alt: "" })).status,
    400,
  );

  const order = await api("PUT", "/api/admin/gallery/order", {
    ids: [ids[0], ids[2], ids[1]],
  });
  assert.equal(order.status, 200);
  assert.deepEqual(
    order.body.photos.map((p) => p.id),
    [ids[0], ids[2], ids[1]],
  );
  for (const bad of [
    [ids[0], ids[1]],
    [ids[0], ids[0], ids[1]],
    [ids[0], ids[1], "nope"],
  ]) {
    assert.equal(
      (await api("PUT", "/api/admin/gallery/order", { ids: bad })).status,
      400,
    );
  }

  const del = await api("DELETE", `/api/admin/gallery/${ids[1]}`);
  assert.equal(del.status, 200);
  assert.equal(deletions.length, 1);
  assert.equal(
    (await request(server.base, "GET", "/api/gallery")).body.length,
    2,
  );

  // If Cloudinary is down the photo still leaves the site
  failDelete = true;
  assert.equal(
    (await api("DELETE", `/api/admin/gallery/${ids[2]}`)).status,
    200,
  );
  assert.equal(await GalleryPhoto.countDocuments(), 1);
  assert.equal(
    (await api("DELETE", `/api/admin/gallery/${ids[2]}`)).status,
    404,
  );
});

test("local uploads (LOCAL_UPLOADS=true): photos are kept on disk, served, and deleted with the photo", async () => {
  process.env.LOCAL_UPLOADS = "true";
  try {
    const res = await api(
      "POST",
      "/api/admin/gallery",
      photoForm("Kept on this computer"),
    );
    assert.equal(res.status, 201);
    assert.match(res.body.photo.url, /^\/uploads\/local\/[0-9a-f]{24}\.jpg$/);
    assert.equal(uploads.length, 0, "nothing went to Cloudinary");
    const file = await fetch(`${server.base}${res.body.photo.url}`);
    assert.equal(file.status, 200);
    assert.equal(
      (await api("DELETE", `/api/admin/gallery/${res.body.photo.id}`)).status,
      200,
    );
    assert.equal(
      (await fetch(`${server.base}${res.body.photo.url}`)).status,
      404,
      "the file is gone too",
    );
  } finally {
    delete process.env.LOCAL_UPLOADS;
  }
});

test("gallery: name from the file, caption, and a Home strip of up to 6", async () => {
  const form = photoForm("Mothers at an outreach");
  form.append("caption", "Kubwa outreach");
  form.append("onHome", "true");
  const first = await api("POST", "/api/admin/gallery", form);
  assert.equal(first.status, 201);
  assert.equal(
    first.body.photo.name,
    "outreach",
    "the file name without its extension",
  );
  assert.equal(first.body.photo.caption, "Kubwa outreach");
  assert.equal(first.body.photo.onHome, true);

  const ids = [first.body.photo.id];
  for (let i = 0; i < 6; i += 1)
    ids.push(
      (await api("POST", "/api/admin/gallery", photoForm(`Photo ${i}`))).body
        .photo.id,
    );
  for (const id of ids.slice(1, 6))
    assert.equal(
      (await api("PATCH", `/api/admin/gallery/${id}`, { onHome: true })).status,
      200,
    );

  // A 7th is refused, by edit or by upload; turning one off makes room
  const seventh = await api("PATCH", `/api/admin/gallery/${ids[6]}`, {
    onHome: true,
  });
  assert.equal(seventh.status, 400);
  assert.match(seventh.body.message, /up to 6/);
  const upload = photoForm("One more");
  upload.append("onHome", "true");
  assert.equal((await api("POST", "/api/admin/gallery", upload)).status, 400);
  // Saving a photo already in the strip is not blocked by the limit
  assert.equal(
    (
      await api("PATCH", `/api/admin/gallery/${ids[0]}`, {
        onHome: true,
        caption: "",
      })
    ).status,
    200,
  );
  assert.equal(
    (await api("PATCH", `/api/admin/gallery/${ids[0]}`, { onHome: false }))
      .status,
    200,
  );
  assert.equal(
    (await api("PATCH", `/api/admin/gallery/${ids[6]}`, { onHome: true }))
      .status,
    200,
  );

  // Fields left out stay as they were; captions are checked
  const kept = await api("PATCH", `/api/admin/gallery/${ids[6]}`, {
    caption: "Abuja",
  });
  assert.equal(kept.body.photo.alt, "Photo 5");
  assert.equal(kept.body.photo.onHome, true);
  assert.equal(
    (
      await api("PATCH", `/api/admin/gallery/${ids[6]}`, {
        caption: "x".repeat(201),
      })
    ).status,
    400,
  );

  const list = (await request(server.base, "GET", "/api/gallery")).body;
  assert.equal(list.filter((p) => p.onHome).length, 6);
  assert.equal(list.find((p) => p.id === ids[0]).caption, "");
});
