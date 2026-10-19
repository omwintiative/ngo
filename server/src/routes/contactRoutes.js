// Public: the Contact page form (API-PLAN.md, Part C). Every message is saved
// for the admin. Spam protection: a hidden "website" field that people never
// see but robots fill in (those messages are dropped quietly), and at most
// 5 messages an hour from one email address. Each saved message is also
// emailed to the team (see alertTeam).
const express = require("express");
const Message = require("../models/Message");
const { serverError } = require("../lib/http");
const { sendEmail } = require("../lib/email");

const router = express.Router();

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PER_EMAIL_PER_HOUR = 5;
const HOUR_MS = 60 * 60 * 1000;

// email -> times of recent messages. In memory: fine for one server copy.
const recent = new Map();
const tooMany = (email) => {
  const now = Date.now();
  const times = (recent.get(email) || []).filter((t) => now - t < HOUR_MS);
  recent.set(email, times);
  if (recent.size > 5000) {
    for (const [key, list] of recent) if (!list.some((t) => now - t < HOUR_MS)) recent.delete(key);
  }
  return times.length >= PER_EMAIL_PER_HOUR;
};
const remember = (email) => recent.get(email).push(Date.now());

const text = (value) => (typeof value === "string" ? value.trim() : "");

// Email alert to MESSAGE_ALERT_TO (info@omwinitiative.org). Not awaited: the
// message is already saved, so a slow or failed email never affects the
// visitor. Reply-To is the visitor, so "Reply" in the inbox answers them.
// TODO: wording to be approved by OMWI (not in the Figma file).
const alertTeam = ({ name, email, subject, message }) => {
  const to = process.env.MESSAGE_ALERT_TO;
  if (!to) return;
  sendEmail({
    to,
    replyTo: email,
    subject: `New message from the website: ${subject || "(no subject)"}`,
    text: [
      `From: ${name} <${email}>`,
      subject ? `Subject: ${subject}` : null,
      "",
      message,
      "",
      "This message is also saved in the website admin, under Messages.",
    ]
      .filter((line) => line !== null)
      .join("\n"),
  });
};

router.post("/", async (req, res) => {
  try {
    const { website } = req.body || {};
    const name = text(req.body?.name);
    const email = text(req.body?.email).toLowerCase();
    const subject = text(req.body?.subject);
    const message = text(req.body?.message);

    // Robot: answer as if it worked, save nothing.
    if (text(website)) return res.status(201).json({ message: "Message sent." });

    if (!name || name.length > 120) return res.status(400).json({ message: "Enter your full name." });
    if (!EMAIL_PATTERN.test(email) || email.length > 254) {
      return res.status(400).json({ message: "Enter a valid email address." });
    }
    if (subject.length > 150) return res.status(400).json({ message: "Please shorten the subject." });
    if (!message) return res.status(400).json({ message: "Write your message." });
    if (message.length > 5000) {
      return res.status(400).json({ message: "Please shorten your message to 5,000 characters or fewer." });
    }

    if (tooMany(email)) {
      return res.status(429).json({ message: "You have sent several messages already. Please try again in an hour." });
    }

    await Message.create({ name, email, subject, message });
    remember(email);
    alertTeam({ name, email, subject, message });
    return res.status(201).json({ message: "Message sent." });
  } catch (error) {
    return serverError(res, error, "Your message could not be sent. Please try again.");
  }
});

// For tests only.
router.resetLimits = () => recent.clear();

module.exports = router;
