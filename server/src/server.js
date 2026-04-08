const path = require("path");
const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const bcrypt = require("bcryptjs");

dotenv.config();

const connectDB = require("./config/db");
const User = require("./models/User");
const authRoutes = require("./routes/authRoutes");
const blogRoutes = require("./routes/blogRoutes");
const contributorRoutes = require("./routes/contributorRoutes");
const paymentRoutes = require("./routes/paymentRoutes");
connectDB();

const app = express();

const allowedOrigins = (process.env.CORS_ORIGIN || "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

const corsOptions =
  allowedOrigins.length === 0 || allowedOrigins.includes("*")
    ? undefined
    : {
        origin(origin, callback) {
          if (!origin || allowedOrigins.includes(origin)) {
            callback(null, true);
            return;
          }

          callback(new Error("Not allowed by CORS"));
        },
      };

app.use(cors(corsOptions));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use("/uploads", express.static(path.join(__dirname, "../uploads")));
app.use("/api/auth", authRoutes);
app.use("/api/blogs", blogRoutes);
app.use("/api/contributors", contributorRoutes);
app.use("/api/payments", paymentRoutes);

app.get("/api/health", (req, res) => {
  return res.json({ status: "ok" });
});

const shouldServeStaticFrontend = process.env.SERVE_STATIC_FRONTEND === "true";

if (shouldServeStaticFrontend) {
  const staticRoot = path.join(__dirname, "../../");
  app.use(express.static(staticRoot));

  app.get("/", (req, res) => {
    return res.sendFile(path.join(staticRoot, "index.html"));
  });
} else {
  app.get("/", (req, res) => {
    return res.json({
      name: "young-heart-ngo-api",
      status: "ok",
    });
  });
}

app.use((error, req, res, next) => {
  if (error.message === "Not allowed by CORS") {
    return res.status(403).json({ message: "Blocked by CORS policy." });
  }

  return next(error);
});

const ensureAdmin = async () => {
  try {
    const adminEmail = process.env.ADMIN_EMAIL;
    const adminPassword = process.env.ADMIN_PASSWORD;

    if (!adminEmail || !adminPassword) {
      return;
    }

    const existing = await User.findOne({ email: adminEmail.toLowerCase() });
    if (existing) {
      if (existing.role !== "admin") {
        existing.role = "admin";
        await existing.save();
      }
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

const PORT = process.env.PORT || 5000;
app.listen(PORT, async () => {
  await ensureAdmin();
  console.log(`Server running on port ${PORT}`);
});
