// Admin-only routes (Figma Admin page). Every route here needs the signed-in
// admin. Part A: account settings. Donations, messages, gallery and the
// dashboard summary follow in later parts (API-PLAN.md).
const express = require("express");
const bcrypt = require("bcryptjs");
const User = require("../models/User");
const auth = require("../middleware/auth");
const adminOnly = require("../middleware/admin");
const { serverError } = require("../lib/http");
const { signToken, setSessionCookie } = require("../lib/session");

const router = express.Router();
router.use(auth, adminOnly);

const MIN_PASSWORD_LENGTH = 12;
// bcrypt only reads the first 72 bytes of a password.
const MAX_PASSWORD_BYTES = 72;
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
    if (
      typeof newPassword !== "string" ||
      newPassword.length < MIN_PASSWORD_LENGTH ||
      Buffer.byteLength(newPassword) > MAX_PASSWORD_BYTES
    ) {
      return res.status(400).json({
        message: `Choose a password of at least ${MIN_PASSWORD_LENGTH} characters (and no more than ${MAX_PASSWORD_BYTES}).`,
      });
    }

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

module.exports = router;
