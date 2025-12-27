const express = require('express');
const path = require('path');
const Database = require('better-sqlite3');

const app = express();
const port = 3000;

// Initialize database
const db = new Database('game.db');
db.exec(`CREATE TABLE IF NOT EXISTS game_state (
  enemy_name TEXT PRIMARY KEY,
  kills TEXT,
  accumulated TEXT,
  last_update INTEGER
)`);

// Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// API routes
app.get('/api/game-state', (req, res) => {
  const rows = db.prepare('SELECT * FROM game_state').all();
  const enemies = {};
  let lastUpdate = 0;
  for (const row of rows) {
    enemies[row.enemy_name] = {
      kills: row.kills,
      accumulated: row.accumulated
    };
    if (row.last_update > lastUpdate) lastUpdate = row.last_update;
  }
  res.json({ enemies, lastUpdate });
});

app.post('/api/save-state', (req, res) => {
  const { enemies, lastUpdate } = req.body;
  const insert = db.prepare('INSERT OR REPLACE INTO game_state (enemy_name, kills, accumulated, last_update) VALUES (?, ?, ?, ?)');
  for (const [name, data] of Object.entries(enemies)) {
    insert.run(name, data.kills, data.accumulated, lastUpdate);
  }
  res.sendStatus(200);
});

// Start the server
app.listen(port, () => {
  console.log(`The Rat and The Time web server running at http://localhost:${port}`);
});