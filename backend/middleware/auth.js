const jwt = require("jsonwebtoken");

function authRequired(req, res, next) {
  const header = req.headers.authorization || "";
  const [scheme, token] = header.split(" ");

  if (scheme !== "Bearer" || !token) {
    return res.status(401).json({ error: "not authenticated" });
  }

  const secret = process.env.JWT_SECRET || "";
  if (!secret) {
    return res.status(500).json({ error: "server misconfigured: JWT_SECRET not set" });
  }

  try {
    const decoded = jwt.verify(token, secret);
    req.user = decoded;
    return next();
  } catch (_e) {
    return res.status(401).json({ error: "invalid or expired token" });
  }
}

function roleRequired(allowedRoles) {
  const allowed = new Set(allowedRoles);
  return (req, res, next) => {
    const role = req.user?.role;

    // Accept role as string ("pharma") or array (["pharma","admin"]).
    if (typeof role === "string") {
      if (!allowed.has(role)) return res.status(403).json({ error: "insufficient role" });
      return next();
    }
    if (Array.isArray(role)) {
      const hasAny = role.some((r) => allowed.has(r));
      if (!hasAny) return res.status(403).json({ error: "insufficient role" });
      return next();
    }
    return res.status(403).json({ error: "missing role" });
  };
}

module.exports = { authRequired, roleRequired };

