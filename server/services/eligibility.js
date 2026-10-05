const {
  AGE_GROUP_DOB_RANGES,
  EVENT_CATEGORIES,
  GENDERS,
  FEE,
  TEAM_STATUS,
} = require('../constants/enums');
const Player = require('../models/Player');
const Team = require('../models/Team');

function toDateOnly(value) {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

function inDobRange(dateOfBirth, startIso, endIso) {
  const dob = toDateOnly(dateOfBirth);
  const start = toDateOnly(startIso);
  const end = toDateOnly(endIso);
  if (!dob || !start || !end) return false;
  return dob >= start && dob <= end;
}

function eligibleAgeGroups(dateOfBirth, partnerDob) {
  if (!dateOfBirth || !partnerDob) return [];
  const out = [];
  for (const [group, range] of Object.entries(AGE_GROUP_DOB_RANGES)) {
    if (inDobRange(dateOfBirth, range.start, range.end) && inDobRange(partnerDob, range.start, range.end)) {
      out.push(group);
    }
  }
  return out;
}

function eligibleEventCategories(gender1, gender2) {
  const out = [];
  if (gender1 === GENDERS.MALE && gender2 === GENDERS.MALE) out.push(EVENT_CATEGORIES.MD);
  if (gender1 === GENDERS.FEMALE && gender2 === GENDERS.FEMALE) out.push(EVENT_CATEGORIES.WD);
  if (gender1 && gender2 && gender1 !== gender2) out.push(EVENT_CATEGORIES.XD);
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
  TEAM_STATUS.MANUAL_PENDING_PAYMENT,
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
  eligibleAgeGroups,
  eligibleEventCategories,
  validateAgeGroupSelection,
  validateEventCategory,
  assertPlayerEventLimit,
};
