// Text pages (models/Page.js). Public: GET /api/pages/:key (404 until the
// admin first saves it; the website then shows its built-in text). Admin,
// mounted at /api/admin/pages: GET and PUT /:key { body }.
const express = require("express");
const auth = require("../middleware/auth");
const adminOnly = require("../middleware/admin");
const Page = require("../models/Page");
const { serverError } = require("../lib/http");

const toJSON = (p) => ({ key: p.key, body: p.body, updatedAt: p.updatedAt });
const unknown = (res) => res.status(404).json({ message: "Page not found." });

const publicRouter = express.Router();
publicRouter.get("/:key", async (req, res) => {
  try {
    if (!Page.PAGE_KEYS.includes(req.params.key)) return unknown(res);
    const page = await Page.findOne({ key: req.params.key });
    if (!page) return unknown(res);
    return res.json(toJSON(page));
  } catch (error) {
    return serverError(res, error);
  }
});

const adminRouter = express.Router();
adminRouter.use(auth, adminOnly);

adminRouter.get("/:key", async (req, res) => {
  try {
    if (!Page.PAGE_KEYS.includes(req.params.key)) return unknown(res);
    const page = await Page.findOne({ key: req.params.key });
    return res.json({ page: page ? toJSON(page) : null });
  } catch (error) {
    return serverError(res, error);
  }
});

adminRouter.put("/:key", async (req, res) => {
  try {
    if (!Page.PAGE_KEYS.includes(req.params.key)) return unknown(res);
    const body = typeof req.body?.body === "string" ? req.body.body.trim() : "";
    if (!body) return res.status(400).json({ message: "Add the page's text before saving." });
    if (body.length > 50000) return res.status(400).json({ message: "The text is too long. Please shorten it." });
    const page = await Page.findOneAndUpdate(
      { key: req.params.key },
      { $set: { body } },
      { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true },
    );
    return res.json({ page: toJSON(page) });
  } catch (error) {
    return serverError(res, error);
  }
});

module.exports = { publicRouter, adminRouter };
