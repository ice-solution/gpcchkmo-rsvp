/**
 * Phase 4 stub: per-player pack + check-in QR tokens (no PII in payload).
 */

const { customAlphabet } = require('nanoid');

const tokenId = customAlphabet('0123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz', 24);

function generateQrToken(kind) {
  return `${kind}_${tokenId()}`;
}

async function issuePlayerQrTokens(player) {
  player.packQrToken = player.packQrToken || generateQrToken('pack');
  player.checkinQrToken = player.checkinQrToken || generateQrToken('chk');
  await player.save();
  return {
    packQrToken: player.packQrToken,
    checkinQrToken: player.checkinQrToken,
  };
}

async function resolveToken(/* token */) {
  throw new Error('Phase 4: QR resolve/scan not implemented');
}

module.exports = {
  generateQrToken,
  issuePlayerQrTokens,
  resolveToken,
};
