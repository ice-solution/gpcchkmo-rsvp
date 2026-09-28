const {
  AGE_GROUPS,
  EVENT_CATEGORIES,
  GENDERS,
  EVENT_YEAR,
  FEE,
} = require('../constants/enums');
const Player = require('../models/Player');
const Team = require('../models/Team');
const { TEAM_STATUS } = require('../constants/enums');

function ageOnEventYear(dateOfBirth, eventYear = EVENT_YEAR) {
  const dob = new Date(dateOfBirth);
  if (Number.isNaN(dob.getTime())) return null;
  // Age as of Dec 31 of event year (common tournament convention)
  const ref = new Date(eventYear, 11, 31);
  let age = ref.getFullYear() - dob.getFullYear();
  const m = ref.getMonth() - dob.getMonth();
  if (m < 0 || (m === 0 && ref.getDate() < dob.getDate())) age -= 1;
  return age;
}

function eligibleAgeGroups(dateOfBirth, partnerDob) {
  const a1 = ageOnEventYear(dateOfBirth);
  const a2 = ageOnEventYear(partnerDob);
  if (a1 == null || a2 == null) return [];

  const both = (min, max) => a1 >= min && a1 <= max && a2 >= min && a2 <= max;
  const out = [];
  if (both(50, 65)) out.push(AGE_GROUPS.SENIOR);
  if (both(36, 49)) out.push(AGE_GROUPS.MID);
  if (both(18, 65)) out.push(AGE_GROUPS.OPEN);
  return out;
}

function eligibleEventCategories(gender1, gender2) {
  const g1 = gender1;
  const g2 = gender2;
  const out = [];
  if (g1 === GENDERS.MALE && g2 === GENDERS.MALE) out.push(EVENT_CATEGORIES.MD);
  if (g1 === GENDERS.FEMALE && g2 === GENDERS.FEMALE) out.push(EVENT_CATEGORIES.WD);
  if (g1 !== g2) out.push(EVENT_CATEGORIES.XD);
  return out;
}

function validateAgeGroupSelection(ageGroup, captainDob, teammateDob) {
  const allowed = eligibleAgeGroups(captainDob, teammateDob);
  if (!allowed.includes(ageGroup)) {
    return {
      ok: false,
      message: '所選年齡組別與兩位球員出生日期不符，或其中一人未達該組年齡要求。',
    };
  }
  return { ok: true };
}

function validateEventCategory(eventCategory, captainGender, teammateGender) {
  const allowed = eligibleEventCategories(captainGender, teammateGender);
  if (!allowed.includes(eventCategory)) {
    return {
      ok: false,
      message: '所選競賽項目與兩位球員性別組合不符。',
    };
  }
  return { ok: true };
}

const ACTIVE_STATUSES = [
  TEAM_STATUS.SUBMITTED_PENDING_PAYMENT,
  TEAM_STATUS.PAID_PENDING_REVIEW,
  TEAM_STATUS.CONFIRMED,
];

/**
 * Each player may enter at most FEE.MAX_EVENTS_PER_PLAYER active registrations
 * (matched by email or WhatsApp across players on active teams).
 */
async function assertPlayerEventLimit({ email, whatsapp, excludeTeamId = null }) {
  const emailNorm = String(email || '').trim().toLowerCase();
  const phoneNorm = String(whatsapp || '').trim();

  const players = await Player.find({
    $or: [
      ...(emailNorm ? [{ email: emailNorm }] : []),
      ...(phoneNorm ? [{ whatsapp: phoneNorm }] : []),
    ],
  }).select('teamId');

  const teamIds = [...new Set(players.map((p) => String(p.teamId)))].filter(
    (id) => !excludeTeamId || id !== String(excludeTeamId)
  );

  if (!teamIds.length) return { ok: true, count: 0 };

  const count = await Team.countDocuments({
    _id: { $in: teamIds },
    status: { $in: ACTIVE_STATUSES },
  });

  if (count >= FEE.MAX_EVENTS_PER_PLAYER) {
    return {
      ok: false,
      count,
      message: `每位球員最多可報名 ${FEE.MAX_EVENTS_PER_PLAYER} 個競賽項目；系統已找到此球員的 ${count} 項有效報名。`,
    };
  }
  return { ok: true, count };
}

module.exports = {
  ageOnEventYear,
  eligibleAgeGroups,
  eligibleEventCategories,
  validateAgeGroupSelection,
  validateEventCategory,
  assertPlayerEventLimit,
};
