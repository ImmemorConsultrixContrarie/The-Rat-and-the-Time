// The Rat and The Time - Idle Game
// The Rat kills Grass to become stronger

class Game {
  constructor() {
    this.kills = 0;
    this.grassKilled = 0;
    this.baseKillRate = 1 / 60; // 1 Grass per minute = 1/60 per second
    this.grassPerSecond = 0;
    this.lastUpdate = Date.now();
    this.accumulatedGrass = 0;
  }

  // Calculate current kill rate per second
  getKillRate() {
    // Base rate * (1 + 0.01 * kills) for 1% faster per kill (linear)
    return this.baseKillRate * (1 + 0.01 * this.kills);
  }

  // Calculate total production rate (base + accumulated bonuses)
  getProductionRate() {
    // Base: 1/60 per second
    // Each kill adds 0.1 Grass per minute = 0.1/60 per second
    const bonusRate = (this.kills * 0.1) / 60;
    return this.baseKillRate + bonusRate;
  }

  // Manually kill one Grass
  manualKill() {
    this.kills++;
    this.grassKilled++;
  }

  // Update game state
  update() {
    const now = Date.now();
    const deltaTime = (now - this.lastUpdate) / 1000; // Convert to seconds
    this.lastUpdate = now;

    // Calculate how much grass to kill based on current production rate
    const productionRate = this.getProductionRate();
    const grassToKill = productionRate * deltaTime;
    
    this.accumulatedGrass += grassToKill;

    // When accumulated grass reaches 1, kill it
    while (this.accumulatedGrass >= 1) {
      this.accumulatedGrass -= 1;
      this.kills++;
      this.grassKilled++;
    }
  }

  // Display game stats
  display() {
    console.clear();
    console.log("╔════════════════════════════════════╗");
    console.log("║   THE RAT AND THE TIME             ║");
    console.log("╚════════════════════════════════════╝");
    console.log("");
    console.log(`🐀 The Rat has killed: ${this.grassKilled} Grass`);
    console.log(`⚡ Speed multiplier: ${((1 + 0.01 * this.kills) * 100).toFixed(2)}%`);
    console.log(`📊 Current kill rate: ${(this.getProductionRate() * 60).toFixed(3)} Grass/minute`);
    console.log(`⏱️  Next kill in: ${((1 - this.accumulatedGrass) / this.getProductionRate()).toFixed(1)} seconds`);
    console.log("");
    console.log("Press Enter to manually kill 1 Grass | Ctrl+C to exit");
  }

  // Start the game loop
  start() {
    console.log("Starting The Rat and The Time...");
    console.log("The Rat begins hunting Grass!");
    console.log("");

    // Set up stdin for manual input
    process.stdin.setRawMode(true);
    process.stdin.resume();
    process.stdin.setEncoding('utf8');

    // Listen for Enter key (key code 13 or '\r')
    process.stdin.on('data', (key) => {
      if (key === '\r' || key === '\n' || key === '\u000d' || key === '\u000a') {
        this.manualKill();
      }
      // Allow Ctrl+C to exit
      if (key === '\u0003') {
        process.exit();
      }
    });

    // Update and display every 100ms for smooth progress
    setInterval(() => {
      this.update();
      this.display();
    }, 100);
  }
}

// Start the game
const game = new Game();
game.start();
