const express = require("express");
const helmet = require("helmet");
const morgan = require("morgan");
const cors = require("cors");
const rateLimit = require("express-rate-limit");
require("dotenv").config();

// Fail fast if required env vars are missing
const REQUIRED_ENV = ["JWT_SECRET", "FLASK_URL", "MONGO_URI"];
const missingEnv = REQUIRED_ENV.filter((k) => !process.env[k]);
if (missingEnv.length) {
  console.error("[startup] Missing required env vars:", missingEnv.join(", "));
  process.exit(1);
}

const { connectDB } = require("./config/db");
const predictRoutes = require("./routes/predict");
const { requestId } = require("./middleware/requestId");
const { logger } = require("./utils/logger");

const APP_PORT = parseInt(process.env.PORT || "3000", 10);
const FRONTEND_ORIGIN = process.env.FRONTEND_ORIGIN || "http://localhost:5173";

const app = express();
app.disable("x-powered-by");
app.use(helmet());
app.use(cors({ origin: FRONTEND_ORIGIN, credentials: true }));
app.use(express.json({ limit: "256kb" }));
app.use(requestId);
app.use(
  morgan(":date[iso] :status :method :url - :response-time ms rid=:req[x-request-id]", {
    stream: { write: (msg) => process.stdout.write(msg) },
  })
);

const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "too many requests" },
});
app.use("/api", apiLimiter);

app.get("/health", (_req, res) => res.json({ status: "ok" }));
app.use("/api", predictRoutes);

// 404
app.use((req, res) => res.status(404).json({ error: "not found" }));

// Central error handler
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, _next) => {
  logger.error("request_failed", { rid: req.requestId, message: err?.message, name: err?.name });
  const status = Number.isFinite(err?.status) ? err.status : 500;
  res.status(status).json({ error: status === 500 ? "internal server error" : err.message });
});

// Connect to MongoDB then start server
connectDB()
  .then(() => {
    app.listen(APP_PORT, () => {
      logger.info("express_api_listening", { port: APP_PORT });
    });
  })
  .catch((err) => {
    console.error("[startup] MongoDB connection failed:", err.message);
    process.exit(1);
  });
