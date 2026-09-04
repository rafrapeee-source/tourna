const mongoose = require('mongoose');

const teamSchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true },
  tag: { type: String, required: true, uppercase: true },
  players: {
    expLane: { type: String, required: true },
    core: { type: String, required: true },
    midLane: { type: String, required: true },
    goldLane: { type: String, required: true },
    roam: { type: String, required: true },
    sixthMan: { type: String, required: true }
  },
  seed: { type: Number, default: 0 },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Team', teamSchema);