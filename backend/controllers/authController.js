const jwt = require("jsonwebtoken");
const User = require("../models/User");
const { logger } = require("../utils/logger");

const TOKEN_TTL_S = 60 * 60 * 8; // 8 hours

function makeToken(email, role) {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error("JWT_SECRET not set");
  return jwt.sign({ email, role }, secret, { expiresIn: TOKEN_TTL_S });
}

async function login(req, res) {
  try {
    const { email, password } = req.body || {};
    if (!email || !password)
      return res.status(400).json({ error: "email and password required" });

    const user = await User.findOne({ email: String(email).toLowerCase().trim() });
    if (!user) return res.status(401).json({ error: "invalid credentials" });

    const match = await user.comparePassword(String(password));
    if (!match) return res.status(401).json({ error: "invalid credentials" });

    const token = makeToken(user.email, user.role);
    logger.info("auth_login", { email: user.email, role: user.role });
    return res.json({ email: user.email, role: user.role, token });
  } catch (err) {
    logger.error("auth_login_error", { message: err?.message });
    return res.status(500).json({ error: "internal server error" });
  }
}

async function register(req, res) {
  try {
    const { email, password, role, name, organization } = req.body || {};
    if (!email || !password || !role)
      return res.status(400).json({ error: "email, password and role required" });

    const allowed = ["pharma", "medical", "forensic", "admin"];
    if (!allowed.includes(role))
      return res.status(400).json({ error: "invalid role" });

    const exists = await User.findOne({ email: String(email).toLowerCase().trim() });
    if (exists) return res.status(409).json({ error: "email already registered" });

    const passwordHash = await User.hashPassword(String(password));
    const user = await User.create({
      email: String(email).toLowerCase().trim(),
      passwordHash,
      role,
      name: name || "",
      organization: organization || "",
    });

    const token = makeToken(user.email, user.role);
    logger.info("auth_register", { email: user.email, role: user.role });
    return res.status(201).json({ email: user.email, role: user.role, token });
  } catch (err) {
    logger.error("auth_register_error", { message: err?.message });
    return res.status(500).json({ error: "internal server error" });
  }
}

async function logout(req, res) {
  // Stateless JWT — client drops the token from sessionStorage
  return res.json({ ok: true });
}

async function verify(req, res) {
  return res.json({ email: req.user.email, role: req.user.role });
}

module.exports = { login, register, logout, verify };
