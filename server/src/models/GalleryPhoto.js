// A photo on the Gallery page and the Home photo strip (Figma Admin ·
// Gallery). Stored on Cloudinary; `publicId` lets us delete the file too.
// Figma note: only photos OMWI may use, and recognisable people must have
// agreed; every photo needs a short description for screen readers.
const mongoose = require("mongoose");

// The Home photo strip holds up to 6 photos (Figma note).
const HOME_LIMIT = 6;

const galleryPhotoSchema = new mongoose.Schema(
  {
    url: { type: String, required: true },
    publicId: { type: String, required: true },
    // The uploaded file's name without its extension, e.g. "outreach-6":
    // how the admin tells photos apart.
    name: { type: String, trim: true, maxlength: 120, default: "" },
    alt: { type: String, required: true, trim: true, maxlength: 250 },
    // Shown under the photo on the Gallery page.
    caption: { type: String, trim: true, maxlength: 200, default: "" },
    onHome: { type: Boolean, default: false },
    width: { type: Number },
    height: { type: Number },
    // Lower comes first.
    order: { type: Number, default: 0 },
  },
  { timestamps: true },
);

galleryPhotoSchema.index({ order: 1, createdAt: -1 });

module.exports = mongoose.model("GalleryPhoto", galleryPhotoSchema);
module.exports.HOME_LIMIT = HOME_LIMIT;
