// A person in "Meet the team" (Home and About), managed in Admin · Team.
// The portrait is stored on Cloudinary; `photoPublicId` lets us delete it.
const mongoose = require("mongoose");

const teamMemberSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 100 },
    role: { type: String, trim: true, maxlength: 100, default: "" },
    photoUrl: { type: String, default: "" },
    photoPublicId: { type: String, default: "" },
    // Describes the portrait for screen readers.
    photoAlt: { type: String, trim: true, maxlength: 250, default: "" },
    // Lower comes first.
    order: { type: Number, default: 0 },
  },
  { timestamps: true },
);

teamMemberSchema.index({ order: 1, createdAt: 1 });

module.exports = mongoose.model("TeamMember", teamMemberSchema);
