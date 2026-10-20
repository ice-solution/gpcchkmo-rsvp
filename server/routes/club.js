const express = require('express');
const bcrypt = require('bcrypt');
const rateLimit = require('express-rate-limit');
const ClubPortalUser = require('../models/ClubPortalUser');
const Team = require('../models/Team');
const Player = require('../models/Player');
const { requireClub } = require('../middleware/clubAuth');
const {
  TEAM_STATUS_LABELS,
  PAYMENT_STATUS_LABELS,
  QUALIFICATION_STATUS_LABELS,
  AGE_GROUP_LABELS,
  EVENT_CATEGORY_LABELS,
  PACK_TIER_LABELS,
  PLAYER_ROLES,
  buildClubPortalFilter,
  captainClubBelongsToPortalCode,
} = require('../constants/enums');
const {
  buildTeamsXlsxBuffer,
  formatDate,
  formatDateTime,
  REGISTRATION_TYPE_LABELS,
} = require('../services/adminExport');

const router = express.Router();

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
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
    packTier: PACK_TIER_LABELS,
  };
}

router.get('/login', (req, res) => {
  if (req.session?.club) return res.redirect('/club');
  res.render('club/login', {
    title: '球館登入｜GPCC 香港站',
    error: req.query.error || '',
    next: req.query.next || '/club',
  });
});

router.post('/login', loginLimiter, async (req, res) => {
  try {
    const username = String(req.body.username || '')
      .trim()
      .toUpperCase();
    const password = String(req.body.password || '');
    const nextUrl = req.body.next || '/club';

    const user = await ClubPortalUser.findOne({ username, isActive: true });
    if (!user) {
      return res.redirect(
        `/club/login?error=${encodeURIComponent('帳號或密碼不正確')}&next=${encodeURIComponent(nextUrl)}`
      );
    }
    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) {
      return res.redirect(
        `/club/login?error=${encodeURIComponent('帳號或密碼不正確')}&next=${encodeURIComponent(nextUrl)}`
      );
    }

    req.session.club = {
      id: String(user._id),
      username: user.username,
      clubCode: user.clubCode,
      clubLabel: user.clubLabel,
    };
    return res.redirect(nextUrl.startsWith('/club') ? nextUrl : '/club');
  } catch (err) {
    console.error(err);
    return res.redirect(
      `/club/login?error=${encodeURIComponent('登入失敗，請稍後再試')}`
    );
  }
});

router.post('/logout', (req, res) => {
  if (req.session) {
    delete req.session.club;
  }
  res.redirect('/club/login');
});

router.get('/', requireClub, async (req, res, next) => {
  try {
    const club = req.session.club;
    const q = String(req.query.q || '').trim();
    const clubFilter = buildClubPortalFilter(club.clubCode);
    let filter = clubFilter;
    if (q) {
      const re = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      filter = {
        $and: [
          clubFilter,
          {
            $or: [
              { captainEmail: re },
              { displayName: re },
              { teamCode: re },
              { preferredVenueLabel: re },
              { captainClub: re },
            ],
          },
        ],
      };
    }

    const teams = await Team.find(filter).sort({ submittedAt: -1 }).lean();
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
      return {
        team,
        captain: list.find((p) => p.role === PLAYER_ROLES.CAPTAIN) || null,
        teammate: list.find((p) => p.role === PLAYER_ROLES.TEAMMATE) || null,
      };
    });

    res.render('club/teams', {
      title: `${club.clubCode} 報名名單｜GPCC`,
      club,
      rows,
      q,
      labels: labels(),
      formatDateTime,
      total: teams.length,
    });
  } catch (err) {
    next(err);
  }
});

router.get('/teams/:id', requireClub, async (req, res, next) => {
  try {
    const club = req.session.club;
    const team = await Team.findById(req.params.id).lean();
    if (!team || !captainClubBelongsToPortalCode(team.captainClub, club.clubCode)) {
      return res.status(404).send('找不到此報名，或無權限查看');
    }
    const players = await Player.find({ teamId: team._id }).sort({ role: 1 }).lean();
    res.render('club/team-detail', {
      title: `報名詳情｜${club.clubCode}`,
      club,
      team,
      players,
      labels: labels(),
      formatDate,
      formatDateTime,
      PLAYER_ROLES,
    });
  } catch (err) {
    next(err);
  }
});

router.get('/export.xlsx', requireClub, async (req, res, next) => {
  try {
    const club = req.session.club;
    const teams = await Team.find(buildClubPortalFilter(club.clubCode))
      .sort({ submittedAt: -1 })
      .lean();
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
    const stamp = new Date().toISOString().slice(0, 10);
    const filename = `GPCC-${club.clubCode}-${stamp}.xlsx`;
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${filename}"; filename*=UTF-8''${encodeURIComponent(filename)}`
    );
    return res.send(buf);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
