const bcrypt = require('bcrypt');
const Admin = require('../models/Admin');

async function ensureDefaultAdmin() {
  const username = (process.env.ADMIN_USERNAME || 'admin').toLowerCase();
  const password = process.env.ADMIN_PASSWORD || 'admin_password';
  const existing = await Admin.findOne({ username });
  if (existing) return existing;

  const passwordHash = await bcrypt.hash(password, 10);
  const admin = await Admin.create({
    username,
    passwordHash,
    displayName: 'GPCC Admin',
    role: 'admin',
  });
  console.log(`Admin user seeded: ${username}`);
  return admin;
}

module.exports = { ensureDefaultAdmin };
