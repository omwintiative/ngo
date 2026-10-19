// The Express app, without a database connection or a listening port, so
// tests can start it on their own (see test/helpers.js). server.js runs it.
const path = require("path");
const express = require("express");
const cors = require("cors");

const authRoutes = require("./routes/authRoutes");
const adminRoutes = require("./routes/adminRoutes");
const blogRoutes = require("./routes/blogRoutes");
const contributorRoutes = require("./routes/contributorRoutes");
const paymentRoutes = require("./routes/paymentRoutes");

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
app.use("/api/admin", adminRoutes);
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
      name: "omwi-ngo-api",
      status: "ok",
    });
  });
}

// Last stop for errors: never send internal details (stack traces, database
// messages) to the browser. The real error goes to the server log.
app.use((error, req, res, next) => {
  if (error.message === "Not allowed by CORS") {
    return res.status(403).json({ message: "Blocked by CORS policy." });
  }
  if (error.type === "entity.parse.failed") {
    return res.status(400).json({ message: "The request body is not valid JSON." });
  }

  console.error(error);
  return res.status(500).json({ message: "Something went wrong. Please try again." });
});

module.exports = app;
