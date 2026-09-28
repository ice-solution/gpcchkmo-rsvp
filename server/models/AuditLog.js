const mongoose = require('mongoose');

/** Phase 3–6: qualification review, payment verify, QR scan audit */
const auditLogSchema = new mongoose.Schema(
  {
    action: { type: String, required: true, trim: true },
    entityType: { type: String, required: true, trim: true },
    entityId: { type: mongoose.Schema.Types.ObjectId, default: null },
    actor: { type: String, default: 'system' },
    meta: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { timestamps: true }
);

auditLogSchema.index({ entityType: 1, entityId: 1, createdAt: -1 });

module.exports = mongoose.model('AuditLog', auditLogSchema);
