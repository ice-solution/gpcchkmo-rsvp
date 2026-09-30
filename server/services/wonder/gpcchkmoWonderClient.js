/**
 * GPCC RSVP — isolated Wonder payment client
 * ------------------------------------------
 * 刻意與 picklevibes / checkinSystem 分開：
 * - 只讀 GPCCHKMO_WONDER_* 環境變數（不會誤用對方的 WONDER_*）
 * - reference_number 一律加前綴 gpcchkmo_
 * - webhook 路徑固定 /api/gpcchkmo/wonder/webhook
 *
 * 即使使用同一個 Wonder 商戶帳號（PickleVibes），對帳／回調也不會與其他專案撞號。
 */

const axios = require('axios');
const WonderSignature = require('../../utils/wonderSignature');

const PROVIDER_ID = 'wonder_gpcchkmo';
const REFERENCE_PREFIX = 'gpcchkmo_';

const WONDER_ECHO_URI = '/svc/payment/api/v1/openapi/echo';
const WONDER_ORDER_API_PATH = '/svc/payment/api/v1/openapi/orders';

function getPaymentBaseUrl() {
  const dev = (
    process.env.GPCCHKMO_WONDER_PAYMENT_DEV ||
    process.env.PAYMENT_DEV ||
    ''
  )
    .toString()
    .trim()
    .toLowerCase();
  const isDev = dev === 'true' || dev === '1';
  return isDev ? 'https://gateway-stg.wonder.today' : 'https://gateway.wonder.today';
}

function formatTimeToYYYYMMDDHHMMSS(date = new Date()) {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  const hours = String(date.getUTCHours()).padStart(2, '0');
  const minutes = String(date.getUTCMinutes()).padStart(2, '0');
  const seconds = String(date.getUTCSeconds()).padStart(2, '0');
  return `${year}${month}${day}${hours}${minutes}${seconds}`;
}

/**
 * Isolated credentials — ONLY GPCCHKMO_WONDER_* (no fallback to picklevibes WONDER_*).
 */
function getWonderConfig() {
  const appId = (process.env.GPCCHKMO_WONDER_APP_ID || '').trim();
  const customerUuid = (process.env.GPCCHKMO_WONDER_CUSTOMER_UUID || '').trim();
  const apiKey = (process.env.GPCCHKMO_WONDER_API_KEY || '').trim();
  const privateKeyRaw = process.env.GPCCHKMO_WONDER_PRIVATE_KEY || '';
  const privateKey = privateKeyRaw.replace(/\\n/g, '\n').trim();
  return { appId, customerUuid, apiKey, privateKey };
}

function isWonderConfigured() {
  const { appId, privateKey } = getWonderConfig();
  return Boolean(appId && privateKey && privateKey.includes('BEGIN'));
}

function buildReferenceNumber(paymentId) {
  return `${REFERENCE_PREFIX}${String(paymentId)}`;
}

function parseReferenceNumber(referenceNumber) {
  const ref = String(referenceNumber || '');
  if (!ref.startsWith(REFERENCE_PREFIX)) return null;
  return ref.slice(REFERENCE_PREFIX.length);
}

function getPublicBaseUrl() {
  return (process.env.DOMAIN || process.env.GPCCHKMO_DOMAIN || 'http://localhost:3480').replace(
    /\/$/,
    ''
  );
}

function getWonderCallbackUrl() {
  const override = (process.env.GPCCHKMO_WONDER_CALLBACK_URL || '').trim();
  if (override) return override;
  return `${getPublicBaseUrl()}/api/gpcchkmo/wonder/webhook`;
}

function getWonderAuthHeaders(privateKey, appId, method, uri, bodyString, credentialTime) {
  if (!privateKey || !appId) {
    throw new Error(
      'GPCCHKMO_WONDER_PRIVATE_KEY and GPCCHKMO_WONDER_APP_ID are required for Wonder authentication'
    );
  }
  const wonderSignature = new WonderSignature();
  const nonce = WonderSignature.generateRandomString(16);
  const now = credentialTime || formatTimeToYYYYMMDDHHMMSS();
  const credential = `${appId}/${now}/Wonder-RSA-SHA256`;
  const signature = wonderSignature.signature(
    privateKey,
    credential,
    nonce,
    method,
    uri,
    bodyString || null
  );
  return {
    Credential: credential,
    Nonce: nonce,
    Signature: signature,
  };
}

async function wonderAuthenticate() {
  const baseUrl = getPaymentBaseUrl();
  const { appId, privateKey } = getWonderConfig();
  if (!isWonderConfigured()) {
    throw new Error(
      'GPCCHKMO_WONDER_APP_ID and GPCCHKMO_WONDER_PRIVATE_KEY are required (isolated from picklevibes WONDER_*)'
    );
  }

  const now = formatTimeToYYYYMMDDHHMMSS();
  const authBody = { message: `Hello, Current timestamp is ${now}` };
  const authBodyString = JSON.stringify(authBody);
  const method = 'POST';
  const authHeaders = getWonderAuthHeaders(privateKey, appId, method, WONDER_ECHO_URI, authBodyString, now);
  const url = `${baseUrl}${WONDER_ECHO_URI}`;

  const response = await axios.post(url, authBodyString, {
    headers: {
      'Content-Type': 'application/json',
      Credential: authHeaders.Credential,
      Nonce: authHeaders.Nonce,
      Signature: authHeaders.Signature,
    },
    timeout: 15000,
    validateStatus: () => true,
  });

  if (response.status !== 200 && response.status !== 201) {
    throw new Error(`Wonder auth failed: ${response.status} - ${JSON.stringify(response.data)}`);
  }
}

/**
 * Create Wonder payment link for GPCC RSVP only.
 * @returns {{ paymentUrl: string, orderId: string }}
 */
async function createOrder(params) {
  const baseUrl = getPaymentBaseUrl();
  const { appId, customerUuid, apiKey, privateKey } = getWonderConfig();
  if (!appId) {
    throw new Error('GPCCHKMO_WONDER_APP_ID is required in .env');
  }

  await wonderAuthenticate();

  const amountStr =
    typeof params.amount === 'number' ? params.amount.toFixed(2) : String(params.amount || '0.00');

  const body = {
    app_id: appId,
    order: {
      reference_number: String(params.referenceNumber || ''),
      charge_fee: amountStr,
      currency: (params.currency || 'HKD').toUpperCase(),
      note: String(params.note || 'GPCC HK Qualifier RSVP').slice(0, 255),
      callback_url: params.callbackUrl,
      redirect_url: params.redirectUrl,
    },
  };
  if (customerUuid) body.customer_uuid = customerUuid;

  const plainText = JSON.stringify(body);
  const query = 'with_payment_link=true';
  const uriWithQuery = `${WONDER_ORDER_API_PATH}?${query}`;
  const url = `${baseUrl}${uriWithQuery}`;
  const method = 'POST';

  if (!privateKey || !privateKey.includes('BEGIN')) {
    throw new Error('GPCCHKMO_WONDER_PRIVATE_KEY is required for create order signature');
  }

  const orderAuthHeaders = getWonderAuthHeaders(privateKey, appId, method, uriWithQuery, plainText);
  const headers = {
    'Content-Type': 'application/json',
    Credential: orderAuthHeaders.Credential,
    Nonce: orderAuthHeaders.Nonce,
    Signature: orderAuthHeaders.Signature,
  };
  if (apiKey) {
    headers.Authorization = `Bearer ${apiKey}`;
    headers['X-API-Key'] = apiKey;
  }

  const response = await axios.post(url, plainText, {
    headers,
    timeout: 15000,
    validateStatus: () => true,
  });

  if (response.status !== 200 && response.status !== 201) {
    const msg =
      response.data?.message ||
      response.data?.error ||
      response.statusText ||
      JSON.stringify(response.data);
    throw new Error(`Wonder create order failed: ${response.status} - ${JSON.stringify(msg)}`);
  }

  const data = response.data || {};
  const paymentUrl =
    data.payment_url ||
    data.url ||
    data.payment_link ||
    data.data?.payment_url ||
    data.data?.url ||
    data.data?.payment_link;
  const orderId =
    data.order_id || data.id || data.data?.order_id || data.data?.id || data.reference_number;

  if (!paymentUrl) {
    throw new Error(`Wonder API did not return payment_url. Response: ${JSON.stringify(data)}`);
  }

  return {
    paymentUrl,
    orderId: orderId || params.referenceNumber,
  };
}

function isOrderPaid(body) {
  if (!body) return false;
  const state = String(body.state || body.order?.state || '').toLowerCase();
  const correspondenceState = String(
    body.correspondence_state || body.order?.correspondence_state || ''
  ).toLowerCase();
  return state === 'completed' || correspondenceState === 'paid';
}

function isOrderFailed(body) {
  if (!body) return false;
  const state = String(body.state || body.order?.state || '').toLowerCase();
  return ['cancelled', 'canceled', 'voided', 'failed', 'expired'].includes(state);
}

function extractReferenceNumber(body, query = {}) {
  return (
    body?.reference_number ||
    body?.order?.reference_number ||
    body?.data?.reference_number ||
    query.reference_number ||
    null
  );
}

module.exports = {
  PROVIDER_ID,
  REFERENCE_PREFIX,
  getPaymentBaseUrl,
  getWonderConfig,
  isWonderConfigured,
  buildReferenceNumber,
  parseReferenceNumber,
  getPublicBaseUrl,
  getWonderCallbackUrl,
  createOrder,
  wonderAuthenticate,
  isOrderPaid,
  isOrderFailed,
  extractReferenceNumber,
};
