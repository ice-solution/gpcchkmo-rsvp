const express = require('express');
const bcrypt = require('bcrypt');
const mongoose = require('mongoose');
const rateLimit = require('express-rate-limit');
const Admin = require('../models/Admin');
const Team = require('../models/Team');
const Player = require('../models/Player');
const ClubVenue = require('../models/ClubVenue');
const { formatVenueOptionLabel } = ClubVenue;
const AuditLog = require('../models/AuditLog');
const { requireAdmin } = require('../middleware/adminAuth');
const {
  TEAM_STATUS,
  TEAM_STATUS_LABELS,
  PAYMENT_STATUS,
  PAYMENT_STATUS_LABELS,
  QUALIFICATION_STATUS,
  QUALIFICATION_STATUS_LABELS,
  AGE_GROUP_LABELS,
  EVENT_CATEGORY_LABELS,
  EVENT_CATEGORIES,
  AGE_GROUPS,
  GENDERS,
  PLAYER_ROLES,
  CAPTAIN_CLUBS,
  PACK_TIERS,
  PACK_TIER_LABELS,
} = require('../constants/enums');
const {
  buildTeamsCsv,
  buildTeamsXlsxBuffer,
  nextTeamCode,
  REGISTRATION_TYPE_LABELS,
  formatDate,
  formatDateTime,
} = require('../services/adminExport');
const {
  airwallexPayUrl,
  normalizePackTier,
  buildPaymentSummary,
} = require('../services/paymentService');
const {
  notifyPaymentCompleted,
  sendConfirmationEmail,
  sendReminderEmail,
  previewReminderHtml,
  isMailConfigured,
} = require('../services/emailService');
const {
  readSubjects,
  writeSubjects,
  readTemplateHtml,
  writeTemplateHtml,
  listPlaceholders,
} = require('../services/emailTemplates');
const {
  loadReminderSlots,
  getReminderSlotById,
  findTeamsForSlot,
} = require('../services/reminderSlots');

function getPublicBaseUrl() {
  return String(process.env.DOMAIN || process.env.GPCCHKMO_DOMAIN || 'http://localhost:3480').replace(
    /\/$/,
    ''
  );
}

function teamPaymentLinks(team) {
  const base = getPublicBaseUrl();
  const id = String(team._id);
  const tier = normalizePackTier(team.packTier, team.wantPlayerPack);
  const summary = buildPaymentSummary({ packTier: tier });
  return {
    proofPayPageUrl: `${base}/rsvp/pay?id=${encodeURIComponent(id)}`,
    successPageUrl: `${base}/rsvp/success?id=${encodeURIComponent(id)}`,
    airwallexPayUrl: airwallexPayUrl(tier),
    packTier: tier,
    packTierLabel: PACK_TIER_LABELS[tier] || tier,
    feeTotal: summary.totalAmountHkd,
  };
}

const router = express.Router();

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
});

function buildAdminFilter({
  status,
  payment,
  qualification,
  ageGroup,
  eventCategory,
  club,
  venue,
  q,
}) {
  const filter = {};
  if (status) filter.status = status;
  if (payment) filter['payment.status'] = payment;
  if (qualification) filter.qualificationStatus = qualification;
  if (ageGroup) filter.ageGroup = ageGroup;
  if (eventCategory) filter.eventCategory = eventCategory;
  if (club) filter.captainClub = club;
  if (venue && String(venue).trim()) {
    const v = String(venue).trim();
    if (mongoose.isValidObjectId(v)) {
      filter.preferredVenueId = new mongoose.Types.ObjectId(v);
    } else {
      filter.preferredVenueLabel = v;
    }
  }
  if (q && String(q).trim()) {
    const re = new RegExp(String(q).trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    filter.$or = [
      { captainEmail: re },
      { captainClub: re },
      { displayName: re },
      { teamCode: re },
      { preferredVenueLabel: re },
    ];
  }
  return filter;
}

function queryString(filters, extra = {}) {
  const params = new URLSearchParams();
  const merged = { ...filters, ...extra };
  Object.entries(merged).forEach(([key, value]) => {
    if (value != null && String(value).trim() !== '') params.set(key, String(value));
  });
  const s = params.toString();
  return s ? `?${s}` : '';
}

function labels() {
  return {
    teamStatus: TEAM_STATUS_LABELS,
    paymentStatus: PAYMENT_STATUS_LABELS,
    qualificationStatus: QUALIFICATION_STATUS_LABELS,
    ageGroup: AGE_GROUP_LABELS,
    eventCategory: EVENT_CATEGORY_LABELS,
    registrationType: REGISTRATION_TYPE_LABELS,
    packTier: PACK_TIER_LABELS,
  };
}

router.get('/login', (req, res) => {
  if (req.session?.admin) return res.redirect('/admin');
  res.render('admin/login', {
    title: 'Admin 登入｜GPCC RSVP',
    error: req.query.error || '',
    next: req.query.next || '/admin',
  });
});

router.post('/login', loginLimiter, async (req, res) => {
  try {
    const username = String(req.body.username || '')
      .trim()
      .toLowerCase();
    const password = String(req.body.password || '');
    const nextUrl = req.body.next || '/admin';

    const admin = await Admin.findOne({ username, isActive: true });
    if (!admin || !(await bcrypt.compare(password, admin.passwordHash))) {
      return res.redirect(
        `/admin/login?error=${encodeURIComponent('帳號或密碼錯誤')}&next=${encodeURIComponent(nextUrl)}`
      );
    }

    req.session.admin = {
      id: String(admin._id),
      username: admin.username,
      displayName: admin.displayName,
      role: admin.role,
    };
    return res.redirect(nextUrl.startsWith('/admin') ? nextUrl : '/admin');
  } catch (err) {
    console.error(err);
    return res.redirect(`/admin/login?error=${encodeURIComponent('登入失敗，請稍後再試')}`);
  }
});

router.post('/logout', requireAdmin, (req, res) => {
  req.session.destroy(() => {
    res.redirect('/admin/login');
  });
});

router.get('/', requireAdmin, async (req, res, next) => {
  try {
    const {
      status = '',
      payment = '',
      qualification = '',
      ageGroup = '',
      eventCategory = '',
      club = '',
      venue = '',
      q = '',
      page = '1',
    } = req.query;

    const filters = { status, payment, qualification, ageGroup, eventCategory, club, venue, q };
    const filter = buildAdminFilter(filters);
    const filterWithoutClub = buildAdminFilter({ ...filters, club: '' });
    const filterWithoutVenue = buildAdminFilter({ ...filters, venue: '' });

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limit = 25;
    const skip = (pageNum - 1) * limit;

    const [total, teams, statusCounts, clubCountsRaw, venueCountsRaw, venues] = await Promise.all([
      Team.countDocuments(filter),
      Team.find(filter).sort({ captainClub: 1, submittedAt: -1 }).skip(skip).limit(limit).lean(),
      Team.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
      Team.aggregate([
        { $match: filterWithoutClub },
        { $group: { _id: '$captainClub', count: { $sum: 1 } } },
        { $sort: { count: -1, _id: 1 } },
      ]),
      Team.aggregate([
        { $match: filterWithoutVenue },
        {
          $group: {
            _id: '$preferredVenueId',
            count: { $sum: 1 },
            label: { $first: '$preferredVenueLabel' },
          },
        },
        { $sort: { count: -1 } },
      ]),
      ClubVenue.find({ isActive: true }).sort({ sortOrder: 1, label: 1 }).lean(),
    ]);

    const teamIds = teams.map((t) => t._id);
    const players = await Player.find({ teamId: { $in: teamIds } }).lean();
    const playersByTeam = new Map();
    for (const p of players) {
      const key = String(p.teamId);
      if (!playersByTeam.has(key)) playersByTeam.set(key, []);
      playersByTeam.get(key).push(p);
    }

    const rows = teams.map((team) => {
      const list = playersByTeam.get(String(team._id)) || [];
      const captain = list.find((p) => p.role === PLAYER_ROLES.CAPTAIN);
      const teammate = list.find((p) => p.role === PLAYER_ROLES.TEAMMATE);
      return { team, captain, teammate };
    });

    const counts = Object.fromEntries(
      Object.values(TEAM_STATUS).map((s) => [s, 0])
    );
    for (const row of statusCounts) {
      if (row._id) counts[row._id] = row.count;
    }

    const clubCountMap = new Map(
      clubCountsRaw.filter((row) => row._id).map((row) => [row._id, row.count])
    );
    const extraClubs = [...clubCountMap.keys()]
      .filter((name) => !CAPTAIN_CLUBS.includes(name))
      .sort((a, b) => a.localeCompare(b, 'zh-Hant'));
    const clubOptions = [
      ...CAPTAIN_CLUBS.map((name) => ({ name, count: clubCountMap.get(name) || 0 })),
      ...extraClubs.map((name) => ({ name, count: clubCountMap.get(name) || 0 })),
    ];

    const venueCountById = new Map(
      venueCountsRaw
        .filter((row) => row._id)
        .map((row) => [String(row._id), { count: row.count, label: row.label || '' }])
    );
    const venueLabelOnly = venueCountsRaw
      .filter((row) => !row._id && row.label)
      .map((row) => ({
        id: row.label,
        name: row.label,
        shortName: row.label,
        count: row.count,
      }));
    const venueOptions = [
      ...venues.map((v) => {
        const id = String(v._id);
        const counted = venueCountById.get(id);
        return {
          id,
          name: formatVenueOptionLabel(v),
          shortName: `${v.code ? `${v.code} ` : ''}${v.label}`.trim(),
          count: counted?.count || 0,
        };
      }),
      ...venueLabelOnly,
    ].filter((opt) => opt.count > 0 || venues.some((v) => String(v._id) === opt.id));

    const groupedRows = [];
    for (const row of rows) {
      const name = row.team.captainClub || '未填球會';
      const last = groupedRows[groupedRows.length - 1];
      if (!last || last.club !== name) {
        groupedRows.push({ club: name, rows: [row] });
      } else {
        last.rows.push(row);
      }
    }

    res.render('admin/teams', {
      title: '報名列表｜GPCC Admin',
      rows,
      groupedRows,
      clubOptions,
      venueOptions,
      filters,
      queryString: (extra) => queryString(filters, extra),
      labels: labels(),
      enums: {
        TEAM_STATUS,
        PAYMENT_STATUS,
        QUALIFICATION_STATUS,
      },
      counts,
      pagination: {
        page: pageNum,
        limit,
        total,
        pages: Math.max(1, Math.ceil(total / limit)),
      },
      flash: req.query.msg || '',
      formatDateTime,
    });
  } catch (err) {
    next(err);
  }
});

router.get('/teams/:id', requireAdmin, async (req, res, next) => {
  try {
    const team = await Team.findById(req.params.id).lean();
    if (!team) return res.status(404).send('找不到此報名');
    const players = await Player.find({ teamId: team._id }).sort({ role: 1 }).lean();
    const audits = await AuditLog.find({
      entityType: 'Team',
      entityId: team._id,
    })
      .sort({ createdAt: -1 })
      .limit(30)
      .lean();

    const GpcchkmoWonderPayment = require('../models/GpcchkmoWonderPayment');
    const wonderPayments = await GpcchkmoWonderPayment.find({ teamId: team._id })
      .sort({ createdAt: -1 })
      .limit(10)
      .lean();

    const paymentLinks = teamPaymentLinks(team);
    res.render('admin/team-detail', {
      title: `報名詳情｜${team.teamCode || team._id}`,
      team,
      players,
      audits,
      wonderPayments,
      paymentLinks,
      mailConfigured: isMailConfigured(),
      labels: labels(),
      enums: {
        TEAM_STATUS,
        PAYMENT_STATUS,
        QUALIFICATION_STATUS,
        AGE_GROUPS,
        EVENT_CATEGORIES,
        GENDERS,
        PACK_TIERS,
      },
      flash: req.query.msg || '',
      formatDate,
      formatDateTime,
      PLAYER_ROLES,
    });
  } catch (err) {
    next(err);
  }
});

router.post('/teams/:id/email/confirmation', requireAdmin, async (req, res, next) => {
  try {
    const team = await Team.findById(req.params.id);
    if (!team) return res.status(404).send('找不到此報名');
    const customMessage = String(req.body.customMessage || '').trim();
    const result = await sendConfirmationEmail(team, { customMessage });
    await AuditLog.create({
      entityType: 'Team',
      entityId: team._id,
      action: 'email_confirmation_sent',
      actor: req.session?.admin?.username || 'admin',
      meta: {
        ok: Boolean(result.ok),
        skipped: Boolean(result.skipped),
        reason: result.reason || null,
        error: result.error || null,
        messageId: result.messageId || null,
      },
    });
    const msg = result.ok
      ? '確認電郵已發送'
      : result.skipped
        ? `未能發送：${result.reason === 'mail_not_configured' ? '請先在 .env 設定 GMAIL_USER / GMAIL_APP_PASSWORD' : result.reason}`
        : `發送失敗：${result.error || '未知錯誤'}`;
    res.redirect(`/admin/teams/${team._id}?msg=${encodeURIComponent(msg)}`);
  } catch (err) {
    next(err);
  }
});

router.post('/teams/:id/email/reminder', requireAdmin, async (req, res, next) => {
  try {
    const team = await Team.findById(req.params.id);
    if (!team) return res.status(404).send('找不到此報名');
    const customMessage = String(req.body.customMessage || '').trim();
    const result = await sendReminderEmail(team, { customMessage });
    await AuditLog.create({
      entityType: 'Team',
      entityId: team._id,
      action: 'email_reminder_sent',
      actor: req.session?.admin?.username || 'admin',
      meta: {
        ok: Boolean(result.ok),
        skipped: Boolean(result.skipped),
        reason: result.reason || null,
        error: result.error || null,
        messageId: result.messageId || null,
      },
    });
    const msg = result.ok
      ? '提醒電郵已發送'
      : result.skipped
        ? `未能發送：${result.reason === 'mail_not_configured' ? '請先在 .env 設定 GMAIL_USER / GMAIL_APP_PASSWORD' : result.reason}`
        : `發送失敗：${result.error || '未知錯誤'}`;
    res.redirect(`/admin/teams/${team._id}?msg=${encodeURIComponent(msg)}`);
  } catch (err) {
    next(err);
  }
});

router.get('/email-templates', requireAdmin, (req, res) => {
  const subjects = readSubjects();
  res.render('admin/email-templates', {
    title: '電郵範本｜GPCC Admin',
    mailConfigured: isMailConfigured(),
    subjects,
    confirmationHtml: readTemplateHtml('confirmation'),
    reminderHtml: readTemplateHtml('reminder'),
    placeholders: listPlaceholders(),
    flash: req.query.msg || '',
  });
});

router.post('/email-templates', requireAdmin, (req, res, next) => {
  try {
    const kind = String(req.body.kind || '').trim();
    if (kind !== 'confirmation' && kind !== 'reminder') {
      return res.redirect(
        `/admin/email-templates?msg=${encodeURIComponent('未知範本類型')}`
      );
    }
    writeTemplateHtml(kind, req.body.html || '');
    const subjects = readSubjects();
    subjects[kind] = String(req.body.subject || subjects[kind] || '').trim() || subjects[kind];
    writeSubjects(subjects);
    const label = kind === 'confirmation' ? '確認電郵' : '提醒電郵';
    res.redirect(
      `/admin/email-templates?msg=${encodeURIComponent(`${label}範本已儲存`)}`
    );
  } catch (err) {
    next(err);
  }
});

router.get('/email-reminder-batch', requireAdmin, async (req, res, next) => {
  try {
    const slots = loadReminderSlots();
    const slotId = String(req.query.slot || '').trim();
    const slot = slotId ? getReminderSlotById(slotId) : null;
    let matched = [];
    let preview = null;
    if (slot) {
      const teams = await Team.find({
        preferredVenueLabel: { $exists: true, $ne: '' },
      })
        .sort({ submittedAt: -1 })
        .lean();
      matched = findTeamsForSlot(teams, slot);
      preview = previewReminderHtml(slot);
    }
    res.render('admin/email-reminder-batch', {
      title: '批次提醒電郵｜GPCC Admin',
      mailConfigured: isMailConfigured(),
      slots,
      selectedSlotId: slotId,
      slot,
      matched,
      preview,
      flash: req.query.msg || '',
      labels: labels(),
    });
  } catch (err) {
    next(err);
  }
});

router.post('/email-reminder-batch', requireAdmin, async (req, res, next) => {
  try {
    const slotId = String(req.body.slot || '').trim();
    const slot = getReminderSlotById(slotId);
    if (!slot) {
      return res.redirect(
        `/admin/email-reminder-batch?msg=${encodeURIComponent('請選擇海選時段')}`
      );
    }
    if (!isMailConfigured()) {
      return res.redirect(
        `/admin/email-reminder-batch?slot=${encodeURIComponent(slotId)}&msg=${encodeURIComponent('請先設定 GMAIL_USER / GMAIL_APP_PASSWORD')}`
      );
    }

    const selectedIds = [].concat(req.body.teamIds || []).map(String).filter(Boolean);
    const teams = await Team.find({
      preferredVenueLabel: { $exists: true, $ne: '' },
    }).lean();
    let matched = findTeamsForSlot(teams, slot);
    if (selectedIds.length) {
      matched = matched.filter((t) => selectedIds.includes(String(t._id)));
    }

    let sent = 0;
    let failed = 0;
    const errors = [];
    for (const teamDoc of matched) {
      const team = await Team.findById(teamDoc._id);
      if (!team) continue;
      const result = await sendReminderEmail(team, { slot });
      await AuditLog.create({
        entityType: 'Team',
        entityId: team._id,
        action: 'email_reminder_batch_sent',
        actor: req.session?.admin?.username || 'admin',
        meta: {
          slotId: slot.id,
          slotLabel: slot.slotLabel,
          ok: Boolean(result.ok),
          skipped: Boolean(result.skipped),
          reason: result.reason || null,
          error: result.error || null,
          messageId: result.messageId || null,
        },
      });
      if (result.ok) sent += 1;
      else {
        failed += 1;
        errors.push(`${team.captainEmail || team._id}: ${result.error || result.reason}`);
      }
      // gentle pace for Gmail
      await new Promise((r) => setTimeout(r, 400));
    }

    const msg = `已發送 ${sent} 封提醒電郵${failed ? `；失敗 ${failed}` : ''}${
      errors.length ? `（${errors.slice(0, 3).join('；')}）` : ''
    }`;
    res.redirect(
      `/admin/email-reminder-batch?slot=${encodeURIComponent(slotId)}&msg=${encodeURIComponent(msg)}`
    );
  } catch (err) {
    next(err);
  }
});

router.post('/teams/:id/edit', requireAdmin, async (req, res, next) => {
  try {
    const team = await Team.findById(req.params.id);
    if (!team) return res.status(404).send('找不到此報名');

    const before = team.toObject();
    const {
      displayName,
      captainClub,
      captainEmail,
      ageGroup,
      eventCategory,
      preferredVenueLabel,
      qualifierSlotLabel,
      packTier,
      captainId,
      teammateId,
      captainChineseName,
      captainEnglishName,
      captainGender,
      captainDob,
      captainWhatsapp,
      captainEmailPlayer,
      captainClubPlayer,
      captainEmergencyName,
      captainEmergencyPhone,
      teammateChineseName,
      teammateEnglishName,
      teammateGender,
      teammateDob,
      teammateWhatsapp,
      teammateEmail,
      teammateClub,
      teammateEmergencyName,
      teammateEmergencyPhone,
    } = req.body;

    if (typeof displayName === 'string' && displayName.trim()) {
      team.displayName = displayName.trim();
    }
    if (typeof captainClub === 'string' && captainClub.trim()) {
      team.captainClub = captainClub.trim();
    }
    if (typeof captainEmail === 'string' && captainEmail.trim()) {
      team.captainEmail = captainEmail.trim().toLowerCase();
    }
    if (ageGroup && Object.values(AGE_GROUPS).includes(ageGroup)) {
      team.ageGroup = ageGroup;
    }
    if (eventCategory && Object.values(EVENT_CATEGORIES).includes(eventCategory)) {
      team.eventCategory = eventCategory;
    }
    if (typeof preferredVenueLabel === 'string') {
      team.preferredVenueLabel = preferredVenueLabel.trim();
    }
    if (typeof qualifierSlotLabel === 'string') {
      team.qualifierSlotLabel = qualifierSlotLabel.trim();
    }
    if (packTier && Object.values(PACK_TIERS).includes(packTier)) {
      team.packTier = packTier;
      team.wantPlayerPack = packTier !== PACK_TIERS.STANDARD;
    }

    await team.save();

    async function updatePlayer(playerId, fields) {
      if (!playerId) return;
      const player = await Player.findOne({ _id: playerId, teamId: team._id });
      if (!player) return;
      if (fields.chineseName) player.chineseName = fields.chineseName.trim();
      if (fields.englishName) player.englishName = fields.englishName.trim();
      if (fields.gender && Object.values(GENDERS).includes(fields.gender)) {
        player.gender = fields.gender;
      }
      if (fields.dateOfBirth) {
        const d = new Date(fields.dateOfBirth);
        if (!Number.isNaN(d.getTime())) player.dateOfBirth = d;
      }
      if (fields.whatsapp) player.whatsapp = fields.whatsapp.trim();
      if (fields.email) player.email = fields.email.trim().toLowerCase();
      if (typeof fields.club === 'string') player.club = fields.club.trim();
      if (fields.emergencyName || fields.emergencyPhone) {
        player.emergencyContact = {
          name: (fields.emergencyName || player.emergencyContact?.name || '').trim(),
          phone: (fields.emergencyPhone || player.emergencyContact?.phone || '').trim(),
        };
      }
      await player.save();
    }

    await updatePlayer(captainId, {
      chineseName: captainChineseName,
      englishName: captainEnglishName,
      gender: captainGender,
      dateOfBirth: captainDob,
      whatsapp: captainWhatsapp,
      email: captainEmailPlayer,
      club: captainClubPlayer,
      emergencyName: captainEmergencyName,
      emergencyPhone: captainEmergencyPhone,
    });
    await updatePlayer(teammateId, {
      chineseName: teammateChineseName,
      englishName: teammateEnglishName,
      gender: teammateGender,
      dateOfBirth: teammateDob,
      whatsapp: teammateWhatsapp,
      email: teammateEmail,
      club: teammateClub,
      emergencyName: teammateEmergencyName,
      emergencyPhone: teammateEmergencyPhone,
    });

    await AuditLog.create({
      action: 'admin.team.edit',
      entityType: 'Team',
      entityId: team._id,
      actor: req.session.admin.username,
      meta: {
        before: {
          displayName: before.displayName,
          captainClub: before.captainClub,
          captainEmail: before.captainEmail,
          ageGroup: before.ageGroup,
          eventCategory: before.eventCategory,
          packTier: before.packTier,
        },
        after: {
          displayName: team.displayName,
          captainClub: team.captainClub,
          captainEmail: team.captainEmail,
          ageGroup: team.ageGroup,
          eventCategory: team.eventCategory,
          packTier: team.packTier,
        },
      },
    });

    res.redirect(
      `/admin/teams/${team._id}?msg=${encodeURIComponent('報名資料已儲存')}`
    );
  } catch (err) {
    next(err);
  }
});

router.post('/teams/:id/update', requireAdmin, async (req, res, next) => {
  try {
    const team = await Team.findById(req.params.id);
    if (!team) return res.status(404).send('找不到此報名');

    const {
      status,
      paymentStatus,
      qualificationStatus,
      notes,
      teamCode,
      assignTeamCode,
    } = req.body;

    const before = {
      status: team.status,
      paymentStatus: team.payment?.status,
      qualificationStatus: team.qualificationStatus,
      teamCode: team.teamCode,
    };

    if (status && Object.values(TEAM_STATUS).includes(status)) {
      team.status = status;
      if (status === TEAM_STATUS.CONFIRMED && !team.confirmedAt) {
        team.confirmedAt = new Date();
      }
    }
    if (paymentStatus && Object.values(PAYMENT_STATUS).includes(paymentStatus)) {
      team.payment = team.payment || {};
      team.payment.status = paymentStatus;
      if (paymentStatus === PAYMENT_STATUS.PAID && !team.payment.paidAt) {
        team.payment.paidAt = new Date();
      }
      // Align application status when admin marks payment as paid
      if (
        paymentStatus === PAYMENT_STATUS.PAID &&
        (team.status === TEAM_STATUS.SUBMITTED_PENDING_PAYMENT ||
          team.status === TEAM_STATUS.MANUAL_PENDING_PAYMENT ||
          team.status === TEAM_STATUS.PAYMENT_FAILED)
      ) {
        team.status = TEAM_STATUS.PAID_PENDING_REVIEW;
      }
    }
    if (
      qualificationStatus &&
      Object.values(QUALIFICATION_STATUS).includes(qualificationStatus)
    ) {
      team.qualificationStatus = qualificationStatus;
    }
    if (typeof notes === 'string') team.notes = notes.trim();

    if (assignTeamCode === '1' && !team.teamCode) {
      const confirmedCount = await Team.countDocuments({
        teamCode: { $exists: true, $ne: null },
      });
      team.teamCode = nextTeamCode(confirmedCount + 1);
    } else if (typeof teamCode === 'string' && teamCode.trim()) {
      team.teamCode = teamCode.trim().toUpperCase();
    }

    await team.save();

    await AuditLog.create({
      action: 'admin.team.update',
      entityType: 'Team',
      entityId: team._id,
      actor: req.session.admin.username,
      meta: { before, after: req.body },
    });

    const becamePaid =
      before.paymentStatus !== PAYMENT_STATUS.PAID &&
      team.payment?.status === PAYMENT_STATUS.PAID;
    if (becamePaid) {
      await notifyPaymentCompleted(team);
    }

    res.redirect(
      `/admin/teams/${team._id}?msg=${encodeURIComponent('已更新')}`
    );
  } catch (err) {
    if (err?.code === 11000) {
      return res.redirect(
        `/admin/teams/${req.params.id}?msg=${encodeURIComponent('隊伍編號重複，請另設')}`
      );
    }
    next(err);
  }
});

router.get('/export.csv', requireAdmin, async (req, res, next) => {
  try {
    const {
      status = '',
      payment = '',
      qualification = '',
      club = '',
      venue = '',
      q = '',
    } = req.query;
    const filter = buildAdminFilter({ status, payment, qualification, club, venue, q });

    const teams = await Team.find(filter).sort({ submittedAt: -1 }).lean();
    const players = await Player.find({
      teamId: { $in: teams.map((t) => t._id) },
    }).lean();
    const playersByTeamId = new Map();
    for (const p of players) {
      const key = String(p.teamId);
      if (!playersByTeamId.has(key)) playersByTeamId.set(key, []);
      playersByTeamId.get(key).push(p);
    }

    const csv = buildTeamsCsv(teams, playersByTeamId);
    const filename = `gpcc-rsvp-${new Date().toISOString().slice(0, 10)}.csv`;
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(csv);
  } catch (err) {
    next(err);
  }
});

router.get('/export.xlsx', requireAdmin, async (req, res, next) => {
  try {
    const {
      status = '',
      payment = '',
      qualification = '',
      club = '',
      venue = '',
      q = '',
    } = req.query;
    const filter = buildAdminFilter({ status, payment, qualification, club, venue, q });

    const teams = await Team.find(filter).sort({ submittedAt: -1 }).lean();
    const players = await Player.find({
      teamId: { $in: teams.map((t) => t._id) },
    }).lean();
    const playersByTeamId = new Map();
    for (const p of players) {
      const key = String(p.teamId);
      if (!playersByTeamId.has(key)) playersByTeamId.set(key, []);
      playersByTeamId.get(key).push(p);
    }

    const buf = await buildTeamsXlsxBuffer(teams, playersByTeamId);
    const filename = `gpcc-rsvp-${new Date().toISOString().slice(0, 10)}.xlsx`;
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${filename}"; filename*=UTF-8''${encodeURIComponent(filename)}`
    );
    res.send(buf);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
