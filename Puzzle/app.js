const SHAPE_MODES = [
  { id: "square", label: "Squares" },
  { id: "triangle", label: "Triangles" },
];

const MUSIC_THEMES = {
  arcade: {
    stepMs: 170,
    masterVolume: 0.16,
    leadWave: "square",
    bassWave: "triangle",
    leadVolume: 0.06,
    bassVolume: 0.052,
    chordVolume: 0.026,
    leadPattern: [
      659.25, 783.99, 987.77, 783.99,
      1046.5, 987.77, 783.99, 659.25,
      587.33, 659.25, 783.99, 880.0,
      987.77, 783.99, 659.25, 523.25,
    ],
    leadAccent: [1, 0.7, 0.82, 0.7, 1, 0.72, 0.84, 0.72],
    bassPattern: [
      164.81, 164.81, 164.81, 164.81,
      196.0, 196.0, 196.0, 196.0,
      146.83, 146.83, 146.83, 146.83,
      196.0, 196.0, 185.0, 174.61,
    ],
    chordRoots: [261.63, 293.66, 246.94, 220.0],
    kickPattern: [1, 0, 0.32, 0, 0.88, 0, 0.42, 0],
    snarePattern: [0, 0, 0.54, 0, 0, 0, 0.64, 0],
    hatPattern: [0.15, 0.09, 0.18, 0.08, 0.15, 0.09, 0.22, 0.08],
  },
  ambient: {
    stepMs: 240,
    masterVolume: 0.15,
    leadWave: "triangle",
    bassWave: "sine",
    leadVolume: 0.052,
    bassVolume: 0.044,
    chordVolume: 0.03,
    leadPattern: [
      329.63, 392.0, 440.0, 392.0,
      493.88, 440.0, 392.0, 329.63,
      293.66, 329.63, 392.0, 440.0,
      392.0, 329.63, 293.66, 261.63,
    ],
    leadAccent: [0.92, 0.64, 0.75, 0.64, 0.98, 0.68, 0.82, 0.68],
    bassPattern: [
      130.81, 130.81, 146.83, 146.83,
      164.81, 164.81, 146.83, 146.83,
      123.47, 123.47, 146.83, 146.83,
      130.81, 130.81, 110.0, 110.0,
    ],
    chordRoots: [220.0, 246.94, 196.0, 174.61],
    kickPattern: [0.82, 0, 0.2, 0, 0.64, 0, 0.24, 0],
    snarePattern: [0, 0, 0.32, 0, 0, 0, 0.45, 0],
    hatPattern: [0.1, 0.05, 0.14, 0.05, 0.1, 0.05, 0.16, 0.05],
  },
  focus: {
    stepMs: 200,
    masterVolume: 0.155,
    leadWave: "sawtooth",
    bassWave: "triangle",
    leadVolume: 0.055,
    bassVolume: 0.05,
    chordVolume: 0.024,
    leadPattern: [
      369.99, 415.3, 493.88, 415.3,
      554.37, 493.88, 415.3, 369.99,
      329.63, 369.99, 415.3, 493.88,
      440.0, 415.3, 369.99, 329.63,
    ],
    leadAccent: [1, 0.66, 0.84, 0.66, 1, 0.7, 0.88, 0.7],
    bassPattern: [
      123.47, 123.47, 123.47, 123.47,
      164.81, 164.81, 164.81, 164.81,
      138.59, 138.59, 138.59, 138.59,
      146.83, 146.83, 146.83, 146.83,
    ],
    chordRoots: [196.0, 220.0, 207.65, 185.0],
    kickPattern: [1, 0, 0.28, 0.08, 0.85, 0, 0.36, 0.08],
    snarePattern: [0, 0, 0.48, 0, 0, 0, 0.58, 0],
    hatPattern: [0.12, 0.08, 0.16, 0.08, 0.12, 0.08, 0.2, 0.08],
  },
};

const RECORDS_FALLBACK_KEY = "pixel-puzzle-records";
const PLAYER_NAME_KEY = "pixel-puzzle-player";

const dom = {
  appTitle: document.getElementById("appTitle"),
  statusText: document.getElementById("statusText"),
  uploadButton: document.getElementById("uploadButton"),
  uploadInput: document.getElementById("uploadInput"),
  cameraButton: document.getElementById("cameraButton"),
  cameraInput: document.getElementById("cameraInput"),
  cutButton: document.getElementById("cutButton"),
  playerName: document.getElementById("playerName"),
  difficultyButtons: Array.from(document.querySelectorAll(".difficulty-button")),
  ghostButton: document.getElementById("ghostButton"),
  magnetButton: document.getElementById("magnetButton"),
  shapeButton: document.getElementById("shapeButton"),
  fireworksButton: document.getElementById("fireworksButton"),
  musicSelect: document.getElementById("musicSelect"),
  musicButton: document.getElementById("musicButton"),
  refreshRecordsButton: document.getElementById("refreshRecordsButton"),
  exportRecordsButton: document.getElementById("exportRecordsButton"),
  bestTime: document.getElementById("bestTime"),
  bestPlayer: document.getElementById("bestPlayer"),
  timerDisplay: document.getElementById("timerDisplay"),
  modeLabel: document.getElementById("modeLabel"),
  recordsBody: document.getElementById("recordsBody"),
  boardPanel: document.querySelector(".board-panel"),
  boardHeading: document.querySelector(".board-panel .panel-heading"),
  boardMeta: document.getElementById("boardMeta"),
  boardSurface: document.getElementById("boardSurface"),
  previewPanel: document.querySelector(".preview-panel"),
  previewHeading: document.querySelector(".preview-panel .panel-heading"),
  previewFrame: document.querySelector(".preview-frame"),
  ghostLayer: document.getElementById("ghostLayer"),
  boardGrid: document.getElementById("boardGrid"),
  imageLabel: document.getElementById("imageLabel"),
  sourcePreview: document.getElementById("sourcePreview"),
  storageMeta: document.getElementById("storageMeta"),
  storagePieces: document.getElementById("storagePieces"),
  fireworksCanvas: document.getElementById("fireworksCanvas"),
};

const state = {
  difficulty: 4,
  shapeMode: SHAPE_MODES[0].id,
  ghostVisible: false,
  magnetEnabled: true,
  fireworksEnabled: true,
  source: {
    label: "Default artwork",
    src: "",
    image: null,
    squareCanvas: null,
  },
  pieces: [],
  boardSlots: Array(16).fill(null),
  drag: null,
  hoverSlot: null,
  hoverMagnet: false,
  solved: false,
  timer: {
    running: false,
    startStamp: 0,
    elapsedMs: 0,
    intervalId: null,
  },
  records: [],
  music: {
    context: null,
    masterGain: null,
    noiseBuffer: null,
    active: false,
    schedulerId: null,
    stepIndex: 0,
  },
};

let boardResizeFrame = 0;

document.addEventListener("DOMContentLoaded", () => {
  boot().catch((error) => {
    console.error(error);
    setStatus("The app failed to start. Open the console for details.");
  });
});

async function boot() {
  bindEvents();
  hydratePlayerName();
  updateTitle(false);
  updateFeatureButtons();
  renderDifficultyButtons();
  renderBoard();
  renderStorage();
  updateModeLabel();
  handleWindowResize();
  window.addEventListener("resize", handleWindowResize);
  await loadDefaultArtwork();
  await refreshRecords(false);
}

function handleWindowResize() {
  resizeFireworksCanvas();
  queueBoardSurfaceResize();
}

function bindEvents() {
  dom.uploadButton.addEventListener("click", () => dom.uploadInput.click());
  dom.cameraButton.addEventListener("click", () => dom.cameraInput.click());
  dom.cutButton.addEventListener("click", () => cutIntoPuzzle());

  dom.uploadInput.addEventListener("change", (event) => handleImageInput(event));
  dom.cameraInput.addEventListener("change", (event) => handleImageInput(event));

  dom.playerName.addEventListener("input", () => {
    localStorage.setItem(PLAYER_NAME_KEY, getPlayerName());
  });

  dom.difficultyButtons.forEach((button) => {
    button.addEventListener("click", () => {
      const nextDifficulty = Number(button.dataset.size);
      setDifficulty(nextDifficulty);
    });
  });

  dom.ghostButton.addEventListener("click", () => {
    state.ghostVisible = !state.ghostVisible;
    updateFeatureButtons();
  });

  dom.magnetButton.addEventListener("click", () => {
    state.magnetEnabled = !state.magnetEnabled;
    updateFeatureButtons();
    clearBoardHover();
  });

  dom.shapeButton.addEventListener("click", () => {
    cycleShapeMode();
  });

  dom.fireworksButton.addEventListener("click", () => {
    state.fireworksEnabled = !state.fireworksEnabled;
    updateFeatureButtons();
  });

  dom.musicButton.addEventListener("click", async () => {
    if (state.music.active) {
      stopMusic();
    } else {
      await startMusic();
    }
    updateFeatureButtons();
  });

  dom.musicSelect.addEventListener("change", async () => {
    if (dom.musicSelect.value === "off") {
      stopMusic();
    } else if (state.music.active) {
      await startMusic(true);
    }
    updateFeatureButtons();
  });

  dom.refreshRecordsButton.addEventListener("click", () => {
    refreshRecords(true);
  });

  dom.exportRecordsButton.addEventListener("click", () => {
    exportRecords();
  });

  window.addEventListener("pointermove", handleGlobalPointerMove, { passive: false });
  window.addEventListener("pointerup", handleGlobalPointerUp, { passive: false });
  window.addEventListener("pointercancel", handleGlobalPointerUp, { passive: false });
}

async function handleImageInput(event) {
  const [file] = event.target.files || [];
  if (!file) {
    return;
  }

  try {
    const dataUrl = await readFileAsDataUrl(file);
    await setSourceImage(dataUrl, file.name);
    setStatus(`${file.name} loaded. Press "Cut into puzzles" to shuffle it.`);
  } catch (error) {
    console.error(error);
    setStatus("The selected file could not be loaded.");
  } finally {
    event.target.value = "";
  }
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

async function loadDefaultArtwork() {
  const dataUrl = generateDefaultPixelArt();
  await setSourceImage(dataUrl, "Default artwork");
}

async function setSourceImage(src, label) {
  const image = await loadImage(src);
  state.source = {
    label,
    src,
    image,
    squareCanvas: null,
  };

  dom.sourcePreview.src = src;
  dom.imageLabel.textContent = label;
  dom.ghostLayer.style.backgroundImage = `url("${src}")`;
  queueBoardSurfaceResize();
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = src;
  });
}

function setDifficulty(nextDifficulty) {
  if (!Number.isFinite(nextDifficulty) || nextDifficulty < 2) {
    return;
  }

  state.difficulty = nextDifficulty;
  state.boardSlots = Array(getBoardSlotCount(nextDifficulty, state.shapeMode)).fill(null);
  renderDifficultyButtons();
  updateModeLabel();

  if (state.pieces.length > 0) {
    cutIntoPuzzle();
  } else {
    renderBoard();
    setStatus(`Difficulty switched to ${nextDifficulty}x${nextDifficulty}.`);
  }
}

function cycleShapeMode() {
  const previousShapeMode = state.shapeMode;
  const currentIndex = SHAPE_MODES.findIndex((mode) => mode.id === state.shapeMode);
  const nextIndex = (currentIndex + 1) % SHAPE_MODES.length;
  state.shapeMode = SHAPE_MODES[nextIndex].id;
  state.boardSlots = Array(getBoardSlotCount(state.difficulty, state.shapeMode)).fill(null);
  updateFeatureButtons();
  updateModeLabel();

  if (state.source.image && state.pieces.length > 0) {
    if (previousShapeMode === "triangle" || state.shapeMode === "triangle") {
      cutIntoPuzzle();
      setStatus(`Shape mode switched to ${SHAPE_MODES[nextIndex].label}. Puzzle reshuffled for the new grid.`);
    } else {
      regeneratePieceArt();
      renderBoard();
      renderStorage();
      setStatus(`Shape mode switched to ${SHAPE_MODES[nextIndex].label}.`);
    }
  } else {
    renderBoard();
  }
}

function cutIntoPuzzle() {
  if (!state.source.image) {
    setStatus("Load or capture an image first.");
    return;
  }

  resetTimer();
  stopMusicIfThemeOff();
  state.solved = false;
  state.boardSlots = Array(getBoardSlotCount(state.difficulty, state.shapeMode)).fill(null);
  state.source.squareCanvas = createSquareCanvas(state.source.image, 1200);
  state.pieces = buildPieces(state.source.squareCanvas, state.difficulty, state.shapeMode);
  shuffleArray(state.pieces);
  state.pieces.forEach((piece, index) => {
    piece.storageOrder = index;
  });

  clearBoardHover();
  updateTitle(false);
  updateModeLabel();
  renderBoard();
  renderStorage();
  setStatus(
    `${state.pieces.length} pieces shuffled into storage. Drag them into the assembly field.`,
  );
}

function buildPieces(sourceCanvas, difficulty, shapeMode) {
  const cellCount = difficulty * difficulty;
  const slotCount = getBoardSlotCount(difficulty, shapeMode);
  const sizeFactor = shapeMode === "triangle" ? 0.84 : 1;
  const assetSize = Math.max(96, Math.floor((900 / difficulty) * sizeFactor));
  const pieces = [];

  if (shapeMode === "triangle") {
    for (let cellIndex = 0; cellIndex < cellCount; cellIndex += 1) {
      const row = Math.floor(cellIndex / difficulty);
      const col = cellIndex % difficulty;

      for (let trianglePart = 0; trianglePart < 2; trianglePart += 1) {
        const slotIndex = cellIndex * 2 + trianglePart;
        pieces.push({
          id: `piece-${slotIndex}`,
          correctSlot: slotIndex,
          currentSlot: null,
          locked: false,
          storageOrder: slotIndex,
          storageTrianglePart: Math.random() < 0.5 ? 0 : 1,
          tilt: seededNumber(slotIndex + difficulty * 17) * 12 - 6,
          cellRow: row,
          cellCol: col,
          trianglePart,
          shapeMode,
          imageUrl: createPieceAsset({
            sourceCanvas,
            difficulty,
            row,
            col,
            trianglePart,
            shapeMode,
            size: assetSize,
          }),
        });
      }
    }

    return pieces;
  }

  for (let slotIndex = 0; slotIndex < slotCount; slotIndex += 1) {
    const row = Math.floor(slotIndex / difficulty);
    const col = slotIndex % difficulty;

    pieces.push({
      id: `piece-${slotIndex}`,
      correctSlot: slotIndex,
      currentSlot: null,
      locked: false,
      storageOrder: slotIndex,
      storageTrianglePart: null,
      tilt: seededNumber(slotIndex + difficulty * 17) * 12 - 6,
      cellRow: row,
      cellCol: col,
      trianglePart: null,
      shapeMode,
      imageUrl: createPieceAsset({
        sourceCanvas,
        difficulty,
        row,
        col,
        trianglePart: null,
        shapeMode,
        size: assetSize,
      }),
    });
  }

  return pieces;
}

function regeneratePieceArt() {
  const sourceCanvas =
    state.source.squareCanvas || createSquareCanvas(state.source.image, 1200);

  state.source.squareCanvas = sourceCanvas;

  state.pieces.forEach((piece) => {
    const sizeFactor = state.shapeMode === "triangle" ? 0.84 : 1;
    const size = Math.max(96, Math.floor((900 / state.difficulty) * sizeFactor));

    piece.imageUrl = createPieceAsset({
      sourceCanvas,
      difficulty: state.difficulty,
      row: piece.cellRow,
      col: piece.cellCol,
      trianglePart: piece.trianglePart,
      shapeMode: state.shapeMode,
      size,
    });
    piece.shapeMode = state.shapeMode;
  });
}

function createSquareCanvas(image, size) {
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");
  const imageWidth = image.naturalWidth || image.width;
  const imageHeight = image.naturalHeight || image.height;
  const side = Math.min(imageWidth, imageHeight);
  const sourceX = (imageWidth - side) / 2;
  const sourceY = (imageHeight - side) / 2;

  canvas.width = size;
  canvas.height = size;
  context.imageSmoothingQuality = "high";
  context.drawImage(image, sourceX, sourceY, side, side, 0, 0, size, size);
  return canvas;
}

function createPieceAsset({ sourceCanvas, difficulty, row, col, trianglePart, shapeMode, size }) {
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");
  const sliceWidth = sourceCanvas.width / difficulty;
  const sliceHeight = sourceCanvas.height / difficulty;
  const sourceX = col * sliceWidth;
  const sourceY = row * sliceHeight;

  canvas.width = size;
  canvas.height = size;

  context.save();
  applyPieceClipPath(context, shapeMode, size, size, row, col, trianglePart);
  context.clip();
  context.drawImage(
    sourceCanvas,
    sourceX,
    sourceY,
    sliceWidth,
    sliceHeight,
    0,
    0,
    size,
    size,
  );
  context.restore();

  context.save();
  context.lineWidth = Math.max(2, size * 0.02);
  context.strokeStyle = "rgba(255, 255, 255, 0.22)";
  applyPieceClipPath(context, shapeMode, size, size, row, col, trianglePart);
  context.stroke();
  context.restore();

  return canvas.toDataURL("image/png");
}

function applyPieceClipPath(context, shapeMode, width, height, row, col, trianglePart = null) {
  context.beginPath();

  if (shapeMode === "triangle") {
    if (trianglePart === 0) {
      context.moveTo(0, 0);
      context.lineTo(width, 0);
      context.lineTo(0, height);
    } else {
      context.moveTo(width, height);
      context.lineTo(width, 0);
      context.lineTo(0, height);
    }

    context.closePath();
    return;
  }

  if (typeof context.roundRect === "function") {
    context.roundRect(0, 0, width, height, width * 0.12);
  } else {
    context.rect(0, 0, width, height);
  }
}

function seededNumber(seed) {
  const value = Math.sin(seed * 12.9898) * 43758.5453;
  return value - Math.floor(value);
}

function getBoardSlotCount(difficulty = state.difficulty, shapeMode = state.shapeMode) {
  const baseCount = difficulty * difficulty;
  return shapeMode === "triangle" ? baseCount * 2 : baseCount;
}

function getSlotDescriptor(slotIndex, difficulty = state.difficulty, shapeMode = state.shapeMode) {
  if (shapeMode === "triangle") {
    const cellIndex = Math.floor(slotIndex / 2);
    return {
      row: Math.floor(cellIndex / difficulty),
      col: cellIndex % difficulty,
      trianglePart: slotIndex % 2,
    };
  }

  return {
    row: Math.floor(slotIndex / difficulty),
    col: slotIndex % difficulty,
    trianglePart: null,
  };
}

function renderBoard() {
  dom.boardSurface.classList.toggle("show-ghost", state.ghostVisible);
  dom.boardGrid.style.setProperty("--grid-size", String(state.difficulty));
  dom.boardGrid.classList.toggle("triangle-grid", state.shapeMode === "triangle");
  dom.boardGrid.innerHTML = "";

  if (state.shapeMode === "triangle") {
    const cellCount = state.difficulty * state.difficulty;

    for (let cellIndex = 0; cellIndex < cellCount; cellIndex += 1) {
      const cell = document.createElement("div");
      cell.className = "triangle-cell";

      for (let trianglePart = 0; trianglePart < 2; trianglePart += 1) {
        const slotIndex = cellIndex * 2 + trianglePart;
        cell.appendChild(createBoardSlotElement(slotIndex));
      }

      dom.boardGrid.appendChild(cell);
    }
  } else {
    const totalSlots = state.difficulty * state.difficulty;

    for (let index = 0; index < totalSlots; index += 1) {
      dom.boardGrid.appendChild(createBoardSlotElement(index));
    }
  }

  const placedCount = state.pieces.filter((piece) => piece.currentSlot !== null).length;
  dom.boardMeta.textContent =
    state.pieces.length > 0
      ? `${placedCount}/${state.pieces.length} pieces on the field`
      : state.shapeMode === "triangle"
        ? `Empty ${state.difficulty}x${state.difficulty} triangular board`
        : `Empty ${state.difficulty}x${state.difficulty} board`;

  queueBoardSurfaceResize();
}

function createBoardSlotElement(slotIndex) {
  const descriptor = getSlotDescriptor(slotIndex);
  const slot = document.createElement("div");
  slot.className = "board-slot";
  slot.dataset.slot = String(slotIndex);

  if (descriptor.trianglePart !== null) {
    slot.classList.add("shape-triangle", `triangle-part-${descriptor.trianglePart}`);
  }

  if (state.hoverSlot === slotIndex) {
    slot.classList.add(state.hoverMagnet ? "magnet-target" : "hover");
  }

  const pieceId = state.boardSlots[slotIndex];
  if (pieceId) {
    slot.classList.add("filled");
    const piece = getPiece(pieceId);
    if (piece) {
      slot.appendChild(createPieceElement(piece, "board"));
    }
  }

  return slot;
}

function queueBoardSurfaceResize() {
  if (boardResizeFrame) {
    cancelAnimationFrame(boardResizeFrame);
  }

  boardResizeFrame = requestAnimationFrame(() => {
    boardResizeFrame = 0;
    resizeBoardSurface();
    resizePreviewFrame();
  });
}

function resizeBoardSurface() {
  if (!dom.boardPanel || !dom.boardSurface) {
    return;
  }

  if (window.innerWidth <= 1180) {
    dom.boardSurface.style.removeProperty("width");
    dom.boardSurface.style.removeProperty("height");
    return;
  }

  const panelStyles = getComputedStyle(dom.boardPanel);
  const headingStyles = dom.boardHeading ? getComputedStyle(dom.boardHeading) : null;
  const paddingX =
    parseFloat(panelStyles.paddingLeft || "0") + parseFloat(panelStyles.paddingRight || "0");
  const paddingY =
    parseFloat(panelStyles.paddingTop || "0") + parseFloat(panelStyles.paddingBottom || "0");
  const headingHeight = dom.boardHeading?.getBoundingClientRect().height || 0;
  const headingMarginBottom = headingStyles
    ? parseFloat(headingStyles.marginBottom || "0")
    : 0;
  const availableWidth = dom.boardPanel.clientWidth - paddingX;
  const availableHeight = dom.boardPanel.clientHeight - paddingY - headingHeight - headingMarginBottom;
  const nextSize = Math.floor(Math.min(availableWidth, availableHeight));

  if (!Number.isFinite(nextSize) || nextSize <= 0) {
    return;
  }

  dom.boardSurface.style.width = `${nextSize}px`;
  dom.boardSurface.style.height = `${nextSize}px`;
}

function resizePreviewFrame() {
  if (!dom.previewPanel || !dom.previewFrame) {
    return;
  }

  if (window.innerWidth <= 1180) {
    dom.previewFrame.style.removeProperty("width");
    dom.previewFrame.style.removeProperty("height");
    return;
  }

  const panelStyles = getComputedStyle(dom.previewPanel);
  const headingStyles = dom.previewHeading ? getComputedStyle(dom.previewHeading) : null;
  const paddingX =
    parseFloat(panelStyles.paddingLeft || "0") + parseFloat(panelStyles.paddingRight || "0");
  const paddingY =
    parseFloat(panelStyles.paddingTop || "0") + parseFloat(panelStyles.paddingBottom || "0");
  const headingHeight = dom.previewHeading?.getBoundingClientRect().height || 0;
  const headingMarginBottom = headingStyles
    ? parseFloat(headingStyles.marginBottom || "0")
    : 0;
  const availableWidth = dom.previewPanel.clientWidth - paddingX;
  const availableHeight =
    dom.previewPanel.clientHeight - paddingY - headingHeight - headingMarginBottom;
  const nextSize = Math.floor(Math.min(availableWidth, availableHeight));

  if (!Number.isFinite(nextSize) || nextSize <= 0) {
    return;
  }

  dom.previewFrame.style.width = `${nextSize}px`;
  dom.previewFrame.style.height = `${nextSize}px`;
}

function renderStorage() {
  dom.storagePieces.innerHTML = "";

  const storagePieces = state.pieces
    .filter((piece) => piece.currentSlot === null)
    .sort((left, right) => left.storageOrder - right.storageOrder);

  if (storagePieces.length === 0) {
    const placeholder = document.createElement("div");
    placeholder.className = "storage-placeholder";
    placeholder.textContent =
      state.pieces.length === 0
        ? "Cut the image to fill this storage area with shuffled pieces."
        : "Storage is empty. Everything is already on the board.";
    dom.storagePieces.appendChild(placeholder);
  } else {
    storagePieces.forEach((piece) => {
      dom.storagePieces.appendChild(createPieceElement(piece, "storage"));
    });
  }

  dom.storageMeta.textContent =
    state.pieces.length === 0
      ? "Pieces will appear here after shuffling."
      : `${storagePieces.length} piece${storagePieces.length === 1 ? "" : "s"} waiting in storage`;
}

function createPieceElement(piece, zone) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = `piece ${zone === "board" ? "board-piece" : "storage-piece"}`;
  button.dataset.pieceId = piece.id;
  button.style.setProperty("--piece-tilt", zone === "storage" ? `${piece.tilt}deg` : "0deg");
  button.style.setProperty("--piece-rotation", `${getPieceRotation(piece, zone)}deg`);

  if (piece.shapeMode === "triangle" && piece.trianglePart !== null) {
    button.classList.add("shape-triangle", `triangle-part-${piece.trianglePart}`);
  }

  if (piece.locked) {
    button.classList.add("locked");
  }

  if (state.drag && state.drag.pieceId === piece.id) {
    button.classList.add("drag-origin");
  }

  const image = document.createElement("img");
  image.src = piece.imageUrl;
  image.alt = "";
  button.appendChild(image);

  if (!piece.locked) {
    button.addEventListener("pointerdown", beginPieceDrag);
  }

  return button;
}

function beginPieceDrag(event) {
  const pieceId = event.currentTarget.dataset.pieceId;
  const piece = getPiece(pieceId);

  if (!piece || piece.locked) {
    return;
  }

  event.preventDefault();
  startTimerIfNeeded();

  const rect = event.currentTarget.getBoundingClientRect();
  const dragZone = event.currentTarget.classList.contains("storage-piece") ? "storage" : "board";
  const ghost = event.currentTarget.cloneNode(true);
  ghost.classList.add("drag-ghost");
  ghost.style.width = `${rect.width}px`;
  ghost.style.height = `${rect.height}px`;
  document.body.appendChild(ghost);

  state.drag = {
    pieceId,
    pointerId: event.pointerId,
    ghost,
    originElement: event.currentTarget,
    offsetX: event.clientX - rect.left,
    offsetY: event.clientY - rect.top,
    visualRotation: getPieceRotation(piece, dragZone) + (dragZone === "storage" ? piece.tilt : 0),
  };

  event.currentTarget.classList.add("drag-origin");
  document.body.classList.add("dragging");
  updateGhostPosition(event.clientX, event.clientY);
  updateHoverFromPoint(event.clientX, event.clientY);
}

function handleGlobalPointerMove(event) {
  if (!state.drag || event.pointerId !== state.drag.pointerId) {
    return;
  }

  event.preventDefault();
  updateGhostPosition(event.clientX, event.clientY);
  updateHoverFromPoint(event.clientX, event.clientY);
}

function handleGlobalPointerUp(event) {
  if (!state.drag || event.pointerId !== state.drag.pointerId) {
    return;
  }

  event.preventDefault();
  finalizeDrop(event.clientX, event.clientY);
}

function updateGhostPosition(clientX, clientY) {
  const { ghost, offsetX, offsetY, visualRotation } = state.drag;
  ghost.style.transform =
    `translate3d(${clientX - offsetX}px, ${clientY - offsetY}px, 0) ` +
    `rotate(${visualRotation + 2}deg) scale(1.02)`;
}

function updateHoverFromPoint(clientX, clientY) {
  const piece = getPiece(state.drag?.pieceId);
  if (!piece) {
    clearBoardHover();
    return;
  }

  const boardRect = dom.boardSurface.getBoundingClientRect();
  if (!pointInsideRect(clientX, clientY, boardRect)) {
    clearBoardHover();
    return;
  }

  const hoveredSlot = slotFromPoint(clientX, clientY, boardRect);
  const magnetSlot = getMagnetTarget(piece, clientX, clientY, boardRect);

  state.hoverSlot = magnetSlot ?? hoveredSlot;
  state.hoverMagnet = magnetSlot !== null;
  applyHoverStyles();
}

function finalizeDrop(clientX, clientY) {
  const piece = getPiece(state.drag?.pieceId);
  const boardRect = dom.boardSurface.getBoundingClientRect();
  const storageRect = dom.storagePieces.getBoundingClientRect();
  let changed = false;

  if (piece && pointInsideRect(clientX, clientY, boardRect)) {
    changed = placePieceOnBoard(piece, clientX, clientY, boardRect);
  } else if (piece && pointInsideRect(clientX, clientY, storageRect)) {
    changed = movePieceToStorage(piece);
  }

  endDrag();

  if (changed) {
    renderBoard();
    renderStorage();
    if (isSolved()) {
      handleSolved();
    }
  }
}

function placePieceOnBoard(piece, clientX, clientY, boardRect) {
  const slot = slotFromPoint(clientX, clientY, boardRect);
  if (slot === null) {
    return false;
  }

  const targetSlot = getMagnetTarget(piece, clientX, clientY, boardRect) ?? slot;
  const occupantId = state.boardSlots[targetSlot];

  if (occupantId && occupantId !== piece.id) {
    const occupant = getPiece(occupantId);
    if (!occupant || occupant.locked) {
      return false;
    }

    occupant.currentSlot = null;
    occupant.storageOrder = nextStorageOrder();
    occupant.locked = false;
    if (occupant.shapeMode === "triangle") {
      occupant.storageTrianglePart = Math.random() < 0.5 ? 0 : 1;
    }
    state.boardSlots[targetSlot] = null;
  }

  if (piece.currentSlot !== null) {
    state.boardSlots[piece.currentSlot] = null;
  }

  piece.currentSlot = targetSlot;
  piece.locked = targetSlot === piece.correctSlot;
  state.boardSlots[targetSlot] = piece.id;
  state.solved = false;

  if (piece.locked) {
    playSnapSound();
  }

  return true;
}

function movePieceToStorage(piece) {
  if (piece.currentSlot === null) {
    return false;
  }

  state.boardSlots[piece.currentSlot] = null;
  piece.currentSlot = null;
  piece.locked = false;
  if (piece.shapeMode === "triangle") {
    piece.storageTrianglePart = Math.random() < 0.5 ? 0 : 1;
  }
  piece.storageOrder = nextStorageOrder();
  state.solved = false;
  return true;
}

function nextStorageOrder() {
  return state.pieces.reduce((maxOrder, piece) => Math.max(maxOrder, piece.storageOrder), -1) + 1;
}

function getMagnetTarget(piece, clientX, clientY, boardRect) {
  if (!state.magnetEnabled) {
    return null;
  }

  const center = getSlotCenter(piece.correctSlot, boardRect);
  const metrics = getBoardMetrics(boardRect);
  const threshold =
    state.shapeMode === "triangle"
      ? Math.min(metrics.cellWidth, metrics.cellHeight) * 0.34
      : Math.min(metrics.cellWidth, metrics.cellHeight) * 0.55;
  const distance = Math.hypot(clientX - center.x, clientY - center.y);

  return distance <= threshold ? piece.correctSlot : null;
}

function slotFromPoint(clientX, clientY, boardRect) {
  if (!pointInsideRect(clientX, clientY, boardRect)) {
    return null;
  }

  const metrics = getBoardMetrics(boardRect);
  const relativeX = clientX - boardRect.left - metrics.padding;
  const relativeY = clientY - boardRect.top - metrics.padding;

  if (relativeX < 0 || relativeY < 0) {
    return null;
  }

  const column = Math.floor(relativeX / (metrics.cellWidth + metrics.gap));
  const row = Math.floor(relativeY / (metrics.cellHeight + metrics.gap));

  if (
    column < 0 ||
    column >= state.difficulty ||
    row < 0 ||
    row >= state.difficulty
  ) {
    return null;
  }

  const localX = relativeX - column * (metrics.cellWidth + metrics.gap);
  const localY = relativeY - row * (metrics.cellHeight + metrics.gap);

  if (
    localX < 0 ||
    localY < 0 ||
    localX > metrics.cellWidth ||
    localY > metrics.cellHeight
  ) {
    return null;
  }

  if (state.shapeMode === "triangle") {
    const cellIndex = row * state.difficulty + column;
    const normalizedX = localX / metrics.cellWidth;
    const normalizedY = localY / metrics.cellHeight;
    const trianglePart = normalizedX + normalizedY <= 1 ? 0 : 1;
    return cellIndex * 2 + trianglePart;
  }

  return row * state.difficulty + column;
}

function pointInsideRect(clientX, clientY, rect) {
  return clientX >= rect.left && clientX <= rect.right && clientY >= rect.top && clientY <= rect.bottom;
}

function applyHoverStyles() {
  Array.from(dom.boardGrid.querySelectorAll(".board-slot")).forEach((slotElement) => {
    const slotIndex = Number(slotElement.dataset.slot);
    slotElement.classList.toggle("hover", slotIndex === state.hoverSlot && !state.hoverMagnet);
    slotElement.classList.toggle("magnet-target", slotIndex === state.hoverSlot && state.hoverMagnet);
  });
}

function getBoardMetrics(boardRect) {
  const boardStyles = getComputedStyle(dom.boardGrid);
  const padding = parseFloat(boardStyles.paddingLeft || "0");
  const gap = parseFloat(boardStyles.columnGap || boardStyles.gap || "0");
  const usableWidth = boardRect.width - padding * 2;
  const usableHeight = boardRect.height - padding * 2;
  const cellWidth = (usableWidth - gap * (state.difficulty - 1)) / state.difficulty;
  const cellHeight = (usableHeight - gap * (state.difficulty - 1)) / state.difficulty;

  return {
    padding,
    gap,
    cellWidth,
    cellHeight,
  };
}

function getSlotCenter(slotIndex, boardRect) {
  const descriptor = getSlotDescriptor(slotIndex);
  const metrics = getBoardMetrics(boardRect);
  const cellLeft =
    boardRect.left + metrics.padding + descriptor.col * (metrics.cellWidth + metrics.gap);
  const cellTop =
    boardRect.top + metrics.padding + descriptor.row * (metrics.cellHeight + metrics.gap);

  if (descriptor.trianglePart === 0) {
    return {
      x: cellLeft + metrics.cellWidth / 3,
      y: cellTop + metrics.cellHeight / 3,
    };
  }

  if (descriptor.trianglePart === 1) {
    return {
      x: cellLeft + (metrics.cellWidth * 2) / 3,
      y: cellTop + (metrics.cellHeight * 2) / 3,
    };
  }

  return {
    x: cellLeft + metrics.cellWidth / 2,
    y: cellTop + metrics.cellHeight / 2,
  };
}

function clearBoardHover() {
  state.hoverSlot = null;
  state.hoverMagnet = false;
  applyHoverStyles();
}

function endDrag() {
  if (!state.drag) {
    return;
  }

  state.drag.originElement.classList.remove("drag-origin");
  state.drag.ghost.remove();
  state.drag = null;
  document.body.classList.remove("dragging");
  clearBoardHover();
}

function getPiece(pieceId) {
  return state.pieces.find((piece) => piece.id === pieceId) || null;
}

function getPieceRotation(piece, zone) {
  if (piece.shapeMode !== "triangle" || piece.trianglePart === null) {
    return 0;
  }

  if (zone === "board" && piece.currentSlot !== null) {
    const slotDescriptor = getSlotDescriptor(piece.currentSlot);
    return slotDescriptor.trianglePart === piece.trianglePart ? 0 : 180;
  }

  if (zone === "storage") {
    return piece.storageTrianglePart === piece.trianglePart ? 0 : 180;
  }

  return 0;
}

function isSolved() {
  return (
    state.pieces.length > 0 &&
    state.pieces.every((piece) => piece.currentSlot === piece.correctSlot)
  );
}

async function handleSolved() {
  if (state.solved) {
    return;
  }

  state.solved = true;
  stopTimer();
  updateTitle(true);
  setStatus(`Solved in ${formatTime(state.timer.elapsedMs)}. Record saved to the leaderboard.`);
  playWinChord();

  if (state.fireworksEnabled) {
    launchFireworks();
  }

  const record = {
    name: getPlayerName(),
    timeMs: Math.round(state.timer.elapsedMs),
    difficulty: state.difficulty,
    shape: currentShapeLabel(),
    imageLabel: state.source.label,
    completedAt: new Date().toISOString(),
  };

  state.records = await persistRecord(record);
  renderRecords();
}

function startTimerIfNeeded() {
  if (state.timer.running || state.pieces.length === 0 || state.solved) {
    return;
  }

  state.timer.running = true;
  state.timer.startStamp = performance.now() - state.timer.elapsedMs;
  state.timer.intervalId = window.setInterval(() => {
    state.timer.elapsedMs = performance.now() - state.timer.startStamp;
    dom.timerDisplay.textContent = formatTime(state.timer.elapsedMs);
  }, 100);
}

function stopTimer() {
  if (state.timer.running) {
    state.timer.elapsedMs = performance.now() - state.timer.startStamp;
  }

  state.timer.running = false;

  if (state.timer.intervalId) {
    window.clearInterval(state.timer.intervalId);
    state.timer.intervalId = null;
  }

  dom.timerDisplay.textContent = formatTime(state.timer.elapsedMs);
}

function resetTimer() {
  state.timer.running = false;
  state.timer.elapsedMs = 0;

  if (state.timer.intervalId) {
    window.clearInterval(state.timer.intervalId);
    state.timer.intervalId = null;
  }

  dom.timerDisplay.textContent = formatTime(0);
}

function formatTime(ms) {
  const totalTenths = Math.round(ms / 100);
  const minutes = Math.floor(totalTenths / 600);
  const seconds = Math.floor((totalTenths % 600) / 10);
  const tenths = totalTenths % 10;

  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}.${tenths}`;
}

function updateTitle(isSuccess) {
  const title = isSuccess ? "Success" : "Pixel Puzzle";
  document.title = title;

  if (dom.appTitle) {
    dom.appTitle.textContent = title;
    dom.appTitle.classList.toggle("success", isSuccess);
  }
}

function updateModeLabel() {
  dom.modeLabel.textContent = `${state.difficulty}x${state.difficulty} / ${currentShapeLabel()}`;
}

function currentShapeLabel() {
  return SHAPE_MODES.find((mode) => mode.id === state.shapeMode)?.label || "Squares";
}

function renderDifficultyButtons() {
  dom.difficultyButtons.forEach((button) => {
    button.classList.toggle("active", Number(button.dataset.size) === state.difficulty);
  });
}

function updateFeatureButtons() {
  dom.boardSurface.classList.toggle("show-ghost", state.ghostVisible);
  dom.ghostButton.textContent = `Preview: ${state.ghostVisible ? "On" : "Off"}`;
  dom.ghostButton.classList.toggle("active", state.ghostVisible);
  dom.magnetButton.textContent = `Magnet: ${state.magnetEnabled ? "On" : "Off"}`;
  dom.magnetButton.classList.toggle("active", state.magnetEnabled);
  dom.shapeButton.textContent = `Shape: ${currentShapeLabel()}`;
  dom.fireworksButton.textContent = `Fireworks: ${state.fireworksEnabled ? "On" : "Off"}`;
  dom.fireworksButton.classList.toggle("active", state.fireworksEnabled);
  dom.musicButton.textContent = `Music: ${state.music.active ? "Pause" : "Play"}`;
}

function setStatus(message) {
  if (dom.statusText) {
    dom.statusText.textContent = message;
  }
}

function hydratePlayerName() {
  const savedName = localStorage.getItem(PLAYER_NAME_KEY);
  dom.playerName.value = savedName || "Player 1";
}

function getPlayerName() {
  return dom.playerName.value.trim() || "Player 1";
}

async function refreshRecords(showStatus) {
  state.records = await fetchRecords();
  renderRecords();
  if (showStatus) {
    setStatus("Leaderboard refreshed.");
  }
}

async function fetchRecords() {
  try {
    const response = await fetch("/api/records", {
      headers: {
        Accept: "application/json",
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const payload = await response.json();
    const records = Array.isArray(payload.records) ? payload.records : [];
    localStorage.setItem(RECORDS_FALLBACK_KEY, JSON.stringify(records));
    return records;
  } catch (error) {
    const fallback = localStorage.getItem(RECORDS_FALLBACK_KEY);
    return fallback ? JSON.parse(fallback) : [];
  }
}

async function persistRecord(record) {
  const fallbackRecords = loadFallbackRecords();
  const mergedFallback = sortRecords([...fallbackRecords, record]);
  localStorage.setItem(RECORDS_FALLBACK_KEY, JSON.stringify(mergedFallback));

  try {
    const response = await fetch("/api/records", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(record),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const payload = await response.json();
    const records = Array.isArray(payload.records) ? payload.records : mergedFallback;
    localStorage.setItem(RECORDS_FALLBACK_KEY, JSON.stringify(records));
    return records;
  } catch (error) {
    return mergedFallback;
  }
}

function loadFallbackRecords() {
  const raw = localStorage.getItem(RECORDS_FALLBACK_KEY);
  if (!raw) {
    return [];
  }

  try {
    const records = JSON.parse(raw);
    return Array.isArray(records) ? records : [];
  } catch (error) {
    return [];
  }
}

function sortRecords(records) {
  return [...records]
    .filter((record) => Number.isFinite(Number(record.timeMs)))
    .sort((left, right) => Number(left.timeMs) - Number(right.timeMs))
    .slice(0, 20);
}

function renderRecords() {
  const records = sortRecords(state.records);
  state.records = records;

  if (records.length === 0) {
    dom.bestTime.textContent = "00:00.0";
    dom.bestPlayer.textContent = "No completed runs yet.";
    dom.recordsBody.innerHTML = `
      <tr>
        <td colspan="4" class="records-empty">Leaderboard is empty.</td>
      </tr>
    `;
    return;
  }

  const best = records[0];
  dom.bestTime.textContent = formatTime(Number(best.timeMs));
  dom.bestPlayer.textContent = `${best.name} on ${best.difficulty}x${best.difficulty} (${best.shape})`;

  dom.recordsBody.innerHTML = records
    .slice(0, 8)
    .map((record, index) => {
      return `
        <tr>
          <td>${index + 1}</td>
          <td>${escapeHtml(record.name || "Player")}</td>
          <td>${formatTime(Number(record.timeMs))}</td>
          <td>${record.difficulty}x${record.difficulty}</td>
        </tr>
      `;
    })
    .join("");
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function exportRecords() {
  const payload = state.records.length > 0 ? state.records : loadFallbackRecords();
  const blob = new Blob([JSON.stringify(sortRecords(payload), null, 2)], {
    type: "application/json",
  });

  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "pixel-puzzle-records.json";
  link.click();
  URL.revokeObjectURL(url);
  setStatus("Leaderboard exported as JSON.");
}

async function ensureAudioContext() {
  if (!state.music.context) {
    const AudioContextCtor = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextCtor) {
      return null;
    }

    state.music.context = new AudioContextCtor();
    state.music.masterGain = state.music.context.createGain();
    state.music.masterGain.gain.value = 0.16;
    state.music.masterGain.connect(state.music.context.destination);
    state.music.noiseBuffer = createNoiseBuffer(state.music.context);
  }

  if (state.music.context.state === "suspended") {
    await state.music.context.resume();
  }

  return state.music.context;
}

async function startMusic(restart = false) {
  if (dom.musicSelect.value === "off") {
    stopMusic();
    updateFeatureButtons();
    return;
  }

  const context = await ensureAudioContext();
  if (!context) {
    return;
  }

  if (state.music.active && !restart) {
    return;
  }

  stopMusic();
  state.music.active = true;
  state.music.stepIndex = 0;
  setMusicVolume(MUSIC_THEMES[dom.musicSelect.value]);
  scheduleMusicStep();

  const theme = MUSIC_THEMES[dom.musicSelect.value];
  state.music.schedulerId = window.setInterval(scheduleMusicStep, theme.stepMs);
}

function scheduleMusicStep() {
  if (!state.music.active) {
    return;
  }

  const theme = MUSIC_THEMES[dom.musicSelect.value];
  if (!theme || !state.music.context || !state.music.masterGain) {
    return;
  }

  const step = state.music.stepIndex;
  const now = state.music.context.currentTime + 0.02;
  const leadNote = theme.leadPattern[step % theme.leadPattern.length];
  const leadAccent = theme.leadAccent[step % theme.leadAccent.length] || 1;
  const bassNote = theme.bassPattern[step % theme.bassPattern.length];
  const chordRoot = theme.chordRoots[Math.floor(step / 4) % theme.chordRoots.length];
  const kickLevel = theme.kickPattern[step % theme.kickPattern.length] || 0;
  const snareLevel = theme.snarePattern[step % theme.snarePattern.length] || 0;
  const hatLevel = theme.hatPattern[step % theme.hatPattern.length] || 0;

  playTone(leadNote, theme.stepMs / 1000 * 0.86, theme.leadWave, theme.leadVolume * leadAccent, now, {
    attack: 0.01,
    release: 0.08,
    filterFrequency: 6200,
    filterType: "lowpass",
  });

  playTone(bassNote, theme.stepMs / 1000 * 1.3, theme.bassWave, theme.bassVolume, now, {
    attack: 0.01,
    release: 0.12,
    filterFrequency: 1400,
    filterType: "lowpass",
  });

  if (step % 2 === 0) {
    playChord(chordRoot, theme.chordVolume, now, theme.stepMs / 1000 * 1.8);
  }

  if (kickLevel > 0) {
    playKick(now, 0.085 * kickLevel);
  }

  if (snareLevel > 0) {
    playSnare(now, 0.07 * snareLevel);
  }

  if (hatLevel > 0) {
    playHat(now, 0.05 * hatLevel);
  }

  state.music.stepIndex = step + 1;
}

function stopMusic() {
  state.music.active = false;
  if (state.music.schedulerId) {
    window.clearInterval(state.music.schedulerId);
    state.music.schedulerId = null;
  }
}

function stopMusicIfThemeOff() {
  if (dom.musicSelect.value === "off") {
    stopMusic();
    updateFeatureButtons();
  }
}

function setMusicVolume(theme) {
  if (!state.music.masterGain) {
    return;
  }

  const now = state.music.context?.currentTime || 0;
  const nextVolume = theme?.masterVolume ?? 0.15;
  state.music.masterGain.gain.cancelScheduledValues(now);
  state.music.masterGain.gain.setValueAtTime(state.music.masterGain.gain.value, now);
  state.music.masterGain.gain.linearRampToValueAtTime(nextVolume, now + 0.12);
}

function playTone(frequency, duration, waveType, volume, startTime, options = {}) {
  if (!state.music.context || !state.music.masterGain) {
    return;
  }

  if (!Number.isFinite(frequency) || frequency <= 0 || volume <= 0) {
    return;
  }

  const attack = options.attack ?? 0.012;
  const release = options.release ?? 0.08;
  const oscillator = state.music.context.createOscillator();
  const gainNode = state.music.context.createGain();
  const filterNode = state.music.context.createBiquadFilter();

  oscillator.type = waveType;
  oscillator.frequency.setValueAtTime(frequency, startTime);
  if (options.slideTo && options.slideTo > 0) {
    oscillator.frequency.exponentialRampToValueAtTime(options.slideTo, startTime + duration);
  }

  filterNode.type = options.filterType || "lowpass";
  filterNode.frequency.setValueAtTime(options.filterFrequency || 12000, startTime);
  filterNode.Q.value = options.filterQ || 0.7;

  gainNode.gain.setValueAtTime(0.0001, startTime);
  gainNode.gain.exponentialRampToValueAtTime(Math.max(0.0001, volume), startTime + attack);
  gainNode.gain.exponentialRampToValueAtTime(0.0001, startTime + Math.max(attack + 0.02, duration - release));
  gainNode.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);

  oscillator.connect(filterNode);
  filterNode.connect(gainNode);
  gainNode.connect(state.music.masterGain);

  oscillator.start(startTime);
  oscillator.stop(startTime + duration + 0.02);
}

function playChord(rootFrequency, volume, startTime, duration) {
  const intervals = [1, 1.25992, 1.49831];
  intervals.forEach((ratio, index) => {
    playTone(rootFrequency * ratio, duration, "sine", volume * (index === 0 ? 1 : 0.78), startTime, {
      attack: 0.02,
      release: 0.18,
      filterFrequency: 2600,
      filterType: "lowpass",
    });
  });
}

function playKick(startTime, volume) {
  playTone(150, 0.24, "sine", volume, startTime, {
    attack: 0.002,
    release: 0.14,
    slideTo: 42,
    filterFrequency: 1800,
    filterType: "lowpass",
  });
}

function playSnare(startTime, volume) {
  playNoiseBurst(startTime, 0.12, volume, {
    filterType: "bandpass",
    filterFrequency: 1800,
    filterQ: 0.9,
  });
  playTone(190, 0.08, "triangle", volume * 0.32, startTime, {
    attack: 0.002,
    release: 0.05,
    slideTo: 140,
    filterFrequency: 1200,
    filterType: "lowpass",
  });
}

function playHat(startTime, volume) {
  playNoiseBurst(startTime, 0.05, volume, {
    filterType: "highpass",
    filterFrequency: 6200,
    filterQ: 0.7,
  });
}

function playNoiseBurst(startTime, duration, volume, options = {}) {
  if (!state.music.context || !state.music.masterGain || !state.music.noiseBuffer || volume <= 0) {
    return;
  }

  const source = state.music.context.createBufferSource();
  const filterNode = state.music.context.createBiquadFilter();
  const gainNode = state.music.context.createGain();

  source.buffer = state.music.noiseBuffer;
  filterNode.type = options.filterType || "highpass";
  filterNode.frequency.setValueAtTime(options.filterFrequency || 5000, startTime);
  filterNode.Q.value = options.filterQ || 0.7;

  gainNode.gain.setValueAtTime(0.0001, startTime);
  gainNode.gain.exponentialRampToValueAtTime(Math.max(0.0001, volume), startTime + 0.004);
  gainNode.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);

  source.connect(filterNode);
  filterNode.connect(gainNode);
  gainNode.connect(state.music.masterGain);

  source.start(startTime);
  source.stop(startTime + duration + 0.02);
}

function createNoiseBuffer(context) {
  const sampleRate = context.sampleRate;
  const length = sampleRate;
  const buffer = context.createBuffer(1, length, sampleRate);
  const channel = buffer.getChannelData(0);

  for (let index = 0; index < length; index += 1) {
    channel[index] = Math.random() * 2 - 1;
  }

  return buffer;
}

async function playSnapSound() {
  const context = await ensureAudioContext();
  if (!context) {
    return;
  }

  const now = context.currentTime + 0.01;
  playTone(780, 0.09, "triangle", 0.08, now);
  playTone(1180, 0.05, "sine", 0.05, now + 0.03);
}

async function playWinChord() {
  const context = await ensureAudioContext();
  if (!context) {
    return;
  }

  const now = context.currentTime + 0.02;
  [523.25, 659.25, 783.99, 1046.5].forEach((note, index) => {
    playTone(note, 0.7, "triangle", 0.05, now + index * 0.03);
  });
}

function launchFireworks() {
  const canvas = dom.fireworksCanvas;
  const context = canvas.getContext("2d");
  const particles = [];
  const burstCount = 6;
  const width = window.innerWidth;
  const height = window.innerHeight;
  const palette = ["#68f0ff", "#ff9d45", "#96ff72", "#ff5fc2", "#fff089"];

  resizeFireworksCanvas();

  for (let burst = 0; burst < burstCount; burst += 1) {
    const centerX = width * (0.12 + burst * 0.15);
    const centerY = height * (0.18 + (burst % 3) * 0.13);
    const delay = burst * 10;
    const particleCount = 54 + burst * 8;

    for (let index = 0; index < particleCount; index += 1) {
      const angle = (Math.PI * 2 * index) / particleCount;
      const speed = 0.9 + Math.random() * 2.25;
      const drift = (Math.random() - 0.5) * 0.45;
      particles.push({
        x: centerX,
        y: centerY,
        velocityX: Math.cos(angle) * speed + drift,
        velocityY: Math.sin(angle) * speed + drift * 0.7,
        life: 88 + Math.random() * 48,
        age: 0,
        delay,
        size: 2.4 + Math.random() * 4.8,
        glow: 10 + Math.random() * 18,
        color: palette[(index + burst) % palette.length],
      });
    }
  }

  function animate() {
    context.clearRect(0, 0, width, height);
    let activeCount = 0;

    particles.forEach((particle) => {
      if (particle.age >= particle.life + particle.delay) {
        return;
      }

      activeCount += 1;
      particle.age += 1;

      if (particle.age <= particle.delay) {
        return;
      }

      particle.x += particle.velocityX;
      particle.y += particle.velocityY;
      particle.velocityX *= 0.995;
      particle.velocityY += 0.028;

      const visibleAge = particle.age - particle.delay;
      const alpha = 1 - visibleAge / particle.life;
      context.shadowBlur = particle.glow;
      context.shadowColor = hexToRgba(particle.color, Math.max(alpha * 0.85, 0));
      context.fillStyle = hexToRgba(particle.color, alpha);
      context.beginPath();
      context.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
      context.fill();
    });

    context.shadowBlur = 0;

    if (activeCount > 0) {
      requestAnimationFrame(animate);
    } else {
      context.clearRect(0, 0, width, height);
    }
  }

  requestAnimationFrame(animate);
}

function resizeFireworksCanvas() {
  const ratio = window.devicePixelRatio || 1;
  dom.fireworksCanvas.width = window.innerWidth * ratio;
  dom.fireworksCanvas.height = window.innerHeight * ratio;
  dom.fireworksCanvas.style.width = `${window.innerWidth}px`;
  dom.fireworksCanvas.style.height = `${window.innerHeight}px`;
  const context = dom.fireworksCanvas.getContext("2d");
  context.setTransform(ratio, 0, 0, ratio, 0, 0);
}

function hexToRgba(hex, alpha) {
  const cleanHex = hex.replace("#", "");
  const red = parseInt(cleanHex.slice(0, 2), 16);
  const green = parseInt(cleanHex.slice(2, 4), 16);
  const blue = parseInt(cleanHex.slice(4, 6), 16);
  return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
}

function generateDefaultPixelArt() {
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");
  const size = 960;
  const block = 48;

  canvas.width = size;
  canvas.height = size;

  const gradient = context.createLinearGradient(0, 0, size, size);
  gradient.addColorStop(0, "#0c1730");
  gradient.addColorStop(0.5, "#12325a");
  gradient.addColorStop(1, "#09111e");
  context.fillStyle = gradient;
  context.fillRect(0, 0, size, size);

  for (let x = 0; x < size; x += block) {
    for (let y = 0; y < size; y += block) {
      context.fillStyle =
        (x / block + y / block) % 2 === 0
          ? "rgba(255,255,255,0.025)"
          : "rgba(255,255,255,0.01)";
      context.fillRect(x, y, block, block);
    }
  }

  for (let index = 0; index < 90; index += 1) {
    const starX = Math.floor(seededNumber(index + 1) * (size / block)) * block;
    const starY = Math.floor(seededNumber(index + 31) * (size / block)) * block;
    context.fillStyle = index % 3 === 0 ? "#68f0ff" : "#f4f7ff";
    context.fillRect(starX + 16, starY + 16, 10, 10);
  }

  fillPixelShape(context, block, 120, 110, [
    "..OOO....",
    ".OOOOO...",
    "OOOOOOO..",
    "OOYYYOO..",
    "OOYYYOO..",
    ".OOOOO...",
    "..OOO....",
  ], {
    O: "#ff9d45",
    Y: "#fff089",
  });

  fillPixelShape(context, block, 220, 350, [
    "...GGG....",
    "..GGGGG...",
    ".GGGGGGG..",
    "GGGHHHGGG.",
    "GGHHHHHGG.",
    "GHHHHHHHG.",
    "GGHHHHHGG.",
    ".GGHHHGG..",
    "..GGGGG...",
  ], {
    G: "#68f0ff",
    H: "#1b2440",
  });

  fillPixelShape(context, block, 470, 420, [
    "..PPPP....",
    ".PFFFFP...",
    "PFFPPFFP..",
    "PFFPPFFP..",
    "PFFFFFFP..",
    ".PFFFFP...",
    "..PPPP....",
    "...PP.....",
    "..P..P....",
  ], {
    P: "#ff5fc2",
    F: "#ffd7ef",
  });

  context.fillStyle = "rgba(150, 255, 114, 0.18)";
  context.fillRect(0, size - 210, size, 210);

  context.fillStyle = "#96ff72";
  context.font = 'bold 128px "Trebuchet MS", sans-serif';
  context.fillText("PIXEL", 120, 830);

  context.fillStyle = "#f4f7ff";
  context.font = 'bold 72px "Trebuchet MS", sans-serif';
  context.fillText("PUZZLE", 395, 900);

  return canvas.toDataURL("image/png");
}

function fillPixelShape(context, block, offsetX, offsetY, rows, palette) {
  rows.forEach((row, rowIndex) => {
    [...row].forEach((char, colIndex) => {
      if (char === ".") {
        return;
      }

      context.fillStyle = palette[char] || "#ffffff";
      context.fillRect(
        offsetX + colIndex * (block / 1.4),
        offsetY + rowIndex * (block / 1.4),
        block / 1.45,
        block / 1.45,
      );
    });
  });
}

function shuffleArray(items) {
  for (let index = items.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [items[index], items[swapIndex]] = [items[swapIndex], items[index]];
  }
}
