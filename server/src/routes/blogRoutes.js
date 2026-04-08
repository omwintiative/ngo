const express = require("express");
const multer = require("multer");
const Blog = require("../models/Blog");
const auth = require("../middleware/auth");
const adminOnly = require("../middleware/admin");
const cloudinary = require("../config/cloudinary");

const router = express.Router();

const upload = multer({ storage: multer.memoryStorage() });

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
    return res
      .status(500)
      .json({ message: "Server error", error: error.message });
  }
});

router.get("/:id", async (req, res) => {
  try {
    const blog = await Blog.findById(req.params.id).populate(
      "createdBy",
      "name email",
    );
    if (!blog) {
      return res.status(404).json({ message: "Blog not found" });
    }

    return res.json(blog);
  } catch (error) {
    return res
      .status(500)
      .json({ message: "Server error", error: error.message });
  }
});

router.post(
  "/",
  auth,
  adminOnly,
  upload.fields([
    { name: "image1", maxCount: 1 },
    { name: "image2", maxCount: 1 },
    { name: "image3", maxCount: 1 },
  ]),
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
      return res
        .status(500)
        .json({ message: "Server error", error: error.message });
    }
  },
);

router.put(
  "/:id",
  auth,
  adminOnly,
  upload.fields([
    { name: "image1", maxCount: 1 },
    { name: "image2", maxCount: 1 },
    { name: "image3", maxCount: 1 },
  ]),
  async (req, res) => {
    try {
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
      return res
        .status(500)
        .json({ message: "Server error", error: error.message });
    }
  },
);

router.delete("/:id", auth, adminOnly, async (req, res) => {
  try {
    const deleted = await Blog.findByIdAndDelete(req.params.id);

    if (!deleted) {
      return res.status(404).json({ message: "Blog not found" });
    }

    return res.json({ message: "Blog deleted successfully" });
  } catch (error) {
    return res
      .status(500)
      .json({ message: "Server error", error: error.message });
  }
});

module.exports = router;
