const express = require("express");
const mongoose = require("mongoose");
const auth = require("../middleware/auth");
const adminOnly = require("../middleware/admin");
const { serverError } = require("../lib/http");
const ManualContribution = require("../models/ManualContribution");
const Donation = require("../models/Donation");

// "Adaeze Okafor" -> "Adaeze O.", the format on the Figma Contributors page
// ("Shown as Adaeze O. · September 2026").
const publicName = (fullName) => {
  const words = String(fullName).trim().split(/\s+/).filter(Boolean);
  if (words.length < 2) return words[0] || "";
  return `${words[0]} ${words[words.length - 1].charAt(0).toUpperCase()}.`;
};

const router = express.Router();

// Public: the Contributors page. Paid, not anonymous, not hidden by the admin.
// Name and date only: never emails or amounts.
router.get("/", async (req, res) => {
  try {
    const donations = await Donation.find(
      { status: "paid", anonymous: false, showOnContributors: true },
      { donorName: 1, paidAt: 1 },
    )
      .sort({ paidAt: -1 })
      .limit(500)
      .lean();
    return res.json(
      donations
        .map((d) => ({ name: publicName(d.donorName), date: d.paidAt }))
        .filter((d) => d.name),
    );
  } catch (error) {
    return serverError(res, error);
  }
});

// TODO at launch: remove /dashboard and /manual-payments (old site only;
// the new admin uses /api/admin/donations).
router.get("/dashboard", auth, (req, res) => {
  return res.json({
    message: "Welcome to the contributors area.",
    user: {
      id: req.user._id,
      name: req.user.name,
      email: req.user.email,
      role: req.user.role,
    },
  });
});

router.get("/manual-payments", auth, adminOnly, async (req, res) => {
  try {
    const contributions = await ManualContribution.find()
      .sort({ transferDate: -1, createdAt: -1 })
      .populate("createdBy", "name email");

    return res.json({ contributions });
  } catch (error) {
    return serverError(res, error, "Unable to fetch manual contributions.");
  }
});

router.post("/manual-payments", auth, adminOnly, async (req, res) => {
  try {
    const { contributorName, contributorEmail, amount, transferDate } =
      req.body;

    if (!contributorName || !contributorEmail || !amount || !transferDate) {
      return res.status(400).json({
        message:
          "Contributor name, email, amount, and transfer date are required.",
      });
    }

    const contribution = await ManualContribution.create({
      contributorName,
      contributorEmail,
      amount: Number(amount),
      transferDate,
      createdBy: req.user._id,
    });

    return res.status(201).json({
      message: "Manual contribution added successfully.",
      contribution,
    });
  } catch (error) {
    return serverError(res, error, "Unable to add manual contribution.");
  }
});

router.put("/manual-payments/:id", auth, adminOnly, async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(404).json({ message: "Manual contribution not found." });
    }
    const { contributorName, contributorEmail, amount, transferDate } =
      req.body;

    const contribution = await ManualContribution.findById(req.params.id);
    if (!contribution) {
      return res
        .status(404)
        .json({ message: "Manual contribution not found." });
    }

    if (contributorName) contribution.contributorName = contributorName;
    if (contributorEmail) contribution.contributorEmail = contributorEmail;
    if (typeof amount !== "undefined") contribution.amount = Number(amount);
    if (transferDate) contribution.transferDate = transferDate;

    await contribution.save();

    return res.json({
      message: "Manual contribution updated successfully.",
      contribution,
    });
  } catch (error) {
    return serverError(res, error, "Unable to update manual contribution.");
  }
});

router.delete("/manual-payments/:id", auth, adminOnly, async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(404).json({ message: "Manual contribution not found." });
    }
    const contribution = await ManualContribution.findByIdAndDelete(
      req.params.id,
    );
    if (!contribution) {
      return res
        .status(404)
        .json({ message: "Manual contribution not found." });
    }

    return res.json({ message: "Manual contribution deleted successfully." });
  } catch (error) {
    return serverError(res, error, "Unable to delete manual contribution.");
  }
});

module.exports = router;
