const crypto = require('crypto');
const bcrypt = require('bcrypt');
const ClubPortalUser = require('../models/ClubPortalUser');
const { CLUB_PORTAL_ACCOUNTS } = require('../constants/enums');

function genPin() {
  return String(crypto.randomInt(0, 1_000_000)).padStart(6, '0');
}

/**
 * Create missing P01–P10 portal users only (does not reset existing passwords).
 * Returns newly created credentials (cleartext) for logging once.
 */
async function ensureClubPortalUsers() {
  const created = [];
  for (const acc of CLUB_PORTAL_ACCOUNTS) {
    const existing = await ClubPortalUser.findOne({ username: acc.code }).lean();
    if (existing) continue;
    const pin = genPin();
    const passwordHash = await bcrypt.hash(pin, 10);
    await ClubPortalUser.create({
      username: acc.code,
      clubCode: acc.code,
      clubLabel: acc.label,
      passwordHash,
      isActive: true,
    });
    created.push({ username: acc.code, password: pin, club: acc.label });
  }
  return created;
}

module.exports = { ensureClubPortalUsers, genPin };
