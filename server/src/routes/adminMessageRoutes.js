// Admin · Messages and Admin · Message (Figma). Mounted at
// /api/admin/messages, admin only. Newest first; "Mark as Handled" moves a
// message out of New.
const express = require("express");
const mongoose = require("mongoose");
const auth = require("../middleware/auth");
const adminOnly = require("../middleware/admin");
const Message = require("../models/Message");
const { serverError } = require("../lib/http");
const { searchPattern } = require("../lib/search");

const router = express.Router();
router.use(auth, adminOnly);

const toAdminJSON = (m) => ({
  id: m._id,
  name: m.name,
  email: m.email,
  subject: m.subject,
  message: m.message,
  status: m.status,
  createdAt: m.createdAt,
  handledAt: m.handledAt || null,
});

const notFound = (res) => res.status(404).json({ message: "Message not found." });

router.get("/", async (req, res) => {
  try {
    const { status, q } = req.query;
    const filter = {};
    if (status === "new" || status === "handled") filter.status = status;
    const pattern = searchPattern(q);
    if (pattern) {
      filter.$or = [{ name: pattern }, { email: pattern }, { subject: pattern }];
    }
    const messages = await Message.find(filter).sort({ createdAt: -1 });
    return res.json({ messages: messages.map(toAdminJSON), total: messages.length });
  } catch (error) {
    return serverError(res, error);
  }
});

router.get("/:id", async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return notFound(res);
    const message = await Message.findById(req.params.id);
    if (!message) return notFound(res);
    return res.json({ message: toAdminJSON(message) });
  } catch (error) {
    return serverError(res, error);
  }
});

// { handled: true } marks it handled; { handled: false } moves it back to New.
router.patch("/:id", async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return notFound(res);
    if (typeof req.body?.handled !== "boolean") {
      return res.status(400).json({ message: "Say whether the message is handled." });
    }
    const message = await Message.findById(req.params.id);
    if (!message) return notFound(res);
    message.status = req.body.handled ? "handled" : "new";
    message.handledAt = req.body.handled ? new Date() : undefined;
    await message.save();
    return res.json({ message: toAdminJSON(message) });
  } catch (error) {
    return serverError(res, error);
  }
});

router.delete("/:id", async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return notFound(res);
    const deleted = await Message.findByIdAndDelete(req.params.id);
    if (!deleted) return notFound(res);
    return res.json({ message: "Deleted." });
  } catch (error) {
    return serverError(res, error);
  }
});

module.exports = router;
