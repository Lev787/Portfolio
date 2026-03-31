const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

const STORAGE_KEY = "canvas_apocalypse_highscore";

const GAME_STATES = Object.freeze({
  MENU: "menu",
  PLAY: "play",
  PAUSED: "paused",
  COUNTDOWN: "countdown",
  GAME_OVER: "game_over"
});

const DIFFICULTIES = Object.freeze({
  easy: Object.freeze({
    label: "Easy",
    baseEnemySpeed: 95,
    baseSpawnInterval: 3.4,
    scalingRate: 0.08
  }),
  medium: Object.freeze({
    label: "Medium",
    baseEnemySpeed: 125,
    baseSpawnInterval: 3.0,
    scalingRate: 0.12
  }),
  hard: Object.freeze({
    label: "Hard",
    baseEnemySpeed: 155,
    baseSpawnInterval: 2.5,
    scalingRate: 0.16
  })
});

const DIFFICULTY_KEYS = Object.keys(DIFFICULTIES);

const SETTINGS = Object.freeze({
  width: 800,
  height: 600,
  playerSize: 20,
  playerSpeed: 280,
  enemyRadius: 10,
  particleCount: 30,
  backgroundDotCount: 44,
  backgroundGridSize: 40,
  maxDeltaTime: 0.05,
  uiPadding: 18,
  minSpawnInterval: 0.85,
  scoreRate: 12,
  screenShakeDuration: 0.2,
  screenShakeIntensity: 10,
  pauseButtonWidth: 90,
  pauseButtonHeight: 36,
  pauseMenuWidth: 360,
  pauseMenuHeight: 380,
  pauseMenuButtonWidth: 240,
  pauseMenuButtonHeight: 48,
  pauseMenuButtonGap: 16,
  resumeCountdownSeconds: 3,
  goDisplayDuration: 0.65,
  resumeSlowMoDuration: 2,
  resumeSlowMoStartScale: 0.12
});

const MOVEMENT_KEYS = new Set([
  "w",
  "a",
  "s",
  "d",
  "arrowup",
  "arrowleft",
  "arrowdown",
  "arrowright"
]);

canvas.width = SETTINGS.width;
canvas.height = SETTINGS.height;

const state = {
  mode: GAME_STATES.MENU,
  keysPressed: Object.create(null),
  player: createPlayer(),
  enemies: [],
  particles: [],
  backgroundDots: createBackgroundDots(SETTINGS.backgroundDotCount),
  backgroundGridOffsetX: 0,
  backgroundGridOffsetY: 0,
  difficulty: null,
  selectedDifficultyKey: null,
  spawnTimer: 0,
  survivedTime: 0,
  score: 0,
  highScores: loadHighScores(),
  lastTimestamp: 0,
  screenShakeTime: 0,
  resumeCountdownTime: 0,
  goTextTime: 0,
  resumeSlowMoTime: 0,
  mouse: {
    x: 0,
    y: 0,
    inside: false
  }
};

window.addEventListener("keydown", handleKeyDown);
window.addEventListener("keyup", handleKeyUp);
window.addEventListener("blur", clearMovementInput);
canvas.addEventListener("mousemove", handleCanvasMouseMove);
canvas.addEventListener("mouseleave", handleCanvasMouseLeave);
canvas.addEventListener("click", handleCanvasClick);

requestAnimationFrame(gameLoop);

function createPlayer() {
  return {
    x: SETTINGS.width / 2 - SETTINGS.playerSize / 2,
    y: SETTINGS.height / 2 - SETTINGS.playerSize / 2,
    size: SETTINGS.playerSize,
    speed: SETTINGS.playerSpeed
  };
}

function createBackgroundDots(count) {
  const dots = [];

  for (let index = 0; index < count; index += 1) {
    dots.push({
      x: Math.random() * SETTINGS.width,
      y: Math.random() * SETTINGS.height,
      radius: randomRange(1.2, 2.8),
      driftX: randomRange(-8, 8),
      speedY: randomRange(10, 26),
      alpha: randomRange(0.12, 0.35)
    });
  }

  return dots;
}

function handleKeyDown(event) {
  const key = event.key.toLowerCase();

  if (MOVEMENT_KEYS.has(key)) {
    if (state.mode === GAME_STATES.PLAY || state.mode === GAME_STATES.COUNTDOWN) {
      state.keysPressed[key] = true;
    }

    event.preventDefault();
  }

  if (state.mode === GAME_STATES.MENU) {
    if (key === "1") {
      startGame("easy");
    } else if (key === "2") {
      startGame("medium");
    } else if (key === "3") {
      startGame("hard");
    }

    return;
  }

  if (state.mode === GAME_STATES.PLAY && (key === "p" || key === "escape")) {
    pauseGame();
    event.preventDefault();
    return;
  }

  if (state.mode === GAME_STATES.PAUSED) {
    if (key === "p" || key === "escape" || key === "enter") {
      beginResumeCountdown();
      event.preventDefault();
    } else if (key === "r" && state.selectedDifficultyKey) {
      startGame(state.selectedDifficultyKey);
      event.preventDefault();
    } else if (key === "m") {
      returnToMenu();
      event.preventDefault();
    }

    return;
  }

  if (state.mode === GAME_STATES.GAME_OVER) {
    if (key === "r" && state.selectedDifficultyKey) {
      startGame(state.selectedDifficultyKey);
      event.preventDefault();
    } else if (key === "m" || key === "escape") {
      returnToMenu();
      event.preventDefault();
    }
  }
}

function handleKeyUp(event) {
  const key = event.key.toLowerCase();

  if (MOVEMENT_KEYS.has(key)) {
    delete state.keysPressed[key];
    event.preventDefault();
  }
}

function handleCanvasMouseMove(event) {
  const pointer = getCanvasPointerPosition(event);

  state.mouse.x = pointer.x;
  state.mouse.y = pointer.y;
  state.mouse.inside = true;
  syncCanvasCursor();
}

function handleCanvasMouseLeave() {
  state.mouse.inside = false;
  syncCanvasCursor();
}

function handleCanvasClick(event) {
  const pointer = getCanvasPointerPosition(event);

  if (state.mode === GAME_STATES.PLAY && isPointInRect(pointer, getPauseButtonRect())) {
    pauseGame();
    return;
  }

  if (state.mode !== GAME_STATES.PAUSED) {
    return;
  }

  const buttons = getPauseMenuButtons();

  for (let index = 0; index < buttons.length; index += 1) {
    const button = buttons[index];

    if (!isPointInRect(pointer, button)) {
      continue;
    }

    if (button.action === "resume") {
      beginResumeCountdown();
    } else if (button.action === "restart" && state.selectedDifficultyKey) {
      startGame(state.selectedDifficultyKey);
    } else if (button.action === "menu") {
      returnToMenu();
    }

    break;
  }
}

function clearMovementInput() {
  state.keysPressed = Object.create(null);
}

function startGame(difficultyKey) {
  state.mode = GAME_STATES.PLAY;
  state.difficulty = DIFFICULTIES[difficultyKey];
  state.selectedDifficultyKey = difficultyKey;
  state.keysPressed = Object.create(null);
  state.player = createPlayer();
  state.enemies = [];
  state.particles = [];
  state.spawnTimer = 0;
  state.survivedTime = 0;
  state.score = 0;
  state.screenShakeTime = 0;
  state.resumeCountdownTime = 0;
  state.goTextTime = 0;
  state.resumeSlowMoTime = 0;

  spawnEnemy();
  syncCanvasCursor();
}

function pauseGame() {
  if (state.mode !== GAME_STATES.PLAY) {
    return;
  }

  clearMovementInput();
  updateHighScores();
  state.mode = GAME_STATES.PAUSED;
  state.resumeCountdownTime = 0;
  state.goTextTime = 0;
  state.resumeSlowMoTime = 0;
  syncCanvasCursor();
}

function beginResumeCountdown() {
  if (state.mode !== GAME_STATES.PAUSED) {
    return;
  }

  clearMovementInput();
  state.mode = GAME_STATES.COUNTDOWN;
  state.resumeCountdownTime = SETTINGS.resumeCountdownSeconds + 0.01;
  state.goTextTime = 0;
  state.resumeSlowMoTime = 0;
  syncCanvasCursor();
}

function finishResumeCountdown() {
  state.mode = GAME_STATES.PLAY;
  state.resumeCountdownTime = 0;
  state.goTextTime = SETTINGS.goDisplayDuration;
  state.resumeSlowMoTime = SETTINGS.resumeSlowMoDuration;
  syncCanvasCursor();
}

function returnToMenu() {
  updateHighScores();
  state.mode = GAME_STATES.MENU;
  state.keysPressed = Object.create(null);
  state.player = createPlayer();
  state.enemies = [];
  state.particles = [];
  state.difficulty = null;
  state.selectedDifficultyKey = null;
  state.spawnTimer = 0;
  state.survivedTime = 0;
  state.score = 0;
  state.screenShakeTime = 0;
  state.resumeCountdownTime = 0;
  state.goTextTime = 0;
  state.resumeSlowMoTime = 0;
  syncCanvasCursor();
}

function gameLoop(timestamp) {
  if (state.lastTimestamp === 0) {
    state.lastTimestamp = timestamp;
  }

  const deltaTime = Math.min((timestamp - state.lastTimestamp) / 1000, SETTINGS.maxDeltaTime);
  state.lastTimestamp = timestamp;

  update(deltaTime);
  draw();

  requestAnimationFrame(gameLoop);
}

function update(deltaTime) {
  if (state.mode === GAME_STATES.COUNTDOWN) {
    updateCountdown(deltaTime);
    return;
  }

  if (state.mode === GAME_STATES.PAUSED) {
    return;
  }

  const timeScale = state.mode === GAME_STATES.PLAY ? getGameplayTimeScale() : 1;
  const scaledDeltaTime = deltaTime * timeScale;

  updateBackground(scaledDeltaTime);
  updateScreenShake(deltaTime);
  updateParticles(scaledDeltaTime);

  if (state.mode !== GAME_STATES.PLAY) {
    return;
  }

  updatePlayer(scaledDeltaTime);
  updateEnemies(scaledDeltaTime);

  if (state.mode !== GAME_STATES.PLAY) {
    return;
  }

  updateSpawning(scaledDeltaTime);
  state.survivedTime += scaledDeltaTime;
  state.score += scaledDeltaTime * SETTINGS.scoreRate;
  updateHighScores();
  updateResumeEffects(deltaTime);
}

function updateCountdown(deltaTime) {
  state.resumeCountdownTime = Math.max(0, state.resumeCountdownTime - deltaTime);

  if (state.resumeCountdownTime <= 0) {
    finishResumeCountdown();
  }
}

function updateBackground(deltaTime) {
  state.backgroundGridOffsetX = (state.backgroundGridOffsetX + deltaTime * 10) % SETTINGS.backgroundGridSize;
  state.backgroundGridOffsetY = (state.backgroundGridOffsetY + deltaTime * 16) % SETTINGS.backgroundGridSize;

  for (let index = 0; index < state.backgroundDots.length; index += 1) {
    const dot = state.backgroundDots[index];

    dot.x += dot.driftX * deltaTime;
    dot.y += dot.speedY * deltaTime;

    if (dot.x < -dot.radius) {
      dot.x = SETTINGS.width + dot.radius;
    } else if (dot.x > SETTINGS.width + dot.radius) {
      dot.x = -dot.radius;
    }

    if (dot.y > SETTINGS.height + dot.radius) {
      dot.y = -dot.radius;
      dot.x = Math.random() * SETTINGS.width;
    }
  }
}

function updateScreenShake(deltaTime) {
  state.screenShakeTime = Math.max(0, state.screenShakeTime - deltaTime);
}

function updateResumeEffects(deltaTime) {
  state.goTextTime = Math.max(0, state.goTextTime - deltaTime);
  state.resumeSlowMoTime = Math.max(0, state.resumeSlowMoTime - deltaTime);
}

function updatePlayer(deltaTime) {
  let moveX = 0;
  let moveY = 0;

  if (state.keysPressed.a || state.keysPressed.arrowleft) {
    moveX -= 1;
  }

  if (state.keysPressed.d || state.keysPressed.arrowright) {
    moveX += 1;
  }

  if (state.keysPressed.w || state.keysPressed.arrowup) {
    moveY -= 1;
  }

  if (state.keysPressed.s || state.keysPressed.arrowdown) {
    moveY += 1;
  }

  if (moveX !== 0 || moveY !== 0) {
    const length = Math.hypot(moveX, moveY) || 1;
    const normalizedX = moveX / length;
    const normalizedY = moveY / length;

    state.player.x += normalizedX * state.player.speed * deltaTime;
    state.player.y += normalizedY * state.player.speed * deltaTime;
  }

  state.player.x = clamp(state.player.x, 0, SETTINGS.width - state.player.size);
  state.player.y = clamp(state.player.y, 0, SETTINGS.height - state.player.size);
}

function updateEnemies(deltaTime) {
  const playerCenterX = state.player.x + state.player.size / 2;
  const playerCenterY = state.player.y + state.player.size / 2;

  for (let index = 0; index < state.enemies.length; index += 1) {
    const enemy = state.enemies[index];
    const directionX = playerCenterX - enemy.x;
    const directionY = playerCenterY - enemy.y;
    const distance = Math.hypot(directionX, directionY) || 1;

    enemy.x += (directionX / distance) * enemy.speed * deltaTime;
    enemy.y += (directionY / distance) * enemy.speed * deltaTime;

    if (circleIntersectsRectangle(enemy.x, enemy.y, enemy.radius, state.player)) {
      triggerGameOver(enemy.x, enemy.y);
      break;
    }
  }
}

function updateSpawning(deltaTime) {
  state.spawnTimer += deltaTime;
  let currentSpawnInterval = getCurrentSpawnInterval();

  while (state.spawnTimer >= currentSpawnInterval) {
    state.spawnTimer -= currentSpawnInterval;
    spawnEnemy();
    currentSpawnInterval = getCurrentSpawnInterval();
  }
}

function updateParticles(deltaTime) {
  for (let index = state.particles.length - 1; index >= 0; index -= 1) {
    const particle = state.particles[index];

    particle.life -= deltaTime;
    particle.x += particle.velocityX * deltaTime;
    particle.y += particle.velocityY * deltaTime;
    particle.velocityX *= 0.985;
    particle.velocityY *= 0.985;

    if (particle.life <= 0) {
      state.particles.splice(index, 1);
    }
  }
}

function getCurrentEnemySpeed() {
  if (!state.difficulty) {
    return 0;
  }

  return state.difficulty.baseEnemySpeed + state.survivedTime * state.difficulty.scalingRate * 10;
}

function getCurrentSpawnInterval() {
  if (!state.difficulty) {
    return Number.POSITIVE_INFINITY;
  }

  const decreasedInterval = state.difficulty.baseSpawnInterval - state.survivedTime * state.difficulty.scalingRate * 0.18;
  return Math.max(SETTINGS.minSpawnInterval, decreasedInterval);
}

function getGameplayTimeScale() {
  if (state.resumeSlowMoTime <= 0) {
    return 1;
  }

  const progress = 1 - state.resumeSlowMoTime / SETTINGS.resumeSlowMoDuration;
  return SETTINGS.resumeSlowMoStartScale + progress * (1 - SETTINGS.resumeSlowMoStartScale);
}

function spawnEnemy() {
  const radius = SETTINGS.enemyRadius;
  const side = Math.floor(Math.random() * 4);
  let x = 0;
  let y = 0;

  if (side === 0) {
    x = Math.random() * SETTINGS.width;
    y = -radius;
  } else if (side === 1) {
    x = SETTINGS.width + radius;
    y = Math.random() * SETTINGS.height;
  } else if (side === 2) {
    x = Math.random() * SETTINGS.width;
    y = SETTINGS.height + radius;
  } else {
    x = -radius;
    y = Math.random() * SETTINGS.height;
  }

  state.enemies.push({
    x,
    y,
    radius,
    speed: getCurrentEnemySpeed()
  });
}

function triggerGameOver(collisionX, collisionY) {
  if (state.mode !== GAME_STATES.PLAY) {
    return;
  }

  state.mode = GAME_STATES.GAME_OVER;
  state.screenShakeTime = SETTINGS.screenShakeDuration;
  state.resumeCountdownTime = 0;
  state.goTextTime = 0;
  state.resumeSlowMoTime = 0;
  spawnExplosion(collisionX, collisionY);
  updateHighScores();
  syncCanvasCursor();
}

function spawnExplosion(x, y) {
  for (let index = 0; index < SETTINGS.particleCount; index += 1) {
    const angle = Math.random() * Math.PI * 2;
    const speed = randomRange(90, 240);

    state.particles.push({
      x,
      y,
      velocityX: Math.cos(angle) * speed,
      velocityY: Math.sin(angle) * speed,
      radius: randomRange(2, 4.5),
      life: randomRange(0.35, 0.8),
      maxLife: 0.8,
      color: Math.random() > 0.3 ? "#ff835c" : "#ffe082"
    });
  }
}

function updateHighScores() {
  if (!state.selectedDifficultyKey) {
    return;
  }

  const safeScore = Math.floor(state.score);
  const currentDifficultyBest = getDifficultyHighScore(state.selectedDifficultyKey);

  if (safeScore <= currentDifficultyBest) {
    return;
  }

  state.highScores[state.selectedDifficultyKey] = safeScore;

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state.highScores));
  } catch (error) {
    // Ignore storage failures so the game keeps working in restricted contexts.
  }
}

function loadHighScores() {
  const fallback = createEmptyHighScores();
  let storedValue = null;

  try {
    storedValue = localStorage.getItem(STORAGE_KEY);
  } catch (error) {
    return fallback;
  }

  if (!storedValue) {
    return fallback;
  }

  try {
    const parsedObject = JSON.parse(storedValue);

    if (typeof parsedObject === "number" && Number.isFinite(parsedObject) && parsedObject > 0) {
      for (let index = 0; index < DIFFICULTY_KEYS.length; index += 1) {
        fallback[DIFFICULTY_KEYS[index]] = parsedObject;
      }

      return fallback;
    }

    if (parsedObject && typeof parsedObject === "object") {
      for (let index = 0; index < DIFFICULTY_KEYS.length; index += 1) {
        const difficultyKey = DIFFICULTY_KEYS[index];
        const rawValue = Number.parseInt(parsedObject[difficultyKey] ?? "0", 10);
        fallback[difficultyKey] = Number.isFinite(rawValue) && rawValue > 0 ? rawValue : 0;
      }

      return fallback;
    }
  } catch (error) {
    // Fall back to legacy numeric parsing below.
  }

  const parsedLegacyValue = Number.parseInt(storedValue, 10);

  if (Number.isFinite(parsedLegacyValue) && parsedLegacyValue > 0) {
    for (let index = 0; index < DIFFICULTY_KEYS.length; index += 1) {
      fallback[DIFFICULTY_KEYS[index]] = parsedLegacyValue;
    }
  }

  return fallback;
}

function createEmptyHighScores() {
  return {
    easy: 0,
    medium: 0,
    hard: 0
  };
}

function getDifficultyHighScore(difficultyKey) {
  return state.highScores[difficultyKey] ?? 0;
}

function draw() {
  ctx.clearRect(0, 0, SETTINGS.width, SETTINGS.height);

  const shakeOffset = getScreenShakeOffset();

  ctx.save();
  ctx.translate(shakeOffset.x, shakeOffset.y);
  drawBackground();

  if (state.mode !== GAME_STATES.MENU) {
    drawEnemies();
    drawPlayer();
    drawParticles();
  }

  ctx.restore();

  if (state.mode !== GAME_STATES.MENU) {
    drawHud();
  }

  if (state.mode === GAME_STATES.MENU) {
    drawMenu();
  } else if (state.mode === GAME_STATES.PAUSED) {
    drawPauseOverlay();
  } else if (state.mode === GAME_STATES.GAME_OVER) {
    drawGameOverOverlay();
  }

  if (state.mode === GAME_STATES.COUNTDOWN || state.goTextTime > 0 || state.resumeSlowMoTime > 0) {
    drawResumeOverlay();
  }
}

function drawBackground() {
  const gradient = ctx.createLinearGradient(0, 0, 0, SETTINGS.height);
  gradient.addColorStop(0, "#0d1828");
  gradient.addColorStop(1, "#050912");

  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, SETTINGS.width, SETTINGS.height);

  ctx.strokeStyle = "rgba(110, 165, 255, 0.08)";
  ctx.lineWidth = 1;

  for (
    let x = -SETTINGS.backgroundGridSize + state.backgroundGridOffsetX;
    x < SETTINGS.width + SETTINGS.backgroundGridSize;
    x += SETTINGS.backgroundGridSize
  ) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, SETTINGS.height);
    ctx.stroke();
  }

  for (
    let y = -SETTINGS.backgroundGridSize + state.backgroundGridOffsetY;
    y < SETTINGS.height + SETTINGS.backgroundGridSize;
    y += SETTINGS.backgroundGridSize
  ) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(SETTINGS.width, y);
    ctx.stroke();
  }

  for (let index = 0; index < state.backgroundDots.length; index += 1) {
    const dot = state.backgroundDots[index];

    ctx.fillStyle = `rgba(148, 197, 255, ${dot.alpha})`;
    ctx.beginPath();
    ctx.arc(dot.x, dot.y, dot.radius, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawPlayer() {
  ctx.fillStyle = "#33d05a";
  ctx.shadowColor = "rgba(51, 208, 90, 0.45)";
  ctx.shadowBlur = 12;
  ctx.fillRect(state.player.x, state.player.y, state.player.size, state.player.size);
  ctx.shadowBlur = 0;
}

function drawEnemies() {
  ctx.fillStyle = "#ff5b5b";

  for (let index = 0; index < state.enemies.length; index += 1) {
    const enemy = state.enemies[index];

    ctx.beginPath();
    ctx.arc(enemy.x, enemy.y, enemy.radius, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawParticles() {
  for (let index = 0; index < state.particles.length; index += 1) {
    const particle = state.particles[index];
    const alpha = clamp(particle.life / particle.maxLife, 0, 1);

    ctx.fillStyle = hexToRgba(particle.color, alpha);
    ctx.beginPath();
    ctx.arc(particle.x, particle.y, particle.radius, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawHud() {
  ctx.save();
  ctx.textBaseline = "top";
  ctx.textAlign = "left";

  ctx.fillStyle = "rgba(8, 14, 24, 0.55)";
  ctx.fillRect(10, 10, 170, 90);

  ctx.font = "bold 20px Trebuchet MS";
  ctx.fillStyle = "#eff6ff";
  ctx.fillText(`Time: ${state.survivedTime.toFixed(1)}s`, SETTINGS.uiPadding, SETTINGS.uiPadding);

  ctx.font = "18px Trebuchet MS";
  ctx.fillStyle = "#8dd4ff";
  ctx.fillText(`Score: ${Math.floor(state.score)}`, SETTINGS.uiPadding, SETTINGS.uiPadding + 28);
  ctx.fillText(`Best: ${getCurrentDifficultyHighScore()}`, SETTINGS.uiPadding, SETTINGS.uiPadding + 54);

  if (state.difficulty) {
    const pauseButton = getPauseButtonRect();

    ctx.textAlign = "right";
    ctx.font = "bold 20px Trebuchet MS";
    ctx.fillStyle = "#ffd97a";
    ctx.fillText(state.difficulty.label, pauseButton.x - 16, SETTINGS.uiPadding);

    ctx.font = "16px Trebuchet MS";
    ctx.fillStyle = "#bcd4f2";
    ctx.fillText("P / Esc: Pause", pauseButton.x - 16, SETTINGS.uiPadding + 28);

    if (state.mode === GAME_STATES.PLAY) {
      drawPauseButton();
    }
  }

  ctx.restore();
}

function drawMenu() {
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  ctx.fillStyle = "rgba(3, 8, 15, 0.52)";
  ctx.fillRect(110, 105, 580, 390);

  ctx.fillStyle = "#f6fbff";
  ctx.font = "bold 54px Trebuchet MS";
  ctx.fillText("Canvas Apocalypse", SETTINGS.width / 2, 165);

  ctx.fillStyle = "#b9c7dc";
  ctx.font = "22px Trebuchet MS";
  ctx.fillText("Stay alive as long as you can.", SETTINGS.width / 2, 220);
  ctx.fillText("Move with WASD or Arrow Keys.", SETTINGS.width / 2, 255);

  ctx.font = "bold 28px Trebuchet MS";
  ctx.fillStyle = "#89f0a4";
  ctx.fillText(`1  -  Easy   Best: ${getDifficultyHighScore("easy")}`, SETTINGS.width / 2, 330);
  ctx.fillStyle = "#ffd979";
  ctx.fillText(`2  -  Medium   Best: ${getDifficultyHighScore("medium")}`, SETTINGS.width / 2, 375);
  ctx.fillStyle = "#ff8b70";
  ctx.fillText(`3  -  Hard   Best: ${getDifficultyHighScore("hard")}`, SETTINGS.width / 2, 420);

  ctx.font = "20px Trebuchet MS";
  ctx.fillStyle = "#d8e6f8";
  ctx.fillText("Choose difficulty with 1 / 2 / 3", SETTINGS.width / 2, 470);
}

function drawPauseButton() {
  const button = getPauseButtonRect();
  const isHovered = isMouseHovering(button);

  ctx.fillStyle = isHovered ? "rgba(118, 169, 255, 0.24)" : "rgba(9, 18, 31, 0.72)";
  ctx.strokeStyle = isHovered ? "rgba(164, 205, 255, 0.9)" : "rgba(164, 205, 255, 0.28)";
  ctx.lineWidth = 1.5;
  ctx.fillRect(button.x, button.y, button.width, button.height);
  ctx.strokeRect(button.x, button.y, button.width, button.height);

  ctx.fillStyle = "#edf6ff";
  ctx.fillRect(button.x + 22, button.y + 10, 7, 16);
  ctx.fillRect(button.x + 35, button.y + 10, 7, 16);

  ctx.font = "bold 14px Trebuchet MS";
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.fillStyle = "#cfe6ff";
  ctx.fillText("Pause", button.x + 50, button.y + button.height / 2);
}

function drawPauseOverlay() {
  const panel = getPauseMenuPanelRect();
  const buttons = getPauseMenuButtons();

  ctx.fillStyle = "rgba(4, 9, 16, 0.74)";
  ctx.fillRect(0, 0, SETTINGS.width, SETTINGS.height);

  ctx.fillStyle = "rgba(10, 18, 31, 0.94)";
  ctx.strokeStyle = "rgba(136, 178, 255, 0.28)";
  ctx.lineWidth = 2;
  ctx.fillRect(panel.x, panel.y, panel.width, panel.height);
  ctx.strokeRect(panel.x, panel.y, panel.width, panel.height);

  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = "#eff7ff";
  ctx.font = "bold 48px Trebuchet MS";
  ctx.fillText("PAUSED", SETTINGS.width / 2, panel.y + 54);

  ctx.font = "22px Trebuchet MS";
  ctx.fillStyle = "#bad3f1";
  ctx.fillText(`Current Score: ${Math.floor(state.score)}`, SETTINGS.width / 2, panel.y + 106);
  ctx.fillText(`Best (${state.difficulty.label}): ${getCurrentDifficultyHighScore()}`, SETTINGS.width / 2, panel.y + 138);

  for (let index = 0; index < buttons.length; index += 1) {
    drawPauseMenuButton(buttons[index]);
  }

  ctx.font = "18px Trebuchet MS";
  ctx.fillStyle = "#97afd0";
  ctx.fillText("Click a button or press P / Esc to resume", SETTINGS.width / 2, panel.y + panel.height - 28);
}

function drawPauseMenuButton(button) {
  const isHovered = isMouseHovering(button);

  ctx.fillStyle = isHovered ? "rgba(116, 174, 255, 0.34)" : "rgba(20, 32, 52, 0.96)";
  ctx.strokeStyle = isHovered ? "rgba(174, 214, 255, 0.95)" : "rgba(124, 160, 224, 0.35)";
  ctx.lineWidth = 2;
  ctx.fillRect(button.x, button.y, button.width, button.height);
  ctx.strokeRect(button.x, button.y, button.width, button.height);

  ctx.fillStyle = "#f3f8ff";
  ctx.font = "bold 22px Trebuchet MS";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(button.label, button.x + button.width / 2, button.y + button.height / 2);
}

function drawGameOverOverlay() {
  ctx.fillStyle = "rgba(5, 10, 18, 0.62)";
  ctx.fillRect(0, 0, SETTINGS.width, SETTINGS.height);

  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  ctx.fillStyle = "#ff7878";
  ctx.font = "bold 58px Trebuchet MS";
  ctx.fillText("GAME OVER", SETTINGS.width / 2, SETTINGS.height / 2 - 48);

  ctx.fillStyle = "#edf6ff";
  ctx.font = "24px Trebuchet MS";
  ctx.fillText(`Final Score: ${Math.floor(state.score)}`, SETTINGS.width / 2, SETTINGS.height / 2 + 6);
  ctx.fillText(`Best (${state.difficulty.label}): ${getCurrentDifficultyHighScore()}`, SETTINGS.width / 2, SETTINGS.height / 2 + 42);
  ctx.fillText("Press R to restart", SETTINGS.width / 2, SETTINGS.height / 2 + 92);
  ctx.fillText("Press M or Esc for menu", SETTINGS.width / 2, SETTINGS.height / 2 + 126);
}

function drawResumeOverlay() {
  const countdownLabel = getCountdownLabel();
  const showGoText = state.goTextTime > 0;
  const slowMoStrength = clamp(state.resumeSlowMoTime / SETTINGS.resumeSlowMoDuration, 0, 1);

  if (state.mode === GAME_STATES.COUNTDOWN) {
    ctx.fillStyle = "rgba(3, 8, 15, 0.6)";
    ctx.fillRect(0, 0, SETTINGS.width, SETTINGS.height);
  } else if (slowMoStrength > 0) {
    ctx.fillStyle = `rgba(80, 140, 255, ${0.18 * slowMoStrength})`;
    ctx.fillRect(0, 0, SETTINGS.width, SETTINGS.height);
  }

  if (!countdownLabel && !showGoText) {
    return;
  }

  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = showGoText ? "#8dffb0" : "#edf7ff";
  ctx.font = showGoText ? "bold 74px Trebuchet MS" : "bold 96px Trebuchet MS";
  ctx.fillText(showGoText ? "GO!" : countdownLabel, SETTINGS.width / 2, SETTINGS.height / 2);

  if (showGoText || slowMoStrength > 0) {
    ctx.font = "20px Trebuchet MS";
    ctx.fillStyle = `rgba(217, 236, 255, ${Math.max(0.3, slowMoStrength)})`;
    ctx.fillText("Time flow stabilizing...", SETTINGS.width / 2, SETTINGS.height / 2 + 62);
  }
}

function getCurrentDifficultyHighScore() {
  if (!state.selectedDifficultyKey) {
    return 0;
  }

  return getDifficultyHighScore(state.selectedDifficultyKey);
}

function getPauseButtonRect() {
  return {
    x: SETTINGS.width - SETTINGS.uiPadding - SETTINGS.pauseButtonWidth,
    y: 12,
    width: SETTINGS.pauseButtonWidth,
    height: SETTINGS.pauseButtonHeight
  };
}

function getPauseMenuPanelRect() {
  return {
    x: (SETTINGS.width - SETTINGS.pauseMenuWidth) / 2,
    y: (SETTINGS.height - SETTINGS.pauseMenuHeight) / 2,
    width: SETTINGS.pauseMenuWidth,
    height: SETTINGS.pauseMenuHeight
  };
}

function getPauseMenuButtons() {
  const panel = getPauseMenuPanelRect();
  const buttonX = panel.x + (panel.width - SETTINGS.pauseMenuButtonWidth) / 2;
  const firstButtonY = panel.y + 166;

  return [
    {
      action: "resume",
      label: "Resume",
      x: buttonX,
      y: firstButtonY,
      width: SETTINGS.pauseMenuButtonWidth,
      height: SETTINGS.pauseMenuButtonHeight
    },
    {
      action: "restart",
      label: "Restart Game",
      x: buttonX,
      y: firstButtonY + SETTINGS.pauseMenuButtonHeight + SETTINGS.pauseMenuButtonGap,
      width: SETTINGS.pauseMenuButtonWidth,
      height: SETTINGS.pauseMenuButtonHeight
    },
    {
      action: "menu",
      label: "Back to Menu",
      x: buttonX,
      y: firstButtonY + (SETTINGS.pauseMenuButtonHeight + SETTINGS.pauseMenuButtonGap) * 2,
      width: SETTINGS.pauseMenuButtonWidth,
      height: SETTINGS.pauseMenuButtonHeight
    }
  ];
}

function getCountdownLabel() {
  if (state.mode !== GAME_STATES.COUNTDOWN) {
    return "";
  }

  return String(Math.max(1, Math.ceil(state.resumeCountdownTime)));
}

function getScreenShakeOffset() {
  if (state.screenShakeTime <= 0) {
    return { x: 0, y: 0 };
  }

  const intensity = (state.screenShakeTime / SETTINGS.screenShakeDuration) * SETTINGS.screenShakeIntensity;

  return {
    x: randomRange(-intensity, intensity),
    y: randomRange(-intensity, intensity)
  };
}

function getCanvasPointerPosition(event) {
  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;

  return {
    x: (event.clientX - rect.left) * scaleX,
    y: (event.clientY - rect.top) * scaleY
  };
}

function isMouseHovering(rectangle) {
  if (!state.mouse.inside) {
    return false;
  }

  return isPointInRect(state.mouse, rectangle);
}

function isPointInRect(point, rectangle) {
  return (
    point.x >= rectangle.x &&
    point.x <= rectangle.x + rectangle.width &&
    point.y >= rectangle.y &&
    point.y <= rectangle.y + rectangle.height
  );
}

function syncCanvasCursor() {
  let cursor = "default";

  if (state.mouse.inside) {
    if (state.mode === GAME_STATES.PLAY && isMouseHovering(getPauseButtonRect())) {
      cursor = "pointer";
    } else if (state.mode === GAME_STATES.PAUSED) {
      const buttons = getPauseMenuButtons();

      for (let index = 0; index < buttons.length; index += 1) {
        if (isMouseHovering(buttons[index])) {
          cursor = "pointer";
          break;
        }
      }
    }
  }

  canvas.style.cursor = cursor;
}

function circleIntersectsRectangle(circleX, circleY, radius, rectangle) {
  const closestX = clamp(circleX, rectangle.x, rectangle.x + rectangle.size);
  const closestY = clamp(circleY, rectangle.y, rectangle.y + rectangle.size);
  const distanceX = circleX - closestX;
  const distanceY = circleY - closestY;

  return distanceX * distanceX + distanceY * distanceY <= radius * radius;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function randomRange(min, max) {
  return min + Math.random() * (max - min);
}

function hexToRgba(hexColor, alpha) {
  const normalized = hexColor.replace("#", "");
  const red = Number.parseInt(normalized.slice(0, 2), 16);
  const green = Number.parseInt(normalized.slice(2, 4), 16);
  const blue = Number.parseInt(normalized.slice(4, 6), 16);

  return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
}
