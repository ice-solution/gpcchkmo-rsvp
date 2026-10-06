const mongoose = require('mongoose');

const clubVenueSchema = new mongoose.Schema(
  {
    label: { type: String, required: true, trim: true },
    address: { type: String, trim: true, default: '' },
    sortOrder: { type: Number, default: 100 },
    isActive: { type: Boolean, default: true },
    /** Special option e.g. 由大會安排 */
    isOrganizerAssign: { type: Boolean, default: false },
  },
  { timestamps: true }
);

clubVenueSchema.index({ isActive: 1, sortOrder: 1 });

module.exports = mongoose.model('ClubVenue', clubVenueSchema);
