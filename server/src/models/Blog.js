const mongoose = require("mongoose");

// Categories match the tabs on the public Blog page (Figma Admin · Blog posts).
const CATEGORIES = ["Maternal Health", "Newborn Care", "Menstrual Health", "Mental Wellness", "OMWI News"];

// Web addresses: lower-case letters, digits and single hyphens.
const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

const blogSchema = new mongoose.Schema(
  {
    // A draft may be unfinished; publishing needs a title and text (checked
    // in the routes).
    title: {
      type: String,
      trim: true,
      maxlength: 200,
      default: "",
    },
    // The post's text, in the limited formatting the editor writes (## heading,
    // **bold**, *italic*, [link](https://…), - and 1. lists, > quote). The
    // website escapes everything else, so no HTML from here ever runs.
    description: {
      type: String,
      trim: true,
      default: "",
    },
    // Web address: /blog/<slug>. Made from the title; it can change only
    // until the post is first published (Figma Admin · Edit post).
    slug: {
      type: String,
      trim: true,
      lowercase: true,
      maxlength: 80,
      match: SLUG_PATTERN,
      unique: true,
      sparse: true,
    },
    // "Shown on the Blog page and in search results" (Figma).
    summary: {
      type: String,
      trim: true,
      maxlength: 300,
      default: "",
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
    // A published post with a later publishAt is scheduled: hidden until then.
    publishAt: { type: Date },
    // When the post first went live; after that its web address is fixed.
    publishedAt: { type: Date },
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
module.exports.SLUG_PATTERN = SLUG_PATTERN;
// Public queries: published (old posts have no status) and not scheduled
// for later.
module.exports.publishedNow = () => ({
  status: { $ne: "draft" },
  $or: [{ publishAt: null }, { publishAt: { $lte: new Date() } }],
});
