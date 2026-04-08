const mongoose = require("mongoose");

const manualContributionSchema = new mongoose.Schema(
  {
    contributorName: {
      type: String,
      required: true,
      trim: true,
    },
    contributorEmail: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
    },
    amount: {
      type: Number,
      required: true,
      min: 0,
    },
    transferDate: {
      type: Date,
      required: true,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  { timestamps: true },
);

module.exports = mongoose.model("ManualContribution", manualContributionSchema);
