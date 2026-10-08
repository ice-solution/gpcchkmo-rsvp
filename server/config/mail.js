/**
 * Gmail SMTP via nodemailer.
 * Requires a Google Account App Password (not the normal login password):
 *   Google Account → Security → 2-Step Verification → App passwords
 *
 * Env:
 *   GMAIL_USER=your@gmail.com
 *   GMAIL_APP_PASSWORD=xxxx xxxx xxxx xxxx
 *   MAIL_FROM="GPCC HK <your@gmail.com>"  (optional; defaults to GMAIL_USER)
 *   MAIL_REPLY_TO=info@example.com        (optional)
 */

function isMailConfigured() {
  return Boolean(
    String(process.env.GMAIL_USER || '').trim() &&
      String(process.env.GMAIL_APP_PASSWORD || '').trim()
  );
}

function getMailFrom() {
  const user = String(process.env.GMAIL_USER || '').trim();
  const from = String(process.env.MAIL_FROM || '').trim();
  if (from) return from;
  return user ? `GPCC Hong Kong <${user}>` : '';
}

function getMailReplyTo() {
  return String(process.env.MAIL_REPLY_TO || process.env.SUPPORT_EMAIL || '').trim() || undefined;
}

module.exports = {
  isMailConfigured,
  getMailFrom,
  getMailReplyTo,
};
