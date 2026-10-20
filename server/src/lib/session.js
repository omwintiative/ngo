// Sign-in sessions. The admin's session lives in an HttpOnly cookie that page
// scripts cannot read. It works because the site forwards /api to this server,
// so the cookie belongs to the site's own domain (see API-PLAN.md).
// Until launch, sign-in also returns the token in the response body and the
// API still accepts `Authorization: Bearer`, for the old site's admin pages.
const jwt = require("jsonwebtoken");

const COOKIE_NAME = "omwi_session";

// "Keep me signed in on this device" (Figma Admin · Sign in): 30 days on
// that device. Without it, the session ends when the browser closes, and
// after 12 hours (JWT_EXPIRES_IN) at most.
const REMEMBER_FOR = "30d";

// `v` is the user's sessionVersion: changing the password raises it, which
// signs out every other session.
const signToken = (user, { remember = false } = {}) =>
  jwt.sign(
    { id: user._id, role: user.role, v: user.sessionVersion || 0 },
    process.env.JWT_SECRET,
    { expiresIn: remember ? REMEMBER_FOR : process.env.JWT_EXPIRES_IN || "12h" },
  );

// Secure is always on: browsers treat http://localhost as secure, so local
// development still works.
const cookieOptions = {
  httpOnly: true,
  secure: true,
  sameSite: "strict",
  path: "/",
};

// `remember`: keep the cookie until the token expires; otherwise it is a
// browser-session cookie.
const setSessionCookie = (res, token, { remember = false } = {}) => {
  const { exp } = jwt.decode(token);
  res.cookie(COOKIE_NAME, token, remember ? { ...cookieOptions, expires: new Date(exp * 1000) } : cookieOptions);
};

const clearSessionCookie = (res) => res.clearCookie(COOKIE_NAME, cookieOptions);

const readSessionCookie = (req) => {
  for (const part of (req.headers.cookie || "").split(";")) {
    const [name, ...value] = part.trim().split("=");
    if (name === COOKIE_NAME) return decodeURIComponent(value.join("="));
  }
  return null;
};

module.exports = { COOKIE_NAME, signToken, setSessionCookie, clearSessionCookie, readSessionCookie };
