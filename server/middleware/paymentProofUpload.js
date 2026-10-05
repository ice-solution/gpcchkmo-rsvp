const fs = require('fs');
const path = require('path');
const multer = require('multer');
const { nanoid } = require('nanoid');

const UPLOAD_DIR = path.join(__dirname, '..', '..', 'public', 'uploads', 'payment-proofs');

function ensureUploadDir() {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

const ALLOWED = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'application/pdf',
]);

const storage = multer.diskStorage({
  destination(_req, _file, cb) {
    ensureUploadDir();
    cb(null, UPLOAD_DIR);
  },
  filename(_req, file, cb) {
    const ext = path.extname(file.originalname || '').toLowerCase();
    const safeExt = ['.jpg', '.jpeg', '.png', '.webp', '.gif', '.pdf'].includes(ext)
      ? ext
      : '';
    cb(null, `${Date.now()}-${nanoid(10)}${safeExt}`);
  },
});

const paymentProofUpload = multer({
  storage,
  limits: { fileSize: 8 * 1024 * 1024 },
  fileFilter(_req, file, cb) {
    if (ALLOWED.has(file.mimetype)) {
      cb(null, true);
      return;
    }
    const err = new Error('付款憑證只接受 JPG、PNG、WEBP、GIF 或 PDF');
    err.status = 400;
    cb(err);
  },
}).single('paymentProof');

function optionalPaymentProof(req, res, next) {
  paymentProofUpload(req, res, (err) => {
    if (!err) return next();
    const message = err.code === 'LIMIT_FILE_SIZE' ? '付款憑證檔案不可超過 8MB' : err.message;
    return res.status(400).json({ ok: false, errors: [message] });
  });
}

function publicProofPath(file) {
  if (!file || !file.filename) return '';
  return `/uploads/payment-proofs/${file.filename}`;
}

module.exports = {
  optionalPaymentProof,
  publicProofPath,
};
