// Admin search boxes: the typed text, matched literally and case-blind.
// Returns a RegExp, or null when there is nothing to search for.
const searchPattern = (query) => {
  if (typeof query !== "string" || !query.trim()) return null;
  const literal = query.trim().slice(0, 100).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(literal, "i");
};

module.exports = { searchPattern };
