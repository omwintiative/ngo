const crypto = require("crypto");
const express = require("express");
const bcrypt = require("bcryptjs");
const User = require("../models/User");
const auth = require("../middleware/auth");
const { serverError } = require("../lib/http");
const { signToken, setSessionCookie, clearSessionCookie } = require("../lib/session");
const loginLimiter = require("../lib/loginLimiter");
const { newPasswordProblem } = require("../lib/passwords");
const { sendEmail } = require("../lib/email");

const router = express.Router();

const publicUser = (user) => ({
  id: user._id,
  name: user.name,
  email: user.email,
  role: user.role,
});

// TODO at launch: remove. Public sign-up only serves the old site.
router.post("/register", async (req, res) => {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      return res
        .status(400)
        .json({ message: "Name, email, and password are required." });
    }

    const exists = await User.findOne({ email: String(email).toLowerCase() });
    if (exists) {
      return res.status(409).json({ message: "Email already exists." });
    }

    const hashedPassword = await bcrypt.hash(String(password), 10);
    const user = await User.create({
      name,
      email: String(email).toLowerCase(),
      password: hashedPassword,
      role: "user",
    });

    const token = signToken(user);
    return res.status(201).json({
      message: "Registered successfully",
      token,
      user: publicUser(user),
    });
  } catch (error) {
    return serverError(res, error);
  }
});

router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (typeof email !== "string" || typeof password !== "string" || !email || !password) {
      return res
        .status(400)
        .json({ message: "Email and password are required." });
    }

    const normalisedEmail = email.trim().toLowerCase();
    if (loginLimiter.isLocked(normalisedEmail)) {
      return res.status(429).json({
        message: "Too many attempts. Please wait 15 minutes and try again.",
      });
    }

    const user = await User.findOne({ email: normalisedEmail });
    const isMatch = user ? await bcrypt.compare(password, user.password) : false;
    if (!isMatch) {
      loginLimiter.recordFailure(normalisedEmail);
      return res.status(401).json({ message: "Invalid credentials." });
    }

    loginLimiter.clearFailures(normalisedEmail);
    const token = signToken(user);
    setSessionCookie(res, token);
    // TODO at launch: stop returning the token; only the old site reads it.
    return res.json({
      message: "Login successful",
      token,
      user: publicUser(user),
    });
  } catch (error) {
    return serverError(res, error);
  }
});

router.post("/logout", (req, res) => {
  clearSessionCookie(res);
  return res.json({ message: "Signed out." });
});

// Password reset by email (Figma Admin · Forgot password, Check your email,
// Set a new password). The link holds a random token; only its SHA-256 hash
// is stored, it works once and expires after an hour. Links point at
// ADMIN_SITE_URL (https://admin.omwinitiative.org, or the local admin).
const RESET_LINK_MS = 60 * 60 * 1000;
const RESETS_PER_HOUR = 3;
const FORGOT_ANSWER = {
  message: "If that is the email for the OMWI admin account, we have sent it a link to set a new password.",
};

const hashToken = (token) => crypto.createHash("sha256").update(token).digest("hex");

// email -> times reset emails were sent, so nobody can flood the inbox.
const resetsSent = new Map();
const mayResend = (email) => {
  const now = Date.now();
  const times = (resetsSent.get(email) || []).filter((t) => now - t < RESET_LINK_MS);
  resetsSent.set(email, times);
  return times.length < RESETS_PER_HOUR;
};

const sendResetLink = async (user) => {
  const token = crypto.randomBytes(32).toString("hex");
  user.passwordResetTokenHash = hashToken(token);
  user.passwordResetExpires = new Date(Date.now() + RESET_LINK_MS);
  await user.save();

  const base = (process.env.ADMIN_SITE_URL || "").replace(/\/+$/, "");
  if (!base) console.warn("ADMIN_SITE_URL is not set: the reset link will not work.");
  const link = `${base}/reset-password?token=${token}`;
  // TODO: wording to be approved by OMWI (not in the Figma file).
  await sendEmail({
    to: user.email,
    subject: "Set a new password for the OMWI website admin",
    text: [
      "We received a request to set a new password for the OMWI website admin.",
      "",
      "To choose a new password, open this link within one hour:",
      link,
      "",
      "The link works once. If you did not ask for this, you can ignore this email: your password stays the same.",
    ].join("\n"),
  });
};

router.post("/forgot-password", async (req, res) => {
  try {
    const email = typeof req.body?.email === "string" ? req.body.email.trim().toLowerCase() : "";
    if (!email) return res.status(400).json({ message: "Enter the email address you use to sign in." });

    // Same answer whether or not the address matches, so the page never
    // reveals which emails exist. Only the admin account gets a link.
    const user = await User.findOne({ email, role: "admin" });
    if (user && mayResend(email)) {
      resetsSent.get(email).push(Date.now());
      // Not awaited: answering at the same speed either way also hides
      // whether the address matched.
      sendResetLink(user).catch((error) => console.error("Reset link failed:", error));
    }
    return res.json(FORGOT_ANSWER);
  } catch (error) {
    return serverError(res, error);
  }
});

router.post("/reset-password", async (req, res) => {
  try {
    const { token, newPassword } = req.body || {};
    const user =
      typeof token === "string" && /^[a-f0-9]{64}$/.test(token)
        ? await User.findOne({ passwordResetTokenHash: hashToken(token), passwordResetExpires: { $gt: new Date() } })
        : null;
    if (!user) {
      return res.status(400).json({ message: "This link has expired or was already used. Ask for a new one." });
    }

    const problem = newPasswordProblem(newPassword);
    if (problem) return res.status(400).json({ message: problem });

    user.password = await bcrypt.hash(newPassword, 10);
    user.passwordResetTokenHash = undefined;
    user.passwordResetExpires = undefined;
    // Signs out every session, including any an attacker might have.
    user.sessionVersion = (user.sessionVersion || 0) + 1;
    await user.save();
    loginLimiter.clearFailures(user.email);
    return res.json({ message: "Password updated. You can sign in now." });
  } catch (error) {
    return serverError(res, error);
  }
});

// For tests only.
router.resetLimits = () => resetsSent.clear();

router.get("/me", auth, async (req, res) => {
  return res.json({ user: publicUser(req.user) });
});

module.exports = router;
