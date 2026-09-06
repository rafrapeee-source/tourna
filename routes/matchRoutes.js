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

// Build a single round robin schedule with the circle method.
// Every team meets every other team exactly once; with an odd number of teams
// a virtual "bye" slot is added so exactly one team rests each round.
function buildRoundRobinRounds(teamCount) {
  const slots = [];
  for (let i = 0; i < teamCount; i++) slots.push(i);
  if (slots.length % 2 === 1) slots.push(null); // bye

  const size = slots.length;
  const rounds = [];

  for (let r = 0; r < size - 1; r++) {
    const pairs = [];
    for (let i = 0; i < size / 2; i++) {
      const home = slots[i];
      const away = slots[size - 1 - i];
      if (home === null || away === null) continue; // team rests this round
      // Alternate sides per round so no team is always listed first
      pairs.push(r % 2 === 0 ? [home, away] : [away, home]);
    }
    rounds.push(pairs);
    slots.splice(1, 0, slots.pop()); // rotate, first slot pinned
  }

  return rounds;
}

// Generate Full Tournament (Round Robin + Play-In + Double Elim Bracket)
router.post('/generate-tournament', authAdmin, async (req, res) => {
  try {
    const teams = await Team.find().sort({ seed: 1, createdAt: 1 }).limit(5);
    if (teams.length < 2) {
      return res.status(400).json({ error: "Register at least 2 teams first." });
    }

    await Match.deleteMany({});

    const matchesToInsert = [];

    // 1. Bo1 Round Robin — every team faces every other team exactly once
    const rrRounds = buildRoundRobinRounds(teams.length);
    let rrMatchNumber = 0;

    rrRounds.forEach((pairs, roundIdx) => {
      pairs.forEach(([a, b]) => {
        rrMatchNumber++;
        matchesToInsert.push({
          matchCode: `RR-M${rrMatchNumber}`,
          stage: 'ROUND_ROBIN',
          round: roundIdx + 1,
          title: `Round ${roundIdx + 1}: ${teams[a].tag} vs ${teams[b].tag}`,
          bestOf: 1,
          teamA: teams[a]._id,
          teamB: teams[b]._id,
          scoreA: 0,
          scoreB: 0,
          status: 'UPCOMING'
        });
      });
    });

    // 2. Play-In Match (Bo3: 4th vs 5th Seed)
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
    // Upper Semifinal 1: #1 Seed vs #2 Seed
    matchesToInsert.push({
      matchCode: 'UB-SF1',
      stage: 'UPPER_BRACKET',
      title: 'Upper Semifinal 1',
      bestOf: 3,
      customNameA: '#1 Seed',
      customNameB: '#2 Seed',
      scoreA: 0,
      scoreB: 0,
      status: 'UPCOMING'
    });

    // Upper Semifinal 2: #3 Seed vs Play-In Winner
    matchesToInsert.push({
      matchCode: 'UB-SF2',
      stage: 'UPPER_BRACKET',
      title: 'Upper Semifinal 2',
      bestOf: 3,
      customNameA: '#3 Seed',
      customNameB: 'Play-in Winner',
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

    // Lower Bracket R1
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

    // Lower Bracket Final
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

    res.json({
      message: `Schedule generated: ${rrMatchNumber} round robin matches (each team plays every other team exactly once), Play-In, and Double Elimination playoffs.`
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update match score & team assignment
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