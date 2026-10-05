/**
 * Shared payment helpers (fee summary + non-Wonder stubs).
 * Wonder live integration lives ONLY under:
 *   server/services/wonder/gpcchkmoWonder*
 *   /api/gpcchkmo/wonder/*
 */

const { FEE, PAYMENT_STATUS } = require('../constants/enums');
const { isPaymentGatewayEnabled } = require('../config/paymentGateway');

function roundMoney(n) {
  return Math.round(Number(n) * 100) / 100;
}

function registrationSubtotal(wantPlayerPack = false) {
  return roundMoney(FEE.BASE_HKD + (wantPlayerPack ? FEE.PLAYER_PACK_HKD : 0));
}

function withPlatformFee(baseAmountHkd = FEE.BASE_HKD) {
  const base = roundMoney(baseAmountHkd);
  const fee = roundMoney(base * FEE.PLATFORM_FEE_RATE);
  const total = roundMoney(base + fee);
  return {
    baseAmountHkd: base,
    feeAmountHkd: fee,
    totalAmountHkd: total,
    feeRate: FEE.PLATFORM_FEE_RATE,
  };
}

function buildPaymentSummary({
  wantPlayerPack = false,
  gatewayEnabled = isPaymentGatewayEnabled(),
} = {}) {
  const subtotal = registrationSubtotal(wantPlayerPack);
  const pack = wantPlayerPack ? FEE.PLAYER_PACK_HKD : 0;
  const amounts = gatewayEnabled
    ? withPlatformFee(subtotal)
    : {
        baseAmountHkd: subtotal,
        feeAmountHkd: 0,
        totalAmountHkd: subtotal,
        feeRate: 0,
      };
  return {
    ...amounts,
    entryFeeHkd: FEE.BASE_HKD,
    playerPackHkd: pack,
    playerPackPriceHkd: FEE.PLAYER_PACK_HKD,
    wantPlayerPack: Boolean(wantPlayerPack),
    currency: FEE.CURRENCY,
    paymentGatewayEnabled: Boolean(gatewayEnabled),
    providerHint: gatewayEnabled ? 'wonder_gpcchkmo' : 'manual_fps',
    feeDisclaimer: gatewayEnabled
      ? `經 Wonder 網上付款會另收 ${FEE.PLATFORM_FEE_RATE * 100}% 平台手續費（由參加者承擔）。` +
        (wantPlayerPack
          ? `報名費 HKD $${FEE.BASE_HKD} ＋ 選手包 HKD $${FEE.PLAYER_PACK_HKD} ＋ 手續費 HKD $${amounts.feeAmountHkd}，應繳總額 HKD $${amounts.totalAmountHkd}。`
          : `海選報名費 HKD $${FEE.BASE_HKD} ＋ 手續費 HKD $${amounts.feeAmountHkd}，應繳總額 HKD $${amounts.totalAmountHkd}。`)
      : wantPlayerPack
        ? `銀行／轉數快轉賬：報名費 HKD $${FEE.BASE_HKD} ＋ 選手包 HKD $${FEE.PLAYER_PACK_HKD}，應繳總額 HKD $${amounts.totalAmountHkd}。`
        : `銀行／轉數快轉賬：海選報名費 HKD $${FEE.BASE_HKD}／隊。`,
  };
}

async function createStripeCheckoutSession(/* team */) {
  throw new Error(
    'Stripe Checkout not configured for GPCC RSVP (use Wonder: /api/gpcchkmo/wonder/checkout)'
  );
}

async function handleStripeWebhook(/* rawBody, signature */) {
  throw new Error('Stripe webhook not configured for GPCC RSVP');
}

async function createManualPaymentReference(team) {
  const ref = `GPCC-FPS-${String(team._id).slice(-8).toUpperCase()}`;
  return {
    method: 'fps',
    paymentReference: ref,
    status: PAYMENT_STATUS.PENDING_MANUAL,
  };
}

module.exports = {
  roundMoney,
  registrationSubtotal,
  withPlatformFee,
  buildPaymentSummary,
  createStripeCheckoutSession,
  handleStripeWebhook,
  createManualPaymentReference,
};
