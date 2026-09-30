const mongoose = require('mongoose');

const adminSchema = new mongoose.Schema(
  {
    username: { type: String, required: true, unique: true, trim: true, lowercase: true },
    passwordHash: { type: String, required: true },
    displayName: { type: String, trim: true, default: 'Admin' },
    role: { type: String, enum: ['admin', 'staff'], default: 'admin' },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Admin', adminSchema);
