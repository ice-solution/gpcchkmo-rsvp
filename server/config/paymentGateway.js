/**
 * Toggle Wonder (or other) online payment via .env:
 *   PAYMENT_GATEWAY_ENABLED=true|false
 * Unset defaults to enabled so existing deployments keep current behaviour.
 */
function isPaymentGatewayEnabled() {
  const raw = process.env.PAYMENT_GATEWAY_ENABLED;
  if (raw == null || String(raw).trim() === '') return true;
  const v = String(raw).trim().toLowerCase();
  return ['1', 'true', 'on', 'yes'].includes(v);
}

function parseProofLink(value) {
  const t = String(value || '').trim();
  if (!t) return { ok: true, url: '' };
  let url;
  try {
    url = new URL(t);
  } catch {
    return { ok: false, error: '付款憑證連結格式不正確' };
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    return { ok: false, error: '付款憑證連結只接受 http 或 https' };
  }
  return { ok: true, url: url.toString().slice(0, 500) };
}

module.exports = {
  isPaymentGatewayEnabled,
  parseProofLink,
};
