/**
 * Send a one-off test email via Gmail SMTP.
 * Usage: node server/scripts/testMail.js [to@email.com]
 */
require('dotenv').config();
const nodemailer = require('nodemailer');
const { isMailConfigured, getMailFrom, getMailReplyTo } = require('../config/mail');

async function main() {
  if (!isMailConfigured()) {
    console.error('Missing GMAIL_USER or GMAIL_APP_PASSWORD in .env');
    process.exit(1);
  }
  const to = process.argv[2] || process.env.GMAIL_USER;
  const transport = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: String(process.env.GMAIL_USER).trim(),
      pass: String(process.env.GMAIL_APP_PASSWORD).replace(/\s+/g, ''),
    },
  });
  const info = await transport.sendMail({
    from: getMailFrom(),
    replyTo: getMailReplyTo(),
    to,
    subject: '【GPCC 香港站】電郵設定測試',
    text: '若你收到此信，代表 Gmail SMTP 已設定成功。',
    html: '<p>若你收到此信，代表 <strong>Gmail SMTP</strong> 已設定成功。</p>',
  });
  console.log('Sent OK →', to, info.messageId);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
