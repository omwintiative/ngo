// FAQ lists (models/Faq.js). Public: GET /api/faqs/:key (404 until the admin
// first saves it; the website then shows its built-in questions). Admin,
// mounted at /api/admin/faqs: GET and PUT /:key { items: [{ question, answer }] }.
const express = require("express");
const auth = require("../middleware/auth");
const adminOnly = require("../middleware/admin");
const Faq = require("../models/Faq");
const { serverError } = require("../lib/http");

const toJSON = (f) => ({
  key: f.key,
  items: f.items.map(({ question, answer }) => ({ question, answer })),
  updatedAt: f.updatedAt,
});
const unknown = (res) => res.status(404).json({ message: "FAQ not found." });

// Returns { items } or { error }.
const readItems = (items) => {
  if (!Array.isArray(items) || items.length === 0) return { error: "Add at least one question." };
  if (items.length > Faq.MAX_ITEMS) return { error: `Please keep the FAQ to ${Faq.MAX_ITEMS} questions or fewer.` };
  const clean = [];
  for (const [i, item] of items.entries()) {
    const question = typeof item?.question === "string" ? item.question.trim() : "";
    const answer = typeof item?.answer === "string" ? item.answer.trim() : "";
    if (!question || !answer) return { error: `Question ${i + 1} needs both a question and an answer.` };
    if (question.length > Faq.QUESTION_MAX) {
      return { error: `Please shorten question ${i + 1} to ${Faq.QUESTION_MAX} characters or fewer.` };
    }
    if (answer.length > Faq.ANSWER_MAX) {
      return { error: `Please shorten answer ${i + 1} to ${Faq.ANSWER_MAX} characters or fewer.` };
    }
    clean.push({ question, answer });
  }
  return { items: clean };
};

const publicRouter = express.Router();
publicRouter.get("/:key", async (req, res) => {
  try {
    if (!Faq.FAQ_KEYS.includes(req.params.key)) return unknown(res);
    const faq = await Faq.findOne({ key: req.params.key });
    if (!faq) return unknown(res);
    return res.json(toJSON(faq));
  } catch (error) {
    return serverError(res, error);
  }
});

const adminRouter = express.Router();
adminRouter.use(auth, adminOnly);

adminRouter.get("/:key", async (req, res) => {
  try {
    if (!Faq.FAQ_KEYS.includes(req.params.key)) return unknown(res);
    const faq = await Faq.findOne({ key: req.params.key });
    return res.json({ faq: faq ? toJSON(faq) : null });
  } catch (error) {
    return serverError(res, error);
  }
});

adminRouter.put("/:key", async (req, res) => {
  try {
    if (!Faq.FAQ_KEYS.includes(req.params.key)) return unknown(res);
    const { items, error } = readItems(req.body?.items);
    if (error) return res.status(400).json({ message: error });
    const faq = await Faq.findOneAndUpdate(
      { key: req.params.key },
      { $set: { items } },
      { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true },
    );
    return res.json({ faq: toJSON(faq) });
  } catch (error) {
    return serverError(res, error);
  }
});

module.exports = { publicRouter, adminRouter };
