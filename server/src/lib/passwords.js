// The admin password rule, for changing it in Settings and for resetting it
// from an email link.
const MIN_PASSWORD_LENGTH = 12;
// bcrypt only reads the first 72 bytes of a password.
const MAX_PASSWORD_BYTES = 72;

// Returns an error message, or null when the password is acceptable.
const newPasswordProblem = (password) => {
  if (
    typeof password !== "string" ||
    password.length < MIN_PASSWORD_LENGTH ||
    Buffer.byteLength(password) > MAX_PASSWORD_BYTES
  ) {
    return `Choose a password of at least ${MIN_PASSWORD_LENGTH} characters (and no more than ${MAX_PASSWORD_BYTES}).`;
  }
  return null;
};

module.exports = { newPasswordProblem };
