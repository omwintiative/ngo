// Blog categories, managed in Admin · Blog posts. A post's category must be
// one of these (or empty). The first read fills the list with the five
// categories of the Figma design, so posts written before this list existed
// stay valid.
const mongoose = require("mongoose");

const DEFAULTS = ["Maternal Health", "Newborn Care", "Menstrual Health", "Mental Wellness", "OMWI News"];

const categorySchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 40, unique: true },
    order: { type: Number, default: 0 },
  },
  { timestamps: true },
);

// Every category, in order.
categorySchema.statics.list = async function list() {
  if (!(await this.exists({}))) {
    await this.insertMany(DEFAULTS.map((name, order) => ({ name, order }))).catch((error) => {
      // Two first reads at once: the other one filled the list.
      if (error.code !== 11000) throw error;
    });
  }
  return this.find().sort({ order: 1, createdAt: 1 });
};

module.exports = mongoose.model("Category", categorySchema);
