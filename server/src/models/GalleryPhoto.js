// A photo on the Gallery page and the Home photo strip (Figma Admin ·
// Gallery). Stored on Cloudinary; `publicId` lets us delete the file too.
// Figma note: only photos OMWI may use, and recognisable people must have
// agreed; every photo needs a short description for screen readers.
const mongoose = require("mongoose");

const galleryPhotoSchema = new mongoose.Schema(
  {
    url: { type: String, required: true },
    publicId: { type: String, required: true },
    alt: { type: String, required: true, trim: true, maxlength: 250 },
    width: { type: Number },
    height: { type: Number },
    // Lower comes first.
    order: { type: Number, default: 0 },
  },
  { timestamps: true },
);

galleryPhotoSchema.index({ order: 1, createdAt: -1 });

module.exports = mongoose.model("GalleryPhoto", galleryPhotoSchema);
