const mongoose = require('mongoose');
const {
  REGISTRATION_TYPES,
  AGE_GROUPS,
  EVENT_CATEGORIES,
  TEAM_STATUS,
  PAYMENT_STATUS,
  QUALIFICATION_STATUS,
  FEE,
} = require('../constants/enums');

const agreementsSchema = new mongoose.Schema(
  {
    rules: { type: Boolean, required: true },
    ranking: { type: Boolean, required: true },
    truthfulness: { type: Boolean, required: true },
    pics: { type: Boolean, required: true },
    marketing: { type: Boolean, default: false },
  },
  { _id: false }
);

const researchSchema = new mongoose.Schema(
  {
    carnivalIntent: { type: String, required: true },
    spectatorCount: { type: String, default: '' },
    skillLevel: { type: String, required: true },
    interests: [{ type: String }],
    hearAbout: { type: String, required: true },
    contactPrefs: [{ type: String }],
  },
  { _id: false }
);

const paymentSchema = new mongoose.Schema(
  {
    status: {
      type: String,
      enum: Object.values(PAYMENT_STATUS),
      default: PAYMENT_STATUS.UNPAID,
    },
    method: { type: String, default: null }, // stripe | fps | bank_transfer
    baseAmountHkd: { type: Number, default: FEE.BASE_HKD },
    feeAmountHkd: { type: Number, default: null },
    totalAmountHkd: { type: Number, default: null },
    currency: { type: String, default: FEE.CURRENCY },
    stripeSessionId: { type: String, default: null },
    stripePaymentIntentId: { type: String, default: null },
    paymentReference: { type: String, default: null },
    proofUrl: { type: String, default: null },
    paidAt: { type: Date, default: null },
  },
  { _id: false }
);

const teamSchema = new mongoose.Schema(
  {
    displayName: { type: String, trim: true, default: '' },
    captainClub: { type: String, required: true, trim: true },
    captainEmail: { type: String, required: true, trim: true, lowercase: true },
    registrationType: {
      type: String,
      enum: Object.values(REGISTRATION_TYPES),
      required: true,
    },
    ageGroup: { type: String, enum: Object.values(AGE_GROUPS), required: true },
    eventCategory: {
      type: String,
      enum: Object.values(EVENT_CATEGORIES),
      required: true,
    },
    preferredVenueId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ClubVenue',
      default: null,
    },
    preferredVenueLabel: { type: String, required: true, trim: true },
    availability: [{ type: String }],
    research: { type: researchSchema, required: true },
    agreements: { type: agreementsSchema, required: true },

    status: {
      type: String,
      enum: Object.values(TEAM_STATUS),
      default: TEAM_STATUS.SUBMITTED_PENDING_PAYMENT,
      index: true,
    },
    payment: { type: paymentSchema, default: () => ({}) },
    qualificationStatus: {
      type: String,
      enum: Object.values(QUALIFICATION_STATUS),
      default: QUALIFICATION_STATUS.PENDING,
    },
    /** Issued only after confirmation (Phase 3). Omit until assigned (sparse unique). */
    teamCode: { type: String, unique: true, sparse: true },

    submittedAt: { type: Date, default: Date.now },
    confirmedAt: { type: Date, default: null },
    notes: { type: String, default: '' },
  },
  { timestamps: true }
);

teamSchema.index({ captainEmail: 1, eventCategory: 1 });
teamSchema.index({ status: 1, createdAt: -1 });

module.exports = mongoose.model('Team', teamSchema);
