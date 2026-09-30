const express = require('express');
const bcrypt = require('bcrypt');
const rateLimit = require('express-rate-limit');
const Admin = require('../models/Admin');
const Team = require('../models/Team');
const Player = require('../models/Player');
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
  PLAYER_ROLES,
} = require('../constants/enums');
const {
  buildTeamsCsv,
  nextTeamCode,
  REGISTRATION_TYPE_LABELS,
  formatDate,
  formatDateTime,
} = require('../services/adminExport');

const router = express.Router();

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
});

function labels() {
  return {
    teamStatus: TEAM_STATUS_LABELS,
    paymentStatus: PAYMENT_STATUS_LABELS,
    qualificationStatus: QUALIFICATION_STATUS_LABELS,
    ageGroup: AGE_GROUP_LABELS,
    eventCategory: EVENT_CATEGORY_LABELS,
    registrationType: REGISTRATION_TYPE_LABELS,
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
      q = '',
      page = '1',
    } = req.query;

    const filter = {};
    if (status) filter.status = status;
    if (payment) filter['payment.status'] = payment;
    if (qualification) filter.qualificationStatus = qualification;
    if (ageGroup) filter.ageGroup = ageGroup;
    if (eventCategory) filter.eventCategory = eventCategory;
    if (q.trim()) {
      const re = new RegExp(q.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      filter.$or = [
        { captainEmail: re },
        { captainClub: re },
        { displayName: re },
        { teamCode: re },
        { preferredVenueLabel: re },
      ];
    }

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limit = 25;
    const skip = (pageNum - 1) * limit;

    const [total, teams, statusCounts] = await Promise.all([
      Team.countDocuments(filter),
      Team.find(filter).sort({ submittedAt: -1 }).skip(skip).limit(limit).lean(),
      Team.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
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

    res.render('admin/teams', {
      title: '報名列表｜GPCC Admin',
      rows,
      filters: { status, payment, qualification, ageGroup, eventCategory, q },
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

    res.render('admin/team-detail', {
      title: `報名詳情｜${team.teamCode || team._id}`,
      team,
      players,
      audits,
      wonderPayments,
      labels: labels(),
      enums: {
        TEAM_STATUS,
        PAYMENT_STATUS,
        QUALIFICATION_STATUS,
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
    const { status = '', payment = '', qualification = '', q = '' } = req.query;
    const filter = {};
    if (status) filter.status = status;
    if (payment) filter['payment.status'] = payment;
    if (qualification) filter.qualificationStatus = qualification;
    if (q.trim()) {
      const re = new RegExp(q.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      filter.$or = [
        { captainEmail: re },
        { captainClub: re },
        { displayName: re },
        { teamCode: re },
      ];
    }

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

module.exports = router;
