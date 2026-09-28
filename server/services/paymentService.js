/**
 * Phase 2 stub: Stripe Checkout + FPS/bank transfer.
 */

const { FEE, PAYMENT_STATUS } = require('../constants/enums');

function buildPaymentSummary({ feeAmountHkd = null } = {}) {
  const base = FEE.BASE_HKD;
  const fee = feeAmountHkd;
  return {
    baseAmountHkd: base,
    feeAmountHkd: fee,
    totalAmountHkd: fee == null ? null : base + fee,
    currency: FEE.CURRENCY,
    feeDisclaimer:
      '所有信用卡及經付款網關處理的交易均會產生手續費。該費用由參加者承擔，並會在您確認付款授權前，以獨立項目清楚列示。',
  };
}

async function createStripeCheckoutSession(/* team */) {
  throw new Error('Phase 2: Stripe Checkout not configured');
}

async function handleStripeWebhook(/* rawBody, signature */) {
  throw new Error('Phase 2: Stripe webhook not configured');
}

async function createManualPaymentReference(team) {
  const ref = `GPCC-${String(team._id).slice(-8).toUpperCase()}`;
  return {
    method: 'fps',
    paymentReference: ref,
    status: PAYMENT_STATUS.PENDING_MANUAL,
  };
}

module.exports = {
  buildPaymentSummary,
  createStripeCheckoutSession,
  handleStripeWebhook,
  createManualPaymentReference,
};
