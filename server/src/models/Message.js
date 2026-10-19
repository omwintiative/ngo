// A message sent from the Contact page (Figma Admin · Messages). "new" until
// the admin marks it handled. Replies are written in the admin's own email
// app; the website never sends them.
const mongoose = require("mongoose");

const messageSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 120 },
    email: { type: String, required: true, trim: true, lowercase: true, maxlength: 254 },
    subject: { type: String, trim: true, maxlength: 150, default: "" },
    message: { type: String, required: true, trim: true, maxlength: 5000 },
    status: { type: String, enum: ["new", "handled"], default: "new" },
    handledAt: { type: Date },
  },
  { timestamps: true },
);

messageSchema.index({ status: 1, createdAt: -1 });

module.exports = mongoose.model("Message", messageSchema);
