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
      Array.isArray(team.research?.hearAbout)
        ? team.research.hearAbout.join('|')
        : team.research?.hearAbout || '',
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

function teamRowsForExport(teams, playersByTeamId) {
  const rows = [];
  for (const team of teams) {
    const players = playersByTeamId.get(String(team._id)) || [];
    const captain = players.find((p) => p.role === PLAYER_ROLES.CAPTAIN) || {};
    const teammate = players.find((p) => p.role === PLAYER_ROLES.TEAMMATE) || {};
    rows.push({
      applicationId: String(team._id),
      teamCode: team.teamCode || '',
      status: TEAM_STATUS_LABELS[team.status] || team.status,
      paymentStatus:
        PAYMENT_STATUS_LABELS[team.payment?.status] || team.payment?.status || '',
      qualificationStatus:
        QUALIFICATION_STATUS_LABELS[team.qualificationStatus] ||
        team.qualificationStatus,
      displayName: team.displayName || '',
      captainClub: team.captainClub || '',
      captainEmail: team.captainEmail || '',
      ageGroup: AGE_GROUP_LABELS[team.ageGroup] || team.ageGroup || '',
      eventCategory:
        EVENT_CATEGORY_LABELS[team.eventCategory] || team.eventCategory || '',
      preferredVenue: team.preferredVenueLabel || '',
      qualifierSlot: team.qualifierSlotLabel || '',
      packTier:
        PACK_TIER_LABELS[team.packTier] ||
        team.packTier ||
        (team.wantPlayerPack
          ? PACK_TIER_LABELS[PACK_TIERS.ESSENTIAL]
          : PACK_TIER_LABELS[PACK_TIERS.STANDARD]),
      paymentReference: team.payment?.paymentReference || '',
      submittedAt: formatDateTime(team.submittedAt),
      captainChineseName: captain.chineseName || '',
      captainEnglishName: captain.englishName || '',
      captainGender: captain.gender || '',
      captainDob: formatDate(captain.dateOfBirth),
      captainWhatsapp: captain.whatsapp || '',
      captainEmergency: captain.emergencyContact
        ? `${captain.emergencyContact.name} / ${captain.emergencyContact.phone}`
        : '',
      teammateChineseName: teammate.chineseName || '',
      teammateEnglishName: teammate.englishName || '',
      teammateGender: teammate.gender || '',
      teammateDob: formatDate(teammate.dateOfBirth),
      teammateWhatsapp: teammate.whatsapp || '',
      teammateEmail: teammate.email || '',
      teammateClub: teammate.club || '',
      teammateEmergency: teammate.emergencyContact
        ? `${teammate.emergencyContact.name} / ${teammate.emergencyContact.phone}`
        : '',
    });
  }
  return rows;
}

async function buildTeamsXlsxBuffer(teams, playersByTeamId) {
  const ExcelJS = require('exceljs');
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'GPCC HK RSVP';
  workbook.created = new Date();
  const sheet = workbook.addWorksheet('報名名單');

  const columns = [
    { header: '申請編號', key: 'applicationId', width: 26 },
    { header: '隊伍編號', key: 'teamCode', width: 14 },
    { header: '報名狀態', key: 'status', width: 16 },
    { header: '付款狀態', key: 'paymentStatus', width: 14 },
    { header: '資格審核', key: 'qualificationStatus', width: 12 },
    { header: '隊伍／組名', key: 'displayName', width: 20 },
    { header: '邀請球會', key: 'captainClub', width: 28 },
    { header: '隊長電郵', key: 'captainEmail', width: 28 },
    { header: '年齡組別', key: 'ageGroup', width: 22 },
    { header: '競賽項目', key: 'eventCategory', width: 12 },
    { header: '首選場地', key: 'preferredVenue', width: 36 },
    { header: '預計海選時間', key: 'qualifierSlot', width: 28 },
    { header: '選手包', key: 'packTier', width: 28 },
    { header: '付款參考', key: 'paymentReference', width: 16 },
    { header: '提交時間', key: 'submittedAt', width: 20 },
    { header: '隊長中文名', key: 'captainChineseName', width: 12 },
    { header: '隊長英文名', key: 'captainEnglishName', width: 16 },
    { header: '隊長性別', key: 'captainGender', width: 8 },
    { header: '隊長出生日期', key: 'captainDob', width: 12 },
    { header: '隊長WhatsApp', key: 'captainWhatsapp', width: 14 },
    { header: '隊長緊急聯絡', key: 'captainEmergency', width: 22 },
    { header: '隊友中文名', key: 'teammateChineseName', width: 12 },
    { header: '隊友英文名', key: 'teammateEnglishName', width: 16 },
    { header: '隊友性別', key: 'teammateGender', width: 8 },
    { header: '隊友出生日期', key: 'teammateDob', width: 12 },
    { header: '隊友WhatsApp', key: 'teammateWhatsapp', width: 14 },
    { header: '隊友電郵', key: 'teammateEmail', width: 28 },
    { header: '隊友球會', key: 'teammateClub', width: 16 },
    { header: '隊友緊急聯絡', key: 'teammateEmergency', width: 22 },
  ];
  sheet.columns = columns;
  sheet.getRow(1).font = { bold: true };
  sheet.getRow(1).fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFE2E8F0' },
  };

  for (const row of teamRowsForExport(teams, playersByTeamId)) {
    sheet.addRow(row);
  }

  const buf = await workbook.xlsx.writeBuffer();
  return Buffer.from(buf);
}

module.exports = {
  buildTeamsCsv,
  buildTeamsXlsxBuffer,
  teamRowsForExport,
  nextTeamCode,
  REGISTRATION_TYPE_LABELS,
  formatDate,
  formatDateTime,
};
