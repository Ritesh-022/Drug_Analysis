const mongoose = require("mongoose");
const { logger } = require("../utils/logger");

async function connectDB() {
  const uri = process.env.MONGO_URI;
  if (!uri) throw new Error("MONGO_URI not set");

  await mongoose.connect(uri, { serverSelectionTimeoutMS: 5000 });
  logger.info("mongodb_connected", { host: mongoose.connection.host });

  mongoose.connection.on("disconnected", () =>
    logger.warn("mongodb_disconnected")
  );
  mongoose.connection.on("error", (err) =>
    logger.error("mongodb_error", { message: err?.message })
  );
}

module.exports = { connectDB };
