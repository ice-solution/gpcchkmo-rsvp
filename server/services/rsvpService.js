const mongoose = require('mongoose');
const Team = require('../models/Team');
const Player = require('../models/Player');
const ClubVenue = require('../models/ClubVenue');
const { formatVenueOptionLabel } = ClubVenue;
const AuditLog = require('../models/AuditLog');
const {
  TEAM_STATUS,
  PAYMENT_STATUS,
  QUALIFICATION_STATUS,
  PLAYER_ROLES,
  REGISTRATION_TYPES,
  AGE_GROUPS,
  EVENT_CATEGORIES,
  GENDERS,
  FEE,
  CAPTAIN_CLUBS,
  CAPTAIN_CLUB_OTHER_VALUE,
  PACK_TIERS,
} = require('../constants/enums');
const {
  validateAgeGroupSelection,
  validateEventCategory,
  assertPlayerEventLimit,
} = require('./eligibility');
const { sendSubmissionReceipt } = require('./emailService');
const {
  buildPaymentSummary,
  createManualPaymentReference,
  normalizePackTier,
} = require('./paymentService');
const { isPaymentGatewayEnabled } = require('../config/paymentGateway');

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function requireString(value, label) {
  if (typeof value !== 'string' || !value.trim()) {
    return `${label}為必填`;
  }
  return null;
}

function validatePayload(body) {
  const errors = [];

  const push = (msg) => {
    if (msg) errors.push(msg);
  };

  push(requireString(body.captainClub, '隊長所屬球會／機構'));
  let resolvedCaptainClub = String(body.captainClub || '').trim();
  if (resolvedCaptainClub === CAPTAIN_CLUB_OTHER_VALUE || resolvedCaptainClub === '其他') {
    const other = String(body.captainClubOther || '').trim();
    if (!other) {
      errors.push('請填寫「其他」球會／機構名稱');
    } else {
      resolvedCaptainClub = other;
    }
  } else if (resolvedCaptainClub && !CAPTAIN_CLUBS.includes(resolvedCaptainClub)) {
    errors.push('隊長所屬球會／機構選項無效');
  }
  // Stash resolved value for createRsvp persistence
  body.captainClub = resolvedCaptainClub;
  if (!Object.values(REGISTRATION_TYPES).includes(body.registrationType)) {
    errors.push('報名類型無效');
  }
  push(requireString(body.captainEmail, '隊長電郵'));
  if (body.captainEmail && !EMAIL_RE.test(body.captainEmail)) {
    errors.push('隊長電郵格式不正確');
  }

  const captain = body.captain || {};
  const teammate = body.teammate || {};

  [
    [captain.chineseName, '隊長中文姓名'],
    [captain.englishName, '隊長英文姓名'],
    [captain.whatsapp, '隊長 WhatsApp'],
    [captain.dateOfBirth, '隊長出生日期'],
    [teammate.chineseName, '隊友中文姓名'],
    [teammate.englishName, '隊友英文姓名'],
    [teammate.whatsapp, '隊友 WhatsApp'],
    [teammate.email, '隊友電郵'],
    [teammate.dateOfBirth, '隊友出生日期'],
  ].forEach(([v, label]) => push(requireString(v, label)));

  if (!Object.values(GENDERS).includes(captain.gender)) errors.push('隊長性別無效');
  if (!Object.values(GENDERS).includes(teammate.gender)) errors.push('隊友性別無效');
  if (teammate.email && !EMAIL_RE.test(teammate.email)) errors.push('隊友電郵格式不正確');

  if (!captain.emergencyContact?.name || !captain.emergencyContact?.phone) {
    errors.push('隊長緊急聯絡人姓名及電話為必填');
  }
  if (!teammate.emergencyContact?.name || !teammate.emergencyContact?.phone) {
    errors.push('隊友緊急聯絡人姓名及電話為必填');
  }

  if (!Object.values(AGE_GROUPS).includes(body.ageGroup)) errors.push('年齡組別無效');
  if (!Object.values(EVENT_CATEGORIES).includes(body.eventCategory)) errors.push('競賽項目無效');
  push(requireString(body.preferredVenueLabel || body.preferredVenueId, '首選海選地區／球館'));

  if (!Array.isArray(body.availability) || body.availability.length === 0) {
    errors.push('請至少選擇一個可參賽時段');
  }

  const research = body.research || {};
  push(requireString(research.carnivalIntent, '嘉年華出席意向'));
  push(requireString(research.skillLevel, '技術程度'));
  push(requireString(research.hearAbout, '得知渠道'));
  if (!Array.isArray(research.interests) || research.interests.length === 0) {
    errors.push('請至少選擇一項感興趣的 GPCC 內容');
  }

  const agreements = body.agreements || {};
  ['rules', 'ranking', 'truthfulness', 'pics'].forEach((key) => {
    if (agreements[key] !== true) errors.push('請確認所有必填聲明及條款');
  });

  if (body.introAcknowledged !== true) {
    errors.push('請先閱讀並確認表格簡介及賽事資訊');
  }

  const packTier = normalizePackTier(body.packTier, body.wantPlayerPack);
  if (!Object.values(PACK_TIERS).includes(packTier)) {
    errors.push('請選擇選手包套裝級別');
  }
  body.packTier = packTier;

  return errors;
}

async function createRsvp(body) {
  const errors = validatePayload(body);
  if (errors.length) {
    return { ok: false, status: 400, errors };
  }

  const ageCheck = validateAgeGroupSelection(
    body.ageGroup,
    body.captain.dateOfBirth,
    body.teammate.dateOfBirth
  );
  if (!ageCheck.ok) return { ok: false, status: 400, errors: [ageCheck.message] };

  const eventCheck = validateEventCategory(
    body.eventCategory,
    body.captain.gender,
    body.teammate.gender
  );
  if (!eventCheck.ok) return { ok: false, status: 400, errors: [eventCheck.message] };

  const captainLimit = await assertPlayerEventLimit({
    email: body.captainEmail,
    whatsapp: body.captain.whatsapp,
  });
  if (!captainLimit.ok) {
    return { ok: false, status: 409, errors: [`隊長：${captainLimit.message}`] };
  }

  const teammateLimit = await assertPlayerEventLimit({
    email: body.teammate.email,
    whatsapp: body.teammate.whatsapp,
  });
  if (!teammateLimit.ok) {
    return { ok: false, status: 409, errors: [`隊友：${teammateLimit.message}`] };
  }

  let preferredVenueLabel = (body.preferredVenueLabel || '').trim();
  let preferredVenueId = null;
  if (body.preferredVenueId && mongoose.isValidObjectId(body.preferredVenueId)) {
    const venue = await ClubVenue.findById(body.preferredVenueId);
    if (venue) {
      preferredVenueId = venue._id;
      preferredVenueLabel = formatVenueOptionLabel(venue);
    }
  }
  if (!preferredVenueLabel) {
    return { ok: false, status: 400, errors: ['首選海選地區／球館無效'] };
  }

  const packTier = normalizePackTier(body.packTier, body.wantPlayerPack);
  const paymentSummary = buildPaymentSummary({ packTier });
  const captainEmail = body.captainEmail.trim().toLowerCase();
  const gatewayOn = isPaymentGatewayEnabled();
  const uploadedProofPath = String(body.paymentProofFileUrl || '').trim();

  // Standalone MongoDB (non-replica-set) does not support multi-doc transactions.
  const team = await Team.create({
    displayName: (body.displayName || '').trim(),
    captainClub: body.captainClub.trim(),
    captainEmail,
    registrationType: body.registrationType,
    ageGroup: body.ageGroup,
    eventCategory: body.eventCategory,
    preferredVenueId,
    preferredVenueLabel,
    availability: body.availability,
    packTier,
    wantPlayerPack: packTier !== PACK_TIERS.STANDARD,
    research: {
      carnivalIntent: body.research.carnivalIntent,
      spectatorCount: body.research.spectatorCount || '',
      skillLevel: body.research.skillLevel,
      interests: body.research.interests,
      hearAbout: body.research.hearAbout,
      contactPrefs: Array.isArray(body.research.contactPrefs)
        ? body.research.contactPrefs
        : [],
    },
    agreements: {
      rules: true,
      ranking: true,
      truthfulness: true,
      pics: true,
      marketing: body.agreements.marketing === true,
    },
    introAcknowledged: true,
    introAcknowledgedAt: new Date(),
    status: gatewayOn
      ? TEAM_STATUS.SUBMITTED_PENDING_PAYMENT
      : TEAM_STATUS.MANUAL_PENDING_PAYMENT,
    payment: {
      status: gatewayOn ? PAYMENT_STATUS.UNPAID : PAYMENT_STATUS.PENDING_MANUAL,
      method: gatewayOn ? null : 'airwallex',
      baseAmountHkd: paymentSummary.baseAmountHkd,
      feeAmountHkd: paymentSummary.feeAmountHkd,
      totalAmountHkd: paymentSummary.totalAmountHkd,
      currency: paymentSummary.currency,
      proofUrl: uploadedProofPath || null,
      proofLink: null,
      proofOriginalName: body.paymentProofOriginalName || null,
    },
    qualificationStatus: QUALIFICATION_STATUS.PENDING,
    submittedAt: new Date(),
  });

  if (!gatewayOn) {
    const manualRef = await createManualPaymentReference(team);
    team.payment.paymentReference = manualRef.paymentReference;
    team.markModified('payment');
    await team.save();
  }

  try {
    const players = await Player.create([
      {
        teamId: team._id,
        role: PLAYER_ROLES.CAPTAIN,
        chineseName: body.captain.chineseName.trim(),
        englishName: body.captain.englishName.trim(),
        gender: body.captain.gender,
        dateOfBirth: new Date(body.captain.dateOfBirth),
        whatsapp: body.captain.whatsapp.trim(),
        email: captainEmail,
        club: body.captainClub.trim(),
        emergencyContact: {
          name: body.captain.emergencyContact.name.trim(),
          phone: body.captain.emergencyContact.phone.trim(),
        },
      },
      {
        teamId: team._id,
        role: PLAYER_ROLES.TEAMMATE,
        chineseName: body.teammate.chineseName.trim(),
        englishName: body.teammate.englishName.trim(),
        gender: body.teammate.gender,
        dateOfBirth: new Date(body.teammate.dateOfBirth),
        whatsapp: body.teammate.whatsapp.trim(),
        email: body.teammate.email.trim().toLowerCase(),
        club: (body.teammate.club || '').trim(),
        emergencyContact: {
          name: body.teammate.emergencyContact.name.trim(),
          phone: body.teammate.emergencyContact.phone.trim(),
        },
      },
    ]);

    await AuditLog.create({
      action: 'rsvp.submitted',
      entityType: 'Team',
      entityId: team._id,
      actor: captainEmail,
      meta: {
        eventCategory: team.eventCategory,
        ageGroup: team.ageGroup,
        feeBase: FEE.BASE_HKD,
      },
    });

    const captain = players.find((p) => p.role === PLAYER_ROLES.CAPTAIN);
    const teammate = players.find((p) => p.role === PLAYER_ROLES.TEAMMATE);
    await sendSubmissionReceipt({ team, captain, teammate });

    return {
      ok: true,
      status: 201,
      data: {
        applicationId: String(team._id),
        status: team.status,
        paymentGatewayEnabled: gatewayOn,
        payment: paymentSummary,
        message: gatewayOn
          ? '已收到報名申請。請完成付款及等候資格核實；此階段尚未等同報名成功，亦不會發放隊伍編號或 QR Code。'
          : '已收到報名申請（人工待付）。請完成轉數快／銀行轉賬並提交付款憑證；此階段尚未等同報名成功。',
      },
    };
  } catch (err) {
    await Player.deleteMany({ teamId: team._id }).catch(() => {});
    await Team.deleteOne({ _id: team._id }).catch(() => {});
    throw err;
  }
}

async function attachPaymentProof(teamId, { proofUrl, originalName }) {
  if (!mongoose.isValidObjectId(teamId)) {
    return { ok: false, status: 400, errors: ['申請編號無效'] };
  }
  if (!proofUrl) {
    return { ok: false, status: 400, errors: ['請上載付款憑證'] };
  }
  const team = await Team.findById(teamId);
  if (!team) {
    return { ok: false, status: 404, errors: ['找不到報名申請'] };
  }
  if (team.payment?.status === PAYMENT_STATUS.PAID) {
    return { ok: false, status: 409, errors: ['此申請已付款'] };
  }
  team.payment = team.payment || {};
  team.payment.proofUrl = proofUrl;
  team.payment.proofOriginalName = originalName || null;
  team.markModified('payment');
  await team.save();
  await AuditLog.create({
    action: 'rsvp.payment_proof',
    entityType: 'Team',
    entityId: team._id,
    actor: team.captainEmail,
    meta: { proofUrl },
  });
  return { ok: true, status: 200, data: { proofUrl } };
}

module.exports = {
  createRsvp,
  attachPaymentProof,
  validatePayload,
};
