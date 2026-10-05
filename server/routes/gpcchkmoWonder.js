/**
 * Isolated Wonder payment routes for GPCC RSVP only.
 * Path prefix: /api/gpcchkmo/wonder/*
 * Do NOT share with picklevibes /payments/wonder/webhook.
 */
const express = require('express');
const rateLimit = require('express-rate-limit');
const {
  startWonderCheckout,
  handleWonderWebhook,
  getPaymentStatusForTeam,
  isWonderConfigured,
  PROVIDER_ID,
} = require('../services/wonder/gpcchkmoWonderCheckout');
const { isPaymentGatewayEnabled } = require('../config/paymentGateway');

const router = express.Router();

const checkoutLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
});

router.get('/status', (_req, res) => {
  res.json({
    ok: true,
    data: {
      provider: PROVIDER_ID,
      configured: isWonderConfigured(),
      paymentGatewayEnabled: isPaymentGatewayEnabled(),
      callbackPath: '/api/gpcchkmo/wonder/webhook',
      referencePrefix: 'gpcchkmo_',
      envPrefix: 'GPCCHKMO_WONDER_',
      note: 'Isolated from picklevibes WONDER_* env vars and webhook paths',
    },
  });
});

router.get('/team/:teamId/status', async (req, res, next) => {
  try {
    const data = await getPaymentStatusForTeam(req.params.teamId);
    res.json({ ok: true, data });
  } catch (err) {
    next(err);
  }
});

router.post('/checkout', checkoutLimiter, async (req, res) => {
  try {
    const teamId = req.body.teamId || req.body.applicationId;
    if (!teamId) {
      return res.status(400).json({ ok: false, errors: ['缺少 teamId / applicationId'] });
    }
    const data = await startWonderCheckout({ teamId });
    return res.json({ ok: true, data });
  } catch (err) {
    console.error('[gpcchkmo Wonder] checkout error', err.message);
    return res.status(err.status || 500).json({
      ok: false,
      errors: [err.message || '無法建立 Wonder 付款'],
    });
  }
});

/** Wonder may call GET or POST */
async function webhookHandler(req, res) {
  try {
    const body = req.body && Object.keys(req.body).length ? req.body : {};
    const result = await handleWonderWebhook(body, req.query || {});
    // Always 200 so Wonder does not retry aggressively
    return res.status(200).json(result);
  } catch (err) {
    console.error('[gpcchkmo Wonder] webhook error', err);
    return res.status(200).json({ ok: false, error: 'internal' });
  }
}

router.post('/webhook', webhookHandler);
router.get('/webhook', webhookHandler);

module.exports = router;
