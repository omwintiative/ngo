// Blog posts. Public routes show published posts only (drafts are admin-only)
// and never the author's email. Writing, editing and deleting need the admin;
// the admin's list including drafts is GET /api/admin/blogs.
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

// An id that is not a valid database id can only mean "not found".
const notFound = (res) => res.status(404).json({ message: "Blog not found" });

const collectUploadedImageUrls = async (files) => {
  const imageUrls = [];
  for (const field of IMAGE_FIELDS) {
    const file = files[field]?.[0];
    if (file) imageUrls.push((await uploadToCloudinary(file.buffer, file.originalname, BLOG_FOLDER)).secure_url);
  }
  return imageUrls;
};

// Check the optional fields (form values arrive as text). Returns
// { values } or { error }.
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
    const alt = typeof body.imageAlt === "string" ? body.imageAlt.trim() : "";
    if (alt.length > 250) return { error: "Please shorten the photo description." };
    values.imageAlt = alt;
  }
  if (body.title !== undefined) {
    const title = typeof body.title === "string" ? body.title.trim() : "";
    if (!title || title.length > 200) return { error: "Give the post a title of up to 200 characters." };
    values.title = title;
  }
  if (body.description !== undefined) {
    const text = typeof body.description === "string" ? body.description.trim() : "";
    if (!text) return { error: "Write the post." };
    values.description = text;
  }
  return { values };
};

router.get("/", async (req, res) => {
  try {
    const blogs = await Blog.find(Blog.PUBLISHED).sort({ createdAt: -1 }).populate("createdBy", "name");
    return res.json(blogs);
  } catch (error) {
    return serverError(res, error);
  }
});

router.get("/:id", async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return notFound(res);
    const blog = await Blog.findOne({ _id: req.params.id, ...Blog.PUBLISHED }).populate("createdBy", "name");
    if (!blog) return notFound(res);
    return res.json(blog);
  } catch (error) {
    return serverError(res, error);
  }
});

router.post("/", auth, adminOnly, uploadImages, async (req, res) => {
  try {
    if (req.body.title === undefined || req.body.description === undefined) {
      return res.status(400).json({ message: "Title and description are required." });
    }
    const fields = readPostFields(req.body);
    if (fields.error) return res.status(400).json({ message: fields.error });

    const blog = await Blog.create({
      // The old site's form sends no status: its posts go live, as before.
      ...fields.values,
      images: await collectUploadedImageUrls(req.files || {}),
      createdBy: req.user._id,
    });
    return res.status(201).json(blog);
  } catch (error) {
    return serverError(res, error);
  }
});

router.put("/:id", auth, adminOnly, uploadImages, async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return notFound(res);
    const blog = await Blog.findById(req.params.id);
    if (!blog) return notFound(res);

    // Like before, empty title or text means "leave as it is".
    const body = { ...req.body };
    if (body.title === "") delete body.title;
    if (body.description === "") delete body.description;
    const fields = readPostFields(body);
    if (fields.error) return res.status(400).json({ message: fields.error });

    blog.set(fields.values);
    const uploadedImages = await collectUploadedImageUrls(req.files || {});
    if (uploadedImages.length > 0) blog.images = uploadedImages;

    await blog.save();
    return res.json(blog);
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
