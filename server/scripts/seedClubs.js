require('dotenv').config();
const mongoose = require('mongoose');
const ClubVenue = require('../models/ClubVenue');

const SEED = [
  { label: '由大會安排', region: '', sortOrder: 0, isOrganizerAssign: true },
  { label: '香港島 — 合作球會／球館（待賽務更新）', region: '香港島', sortOrder: 10 },
  { label: '九龍 — 合作球會／球館（待賽務更新）', region: '九龍', sortOrder: 20 },
  { label: '新界東 — 合作球會／球館（待賽務更新）', region: '新界東', sortOrder: 30 },
  { label: '新界西 — 合作球會／球館（待賽務更新）', region: '新界西', sortOrder: 40 },
  { label: '離島 — 合作球會／球館（待賽務更新）', region: '離島', sortOrder: 50 },
];

async function main() {
  const uri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/gpcchkmo_rsvp';
  await mongoose.connect(uri);
  for (const row of SEED) {
    await ClubVenue.findOneAndUpdate(
      { label: row.label },
      { $set: { ...row, isActive: true } },
      { upsert: true, new: true }
    );
  }
  const count = await ClubVenue.countDocuments({ isActive: true });
  console.log(`Seeded ClubVenue options: ${count}`);
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
