require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const path = require('path');
const connectDB = require('./db');
const teamRoutes = require('./routes/teamRoutes');

const app = express();
const server = http.createServer(app);

// Socket.io for Real-Time Sync
const io = new Server(server, {
  cors: { origin: "*", methods: ["GET", "POST", "PUT", "DELETE"] }
});
app.set('io', io);

// Connect MongoDB
connectDB();

app.use(cors());
app.use(express.json());

// Serve Static Assets & Frontend
app.use(express.static(path.join(__dirname, 'public')));
app.use('/assets', express.static(path.join(__dirname, 'assets')));

// Team API
app.use('/api/teams', teamRoutes);

io.on('connection', (socket) => {
  console.log(`[Socket] User connected: ${socket.id}`);
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`🚀 Server running on http://localhost:${PORT}`));