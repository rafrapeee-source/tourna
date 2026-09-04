const express = require('express');
const router = express.Router();
const Team = require('../models/Team');

const ADMIN_SECRET_KEY = process.env.ADMIN_SECRET_KEY || "IHS_ADMIN_2025";

const authAdmin = (req, res, next) => {
  const token = req.headers['x-admin-key'];
  if (token !== ADMIN_SECRET_KEY) {
    return res.status(403).json({ error: "Unauthorized access" });
  }
  next();
};

// GET all teams
router.get('/', async (req, res) => {
  try {
    const teams = await Team.find().sort({ seed: 1, createdAt: 1 }).limit(5);
    res.json(teams);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST new team (Max 5)
router.post('/', authAdmin, async (req, res) => {
  try {
    const count = await Team.countDocuments();
    if (count >= 5) {
      return res.status(400).json({ error: "Maximum limit of 5 teams reached." });
    }

    const { name, tag, players, seed } = req.body;
    const newTeam = await Team.create({
      name,
      tag: tag.toUpperCase(),
      players,
      seed: seed || (count + 1)
    });

    const io = req.app.get('io');
    if (io) io.emit('teamsUpdated');

    res.status(201).json(newTeam);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// PUT update team
router.put('/:id', authAdmin, async (req, res) => {
  try {
    const { name, tag, players, seed } = req.body;
    const updatedTeam = await Team.findByIdAndUpdate(
      req.params.id,
      { name, tag: tag.toUpperCase(), players, seed },
      { new: true }
    );

    const io = req.app.get('io');
    if (io) io.emit('teamsUpdated');

    res.json(updatedTeam);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// DELETE team
router.delete('/:id', authAdmin, async (req, res) => {
  try {
    await Team.findByIdAndDelete(req.params.id);

    const io = req.app.get('io');
    if (io) io.emit('teamsUpdated');

    res.json({ message: "Team deleted successfully" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;