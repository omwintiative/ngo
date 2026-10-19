// Sending email through Resend (API-PLAN.md, Part E): password reset links
// and new-message alerts. Settings (server/.env on Render):
//   RESEND_API_KEY  the Resend API key
//   EMAIL_FROM      e.g. "OMWI website <no-reply@omwinitiative.org>" (a
//                   domain verified in Resend)
// Without them nothing is sent and the server logs that, so local
// development and tests work without an email account.
const RESEND_API = "https://api.resend.com/emails";

// Keep user-typed text out of email headers.
const oneLine = (value) => String(value).replace(/[\r\n]+/g, " ").trim();

// Resolves true when Resend accepted the email, false otherwise. Never throws:
// a failed email must not break the request that triggered it.
const sendEmail = async ({ to, subject, text, replyTo }) => {
  const { RESEND_API_KEY, EMAIL_FROM } = process.env;
  if (!RESEND_API_KEY || !EMAIL_FROM) {
    console.warn(`Email not sent (RESEND_API_KEY or EMAIL_FROM missing): "${oneLine(subject)}"`);
    return false;
  }
  try {
    const response = await fetch(RESEND_API, {
      method: "POST",
      headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: EMAIL_FROM,
        to,
        subject: oneLine(subject).slice(0, 200),
        text,
        ...(replyTo ? { reply_to: oneLine(replyTo) } : {}),
      }),
    });
    if (!response.ok) {
      console.error(`Resend refused an email (${response.status}): ${await response.text().catch(() => "")}`);
      return false;
    }
    return true;
  } catch (error) {
    console.error("Email could not be sent:", error);
    return false;
  }
};

module.exports = { sendEmail };
