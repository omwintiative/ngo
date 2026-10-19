const mongoose = require("mongoose");

// Categories match the tabs on the public Blog page (Figma Admin · Blog posts).
const CATEGORIES = ["Maternal Health", "Newborn Care", "Menstrual Health", "Mental Wellness", "OMWI News"];

const blogSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200,
    },
    description: {
      type: String,
      required: true,
      trim: true,
    },
    images: {
      type: [String],
      validate: {
        validator: (arr) => arr.length <= 3,
        message: "A blog post can have up to 3 images",
      },
      default: [],
    },
    // Optional: posts written before categories existed have none.
    category: {
      type: String,
      enum: [...CATEGORIES, ""],
      default: "",
    },
    // Drafts are only visible in the admin. Posts saved before drafts existed
    // have no status in the database; they count as published.
    status: {
      type: String,
      enum: ["draft", "published"],
      default: "published",
    },
    // Describes the first photo for screen readers.
    imageAlt: {
      type: String,
      trim: true,
      maxlength: 250,
      default: "",
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  { timestamps: true },
);

module.exports = mongoose.model("Blog", blogSchema);
module.exports.CATEGORIES = CATEGORIES;
// Public queries: published, including old posts with no status.
module.exports.PUBLISHED = { status: { $ne: "draft" } };
