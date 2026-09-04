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

// GET all tournament matches
router.get('/', async (req, res) => {
  try {
    const matches = await Match.find()
      .populate('teamA')
      .populate('teamB')
      .populate('winner')
      .populate('loser');
    res.json(matches);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Auto-generate full tournament (10 RR Matches + Play-In + Double Elim Bracket)
router.post('/generate-tournament', authAdmin, async (req, res) => {
  try {
    const teams = await Team.find().sort({ seed: 1, createdAt: 1 }).limit(5);
    if (teams.length < 2) {
      return res.status(400).json({ error: "Register at least 2 teams first." });
    }

    await Match.deleteMany({});

    const matchesToInsert = [];

    // 1. 10 Bo1 Round Robin Matches
    const rrPairs = [
      [0, 1], [2, 4], [0, 2], [3, 1], [0, 3],
      [4, 2], [0, 4], [1, 3], [1, 4], [2, 3]
    ];

    rrPairs.forEach((pair, idx) => {
      matchesToInsert.push({
        matchCode: `RR-M${idx + 1}`,
        stage: 'ROUND_ROBIN',
        title: `Round Robin Match ${idx + 1}`,
        bestOf: 1,
        teamA: teams[pair[0]] ? teams[pair[0]]._id : null,
        teamB: teams[pair[1]] ? teams[pair[1]]._id : null,
        scoreA: 0,
        scoreB: 0,
        status: 'UPCOMING'
      });
    });

    // 2. Play-In Match (Bo3: Seed 4 vs Seed 5)
    matchesToInsert.push({
      matchCode: 'PLAY-IN',
      stage: 'PLAY_IN',
      title: 'Wildcard Play-In (4th vs 5th Seed)',
      bestOf: 3,
      customNameA: '#4 Seed',
      customNameB: '#5 Seed',
      scoreA: 0,
      scoreB: 0,
      status: 'UPCOMING'
    });

    // 3. Double Elimination Playoffs Bracket
    // Upper Semifinal 1 (Seed 1 vs Winner Play-In)
    matchesToInsert.push({
      matchCode: 'UB-SF1',
      stage: 'UPPER_BRACKET',
      title: 'Upper Semifinal 1',
      bestOf: 3,
      customNameA: '#1 Seed',
      customNameB: 'Winner Play-In',
      scoreA: 0,
      scoreB: 0,
      status: 'UPCOMING'
    });

    // Upper Semifinal 2 (Seed 2 vs Seed 3)
    matchesToInsert.push({
      matchCode: 'UB-SF2',
      stage: 'UPPER_BRACKET',
      title: 'Upper Semifinal 2',
      bestOf: 3,
      customNameA: '#2 Seed',
      customNameB: '#3 Seed',
      scoreA: 0,
      scoreB: 0,
      status: 'UPCOMING'
    });

    // Upper Finals
    matchesToInsert.push({
      matchCode: 'UB-FINAL',
      stage: 'UPPER_BRACKET',
      title: 'Upper Bracket Final',
      bestOf: 3,
      customNameA: 'Winner UB-SF1',
      customNameB: 'Winner UB-SF2',
      scoreA: 0,
      scoreB: 0,
      status: 'UPCOMING'
    });

    // Lower Bracket R1 (Loser UB-SF1 vs Loser UB-SF2)
    matchesToInsert.push({
      matchCode: 'LB-R1',
      stage: 'LOWER_BRACKET',
      title: 'Lower Bracket Round 1',
      bestOf: 3,
      customNameA: 'Loser UB-SF1',
      customNameB: 'Loser UB-SF2',
      scoreA: 0,
      scoreB: 0,
      status: 'UPCOMING'
    });

    // Lower Bracket Final (Loser UB-Final vs Winner LB-R1)
    matchesToInsert.push({
      matchCode: 'LB-FINAL',
      stage: 'LOWER_BRACKET',
      title: 'Lower Bracket Final',
      bestOf: 3,
      customNameA: 'Loser UB-Final',
      customNameB: 'Winner LB-R1',
      scoreA: 0,
      scoreB: 0,
      status: 'UPCOMING'
    });

    // Grand Finals (Bo5)
    matchesToInsert.push({
      matchCode: 'GRAND-FINALS',
      stage: 'GRAND_FINALS',
      title: 'Grand Finals',
      bestOf: 5,
      customNameA: 'Upper Champion',
      customNameB: 'Lower Champion',
      scoreA: 0,
      scoreB: 0,
      status: 'UPCOMING'
    });

    await Match.insertMany(matchesToInsert);

    const io = req.app.get('io');
    if (io) io.emit('matchesUpdated');

    res.json({ message: "Full tournament schedule & bracket generated successfully!" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update match score & automatically advance bracket winners
router.put('/:id', authAdmin, async (req, res) => {
  try {
    const { scoreA, scoreB, status, teamA, teamB } = req.body;
    const match = await Match.findById(req.params.id);
    if (!match) return res.status(404).json({ error: "Match not found" });

    match.scoreA = Number(scoreA);
    match.scoreB = Number(scoreB);
    match.status = status;

    if (teamA) match.teamA = teamA;
    if (teamB) match.teamB = teamB;

    if (status === 'COMPLETED') {
      if (match.scoreA > match.scoreB) {
        match.winner = match.teamA;
        match.loser = match.teamB;
      } else if (match.scoreB > match.scoreA) {
        match.winner = match.teamB;
        match.loser = match.teamA;
      }
    }

    await match.save();

    const io = req.app.get('io');
    if (io) io.emit('matchesUpdated');

    res.json(match);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;