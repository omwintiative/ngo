// Gallery (API-PLAN.md, Part D).
// Public: GET /api/gallery for the Gallery page and the Home photo strip.
// Admin (Figma Admin · Gallery), mounted at /api/admin/gallery: upload one
// photo with its description, edit the description, reorder, delete (which
// also removes the file from Cloudinary).
const express = require("express");
const mongoose = require("mongoose");
const auth = require("../middleware/auth");
const adminOnly = require("../middleware/admin");
const GalleryPhoto = require("../models/GalleryPhoto");
const { serverError } = require("../lib/http");
const { imageUpload, uploadToCloudinary, deleteFromCloudinary } = require("../lib/uploads");

const GALLERY_FOLDER = "omwi/gallery";

const toJSON = (p) => ({ id: p._id, url: p.url, alt: p.alt, width: p.width || null, height: p.height || null });
const sorted = () => GalleryPhoto.find().sort({ order: 1, createdAt: -1 });
const notFound = (res) => res.status(404).json({ message: "Photo not found." });

const readAlt = (value) => {
  const alt = typeof value === "string" ? value.trim() : "";
  if (!alt) return { error: "Describe the photo in a few words, for people using screen readers." };
  if (alt.length > 250) return { error: "Please shorten the description to 250 characters or fewer." };
  return { alt };
};

const publicRouter = express.Router();
publicRouter.get("/", async (req, res) => {
  try {
    return res.json((await sorted()).map(toJSON));
  } catch (error) {
    return serverError(res, error);
  }
});

const adminRouter = express.Router();
adminRouter.use(auth, adminOnly);

adminRouter.get("/", async (req, res) => {
  try {
    return res.json({ photos: (await sorted()).map(toJSON) });
  } catch (error) {
    return serverError(res, error);
  }
});

// multipart/form-data: `photo` (the image) and `alt` (its description).
adminRouter.post("/", imageUpload([{ name: "photo", maxCount: 1 }]), async (req, res) => {
  try {
    const file = req.files?.photo?.[0];
    if (!file) return res.status(400).json({ message: "Choose a photo to upload." });
    const { alt, error } = readAlt(req.body.alt);
    if (error) return res.status(400).json({ message: error });

    const uploaded = await uploadToCloudinary(file.buffer, file.originalname, GALLERY_FOLDER);
    // New photos go first.
    const first = await GalleryPhoto.findOne().sort({ order: 1 }).lean();
    const photo = await GalleryPhoto.create({
      url: uploaded.secure_url,
      publicId: uploaded.public_id,
      width: uploaded.width,
      height: uploaded.height,
      alt,
      order: first ? first.order - 1 : 0,
    });
    return res.status(201).json({ photo: toJSON(photo) });
  } catch (error) {
    return serverError(res, error, "The photo could not be uploaded. Please try again.");
  }
});

// The full new order: { ids: [...] }, every photo once.
adminRouter.put("/order", async (req, res) => {
  try {
    const ids = req.body?.ids;
    const all = await GalleryPhoto.find({}, { _id: 1 }).lean();
    const known = new Set(all.map((p) => String(p._id)));
    if (
      !Array.isArray(ids) ||
      ids.length !== known.size ||
      new Set(ids.map(String)).size !== ids.length ||
      !ids.every((id) => known.has(String(id)))
    ) {
      return res.status(400).json({ message: "Send every photo once, in the new order." });
    }
    await GalleryPhoto.bulkWrite(
      ids.map((id, index) => ({ updateOne: { filter: { _id: id }, update: { $set: { order: index } } } })),
    );
    return res.json({ photos: (await sorted()).map(toJSON) });
  } catch (error) {
    return serverError(res, error);
  }
});

adminRouter.patch("/:id", async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return notFound(res);
    const { alt, error } = readAlt(req.body?.alt);
    if (error) return res.status(400).json({ message: error });
    const photo = await GalleryPhoto.findByIdAndUpdate(req.params.id, { alt }, { new: true });
    if (!photo) return notFound(res);
    return res.json({ photo: toJSON(photo) });
  } catch (error) {
    return serverError(res, error);
  }
});

adminRouter.delete("/:id", async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return notFound(res);
    const photo = await GalleryPhoto.findById(req.params.id);
    if (!photo) return notFound(res);
    await photo.deleteOne();
    // The photo is off the site either way; a file left on Cloudinary is
    // only logged.
    try {
      await deleteFromCloudinary(photo.publicId);
    } catch (cloudError) {
      console.error(`Cloudinary delete failed for ${photo.publicId}:`, cloudError);
    }
    return res.json({ message: "Deleted." });
  } catch (error) {
    return serverError(res, error);
  }
});

module.exports = { publicRouter, adminRouter };
