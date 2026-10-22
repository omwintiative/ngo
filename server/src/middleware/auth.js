const jwt = require("jsonwebtoken");
const User = require("../models/User");
const { readSessionCookie } = require("../lib/session");

// Signed-in user from the session cookie (new admin) or, until launch, an
// `Authorization: Bearer` token (old site). A token issued before the last
// password change no longer works.
const auth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization || "";
    const token = authHeader.startsWith("Bearer ")
      ? authHeader.slice("Bearer ".length)
      : readSessionCookie(req);

    if (!token) {
      return res.status(401).json({ message: "Please sign in." });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET, {
      algorithms: ["HS256"],
    });
    const user = await User.findById(decoded.id).select("-password");

    if (!user || (decoded.v || 0) !== (user.sessionVersion || 0)) {
      return res
        .status(401)
        .json({ message: "Your session has ended. Please sign in again." });
    }

    req.user = user;
    next();
  } catch (error) {
    return res
      .status(401)
      .json({ message: "Your session has ended. Please sign in again." });
  }
};

module.exports = auth;
