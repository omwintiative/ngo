// Admin-only routes (Figma Admin page). Every route here needs the signed-in
// admin: account settings, the blog list with drafts, and the dashboard
// summary. Donations, messages and the gallery have their own files
// (adminDonationRoutes.js, adminMessageRoutes.js, galleryRoutes.js).
const express = require("express");
const bcrypt = require("bcryptjs");
const User = require("../models/User");
const Donation = require("../models/Donation");
const Message = require("../models/Message");
const Blog = require("../models/Blog");
const auth = require("../middleware/auth");
const adminOnly = require("../middleware/admin");
const { serverError } = require("../lib/http");
const { searchPattern } = require("../lib/search");
const { newPasswordProblem } = require("../lib/passwords");
const { signToken, setSessionCookie } = require("../lib/session");

const router = express.Router();
router.use(auth, adminOnly);

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const publicUser = (user) => ({ id: user._id, name: user.name, email: user.email, role: user.role });

// Checks the current password; answers the request itself when it is wrong.
const confirmPassword = async (req, res) => {
  const { currentPassword } = req.body;
  const user = await User.findById(req.user._id);
  const ok = typeof currentPassword === "string" && (await bcrypt.compare(currentPassword, user.password));
  if (!ok) {
    res.status(400).json({ message: "Your current password is not correct." });
    return null;
  }
  return user;
};

// Name and sign-in email. The sign-in email is also where reset links go.
router.patch("/account", async (req, res) => {
  try {
    const { name, email } = req.body;
    const newName = typeof name === "string" ? name.trim() : undefined;
    const newEmail = typeof email === "string" ? email.trim().toLowerCase() : undefined;

    if (newName === undefined && newEmail === undefined) {
      return res.status(400).json({ message: "Nothing to update." });
    }
    if (newName !== undefined && (newName.length === 0 || newName.length > 100)) {
      return res.status(400).json({ message: "Enter a name of up to 100 characters." });
    }
    if (newEmail !== undefined && (!EMAIL_PATTERN.test(newEmail) || newEmail.length > 254)) {
      return res.status(400).json({ message: "Enter a valid email address." });
    }

    const user = await confirmPassword(req, res);
    if (!user) return undefined;

    if (newEmail !== undefined && newEmail !== user.email) {
      if (await User.exists({ email: newEmail, _id: { $ne: user._id } })) {
        return res.status(409).json({ message: "Another account already uses that email address." });
      }
      user.email = newEmail;
    }
    if (newName !== undefined) user.name = newName;

    await user.save();
    return res.json({ message: "Account updated.", user: publicUser(user) });
  } catch (error) {
    return serverError(res, error);
  }
});

// Change the password. Signs out every other session; this one gets a new
// cookie so the admin stays signed in here.
router.put("/account/password", async (req, res) => {
  try {
    const { newPassword } = req.body;
    const problem = newPasswordProblem(newPassword);
    if (problem) return res.status(400).json({ message: problem });

    const user = await confirmPassword(req, res);
    if (!user) return undefined;

    user.password = await bcrypt.hash(newPassword, 10);
    user.sessionVersion = (user.sessionVersion || 0) + 1;
    await user.save();

    setSessionCookie(res, signToken(user));
    return res.json({ message: "Password updated." });
  } catch (error) {
    return serverError(res, error);
  }
});

// Start of the current month in Nigeria (WAT, UTC+1 all year).
const WAT_OFFSET_MS = 60 * 60 * 1000;
const startOfMonthInNigeria = (now = new Date()) => {
  const local = new Date(now.getTime() + WAT_OFFSET_MS);
  return new Date(Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), 1) - WAT_OFFSET_MS);
};

// A donor is their email address, or their name for gifts recorded without one.
const donorKey = (d) => d.donorEmail || `name:${d.donorName.toLowerCase()}`;

// Admin · Blog posts (Figma): every post, drafts included, newest first,
// with the status and category filters and a title search.
router.get("/blogs", async (req, res) => {
  try {
    const { status, category, q } = req.query;
    const filter = {};
    if (status === "draft") filter.status = "draft";
    else if (status === "published") Object.assign(filter, Blog.PUBLISHED);
    if (typeof category === "string" && Blog.CATEGORIES.includes(category)) filter.category = category;
    const pattern = searchPattern(q);
    if (pattern) filter.title = pattern;
    const posts = await Blog.find(filter).sort({ createdAt: -1 }).populate("createdBy", "name");
    return res.json({ posts, total: posts.length });
  } catch (error) {
    return serverError(res, error);
  }
});

// Figma Admin · Dashboard: this month's donations, donors (and how many gave
// for the first time), the five newest donations, messages waiting for a
// reply, and published and draft posts.
router.get("/summary", async (req, res) => {
  try {
    const monthStart = startOfMonthInNigeria();
    const paid = await Donation.find({ status: "paid" }, { donorEmail: 1, donorName: 1, amount: 1, paidAt: 1 }).lean();

    const thisMonth = paid.filter((d) => d.paidAt && d.paidAt >= monthStart);
    const donorsThisMonth = new Set(thisMonth.map(donorKey));
    const givenBefore = new Set(paid.filter((d) => d.paidAt && d.paidAt < monthStart).map(donorKey));

    const recent = (await Donation.find().sort({ createdAt: -1 }).limit(20))
      .sort((a, b) => (b.paidAt || b.createdAt) - (a.paidAt || a.createdAt))
      .slice(0, 5)
      .map((d) => ({
        id: d._id,
        donorName: d.donorName,
        anonymous: d.anonymous,
        amount: d.amount,
        method: d.method,
        channel: d.channel,
        status: d.displayStatus(),
        date: d.paidAt || d.createdAt,
      }));

    const [publishedPosts, draftPosts, newMessages, latestMessages] = await Promise.all([
      Blog.countDocuments(Blog.PUBLISHED),
      Blog.countDocuments({ status: "draft" }),
      Message.countDocuments({ status: "new" }),
      Message.find({}, { name: 1, subject: 1, status: 1, createdAt: 1 }).sort({ createdAt: -1 }).limit(3).lean(),
    ]);

    return res.json({
      posts: { published: publishedPosts, drafts: draftPosts },
      newMessages,
      latestMessages: latestMessages.map((m) => ({
        id: m._id,
        name: m.name,
        subject: m.subject,
        status: m.status,
        createdAt: m.createdAt,
      })),
      donationsThisMonth: {
        total: Math.round(thisMonth.reduce((sum, d) => sum + d.amount, 0) * 100) / 100,
        count: thisMonth.length,
      },
      donorsThisMonth: {
        count: donorsThisMonth.size,
        firstTime: [...donorsThisMonth].filter((key) => !givenBefore.has(key)).length,
      },
      recentDonations: recent,
    });
  } catch (error) {
    return serverError(res, error);
  }
});

module.exports = router;
module.exports.startOfMonthInNigeria = startOfMonthInNigeria;
