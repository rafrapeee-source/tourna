const mongoose = require('mongoose');

const matchSchema = new mongoose.Schema({
  matchCode: { type: String, required: true, unique: true }, // e.g. "R1-M1"
  round: { type: Number, required: true },
  matchNumber: { type: Number, required: true },
  teamA: { type: mongoose.Schema.Types.ObjectId, ref: 'Team' },
  teamB: { type: mongoose.Schema.Types.ObjectId, ref: 'Team' },
  scoreA: { type: Number, default: 0 },
  scoreB: { type: Number, default: 0 },
  status: { type: String, enum: ['UPCOMING', 'LIVE', 'COMPLETED'], default: 'UPCOMING' }
});

module.exports = mongoose.model('Match', matchSchema);