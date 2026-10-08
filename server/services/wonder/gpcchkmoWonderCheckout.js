/**
 * GPCC RSVP business layer for Wonder checkout + webhook.
 * Uses isolated client + gpcchkmo_wonder_payments collection.
 */

const Team = require('../../models/Team');
const AuditLog = require('../../models/AuditLog');
const GpcchkmoWonderPayment = require('../../models/GpcchkmoWonderPayment');
const {
  TEAM_STATUS,
  PAYMENT_STATUS,
  FEE,
} = require('../../constants/enums');
const { notifyPaymentCompleted } = require('../emailService');
const {
  PROVIDER_ID,
  isWonderConfigured,
  buildReferenceNumber,
  parseReferenceNumber,
  getWonderCallbackUrl,
  getPublicBaseUrl,
  createOrder,
  isOrderPaid,
  isOrderFailed,
  extractReferenceNumber,
  getPaymentBaseUrl,
} = require('./gpcchkmoWonderClient');
const { withPlatformFee } = require('../paymentService');
const { isPaymentGatewayEnabled } = require('../../config/paymentGateway');

async function startWonderCheckout({ teamId }) {
  if (!isWonderConfigured() || !isPaymentGatewayEnabled()) {
    const err = new Error(
      !isPaymentGatewayEnabled()
        ? '網上付款閘道已關閉，請使用轉數快／銀行轉賬'
        : 'GPCC Wonder 尚未設定：請在 .env 填寫 GPCCHKMO_WONDER_APP_ID 與 GPCCHKMO_WONDER_PRIVATE_KEY'
    );
    err.status = 503;
    throw err;
  }

  const team = await Team.findById(teamId);
  if (!team) {
    const err = new Error('找不到報名申請');
    err.status = 404;
    throw err;
  }

  if (team.payment?.status === PAYMENT_STATUS.PAID) {
    const err = new Error('此申請已付款');
    err.status = 409;
    throw err;
  }

  if (
    [TEAM_STATUS.CONFIRMED, TEAM_STATUS.DQ, TEAM_STATUS.WITHDRAWN].includes(team.status)
  ) {
    const err = new Error('此申請狀態不可再發起付款');
    err.status = 409;
    throw err;
  }

  const amounts = withPlatformFee(team.payment?.baseAmountHkd || FEE.BASE_HKD);
  const amountHkd = amounts.totalAmountHkd;

  // Reuse an open processing payment if still unpaid AND amount matches
  let payment = await GpcchkmoWonderPayment.findOne({
    teamId: team._id,
    status: { $in: [PAYMENT_STATUS.PROCESSING, PAYMENT_STATUS.UNPAID] },
    amountHkd,
  }).sort({ createdAt: -1 });

  if (!payment) {
    payment = await GpcchkmoWonderPayment.create({
      teamId: team._id,
      provider: PROVIDER_ID,
      referenceNumber: 'pending',
      amountHkd,
      currency: FEE.CURRENCY,
      status: PAYMENT_STATUS.PROCESSING,
      note: `GPCC HK Qualifier RSVP | team ${team._id}`,
    });
    payment.referenceNumber = buildReferenceNumber(payment._id);
    await payment.save();
  }

  const callbackUrl = getWonderCallbackUrl();
  const redirectUrl = `${getPublicBaseUrl()}/rsvp/success?id=${team._id}&payment=return&ref=${encodeURIComponent(payment.referenceNumber)}`;

  const { paymentUrl, orderId } = await createOrder({
    referenceNumber: payment.referenceNumber,
    amount: amountHkd,
    currency: FEE.CURRENCY,
    note: `GPCC HK RSVP ${team.displayName || team.captainEmail}`.slice(0, 255),
    callbackUrl,
    redirectUrl,
  });

  payment.paymentUrl = paymentUrl;
  payment.wonderOrderId = orderId ? String(orderId) : payment.wonderOrderId;
  payment.status = PAYMENT_STATUS.PROCESSING;
  await payment.save();

  team.payment = team.payment || {};
  team.payment.method = PROVIDER_ID;
  team.payment.status = PAYMENT_STATUS.PROCESSING;
  team.payment.baseAmountHkd = amounts.baseAmountHkd;
  team.payment.feeAmountHkd = amounts.feeAmountHkd;
  team.payment.totalAmountHkd = amounts.totalAmountHkd;
  team.payment.paymentReference = payment.referenceNumber;
  team.payment.stripeSessionId = null; // unused; keep null so Wonder is not mixed with Stripe fields
  await team.save();

  await AuditLog.create({
    action: 'payment.wonder.checkout_started',
    entityType: 'Team',
    entityId: team._id,
    actor: team.captainEmail,
    meta: {
      provider: PROVIDER_ID,
      referenceNumber: payment.referenceNumber,
      amountHkd,
      gateway: getPaymentBaseUrl(),
      callbackUrl,
    },
  });

  return {
    paymentUrl,
    referenceNumber: payment.referenceNumber,
    paymentId: String(payment._id),
    amountHkd,
    provider: PROVIDER_ID,
  };
}

async function handleWonderWebhook(body, query = {}) {
  const referenceNumber = extractReferenceNumber(body || {}, query || {});
  const paymentId = parseReferenceNumber(referenceNumber);

  // Always acknowledge to Wonder, but only process our namespace
  if (!paymentId) {
    console.warn('[gpcchkmo Wonder] ignore webhook — reference not in gpcchkmo_ namespace:', referenceNumber);
    return { ok: true, ignored: true, reason: 'foreign_or_missing_reference' };
  }

  const payment = await GpcchkmoWonderPayment.findById(paymentId);
  if (!payment) {
    console.warn('[gpcchkmo Wonder] payment not found:', paymentId);
    return { ok: true, ignored: true, reason: 'payment_not_found' };
  }

  payment.wonderInvoice = body;
  payment.lastWebhookAt = new Date();

  const team = await Team.findById(payment.teamId);
  if (!team) {
    payment.status = PAYMENT_STATUS.FAILED;
    await payment.save();
    return { ok: true, ignored: true, reason: 'team_not_found' };
  }

  if (isOrderPaid(body)) {
    if (payment.status !== PAYMENT_STATUS.PAID) {
      payment.status = PAYMENT_STATUS.PAID;
      payment.paidAt = new Date();
      await payment.save();

      team.payment = team.payment || {};
      team.payment.method = PROVIDER_ID;
      team.payment.status = PAYMENT_STATUS.PAID;
      team.payment.paidAt = payment.paidAt;
      team.payment.paymentReference = payment.referenceNumber;
      team.payment.totalAmountHkd = payment.amountHkd;
      // Paid ≠ confirmed registration; move to review queue
      if (
        team.status === TEAM_STATUS.SUBMITTED_PENDING_PAYMENT ||
        team.status === TEAM_STATUS.MANUAL_PENDING_PAYMENT ||
        team.status === TEAM_STATUS.PAYMENT_FAILED
      ) {
        team.status = TEAM_STATUS.PAID_PENDING_REVIEW;
      }
      await team.save();

      await AuditLog.create({
        action: 'payment.wonder.paid',
        entityType: 'Team',
        entityId: team._id,
        actor: 'wonder_webhook',
        meta: {
          provider: PROVIDER_ID,
          referenceNumber: payment.referenceNumber,
          amountHkd: payment.amountHkd,
        },
      });

      await notifyPaymentCompleted(team);
    } else {
      await payment.save();
    }
    return { ok: true, paid: true, teamId: String(team._id) };
  }

  if (isOrderFailed(body)) {
    payment.status = PAYMENT_STATUS.FAILED;
    await payment.save();
    team.payment = team.payment || {};
    team.payment.status = PAYMENT_STATUS.FAILED;
    if (team.status === TEAM_STATUS.SUBMITTED_PENDING_PAYMENT) {
      team.status = TEAM_STATUS.PAYMENT_FAILED;
    }
    await team.save();
    await AuditLog.create({
      action: 'payment.wonder.failed',
      entityType: 'Team',
      entityId: team._id,
      actor: 'wonder_webhook',
      meta: { provider: PROVIDER_ID, referenceNumber: payment.referenceNumber },
    });
    return { ok: true, paid: false, failed: true };
  }

  await payment.save();
  return { ok: true, pending: true };
}

async function getPaymentStatusForTeam(teamId) {
  const payment = await GpcchkmoWonderPayment.findOne({ teamId })
    .sort({ createdAt: -1 })
    .lean();
  const team = await Team.findById(teamId).lean();
  return {
    configured: isWonderConfigured(),
    provider: PROVIDER_ID,
    teamPaymentStatus: team?.payment?.status || null,
    teamStatus: team?.status || null,
    latestPayment: payment
      ? {
          id: String(payment._id),
          referenceNumber: payment.referenceNumber,
          status: payment.status,
          amountHkd: payment.amountHkd,
          paidAt: payment.paidAt,
        }
      : null,
  };
}

module.exports = {
  startWonderCheckout,
  handleWonderWebhook,
  getPaymentStatusForTeam,
  isWonderConfigured,
  PROVIDER_ID,
};
