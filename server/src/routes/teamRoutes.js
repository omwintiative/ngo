// Team (Admin · Team; shown in "Meet the team" on Home and About).
// Public: GET /api/team. Admin, mounted at /api/admin/team: list, add, edit
// (name, role, portrait and its description), reorder, delete (with the
// portrait on Cloudinary). Same pattern as galleryRoutes.js.
const express = require("express");
const mongoose = require("mongoose");
const auth = require("../middleware/auth");
const adminOnly = require("../middleware/admin");
const TeamMember = require("../models/TeamMember");
const { serverError } = require("../lib/http");
const { imageUpload, uploadToCloudinary, deleteFromCloudinary } = require("../lib/uploads");

const TEAM_FOLDER = "omwi/team";
const uploadPhoto = imageUpload([{ name: "photo", maxCount: 1 }]);

const toJSON = (m) => ({ id: m._id, name: m.name, role: m.role, photoUrl: m.photoUrl, photoAlt: m.photoAlt });
const sorted = () => TeamMember.find().sort({ order: 1, createdAt: 1 });
const notFound = (res) => res.status(404).json({ message: "Team member not found." });

// Only the fields sent are returned. Returns { values } or { error }.
const readFields = (body, { requireName }) => {
  const values = {};
  const text = (v) => (typeof v === "string" ? v.trim() : "");
  if (body.name !== undefined || requireName) {
    const name = text(body.name);
    if (!name) return { error: "Add the person's name." };
    if (name.length > 100) return { error: "Please shorten the name to 100 characters or fewer." };
    values.name = name;
  }
  if (body.role !== undefined) {
    const role = text(body.role);
    if (role.length > 100) return { error: "Please shorten the role to 100 characters or fewer." };
    values.role = role;
  }
  if (body.photoAlt !== undefined) {
    const photoAlt = text(body.photoAlt);
    if (photoAlt.length > 250) return { error: "Please shorten the photo description to 250 characters or fewer." };
    values.photoAlt = photoAlt;
  }
  return { values };
};

// Uploads a new portrait when one was sent; removes the old one afterwards.
const applyPhoto = async (member, file) => {
  if (!file) return;
  const uploaded = await uploadToCloudinary(file.buffer, file.originalname, TEAM_FOLDER);
  const oldId = member.photoPublicId;
  member.photoUrl = uploaded.secure_url;
  member.photoPublicId = uploaded.public_id;
  if (oldId) {
    deleteFromCloudinary(oldId).catch((error) => console.error(`Cloudinary delete failed for ${oldId}:`, error));
  }
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
    return res.json({ members: (await sorted()).map(toJSON) });
  } catch (error) {
    return serverError(res, error);
  }
});

// multipart/form-data: name, role, photoAlt and optionally `photo`.
adminRouter.post("/", uploadPhoto, async (req, res) => {
  try {
    const { values, error } = readFields(req.body, { requireName: true });
    if (error) return res.status(400).json({ message: error });
    const last = await TeamMember.findOne().sort({ order: -1 }).lean();
    const member = new TeamMember({ ...values, order: last ? last.order + 1 : 0 });
    try {
      await applyPhoto(member, req.files?.photo?.[0]);
    } catch (uploadError) {
      return serverError(res, uploadError, "The photo could not be uploaded, so nothing was saved. Please try again.");
    }
    await member.save();
    return res.status(201).json({ member: toJSON(member) });
  } catch (error) {
    return serverError(res, error);
  }
});

// The full new order: { ids: [...] }, every person once.
adminRouter.put("/order", async (req, res) => {
  try {
    const ids = req.body?.ids;
    const all = await TeamMember.find({}, { _id: 1 }).lean();
    const known = new Set(all.map((m) => String(m._id)));
    if (
      !Array.isArray(ids) ||
      ids.length !== known.size ||
      new Set(ids.map(String)).size !== ids.length ||
      !ids.every((id) => known.has(String(id)))
    ) {
      return res.status(400).json({ message: "Send every person once, in the new order." });
    }
    await TeamMember.bulkWrite(
      ids.map((id, index) => ({ updateOne: { filter: { _id: id }, update: { $set: { order: index } } } })),
    );
    return res.json({ members: (await sorted()).map(toJSON) });
  } catch (error) {
    return serverError(res, error);
  }
});

// multipart/form-data; fields left out stay as they are.
adminRouter.patch("/:id", uploadPhoto, async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return notFound(res);
    const { values, error } = readFields(req.body || {}, { requireName: false });
    if (error) return res.status(400).json({ message: error });
    const member = await TeamMember.findById(req.params.id);
    if (!member) return notFound(res);
    member.set(values);
    try {
      await applyPhoto(member, req.files?.photo?.[0]);
    } catch (uploadError) {
      return serverError(res, uploadError, "The photo could not be uploaded, so nothing was saved. Please try again.");
    }
    await member.save();
    return res.json({ member: toJSON(member) });
  } catch (error) {
    return serverError(res, error);
  }
});

adminRouter.delete("/:id", async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return notFound(res);
    const member = await TeamMember.findById(req.params.id);
    if (!member) return notFound(res);
    await member.deleteOne();
    if (member.photoPublicId) {
      try {
        await deleteFromCloudinary(member.photoPublicId);
      } catch (cloudError) {
        console.error(`Cloudinary delete failed for ${member.photoPublicId}:`, cloudError);
      }
    }
    return res.json({ message: "Deleted." });
  } catch (error) {
    return serverError(res, error);
  }
});

module.exports = { publicRouter, adminRouter };
