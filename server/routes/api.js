const express = require('express');
const rateLimit = require('express-rate-limit');
const ClubVenue = require('../models/ClubVenue');
const { formatVenueOptionLabel } = ClubVenue;
const { createRsvp, attachPaymentProof } = require('../services/rsvpService');
const { isPaymentGatewayEnabled } = require('../config/paymentGateway');
const {
  optionalPaymentProof,
  publicProofPath,
} = require('../middleware/paymentProofUpload');
const {
  eligibleAgeGroups,
  eligibleEventCategories,
} = require('../services/eligibility');
const {
  AGE_GROUP_LABELS,
  EVENT_CATEGORY_LABELS,
  CARNIVAL_INTENT,
  SPECTATOR_COUNTS,
  SKILL_LEVELS,
  INTEREST_TOPICS,
  HEAR_ABOUT,
  CONTACT_PREFS,
  REGISTRATION_TYPES,
  CAPTAIN_CLUBS,
  HIDDEN_CAPTAIN_CLUBS,
  CAPTAIN_CLUB_OTHER_VALUE,
  FEE,
  PACK_TIERS,
  PACK_TIER_LABELS,
  PACK_TIER_ADDON_HKD,
} = require('../constants/enums');
const { getQualifierSchedulesMeta } = require('../constants/qualifierSchedules');
const { buildPaymentSummary } = require('../services/paymentService');

const router = express.Router();

const rsvpLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { ok: false, errors: ['提交次數過多，請稍後再試。'] },
});

router.get('/meta', async (_req, res, next) => {
  try {
    const clubs = await ClubVenue.find({
      isActive: true,
      isOrganizerAssign: { $ne: true },
    })
      .sort({ sortOrder: 1, label: 1 })
      .lean();

    res.json({
      ok: true,
      data: {
        paymentGatewayEnabled: isPaymentGatewayEnabled(),
        fee: buildPaymentSummary({ packTier: PACK_TIERS.STANDARD }),
        packTiers: Object.values(PACK_TIERS).map((value) => ({
          value,
          label: PACK_TIER_LABELS[value],
          addonHkd: PACK_TIER_ADDON_HKD[value],
          totalHkd: FEE.BASE_HKD + PACK_TIER_ADDON_HKD[value],
        })),
        maxEventsPerPlayer: FEE.MAX_EVENTS_PER_PLAYER,
        captainClubs: [
          ...CAPTAIN_CLUBS.filter((label) => !HIDDEN_CAPTAIN_CLUBS.includes(label)).map(
            (label) => ({ value: label, label })
          ),
          { value: CAPTAIN_CLUB_OTHER_VALUE, label: '其他' },
        ],
        registrationTypes: [
          {
            value: REGISTRATION_TYPES.FIRST_OR_ONLY,
            label: '第一個／唯一參賽項目',
          },
          {
            value: REGISTRATION_TYPES.SECOND_ADDITIONAL,
            label: '第二個兼報項目',
          },
        ],
        venues: clubs.map((c) => ({
          id: String(c._id),
          label: formatVenueOptionLabel(c),
          name: c.label,
          address: c.address || '',
          scheduleNote: c.scheduleNote || '',
          scheduleKey: c.scheduleKey || '',
          region: c.region,
          isOrganizerAssign: c.isOrganizerAssign,
        })),
        qualifierSchedules: getQualifierSchedulesMeta(),
        carnivalIntent: CARNIVAL_INTENT,
        spectatorCounts: SPECTATOR_COUNTS.map((v) => ({
          value: v,
          label:
            v === '4_plus' ? '4 或以上' : v === 'unsure' ? '未能確定' : v,
        })),
        skillLevels: SKILL_LEVELS,
        interestTopics: INTEREST_TOPICS,
        hearAbout: HEAR_ABOUT,
        contactPrefs: CONTACT_PREFS,
        ageGroupLabels: AGE_GROUP_LABELS,
        eventCategoryLabels: EVENT_CATEGORY_LABELS,
      },
    });
  } catch (err) {
    next(err);
  }
});

router.get('/meta/clubs', async (_req, res, next) => {
  try {
    const clubs = await ClubVenue.find({
      isActive: true,
      isOrganizerAssign: { $ne: true },
    })
      .sort({ sortOrder: 1, label: 1 })
      .lean();
    res.json({
      ok: true,
      data: clubs.map((c) => ({
        id: String(c._id),
        label: formatVenueOptionLabel(c),
        name: c.label,
        address: c.address || '',
        scheduleNote: c.scheduleNote || '',
        region: c.region,
        isOrganizerAssign: c.isOrganizerAssign,
      })),
    });
  } catch (err) {
    next(err);
  }
});

router.get('/meta/eligibility', (req, res) => {
  const { captainDob, teammateDob, captainGender, teammateGender } = req.query;
  const ageGroups = eligibleAgeGroups(captainDob, teammateDob).map((value) => ({
    value,
    label: AGE_GROUP_LABELS[value],
  }));
  const eventCategories = eligibleEventCategories(
    captainGender,
    teammateGender
  ).map((value) => ({
    value,
    label: EVENT_CATEGORY_LABELS[value],
  }));
  res.json({ ok: true, data: { ageGroups, eventCategories } });
});

router.post('/rsvp', rsvpLimiter, async (req, res, next) => {
  try {
    const result = await createRsvp(req.body || {});
    if (!result.ok) {
      return res.status(result.status).json({
        ok: false,
        errors: result.errors,
      });
    }
    return res.status(result.status).json({ ok: true, data: result.data });
  } catch (err) {
    next(err);
  }
});

router.post(
  '/rsvp/:id/payment-proof',
  rsvpLimiter,
  optionalPaymentProof,
  async (req, res, next) => {
    try {
      if (!req.file) {
        return res.status(400).json({ ok: false, errors: ['請上載付款憑證'] });
      }
      const result = await attachPaymentProof(req.params.id, {
        proofUrl: publicProofPath(req.file),
        originalName: req.file.originalname || '',
      });
      if (!result.ok) {
        return res.status(result.status).json({ ok: false, errors: result.errors });
      }
      return res.json({ ok: true, data: result.data });
    } catch (err) {
      next(err);
    }
  }
);

module.exports = router;
