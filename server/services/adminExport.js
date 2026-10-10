const {
  AGE_GROUP_LABELS,
  EVENT_CATEGORY_LABELS,
  TEAM_STATUS_LABELS,
  PAYMENT_STATUS_LABELS,
  QUALIFICATION_STATUS_LABELS,
  PLAYER_ROLES,
  REGISTRATION_TYPES,
  PACK_TIER_LABELS,
  PACK_TIERS,
} = require('../constants/enums');

const REGISTRATION_TYPE_LABELS = {
  [REGISTRATION_TYPES.FIRST_OR_ONLY]: '第一個／唯一項目',
  [REGISTRATION_TYPES.SECOND_ADDITIONAL]: '第二個兼報項目',
};

function csvEscape(value) {
  const s = value == null ? '' : String(value);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function formatDate(d) {
  if (!d) return '';
  const dt = new Date(d);
  if (Number.isNaN(dt.getTime())) return '';
  return dt.toISOString().slice(0, 10);
}

function formatDateTime(d) {
  if (!d) return '';
  const dt = new Date(d);
  if (Number.isNaN(dt.getTime())) return '';
  return dt.toISOString().replace('T', ' ').slice(0, 19);
}

function buildTeamsCsv(teams, playersByTeamId) {
  const headers = [
    'applicationId',
    'teamCode',
    'status',
    'paymentStatus',
    'qualificationStatus',
    'registrationType',
    'displayName',
    'captainClub',
    'captainEmail',
    'ageGroup',
    'eventCategory',
    'preferredVenue',
    'qualifierSlot',
    'playerPack',
    'packTier',
    'paymentReference',
    'paymentProofUrl',
    'paymentProofLink',
    'availability',
    'submittedAt',
    'confirmedAt',
    'notes',
    'captainChineseName',
    'captainEnglishName',
    'captainGender',
    'captainDob',
    'captainWhatsapp',
    'captainEmergency',
    'teammateChineseName',
    'teammateEnglishName',
    'teammateGender',
    'teammateDob',
    'teammateWhatsapp',
    'teammateEmail',
    'teammateClub',
    'teammateEmergency',
    'carnivalIntent',
    'skillLevel',
    'hearAbout',
    'marketingConsent',
  ];

  const lines = [headers.join(',')];

  for (const team of teams) {
    const players = playersByTeamId.get(String(team._id)) || [];
    const captain = players.find((p) => p.role === PLAYER_ROLES.CAPTAIN) || {};
    const teammate = players.find((p) => p.role === PLAYER_ROLES.TEAMMATE) || {};
    const row = [
      team._id,
      team.teamCode || '',
      TEAM_STATUS_LABELS[team.status] || team.status,
      PAYMENT_STATUS_LABELS[team.payment?.status] || team.payment?.status || '',
      QUALIFICATION_STATUS_LABELS[team.qualificationStatus] || team.qualificationStatus,
      REGISTRATION_TYPE_LABELS[team.registrationType] || team.registrationType,
      team.displayName || '',
      team.captainClub,
      team.captainEmail,
      AGE_GROUP_LABELS[team.ageGroup] || team.ageGroup,
      EVENT_CATEGORY_LABELS[team.eventCategory] || team.eventCategory,
      team.preferredVenueLabel,
      team.qualifierSlotLabel || '',
      team.wantPlayerPack ? 'Y' : 'N',
      PACK_TIER_LABELS[team.packTier] ||
        team.packTier ||
        (team.wantPlayerPack ? PACK_TIER_LABELS[PACK_TIERS.ESSENTIAL] : PACK_TIER_LABELS[PACK_TIERS.STANDARD]),
      team.payment?.paymentReference || '',
      team.payment?.proofUrl || '',
      team.payment?.proofLink || '',
      (team.availability || []).join('|'),
      formatDateTime(team.submittedAt),
      formatDateTime(team.confirmedAt),
      team.notes || '',
      captain.chineseName || '',
      captain.englishName || '',
      captain.gender || '',
      formatDate(captain.dateOfBirth),
      captain.whatsapp || '',
      captain.emergencyContact
        ? `${captain.emergencyContact.name} / ${captain.emergencyContact.phone}`
        : '',
      teammate.chineseName || '',
      teammate.englishName || '',
      teammate.gender || '',
      formatDate(teammate.dateOfBirth),
      teammate.whatsapp || '',
      teammate.email || '',
      teammate.club || '',
      teammate.emergencyContact
        ? `${teammate.emergencyContact.name} / ${teammate.emergencyContact.phone}`
        : '',
      team.research?.carnivalIntent || '',
      team.research?.skillLevel || '',
      team.research?.hearAbout || '',
      team.agreements?.marketing ? 'Y' : 'N',
    ].map(csvEscape);
    lines.push(row.join(','));
  }

  return `\uFEFF${lines.join('\n')}`;
}

function nextTeamCode(seq) {
  const n = String(seq).padStart(4, '0');
  return `GPCC-HK-${n}`;
}

module.exports = {
  buildTeamsCsv,
  nextTeamCode,
  REGISTRATION_TYPE_LABELS,
  formatDate,
  formatDateTime,
};
