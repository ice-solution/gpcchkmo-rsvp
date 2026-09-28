/**
 * Phase 2–6 route placeholders. Wired to stub services; return 501 until implemented.
 */
const express = require('express');
const {
  createStripeCheckoutSession,
  handleStripeWebhook,
} = require('../services/paymentService');
const {
  sendStage1Confirmation,
  sendStage2Schedule,
  sendStage3Reminder,
} = require('../services/emailService');
const { resolveToken, issuePlayerQrTokens } = require('../services/qrService');

const router = express.Router();

router.post('/payment/stripe/checkout', async (req, res) => {
  try {
    await createStripeCheckoutSession(req.body);
  } catch (err) {
    return res.status(501).json({ ok: false, errors: [err.message] });
  }
});

router.post('/payment/stripe/webhook', async (req, res) => {
  try {
    await handleStripeWebhook(req.body, req.headers['stripe-signature']);
  } catch (err) {
    return res.status(501).json({ ok: false, errors: [err.message] });
  }
});

router.post('/email/stage1/:teamId', async (req, res) => {
  try {
    await sendStage1Confirmation({ teamId: req.params.teamId });
  } catch (err) {
    return res.status(501).json({ ok: false, errors: [err.message] });
  }
});

router.post('/email/stage2/:teamId', async (req, res) => {
  try {
    await sendStage2Schedule({ teamId: req.params.teamId });
  } catch (err) {
    return res.status(501).json({ ok: false, errors: [err.message] });
  }
});

router.post('/email/stage3/:teamId', async (req, res) => {
  try {
    await sendStage3Reminder({ teamId: req.params.teamId });
  } catch (err) {
    return res.status(501).json({ ok: false, errors: [err.message] });
  }
});

router.get('/qr/resolve/:token', async (req, res) => {
  try {
    await resolveToken(req.params.token);
  } catch (err) {
    return res.status(501).json({ ok: false, errors: [err.message] });
  }
});

router.post('/qr/issue/:playerId', async (req, res) => {
  try {
    // issuePlayerQrTokens expects a Player document; Phase 4 will load it
    await issuePlayerQrTokens({
      packQrToken: null,
      checkinQrToken: null,
      save: async () => {},
    });
    return res.status(501).json({
      ok: false,
      errors: ['Phase 4: load player then issue tokens'],
    });
  } catch (err) {
    return res.status(501).json({ ok: false, errors: [err.message] });
  }
});

module.exports = router;
