/**
 * Phase 5 stub: receipt + 3-stage confirmation emails.
 * Phase 1 only logs; wire SendGrid/SES later.
 */

async function sendSubmissionReceipt({ team, captain, teammate }) {
  // Do NOT call this "報名成功"; no QR / teamCode.
  console.log('[email:stub] submission receipt', {
    to: team.captainEmail,
    cc: teammate?.email,
    subject: '【GPCC 香港站】已收到報名申請｜待付款／待核實',
    teamId: String(team._id),
    status: team.status,
  });
  return { ok: true, stub: true };
}

async function sendStage1Confirmation(/* payload */) {
  throw new Error('Phase 5: stage-1 confirmation email not implemented');
}

async function sendStage2Schedule(/* payload */) {
  throw new Error('Phase 5: stage-2 schedule email not implemented');
}

async function sendStage3Reminder(/* payload */) {
  throw new Error('Phase 5: stage-3 reminder email not implemented');
}

module.exports = {
  sendSubmissionReceipt,
  sendStage1Confirmation,
  sendStage2Schedule,
  sendStage3Reminder,
};
