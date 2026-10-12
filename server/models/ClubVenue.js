const mongoose = require('mongoose');

const clubVenueSchema = new mongoose.Schema(
  {
    label: { type: String, required: true, trim: true },
    /** Display code e.g. P01 */
    code: { type: String, trim: true, default: '' },
    address: { type: String, trim: true, default: '' },
    /** Qualifier schedule note shown after address in RSVP select */
    scheduleNote: { type: String, trim: true, default: '' },
    /** Fixed-schedule venue key: lit_pickle | mypw */
    scheduleKey: { type: String, trim: true, default: '' },
    region: { type: String, trim: true, default: '' },
    sortOrder: { type: Number, default: 100 },
    isActive: { type: Boolean, default: true },
    /** Special option e.g. 由大會安排 */
    isOrganizerAssign: { type: Boolean, default: false },
  },
  { timestamps: true }
);

clubVenueSchema.index({ isActive: 1, sortOrder: 1 });

function formatVenueOptionLabel(venue) {
  if (!venue) return '';
  const code = venue.code ? `${venue.code} ` : '';
  const name = venue.label || venue.name || '';
  const address = venue.address || '';
  const scheduleNote = venue.scheduleNote || '';
  let text = `${code}${name}`.trim();
  if (address) text = `${text} — ${address}`;
  if (scheduleNote) text = `${text} - ${scheduleNote}`;
  return text;
}

const ClubVenue = mongoose.model('ClubVenue', clubVenueSchema);
module.exports = ClubVenue;
module.exports.formatVenueOptionLabel = formatVenueOptionLabel;
