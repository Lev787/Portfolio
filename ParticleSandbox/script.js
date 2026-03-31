/*
  Particle Sandbox
  ----------------
  This file creates a one-page particle world where every required feature
  runs inside the same canvas:

  1. Brush Physics      -> the brush sprinkles physical particles
  2. Material Types     -> sand / water / gas behave differently
  3. Attract & Repel    -> the brush can pull particles in or push them away
  4. Color Fusion       -> different colors blend on collision
  5. Collision Sound    -> collisions trigger short procedural sounds
  6. Self-Organization  -> particles can align into a word
  7. Wind Force         -> a global wind affects the whole system
  8. Life & Death       -> each particle lives for 10 seconds before entering the respawn queue
  9. Heat Map           -> dense areas are tinted with thermal-style colors
  10. Time Freeze       -> the simulation can stop on the exact current frame

  The code is intentionally well-commented so the result is not only visual,
  but also easy to read and hand over.
*/

const canvas = document.getElementById("sandbox");
const ctx = canvas.getContext("2d");

if (!ctx) {
  throw new Error("Failed to create a 2D canvas context.");
}

// DOM references live in one place so the rest of the code does not keep querying the document.
const ui = {
  brushMode: document.getElementById("brush-mode"),
  materialType: document.getElementById("material-type"),
  particleColor: document.getElementById("particle-color"),
  brushSize: document.getElementById("brush-size"),
  brushSizeValue: document.getElementById("brush-size-value"),
  spawnRate: document.getElementById("spawn-rate"),
  spawnRateValue: document.getElementById("spawn-rate-value"),
  windForce: document.getElementById("wind-force"),
  windForceValue: document.getElementById("wind-force-value"),
  formationText: document.getElementById("formation-text"),
  organizeToggle: document.getElementById("organize-toggle"),
  heatmapToggle: document.getElementById("heatmap-toggle"),
  freezeToggle: document.getElementById("freeze-toggle"),
  soundToggle: document.getElementById("sound-toggle"),
  screenshotButton: document.getElementById("screenshot-button"),
  clearButton: document.getElementById("clear-button"),
  liveCount: document.getElementById("live-count"),
  recycleCount: document.getElementById("recycle-count"),
  modeIndicator: document.getElementById("mode-indicator"),
  hintText: document.getElementById("hint-text"),
};

const LIFE_SPAN_SECONDS = 10;
const FIXED_TIME_STEP = 1 / 60;
const MAX_PARTICLES = 2800;
const COLLISION_CELL_SIZE = 18;
const HEAT_CELL_SIZE = 24;

/*
  Material parameters define how the same physics engine behaves as different substances.
  Sand is heavier and slows down faster, water spreads more horizontally,
  and gas uses negative gravity so it rises upward.
*/
const MATERIALS = {
  sand: {
    gravity: 1260,
    jitter: 6,
    lateralDrift: 8,
    damping: 0.974,
    restitution: 0.03,
    radiusMin: 2.8,
    radiusMax: 4.6,
    mass: 1.75,
    organizeGravityScale: 0.26,
    soundTint: "sand",
    collisionFriction: 0.02,
    floorRetention: 0.42,
    settleDamping: 0.34,
    pressureResponse: 18,
    spreadBias: 0,
  },
  water: {
    gravity: 440,
    jitter: 18,
    lateralDrift: 185,
    damping: 0.9955,
    restitution: 0.01,
    radiusMin: 2.1,
    radiusMax: 3.1,
    mass: 0.82,
    organizeGravityScale: 0.34,
    soundTint: "water",
    collisionFriction: 0.002,
    floorRetention: 0.992,
    settleDamping: 0.9,
    pressureResponse: 165,
    spreadBias: 52,
  },
  gas: {
    gravity: -220,
    jitter: 82,
    lateralDrift: 38,
    damping: 0.996,
    restitution: 0.03,
    radiusMin: 1.9,
    radiusMax: 3.1,
    mass: 0.65,
    organizeGravityScale: 0.14,
    soundTint: "gas",
    collisionFriction: 0.0005,
    floorRetention: 0.985,
    settleDamping: 0.96,
    pressureResponse: 34,
    spreadBias: 14,
  },
};

/*
  The central app state stores both the simulated world and the UI-driven state.
  That keeps rendering, input, and physics coordinated as one system.
*/
const state = {
  width: 0,
  height: 0,
  dpr: window.devicePixelRatio || 1,
  simulationTime: 0,
  accumulator: 0,
  lastFrameTime: performance.now(),
  spawnCarry: 0,
  particles: [],
  recycleBin: [],
  nextParticleId: 1,
  liveParticles: 0,
  pointer: {
    x: 0,
    y: 0,
    inside: false,
    down: false,
    motionX: 0,
    motionY: 0,
    lastEventTime: performance.now() / 1000,
  },
  spatialHash: new Map(),
  heatmapEnabled: false,
  frozen: false,
  selfOrganize: false,
  formationTargets: [],
  formationText: "LIFE",
  formationFontSize: 140,
  lastStatsRefresh: 0,
};

class CollisionSoundEngine {
  constructor() {
    this.audioContext = null;
    this.noiseBuffer = null;
    this.enabled = false;
    this.lastTriggerAt = 0;
  }

  /*
    Browsers do not allow audio before the user interacts with the page.
    Because of that, the AudioContext is created only when the sound button is enabled.
  */
  async toggle() {
    if (!this.audioContext) {
      const AudioCtor = window.AudioContext || window.webkitAudioContext;

      if (!AudioCtor) {
        return false;
      }

      this.audioContext = new AudioCtor();
      this.noiseBuffer = this.createNoiseBuffer();
    }

    if (this.audioContext.state === "suspended") {
      await this.audioContext.resume();
    }

    this.enabled = !this.enabled;
    return this.enabled;
  }

  /*
    The noise buffer keeps the tone from sounding too sterile.
    A short burst of random noise adds a crunchy collision texture.
  */
  createNoiseBuffer() {
    const sampleRate = this.audioContext.sampleRate;
    const length = Math.floor(sampleRate * 0.08);
    const buffer = this.audioContext.createBuffer(1, length, sampleRate);
    const channel = buffer.getChannelData(0);

    for (let i = 0; i < channel.length; i += 1) {
      const envelope = 1 - i / channel.length;
      channel[i] = (Math.random() * 2 - 1) * envelope;
    }

    return buffer;
  }

  /*
    Every collision synthesizes a very short sound.
    Stronger impacts are louder and shift slightly depending on the material.
  */
  emit(intensity, materialTint = "sand") {
    if (!this.enabled || !this.audioContext) {
      return;
    }

    const now = this.audioContext.currentTime;

    // Rate limiting prevents thousands of collisions from becoming an unbearable wall of noise.
    if (now - this.lastTriggerAt < 0.045) {
      return;
    }

    this.lastTriggerAt = now;

    const loudness = clamp(intensity, 0, 1);
    const oscillator = this.audioContext.createOscillator();
    const oscillatorGain = this.audioContext.createGain();
    const noise = this.audioContext.createBufferSource();
    const noiseGain = this.audioContext.createGain();
    const noiseFilter = this.audioContext.createBiquadFilter();

    const tonalBase =
      materialTint === "water" ? 220 : materialTint === "gas" ? 380 : 160;

    oscillator.type = materialTint === "gas" ? "sine" : "triangle";
    oscillator.frequency.setValueAtTime(tonalBase + loudness * 240, now);
    oscillator.frequency.exponentialRampToValueAtTime(
      Math.max(70, tonalBase * 0.65),
      now + 0.08,
    );

    oscillatorGain.gain.setValueAtTime(0.0001, now);
    oscillatorGain.gain.exponentialRampToValueAtTime(
      0.018 + loudness * 0.03,
      now + 0.004,
    );
    oscillatorGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.09);

    noise.buffer = this.noiseBuffer;
    noiseFilter.type = "bandpass";
    noiseFilter.frequency.value =
      materialTint === "water" ? 550 : materialTint === "gas" ? 1200 : 1650;
    noiseFilter.Q.value = materialTint === "gas" ? 1.1 : 2.6;

    noiseGain.gain.setValueAtTime(0.0001, now);
    noiseGain.gain.exponentialRampToValueAtTime(
      0.01 + loudness * 0.024,
      now + 0.003,
    );
    noiseGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.06);

    oscillator.connect(oscillatorGain).connect(this.audioContext.destination);
    noise.connect(noiseFilter).connect(noiseGain).connect(this.audioContext.destination);

    oscillator.start(now);
    oscillator.stop(now + 0.1);
    noise.start(now);
    noise.stop(now + 0.065);
  }
}

const soundEngine = new CollisionSoundEngine();

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function lerp(start, end, amount) {
  return start + (end - start) * amount;
}

function randomRange(min, max) {
  return min + Math.random() * (max - min);
}

function randomPointInCircle(radius) {
  const angle = Math.random() * Math.PI * 2;
  const distance = Math.sqrt(Math.random()) * radius;

  return {
    x: Math.cos(angle) * distance,
    y: Math.sin(angle) * distance,
  };
}

function hexToRgb(hexColor) {
  const clean = hexColor.replace("#", "");

  return {
    r: Number.parseInt(clean.slice(0, 2), 16),
    g: Number.parseInt(clean.slice(2, 4), 16),
    b: Number.parseInt(clean.slice(4, 6), 16),
  };
}

function mixColors(colorA, colorB, amount = 0.5) {
  return {
    r: Math.round(lerp(colorA.r, colorB.r, amount)),
    g: Math.round(lerp(colorA.g, colorB.g, amount)),
    b: Math.round(lerp(colorA.b, colorB.b, amount)),
  };
}

function blendIntoColor(target, source, amount) {
  target.r = Math.round(lerp(target.r, source.r, amount));
  target.g = Math.round(lerp(target.g, source.g, amount));
  target.b = Math.round(lerp(target.b, source.b, amount));
}

function colorDistance(colorA, colorB) {
  const dr = colorA.r - colorB.r;
  const dg = colorA.g - colorB.g;
  const db = colorA.b - colorB.b;
  return Math.sqrt(dr * dr + dg * dg + db * db);
}

function rgbToCss(color, alpha = 1) {
  return `rgba(${color.r}, ${color.g}, ${color.b}, ${alpha})`;
}

function shuffle(array) {
  for (let i = array.length - 1; i > 0; i -= 1) {
    const swapIndex = Math.floor(Math.random() * (i + 1));
    [array[i], array[swapIndex]] = [array[swapIndex], array[i]];
  }

  return array;
}

function currentBrushSettings() {
  return {
    material: ui.materialType.value,
    color: hexToRgb(ui.particleColor.value),
    brushSize: Number(ui.brushSize.value),
  };
}

/*
  The recycle bucket allows "death and rebirth" without creating new objects every time.
  It is both a performance optimization and a direct implementation of the respawn requirement.
*/
function acquireParticle() {
  const recycled = state.recycleBin.pop();

  if (recycled) {
    return recycled;
  }

  if (state.particles.length >= MAX_PARTICLES) {
    return null;
  }

  const particle = {
    id: state.nextParticleId,
    active: false,
    x: 0,
    y: 0,
    vx: 0,
    vy: 0,
    radius: 3,
    mass: 1,
    material: "sand",
    color: { r: 255, g: 255, b: 255 },
    bornAt: 0,
    deathAt: LIFE_SPAN_SECONDS,
    noiseSeed: Math.random() * Math.PI * 2,
    cellX: 0,
    cellY: 0,
  };

  state.nextParticleId += 1;
  state.particles.push(particle);
  return particle;
}

function resetParticle(particle, x, y, settings) {
  const material = MATERIALS[settings.material];

  particle.active = true;
  particle.radius = randomRange(material.radiusMin, material.radiusMax);
  particle.x = clamp(x, particle.radius, state.width - particle.radius);
  particle.y = clamp(y, particle.radius, state.height - particle.radius);
  particle.vx = settings.vx;
  particle.vy = settings.vy;
  particle.mass = material.mass * particle.radius;
  particle.material = settings.material;
  particle.color = {
    r: settings.color.r,
    g: settings.color.g,
    b: settings.color.b,
  };
  particle.bornAt = state.simulationTime;
  particle.deathAt = state.simulationTime + LIFE_SPAN_SECONDS;
  particle.noiseSeed = Math.random() * Math.PI * 2;
}

function spawnParticle(x, y, settings) {
  const particle = acquireParticle();

  if (!particle) {
    return false;
  }

  resetParticle(particle, x, y, settings);
  return true;
}

function recycleParticle(particle) {
  if (!particle.active) {
    return;
  }

  particle.active = false;
  particle.vx = 0;
  particle.vy = 0;
  state.recycleBin.push(particle);
}

/*
  On click, expired particles are brought back near the pointer.
  If the recycle bucket is empty, new particles are created so the user never has to wait.
*/
function rebirthBurstAt(x, y, count = 18) {
  if (state.frozen) {
    return;
  }

  const settings = currentBrushSettings();

  for (let i = 0; i < count; i += 1) {
    const offset = randomPointInCircle(settings.brushSize * 0.32);
    const launch = randomPointInCircle(28);
    const didSpawn = spawnParticle(x + offset.x, y + offset.y, {
      material: settings.material,
      color: settings.color,
      vx: launch.x,
      vy: launch.y - 12,
    });

    if (!didSpawn) {
      break;
    }
  }
}

function emitParticlesFromBrush(dt) {
  const settings = currentBrushSettings();
  const rate = Number(ui.spawnRate.value);
  state.spawnCarry += rate * dt;

  while (state.spawnCarry >= 1) {
    state.spawnCarry -= 1;

    const offset = randomPointInCircle(settings.brushSize * 0.48);
    const spray = randomPointInCircle(70);
    const didSpawn = spawnParticle(state.pointer.x + offset.x, state.pointer.y + offset.y, {
      material: settings.material,
      color: settings.color,
      vx: state.pointer.motionX * 0.08 + spray.x,
      vy: state.pointer.motionY * 0.08 + spray.y - 24,
    });

    if (!didSpawn) {
      state.spawnCarry = 0;
      return;
    }
  }
}

function applyBrushField(particle, dt) {
  if (!state.pointer.down || ui.brushMode.value === "sprinkle") {
    return;
  }

  const brushRadius = Number(ui.brushSize.value) * 2.25;
  const dx = state.pointer.x - particle.x;
  const dy = state.pointer.y - particle.y;
  const distanceSquared = dx * dx + dy * dy;

  if (distanceSquared > brushRadius * brushRadius) {
    return;
  }

  const distance = Math.max(Math.sqrt(distanceSquared), 0.001);
  const falloff = 1 - distance / brushRadius;
  const direction = ui.brushMode.value === "attract" ? 1 : -1;
  const fieldStrength = 1400 * falloff;

  particle.vx += (dx / distance) * fieldStrength * direction * dt;
  particle.vy += (dy / distance) * fieldStrength * direction * dt;

  if (ui.brushMode.value === "repel") {
    particle.vx += randomRange(-22, 22) * dt;
    particle.vy += randomRange(-22, 22) * dt;
  }
}

function applyMaterialForces(particle, dt) {
  const material = MATERIALS[particle.material];
  const gravityScale = state.selfOrganize ? material.organizeGravityScale : 1;
  const wind = Number(ui.windForce.value);

  particle.vy += material.gravity * gravityScale * dt;
  particle.vx += randomRange(-material.lateralDrift, material.lateralDrift) * dt;
  particle.vy += randomRange(-material.jitter, material.jitter) * dt * 0.35;

  // Water and gas get an extra ripple or hover pattern so they do not feel too similar.
  if (particle.material === "water") {
    particle.vx += Math.sin(state.simulationTime * 4 + particle.noiseSeed) * 18 * dt;
  }

  if (particle.material === "gas") {
    particle.vx += Math.cos(state.simulationTime * 3.2 + particle.noiseSeed) * 16 * dt;
    particle.vy -= 18 * dt;
  }

  particle.vx += (wind / Math.max(particle.mass, 0.35)) * dt;

  const damping = Math.pow(material.damping, dt * 60);
  particle.vx *= damping;
  particle.vy *= damping;
}

function applyFormationForce(particle, dt) {
  if (!state.selfOrganize || state.formationTargets.length === 0) {
    return;
  }

  const target = state.formationTargets[particle.id % state.formationTargets.length];

  if (!target) {
    return;
  }

  const dx = target.x - particle.x;
  const dy = target.y - particle.y;
  const distance = Math.max(Math.hypot(dx, dy), 0.001);
  const settleBoost = distance < 14 ? 0.5 : 1;
  const attraction = 3.2 * settleBoost;

  particle.vx += dx * attraction * dt;
  particle.vy += dy * attraction * dt;
  particle.vx *= 0.974;
  particle.vy *= 0.974;
}

function keepParticleInBounds(particle) {
  const material = MATERIALS[particle.material];

  if (particle.x < particle.radius) {
    const impact = Math.abs(particle.vx);
    particle.x = particle.radius;
    particle.vx = Math.abs(particle.vx) * material.restitution;

    if (impact > 120) {
      soundEngine.emit(clamp(impact / 480, 0, 1), material.soundTint);
    }
  }

  if (particle.x > state.width - particle.radius) {
    const impact = Math.abs(particle.vx);
    particle.x = state.width - particle.radius;
    particle.vx = -Math.abs(particle.vx) * material.restitution;

    if (impact > 120) {
      soundEngine.emit(clamp(impact / 480, 0, 1), material.soundTint);
    }
  }

  if (particle.y < particle.radius) {
    const impact = Math.abs(particle.vy);
    particle.y = particle.radius;
    particle.vy = Math.abs(particle.vy) * material.restitution;

    if (impact > 120) {
      soundEngine.emit(clamp(impact / 480, 0, 1), material.soundTint);
    }
  }

  if (particle.y > state.height - particle.radius) {
    const impact = Math.abs(particle.vy);
    particle.y = state.height - particle.radius;
    particle.vy = -Math.abs(particle.vy) * material.restitution;
    particle.vx *= material.floorRetention;

    if (impact > 120) {
      soundEngine.emit(clamp(impact / 480, 0, 1), material.soundTint);
    }
  }
}

function rebuildSpatialHash() {
  state.spatialHash.clear();

  for (const particle of state.particles) {
    if (!particle.active) {
      continue;
    }

    const cellX = Math.floor(particle.x / COLLISION_CELL_SIZE);
    const cellY = Math.floor(particle.y / COLLISION_CELL_SIZE);
    particle.cellX = cellX;
    particle.cellY = cellY;

    const key = `${cellX},${cellY}`;

    if (!state.spatialHash.has(key)) {
      state.spatialHash.set(key, []);
    }

    state.spatialHash.get(key).push(particle);
  }
}

function forEachNearbyParticle(particle, callback) {
  for (let yOffset = -1; yOffset <= 1; yOffset += 1) {
    for (let xOffset = -1; xOffset <= 1; xOffset += 1) {
      const bucket = state.spatialHash.get(
        `${particle.cellX + xOffset},${particle.cellY + yOffset}`,
      );

      if (!bucket) {
        continue;
      }

      for (const other of bucket) {
        if (!other.active || other.id === particle.id) {
          continue;
        }

        callback(other);
      }
    }
  }
}

function sampleLocalEnvironment(particle) {
  let neighborCount = 0;
  let leftWeight = 0;
  let rightWeight = 0;
  let supportBelow = false;

  forEachNearbyParticle(particle, (other) => {
    const dx = other.x - particle.x;
    const dy = other.y - particle.y;
    const influenceRadius = (particle.radius + other.radius) * 2.35;

    if (dx * dx + dy * dy > influenceRadius * influenceRadius) {
      return;
    }

    neighborCount += 1;

    const weight = 1 / (Math.abs(dx) + 6);

    if (dx < 0) {
      leftWeight += weight;
    } else {
      rightWeight += weight;
    }

    if (
      dy > 0 &&
      dy < (particle.radius + other.radius) * 1.7 &&
      Math.abs(dx) < (particle.radius + other.radius) * 0.72
    ) {
      supportBelow = true;
    }
  });

  return {
    neighborCount,
    supportBelow,
    lateralPressure: leftWeight - rightWeight,
  };
}

function applyMaterialInteractionPass(dt) {
  for (const particle of state.particles) {
    if (!particle.active) {
      continue;
    }

    const material = MATERIALS[particle.material];
    const environment = sampleLocalEnvironment(particle);
    const touchingFloor = particle.y >= state.height - particle.radius - 2;
    const crowding = clamp((environment.neighborCount - 1) / 6, 0, 1);

    if (particle.material === "sand") {
      if (touchingFloor || environment.supportBelow) {
        particle.vx *= Math.pow(material.floorRetention, dt * 60);

        if (particle.vy > 0) {
          particle.vy *= Math.pow(material.settleDamping, dt * 60);
        }
      }

      if (crowding > 0.12) {
        particle.vx += environment.lateralPressure * material.pressureResponse * dt;
      }

      if ((touchingFloor || environment.supportBelow) && Math.abs(particle.vx) < 5) {
        particle.vx = 0;
      }
    }

    if (particle.material === "water") {
      if (touchingFloor || environment.supportBelow || crowding > 0.08) {
        const ripple =
          Math.sin(state.simulationTime * 10 + particle.noiseSeed) *
          material.spreadBias *
          dt;

        particle.vx += environment.lateralPressure * material.pressureResponse * dt;
        particle.vx += ripple * (0.35 + crowding);

        if (Math.abs(environment.lateralPressure) < 0.02) {
          particle.vx +=
            Math.sign(Math.sin(state.simulationTime * 7 + particle.noiseSeed)) *
            material.spreadBias *
            0.22 *
            dt;
        }

        if (particle.vy > 0) {
          particle.vy *= Math.pow(material.settleDamping, dt * 60);
        }
      }
    }

    if (particle.material === "gas" && crowding > 0.15) {
      particle.vx -= environment.lateralPressure * material.pressureResponse * 0.55 * dt;
    }
  }
}

function dominantSoundTint(materialA, materialB) {
  if (materialA === "sand" || materialB === "sand") {
    return "sand";
  }

  if (materialA === "water" || materialB === "water") {
    return "water";
  }

  return "gas";
}

/*
  Collision handling does three things at once:
  1. separates overlapping particles so they do not stay stuck together
  2. changes their velocity with a damped elastic response
  3. triggers color fusion and collision sound when needed
*/
function resolveCollisions() {
  for (const particle of state.particles) {
    if (!particle.active) {
      continue;
    }

    for (let yOffset = -1; yOffset <= 1; yOffset += 1) {
      for (let xOffset = -1; xOffset <= 1; xOffset += 1) {
        const bucket = state.spatialHash.get(
          `${particle.cellX + xOffset},${particle.cellY + yOffset}`,
        );

        if (!bucket) {
          continue;
        }

        for (const other of bucket) {
          if (!other.active || other.id <= particle.id) {
            continue;
          }

          const dx = other.x - particle.x;
          const dy = other.y - particle.y;
          const minimumDistance = particle.radius + other.radius;
          const distanceSquared = dx * dx + dy * dy;

          if (distanceSquared >= minimumDistance * minimumDistance) {
            continue;
          }

          const distance = Math.max(Math.sqrt(distanceSquared), 0.001);
          const nx = dx / distance;
          const ny = dy / distance;
          const overlap = minimumDistance - distance;
          const totalMass = particle.mass + other.mass;
          const separationRatioA = other.mass / totalMass;
          const separationRatioB = particle.mass / totalMass;

          particle.x -= nx * overlap * separationRatioA;
          particle.y -= ny * overlap * separationRatioA;
          other.x += nx * overlap * separationRatioB;
          other.y += ny * overlap * separationRatioB;

          const relativeVx = other.vx - particle.vx;
          const relativeVy = other.vy - particle.vy;
          const velocityAlongNormal = relativeVx * nx + relativeVy * ny;

          if (velocityAlongNormal >= 0) {
            continue;
          }

          const restitution = Math.min(
            MATERIALS[particle.material].restitution,
            MATERIALS[other.material].restitution,
          );

          const impulseMagnitude =
            (-(1 + restitution) * velocityAlongNormal) /
            (1 / particle.mass + 1 / other.mass);

          const impulseX = impulseMagnitude * nx;
          const impulseY = impulseMagnitude * ny;

          particle.vx -= impulseX / particle.mass;
          particle.vy -= impulseY / particle.mass;
          other.vx += impulseX / other.mass;
          other.vy += impulseY / other.mass;

          // Tangential friction is material-dependent: sand grips strongly, while water slips sideways.
          const tangentX = relativeVx - velocityAlongNormal * nx;
          const tangentY = relativeVy - velocityAlongNormal * ny;
          const tangentFriction =
            (MATERIALS[particle.material].collisionFriction +
              MATERIALS[other.material].collisionFriction) /
            2;
          particle.vx += tangentX * tangentFriction;
          particle.vy += tangentY * tangentFriction;
          other.vx -= tangentX * tangentFriction;
          other.vy -= tangentY * tangentFriction;

          const collisionEnergy = Math.abs(velocityAlongNormal) / 260;

          if (collisionEnergy > 0.08) {
            soundEngine.emit(
              clamp(collisionEnergy, 0, 1),
              dominantSoundTint(particle.material, other.material),
            );
          }

          if (colorDistance(particle.color, other.color) > 10) {
            const middleColor = mixColors(particle.color, other.color, 0.5);
            const blendAmount = clamp(0.05 + collisionEnergy * 0.12, 0.05, 0.18);
            blendIntoColor(particle.color, middleColor, blendAmount);
            blendIntoColor(other.color, middleColor, blendAmount);
          }
        }
      }
    }
  }
}

function buildFormationTargets() {
  state.formationText = (ui.formationText.value.trim() || "LIFE").slice(0, 10).toUpperCase();
  ui.formationText.value = state.formationText;

  const offscreen = document.createElement("canvas");
  offscreen.width = Math.max(1, Math.floor(state.width));
  offscreen.height = Math.max(1, Math.floor(state.height));
  const offscreenContext = offscreen.getContext("2d");

  if (!offscreenContext) {
    state.formationTargets = [];
    return;
  }

  offscreenContext.clearRect(0, 0, offscreen.width, offscreen.height);
  state.formationFontSize = Math.min(state.width * 0.18, state.height * 0.34, 190);
  offscreenContext.fillStyle = "#ffffff";
  offscreenContext.textAlign = "center";
  offscreenContext.textBaseline = "middle";
  offscreenContext.font = `900 ${state.formationFontSize}px "Trebuchet MS", "Gill Sans", sans-serif`;
  offscreenContext.fillText(
    state.formationText,
    offscreen.width / 2,
    offscreen.height / 2,
  );

  const image = offscreenContext.getImageData(0, 0, offscreen.width, offscreen.height).data;
  const points = [];
  const step = Math.max(6, Math.round(state.width / 120));

  for (let y = 0; y < offscreen.height; y += step) {
    for (let x = 0; x < offscreen.width; x += step) {
      const alpha = image[(y * offscreen.width + x) * 4 + 3];

      if (alpha > 30) {
        points.push({ x, y });
      }
    }
  }

  state.formationTargets = shuffle(points);
}

function updatePointerPosition(event) {
  const rect = canvas.getBoundingClientRect();
  const nextX = clamp(event.clientX - rect.left, 0, rect.width);
  const nextY = clamp(event.clientY - rect.top, 0, rect.height);
  const nextTime = event.timeStamp / 1000;
  const wasInside = state.pointer.inside;

  // The first pointer entry resets mouse momentum so particles do not get an accidental launch boost.
  if (!wasInside) {
    state.pointer.x = nextX;
    state.pointer.y = nextY;
    state.pointer.motionX = 0;
    state.pointer.motionY = 0;
    state.pointer.inside = true;
    state.pointer.lastEventTime = nextTime;
    return;
  }

  const dt = Math.max(nextTime - state.pointer.lastEventTime, 1 / 240);

  state.pointer.motionX = lerp(
    state.pointer.motionX,
    (nextX - state.pointer.x) / dt,
    0.34,
  );
  state.pointer.motionY = lerp(
    state.pointer.motionY,
    (nextY - state.pointer.y) / dt,
    0.34,
  );
  state.pointer.x = nextX;
  state.pointer.y = nextY;
  state.pointer.inside = true;
  state.pointer.lastEventTime = nextTime;
}

function handlePointerDown(event) {
  if (event.button !== 0) {
    return;
  }

  updatePointerPosition(event);

  if (state.frozen) {
    return;
  }

  state.pointer.down = true;
  canvas.setPointerCapture(event.pointerId);

  rebirthBurstAt(state.pointer.x, state.pointer.y);

  if (ui.brushMode.value === "sprinkle") {
    emitParticlesFromBrush(FIXED_TIME_STEP * 3);
  }
}

function handlePointerMove(event) {
  updatePointerPosition(event);
}

function handlePointerUp(event) {
  if (event.button !== 0) {
    return;
  }

  state.pointer.down = false;

  if (canvas.hasPointerCapture(event.pointerId)) {
    canvas.releasePointerCapture(event.pointerId);
  }
}

function resizeCanvas() {
  const bounds = canvas.parentElement.getBoundingClientRect();
  state.dpr = window.devicePixelRatio || 1;
  state.width = Math.max(320, bounds.width);
  state.height = Math.max(480, bounds.height);
  canvas.width = Math.floor(state.width * state.dpr);
  canvas.height = Math.floor(state.height * state.dpr);
  ctx.setTransform(state.dpr, 0, 0, state.dpr, 0, 0);

  if (state.selfOrganize) {
    buildFormationTargets();
  }
}

function stepSimulation(dt) {
  state.simulationTime += dt;
  state.liveParticles = 0;

  if (state.pointer.down && state.pointer.inside && ui.brushMode.value === "sprinkle") {
    emitParticlesFromBrush(dt);
  }

  for (const particle of state.particles) {
    if (!particle.active) {
      continue;
    }

    if (state.simulationTime >= particle.deathAt) {
      recycleParticle(particle);
      continue;
    }

    state.liveParticles += 1;

    applyBrushField(particle, dt);
    applyMaterialForces(particle, dt);
    applyFormationForce(particle, dt);

    particle.x += particle.vx * dt;
    particle.y += particle.vy * dt;

    keepParticleInBounds(particle);
  }

  rebuildSpatialHash();
  resolveCollisions();
  rebuildSpatialHash();
  applyMaterialInteractionPass(dt);
}

function heatColorAt(intensity) {
  if (intensity < 0.25) {
    return {
      r: 60,
      g: Math.round(120 + intensity * 220),
      b: 255,
      a: 0.12 + intensity * 0.2,
    };
  }

  if (intensity < 0.55) {
    return {
      r: Math.round(90 + intensity * 180),
      g: 255,
      b: Math.round(210 - intensity * 160),
      a: 0.18 + intensity * 0.28,
    };
  }

  if (intensity < 0.8) {
    return {
      r: 255,
      g: Math.round(220 - intensity * 120),
      b: 90,
      a: 0.28 + intensity * 0.3,
    };
  }

  return {
    r: 255,
    g: Math.round(110 - intensity * 40),
    b: 65,
    a: 0.38 + intensity * 0.34,
  };
}

function drawBackground() {
  const gradient = ctx.createLinearGradient(0, 0, state.width, state.height);
  gradient.addColorStop(0, "#081520");
  gradient.addColorStop(0.55, "#0d2230");
  gradient.addColorStop(1, "#071018");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, state.width, state.height);

  ctx.save();
  ctx.strokeStyle = "rgba(255, 255, 255, 0.04)";
  ctx.lineWidth = 1;

  for (let x = 0; x < state.width; x += 40) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, state.height);
    ctx.stroke();
  }

  for (let y = 0; y < state.height; y += 40) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(state.width, y);
    ctx.stroke();
  }

  ctx.restore();
}

function drawHeatMap() {
  const columns = Math.ceil(state.width / HEAT_CELL_SIZE);
  const rows = Math.ceil(state.height / HEAT_CELL_SIZE);
  const densities = new Uint16Array(columns * rows);
  let maxDensity = 0;

  for (const particle of state.particles) {
    if (!particle.active) {
      continue;
    }

    const cellX = clamp(Math.floor(particle.x / HEAT_CELL_SIZE), 0, columns - 1);
    const cellY = clamp(Math.floor(particle.y / HEAT_CELL_SIZE), 0, rows - 1);
    const index = cellY * columns + cellX;
    densities[index] += 1;
    maxDensity = Math.max(maxDensity, densities[index]);
  }

  if (maxDensity === 0) {
    return;
  }

  ctx.save();
  ctx.globalCompositeOperation = "screen";

  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      const density = densities[row * columns + column];

      if (density === 0) {
        continue;
      }

      const intensity = density / maxDensity;

      if (intensity < 0.08) {
        continue;
      }

      const color = heatColorAt(intensity);
      ctx.fillStyle = `rgba(${color.r}, ${color.g}, ${color.b}, ${color.a})`;
      ctx.fillRect(
        column * HEAT_CELL_SIZE,
        row * HEAT_CELL_SIZE,
        HEAT_CELL_SIZE,
        HEAT_CELL_SIZE,
      );
    }
  }

  ctx.restore();
}

function drawFormationGhost() {
  if (!state.selfOrganize) {
    return;
  }

  ctx.save();
  ctx.globalAlpha = 0.08;
  ctx.fillStyle = "#ffffff";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = `900 ${state.formationFontSize}px "Trebuchet MS", "Gill Sans", sans-serif`;
  ctx.fillText(state.formationText, state.width / 2, state.height / 2);
  ctx.restore();
}

function drawParticles() {
  for (const particle of state.particles) {
    if (!particle.active) {
      continue;
    }

    const timeLeft = particle.deathAt - state.simulationTime;
    const alpha = timeLeft < 1 ? clamp(timeLeft, 0, 1) : 1;

    ctx.beginPath();
    ctx.fillStyle = rgbToCss(particle.color, alpha);
    ctx.arc(particle.x, particle.y, particle.radius, 0, Math.PI * 2);
    ctx.fill();

    // A small highlight gives each particle a slightly wet or glowing top layer.
    ctx.beginPath();
    ctx.fillStyle = "rgba(255, 255, 255, 0.13)";
    ctx.arc(
      particle.x - particle.radius * 0.18,
      particle.y - particle.radius * 0.18,
      particle.radius * 0.42,
      0,
      Math.PI * 2,
    );
    ctx.fill();
  }
}

function drawPointerHint() {
  if (!state.pointer.inside) {
    return;
  }

  const brushRadius = Number(ui.brushSize.value);
  const mode = ui.brushMode.value;
  const stroke =
    mode === "sprinkle"
      ? "rgba(123, 223, 242, 0.95)"
      : mode === "attract"
        ? "rgba(246, 189, 96, 0.95)"
        : "rgba(242, 132, 130, 0.95)";

  ctx.save();
  ctx.strokeStyle = stroke;
  ctx.setLineDash(mode === "sprinkle" ? [] : [8, 6]);
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.arc(state.pointer.x, state.pointer.y, brushRadius, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

function drawFreezeBadge() {
  if (!state.frozen) {
    return;
  }

  ctx.save();
  ctx.fillStyle = "rgba(5, 12, 18, 0.55)";
  ctx.fillRect(0, 0, state.width, state.height);

  ctx.fillStyle = "#ffffff";
  ctx.font = '700 28px "Trebuchet MS", "Gill Sans", sans-serif';
  ctx.textAlign = "center";
  ctx.fillText("TIME FREEZE", state.width / 2, 42);
  ctx.restore();
}

function render() {
  drawBackground();
  drawFormationGhost();

  if (state.heatmapEnabled) {
    drawHeatMap();
  }

  drawParticles();
  drawPointerHint();
  drawFreezeBadge();
}

function setButtonState(button, active, activeText, inactiveText) {
  button.dataset.active = String(active);
  button.textContent = active ? activeText : inactiveText;
}

function refreshUiReadouts() {
  ui.brushSizeValue.textContent = `${ui.brushSize.value} px`;
  ui.spawnRateValue.textContent = ui.spawnRate.value;
  ui.windForceValue.textContent = ui.windForce.value;

  const prettyMode =
    ui.brushMode.value === "sprinkle"
      ? "Sprinkle"
      : ui.brushMode.value === "attract"
        ? "Attract"
        : "Repel";

  ui.modeIndicator.textContent = `Brush: ${prettyMode}`;
  ui.liveCount.textContent = `${state.liveParticles} active`;
  ui.recycleCount.textContent = `${state.recycleBin.length} ready to respawn`;

  setButtonState(ui.organizeToggle, state.selfOrganize, "Formation active", "Align as word");
  setButtonState(ui.heatmapToggle, state.heatmapEnabled, "Heat map on", "Heat map");
  setButtonState(ui.freezeToggle, state.frozen, "Resume time", "Time freeze");
  setButtonState(ui.soundToggle, soundEngine.enabled, "Sound on", "Enable sound");
}

function updateHintText() {
  if (state.frozen) {
    ui.hintText.textContent =
      "Time is frozen. Take a screenshot or resume the simulation from this exact frame.";
    return;
  }

  if (state.selfOrganize) {
    ui.hintText.textContent =
      `Self-organization is pulling particles into the word "${state.formationText}". Dragging and wind still affect the scene.`;
    return;
  }

  if (ui.brushMode.value === "attract") {
    ui.hintText.textContent =
      "In Attract mode, the brush pulls nearby particles toward itself like a magnet.";
    return;
  }

  if (ui.brushMode.value === "repel") {
    ui.hintText.textContent =
      "In Repel mode, the brush blasts particles away in all directions.";
    return;
  }

  ui.hintText.textContent =
    "Drag to sprinkle particles. Click to bring expired particles back to life at the cursor.";
}

function clearStage() {
  for (const particle of state.particles) {
    if (particle.active) {
      recycleParticle(particle);
    }
  }

  state.liveParticles = 0;
  refreshUiReadouts();
}

function saveScreenshot() {
  const link = document.createElement("a");
  link.href = canvas.toDataURL("image/png");
  link.download = `particle-sandbox-${Date.now()}.png`;
  link.click();
}

function attachUiEvents() {
  ui.brushMode.addEventListener("change", () => {
    refreshUiReadouts();
    updateHintText();
  });

  ui.materialType.addEventListener("change", refreshUiReadouts);
  ui.brushSize.addEventListener("input", refreshUiReadouts);
  ui.spawnRate.addEventListener("input", refreshUiReadouts);
  ui.windForce.addEventListener("input", refreshUiReadouts);

  ui.formationText.addEventListener("change", () => {
    buildFormationTargets();
    updateHintText();
  });

  ui.organizeToggle.addEventListener("click", () => {
    state.selfOrganize = !state.selfOrganize;

    if (state.selfOrganize) {
      buildFormationTargets();
    }

    refreshUiReadouts();
    updateHintText();
  });

  ui.heatmapToggle.addEventListener("click", () => {
    state.heatmapEnabled = !state.heatmapEnabled;
    refreshUiReadouts();
  });

  ui.freezeToggle.addEventListener("click", () => {
    state.frozen = !state.frozen;
    refreshUiReadouts();
    updateHintText();
  });

  ui.soundToggle.addEventListener("click", async () => {
    const enabled = await soundEngine.toggle();

    if (!enabled && !soundEngine.audioContext) {
      ui.hintText.textContent =
        "Web Audio is not available in this browser, so collision sound cannot play.";
    }

    refreshUiReadouts();
  });

  ui.screenshotButton.addEventListener("click", saveScreenshot);
  ui.clearButton.addEventListener("click", clearStage);

  canvas.addEventListener("pointerdown", handlePointerDown);
  canvas.addEventListener("pointermove", handlePointerMove);
  canvas.addEventListener("pointerenter", (event) => {
    updatePointerPosition(event);
  });
  canvas.addEventListener("pointerleave", () => {
    state.pointer.inside = false;
  });
  canvas.addEventListener("pointerup", handlePointerUp);
  canvas.addEventListener("contextmenu", (event) => event.preventDefault());
  window.addEventListener("resize", resizeCanvas);
  window.addEventListener("pointerup", (event) => {
    if (event.button === 0) {
      state.pointer.down = false;
    }
  });
}

function animate(now) {
  const deltaSeconds = Math.min((now - state.lastFrameTime) / 1000, 0.05);
  state.lastFrameTime = now;

  if (!state.frozen) {
    state.accumulator += deltaSeconds;

    while (state.accumulator >= FIXED_TIME_STEP) {
      stepSimulation(FIXED_TIME_STEP);
      state.accumulator -= FIXED_TIME_STEP;
    }
  }

  render();

  if (now - state.lastStatsRefresh > 90) {
    refreshUiReadouts();
    state.lastStatsRefresh = now;
  }

  requestAnimationFrame(animate);
}

function seedInitialParticles() {
  const centerX = state.width * 0.5;
  const centerY = state.height * 0.35;

  for (let i = 0; i < 120; i += 1) {
    const offset = randomPointInCircle(60);
    const color =
      i % 3 === 0
        ? { r: 244, g: 162, b: 97 }
        : i % 3 === 1
          ? { r: 123, g: 223, b: 242 }
          : { r: 132, g: 220, b: 198 };

    spawnParticle(centerX + offset.x, centerY + offset.y, {
      material: i % 3 === 0 ? "sand" : i % 3 === 1 ? "water" : "gas",
      color,
      vx: randomRange(-20, 20),
      vy: randomRange(-20, 20),
    });
  }

  state.liveParticles = state.particles.filter((particle) => particle.active).length;
}

function init() {
  resizeCanvas();
  attachUiEvents();
  buildFormationTargets();
  seedInitialParticles();
  refreshUiReadouts();
  updateHintText();
  requestAnimationFrame(animate);
}

init();
