// Fixed-point precision: multiply all rates by this to store as integers
const PRECISION = BigInt(1e18);

class Enemy {
  constructor(name, baseKillRatePerMinute, productionBonusPerMinute) {
    this.name = name;
    // Convert to per second and scale by PRECISION for fixed-point arithmetic
    this.baseKillRate = BigInt(Math.floor((baseKillRatePerMinute / 60) * Number(PRECISION)));
    this.productionBonus = BigInt(Math.floor((productionBonusPerMinute / 60) * Number(PRECISION)));
    this.kills = BigInt(0);
    this.accumulated = BigInt(0);
  }

  // Calculate production rate for this enemy (returns scaled BigInt)
  getProductionRate() {
    // Base rate + bonus from kills (both scaled by PRECISION)
    return this.baseKillRate + (this.kills * this.productionBonus);
  }

  // Update enemy state
  update(deltaTime, speedMultiplier) {
    const productionRate = this.getProductionRate();
    // productionRate is in PRECISION units, so actual rate = productionRate / PRECISION
    // toKill (fraction 0-1) = (productionRate / PRECISION) * speedMultiplier * deltaTime
    // Convert back to PRECISION units for accumulation
    const actualRate = Number(productionRate) / Number(PRECISION);
    const toKill = actualRate * speedMultiplier * deltaTime;
    const toKillScaled = BigInt(Math.floor(toKill * Number(PRECISION)));
    
    this.accumulated += toKillScaled;

    // When accumulated reaches PRECISION (1.0 in fixed-point), kill it
    while (this.accumulated >= PRECISION) {
      this.accumulated -= PRECISION;
      this.kills++;
    }
  }

  // Get total kills
  getTotalKills() {
    return this.kills;
  }

  // Get accumulated as a number (0-1) for display
  getAccumulatedFraction() {
    return Number(this.accumulated) / Number(PRECISION);
  }
}

class Game {
  constructor() {
    // Initialize enemies
    this.enemies = {
      grass: new Enemy('Grass', 1, 0.1), // 1 per minute base, 0.1 per minute bonus per kill
      stick: new Enemy('Stick', 1, 0.1), // Same stats for now
    };
    this.lastUpdate = Date.now();
  }

  // Serialize game state for saving
  serialize() {
    const enemies = {};
    for (const [name, enemy] of Object.entries(this.enemies)) {
      enemies[name] = {
        kills: enemy.kills.toString(),
        accumulated: enemy.accumulated.toString()
      };
    }
    return { enemies, lastUpdate: this.lastUpdate };
  }

  // Load game state
  load(data) {
    for (const [name, enemyData] of Object.entries(data.enemies)) {
      if (this.enemies[name]) {
        this.enemies[name].kills = BigInt(enemyData.kills);
        this.enemies[name].accumulated = BigInt(enemyData.accumulated);
      }
    }
    this.lastUpdate = data.lastUpdate;
  }

  // Save game state
  save() {
    const state = this.serialize();
    fetch('/api/save-state', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(state)
    }).catch(err => console.error('Save failed:', err));
  }

  // Calculate total kills across all enemies
  getTotalKills() {
    let total = BigInt(0);
    for (const enemy of Object.values(this.enemies)) {
      total += enemy.getTotalKills();
    }
    return total;
  }

  // Calculate speed multiplier from total kills (returns number for calculations)
  getKillRate() {
    // Grass: 1% faster per kill, Stick: 2% faster per kill (multiplicative)
    const grassKills = Number(this.enemies.grass.getTotalKills());
    const stickKills = Number(this.enemies.stick.getTotalKills());
    const grassMultiplier = 1 + 0.01 * grassKills;
    const stickMultiplier = 1 + 0.02 * stickKills;
    return grassMultiplier * stickMultiplier;
  }

  // Update game state
  update() {
    const now = Date.now();
    const deltaTime = (now - this.lastUpdate) / 1000; // Convert to seconds
    this.lastUpdate = now;

    const speedMultiplier = this.getKillRate();

    // Update all enemies
    for (const enemy of Object.values(this.enemies)) {
      enemy.update(deltaTime, speedMultiplier);
    }
  }

  // Progress one enemy by one second
  progressKill(enemyName) {
    if (this.enemies[enemyName]) {
      const speedMultiplier = this.getKillRate();
      this.enemies[enemyName].update(1, speedMultiplier);
    }
  }

  // Reset all progress
  resetProgress() {
    for (const enemy of Object.values(this.enemies)) {
      enemy.kills = BigInt(0);
      enemy.accumulated = BigInt(0);
    }
    this.save();
    this.updateDisplay();
  }

  // Format BigInt for display
  formatBigInt(value) {
    const num = Number(value);
    if (num >= 1e12) {
      return (num / 1e12).toFixed(2) + 'T';
    } else if (num >= 1e9) {
      return (num / 1e9).toFixed(2) + 'B';
    } else if (num >= 1e6) {
      return (num / 1e6).toFixed(2) + 'M';
    } else if (num >= 1e3) {
      return (num / 1e3).toFixed(2) + 'K';
    }
    return num.toLocaleString();
  }

  // Update the display
  updateDisplay() {
    // Update stats
    document.getElementById('total-kills').textContent = this.formatBigInt(this.getTotalKills());
    document.getElementById('speed-multiplier').textContent = (this.getKillRate() * 100).toFixed(2) + '%';

    // Update enemy panels
    for (const [key, enemy] of Object.entries(this.enemies)) {
      const productionRate = Number(enemy.getProductionRate()) / Number(PRECISION);
      const killRate = this.getKillRate();
      const effectiveRate = productionRate * killRate;
      const accumulated = enemy.getAccumulatedFraction();
      const nextKillTime = accumulated >= 1 ? 0 : (1 - accumulated) / effectiveRate;
      
      // Update enemy stats
      const panel = document.getElementById(`enemy-${key}`);
      if (panel) {
        panel.querySelector('.kills').textContent = this.formatBigInt(enemy.getTotalKills());
        panel.querySelector('.rate').textContent = (effectiveRate * 60).toFixed(3) + '/min';
        panel.querySelector('.next-kill').textContent = nextKillTime.toFixed(1) + 's';
        panel.querySelector('.progress-bar').style.width = (accumulated * 100) + '%';
      }
    }
  }

  // Start the game loop
  async start() {
    // Load game state
    try {
      const response = await fetch('/api/game-state');
      if (response.ok) {
        const data = await response.json();
        if (data.enemies && Object.keys(data.enemies).length > 0) {
          this.load(data);
          // Calculate offline progress
          const now = Date.now();
          const offlineTime = (now - this.lastUpdate) / 1000;
          if (offlineTime > 0) {
            // Simulate offline updates
            const speedMultiplier = this.getKillRate();
            for (const enemy of Object.values(this.enemies)) {
              enemy.update(offlineTime, speedMultiplier);
            }
          }
          this.lastUpdate = now;
        }
      }
    } catch (err) {
      console.error('Load failed:', err);
    }

    // Create enemy panels dynamically
    const enemiesContainer = document.getElementById('enemies');
    for (const [key, enemy] of Object.entries(this.enemies)) {
      const panel = document.createElement('div');
      panel.className = 'enemy-panel';
      panel.id = `enemy-${key}`;
      panel.innerHTML = `
        <div class="enemy-header">
          <div class="enemy-name">${enemy.name}</div>
          <button class="manual-kill-btn" onclick="game.progressKill('${key}')">Progress 1 second</button>
        </div>
        <div class="enemy-stats">
          <div class="enemy-stat">
            <span class="label">Killed</span>
            <span class="value kills">0</span>
          </div>
          <div class="enemy-stat">
            <span class="label">Rate</span>
            <span class="value rate">0.000/min</span>
          </div>
          <div class="enemy-stat">
            <span class="label">Next Kill</span>
            <span class="value next-kill">0.0s</span>
          </div>
        </div>
        <div class="progress-container">
          <div class="progress-bar"></div>
        </div>
      `;
      enemiesContainer.appendChild(panel);
    }

    // Update and display every 100ms for smooth progress
    setInterval(() => {
      this.update();
      this.updateDisplay();
      // Save state every 10 seconds (100 iterations * 100ms = 10s)
      if (this.saveCounter === undefined) this.saveCounter = 0;
      this.saveCounter++;
      if (this.saveCounter >= 100) {
        this.saveCounter = 0;
        this.save();
      }
    }, 100);

    // Options modal
    const optionsBtn = document.getElementById('options-btn');
    const optionsModal = document.getElementById('options-modal');
    const resetProgressBtn = document.getElementById('reset-progress-btn');
    const closeModalBtn = document.getElementById('close-modal-btn');

    optionsBtn.addEventListener('click', () => {
      optionsModal.style.display = 'block';
    });

    closeModalBtn.addEventListener('click', () => {
      optionsModal.style.display = 'none';
    });

    resetProgressBtn.addEventListener('click', () => {
      if (confirm('Are you sure you want to reset all progress? This cannot be undone.')) {
        game.resetProgress();
        optionsModal.style.display = 'none';
      }
    });

    // Close modal when clicking outside
    window.addEventListener('click', (event) => {
      if (event.target === optionsModal) {
        optionsModal.style.display = 'none';
      }
    });
  }
}

// Start the game
const game = new Game();
game.start();