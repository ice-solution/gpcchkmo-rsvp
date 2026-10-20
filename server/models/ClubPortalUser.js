const mongoose = require('mongoose');

const clubPortalUserSchema = new mongoose.Schema(
  {
    /** Login username e.g. P01 */
    username: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      uppercase: true,
    },
    /** Club code e.g. P01 */
    clubCode: { type: String, required: true, trim: true, uppercase: true, index: true },
    clubLabel: { type: String, required: true, trim: true },
    passwordHash: { type: String, required: true },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model('ClubPortalUser', clubPortalUserSchema);
