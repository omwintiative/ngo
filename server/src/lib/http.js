// Answer with a 500 without sending internal details (database or Cloudinary
// messages) to the browser; the real error goes to the server log.
const serverError = (
  res,
  error,
  message = "Something went wrong. Please try again.",
) => {
  console.error(error);
  return res.status(500).json({ message });
};

// Request data never needs keys like `$ne` (MongoDB operators) or
// `__proto__`, so refuse them before any route can pass them to a query.
const UNSAFE_KEY = /^\$|^(__proto__|constructor|prototype)$/;
const hasUnsafeKey = (value) =>
  value !== null &&
  typeof value === "object" &&
  Object.keys(value).some(
    (key) => UNSAFE_KEY.test(key) || hasUnsafeKey(value[key]),
  );

const UNSAFE_ANSWER = {
  message: "The request contains data that is not allowed.",
};

module.exports = { serverError, hasUnsafeKey, UNSAFE_ANSWER };
