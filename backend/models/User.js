const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const userSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
  },
  passwordHash: {
    type: String,
    required: true,
  },
  role: {
    type: String,
    enum: ["pharma", "medical", "forensic", "admin"],
    required: true,
  },
  name: { type: String, default: "" },
  organization: { type: String, default: "" },
  createdAt: { type: Date, default: Date.now },
});

// Index for fast login lookups — unique:true above already creates this index, no explicit index needed

userSchema.methods.comparePassword = function (plain) {
  return bcrypt.compare(plain, this.passwordHash);
};

userSchema.statics.hashPassword = function (plain) {
  return bcrypt.hash(plain, 12);
};

module.exports = mongoose.model("User", userSchema);
