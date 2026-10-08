require('dotenv').config();
const mongoose = require('mongoose');
const Team = require('../models/Team');
const Player = require('../models/Player');
const AuditLog = require('../models/AuditLog');
const GpcchkmoWonderPayment = require('../models/GpcchkmoWonderPayment');

async function main() {
  const uri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/gpcchkmo_rsvp';
  await mongoose.connect(uri);

  const before = {
    teams: await Team.countDocuments(),
    players: await Player.countDocuments(),
    wonder: await GpcchkmoWonderPayment.countDocuments(),
    audits: await AuditLog.countDocuments(),
  };
  console.log('Before:', before);

  const [teams, players, wonder, audits] = await Promise.all([
    Team.deleteMany({}),
    Player.deleteMany({}),
    GpcchkmoWonderPayment.deleteMany({}),
    AuditLog.deleteMany({}),
  ]);

  console.log('Deleted:', {
    teams: teams.deletedCount,
    players: players.deletedCount,
    wonder: wonder.deletedCount,
    audits: audits.deletedCount,
  });
  console.log('After:', {
    teams: await Team.countDocuments(),
    players: await Player.countDocuments(),
    wonder: await GpcchkmoWonderPayment.countDocuments(),
    audits: await AuditLog.countDocuments(),
  });
  console.log('Admin accounts kept (not touched).');

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
