const NOTES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];

const SCALE_LIBRARY = {
  major: { label: "Major Lift", intervals: [0, 2, 4, 5, 7, 9, 11] },
  minor: { label: "Minor Glow", intervals: [0, 2, 3, 5, 7, 8, 10] },
  dorian: { label: "Dorian Quest", intervals: [0, 2, 3, 5, 7, 9, 10] },
  pentatonic: { label: "Pentatonic Flow", intervals: [0, 2, 4, 7, 9] },
  lydian: { label: "Lydian Spark", intervals: [0, 2, 4, 6, 7, 9, 11] }
};

const STYLE_PRESETS = {
  aurora: {
    label: "Aurora",
    leadWave: "triangle",
    padWave: "sine",
    bassWave: "sawtooth",
    swing: 0.02,
    filterBase: 980,
    delayMix: 0.26,
    textureColor: "#83e8ff"
  },
  neon: {
    label: "Neon Pulse",
    leadWave: "square",
    padWave: "sawtooth",
    bassWave: "square",
    swing: 0.05,
    filterBase: 1500,
    delayMix: 0.22,
    textureColor: "#ff6f91"
  },
  organic: {
    label: "Organic Bloom",
    leadWave: "triangle",
    padWave: "triangle",
    bassWave: "sine",
    swing: 0.015,
    filterBase: 720,
    delayMix: 0.18,
    textureColor: "#8dffb8"
  },
  cinematic: {
    label: "Cinematic Drift",
    leadWave: "sawtooth",
    padWave: "sine",
    bassWave: "triangle",
    swing: 0.01,
    filterBase: 560,
    delayMix: 0.34,
    textureColor: "#ffb347"
  }
};

const SECTION_NAMES = ["Intro", "Verse", "Chorus", "Outro"];

const OBJECT_MOTIFS = {
  person: { motif: [0, 2, 4, 2] },
  bird: { motif: [4, 7, 9, 7] },
  cat: { motif: [0, 3, 7, 10] },
  dog: { motif: [0, 5, 7, 5] },
  car: { motif: [0, 0, 5, 7] },
  bus: { motif: [0, 2, 0, 5] },
  bicycle: { motif: [7, 9, 7, 4] },
  train: { motif: [0, 3, 5, 3] },
  laptop: { motif: [0, 7, 10, 7] },
  cell_phone: { motif: [7, 10, 12, 10] },
  tv: { motif: [0, 2, 7, 9] },
  potted_plant: { motif: [0, 4, 7, 11] },
  book: { motif: [0, 2, 5, 9] },
  cup: { motif: [0, 7, 12, 7] },
  bottle: { motif: [0, 5, 9, 12] }
};

const STORY_TEMPLATES = {
  radiant: "A bright scene blooms into a confident, sparkling groove with wide-open harmony.",
  moody: "A darker frame leans into soft tension, deep bass and late-night melodic turns.",
  dream: "The image drifts into a floating texture with pastel chords and gentle motion.",
  kinetic: "Sharp contrasts and vivid edges push the track toward a punchy, moving rhythm.",
  earthy: "Natural hues shape a warm, organic arrangement full of breath and layered pulse."
};

const elements = {
  fileInput: document.querySelector("#fileInput"),
  demoButton: document.querySelector("#demoButton"),
  playButton: document.querySelector("#playButton"),
  exportButton: document.querySelector("#exportButton"),
  shuffleButton: document.querySelector("#shuffleButton"),
  saveButton: document.querySelector("#saveButton"),
  loadButton: document.querySelector("#loadButton"),
  reanalyzeButton: document.querySelector("#reanalyzeButton"),
  dropZone: document.querySelector("#dropZone"),
  previewCanvas: document.querySelector("#previewCanvas"),
  analysisCanvas: document.querySelector("#analysisCanvas"),
  visualizerCanvas: document.querySelector("#visualizerCanvas"),
  styleSelect: document.querySelector("#styleSelect"),
  focusSelect: document.querySelector("#focusSelect"),
  scaleSelect: document.querySelector("#scaleSelect"),
  tempoSlider: document.querySelector("#tempoSlider"),
  textureSlider: document.querySelector("#textureSlider"),
  mutationSlider: document.querySelector("#mutationSlider"),
  tempoSliderValue: document.querySelector("#tempoSliderValue"),
  textureSliderValue: document.querySelector("#textureSliderValue"),
  mutationSliderValue: document.querySelector("#mutationSliderValue"),
  moodLabel: document.querySelector("#moodLabel"),
  tempoLabel: document.querySelector("#tempoLabel"),
  objectCountLabel: document.querySelector("#objectCountLabel"),
  styleReadout: document.querySelector("#styleReadout"),
  brightnessStat: document.querySelector("#brightnessStat"),
  contrastStat: document.querySelector("#contrastStat"),
  saturationStat: document.querySelector("#saturationStat"),
  edgeStat: document.querySelector("#edgeStat"),
  analysisPanel: document.querySelector(".analysis-panel"),
  paletteBar: document.querySelector("#paletteBar"),
  tagCloud: document.querySelector("#tagCloud"),
  storyText: document.querySelector("#storyText"),
  statusLabel: document.querySelector("#statusLabel"),
  sectionLabel: document.querySelector("#sectionLabel"),
  sourceLabel: document.querySelector("#sourceLabel"),
  timeline: document.querySelector("#timeline")
};

const previewContext = elements.previewCanvas.getContext("2d");
const analysisContext = elements.analysisCanvas.getContext("2d", { willReadFrequently: true });
const visualizerContext = elements.visualizerCanvas.getContext("2d");

const state = {
  image: null,
  imageName: "",
  currentObjectUrl: "",
  analysis: null,
  blueprint: null,
  isPlaying: false,
  audio: null,
  schedulerId: 0,
  visualizerId: 0,
  step: 0,
  nextNoteTime: 0,
  lastScheduledStep: -1,
  sceneVariationSeed: 1,
  objectModel: null,
  objectModelStatus: "pending",
  savedSnapshot: null
};

async function init() {
  restoreSnapshotReference();
  bindEvents();
  drawIdleScene();
  updateSliderLabels();
  renderTimeline([]);
  warmObjectModel();
}

function bindEvents() {
  elements.fileInput.addEventListener("change", async (event) => {
    const [file] = event.target.files || [];
    if (file) {
      await processFile(file);
    }
  });

  elements.demoButton.addEventListener("click", () => processDemoScene());
  elements.playButton.addEventListener("click", togglePlayback);
  elements.exportButton.addEventListener("click", exportCurrentTrack);
  elements.shuffleButton.addEventListener("click", () => {
    state.sceneVariationSeed = Math.random() * 1000 + 1;
    rebuildTrack({ autoplay: state.isPlaying });
  });
  elements.saveButton.addEventListener("click", saveSnapshot);
  elements.loadButton.addEventListener("click", loadSnapshot);
  elements.reanalyzeButton.addEventListener("click", () => reanalyzeCurrentImage(state.isPlaying));

  elements.styleSelect.addEventListener("change", () => {
    elements.styleReadout.textContent = STYLE_PRESETS[elements.styleSelect.value].label;
    rebuildTrack({ autoplay: state.isPlaying });
  });

  elements.focusSelect.addEventListener("change", () => reanalyzeCurrentImage(state.isPlaying));
  elements.scaleSelect.addEventListener("change", () => rebuildTrack({ autoplay: state.isPlaying }));

  for (const slider of [elements.tempoSlider, elements.textureSlider, elements.mutationSlider]) {
    slider.addEventListener("input", () => {
      updateSliderLabels();
      if (state.analysis) {
        rebuildTrack({ autoplay: state.isPlaying });
      }
    });
  }

  ["dragenter", "dragover"].forEach((eventName) => {
    elements.dropZone.addEventListener(eventName, (event) => {
      event.preventDefault();
      elements.dropZone.classList.add("is-dragging");
    });
  });

  ["dragleave", "dragend", "drop"].forEach((eventName) => {
    elements.dropZone.addEventListener(eventName, (event) => {
      event.preventDefault();
      if (eventName !== "drop") {
        elements.dropZone.classList.remove("is-dragging");
      }
    });
  });

  elements.dropZone.addEventListener("drop", async (event) => {
    const [file] = event.dataTransfer?.files || [];
    elements.dropZone.classList.remove("is-dragging");
    if (file) {
      await processFile(file);
    }
  });
}

function updateSliderLabels() {
  elements.tempoSliderValue.textContent = `${elements.tempoSlider.value} BPM`;
  elements.textureSliderValue.textContent = `${elements.textureSlider.value}%`;
  elements.mutationSliderValue.textContent = `${elements.mutationSlider.value}%`;
}

function setStatus(message) {
  if (elements.statusLabel) {
    elements.statusLabel.textContent = message;
  }
}

async function warmObjectModel() {
  if (!window.cocoSsd || state.objectModelStatus === "loading" || state.objectModel) {
    if (!window.cocoSsd && state.objectModelStatus === "pending") {
      state.objectModelStatus = "fallback";
    }
    return;
  }

  state.objectModelStatus = "loading";

  try {
    state.objectModel = await window.cocoSsd.load();
    state.objectModelStatus = "ready";
  } catch (error) {
    console.warn("Object model unavailable, using heuristics only.", error);
    state.objectModelStatus = "fallback";
  }
}

function drawIdleScene() {
  const { width, height } = elements.previewCanvas;
  const gradient = previewContext.createLinearGradient(0, 0, width, height);
  gradient.addColorStop(0, "#0d1c2d");
  gradient.addColorStop(0.5, "#24395f");
  gradient.addColorStop(1, "#f48b5e");
  previewContext.fillStyle = gradient;
  previewContext.fillRect(0, 0, width, height);

  previewContext.fillStyle = "rgba(255, 255, 255, 0.08)";
  for (let index = 0; index < 18; index += 1) {
    previewContext.beginPath();
    previewContext.arc(
      Math.random() * width,
      Math.random() * height,
      10 + Math.random() * 48,
      0,
      Math.PI * 2
    );
    previewContext.fill();
  }

  previewContext.fillStyle = "rgba(5, 12, 20, 0.3)";
  previewContext.fillRect(0, height * 0.65, width, height * 0.35);

  previewContext.fillStyle = "#f5f0e7";
  previewContext.font = '700 34px "Trebuchet MS"';
  previewContext.fillText("Upload a photo to compose a soundtrack", 34, 60);
  previewContext.font = '400 18px "Trebuchet MS"';
  previewContext.fillStyle = "rgba(245, 240, 231, 0.85)";
  previewContext.fillText("Colors drive harmony, objects drive motifs and rhythm.", 36, 92);
}

async function processFile(file) {
  if (!file.type.startsWith("image/")) {
    setStatus("Please upload an image file.");
    return;
  }

  if (state.currentObjectUrl) {
    URL.revokeObjectURL(state.currentObjectUrl);
  }

  const objectUrl = URL.createObjectURL(file);
  state.currentObjectUrl = objectUrl;
  state.imageName = file.name;

  try {
    const image = await loadImage(objectUrl);
    state.image = image;
    await analyzeAndCompose(image, file.name, true);
  } catch (error) {
    console.error(error);
    setStatus("Image loading failed. Try another file.");
  }
}

async function processDemoScene() {
  const { width, height } = elements.analysisCanvas;
  const gradient = analysisContext.createLinearGradient(0, 0, width, height);
  gradient.addColorStop(0, "#11233f");
  gradient.addColorStop(0.38, "#6b4ddc");
  gradient.addColorStop(0.72, "#ff8f4c");
  gradient.addColorStop(1, "#ffe29a");
  analysisContext.fillStyle = gradient;
  analysisContext.fillRect(0, 0, width, height);

  analysisContext.fillStyle = "rgba(255, 255, 255, 0.9)";
  analysisContext.beginPath();
  analysisContext.arc(width * 0.2, height * 0.2, 34, 0, Math.PI * 2);
  analysisContext.fill();

  analysisContext.fillStyle = "#0c1530";
  analysisContext.fillRect(0, height * 0.68, width, height * 0.32);

  analysisContext.fillStyle = "#194f37";
  for (let index = 0; index < 5; index += 1) {
    const trunkX = 30 + index * 56;
    analysisContext.fillRect(trunkX + 12, 180, 12, 70);
    analysisContext.beginPath();
    analysisContext.arc(trunkX + 18, 172, 28, 0, Math.PI * 2);
    analysisContext.fill();
  }

  analysisContext.fillStyle = "#141414";
  analysisContext.fillRect(160, 160, 78, 132);
  analysisContext.fillRect(248, 124, 52, 168);
  analysisContext.fillRect(218, 210, 42, 82);

  const url = elements.analysisCanvas.toDataURL("image/png");
  const image = await loadImage(url);
  state.image = image;
  state.imageName = "demo-scene.png";
  await analyzeAndCompose(image, "demo-scene.png", true);
}

async function reanalyzeCurrentImage(autoplay = false) {
  if (!state.image) {
    return;
  }

  await analyzeAndCompose(state.image, state.imageName || "photo", autoplay);
}

async function analyzeAndCompose(image, sourceName, autoplay = false) {
  setStatus("Analyzing image...");
  drawImageOnPreview(image);
  const imageData = collectFocusedImageData(image);
  const colorAnalysis = analyzePixels(imageData);
  const heuristicObjects = detectHeuristicObjects(colorAnalysis);
  await warmObjectModel();
  const detectedObjects = await detectObjects(image, heuristicObjects);
  const analysis = createAnalysis(colorAnalysis, detectedObjects, sourceName);
  state.analysis = analysis;
  renderAnalysis(analysis);
  rebuildTrack({ autoplay });
  setStatus("Track ready. Press Play to hear the scene.");
}

function drawImageOnPreview(image) {
  const { width, height } = elements.previewCanvas;
  previewContext.clearRect(0, 0, width, height);

  const imageRatio = image.width / image.height;
  const canvasRatio = width / height;
  let drawWidth = width;
  let drawHeight = height;
  let offsetX = 0;
  let offsetY = 0;

  if (imageRatio > canvasRatio) {
    drawWidth = height * imageRatio;
    offsetX = (width - drawWidth) / 2;
  } else {
    drawHeight = width / imageRatio;
    offsetY = (height - drawHeight) / 2;
  }

  previewContext.drawImage(image, offsetX, offsetY, drawWidth, drawHeight);
}

function collectFocusedImageData(image) {
  const canvas = elements.analysisCanvas;
  const { width, height } = canvas;
  analysisContext.clearRect(0, 0, width, height);
  analysisContext.drawImage(image, 0, 0, width, height);

  const focus = elements.focusSelect.value;
  const bounds = getFocusBounds(focus, width, height);
  const focused = analysisContext.getImageData(bounds.x, bounds.y, bounds.width, bounds.height);
  analysisContext.clearRect(0, 0, width, height);
  analysisContext.putImageData(focused, 0, 0);
  return focused;
}

function getFocusBounds(focus, width, height) {
  const halfWidth = Math.floor(width / 2);
  const halfHeight = Math.floor(height / 2);

  switch (focus) {
    case "center":
      return {
        x: Math.floor(width * 0.2),
        y: Math.floor(height * 0.2),
        width: Math.floor(width * 0.6),
        height: Math.floor(height * 0.6)
      };
    case "top":
      return { x: 0, y: 0, width, height: halfHeight };
    case "bottom":
      return { x: 0, y: halfHeight, width, height: halfHeight };
    case "left":
      return { x: 0, y: 0, width: halfWidth, height };
    case "right":
      return { x: halfWidth, y: 0, width: halfWidth, height };
    default:
      return { x: 0, y: 0, width, height };
  }
}

function analyzePixels(imageData) {
  const pixels = imageData.data;
  const paletteMap = new Map();
  const luminanceBuckets = new Array(16).fill(0);
  const hueVector = { x: 0, y: 0 };

  let redTotal = 0;
  let greenTotal = 0;
  let blueTotal = 0;
  let lightnessTotal = 0;
  let saturationTotal = 0;
  let warmthTotal = 0;
  let brightnessSquareTotal = 0;
  let samples = 0;

  for (let index = 0; index < pixels.length; index += 16) {
    const red = pixels[index];
    const green = pixels[index + 1];
    const blue = pixels[index + 2];
    const alpha = pixels[index + 3];

    if (alpha < 10) {
      continue;
    }

    const { h, s, l } = rgbToHsl(red, green, blue);
    const luminance = (0.2126 * red + 0.7152 * green + 0.0722 * blue) / 255;

    redTotal += red;
    greenTotal += green;
    blueTotal += blue;
    lightnessTotal += l;
    saturationTotal += s;
    warmthTotal += (red - blue) / 255;
    brightnessSquareTotal += luminance * luminance;
    samples += 1;
    hueVector.x += Math.cos((h / 180) * Math.PI);
    hueVector.y += Math.sin((h / 180) * Math.PI);

    const bucket = Math.min(15, Math.floor(luminance * 16));
    luminanceBuckets[bucket] += 1;

    const key = [
      Math.round(red / 32) * 32,
      Math.round(green / 32) * 32,
      Math.round(blue / 32) * 32
    ].join(",");
    paletteMap.set(key, (paletteMap.get(key) || 0) + 1);
  }

  const averageRed = redTotal / samples;
  const averageGreen = greenTotal / samples;
  const averageBlue = blueTotal / samples;
  const averageBrightness = lightnessTotal / samples;
  const averageSaturation = saturationTotal / samples;
  const averageWarmth = warmthTotal / samples;
  const luminanceMean =
    (0.2126 * averageRed + 0.7152 * averageGreen + 0.0722 * averageBlue) / 255;
  const luminanceVariance = brightnessSquareTotal / samples - luminanceMean * luminanceMean;
  const contrast = Math.sqrt(Math.max(0, luminanceVariance));
  const hueAngle = (Math.atan2(hueVector.y, hueVector.x) * 180) / Math.PI;
  const averageHue = (hueAngle + 360) % 360;

  const palette = [...paletteMap.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([key, count]) => {
      const [red, green, blue] = key.split(",").map(Number);
      return {
        hex: rgbToHex(red, green, blue),
        rgb: { red, green, blue },
        count
      };
    });

  const entropy = luminanceBuckets.reduce((total, count) => {
    if (!count) {
      return total;
    }
    const probability = count / samples;
    return total - probability * Math.log2(probability);
  }, 0);

  const edgeDensity = computeEdgeDensity(imageData);
  const colorVariance =
    (Math.abs(averageRed - averageGreen) +
      Math.abs(averageGreen - averageBlue) +
      Math.abs(averageRed - averageBlue)) /
    765;

  return {
    averageColor: rgbToHex(averageRed, averageGreen, averageBlue),
    averageHue,
    averageBrightness,
    averageSaturation,
    averageWarmth,
    contrast,
    edgeDensity,
    entropy,
    colorVariance,
    palette
  };
}

function computeEdgeDensity(imageData) {
  const { data, width, height } = imageData;
  let edgeScore = 0;
  let count = 0;

  for (let y = 1; y < height - 1; y += 4) {
    for (let x = 1; x < width - 1; x += 4) {
      const index = (y * width + x) * 4;
      const right = index + 4;
      const bottom = index + width * 4;
      const left = index - 4;
      const top = index - width * 4;

      const dx =
        Math.abs(data[right] - data[left]) +
        Math.abs(data[right + 1] - data[left + 1]) +
        Math.abs(data[right + 2] - data[left + 2]);
      const dy =
        Math.abs(data[bottom] - data[top]) +
        Math.abs(data[bottom + 1] - data[top + 1]) +
        Math.abs(data[bottom + 2] - data[top + 2]);

      edgeScore += Math.min(1, (dx + dy) / 510);
      count += 1;
    }
  }

  return count ? edgeScore / count : 0;
}

function detectHeuristicObjects(colorAnalysis) {
  const tags = [];
  const {
    palette,
    averageBrightness,
    averageSaturation,
    averageWarmth,
    contrast,
    edgeDensity,
    colorVariance,
    averageHue,
    entropy
  } = colorAnalysis;
  const paletteHex = palette.map((entry) => entry.hex.toLowerCase());

  const isBlueDominant = averageHue > 180 && averageHue < 250;
  const isGreenDominant = averageHue > 85 && averageHue < 155;
  const isOrangeDominant = averageHue > 15 && averageHue < 50;

  if (averageBrightness > 0.62 && isBlueDominant) {
    tags.push("sky", "bird");
  }

  if (isGreenDominant && averageBrightness > 0.25) {
    tags.push("forest", "potted_plant");
  }

  if (isBlueDominant && averageBrightness < 0.45) {
    tags.push("night", "city");
  }

  if (averageWarmth > 0.18 && isOrangeDominant) {
    tags.push("sunset");
  }

  if (averageSaturation > 0.56 && contrast > 0.18) {
    tags.push("festival", "person");
  }

  if (edgeDensity > 0.4 && colorVariance < 0.18) {
    tags.push("architecture", "car");
  }

  if (paletteHex.some((hex) => /^#f/.test(hex)) && averageSaturation > 0.48) {
    tags.push("flower");
  }

  if (averageBrightness < 0.26 && contrast > 0.18) {
    tags.push("night", "laptop");
  }

  if (entropy > 3.4) {
    tags.push("abstract");
  }

  return unique(tags);
}

async function detectObjects(image, heuristicObjects) {
  const results = [];

  if (state.objectModelStatus === "ready" && state.objectModel) {
    try {
      const predictions = await state.objectModel.detect(image, 6);
      for (const prediction of predictions) {
        if (prediction.score >= 0.4) {
          results.push({
            label: prediction.class,
            confidence: prediction.score
          });
        }
      }
    } catch (error) {
      console.warn("Object detection failed, falling back to heuristics.", error);
    }
  }

  for (const tag of heuristicObjects) {
    const existing = results.find((entry) => entry.label === tag);
    if (!existing) {
      results.push({
        label: tag,
        confidence: 0.3
      });
    }
  }

  return results.slice(0, 8);
}

function createAnalysis(colorAnalysis, objects, sourceName) {
  const mood = determineMood(colorAnalysis, objects);
  const rootNote = noteFromHue(colorAnalysis.averageHue);
  const scaleName = resolveScale(mood);
  const autoTempo = Math.round(
    clamp(
      78 + colorAnalysis.edgeDensity * 46 + colorAnalysis.contrast * 80 + colorAnalysis.averageSaturation * 18,
      72,
      156
    )
  );
  const tempo = Number(elements.tempoSlider.value) || autoTempo;
  const story = createStoryline(mood, colorAnalysis, objects);
  const sections = buildSections(colorAnalysis, objects, mood);

  return {
    ...colorAnalysis,
    objects,
    tags: unique(objects.map((entry) => entry.label)),
    mood,
    rootNote,
    scaleName,
    autoTempo,
    tempo,
    story,
    sections,
    sourceName
  };
}

function determineMood(colorAnalysis, objects) {
  const labels = objects.map((entry) => entry.label);

  if (colorAnalysis.averageBrightness > 0.62 && colorAnalysis.averageSaturation > 0.45) {
    return "radiant";
  }

  if (labels.includes("night") || labels.includes("laptop") || colorAnalysis.averageBrightness < 0.32) {
    return "moody";
  }

  if (labels.includes("forest") || labels.includes("potted_plant") || colorAnalysis.averageWarmth > 0.14) {
    return "earthy";
  }

  if (colorAnalysis.edgeDensity > 0.44 || labels.includes("car") || labels.includes("architecture")) {
    return "kinetic";
  }

  return "dream";
}

function resolveScale(mood) {
  const selected = elements.scaleSelect.value;
  if (selected !== "auto") {
    return selected;
  }

  if (mood === "radiant") {
    return "major";
  }

  if (mood === "moody") {
    return "minor";
  }

  if (mood === "earthy") {
    return "dorian";
  }

  if (mood === "kinetic") {
    return "pentatonic";
  }

  return "lydian";
}

function buildSections(colorAnalysis, objects, mood) {
  const energy = clamp(
    colorAnalysis.averageSaturation * 0.45 + colorAnalysis.edgeDensity * 0.35 + colorAnalysis.contrast * 0.2,
    0,
    1
  );

  return SECTION_NAMES.map((name, index) => ({
    name,
    energy: clamp(energy + (index - 1.2) * 0.12, 0.12, 1),
    texture: clamp(colorAnalysis.entropy / 4 + index * 0.08, 0.1, 1),
    tension: clamp(objects.length * 0.08 + index * 0.1 + (mood === "moody" ? 0.15 : 0), 0.08, 1)
  }));
}

function createStoryline(mood, colorAnalysis, objects) {
  const objectFragment = objects.length
    ? ` Detected anchors: ${objects.slice(0, 4).map((entry) => entry.label).join(", ")}.`
    : "";
  const paletteFragment = ` Palette leans toward ${colorAnalysis.palette
    .slice(0, 3)
    .map((entry) => entry.hex)
    .join(", ")}.`;
  return `${STORY_TEMPLATES[mood]}${paletteFragment}${objectFragment}`;
}

function rebuildTrack({ autoplay = false } = {}) {
  if (!state.analysis) {
    return;
  }

  const style = STYLE_PRESETS[elements.styleSelect.value];
  state.blueprint = buildBlueprint(state.analysis, style);
  renderTimeline(state.analysis.sections);
  elements.playButton.disabled = false;
  elements.exportButton.disabled = false;
  elements.shuffleButton.disabled = false;
  elements.saveButton.disabled = false;
  elements.reanalyzeButton.disabled = false;

  if (state.isPlaying) {
    stopPlayback();
  }

  if (autoplay) {
    startPlayback();
  }
}

function buildBlueprint(analysis, style) {
  const scale = SCALE_LIBRARY[analysis.scaleName];
  const rootMidi = 48 + analysis.rootNote;
  const mutation = Number(elements.mutationSlider.value) / 100;
  const textureAmount = Number(elements.textureSlider.value) / 100;
  const basePattern = createBasePattern(scale, analysis, mutation);
  const motifPattern = createObjectMotif(scale, analysis.tags, mutation);
  const leadPattern = blendPatterns(basePattern, motifPattern, mutation);
  const bassPattern = createBassPattern(scale, analysis);
  const chordPattern = createChordPattern(scale, analysis);
  const drumPattern = createDrumPattern(analysis, mutation);
  const padLevels = analysis.sections.map((section) => 0.18 + section.texture * 0.12);

  return {
    style,
    bpm: analysis.tempo,
    secondsPerBeat: 60 / analysis.tempo,
    stepLength: (60 / analysis.tempo) / 2,
    scale,
    rootMidi,
    textureAmount,
    leadPattern,
    bassPattern,
    chordPattern,
    drumPattern,
    padLevels,
    sections: analysis.sections,
    themeColor: analysis.palette[0]?.hex || style.textureColor,
    title: `${NOTES[analysis.rootNote]} ${scale.label}`,
    tags: analysis.tags,
    mood: analysis.mood
  };
}

function createBasePattern(scale, analysis, mutation) {
  const steps = [];
  const palette = analysis.palette.length ? analysis.palette : [{ rgb: { red: 160, green: 180, blue: 210 } }];
  const sectionBias = analysis.sections.map((section) => section.energy);

  for (let step = 0; step < 32; step += 1) {
    const paletteEntry = palette[step % palette.length];
    const rgbSum = paletteEntry.rgb.red + paletteEntry.rgb.green + paletteEntry.rgb.blue;
    const degree = (Math.floor(rgbSum / 64) + Math.floor(sectionBias[Math.floor(step / 8)] * 3)) % scale.intervals.length;
    const octave = step % 8 === 0 ? 2 : step % 6 === 0 ? 1 : 0;
    const gate = randomFrom(step + state.sceneVariationSeed) > mutation * 0.74;

    steps.push({
      degree,
      octave,
      velocity: clamp(0.42 + analysis.averageSaturation * 0.46 + randomFrom(step) * 0.16, 0.2, 0.95),
      gate
    });
  }

  return steps;
}

function createObjectMotif(scale, tags, mutation) {
  const motif = new Array(32).fill(null);
  const mappedTags = tags.filter((tag) => OBJECT_MOTIFS[tag]);
  const primaryTag = mappedTags[0];

  if (!primaryTag) {
    return motif;
  }

  const objectMotif = OBJECT_MOTIFS[primaryTag];

  for (let step = 0; step < 32; step += 1) {
    const source = objectMotif.motif[step % objectMotif.motif.length];
    motif[step] = {
      degree: ((source % 12) + scale.intervals.length) % scale.intervals.length,
      octave: source >= 9 ? 1 : 0,
      velocity: clamp(0.54 + mutation * 0.3, 0.3, 0.96),
      gate: step % 2 === 0 || mutation > 0.32
    };
  }

  return motif;
}

function blendPatterns(basePattern, motifPattern, mutation) {
  return basePattern.map((step, index) => {
    const motif = motifPattern[index];
    if (!motif || randomFrom(index + 42) > mutation + 0.28) {
      return step;
    }

    return {
      degree: motif.degree,
      octave: motif.octave,
      velocity: clamp((step.velocity + motif.velocity) / 2 + 0.08, 0.2, 1),
      gate: step.gate && motif.gate
    };
  });
}

function createBassPattern(scale, analysis) {
  const pattern = [];

  for (let step = 0; step < 32; step += 1) {
    const strongBeat = step % 4 === 0;
    const degree =
      step % 16 === 12
        ? Math.min(4, scale.intervals.length - 1)
        : step % 8 === 4
          ? 3 % scale.intervals.length
          : 0;
    pattern.push({
      degree,
      octave: -1,
      velocity: strongBeat ? 0.75 : 0.52,
      gate: strongBeat || (analysis.edgeDensity > 0.36 && step % 8 === 6)
    });
  }

  return pattern;
}

function createChordPattern(scale, analysis) {
  const chords = [];

  for (let index = 0; index < 4; index += 1) {
    const rootDegree = index === 2 ? 4 % scale.intervals.length : index === 1 ? 3 % scale.intervals.length : 0;
    const notes = [0, 2, 4].map((offset) => scale.intervals[(rootDegree + offset) % scale.intervals.length]);
    chords.push({
      rootDegree,
      notes,
      durationSteps: 8,
      velocity: clamp(0.28 + analysis.averageBrightness * 0.24 + index * 0.04, 0.18, 0.72)
    });
  }

  return chords;
}

function createDrumPattern(analysis, mutation) {
  const kick = [];
  const snare = [];
  const hat = [];
  const accent = [];
  const density = clamp(analysis.edgeDensity * 0.7 + mutation * 0.3, 0.12, 1);

  for (let step = 0; step < 32; step += 1) {
    kick.push(step % 8 === 0 || (density > 0.44 && step % 16 === 10));
    snare.push(step % 8 === 4);
    hat.push(step % 2 === 0 || (density > 0.66 && step % 4 === 1));
    accent.push((analysis.averageSaturation > 0.5 && step % 8 === 6) || (analysis.tags.includes("bird") && step % 8 === 2));
  }

  return { kick, snare, hat, accent };
}

async function ensureAudio() {
  if (state.audio) {
    return state.audio;
  }

  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  const context = new AudioContextClass();
  const analyser = context.createAnalyser();
  analyser.fftSize = 256;

  const masterGain = context.createGain();
  masterGain.gain.value = 0.82;

  const delay = context.createDelay();
  delay.delayTime.value = 0.22;

  const delayGain = context.createGain();
  delayGain.gain.value = 0.18;

  masterGain.connect(analyser);
  analyser.connect(context.destination);
  masterGain.connect(delay);
  delay.connect(delayGain);
  delayGain.connect(analyser);

  state.audio = {
    context,
    analyser,
    masterGain,
    delay,
    delayGain,
    noiseBuffer: createNoiseBuffer(context)
  };

  return state.audio;
}

async function startPlayback() {
  if (!state.blueprint) {
    return;
  }

  const audio = await ensureAudio();
  if (audio.context.state === "suspended") {
    await audio.context.resume();
  }

  state.isPlaying = true;
  state.step = 0;
  state.lastScheduledStep = -1;
  state.nextNoteTime = audio.context.currentTime + 0.08;
  audio.delayGain.gain.setValueAtTime(state.blueprint.style.delayMix, audio.context.currentTime);

  if (state.schedulerId) {
    window.clearInterval(state.schedulerId);
  }

  state.schedulerId = window.setInterval(schedulePlayback, 25);
  elements.playButton.textContent = "Pause";
  visualize();
}

function stopPlayback() {
  if (state.schedulerId) {
    window.clearInterval(state.schedulerId);
    state.schedulerId = 0;
  }

  if (state.visualizerId) {
    window.cancelAnimationFrame(state.visualizerId);
    state.visualizerId = 0;
  }

  state.isPlaying = false;
  elements.playButton.textContent = "Play";
}

async function togglePlayback() {
  if (!state.blueprint) {
    return;
  }

  if (state.isPlaying) {
    stopPlayback();
    return;
  }

  await startPlayback();
}

function schedulePlayback() {
  if (!state.audio || !state.blueprint) {
    return;
  }

  const lookAhead = 0.18;
  const currentTime = state.audio.context.currentTime;

  while (state.nextNoteTime < currentTime + lookAhead) {
    scheduleStep(state.step, state.nextNoteTime, state.audio.context, state.audio, state.blueprint);
    state.lastScheduledStep = state.step;
    state.nextNoteTime += state.blueprint.stepLength;
    state.step = (state.step + 1) % 32;
  }
}

function scheduleStep(stepIndex, time, context, audioNodes, blueprint) {
  const style = blueprint.style;
  const swingOffset = stepIndex % 2 === 1 ? blueprint.stepLength * style.swing : 0;
  const swingTime = time + swingOffset;
  const sectionIndex = Math.floor(stepIndex / 8);
  const section = blueprint.sections[sectionIndex];
  elements.sectionLabel.textContent = section.name;
  setActiveTimeline(sectionIndex);

  const bassStep = blueprint.bassPattern[stepIndex];
  if (bassStep.gate) {
    playSynthNote(context, audioNodes, {
      midi: midiFromDegree(blueprint.rootMidi, blueprint.scale, bassStep.degree, bassStep.octave),
      startTime: swingTime,
      duration: blueprint.stepLength * 1.55,
      velocity: bassStep.velocity,
      waveform: style.bassWave,
      filterFrequency: style.filterBase * 0.72,
      detuneSpread: 6
    });
  }

  const leadStep = blueprint.leadPattern[stepIndex];
  if (leadStep.gate) {
    playSynthNote(context, audioNodes, {
      midi: midiFromDegree(blueprint.rootMidi, blueprint.scale, leadStep.degree, leadStep.octave + 1),
      startTime: swingTime + 0.01,
      duration: blueprint.stepLength * 0.92,
      velocity: leadStep.velocity,
      waveform: style.leadWave,
      filterFrequency: style.filterBase + section.energy * 1200,
      detuneSpread: 10
    });
  }

  if (stepIndex % 8 === 0) {
    const chord = blueprint.chordPattern[sectionIndex];
    playChord(context, audioNodes, blueprint, chord, swingTime, section);
  }

  playDrums(context, audioNodes, blueprint, swingTime, stepIndex, section);

  if (stepIndex % 4 === 0) {
    playTexture(context, audioNodes, blueprint, swingTime, section);
  }
}

function playChord(context, audioNodes, blueprint, chord, time, section) {
  const duration = blueprint.stepLength * chord.durationSteps * 0.9;
  const cutoff = blueprint.style.filterBase * (0.65 + section.texture);

  for (let index = 0; index < chord.notes.length; index += 1) {
    playSynthNote(context, audioNodes, {
      midi: blueprint.rootMidi + chord.notes[index] + 12,
      startTime: time + index * 0.015,
      duration,
      velocity: chord.velocity * blueprint.padLevels[Math.floor(time / (blueprint.stepLength * 8)) % blueprint.padLevels.length],
      waveform: blueprint.style.padWave,
      filterFrequency: cutoff,
      detuneSpread: 4
    });
  }
}

function playDrums(context, audioNodes, blueprint, time, stepIndex, section) {
  const drumPattern = blueprint.drumPattern;

  if (drumPattern.kick[stepIndex]) {
    playKick(context, audioNodes, time, 0.75 + section.energy * 0.18);
  }

  if (drumPattern.snare[stepIndex]) {
    playSnare(context, audioNodes, time, 0.32 + section.tension * 0.16);
  }

  if (drumPattern.hat[stepIndex]) {
    playHat(context, audioNodes, time, 0.16 + section.energy * 0.08);
  }

  if (drumPattern.accent[stepIndex]) {
    playClick(context, audioNodes, time + 0.006, 0.2 + section.texture * 0.12);
  }
}

function playTexture(context, audioNodes, blueprint, time, section) {
  const textureAmount = blueprint.textureAmount;
  if (textureAmount < 0.08) {
    return;
  }

  const noise = context.createBufferSource();
  noise.buffer = audioNodes.noiseBuffer;
  const filter = context.createBiquadFilter();
  filter.type = "bandpass";
  filter.frequency.setValueAtTime(240 + section.texture * 2200, time);
  filter.Q.value = 0.8;

  const gain = context.createGain();
  gain.gain.setValueAtTime(0, time);
  gain.gain.linearRampToValueAtTime(0.018 + textureAmount * 0.048, time + 0.04);
  gain.gain.exponentialRampToValueAtTime(0.0001, time + blueprint.stepLength * 1.9);

  noise.connect(filter);
  filter.connect(gain);
  gain.connect(audioNodes.masterGain);
  noise.start(time);
  noise.stop(time + blueprint.stepLength * 2);
}

function playSynthNote(context, audioNodes, options) {
  const frequency = midiToFrequency(options.midi);
  const oscillatorA = context.createOscillator();
  const oscillatorB = context.createOscillator();
  const gain = context.createGain();
  const filter = context.createBiquadFilter();

  oscillatorA.type = options.waveform;
  oscillatorB.type = options.waveform;
  oscillatorA.frequency.setValueAtTime(frequency, options.startTime);
  oscillatorB.frequency.setValueAtTime(frequency, options.startTime);
  oscillatorB.detune.setValueAtTime(options.detuneSpread || 0, options.startTime);

  filter.type = "lowpass";
  filter.frequency.setValueAtTime(options.filterFrequency || 900, options.startTime);
  filter.Q.value = 1.2;

  gain.gain.setValueAtTime(0.0001, options.startTime);
  gain.gain.linearRampToValueAtTime(options.velocity * 0.18, options.startTime + 0.03);
  gain.gain.exponentialRampToValueAtTime(0.0001, options.startTime + options.duration);

  oscillatorA.connect(filter);
  oscillatorB.connect(filter);
  filter.connect(gain);
  gain.connect(audioNodes.masterGain);

  oscillatorA.start(options.startTime);
  oscillatorB.start(options.startTime);
  oscillatorA.stop(options.startTime + options.duration + 0.04);
  oscillatorB.stop(options.startTime + options.duration + 0.04);
}

function playKick(context, audioNodes, time, amount) {
  const oscillator = context.createOscillator();
  const gain = context.createGain();

  oscillator.type = "sine";
  oscillator.frequency.setValueAtTime(120, time);
  oscillator.frequency.exponentialRampToValueAtTime(48, time + 0.15);

  gain.gain.setValueAtTime(amount * 0.28, time);
  gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.2);

  oscillator.connect(gain);
  gain.connect(audioNodes.masterGain);
  oscillator.start(time);
  oscillator.stop(time + 0.22);
}

function playSnare(context, audioNodes, time, amount) {
  const noise = context.createBufferSource();
  noise.buffer = audioNodes.noiseBuffer;
  const filter = context.createBiquadFilter();
  filter.type = "highpass";
  filter.frequency.setValueAtTime(1400, time);
  const gain = context.createGain();
  gain.gain.setValueAtTime(amount, time);
  gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.18);

  noise.connect(filter);
  filter.connect(gain);
  gain.connect(audioNodes.masterGain);
  noise.start(time);
  noise.stop(time + 0.18);
}

function playHat(context, audioNodes, time, amount) {
  const noise = context.createBufferSource();
  noise.buffer = audioNodes.noiseBuffer;
  const filter = context.createBiquadFilter();
  filter.type = "highpass";
  filter.frequency.setValueAtTime(5400, time);
  const gain = context.createGain();
  gain.gain.setValueAtTime(amount, time);
  gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.045);

  noise.connect(filter);
  filter.connect(gain);
  gain.connect(audioNodes.masterGain);
  noise.start(time);
  noise.stop(time + 0.05);
}

function playClick(context, audioNodes, time, amount) {
  const oscillator = context.createOscillator();
  const gain = context.createGain();

  oscillator.type = "square";
  oscillator.frequency.setValueAtTime(1600, time);
  oscillator.frequency.exponentialRampToValueAtTime(720, time + 0.02);
  gain.gain.setValueAtTime(amount, time);
  gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.03);

  oscillator.connect(gain);
  gain.connect(audioNodes.masterGain);
  oscillator.start(time);
  oscillator.stop(time + 0.04);
}

function createNoiseBuffer(context) {
  const buffer = context.createBuffer(1, context.sampleRate * 2, context.sampleRate);
  const channelData = buffer.getChannelData(0);

  for (let index = 0; index < channelData.length; index += 1) {
    channelData[index] = Math.random() * 2 - 1;
  }

  return buffer;
}

function visualize() {
  if (!state.audio || !state.isPlaying) {
    return;
  }

  const analyser = state.audio.analyser;
  const bufferLength = analyser.frequencyBinCount;
  const dataArray = new Uint8Array(bufferLength);
  analyser.getByteFrequencyData(dataArray);

  const { width, height } = elements.visualizerCanvas;
  visualizerContext.clearRect(0, 0, width, height);
  const gradient = visualizerContext.createLinearGradient(0, 0, width, height);
  gradient.addColorStop(0, "rgba(255, 179, 71, 0.22)");
  gradient.addColorStop(1, "rgba(131, 232, 255, 0.06)");
  visualizerContext.fillStyle = gradient;
  visualizerContext.fillRect(0, 0, width, height);

  const barWidth = width / bufferLength;
  for (let index = 0; index < bufferLength; index += 1) {
    const barHeight = (dataArray[index] / 255) * height;
    const hue = 200 - index * 0.8;
    visualizerContext.fillStyle = `hsla(${hue}, 80%, 62%, 0.9)`;
    visualizerContext.fillRect(index * barWidth, height - barHeight, Math.max(2, barWidth - 1), barHeight);
  }

  if (state.blueprint) {
    visualizerContext.strokeStyle = state.blueprint.themeColor;
    visualizerContext.lineWidth = 3;
    visualizerContext.beginPath();

    for (let index = 0; index < state.blueprint.leadPattern.length; index += 1) {
      const step = state.blueprint.leadPattern[index];
      const x = (index / 31) * width;
      const y = height * 0.2 + (1 - (step.degree + step.octave * 0.5) / 8) * height * 0.56;

      if (index === 0) {
        visualizerContext.moveTo(x, y);
      } else {
        visualizerContext.lineTo(x, y);
      }
    }

    visualizerContext.stroke();
  }

  state.visualizerId = window.requestAnimationFrame(visualize);
}

function renderAnalysis(analysis) {
  if (elements.analysisPanel) {
    elements.analysisPanel.classList.add("is-loaded");
  }

  elements.moodLabel.textContent = capitalize(analysis.mood);
  elements.tempoLabel.textContent = `${analysis.tempo} BPM`;
  elements.objectCountLabel.textContent = String(analysis.tags.length);
  elements.styleReadout.textContent = STYLE_PRESETS[elements.styleSelect.value].label;
  elements.brightnessStat.textContent = `${Math.round(analysis.averageBrightness * 100)}%`;
  elements.contrastStat.textContent = `${Math.round(analysis.contrast * 100)}%`;
  elements.saturationStat.textContent = `${Math.round(analysis.averageSaturation * 100)}%`;
  elements.edgeStat.textContent = `${Math.round(analysis.edgeDensity * 100)}%`;
  elements.storyText.textContent = analysis.story;
  elements.sourceLabel.textContent = analysis.sourceName;

  elements.paletteBar.innerHTML = "";
  for (const entry of analysis.palette) {
    const chip = document.createElement("div");
    chip.className = "palette-chip";
    chip.style.background = entry.hex;
    const label = document.createElement("span");
    label.textContent = entry.hex;
    chip.appendChild(label);
    elements.paletteBar.appendChild(chip);
  }

  elements.tagCloud.innerHTML = "";
  for (const tag of analysis.tags) {
    const tagElement = document.createElement("span");
    tagElement.className = "tag";
    tagElement.textContent = tag;
    elements.tagCloud.appendChild(tagElement);
  }
}

function renderTimeline(sections) {
  elements.timeline.innerHTML = "";
  if (!sections.length) {
    return;
  }

  for (const section of sections) {
    const card = document.createElement("div");
    card.className = "timeline-segment";
    const title = document.createElement("strong");
    title.textContent = section.name;
    const meta = document.createElement("span");
    meta.textContent = `Energy ${Math.round(section.energy * 100)}%`;
    card.appendChild(title);
    card.appendChild(meta);
    elements.timeline.appendChild(card);
  }
}

function setActiveTimeline(index) {
  const nodes = elements.timeline.querySelectorAll(".timeline-segment");
  nodes.forEach((node, nodeIndex) => {
    node.classList.toggle("active", nodeIndex === index);
  });
}

function saveSnapshot() {
  if (!state.analysis || !state.blueprint) {
    return;
  }

  const payload = {
    timestamp: Date.now(),
    settings: {
      style: elements.styleSelect.value,
      focus: elements.focusSelect.value,
      scale: elements.scaleSelect.value,
      tempo: elements.tempoSlider.value,
      texture: elements.textureSlider.value,
      mutation: elements.mutationSlider.value
    },
    analysis: state.analysis,
    variationSeed: state.sceneVariationSeed,
    previewImage: elements.previewCanvas.toDataURL("image/png")
  };

  localStorage.setItem("music-picture-snapshot", JSON.stringify(payload));
  state.savedSnapshot = payload;
  setStatus("Snapshot saved locally.");
}

function restoreSnapshotReference() {
  const raw = localStorage.getItem("music-picture-snapshot");
  if (!raw) {
    return;
  }

  try {
    state.savedSnapshot = JSON.parse(raw);
  } catch (error) {
    console.warn("Stored snapshot could not be parsed.", error);
  }
}

async function loadSnapshot() {
  const snapshot = state.savedSnapshot;
  if (!snapshot) {
    setStatus("No saved snapshot yet.");
    return;
  }

  elements.styleSelect.value = snapshot.settings.style;
  elements.focusSelect.value = snapshot.settings.focus;
  elements.scaleSelect.value = snapshot.settings.scale;
  elements.tempoSlider.value = snapshot.settings.tempo;
  elements.textureSlider.value = snapshot.settings.texture;
  elements.mutationSlider.value = snapshot.settings.mutation;
  updateSliderLabels();
  elements.styleReadout.textContent = STYLE_PRESETS[elements.styleSelect.value].label;

  state.analysis = snapshot.analysis;
  state.sceneVariationSeed = snapshot.variationSeed || 1;
  renderAnalysis(snapshot.analysis);
  renderTimeline(snapshot.analysis.sections);

  if (snapshot.previewImage) {
    const image = await loadImage(snapshot.previewImage);
    state.image = image;
    drawImageOnPreview(image);
  }

  rebuildTrack({ autoplay: false });
  setStatus("Snapshot restored.");
}

async function exportCurrentTrack() {
  if (!state.blueprint) {
    return;
  }

  setStatus("Rendering WAV export...");

  try {
    const audioBuffer = await renderOfflineTrack(state.blueprint, 16);
    const wavBlob = audioBufferToWav(audioBuffer);
    const downloadUrl = URL.createObjectURL(wavBlob);
    const link = document.createElement("a");
    link.href = downloadUrl;
    link.download = `chromatune-${Date.now()}.wav`;
    link.click();
    URL.revokeObjectURL(downloadUrl);
    setStatus("WAV exported.");
  } catch (error) {
    console.error(error);
    setStatus("WAV export failed.");
  }
}

async function renderOfflineTrack(blueprint, bars = 16) {
  const sampleRate = 44100;
  const durationSeconds = blueprint.stepLength * 8 * bars + 2;
  const OfflineContext = window.OfflineAudioContext || window.webkitOfflineAudioContext;
  const context = new OfflineContext(2, Math.ceil(sampleRate * durationSeconds), sampleRate);
  const analyser = context.createAnalyser();
  const masterGain = context.createGain();
  const delay = context.createDelay();
  const delayGain = context.createGain();

  analyser.fftSize = 256;
  masterGain.gain.value = 0.86;
  delay.delayTime.value = 0.22;
  delayGain.gain.value = blueprint.style.delayMix;

  masterGain.connect(analyser);
  analyser.connect(context.destination);
  masterGain.connect(delay);
  delay.connect(delayGain);
  delayGain.connect(analyser);

  const audioNodes = {
    masterGain,
    analyser,
    delay,
    delayGain,
    noiseBuffer: createNoiseBuffer(context)
  };

  for (let step = 0; step < bars * 8; step += 1) {
    const normalizedStep = step % 32;
    const time = 0.12 + step * blueprint.stepLength;
    scheduleStep(normalizedStep, time, context, audioNodes, blueprint);
  }

  return context.startRendering();
}

function audioBufferToWav(audioBuffer) {
  const numberOfChannels = audioBuffer.numberOfChannels;
  const sampleRate = audioBuffer.sampleRate;
  const samples = audioBuffer.length;
  const bytesPerSample = 2;
  const blockAlign = numberOfChannels * bytesPerSample;
  const buffer = new ArrayBuffer(44 + samples * blockAlign);
  const view = new DataView(buffer);

  writeAscii(view, 0, "RIFF");
  view.setUint32(4, 36 + samples * blockAlign, true);
  writeAscii(view, 8, "WAVE");
  writeAscii(view, 12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, numberOfChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * blockAlign, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bytesPerSample * 8, true);
  writeAscii(view, 36, "data");
  view.setUint32(40, samples * blockAlign, true);

  let offset = 44;
  const channels = [];
  for (let channel = 0; channel < numberOfChannels; channel += 1) {
    channels.push(audioBuffer.getChannelData(channel));
  }

  for (let index = 0; index < samples; index += 1) {
    for (let channel = 0; channel < numberOfChannels; channel += 1) {
      const sample = clamp(channels[channel][index], -1, 1);
      view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
      offset += 2;
    }
  }

  return new Blob([view], { type: "audio/wav" });
}

function writeAscii(view, offset, value) {
  for (let index = 0; index < value.length; index += 1) {
    view.setUint8(offset + index, value.charCodeAt(index));
  }
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = src;
  });
}

function rgbToHsl(red, green, blue) {
  const r = red / 255;
  const g = green / 255;
  const b = blue / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const delta = max - min;
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;

  if (delta !== 0) {
    s = delta / (1 - Math.abs(2 * l - 1));

    switch (max) {
      case r:
        h = 60 * (((g - b) / delta) % 6);
        break;
      case g:
        h = 60 * ((b - r) / delta + 2);
        break;
      default:
        h = 60 * ((r - g) / delta + 4);
        break;
    }
  }

  return {
    h: (h + 360) % 360,
    s: Number.isFinite(s) ? s : 0,
    l
  };
}

function rgbToHex(red, green, blue) {
  return `#${[red, green, blue]
    .map((value) => Math.round(value).toString(16).padStart(2, "0"))
    .join("")}`;
}

function noteFromHue(hue) {
  return Math.floor((hue / 360) * 12) % 12;
}

function midiFromDegree(rootMidi, scale, degree, octave = 0) {
  const normalizedDegree = ((degree % scale.intervals.length) + scale.intervals.length) % scale.intervals.length;
  return rootMidi + scale.intervals[normalizedDegree] + octave * 12;
}

function midiToFrequency(midi) {
  return 440 * 2 ** ((midi - 69) / 12);
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function randomFrom(seed) {
  const sine = Math.sin(seed * 12.9898 + state.sceneVariationSeed * 78.233) * 43758.5453;
  return sine - Math.floor(sine);
}

function unique(items) {
  return [...new Set(items)];
}

function capitalize(value) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

init();
