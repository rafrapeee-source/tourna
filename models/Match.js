const mongoose = require('mongoose');

const matchSchema = new mongoose.Schema({
  matchCode: { type: String, required: true, unique: true },
  stage: { 
    type: String, 
    enum: ['ROUND_ROBIN', 'PLAY_IN', 'UPPER_BRACKET', 'LOWER_BRACKET', 'GRAND_FINALS'],
    required: true 
  },
  title: { type: String, required: true },
  bestOf: { type: Number, default: 1 },
  teamA: { type: mongoose.Schema.Types.ObjectId, ref: 'Team' },
  teamB: { type: mongoose.Schema.Types.ObjectId, ref: 'Team' },
  customNameA: { type: String, default: '' }, // e.g., "#4 Seed" or "Winner Play-In"
  customNameB: { type: String, default: '' },
  scoreA: { type: Number, default: 0 },
  scoreB: { type: Number, default: 0 },
  winner: { type: mongoose.Schema.Types.ObjectId, ref: 'Team' },
  loser: { type: mongoose.Schema.Types.ObjectId, ref: 'Team' },
  status: { type: String, enum: ['UPCOMING', 'LIVE', 'COMPLETED'], default: 'UPCOMING' }
});

module.exports = mongoose.model('Match', matchSchema);