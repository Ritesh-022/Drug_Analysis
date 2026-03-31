function requestId(req, _res, next) {
  req.requestId =
    req.headers["x-request-id"] ||
    `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  next();
}

module.exports = { requestId };

