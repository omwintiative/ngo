// Text pages the admin edits (Admin · Privacy Policy). `body` is in the
// limited format of the blog editor (web/src/lib/postText.ts); the website
// escapes everything else.
const mongoose = require("mongoose");

// The pages that can be edited.
const PAGE_KEYS = ["privacy-policy"];

const pageSchema = new mongoose.Schema(
  {
    key: { type: String, required: true, enum: PAGE_KEYS, unique: true },
    body: { type: String, default: "", maxlength: 50000 },
  },
  { timestamps: true },
);

module.exports = mongoose.model("Page", pageSchema);
module.exports.PAGE_KEYS = PAGE_KEYS;
