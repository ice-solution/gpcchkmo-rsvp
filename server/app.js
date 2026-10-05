require('dotenv').config();

const path = require('path');
const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const session = require('express-session');
const mongoose = require('mongoose');
const apiRouter = require('./routes/api');
const phaseStubsRouter = require('./routes/phaseStubs');
const adminRouter = require('./routes/admin');
const gpcchkmoWonderRouter = require('./routes/gpcchkmoWonder');
const ClubVenue = require('./models/ClubVenue');
const { ensureDefaultAdmin } = require('./services/adminSeed');
const { attachAdminLocals } = require('./middleware/adminAuth');
const { isWonderConfigured, PROVIDER_ID } = require('./services/wonder/gpcchkmoWonderCheckout');
const { isPaymentGatewayEnabled } = require('./config/paymentGateway');
const {
  FEE,
  TEAM_STATUS_LABELS,
  PAYMENT_STATUS_LABELS,
  AGE_GROUP_LABELS,
  EVENT_CATEGORY_LABELS,
  PLAYER_ROLES,
} = require('./constants/enums');
const { buildPaymentSummary } = require('./services/paymentService');

const app = express();
const PORT = Number(process.env.PORT) || 3480;
const MONGODB_URI =
  process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/gpcchkmo_rsvp';

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, '..', 'views'));

app.use(morgan('dev'));
app.use(cors());
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, '..', 'public')));
app.use(
  session({
    name: 'gpcchkmo.sid',
    secret: process.env.SESSION_SECRET || 'gpcchkmo-dev-secret-change-me',
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: 'lax',
      maxAge: 1000 * 60 * 60 * 12,
    },
  })
);
app.use(attachAdminLocals);

function formatDateYmd(d) {
  if (!d) return '';
  const dt = new Date(d);
  if (Number.isNaN(dt.getTime())) return '';
  return dt.toISOString().slice(0, 10);
}

async function loadReceiptContext(applicationId) {
  const empty = {
    applicationId: applicationId || '',
    team: null,
    captain: null,
    teammate: null,
    teamPaymentStatus: '',
    teamStatus: '',
    teamStatusLabel: '',
    paymentStatusLabel: '',
    wantPlayerPack: false,
    proofUrl: '',
    proofLink: '',
    paymentReference: '',
  };
  if (!applicationId) return empty;
  try {
    const Team = require('./models/Team');
    const Player = require('./models/Player');
    const team = await Team.findById(applicationId).lean();
    if (!team) return empty;
    const players = await Player.find({ teamId: team._id }).lean();
    const captain = players.find((p) => p.role === PLAYER_ROLES.CAPTAIN) || null;
    const teammate = players.find((p) => p.role === PLAYER_ROLES.TEAMMATE) || null;
    return {
      applicationId: String(team._id),
      team,
      captain,
      teammate,
      teamPaymentStatus: team.payment?.status || '',
      teamStatus: team.status || '',
      teamStatusLabel: TEAM_STATUS_LABELS[team.status] || team.status || '',
      paymentStatusLabel: PAYMENT_STATUS_LABELS[team.payment?.status] || '',
      wantPlayerPack: team.wantPlayerPack === true,
      proofUrl: team.payment?.proofUrl || '',
      proofLink: team.payment?.proofLink || '',
      paymentReference: team.payment?.paymentReference || '',
    };
  } catch (err) {
    console.error(err);
    return empty;
  }
}

const receiptLabels = {
  ageGroup: AGE_GROUP_LABELS,
  eventCategory: EVENT_CATEGORY_LABELS,
};

app.get('/', (_req, res) => res.redirect('/rsvp'));
app.get('/rsvp', (_req, res) => {
  const gatewayOn = isPaymentGatewayEnabled();
  const fee = buildPaymentSummary({ wantPlayerPack: false, gatewayEnabled: gatewayOn });
  res.render('rsvp', {
    title: '海選報名 RSVP｜GPCC 香港站',
    paymentGatewayEnabled: gatewayOn,
    feeBase: FEE.BASE_HKD,
    packFee: FEE.PLAYER_PACK_HKD,
    feeSurcharge: fee.feeAmountHkd,
    feeTotal: fee.totalAmountHkd,
  });
});
app.get('/rsvp/success', async (req, res) => {
  const applicationId = req.query.id || '';
  let paymentState = req.query.payment || '';
  const gatewayOn = isPaymentGatewayEnabled();
  const ctx = await loadReceiptContext(applicationId);
  if (ctx.teamPaymentStatus === 'paid') paymentState = paymentState || 'paid';
  const fee = buildPaymentSummary({
    wantPlayerPack: ctx.wantPlayerPack,
    gatewayEnabled: gatewayOn,
  });
  res.render('success', {
    title: '已收到報名申請｜GPCC 香港站',
    paymentState,
    wonderConfigured: gatewayOn && isWonderConfigured(),
    paymentGatewayEnabled: gatewayOn,
    paymentProvider: PROVIDER_ID,
    feeBase: FEE.BASE_HKD,
    packFee: FEE.PLAYER_PACK_HKD,
    feeSurcharge: fee.feeAmountHkd,
    feeTotal: fee.totalAmountHkd,
    labels: receiptLabels,
    formatDate: formatDateYmd,
    ...ctx,
  });
});
app.get('/rsvp/pay', async (req, res) => {
  const applicationId = req.query.id || '';
  const gatewayOn = isPaymentGatewayEnabled();
  if (gatewayOn) {
    const q = applicationId ? `?id=${encodeURIComponent(String(applicationId))}` : '';
    return res.redirect(`/rsvp/success${q}`);
  }
  const ctx = await loadReceiptContext(applicationId);
  const fee = buildPaymentSummary({ wantPlayerPack: ctx.wantPlayerPack, gatewayEnabled: false });
  res.render('pay', {
    title: '轉賬付款｜GPCC 香港站',
    feeBase: FEE.BASE_HKD,
    packFee: FEE.PLAYER_PACK_HKD,
    feeTotal: fee.totalAmountHkd,
    ...ctx,
  });
});

app.use('/api', apiRouter);
app.use('/api', phaseStubsRouter);
/** Isolated Wonder webhook/checkout — do not mount under picklevibes-style /payments/wonder */
app.use('/api/gpcchkmo/wonder', gpcchkmoWonderRouter);
app.use('/admin', adminRouter);

app.use((err, req, res, _next) => {
  console.error(err);
  if (req.path.startsWith('/admin') && !req.xhr && !req.path.includes('.')) {
    return res.status(500).send('伺服器錯誤');
  }
  res.status(500).json({
    ok: false,
    errors: ['伺服器錯誤，請稍後再試或聯絡大會。'],
  });
});

async function start() {
  await mongoose.connect(MONGODB_URI);
  console.log('MongoDB connected');

  const existing = await ClubVenue.countDocuments();
  if (existing === 0) {
    const { execSync } = require('child_process');
    execSync('node server/scripts/seedClubs.js', {
      cwd: path.join(__dirname, '..'),
      stdio: 'inherit',
    });
  }

  await ensureDefaultAdmin();

  app.listen(PORT, () => {
    console.log(`GPCC RSVP listening on http://localhost:${PORT}/rsvp`);
    console.log(`Admin panel: http://localhost:${PORT}/admin`);
    console.log(
      `Wonder (${PROVIDER_ID}): ${
        isPaymentGatewayEnabled()
          ? isWonderConfigured()
            ? 'configured'
            : 'NOT configured'
          : 'DISABLED (PAYMENT_GATEWAY_ENABLED=false)'
      } → /api/gpcchkmo/wonder`
    );
  });
}

start().catch((err) => {
  console.error('Failed to start', err);
  process.exit(1);
});

module.exports = app;
