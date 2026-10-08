require('dotenv').config();
const mongoose = require('mongoose');
const ClubVenue = require('../models/ClubVenue');

const SEED = [
  {
    label: '由大會安排',
    address: '',
    region: '',
    sortOrder: 0,
    isOrganizerAssign: true,
  },
  {
    label: 'Bay Pickle',
    address: '香港島銅鑼灣木星街23號',
    region: '香港島',
    sortOrder: 10,
    isActive: false, // temporarily hidden from RSVP venue select
  },
  {
    label: 'PickleVibes',
    address: '九龍尖沙咀國際廣場401室',
    region: '九龍',
    sortOrder: 20,
  },
  {
    label: 'PICKLE.READY',
    address: '荃灣荃灣廣場5樓501號鋪',
    region: '新界西',
    sortOrder: 30,
  },
  {
    label: 'My Pickle World （MYPW）',
    address: '大窩口國瑞路116-122號城市工業中心一期15樓A室',
    region: '新界西',
    sortOrder: 40,
  },
  {
    label: 'Table meets Pickle',
    address: '九龍觀塘成業街7號晉寧中心15樓A',
    region: '九龍',
    sortOrder: 50,
  },
  {
    label: 'Pick & Match',
    address: '香港沙田凱悅酒店 室外場（3 courts）',
    region: '新界東',
    sortOrder: 60,
  },
  {
    label: '錦綉花園鄉村俱樂部',
    address: '香港新界元朗錦綉花園紅荷路',
    region: '新界西',
    sortOrder: 70,
  },
  {
    label: 'Pickle Lab',
    address: '香港島灣仔軒尼詩道256號軒尼詩大廈10樓及11樓',
    region: '香港島',
    sortOrder: 80,
  },
];

function displayLabel(row) {
  return row.address ? `${row.label} — ${row.address}` : row.label;
}

async function main() {
  const uri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/gpcchkmo_rsvp';
  await mongoose.connect(uri);

  const keepLabels = SEED.map((row) => row.label);
  await ClubVenue.updateMany(
    { label: { $nin: keepLabels } },
    { $set: { isActive: false } }
  );

  for (const row of SEED) {
    const isActive = row.isActive !== false;
    await ClubVenue.findOneAndUpdate(
      { label: row.label },
      {
        $set: {
          ...row,
          isActive,
          isOrganizerAssign: Boolean(row.isOrganizerAssign),
        },
      },
      { upsert: true, new: true }
    );
  }

  const active = await ClubVenue.find({ isActive: true }).sort({ sortOrder: 1 }).lean();
  const hidden = await ClubVenue.find({ isActive: false }).sort({ sortOrder: 1 }).lean();
  console.log(`Seeded ClubVenue active: ${active.length}`);
  active.forEach((v) => console.log(' +', v.label));
  if (hidden.length) {
    console.log(`Hidden: ${hidden.length}`);
    hidden.forEach((v) => console.log(' -', v.label));
  }
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

module.exports = { SEED, displayLabel };
