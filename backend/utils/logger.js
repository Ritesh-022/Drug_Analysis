function log(level, event, meta = {}) {
  const payload = {
    ts: new Date().toISOString(),
    level,
    event,
    ...meta,
  };
  // Production MVP: stdout JSON logs (compatible with most log shippers).
  // Replace/extend with Winston/Pino if needed.
  // eslint-disable-next-line no-console
  console.log(JSON.stringify(payload));
}

const logger = {
  info: (event, meta) => log("info", event, meta),
  warn: (event, meta) => log("warn", event, meta),
  error: (event, meta) => log("error", event, meta),
  debug: (event, meta) => {
    if ((process.env.LOG_LEVEL || "info").toLowerCase() === "debug") log("debug", event, meta);
  },
};

module.exports = { logger };

