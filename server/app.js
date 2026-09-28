require('dotenv').config();

const path = require('path');
const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const mongoose = require('mongoose');
const apiRouter = require('./routes/api');
const phaseStubsRouter = require('./routes/phaseStubs');
const ClubVenue = require('./models/ClubVenue');

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

app.get('/', (_req, res) => res.redirect('/rsvp'));
app.get('/rsvp', (_req, res) => {
  res.render('rsvp', {
    title: '海選報名 RSVP｜GPCC 香港站',
    feeBase: 880,
  });
});
app.get('/rsvp/success', (req, res) => {
  res.render('success', {
    title: '已收到報名申請｜GPCC 香港站',
    applicationId: req.query.id || '',
  });
});

app.use('/api', apiRouter);
app.use('/api', phaseStubsRouter);

app.use((err, _req, res, _next) => {
  console.error(err);
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

  app.listen(PORT, () => {
    console.log(`GPCC RSVP listening on http://localhost:${PORT}/rsvp`);
  });
}

start().catch((err) => {
  console.error('Failed to start', err);
  process.exit(1);
});

module.exports = app;
