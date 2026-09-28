const mongoose = require('mongoose');
const { GENDERS, PLAYER_ROLES } = require('../constants/enums');

const emergencyContactSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    phone: { type: String, required: true, trim: true },
  },
  { _id: false }
);

const playerSchema = new mongoose.Schema(
  {
    teamId: { type: mongoose.Schema.Types.ObjectId, ref: 'Team', required: true, index: true },
    role: {
      type: String,
      enum: Object.values(PLAYER_ROLES),
      required: true,
    },
    chineseName: { type: String, required: true, trim: true },
    englishName: { type: String, required: true, trim: true },
    gender: { type: String, enum: Object.values(GENDERS), required: true },
    dateOfBirth: { type: Date, required: true },
    whatsapp: { type: String, required: true, trim: true },
    email: { type: String, required: true, trim: true, lowercase: true },
    club: { type: String, trim: true, default: '' },
    emergencyContact: { type: emergencyContactSchema, required: true },

    // Phase 4: unique QR tokens (no PII inside token); omit until issued
    packQrToken: { type: String, unique: true, sparse: true },
    checkinQrToken: { type: String, unique: true, sparse: true },
    packClaimedAt: { type: Date },
    checkInAt: { type: Date },
    isCheckIn: { type: Boolean, default: false },
  },
  { timestamps: true }
);

playerSchema.index({ email: 1 });
playerSchema.index({ whatsapp: 1 });

module.exports = mongoose.model('Player', playerSchema);
