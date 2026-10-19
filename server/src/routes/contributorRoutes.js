const express = require("express");
const mongoose = require("mongoose");
const auth = require("../middleware/auth");
const adminOnly = require("../middleware/admin");
const { serverError } = require("../lib/http");
const ManualContribution = require("../models/ManualContribution");

const router = express.Router();

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
