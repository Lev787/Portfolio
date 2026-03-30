const TAU = Math.PI * 2;
const MAX_TRAILS = 280;
const MAX_MAGNETS = 8;
const MAX_SPARKS = 320;
const RECORD_WINDOW_MS = 5000;
const MAX_ACTIVE_VOICES = 48;
const BASE_EMIT_INTERVAL_MS = 18;
const SYMMETRY_EMIT_INTERVAL_MS = 24;

// A compact pentatonic palette keeps freehand gestures musical even when mirrored.
const SCALE_NOTES = buildScaleNotes(45, 5, [0, 3, 5, 7, 10]);

const INSTRUMENTS = {
  red: {
    name: "Aggressive Bass",
    color: "#ff6057",
    glow: "rgba(255, 96, 87, 0.36)",
    primaryOsc: "sawtooth",
    secondaryOsc: "square",
    octaveShift: -1,
    secondaryRatio: 1.01,
    detune: 10,
    gain: 0.21,
    echo: 0.22,
    attack: 0.012,
    filterBase: 180,
    filterBoost: 900,
    q: 7,
    drive: 18,
    waveBase: 8,
    waveBoost: 18
  },
  blue: {
    name: "Soft Piano",
    color: "#69a7ff",
    glow: "rgba(105, 167, 255, 0.34)",
    primaryOsc: "triangle",
    secondaryOsc: "sine",
    octaveShift: 0,
    secondaryRatio: 2,
    detune: 4,
    gain: 0.15,
    echo: 0.3,
    attack: 0.022,
    filterBase: 580,
    filterBoost: 1800,
    q: 4.2,
    drive: 0,
    waveBase: 6,
    waveBoost: 12
  },
  yellow: {
    name: "Bright Synth",
    color: "#ffd659",
    glow: "rgba(255, 214, 89, 0.34)",
    primaryOsc: "sawtooth",
    secondaryOsc: "triangle",
    octaveShift: 0,
    secondaryRatio: 1.5,
    detune: 7,
    gain: 0.18,
    echo: 0.31,
    attack: 0.014,
    filterBase: 740,
    filterBoost: 2500,
    q: 3.2,
    drive: 8,
    waveBase: 9,
    waveBoost: 20
  },
  green: {
    name: "Glass Bell",
    color: "#83ffd4",
    glow: "rgba(131, 255, 212, 0.34)",
    primaryOsc: "sine",
    secondaryOsc: "triangle",
    octaveShift: 1,
    secondaryRatio: 1.99,
    detune: 3,
    gain: 0.13,
    echo: 0.38,
    attack: 0.02,
    filterBase: 980,
    filterBoost: 3200,
    q: 6.4,
    drive: 0,
    waveBase: 7,
    waveBoost: 14
  },
  violet: {
    name: "Dream Pad",
    color: "#b48cff",
    glow: "rgba(180, 140, 255, 0.34)",
    primaryOsc: "triangle",
    secondaryOsc: "sawtooth",
    octaveShift: 0,
    secondaryRatio: 0.5,
    detune: 9,
    gain: 0.16,
    echo: 0.36,
    attack: 0.03,
    filterBase: 420,
    filterBoost: 1500,
    q: 2.2,
    drive: 4,
    waveBase: 10,
    waveBoost: 16
  }
};

function buildScaleNotes(rootMidi, octaves, intervals) {
  const notes = [];

  for (let octave = 0; octave < octaves; octave += 1) {
    intervals.forEach((interval) => {
      notes.push(rootMidi + octave * 12 + interval);
    });
  }

  return notes;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function lerp(start, end, amount) {
  return start + (end - start) * amount;
}

function midiToFrequency(midi) {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

function hexToRgba(hex, alpha) {
  const trimmed = hex.replace("#", "");
  const value = Number.parseInt(trimmed, 16);
  const r = (value >> 16) & 255;
  const g = (value >> 8) & 255;
  const b = value & 255;

  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function describePitch(frequency) {
  const pitchClasses = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
  const midi = Math.round(69 + 12 * Math.log2(frequency / 440));
  const pitch = pitchClasses[(midi + 1200) % 12];
  const octave = Math.floor(midi / 12) - 1;

  return `${pitch}${octave}`;
}

class AudioEngine {
  constructor() {
    this.ctx = null;
    this.masterGain = null;
    this.delayInput = null;
    this.activeVoices = new Set();
    this.isReady = false;
    this.maxVoices = MAX_ACTIVE_VOICES;
  }

  async ensureReady() {
    if (!window.AudioContext && !window.webkitAudioContext) {
      throw new Error("Web Audio API is not available in this browser.");
    }

    if (!this.ctx) {
      this.init();
    }

    if (this.ctx.state !== "running") {
      await this.ctx.resume();
    }
  }

  init() {
    const AudioContextCtor = window.AudioContext || window.webkitAudioContext;
    const ctx = new AudioContextCtor();

    this.ctx = ctx;
    this.masterGain = ctx.createGain();
    this.masterGain.gain.value = 0.58;

    // A compressor on the master bus catches aggressive peaks when the user
    // draws very quickly and many partials hit the mix at once.
    this.outputTrim = ctx.createGain();
    this.outputTrim.gain.value = 1;

    this.outputLimiter = ctx.createDynamicsCompressor();
    this.outputLimiter.threshold.value = -18;
    this.outputLimiter.knee.value = 10;
    this.outputLimiter.ratio.value = 12;
    this.outputLimiter.attack.value = 0.003;
    this.outputLimiter.release.value = 0.18;

    this.masterGain.connect(this.outputTrim);
    this.outputTrim.connect(this.outputLimiter);
    this.outputLimiter.connect(ctx.destination);

    // A shared delay bus keeps the "echo trails" coherent across strokes.
    this.delayInput = ctx.createGain();
    this.delayInput.gain.value = 1;

    this.delay = ctx.createDelay(1.4);
    this.delay.delayTime.value = 0.34;

    this.delayFilter = ctx.createBiquadFilter();
    this.delayFilter.type = "lowpass";
    this.delayFilter.frequency.value = 2600;

    this.delayFeedback = ctx.createGain();
    this.delayFeedback.gain.value = 0.42;

    this.delayWet = ctx.createGain();
    this.delayWet.gain.value = 0.24;

    this.delayInput.connect(this.delay);
    this.delay.connect(this.delayFilter);
    this.delayFilter.connect(this.delayWet);
    this.delayWet.connect(this.masterGain);
    this.delayFilter.connect(this.delayFeedback);
    this.delayFeedback.connect(this.delay);

    // The ambient bed reacts to overall paint density instead of single gestures.
    this.ambientFilter = ctx.createBiquadFilter();
    this.ambientFilter.type = "lowpass";
    this.ambientFilter.frequency.value = 260;

    this.ambientGain = ctx.createGain();
    this.ambientGain.gain.value = 0.0001;

    this.ambientNoiseFilter = ctx.createBiquadFilter();
    this.ambientNoiseFilter.type = "bandpass";
    this.ambientNoiseFilter.frequency.value = 900;
    this.ambientNoiseFilter.Q.value = 0.8;

    this.ambientNoiseGain = ctx.createGain();
    this.ambientNoiseGain.gain.value = 0.0001;

    this.ambientOscA = ctx.createOscillator();
    this.ambientOscA.type = "triangle";
    this.ambientOscA.frequency.value = 55;

    this.ambientOscB = ctx.createOscillator();
    this.ambientOscB.type = "sine";
    this.ambientOscB.frequency.value = 82.4;

    const oscAGain = ctx.createGain();
    oscAGain.gain.value = 0.12;

    const oscBGain = ctx.createGain();
    oscBGain.gain.value = 0.08;

    this.ambientNoise = this.createNoiseSource();

    this.ambientOscA.connect(oscAGain);
    oscAGain.connect(this.ambientFilter);
    this.ambientOscB.connect(oscBGain);
    oscBGain.connect(this.ambientFilter);

    this.ambientNoise.connect(this.ambientNoiseFilter);
    this.ambientNoiseFilter.connect(this.ambientNoiseGain);
    this.ambientNoiseGain.connect(this.ambientFilter);

    this.ambientFilter.connect(this.ambientGain);
    this.ambientGain.connect(this.masterGain);

    this.ambientLfo = ctx.createOscillator();
    this.ambientLfo.type = "sine";
    this.ambientLfo.frequency.value = 0.07;

    this.ambientLfoGain = ctx.createGain();
    this.ambientLfoGain.gain.value = 140;

    this.ambientLfo.connect(this.ambientLfoGain);
    this.ambientLfoGain.connect(this.ambientFilter.detune);

    this.ambientOscA.start();
    this.ambientOscB.start();
    this.ambientNoise.start();
    this.ambientLfo.start();

    this.isReady = true;
  }

  createNoiseSource() {
    const buffer = this.ctx.createBuffer(1, this.ctx.sampleRate * 2, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);

    for (let index = 0; index < data.length; index += 1) {
      data[index] = Math.random() * 2 - 1;
    }

    const source = this.ctx.createBufferSource();
    source.buffer = buffer;
    source.loop = true;

    return source;
  }

  buildDistortionCurve(amount) {
    const samples = 256;
    const curve = new Float32Array(samples);

    for (let index = 0; index < samples; index += 1) {
      const x = (index * 2) / (samples - 1) - 1;
      curve[index] = ((3 + amount) * x * 20 * (Math.PI / 180)) / (Math.PI + amount * Math.abs(x));
    }

    return curve;
  }

  getActiveVoiceCount() {
    return this.activeVoices.size;
  }

  syncOutputTrim() {
    if (!this.ctx || !this.outputTrim) {
      return;
    }

    const now = this.ctx.currentTime;
    const activeCount = this.getActiveVoiceCount();
    const targetTrim = clamp(1 / Math.sqrt(1 + activeCount * 0.12), 0.32, 1);

    this.outputTrim.gain.cancelScheduledValues(now);
    this.outputTrim.gain.setTargetAtTime(targetTrim, now, 0.05);
  }

  trimVoiceBudget(incomingVoices = 1) {
    while (this.getActiveVoiceCount() + incomingVoices > this.maxVoices) {
      const oldestVoice = this.activeVoices.values().next().value;

      if (!oldestVoice) {
        break;
      }

      this.releaseVoice(oldestVoice, 0.08);
    }
  }

  spawnTrailVoice({ frequency, colorKey, intensity, pan }) {
    if (!this.ctx || !this.isReady) {
      return null;
    }

    this.trimVoiceBudget(1);

    const inst = INSTRUMENTS[colorKey];
    const now = this.ctx.currentTime;

    const inputMix = this.ctx.createGain();
    let signal = inputMix;

    if (inst.drive > 0) {
      const distortion = this.ctx.createWaveShaper();
      distortion.curve = this.buildDistortionCurve(inst.drive + intensity * 10);
      distortion.oversample = "2x";
      inputMix.connect(distortion);
      signal = distortion;
    }

    const filter = this.ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = inst.filterBase + inst.filterBoost * intensity;
    filter.Q.value = inst.q;
    signal.connect(filter);

    let splitSource = filter;

    if (typeof this.ctx.createStereoPanner === "function") {
      const panner = this.ctx.createStereoPanner();
      panner.pan.value = clamp(pan, -0.95, 0.95);
      filter.connect(panner);
      splitSource = panner;
    }

    const outputGain = this.ctx.createGain();
    outputGain.gain.value = 0.0001;

    const sendGain = this.ctx.createGain();
    sendGain.gain.value = 0.0001;

    splitSource.connect(outputGain);
    splitSource.connect(sendGain);
    outputGain.connect(this.masterGain);
    sendGain.connect(this.delayInput);

    const oscA = this.ctx.createOscillator();
    oscA.type = inst.primaryOsc;
    oscA.frequency.value = frequency * Math.pow(2, inst.octaveShift);

    const oscB = this.ctx.createOscillator();
    oscB.type = inst.secondaryOsc;
    oscB.frequency.value = frequency * Math.pow(2, inst.octaveShift) * inst.secondaryRatio;
    oscB.detune.value = inst.detune * (0.35 + intensity * 0.85);

    const oscAGain = this.ctx.createGain();
    oscAGain.gain.value = 0.62;

    const oscBGain = this.ctx.createGain();
    oscBGain.gain.value = 0.38;

    oscA.connect(oscAGain);
    oscAGain.connect(inputMix);
    oscB.connect(oscBGain);
    oscBGain.connect(inputMix);

    oscA.start(now);
    oscB.start(now);

    const baseGain = inst.gain * lerp(0.42, 0.95, intensity);
    const baseSend = inst.echo * lerp(0.2, 0.72, intensity);

    outputGain.gain.exponentialRampToValueAtTime(baseGain, now + inst.attack);
    sendGain.gain.exponentialRampToValueAtTime(baseSend, now + inst.attack + 0.05);

    const voice = {
      oscillators: [oscA, oscB],
      outputGain,
      sendGain,
      filter,
      baseGain,
      baseSend,
      filterBase: inst.filterBase,
      filterBoost: inst.filterBoost,
      intensity,
      alive: true
    };

    this.activeVoices.add(voice);
    this.syncOutputTrim();
    return voice;
  }

  updateTrailVoice(voice, alpha) {
    if (!voice || !voice.alive || !this.ctx) {
      return;
    }

    const now = this.ctx.currentTime;
    const safeAlpha = Math.max(alpha, 0.0001);

    voice.outputGain.gain.cancelScheduledValues(now);
    voice.outputGain.gain.setTargetAtTime(Math.max(voice.baseGain * safeAlpha, 0.0001), now, 0.08);

    voice.sendGain.gain.cancelScheduledValues(now);
    voice.sendGain.gain.setTargetAtTime(Math.max(voice.baseSend * Math.pow(safeAlpha, 1.35), 0.0001), now, 0.12);

    voice.filter.frequency.cancelScheduledValues(now);
    voice.filter.frequency.setTargetAtTime(
      voice.filterBase + voice.filterBoost * (0.3 + voice.intensity * 0.7) * safeAlpha,
      now,
      0.1
    );
  }

  releaseVoice(voice, releaseSeconds = 0.35) {
    if (!voice || !voice.alive || !this.ctx) {
      return;
    }

    voice.alive = false;
    const now = this.ctx.currentTime;

    voice.outputGain.gain.cancelScheduledValues(now);
    voice.outputGain.gain.setTargetAtTime(0.0001, now, Math.max(releaseSeconds * 0.3, 0.04));

    voice.sendGain.gain.cancelScheduledValues(now);
    voice.sendGain.gain.setTargetAtTime(0.0001, now, Math.max(releaseSeconds * 0.38, 0.05));

    this.activeVoices.delete(voice);
    this.syncOutputTrim();

    voice.oscillators.forEach((oscillator) => {
      try {
        oscillator.stop(now + releaseSeconds + 0.12);
      } catch (error) {
        // Oscillators can only be stopped once, so repeated clears stay silent.
      }
    });

  }

  triggerOrbitPulse({ frequency, colorKey, intensity, pan }) {
    const voice = this.spawnTrailVoice({
      frequency,
      colorKey,
      intensity: clamp(intensity, 0.2, 1),
      pan
    });

    if (!voice) {
      return;
    }

    window.setTimeout(() => {
      this.releaseVoice(voice, 0.22 + intensity * 0.12);
    }, 150);
  }

  setAmbientDensity(density) {
    if (!this.ctx || !this.isReady) {
      return;
    }

    const now = this.ctx.currentTime;

    this.ambientGain.gain.setTargetAtTime(0.015 + density * 0.09, now, 0.7);
    this.ambientFilter.frequency.setTargetAtTime(240 + density * 2200, now, 0.9);
    this.ambientNoiseGain.gain.setTargetAtTime(0.004 + density * 0.05, now, 0.6);
    this.ambientNoiseFilter.frequency.setTargetAtTime(700 + density * 2400, now, 0.6);
    this.ambientOscA.detune.setTargetAtTime(-8 + density * 24, now, 0.8);
    this.ambientOscB.detune.setTargetAtTime(10 - density * 18, now, 1);
  }

  fadeOutAll(releaseSeconds = 0.5) {
    Array.from(this.activeVoices).forEach((voice) => {
      this.releaseVoice(voice, releaseSeconds);
    });
  }
}

class NeuralSynthApp {
  constructor() {
    this.canvas = document.getElementById("synth-canvas");
    this.ctx = this.canvas.getContext("2d");
    this.audio = new AudioEngine();

    this.dom = {
      audioButton: document.getElementById("audio-toggle"),
      brushButton: document.getElementById("brush-mode"),
      magnetButton: document.getElementById("magnet-mode"),
      symmetryButton: document.getElementById("symmetry-toggle"),
      recordButton: document.getElementById("record-toggle"),
      clearButton: document.getElementById("clear-button"),
      instrumentLabel: document.getElementById("instrument-label"),
      modeLabel: document.getElementById("mode-label"),
      recordLabel: document.getElementById("record-label"),
      densityValue: document.getElementById("density-value"),
      pitchValue: document.getElementById("pitch-value"),
      statusLine: document.getElementById("status-line"),
      swatches: Array.from(document.querySelectorAll(".swatch"))
    };

    this.state = {
      currentColor: "yellow",
      tool: "brush",
      symmetry: false,
      audioLive: false,
      drawing: false,
      pointerId: null,
      lastPoint: null,
      trails: [],
      magnets: [],
      sparks: [],
      paintDensity: 0,
      recording: false,
      recordingStartedAt: 0,
      recordedEvents: [],
      loopPlayback: null,
      lastShakeAt: 0,
      motionBound: false,
      nextId: 1
    };

    this.lastFrame = performance.now();
    this.clock = 0;

    this.bindUI();
    this.resizeCanvas();
    this.refreshLabels();
    this.updateRecordButtonState();

    requestAnimationFrame((timestamp) => this.frame(timestamp));
  }

  bindUI() {
    window.addEventListener("resize", () => this.resizeCanvas());
    this.canvas.addEventListener("pointerdown", (event) => this.handlePointerDown(event));
    this.canvas.addEventListener("pointermove", (event) => this.handlePointerMove(event));
    this.canvas.addEventListener("pointerup", (event) => this.handlePointerUp(event));
    this.canvas.addEventListener("pointercancel", (event) => this.handlePointerUp(event));
    this.canvas.addEventListener("pointerleave", (event) => this.handlePointerUp(event));

    this.dom.audioButton.addEventListener("click", () => this.enableAudio());
    this.dom.brushButton.addEventListener("click", () => this.setTool("brush"));
    this.dom.magnetButton.addEventListener("click", () => this.setTool("magnet"));
    this.dom.symmetryButton.addEventListener("click", () => this.toggleSymmetry());
    this.dom.recordButton.addEventListener("click", () => this.handleRecordToggle());
    this.dom.clearButton.addEventListener("click", () => this.clearScene(true, { recordable: true }));

    this.dom.swatches.forEach((button) => {
      button.addEventListener("click", () => {
        this.setColor(button.dataset.color);
      });
    });
  }

  resizeCanvas() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.pixelRatio = dpr;
    this.width = window.innerWidth;
    this.height = window.innerHeight;
    this.canvas.width = this.width * dpr;
    this.canvas.height = this.height * dpr;
    this.canvas.style.width = `${this.width}px`;
    this.canvas.style.height = `${this.height}px`;
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  async enableAudio() {
    try {
      await this.audio.ensureReady();
      this.state.audioLive = true;
      this.dom.audioButton.classList.add("is-live");
      this.dom.audioButton.textContent = "Audio Live";
      this.setStatus("Audio engine is live. Draw to hear pitch, speed, and echo.");
      this.bindMotionIfPossible();
    } catch (error) {
      this.setStatus(error.message);
    }
  }

  async bindMotionIfPossible() {
    if (this.state.motionBound || typeof window.DeviceMotionEvent === "undefined") {
      return;
    }

    if (typeof window.DeviceMotionEvent.requestPermission === "function") {
      try {
        const permission = await window.DeviceMotionEvent.requestPermission();

        if (permission !== "granted") {
          return;
        }
      } catch (error) {
        return;
      }
    }

    window.addEventListener("devicemotion", (event) => this.handleDeviceMotion(event));
    this.state.motionBound = true;
  }

  handleDeviceMotion(event) {
    const acceleration = event.accelerationIncludingGravity;

    if (!acceleration) {
      return;
    }

    const magnitude = Math.abs(acceleration.x || 0) + Math.abs(acceleration.y || 0) + Math.abs(acceleration.z || 0);

    if (magnitude > 34 && performance.now() - this.state.lastShakeAt > 1200) {
      this.state.lastShakeAt = performance.now();
      this.clearScene(true, { recordable: true });
      this.setStatus("Shake detected. Canvas burst into sparks and the mix faded out.");
    }
  }

  setColor(colorKey) {
    this.state.currentColor = colorKey;
    this.dom.swatches.forEach((button) => {
      button.classList.toggle("is-active", button.dataset.color === colorKey);
    });
    this.refreshLabels();
  }

  setTool(tool) {
    this.state.tool = tool;
    this.dom.brushButton.classList.toggle("is-active", tool === "brush");
    this.dom.magnetButton.classList.toggle("is-active", tool === "magnet");
    this.refreshLabels();
  }

  toggleSymmetry() {
    this.state.symmetry = !this.state.symmetry;
    this.dom.symmetryButton.classList.toggle("is-active", this.state.symmetry);
    this.refreshLabels();
  }

  refreshLabels() {
    this.dom.instrumentLabel.textContent = INSTRUMENTS[this.state.currentColor].name;
    this.dom.modeLabel.textContent = this.state.tool === "brush" ? "Brush" : "Gravity Loops";
  }

  getCanvasPoint(event) {
    const bounds = this.canvas.getBoundingClientRect();
    return {
      x: event.clientX - bounds.left,
      y: event.clientY - bounds.top
    };
  }

  handlePointerDown(event) {
    event.preventDefault();
    this.enableAudio();

    const point = this.getCanvasPoint(event);

    if (this.state.tool === "magnet") {
      this.placeMagnet(point.x, point.y, this.state.currentColor, { recordable: true });
      return;
    }

    this.state.drawing = true;
    this.state.pointerId = event.pointerId;
    this.state.lastPoint = { ...point, time: performance.now() };

    if (typeof this.canvas.setPointerCapture === "function") {
      this.canvas.setPointerCapture(event.pointerId);
    }
  }

  handlePointerMove(event) {
    if (!this.state.drawing || this.state.pointerId !== event.pointerId) {
      return;
    }

    const point = this.getCanvasPoint(event);
    const now = performance.now();
    const previous = this.state.lastPoint;
    const dx = point.x - previous.x;
    const dy = point.y - previous.y;
    const distance = Math.hypot(dx, dy);

    if (distance < 3) {
      return;
    }

    const elapsed = Math.max(now - previous.time, 16);
    const speed = (distance / elapsed) * 1000;
    const voicePressure = Math.max(0, this.audio.getActiveVoiceCount() - 24);
    const emitInterval =
      (this.state.symmetry ? SYMMETRY_EMIT_INTERVAL_MS : BASE_EMIT_INTERVAL_MS) +
      Math.min(voicePressure * 0.45, 14);

    // Fast hand motion should feel more energetic, not collapse the browser.
    // This adaptive gate keeps one longer segment instead of spawning many tiny voices.
    if (now - previous.time < emitInterval) {
      return;
    }

    this.emitBrushSegment(previous, { ...point, time: now }, speed, { recordable: true });
    this.state.lastPoint = { ...point, time: now };
  }

  handlePointerUp(event) {
    if (this.state.pointerId !== event.pointerId) {
      return;
    }

    this.state.drawing = false;
    this.state.pointerId = null;
    this.state.lastPoint = null;
  }

  getFrequencyForY(y) {
    const normalized = clamp(1 - y / this.height, 0, 1);
    const noteIndex = Math.round(normalized * (SCALE_NOTES.length - 1));
    const frequency = midiToFrequency(SCALE_NOTES[noteIndex]);

    this.dom.pitchValue.textContent = describePitch(frequency);
    return frequency;
  }

  emitBrushSegment(from, to, speed, options = {}) {
    const segments = this.getSymmetrySegments(from, to);
    const baseIntensity = clamp(speed / 1200, 0.18, 1);

    segments.forEach((segment) => {
      const midpointY = (segment.y1 + segment.y2) * 0.5;
      const midpointX = (segment.x1 + segment.x2) * 0.5;
      const frequency = this.getFrequencyForY(midpointY);

      this.createTrail(
        {
          ...segment,
          colorKey: this.state.currentColor,
          frequency,
          pan: clamp((midpointX / this.width) * 2 - 1, -1, 1),
          intensity: this.state.symmetry ? baseIntensity * 0.76 : baseIntensity
        },
        options
      );
    });
  }

  getSymmetrySegments(from, to) {
    const variants = [{ x1: from.x, y1: from.y, x2: to.x, y2: to.y }];

    if (this.state.symmetry) {
      // The same gesture is mirrored across horizontal and vertical axes,
      // which creates a visual pattern and a matching four-note chord cloud.
      variants.push(
        { x1: this.width - from.x, y1: from.y, x2: this.width - to.x, y2: to.y },
        { x1: from.x, y1: this.height - from.y, x2: to.x, y2: this.height - to.y },
        {
          x1: this.width - from.x,
          y1: this.height - from.y,
          x2: this.width - to.x,
          y2: this.height - to.y
        }
      );
    }

    const seen = new Set();

    return variants.filter((segment) => {
      const key = [
        Math.round(segment.x1),
        Math.round(segment.y1),
        Math.round(segment.x2),
        Math.round(segment.y2)
      ].join(":");

      if (seen.has(key)) {
        return false;
      }

      seen.add(key);
      return true;
    });
  }

  createTrail(data, options = {}) {
    const instrument = INSTRUMENTS[data.colorKey];
    const voice = this.audio.spawnTrailVoice({
      frequency: data.frequency,
      colorKey: data.colorKey,
      intensity: data.intensity,
      pan: data.pan
    });

    // Each trail stores both its visual wobble data and the linked voice,
    // so fading ink can also fade loudness and delay send together.
    const trail = {
      id: this.state.nextId,
      x1: data.x1,
      y1: data.y1,
      x2: data.x2,
      y2: data.y2,
      colorKey: data.colorKey,
      frequency: data.frequency,
      pan: data.pan,
      intensity: data.intensity,
      // High-speed strokes stay brighter and louder, but decay faster so the
      // mix does not keep hundreds of sustained voices alive at once.
      lifetime: data.lifetime || lerp(2.2, 0.72, data.intensity),
      age: 0,
      life: 1,
      phase: data.phase || Math.random() * TAU,
      waveAmp: data.waveAmp || instrument.waveBase + instrument.waveBoost * data.intensity,
      waveCycles: data.waveCycles || lerp(2.5, 8.5, data.intensity),
      voice
    };

    this.state.nextId += 1;
    this.state.trails.push(trail);

    if (this.state.trails.length > MAX_TRAILS) {
      const removed = this.state.trails.shift();
      this.audio.releaseVoice(removed.voice, 0.2);
    }

    if (options.recordable !== false) {
      this.recordEvent({
        type: "trail",
        data: {
          x1: trail.x1,
          y1: trail.y1,
          x2: trail.x2,
          y2: trail.y2,
          colorKey: trail.colorKey,
          frequency: trail.frequency,
          pan: trail.pan,
          intensity: trail.intensity,
          lifetime: trail.lifetime,
          phase: trail.phase,
          waveAmp: trail.waveAmp,
          waveCycles: trail.waveCycles
        }
      });
    }
  }

  placeMagnet(x, y, colorKey, options = {}) {
    if (options.dedupe) {
      const existing = this.state.magnets.find((magnet) => {
        return magnet.colorKey === colorKey && Math.hypot(magnet.x - x, magnet.y - y) < 14;
      });

      if (existing) {
        existing.pulse = 1;
        return existing;
      }
    }

    // Gravity loop magnets own autonomous particles that keep retriggering notes.
    const magnet = {
      id: this.state.nextId,
      x,
      y,
      colorKey,
      pulse: 0,
      particles: Array.from({ length: 5 }, (_, index) => {
        const radius = 28 + index * 18 + Math.random() * 10;
        return {
          phase: Math.random() * TAU,
          speed: 1.2 + index * 0.35 + Math.random() * 0.18,
          radius,
          steps: 3 + (index % 3),
          lastBeat: 0,
          tail: []
        };
      })
    };

    this.state.nextId += 1;
    this.state.magnets.push(magnet);

    if (this.state.magnets.length > MAX_MAGNETS) {
      this.state.magnets.shift();
    }

    this.spawnMagnetSparks(magnet);
    if (!options.silent) {
      this.setStatus("Gravity loop dropped. Orbiting particles will keep retriggering notes.");
    }

    if (options.recordable !== false) {
      this.recordEvent({
        type: "magnet",
        data: { x, y, colorKey }
      });
    }
  }

  spawnMagnetSparks(magnet) {
    for (let index = 0; index < 12; index += 1) {
      const angle = (index / 12) * TAU;

      this.state.sparks.push({
        x: magnet.x,
        y: magnet.y,
        vx: Math.cos(angle) * (1.5 + Math.random() * 2.2),
        vy: Math.sin(angle) * (1.5 + Math.random() * 2.2),
        life: 1,
        decay: 1.7 + Math.random() * 0.8,
        color: INSTRUMENTS[magnet.colorKey].color,
        size: 1.8 + Math.random() * 2.2
      });
    }
  }

  clearScene(withSparks, options = {}) {
    if (withSparks) {
      this.spawnClearBurst();
    }

    // Clearing the scene also releases any lingering voices so the wipe feels physical.
    this.state.trails.forEach((trail) => {
      this.audio.releaseVoice(trail.voice, 0.18);
    });

    this.audio.fadeOutAll(0.35);
    this.state.trails = [];
    this.state.magnets = [];

    if (options.recordable !== false) {
      this.recordEvent({ type: "clear", data: {} });
    }
  }

  spawnClearBurst() {
    this.state.trails.slice(-80).forEach((trail) => {
      const midpointX = (trail.x1 + trail.x2) * 0.5;
      const midpointY = (trail.y1 + trail.y2) * 0.5;

      this.state.sparks.push({
        x: midpointX,
        y: midpointY,
        vx: (Math.random() * 2 - 1) * 4.2,
        vy: (Math.random() * 2 - 1) * 4.2,
        life: 1,
        decay: 1.8 + Math.random() * 1.4,
        color: INSTRUMENTS[trail.colorKey].color,
        size: 1.5 + Math.random() * 2.5
      });
    });

    this.state.magnets.forEach((magnet) => {
      this.spawnMagnetSparks(magnet);
    });

    if (this.state.sparks.length > MAX_SPARKS) {
      this.state.sparks.splice(0, this.state.sparks.length - MAX_SPARKS);
    }
  }

  handleRecordToggle() {
    if (this.state.recording) {
      return;
    }

    if (this.state.loopPlayback) {
      this.state.loopPlayback = null;
      this.updateRecordButtonState();
      this.setStatus("Loop stopped. You can record a new 5 second phrase.");
      return;
    }

    this.state.recording = true;
    this.state.recordingStartedAt = performance.now();
    this.state.recordedEvents = [];
    this.updateRecordButtonState();
    this.setStatus("Recording a 5 second performance. Draw, mirror, or drop magnets now.");
  }

  recordEvent(event) {
    if (!this.state.recording) {
      return;
    }

    const timestamp = performance.now() - this.state.recordingStartedAt;

    if (timestamp > RECORD_WINDOW_MS) {
      return;
    }

    this.state.recordedEvents.push({
      ...event,
      timestamp
    });
  }

  finishRecording() {
    this.state.recording = false;

    if (!this.state.recordedEvents.length) {
      this.state.loopPlayback = null;
      this.updateRecordButtonState();
      this.setStatus("The loop was empty. Record a gesture to capture a phrase.");
      return;
    }

    // The looper replays recorded actions against a moving 5 second window.
    this.state.loopPlayback = {
      startedAt: performance.now(),
      cursor: 0,
      duration: RECORD_WINDOW_MS,
      events: [...this.state.recordedEvents].sort((left, right) => left.timestamp - right.timestamp),
      cycle: 0
    };

    this.updateRecordButtonState();
    this.setStatus("Loop armed. Your last 5 seconds are now playing on repeat.");
  }

  replayLoop(now) {
    const loop = this.state.loopPlayback;

    if (!loop) {
      return;
    }

    const elapsed = now - loop.startedAt;
    const cycle = Math.floor(elapsed / loop.duration);
    const cycleTime = elapsed % loop.duration;

    if (cycle !== loop.cycle) {
      loop.cycle = cycle;
      loop.cursor = 0;
    }

    while (loop.cursor < loop.events.length && loop.events[loop.cursor].timestamp <= cycleTime) {
      this.replayEvent(loop.events[loop.cursor]);
      loop.cursor += 1;
    }
  }

  replayEvent(event) {
    if (event.type === "trail") {
      this.createTrail({ ...event.data }, { recordable: false });
      return;
    }

    if (event.type === "magnet") {
      this.placeMagnet(event.data.x, event.data.y, event.data.colorKey, {
        recordable: false,
        dedupe: true,
        silent: true
      });
      return;
    }

    if (event.type === "clear") {
      this.clearScene(true, { recordable: false });
    }
  }

  updateRecordButtonState() {
    const button = this.dom.recordButton;
    button.classList.remove("is-recording", "is-looping");

    if (this.state.recording) {
      button.textContent = "Recording...";
      button.classList.add("is-recording");
      this.dom.recordLabel.textContent = "Capturing";
      return;
    }

    if (this.state.loopPlayback) {
      button.textContent = "Stop Loop";
      button.classList.add("is-looping");
      this.dom.recordLabel.textContent = "Loop running";
      return;
    }

    button.textContent = "Record 5s";
    this.dom.recordLabel.textContent = "Loop idle";
  }

  updateTrails(deltaSeconds) {
    let trailEnergy = 0;

    for (let index = this.state.trails.length - 1; index >= 0; index -= 1) {
      const trail = this.state.trails[index];
      trail.age += deltaSeconds;
      trail.life = clamp(1 - trail.age / trail.lifetime, 0, 1);
      trailEnergy += trail.life * (0.45 + trail.intensity * 0.55);
      this.audio.updateTrailVoice(trail.voice, trail.life);

      if (trail.life <= 0) {
        this.audio.releaseVoice(trail.voice, 0.18);
        this.state.trails.splice(index, 1);
      }
    }

    return trailEnergy;
  }

  updateMagnets(deltaSeconds) {
    this.state.magnets.forEach((magnet) => {
      magnet.pulse = Math.max(0, magnet.pulse - deltaSeconds * 1.6);

      magnet.particles.forEach((particle) => {
        // Orbit progress is subdivided into beat steps, turning circles into rhythm.
        particle.phase += particle.speed * deltaSeconds;
        const progress = (particle.phase / TAU) * particle.steps;
        const beat = Math.floor(progress);

        if (beat !== particle.lastBeat) {
          particle.lastBeat = beat;
          const angle = particle.phase % TAU;
          const orbitX = magnet.x + Math.cos(angle) * particle.radius;
          const orbitY = magnet.y + Math.sin(angle) * particle.radius * 0.82;

          this.audio.triggerOrbitPulse({
            frequency: this.getFrequencyForY(orbitY) * (1 + particle.radius / 220),
            colorKey: magnet.colorKey,
            intensity: 0.3 + (particle.speed - 1) * 0.22,
            pan: clamp((orbitX / this.width) * 2 - 1, -1, 1)
          });

          magnet.pulse = 1;
          this.state.sparks.push({
            x: orbitX,
            y: orbitY,
            vx: Math.cos(angle) * 1.4,
            vy: Math.sin(angle) * 1.4,
            life: 0.9,
            decay: 2.3,
            color: INSTRUMENTS[magnet.colorKey].color,
            size: 2.4
          });
        }

        const angle = particle.phase % TAU;
        const px = magnet.x + Math.cos(angle) * particle.radius;
        const py = magnet.y + Math.sin(angle) * particle.radius * 0.82;

        particle.tail.push({ x: px, y: py });
        if (particle.tail.length > 14) {
          particle.tail.shift();
        }
      });
    });
  }

  updateSparks(deltaSeconds) {
    for (let index = this.state.sparks.length - 1; index >= 0; index -= 1) {
      const spark = this.state.sparks[index];
      spark.x += spark.vx;
      spark.y += spark.vy;
      spark.vx *= 0.992;
      spark.vy = spark.vy * 0.992 + 0.016;
      spark.life -= deltaSeconds * spark.decay;

      if (spark.life <= 0) {
        this.state.sparks.splice(index, 1);
      }
    }

    if (this.state.sparks.length > MAX_SPARKS) {
      this.state.sparks.splice(0, this.state.sparks.length - MAX_SPARKS);
    }
  }

  drawBackgroundAura() {
    const density = this.state.paintDensity;
    const gradient = this.ctx.createRadialGradient(
      this.width * 0.5,
      this.height * 0.5,
      0,
      this.width * 0.5,
      this.height * 0.5,
      this.width * 0.7
    );

    gradient.addColorStop(0, `rgba(255, 255, 255, ${0.02 + density * 0.03})`);
    gradient.addColorStop(0.5, `rgba(105, 167, 255, ${0.02 + density * 0.05})`);
    gradient.addColorStop(1, "rgba(2, 5, 14, 0)");

    this.ctx.fillStyle = gradient;
    this.ctx.fillRect(0, 0, this.width, this.height);

    if (this.state.symmetry) {
      this.ctx.save();
      this.ctx.strokeStyle = "rgba(255, 255, 255, 0.08)";
      this.ctx.lineWidth = 1;
      this.ctx.setLineDash([8, 8]);
      this.ctx.beginPath();
      this.ctx.moveTo(this.width * 0.5, 0);
      this.ctx.lineTo(this.width * 0.5, this.height);
      this.ctx.moveTo(0, this.height * 0.5);
      this.ctx.lineTo(this.width, this.height * 0.5);
      this.ctx.stroke();
      this.ctx.restore();
    }
  }

  drawTrail(trail) {
    const inst = INSTRUMENTS[trail.colorKey];
    const alpha = Math.pow(trail.life, 0.8);
    const width = lerp(2.2, 8.5, trail.intensity) * alpha;
    const amplitude = trail.waveAmp * (0.32 + trail.life * 0.68);
    const dx = trail.x2 - trail.x1;
    const dy = trail.y2 - trail.y1;
    const length = Math.max(Math.hypot(dx, dy), 1);
    const normalX = -dy / length;
    const normalY = dx / length;
    const steps = Math.max(5, Math.min(20, Math.round(length / 10)));

    // The line is drawn as a living waveform, so the brush itself looks sonified.
    const traceWave = () => {
      this.ctx.beginPath();

      for (let index = 0; index <= steps; index += 1) {
        const t = index / steps;
        const baseX = lerp(trail.x1, trail.x2, t);
        const baseY = lerp(trail.y1, trail.y2, t);
        const wobble = Math.sin(t * Math.PI * trail.waveCycles + trail.phase + this.clock * 3.4) * amplitude * alpha;
        const px = baseX + normalX * wobble;
        const py = baseY + normalY * wobble;

        if (index === 0) {
          this.ctx.moveTo(px, py);
        } else {
          this.ctx.lineTo(px, py);
        }
      }
    };

    this.ctx.save();
    this.ctx.lineCap = "round";
    this.ctx.lineJoin = "round";

    traceWave();
    this.ctx.lineWidth = width + 6;
    this.ctx.strokeStyle = hexToRgba(inst.color, 0.08 + alpha * 0.12);
    this.ctx.shadowColor = inst.glow;
    this.ctx.shadowBlur = 18 + alpha * 14;
    this.ctx.stroke();

    traceWave();
    this.ctx.lineWidth = width;
    this.ctx.strokeStyle = hexToRgba(inst.color, 0.45 + alpha * 0.45);
    this.ctx.shadowBlur = 0;
    this.ctx.stroke();

    this.ctx.restore();
  }

  drawMagnets() {
    this.state.magnets.forEach((magnet) => {
      const inst = INSTRUMENTS[magnet.colorKey];

      this.ctx.save();
      this.ctx.translate(magnet.x, magnet.y);

      const halo = this.ctx.createRadialGradient(0, 0, 2, 0, 0, 90);
      halo.addColorStop(0, hexToRgba(inst.color, 0.28 + magnet.pulse * 0.16));
      halo.addColorStop(1, "rgba(0, 0, 0, 0)");
      this.ctx.fillStyle = halo;
      this.ctx.fillRect(-90, -90, 180, 180);

      magnet.particles.forEach((particle) => {
        this.ctx.beginPath();
        this.ctx.strokeStyle = hexToRgba(inst.color, 0.08);
        this.ctx.lineWidth = 1;
        this.ctx.ellipse(0, 0, particle.radius, particle.radius * 0.82, 0, 0, TAU);
        this.ctx.stroke();

        if (particle.tail.length > 1) {
          this.ctx.beginPath();
          particle.tail.forEach((point, index) => {
            const px = point.x - magnet.x;
            const py = point.y - magnet.y;
            if (index === 0) {
              this.ctx.moveTo(px, py);
            } else {
              this.ctx.lineTo(px, py);
            }
          });
          this.ctx.strokeStyle = hexToRgba(inst.color, 0.12 + magnet.pulse * 0.08);
          this.ctx.lineWidth = 2;
          this.ctx.stroke();
        }

        const angle = particle.phase % TAU;
        const px = Math.cos(angle) * particle.radius;
        const py = Math.sin(angle) * particle.radius * 0.82;
        this.ctx.beginPath();
        this.ctx.fillStyle = hexToRgba(inst.color, 0.84);
        this.ctx.arc(px, py, 3.2, 0, TAU);
        this.ctx.fill();
      });

      this.ctx.beginPath();
      this.ctx.fillStyle = inst.color;
      this.ctx.arc(0, 0, 8 + magnet.pulse * 3, 0, TAU);
      this.ctx.fill();

      this.ctx.restore();
    });
  }

  drawSparks() {
    this.state.sparks.forEach((spark) => {
      this.ctx.beginPath();
      this.ctx.fillStyle = hexToRgba(spark.color, clamp(spark.life, 0, 1));
      this.ctx.arc(spark.x, spark.y, spark.size * spark.life, 0, TAU);
      this.ctx.fill();
    });
  }

  drawScene() {
    this.ctx.clearRect(0, 0, this.width, this.height);
    this.drawBackgroundAura();
    this.drawMagnets();
    this.state.trails.forEach((trail) => this.drawTrail(trail));
    this.drawSparks();
  }

  setStatus(message) {
    this.dom.statusLine.textContent = message;
  }

  frame(timestamp) {
    const deltaSeconds = Math.min((timestamp - this.lastFrame) / 1000, 0.05);
    this.lastFrame = timestamp;
    this.clock += deltaSeconds;

    if (this.state.recording) {
      const elapsed = timestamp - this.state.recordingStartedAt;
      const remaining = Math.max(0, RECORD_WINDOW_MS - elapsed);
      this.dom.recordButton.textContent = `Recording ${Math.ceil(remaining / 100) / 10}s`;

      if (elapsed >= RECORD_WINDOW_MS) {
        this.finishRecording();
      }
    }

    if (this.state.loopPlayback) {
      this.replayLoop(timestamp);
    }

    const trailEnergy = this.updateTrails(deltaSeconds);
    this.updateMagnets(deltaSeconds);
    this.updateSparks(deltaSeconds);

    const magnetEnergy = this.state.magnets.length * 1.4;
    this.state.paintDensity = clamp(trailEnergy / 48 + magnetEnergy / 12, 0, 1);
    this.dom.densityValue.textContent = `${Math.round(this.state.paintDensity * 100)}%`;
    this.audio.setAmbientDensity(this.state.paintDensity);

    this.drawScene();
    requestAnimationFrame((nextTimestamp) => this.frame(nextTimestamp));
  }
}

window.addEventListener("DOMContentLoaded", () => {
  new NeuralSynthApp();
});
