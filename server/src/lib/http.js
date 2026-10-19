// Answer with a 500 without sending internal details (database or Cloudinary
// messages) to the browser; the real error goes to the server log.
const serverError = (res, error, message = "Something went wrong. Please try again.") => {
  console.error(error);
  return res.status(500).json({ message });
};

module.exports = { serverError };
