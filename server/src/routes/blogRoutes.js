// Blog posts. Public routes show published posts only (not drafts, and not
// posts scheduled for later) and never the author's email. Writing, editing
// and deleting need the admin; the admin's list (with drafts) and a single
// post for editing or preview are under /api/admin/blogs.
const express = require("express");
const mongoose = require("mongoose");
const Blog = require("../models/Blog");
const auth = require("../middleware/auth");
const adminOnly = require("../middleware/admin");
const { serverError } = require("../lib/http");
const { imageUpload, uploadToCloudinary } = require("../lib/uploads");

const router = express.Router();

const IMAGE_FIELDS = ["image1", "image2", "image3"];
const uploadImages = imageUpload(IMAGE_FIELDS.map((name) => ({ name, maxCount: 1 })));
const BLOG_FOLDER = "young-heart-ngo/blogs";

const notFound = (res) => res.status(404).json({ message: "Blog not found" });
const PHOTO_FAILED = "The photo could not be uploaded, so the post was not saved. Please try again.";

const collectUploadedImageUrls = async (files) => {
  const imageUrls = [];
  for (const field of IMAGE_FIELDS) {
    const file = files[field]?.[0];
    if (file) imageUrls.push((await uploadToCloudinary(file.buffer, file.originalname, BLOG_FOLDER)).secure_url);
  }
  return imageUrls;
};

// "What ọmụgwọ means" -> "what-omugwo-means"
const slugify = (text) =>
  String(text)
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80)
    .replace(/-+$/g, "") || "post";

// Add -2, -3… when another post already uses the address.
const uniqueSlug = async (base, ownId) => {
  for (let n = 1; n < 1000; n += 1) {
    const candidate = n === 1 ? base : `${base.slice(0, 76)}-${n}`;
    if (!(await Blog.exists({ slug: candidate, _id: { $ne: ownId } }))) return candidate;
  }
  throw new Error("No free web address");
};

const text = (value) => (typeof value === "string" ? value.trim() : "");

// Check the fields sent (form values arrive as text). Only fields present
// are returned. Returns { values } or { error }.
const readPostFields = (body) => {
  const values = {};
  if (body.category !== undefined) {
    if (body.category !== "" && !Blog.CATEGORIES.includes(body.category)) {
      return { error: "Choose one of the blog categories." };
    }
    values.category = body.category;
  }
  if (body.status !== undefined) {
    if (!["draft", "published"].includes(body.status)) return { error: "Save the post as a draft or publish it." };
    values.status = body.status;
  }
  if (body.imageAlt !== undefined) {
    const alt = text(body.imageAlt);
    if (alt.length > 250) return { error: "Please shorten the photo description." };
    values.imageAlt = alt;
  }
  if (body.title !== undefined) {
    const title = text(body.title);
    if (title.length > 200) return { error: "Give the post a title of up to 200 characters." };
    values.title = title;
  }
  if (body.description !== undefined) values.description = text(body.description);
  if (body.summary !== undefined) {
    const summary = text(body.summary);
    if (summary.length > 300) return { error: "Please shorten the summary to 300 characters or fewer." };
    values.summary = summary;
  }
  if (body.slug !== undefined) {
    const slug = text(body.slug).toLowerCase().replace(/^\/?blog\//, "");
    if (slug && (!Blog.SLUG_PATTERN.test(slug) || slug.length > 80)) {
      return { error: "Use only lower-case letters, numbers and hyphens in the web address." };
    }
    values.slug = slug;
  }
  if (body.publishAt !== undefined) {
    if (!text(body.publishAt)) values.publishAt = null;
    else {
      const date = new Date(body.publishAt);
      if (Number.isNaN(date.getTime())) return { error: "Choose a valid publish date." };
      values.publishAt = date;
    }
  }
  return { values };
};

// Apply checked values to a post and save it. Answers the request itself
// when something is not allowed; returns the saved post otherwise.
const applyAndSave = async (blog, values, res) => {
  const wantedSlug = values.slug;
  delete values.slug;

  if (blog.publishedAt && wantedSlug && wantedSlug !== blog.slug) {
    res.status(400).json({ message: "The web address cannot change after the post is published." });
    return null;
  }
  blog.set(values);

  if (blog.status === "published" && (!blog.title || !blog.description)) {
    res.status(400).json({ message: "Add a title and the post's text before publishing." });
    return null;
  }

  if (!blog.publishedAt) {
    if (wantedSlug) {
      if (await Blog.exists({ slug: wantedSlug, _id: { $ne: blog._id } })) {
        res.status(409).json({ message: "Another post already uses that web address." });
        return null;
      }
      blog.slug = wantedSlug;
    } else if (blog.title && (wantedSlug === "" || !blog.slug)) {
      blog.slug = await uniqueSlug(slugify(blog.title), blog._id);
    }
  }

  if (blog.status === "published" && !blog.publishedAt) blog.publishedAt = blog.publishAt || new Date();
  await blog.save();
  return blog;
};

// Newest first by the date readers see.
const shownDate = (b) => b.publishAt || b.publishedAt || b.createdAt;

router.get("/", async (req, res) => {
  try {
    const blogs = await Blog.find(Blog.publishedNow()).populate("createdBy", "name");
    blogs.sort((a, b) => shownDate(b) - shownDate(a));
    return res.json(blogs);
  } catch (error) {
    return serverError(res, error);
  }
});

// By id (older links) or by web address.
router.get("/:idOrSlug", async (req, res) => {
  try {
    const key = req.params.idOrSlug;
    const match = mongoose.isValidObjectId(key) ? { _id: key } : Blog.SLUG_PATTERN.test(key) ? { slug: key } : null;
    if (!match) return notFound(res);
    const blog = await Blog.findOne({ ...match, ...Blog.publishedNow() }).populate("createdBy", "name");
    if (!blog) return notFound(res);
    return res.json(blog);
  } catch (error) {
    return serverError(res, error);
  }
});

router.post("/", auth, adminOnly, uploadImages, async (req, res) => {
  try {
    const fields = readPostFields(req.body);
    if (fields.error) return res.status(400).json({ message: fields.error });
    // The old site's form sends no status: its posts go live, as before.
    const blog = new Blog({ createdBy: req.user._id, status: "published" });
    let images;
    try {
      images = await collectUploadedImageUrls(req.files || {});
    } catch (error) {
      return serverError(res, error, PHOTO_FAILED);
    }
    if (images.length) blog.images = images;
    const saved = await applyAndSave(blog, fields.values, res);
    if (!saved) return undefined;
    return res.status(201).json(saved);
  } catch (error) {
    return serverError(res, error);
  }
});

router.put("/:id", auth, adminOnly, uploadImages, async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return notFound(res);
    const blog = await Blog.findById(req.params.id);
    if (!blog) return notFound(res);

    // The old site sends empty title or text to mean "leave as it is"; the
    // new admin always sends a status and every field.
    const body = { ...req.body };
    if (body.status === undefined) {
      if (body.title === "") delete body.title;
      if (body.description === "") delete body.description;
    }
    const fields = readPostFields(body);
    if (fields.error) return res.status(400).json({ message: fields.error });

    let images;
    try {
      images = await collectUploadedImageUrls(req.files || {});
    } catch (error) {
      return serverError(res, error, PHOTO_FAILED);
    }
    if (images.length > 0) blog.images = images;
    const saved = await applyAndSave(blog, fields.values, res);
    if (!saved) return undefined;
    return res.json(saved);
  } catch (error) {
    return serverError(res, error);
  }
});

router.delete("/:id", auth, adminOnly, async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return notFound(res);
    const deleted = await Blog.findByIdAndDelete(req.params.id);
    if (!deleted) return notFound(res);
    return res.json({ message: "Blog deleted successfully" });
  } catch (error) {
    return serverError(res, error);
  }
});

module.exports = router;
module.exports.slugify = slugify;
