const mongoose = require('mongoose');
const { PAYMENT_STATUS, FEE } = require('../constants/enums');

/** Must stay in sync with gpcchkmoWonderClient.PROVIDER_ID */
const PROVIDER_ID = 'wonder_gpcchkmo';

/**
 * Dedicated payment ledger for GPCC RSVP Wonder transactions.
 * Kept separate from Team.payment snapshot and from picklevibes payment collections.
 */
const gpcchkmoWonderPaymentSchema = new mongoose.Schema(
  {
    teamId: { type: mongoose.Schema.Types.ObjectId, ref: 'Team', required: true, index: true },
    /** Always wonder_gpcchkmo — never reuse picklevibes provider strings */
    provider: { type: String, default: PROVIDER_ID, immutable: true },
    /** Wonder reference_number, e.g. gpcchkmo_<paymentId> */
    referenceNumber: { type: String, required: true, unique: true, index: true },
    amountHkd: { type: Number, required: true, default: FEE.BASE_HKD },
    currency: { type: String, default: FEE.CURRENCY },
    status: {
      type: String,
      enum: Object.values(PAYMENT_STATUS),
      default: PAYMENT_STATUS.PROCESSING,
      index: true,
    },
    wonderOrderId: { type: String, default: null },
    paymentUrl: { type: String, default: null },
    wonderInvoice: { type: mongoose.Schema.Types.Mixed, default: null },
    paidAt: { type: Date, default: null },
    lastWebhookAt: { type: Date, default: null },
    note: { type: String, default: '' },
  },
  { timestamps: true, collection: 'gpcchkmo_wonder_payments' }
);

module.exports = mongoose.model('GpcchkmoWonderPayment', gpcchkmoWonderPaymentSchema);
