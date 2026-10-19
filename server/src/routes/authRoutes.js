const express = require("express");
const bcrypt = require("bcryptjs");
const User = require("../models/User");
const auth = require("../middleware/auth");
const { serverError } = require("../lib/http");
const { signToken, setSessionCookie, clearSessionCookie } = require("../lib/session");
const loginLimiter = require("../lib/loginLimiter");

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

router.get("/me", auth, async (req, res) => {
  return res.json({ user: publicUser(req.user) });
});

module.exports = router;
