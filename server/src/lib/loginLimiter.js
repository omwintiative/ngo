// Pause sign-in for an email address after repeated wrong passwords
// (5 within 15 minutes, then 15 minutes' pause). Counted per email address,
// not per IP, because IP addresses behind the Vercel and Render proxies can
// be faked. Kept in memory: fine while Render runs one copy of the server;
// a restart clears it.
const MAX_FAILURES = 5;
const WINDOW_MS = 15 * 60 * 1000;
const MAX_TRACKED = 5000;

const attempts = new Map(); // email -> { count, firstAt, lockedUntil }

const now = () => Date.now();

const prune = () => {
  if (attempts.size < MAX_TRACKED) return;
  for (const [email, entry] of attempts) {
    if (now() - entry.firstAt > WINDOW_MS && (entry.lockedUntil || 0) < now()) attempts.delete(email);
  }
};

const isLocked = (email) => {
  const entry = attempts.get(email);
  return Boolean(entry && entry.lockedUntil && entry.lockedUntil > now());
};

const recordFailure = (email) => {
  prune();
  let entry = attempts.get(email);
  if (!entry || now() - entry.firstAt > WINDOW_MS) {
    entry = { count: 0, firstAt: now(), lockedUntil: 0 };
    attempts.set(email, entry);
  }
  entry.count += 1;
  if (entry.count >= MAX_FAILURES) entry.lockedUntil = now() + WINDOW_MS;
};

const clearFailures = (email) => attempts.delete(email);

// For tests only.
const resetAll = () => attempts.clear();

module.exports = { isLocked, recordFailure, clearFailures, resetAll, MAX_FAILURES };
