const bcrypt = require("bcryptjs");
const dotenv = require("dotenv");

// Load .env before anything reads process.env (the Cloudinary config does,
// as soon as the routes are loaded).
dotenv.config();

const connectDB = require("./config/db");
const User = require("./models/User");
const app = require("./app");

// Create the admin account from ADMIN_EMAIL / ADMIN_PASSWORD on first start.
// Once any admin exists this does nothing, so the admin can change their
// sign-in email and password in Settings without a restart undoing it.
const ensureAdmin = async () => {
  try {
    const adminEmail = process.env.ADMIN_EMAIL;
    const adminPassword = process.env.ADMIN_PASSWORD;

    if (!adminEmail || !adminPassword) {
      return;
    }

    if (await User.exists({ role: "admin" })) {
      return;
    }

    const existing = await User.findOne({ email: adminEmail.toLowerCase() });
    if (existing) {
      existing.role = "admin";
      await existing.save();
      return;
    }

    const hashedPassword = await bcrypt.hash(adminPassword, 10);
    await User.create({
      name: "System Admin",
      email: adminEmail.toLowerCase(),
      password: hashedPassword,
      role: "admin",
    });

    console.log("Default admin user created");
  } catch (error) {
    console.error("Error ensuring admin:", error.message);
  }
};

// Connect to the database first, so creating the admin account cannot time
// out on a slow connection (connectDB stops the process if it fails).
const PORT = process.env.PORT || 5000;
connectDB().then(async () => {
  await ensureAdmin();
  app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
});
