/**
 * Seed / reset P01–P12 club portal logins with fresh 6-digit PINs.
 * Prints credentials once; also writes server/scripts/.club-passwords.json (gitignored).
 *
 * Usage: node server/scripts/seedClubPortalUsers.js
 */
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const bcrypt = require('bcrypt');
const mongoose = require('mongoose');
const ClubPortalUser = require('../models/ClubPortalUser');
const { CLUB_PORTAL_ACCOUNTS } = require('../constants/enums');

function genPin() {
  return String(crypto.randomInt(0, 1_000_000)).padStart(6, '0');
}

async function main() {
  const uri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/gpcchkmo_rsvp';
  await mongoose.connect(uri);

  const credentials = [];
  for (const acc of CLUB_PORTAL_ACCOUNTS) {
    const pin = genPin();
    const passwordHash = await bcrypt.hash(pin, 10);
    await ClubPortalUser.findOneAndUpdate(
      { username: acc.code },
      {
        $set: {
          username: acc.code,
          clubCode: acc.code,
          clubLabel: acc.label,
          passwordHash,
          isActive: true,
        },
      },
      { upsert: true, new: true }
    );
    credentials.push({
      username: acc.code,
      password: pin,
      club: acc.label,
    });
  }

  const outFile = path.join(__dirname, '.club-passwords.json');
  fs.writeFileSync(
    outFile,
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        note: '6-digit PINs for /club login. Keep private.',
        accounts: credentials,
      },
      null,
      2
    )
  );

  console.log('\n=== Club portal logins (P01–P12) ===');
  console.log('URL: /club/login\n');
  credentials.forEach((row) => {
    console.log(`${row.username}  ${row.password}  (${row.club})`);
  });
  console.log(`\nSaved to ${outFile}`);
  console.log('(This file is gitignored — copy passwords securely.)\n');

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
