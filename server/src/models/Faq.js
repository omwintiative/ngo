// FAQ lists (Admin · FAQ), one per page with an FAQ section. Saved whole, in order.
const mongoose = require("mongoose");

const FAQ_KEYS = ["home", "contact"];
const MAX_ITEMS = 30;
const QUESTION_MAX = 200;
const ANSWER_MAX = 2000;

const faqSchema = new mongoose.Schema(
  {
    key: { type: String, required: true, enum: FAQ_KEYS, unique: true },
    items: [
      {
        _id: false,
        question: { type: String, required: true, trim: true, maxlength: QUESTION_MAX },
        answer: { type: String, required: true, trim: true, maxlength: ANSWER_MAX },
      },
    ],
  },
  { timestamps: true },
);

module.exports = mongoose.model("Faq", faqSchema);
Object.assign(module.exports, { FAQ_KEYS, MAX_ITEMS, QUESTION_MAX, ANSWER_MAX });
