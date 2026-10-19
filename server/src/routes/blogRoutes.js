const express = require("express");
const mongoose = require("mongoose");
const multer = require("multer");
const Blog = require("../models/Blog");
const auth = require("../middleware/auth");
const adminOnly = require("../middleware/admin");
const cloudinary = require("../config/cloudinary");
const { serverError } = require("../lib/http");

const router = express.Router();

// Blog images: JPEG, PNG or WebP, up to 5 MB each, at most 3.
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];
const NOT_AN_IMAGE = "NOT_AN_IMAGE";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_IMAGE_BYTES, files: 3 },
  fileFilter(req, file, callback) {
    if (IMAGE_TYPES.includes(file.mimetype)) return callback(null, true);
    return callback(new Error(NOT_AN_IMAGE));
  },
}).fields([
  { name: "image1", maxCount: 1 },
  { name: "image2", maxCount: 1 },
  { name: "image3", maxCount: 1 },
]);

// Turn upload problems into a clear 400 instead of a server error.
const uploadImages = (req, res, next) =>
  upload(req, res, (error) => {
    if (!error) return next();
    let message = "The images could not be read. Please try again.";
    if (error.code === "LIMIT_FILE_SIZE") message = "Each image must be 5 MB or smaller.";
    else if (error.message === NOT_AN_IMAGE) message = "Images must be JPEG, PNG or WebP files.";
    else if (error.code === "LIMIT_FILE_COUNT" || error.code === "LIMIT_UNEXPECTED_FILE") {
      message = "Add up to 3 images.";
    }
    return res.status(400).json({ message });
  });

// An id that is not a valid database id can only mean "not found".
const notFound = (res) => res.status(404).json({ message: "Blog not found" });

const uploadToCloudinary = async (fileBuffer, originalName) => {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder: "young-heart-ngo/blogs",
        resource_type: "image",
        use_filename: true,
        unique_filename: true,
        filename_override: originalName,
      },
      (error, result) => {
        if (error) {
          reject(error);
          return;
        }

        resolve(result.secure_url);
      },
    );

    stream.end(fileBuffer);
  });
};

const collectUploadedImageUrls = async (files) => {
  const fieldNames = ["image1", "image2", "image3"];
  const imageUrls = [];

  for (const field of fieldNames) {
    if (files[field] && files[field][0]) {
      const file = files[field][0];
      const imageUrl = await uploadToCloudinary(file.buffer, file.originalname);
      imageUrls.push(imageUrl);
    }
  }

  return imageUrls;
};

router.get("/", async (req, res) => {
  try {
    const blogs = await Blog.find()
      .sort({ createdAt: -1 })
      .populate("createdBy", "name email");
    return res.json(blogs);
  } catch (error) {
    return serverError(res, error);
  }
});

router.get("/:id", async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return notFound(res);
    const blog = await Blog.findById(req.params.id).populate(
      "createdBy",
      "name email",
    );
    if (!blog) {
      return res.status(404).json({ message: "Blog not found" });
    }

    return res.json(blog);
  } catch (error) {
    return serverError(res, error);
  }
});

router.post(
  "/",
  auth,
  adminOnly,
  uploadImages,
  async (req, res) => {
    try {
      const { title, description } = req.body;

      if (!title || !description) {
        return res
          .status(400)
          .json({ message: "Title and description are required." });
      }

      const uploadedImages = await collectUploadedImageUrls(req.files || {});

      const blog = await Blog.create({
        title,
        description,
        images: uploadedImages,
        createdBy: req.user._id,
      });

      return res.status(201).json(blog);
    } catch (error) {
      return serverError(res, error);
    }
  },
);

router.put(
  "/:id",
  auth,
  adminOnly,
  uploadImages,
  async (req, res) => {
    try {
      if (!mongoose.isValidObjectId(req.params.id)) return notFound(res);
      const { title, description } = req.body;
      const blog = await Blog.findById(req.params.id);

      if (!blog) {
        return res.status(404).json({ message: "Blog not found" });
      }

      if (title) blog.title = title;
      if (description) blog.description = description;

      const uploadedImages = await collectUploadedImageUrls(req.files || {});

      if (uploadedImages.length > 0) {
        blog.images = uploadedImages;
      }

      await blog.save();
      return res.json(blog);
    } catch (error) {
      return serverError(res, error);
    }
  },
);

router.delete("/:id", auth, adminOnly, async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return notFound(res);
    const deleted = await Blog.findByIdAndDelete(req.params.id);

    if (!deleted) {
      return res.status(404).json({ message: "Blog not found" });
    }

    return res.json({ message: "Blog deleted successfully" });
  } catch (error) {
    return serverError(res, error);
  }
});

module.exports = router;
