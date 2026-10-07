/**
 * Shared payment helpers (fee summary + non-Wonder stubs).
 * Wonder live integration lives ONLY under:
 *   server/services/wonder/gpcchkmoWonder*
 *   /api/gpcchkmo/wonder/*
 */

const {
  FEE,
  PAYMENT_STATUS,
  PACK_TIERS,
  PACK_TIER_ADDON_HKD,
  PACK_TIER_LABELS,
} = require('../constants/enums');
const { isPaymentGatewayEnabled } = require('../config/paymentGateway');

const AIRWALLEX_PAY_URLS = {
  [PACK_TIERS.STANDARD]: 'https://pay.airwallex.com/sghmy57gxoo5',
  [PACK_TIERS.ESSENTIAL]: 'https://pay.airwallex.com/sghmy50i94e0',
  [PACK_TIERS.PREMIUM]: 'https://pay.airwallex.com/sghmzgsmo27i',
};

function normalizePackTier(packTier, wantPlayerPack) {
  if (Object.values(PACK_TIERS).includes(packTier)) return packTier;
  if (wantPlayerPack === true) return PACK_TIERS.ESSENTIAL;
  return PACK_TIERS.STANDARD;
}

function airwallexPayUrl(packTierOrWantPack = PACK_TIERS.STANDARD) {
  const tier =
    typeof packTierOrWantPack === 'boolean'
      ? normalizePackTier(null, packTierOrWantPack)
      : normalizePackTier(packTierOrWantPack);
  return AIRWALLEX_PAY_URLS[tier] || AIRWALLEX_PAY_URLS[PACK_TIERS.STANDARD];
}

function roundMoney(n) {
  return Math.round(Number(n) * 100) / 100;
}

function packAddonHkd(packTier = PACK_TIERS.STANDARD) {
  return Number(PACK_TIER_ADDON_HKD[packTier] || 0);
}

function registrationSubtotal(packTierOrWantPack = PACK_TIERS.STANDARD) {
  const tier =
    typeof packTierOrWantPack === 'boolean'
      ? normalizePackTier(null, packTierOrWantPack)
      : normalizePackTier(packTierOrWantPack);
  return roundMoney(FEE.BASE_HKD + packAddonHkd(tier));
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
  packTier,
  wantPlayerPack = false,
  gatewayEnabled = isPaymentGatewayEnabled(),
} = {}) {
  const tier = normalizePackTier(packTier, wantPlayerPack);
  const pack = packAddonHkd(tier);
  const subtotal = registrationSubtotal(tier);
  const amounts = gatewayEnabled
    ? withPlatformFee(subtotal)
    : {
        baseAmountHkd: subtotal,
        feeAmountHkd: 0,
        totalAmountHkd: subtotal,
        feeRate: 0,
      };
  const feePct = FEE.PLATFORM_FEE_RATE * 100;
  const packLabel = PACK_TIER_LABELS[tier] || tier;
  const packBitOn =
    pack > 0
      ? `報名費 HKD $${FEE.BASE_HKD} ＋ ${packLabel} HKD $${pack} ＋ 手續費 HKD $${amounts.feeAmountHkd}，應繳總額 HKD $${amounts.totalAmountHkd}。`
      : `海選報名費 HKD $${FEE.BASE_HKD} ＋ 手續費 HKD $${amounts.feeAmountHkd}，應繳總額 HKD $${amounts.totalAmountHkd}。`;
  const packBitOff =
    pack > 0
      ? `報名費 HKD $${FEE.BASE_HKD} ＋ ${packLabel} HKD $${pack}，應繳總額 HKD $${amounts.totalAmountHkd}。`
      : `海選報名費 HKD $${FEE.BASE_HKD}／隊。`;
  return {
    ...amounts,
    entryFeeHkd: FEE.BASE_HKD,
    playerPackHkd: pack,
    playerPackPriceHkd: FEE.ESSENTIAL_PACK_HKD,
    essentialPackHkd: FEE.ESSENTIAL_PACK_HKD,
    premiumPackHkd: FEE.PREMIUM_PACK_HKD,
    packTier: tier,
    packTierLabel: packLabel,
    wantPlayerPack: tier !== PACK_TIERS.STANDARD,
    currency: FEE.CURRENCY,
    paymentGatewayEnabled: Boolean(gatewayEnabled),
    providerHint: gatewayEnabled ? 'wonder_gpcchkmo' : 'airwallex',
    airwallexPayUrl: airwallexPayUrl(tier),
    feeDisclaimer: gatewayEnabled
      ? `經 Wonder 網上付款會另收 ${feePct}% 平台手續費（由參加者承擔）。${packBitOn}`
      : `請以 Airwallex 連結完成付款。${packBitOff}`,
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
  const ref = `GPCC-${String(team._id).slice(-8).toUpperCase()}`;
  return {
    method: 'airwallex',
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
  airwallexPayUrl,
  normalizePackTier,
  packAddonHkd,
  AIRWALLEX_PAY_URLS,
};
