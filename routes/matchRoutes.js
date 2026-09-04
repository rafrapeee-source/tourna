const express = require('express');
const router = express.Router();
const Match = require('../models/Match');
const Team = require('../models/Team');

const ADMIN_SECRET_KEY = process.env.ADMIN_SECRET_KEY || "IHS_ADMIN_2025";

const authAdmin = (req, res, next) => {
  const token = req.headers['x-admin-key'];
  if (token !== ADMIN_SECRET_KEY) {
    return res.status(403).json({ error: "Unauthorized access" });
  }
  next();
};

// GET all round robin matches
router.get('/', async (req, res) => {
  try {
    const matches = await Match.find()
      .populate('teamA')
      .populate('teamB')
      .sort({ round: 1, matchNumber: 1 });
    res.json(matches);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Auto-generate 5-Team Bo1 Schedule
router.post('/generate-schedule', authAdmin, async (req, res) => {
  try {
    const teams = await Team.find().sort({ seed: 1, createdAt: 1 }).limit(5);
    if (teams.length < 2) {
      return res.status(400).json({ error: "You need at least 2 teams to generate a schedule." });
    }

    await Match.deleteMany({});

    // 5-Team Berger Round Robin Pairings (10 Bo1 Matches)
    const scheduleTemplate = [
      // Round 1
      { round: 1, matchNumber: 1, a: 0, b: 1, code: 'R1-M1' },
      { round: 1, matchNumber: 2, a: 2, b: 4, code: 'R1-M2' },
      // Round 2
      { round: 2, matchNumber: 1, a: 0, b: 2, code: 'R2-M1' },
      { round: 2, matchNumber: 2, a: 3, b: 1, code: 'R2-M2' },
      // Round 3
      { round: 3, matchNumber: 1, a: 0, b: 3, code: 'R3-M1' },
      { round: 3, matchNumber: 2, a: 4, b: 2, code: 'R3-M2' },
      // Round 4
      { round: 4, matchNumber: 1, a: 0, b: 4, code: 'R4-M1' },
      { round: 4, matchNumber: 2, a: 1, b: 3, code: 'R4-M2' },
      // Round 5
      { round: 5, matchNumber: 1, a: 1, b: 4, code: 'R5-M1' },
      { round: 5, matchNumber: 2, a: 2, b: 3, code: 'R5-M2' },
    ];

    const matchesToInsert = scheduleTemplate.map(item => ({
      matchCode: item.code,
      round: item.round,
      matchNumber: item.matchNumber,
      teamA: teams[item.a] ? teams[item.a]._id : null,
      teamB: teams[item.b] ? teams[item.b]._id : null,
      scoreA: 0,
      scoreB: 0,
      status: 'UPCOMING'
    }));

    await Match.insertMany(matchesToInsert);

    const io = req.app.get('io');
    if (io) io.emit('matchesUpdated');

    res.json({ message: "Bo1 Round robin schedule generated!" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update Bo1 Match Result
router.put('/:id', authAdmin, async (req, res) => {
  try {
    const { scoreA, scoreB, status } = req.body;
    const match = await Match.findByIdAndUpdate(
      req.params.id,
      { scoreA: Number(scoreA), scoreB: Number(scoreB), status },
      { new: true }
    ).populate('teamA').populate('teamB');

    const io = req.app.get('io');
    if (io) io.emit('matchesUpdated');

    res.json(match);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;