const nodemailer = require('nodemailer');
const {
  isMailConfigured,
  getMailFrom,
  getMailReplyTo,
} = require('../config/mail');
const {
  AGE_GROUP_LABELS,
  EVENT_CATEGORY_LABELS,
  TEAM_STATUS_LABELS,
  PAYMENT_STATUS_LABELS,
  PACK_TIER_LABELS,
  AVAILABILITY_SLOTS,
  REGISTRATION_TYPES,
} = require('../constants/enums');

const REGISTRATION_TYPE_LABELS = {
  [REGISTRATION_TYPES.FIRST_OR_ONLY]: '第一個／唯一參賽項目',
  [REGISTRATION_TYPES.SECOND_ADDITIONAL]: '第二個兼報項目',
};

let transporter = null;

function getTransporter() {
  if (!isMailConfigured()) return null;
  if (transporter) return transporter;
  transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: String(process.env.GMAIL_USER).trim(),
      pass: String(process.env.GMAIL_APP_PASSWORD).replace(/\s+/g, ''),
    },
  });
  return transporter;
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatDob(d) {
  if (!d) return '—';
  const date = d instanceof Date ? d : new Date(d);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toISOString().slice(0, 10);
}

function labelOf(map, value) {
  return map[value] || value || '—';
}

function availabilityText(values) {
  const slots = Array.isArray(values) ? values : [];
  if (!slots.length) return '—';
  const byValue = Object.fromEntries(AVAILABILITY_SLOTS.map((s) => [s.value, s.label]));
  return slots.map((v) => byValue[v] || v).join('、');
}

function row(label, value) {
  return `<tr>
    <td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;color:#64748b;width:36%;font-size:13px;vertical-align:top;">${escapeHtml(label)}</td>
    <td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;color:#0f172a;font-size:14px;">${value}</td>
  </tr>`;
}

function section(title, rowsHtml) {
  return `
  <h2 style="margin:24px 0 8px;font-size:16px;color:#0b3d5c;">${escapeHtml(title)}</h2>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e2e8f0;border-radius:12px;border-collapse:collapse;background:#f8fafc;">
    ${rowsHtml}
  </table>`;
}

function playerRows(player, roleLabel) {
  if (!player) return section(roleLabel, row('資料', '—'));
  return section(
    roleLabel,
    [
      row('中文姓名', escapeHtml(player.chineseName)),
      row('英文姓名', escapeHtml(player.englishName)),
      row('性別', player.gender === 'male' ? '男' : player.gender === 'female' ? '女' : escapeHtml(player.gender)),
      row('出生日期', escapeHtml(formatDob(player.dateOfBirth))),
      row('WhatsApp', escapeHtml(player.whatsapp)),
      row('電郵', escapeHtml(player.email)),
      row('球會', escapeHtml(player.club || '—')),
      row(
        '緊急聯絡人',
        escapeHtml(
          `${player.emergencyContact?.name || '—'}（${player.emergencyContact?.phone || '—'}）`
        )
      ),
    ].join('')
  );
}

function buildSubmissionSummaryHtml({ team, captain, teammate }) {
  const statusLabel = labelOf(TEAM_STATUS_LABELS, team.status);
  const paymentLabel = labelOf(PAYMENT_STATUS_LABELS, team.payment?.status);
  const packLabel = labelOf(PACK_TIER_LABELS, team.packTier);
  const total =
    team.payment?.totalAmountHkd != null
      ? `HKD $${team.payment.totalAmountHkd}`
      : '—';

  return `
  <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#0f172a;line-height:1.55;max-width:640px;margin:0 auto;">
    <p style="margin:0 0 8px;font-size:12px;letter-spacing:.12em;text-transform:uppercase;color:#64748b;">GPCC Hong Kong Qualifier</p>
    <h1 style="margin:0 0 16px;font-size:22px;color:#0b3d5c;">已收到報名申請</h1>
    <p style="margin:0 0 16px;padding:12px 14px;background:#fffbeb;border:1px solid #fcd34d;border-radius:12px;color:#78350f;">
      此階段<strong>尚未等同報名成功</strong>。請按電郵內狀態完成付款／上載憑證；正式確認、隊伍編號及 QR Code 會於核實後另行通知。
    </p>
    ${section(
      '申請狀態',
      [
        row('申請編號', `<code style="font-weight:600;">${escapeHtml(String(team._id))}</code>`),
        row('申請狀態', escapeHtml(statusLabel)),
        row('付款狀態', escapeHtml(paymentLabel)),
        row('應繳總額', escapeHtml(total)),
        row('隊伍名稱', escapeHtml(team.displayName || '—')),
        row('隊長球會', escapeHtml(team.captainClub)),
        row('報名類型', escapeHtml(labelOf(REGISTRATION_TYPE_LABELS, team.registrationType))),
        row('年齡組別', escapeHtml(labelOf(AGE_GROUP_LABELS, team.ageGroup))),
        row('競賽項目', escapeHtml(labelOf(EVENT_CATEGORY_LABELS, team.eventCategory))),
        row('首選海選場地', escapeHtml(team.preferredVenueLabel)),
        row('可參賽時段', escapeHtml(availabilityText(team.availability))),
        row('選手包套裝', escapeHtml(packLabel)),
      ].join('')
    )}
    ${playerRows(captain, '隊長')}
    ${playerRows(teammate, '隊友')}
    <p style="margin:24px 0 0;font-size:13px;color:#64748b;">
      如有查詢，請回覆此電郵或聯絡大會。此為系統自動通知，請勿直接回覆敏感付款資料以外之內容。
    </p>
  </div>`;
}

function buildPaidCompletedHtml({ team, captain, teammate }) {
  const statusLabel = labelOf(TEAM_STATUS_LABELS, team.status);
  const paymentLabel = labelOf(PAYMENT_STATUS_LABELS, team.payment?.status);
  const total =
    team.payment?.totalAmountHkd != null
      ? `HKD $${team.payment.totalAmountHkd}`
      : '—';

  return `
  <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#0f172a;line-height:1.55;max-width:640px;margin:0 auto;">
    <p style="margin:0 0 8px;font-size:12px;letter-spacing:.12em;text-transform:uppercase;color:#64748b;">GPCC Hong Kong Qualifier</p>
    <h1 style="margin:0 0 16px;font-size:22px;color:#0b3d5c;">付款已確認</h1>
    <p style="margin:0 0 16px;padding:12px 14px;background:#ecfdf5;border:1px solid #6ee7b7;border-radius:12px;color:#065f46;">
      我們已更新您的付款狀態為<strong>已付款</strong>。申請現正進入資格核實；此階段<strong>仍未等同報名成功</strong>，正式確認、隊伍編號及 QR Code 會於核實後另行通知。
    </p>
    ${section(
      '最新狀態',
      [
        row('申請編號', `<code style="font-weight:600;">${escapeHtml(String(team._id))}</code>`),
        row('申請狀態', escapeHtml(statusLabel)),
        row('付款狀態', escapeHtml(paymentLabel)),
        row('已收金額', escapeHtml(total)),
        row('隊伍名稱', escapeHtml(team.displayName || '—')),
        row('競賽項目', escapeHtml(labelOf(EVENT_CATEGORY_LABELS, team.eventCategory))),
        row('年齡組別', escapeHtml(labelOf(AGE_GROUP_LABELS, team.ageGroup))),
        row('隊長', escapeHtml(captain ? `${captain.chineseName}／${captain.englishName}` : '—')),
        row('隊友', escapeHtml(teammate ? `${teammate.chineseName}／${teammate.englishName}` : '—')),
      ].join('')
    )}
    <p style="margin:24px 0 0;font-size:13px;color:#64748b;">
      感謝您的支持。如有查詢，請回覆此電郵或聯絡大會。
    </p>
  </div>`;
}

async function sendMail({ to, cc, subject, html, text }) {
  const transport = getTransporter();
  if (!transport) {
    console.warn('[email] skipped (GMAIL_USER / GMAIL_APP_PASSWORD not set)', {
      to,
      subject,
    });
    return { ok: false, skipped: true, reason: 'mail_not_configured' };
  }

  const recipients = Array.isArray(to) ? to.filter(Boolean) : [to].filter(Boolean);
  if (!recipients.length) {
    return { ok: false, skipped: true, reason: 'no_recipients' };
  }

  const ccList = (Array.isArray(cc) ? cc : [cc])
    .filter(Boolean)
    .map((e) => String(e).trim().toLowerCase())
    .filter((e) => !recipients.map((r) => String(r).toLowerCase()).includes(e));

  try {
    const info = await transport.sendMail({
      from: getMailFrom(),
      replyTo: getMailReplyTo(),
      to: recipients.join(', '),
      cc: ccList.length ? ccList.join(', ') : undefined,
      subject,
      html,
      text:
        text ||
        html
          .replace(/<style[\s\S]*?<\/style>/gi, '')
          .replace(/<[^>]+>/g, ' ')
          .replace(/\s+/g, ' ')
          .trim(),
    });
    console.log('[email] sent', { to: recipients, cc: ccList, subject, messageId: info.messageId });
    return { ok: true, messageId: info.messageId };
  } catch (err) {
    console.error('[email] send failed', { to: recipients, subject, error: err.message });
    return { ok: false, error: err.message };
  }
}

async function sendSubmissionReceipt({ team, captain, teammate }) {
  const subject = `【GPCC 香港站】已收到報名申請｜${labelOf(TEAM_STATUS_LABELS, team.status)}`;
  const html = buildSubmissionSummaryHtml({ team, captain, teammate });
  return sendMail({
    to: team.captainEmail,
    cc: teammate?.email,
    subject,
    html,
  });
}

async function sendPaymentCompletedEmail({ team, captain, teammate }) {
  const subject = '【GPCC 香港站】付款已確認｜待資格核實';
  const html = buildPaidCompletedHtml({ team, captain, teammate });
  return sendMail({
    to: team.captainEmail,
    cc: teammate?.email,
    subject,
    html,
  });
}

/**
 * Load captain/teammate and send paid-completed notice.
 * Safe to await; never throws.
 */
async function notifyPaymentCompleted(team) {
  if (!team) return { ok: false, skipped: true, reason: 'no_team' };
  try {
    const Player = require('../models/Player');
    const { PLAYER_ROLES } = require('../constants/enums');
    const players = await Player.find({ teamId: team._id }).lean();
    const captain = players.find((p) => p.role === PLAYER_ROLES.CAPTAIN);
    const teammate = players.find((p) => p.role === PLAYER_ROLES.TEAMMATE);
    return await sendPaymentCompletedEmail({ team, captain, teammate });
  } catch (err) {
    console.error('[email] notifyPaymentCompleted failed', err.message);
    return { ok: false, error: err.message };
  }
}

/** @deprecated phase stubs — keep exports for phaseStubs routes */
async function sendStage1Confirmation() {
  throw new Error('Phase 5: stage-1 confirmation email not implemented');
}

async function sendStage2Schedule() {
  throw new Error('Phase 5: stage-2 schedule email not implemented');
}

async function sendStage3Reminder() {
  throw new Error('Phase 5: stage-3 reminder email not implemented');
}

module.exports = {
  sendSubmissionReceipt,
  sendPaymentCompletedEmail,
  notifyPaymentCompleted,
  sendStage1Confirmation,
  sendStage2Schedule,
  sendStage3Reminder,
  isMailConfigured,
};
