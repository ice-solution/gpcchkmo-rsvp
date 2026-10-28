require('dotenv').config();
const mongoose = require('mongoose');
const ClubVenue = require('../models/ClubVenue');
const { formatVenueOptionLabel } = ClubVenue;

const SEED = [
  {
    label: '由大會安排',
    code: '',
    address: '',
    scheduleNote: '',
    region: '',
    sortOrder: 0,
    isOrganizerAssign: true,
    isActive: false,
  },
  {
    label: 'Bay Pickle',
    code: '',
    address: '香港島銅鑼灣木星街23號',
    scheduleNote: '',
    region: '香港島',
    sortOrder: 5,
    isActive: false,
  },
  {
    label: 'Pick & Match',
    code: 'P01',
    address: '香港沙田凱悅酒店 室外場',
    scheduleNote: '7/11 9am-7pm 海選',
    region: '新界東',
    sortOrder: 10,
  },
  {
    label: 'LIT PICKLE',
    code: 'P02',
    address: '觀塘中海日升中心15A',
    scheduleNote: '28/10 女雙、31/10 男雙、04/11 混雙',
    scheduleKey: 'lit_pickle',
    region: '九龍',
    sortOrder: 20,
  },
  {
    label: 'PickleVibes',
    code: 'P03',
    address: '九龍尖沙咀國際廣場401室',
    scheduleNote: '7/11, 8/11',
    region: '九龍',
    sortOrder: 30,
  },
  {
    label: 'PICKLE.READY',
    code: 'P04',
    address: '荃灣荃灣廣場5樓501號鋪',
    scheduleNote: '8/11海選',
    region: '新界西',
    sortOrder: 40,
  },
  {
    label: 'My Pickle World （MYPW）',
    code: 'P05',
    address: '大窩口國瑞路116-122號城市工業中心一期15樓A室',
    scheduleNote: '31/10–1/11（按年齡組別及項目）',
    scheduleKey: 'mypw',
    region: '新界西',
    sortOrder: 50,
  },
  {
    label: 'Table meets Pickle',
    code: 'P06',
    address: '九龍觀塘成業街7號寧晉中心15樓A',
    scheduleNote: '25/10, 31/10, 1/11海選',
    region: '九龍',
    sortOrder: 60,
  },
  {
    label: 'Pickle Lab',
    code: 'P07',
    address: '屯順街1號屯門市廣場4樓 TMTP',
    scheduleNote: '8/11 海選',
    region: '新界西',
    sortOrder: 70,
  },
  {
    label: '錦綉花園鄉村俱樂部',
    code: 'P08',
    address: '香港新界元朗錦綉花園紅荷路 室外場',
    scheduleNote: '25/10 9am-9pm 海選',
    region: '新界西',
    sortOrder: 80,
  },
  {
    label: 'PICKLEDISE',
    code: 'P12',
    address: '九龍九龍灣宏照道23號第一集團中心20樓全層（2個場）',
    scheduleNote: '01/11 19:00–21:00 海選',
    region: '九龍',
    sortOrder: 85,
  },
];

function displayLabel(row) {
  return formatVenueOptionLabel(row);
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
          code: row.code || '',
          scheduleKey: row.scheduleKey || '',
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
  active.forEach((v) => console.log(' +', displayLabel(v)));
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
