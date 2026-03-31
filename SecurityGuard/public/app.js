const PROCESSING_WIDTH = 160;
const PROCESSING_HEIGHT = 120;
const MAX_LOG_ITEMS = 8;

const MOVEMENT_META = {
  idle: {
    badge: "No motion",
    color: "#6be3c1",
    label: "No motion",
    sound: "Standby"
  },
  unknown: {
    badge: "Motion detected",
    color: "#9fb7ff",
    label: "Motion detected",
    sound: "Short pulse"
  },
  left: {
    badge: "Moving left",
    color: "#69dfb4",
    label: "Shift to the left",
    sound: "Low sweep"
  },
  right: {
    badge: "Moving right",
    color: "#7fc8ff",
    label: "Shift to the right",
    sound: "High rise"
  },
  up: {
    badge: "Moving up",
    color: "#ffd166",
    label: "Shift upward",
    sound: "Bright ping"
  },
  down: {
    badge: "Moving down",
    color: "#ff8a80",
    label: "Shift downward",
    sound: "Falling tone"
  },
  forward: {
    badge: "Object approaching",
    color: "#ffb86b",
    label: "Approaching the camera",
    sound: "Approach pulse"
  },
  backward: {
    badge: "Object moving back",
    color: "#ff5d5d",
    label: "Moving back",
    sound: "Alarm siren"
  }
};

const elements = {
  cameraFeed: document.querySelector("#cameraFeed"),
  overlayCanvas: document.querySelector("#overlayCanvas"),
  startButton: document.querySelector("#startButton"),
  stopButton: document.querySelector("#stopButton"),
  testSoundsButton: document.querySelector("#testSoundsButton"),
  systemStatus: document.querySelector("#systemStatus"),
  motionType: document.querySelector("#motionType"),
  motionStrength: document.querySelector("#motionStrength"),
  movementBadge: document.querySelector("#movementBadge"),
  hudMotionPercent: document.querySelector("#hudMotionPercent"),
  currentSoundLabel: document.querySelector("#currentSoundLabel"),
  recognizedObject: document.querySelector("#recognizedObject"),
  sensitivityRange: document.querySelector("#sensitivityRange"),
  sensitivityValue: document.querySelector("#sensitivityValue"),
  cooldownRange: document.querySelector("#cooldownRange"),
  cooldownValue: document.querySelector("#cooldownValue"),
  volumeRange: document.querySelector("#volumeRange"),
  volumeValue: document.querySelector("#volumeValue"),
  autoScreenshotToggle: document.querySelector("#autoScreenshotToggle"),
  nightModeToggle: document.querySelector("#nightModeToggle"),
  recognitionToggle: document.querySelector("#recognitionToggle"),
  fullTimelineToggle: document.querySelector("#fullTimelineToggle"),
  screenshotCount: document.querySelector("#screenshotCount"),
  timelineStatus: document.querySelector("#timelineStatus"),
  eventLog: document.querySelector("#eventLog"),
  timelinePanel: document.querySelector("#timelinePanel"),
  timelineSummary: document.querySelector("#timelineSummary"),
  timelineList: document.querySelector("#timelineList")
};

const overlayContext = elements.overlayCanvas.getContext("2d");
const processingCanvas = document.createElement("canvas");
processingCanvas.width = PROCESSING_WIDTH;
processingCanvas.height = PROCESSING_HEIGHT;
const processingContext = processingCanvas.getContext("2d", {
  willReadFrequently: true
});

const state = {
  running: false,
  stream: null,
  audioContext: null,
  previousGray: null,
  previousMotion: null,
  lastProcessedAt: 0,
  lastTriggerAt: 0,
  quietFrames: 0,
  frameRequestId: null,
  screenshotCount: 0,
  timelineEvents: []
};

function updateSliderLabels() {
  elements.sensitivityValue.textContent = elements.sensitivityRange.value;
  elements.cooldownValue.textContent = `${elements.cooldownRange.value} ms`;
  elements.volumeValue.textContent = `${elements.volumeRange.value}%`;
}

function renderEmptyLog() {
  elements.eventLog.innerHTML =
    '<div class="event-log-empty">Motion events will appear here after startup.</div>';
}

function formatTime(date) {
  return new Intl.DateTimeFormat("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit"
  }).format(date);
}

function formatTimelineTime(date) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit"
  }).format(date);
}

function getRecognitionIdleLabel() {
  if (!elements.recognitionToggle.checked) {
    return "Recognition off";
  }

  return state.running ? "Scanning..." : "Ready to scan";
}

function updateFeatureSummary() {
  document.body.classList.toggle("night-mode-enabled", elements.nightModeToggle.checked);
  elements.screenshotCount.textContent = `${state.screenshotCount} saved`;

  if (!elements.fullTimelineToggle.checked) {
    elements.timelineStatus.textContent = "Off";
    elements.timelineSummary.textContent = "Disabled";
    elements.timelineSummary.className = "movement-badge movement-idle";
    elements.timelinePanel.classList.add("timeline-panel-hidden");
    return;
  }

  elements.timelinePanel.classList.remove("timeline-panel-hidden");
  elements.timelineStatus.textContent =
    state.timelineEvents.length === 0 ? "Enabled" : `${state.timelineEvents.length} tracked`;
  elements.timelineSummary.textContent =
    state.timelineEvents.length === 0 ? "Enabled" : `${state.timelineEvents.length} events`;
  elements.timelineSummary.className =
    state.timelineEvents.length === 0
      ? "movement-badge movement-idle"
      : "movement-badge movement-active";
}

function renderTimeline() {
  updateFeatureSummary();

  if (!elements.fullTimelineToggle.checked) {
    return;
  }

  if (state.timelineEvents.length === 0) {
    elements.timelineList.innerHTML =
      '<div class="timeline-empty">Timeline is enabled. Every new detection in this session will be recorded here.</div>';
    return;
  }

  elements.timelineList.innerHTML = state.timelineEvents
    .map((entry) => {
      const meta = MOVEMENT_META[entry.type] || MOVEMENT_META.unknown;
      const extraBits = [
        `Intensity ${Math.round(entry.strength * 100)}%`,
        `Sound ${meta.sound}`
      ];

      if (entry.objectLabel) {
        extraBits.push(entry.objectLabel);
      }

      if (entry.screenshotSaved) {
        extraBits.push("Screenshot saved");
      }

      return `
        <article class="timeline-item">
          <div class="timeline-item-top">
            <strong style="color: ${meta.color};">${meta.label}</strong>
            <time>${formatTimelineTime(entry.timestamp)}</time>
          </div>
          <div class="timeline-item-meta">${extraBits.join(" | ")}</div>
        </article>
      `;
    })
    .join("");
}

function createDetectionEntry(result, screenshotSaved) {
  return {
    timestamp: new Date(),
    type: result.type,
    strength: result.strength,
    objectLabel: result.objectLabel || "",
    screenshotSaved
  };
}

function estimateObjectGuess(bounds, motionRatio) {
  const areaRatio =
    (bounds.width * bounds.height) / (PROCESSING_WIDTH * PROCESSING_HEIGHT);
  const aspectRatio = bounds.width / Math.max(bounds.height, 1);

  if (areaRatio > 0.24 || (aspectRatio > 1.55 && motionRatio > 0.08)) {
    return "Possible vehicle";
  }

  if (bounds.height > bounds.width * 1.12 && areaRatio > 0.045) {
    return "Possible person";
  }

  if (areaRatio < 0.085 || aspectRatio < 1.05) {
    return "Possible pet";
  }

  return aspectRatio > 1.28 ? "Possible vehicle" : "Possible person";
}

function saveAlarmScreenshot(result) {
  const width = elements.cameraFeed.videoWidth;
  const height = elements.cameraFeed.videoHeight;

  if (!width || !height) {
    return false;
  }

  try {
    const captureCanvas = document.createElement("canvas");
    captureCanvas.width = width;
    captureCanvas.height = height;
    const captureContext = captureCanvas.getContext("2d");
    const snapshotLabel = result.objectLabel
      ? `${MOVEMENT_META[result.type].label} | ${result.objectLabel}`
      : MOVEMENT_META[result.type].label;

    captureContext.save();
    captureContext.translate(width, 0);
    captureContext.scale(-1, 1);
    captureContext.drawImage(elements.cameraFeed, 0, 0, width, height);
    captureContext.drawImage(elements.overlayCanvas, 0, 0, width, height);
    captureContext.restore();

    captureContext.fillStyle = "rgba(4, 16, 29, 0.8)";
    captureContext.fillRect(18, 18, Math.min(width - 36, 430), 56);
    captureContext.fillStyle = "#f5f7ff";
    captureContext.font = '700 18px "Trebuchet MS", sans-serif';
    captureContext.fillText("Security Guard alarm snapshot", 30, 41);
    captureContext.font = '400 14px "Trebuchet MS", sans-serif';
    captureContext.fillText(`${formatTimelineTime(new Date())} | ${snapshotLabel}`, 30, 63);

    const link = document.createElement("a");
    link.href = captureCanvas.toDataURL("image/png");
    link.download = `security-guard-alarm-${new Date().toISOString().replace(/[:.]/g, "-")}.png`;
    document.body.append(link);
    link.click();
    link.remove();

    state.screenshotCount += 1;
    updateFeatureSummary();
    return true;
  } catch (error) {
    console.error("Screenshot save failed:", error);
    return false;
  }
}

function appendLog(entry) {
  const meta = MOVEMENT_META[entry.type] || MOVEMENT_META.unknown;
  const item = document.createElement("article");
  const details = [`Intensity: ${Math.round(entry.strength * 100)}%`, `Sound: ${meta.sound}`];

  if (entry.objectLabel) {
    details.push(entry.objectLabel);
  }

  if (entry.screenshotSaved) {
    details.push("Screenshot saved");
  }

  item.className = "event-log-item";
  item.innerHTML = `
    <div class="event-log-dot" style="color: ${meta.color}; background: ${meta.color};"></div>
    <div>
      <strong>${meta.label}</strong>
      <span>${details.join(". ")}.</span>
    </div>
    <time>${formatTime(entry.timestamp)}</time>
  `;

  if (elements.eventLog.querySelector(".event-log-empty")) {
    elements.eventLog.innerHTML = "";
  }

  elements.eventLog.prepend(item);

  while (elements.eventLog.children.length > MAX_LOG_ITEMS) {
    elements.eventLog.lastElementChild.remove();
  }
}

function appendTimeline(entry) {
  if (!elements.fullTimelineToggle.checked) {
    updateFeatureSummary();
    return;
  }

  state.timelineEvents.push(entry);
  renderTimeline();
}

function setBadge(type) {
  const meta = MOVEMENT_META[type] || MOVEMENT_META.unknown;
  elements.movementBadge.textContent = meta.badge;
  elements.movementBadge.className =
    type === "idle"
      ? "movement-badge movement-idle"
      : "movement-badge movement-active";
  elements.movementBadge.style.background =
    type === "idle"
      ? "rgba(107, 227, 193, 0.88)"
      : `linear-gradient(135deg, ${meta.color}, rgba(255, 93, 93, 0.9))`;
  elements.movementBadge.style.color = type === "idle" ? "#082820" : "#fff6ea";
}

function updateReadout(result) {
  const meta = MOVEMENT_META[result.type] || MOVEMENT_META.unknown;
  elements.motionType.textContent = meta.label;
  elements.motionStrength.textContent = `${Math.round(result.strength * 100)}%`;
  elements.hudMotionPercent.textContent = `${(result.motionRatio * 100).toFixed(1)}%`;
  elements.currentSoundLabel.textContent = meta.sound;
  elements.recognizedObject.textContent =
    result.type === "idle" ? getRecognitionIdleLabel() : result.objectLabel || getRecognitionIdleLabel();
  setBadge(result.type);
}

function ensureAudioContext() {
  if (!state.audioContext) {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;

    if (!AudioContextClass) {
      return Promise.resolve(false);
    }

    state.audioContext = new AudioContextClass();
  }

  if (state.audioContext.state === "suspended") {
    return state.audioContext.resume().then(() => true);
  }

  return Promise.resolve(true);
}

function primeAudioContext() {
  const audioContext = state.audioContext;

  if (!audioContext) {
    return;
  }

  const oscillator = audioContext.createOscillator();
  const gainNode = audioContext.createGain();
  const now = audioContext.currentTime;

  oscillator.type = "sine";
  oscillator.frequency.setValueAtTime(440, now);
  gainNode.gain.setValueAtTime(0.00001, now);
  gainNode.gain.linearRampToValueAtTime(0.00001, now + 0.03);

  oscillator.connect(gainNode);
  gainNode.connect(audioContext.destination);
  oscillator.start(now);
  oscillator.stop(now + 0.03);
}

function getVolume() {
  return Number(elements.volumeRange.value) / 100;
}

function playEnvelope(startFrequency, endFrequency, duration, waveType, strength, delay = 0) {
  const audioContext = state.audioContext;

  if (!audioContext) {
    return;
  }

  const now = audioContext.currentTime + delay;
  const oscillator = audioContext.createOscillator();
  const gainNode = audioContext.createGain();

  oscillator.type = waveType;
  oscillator.frequency.setValueAtTime(startFrequency, now);
  oscillator.frequency.exponentialRampToValueAtTime(
    Math.max(endFrequency, 1),
    now + duration
  );

  const peak = Math.max(0.02, getVolume() * (0.18 + strength * 0.18));
  gainNode.gain.setValueAtTime(0.0001, now);
  gainNode.gain.linearRampToValueAtTime(peak, now + 0.03);
  gainNode.gain.exponentialRampToValueAtTime(0.0001, now + duration);

  oscillator.connect(gainNode);
  gainNode.connect(audioContext.destination);
  oscillator.start(now);
  oscillator.stop(now + duration + 0.03);
}

function playAlarm(strength) {
  const audioContext = state.audioContext;

  if (!audioContext) {
    return;
  }

  const now = audioContext.currentTime;
  const oscillator = audioContext.createOscillator();
  const gainNode = audioContext.createGain();

  oscillator.type = "sawtooth";
  oscillator.frequency.setValueAtTime(620, now);
  oscillator.frequency.linearRampToValueAtTime(920, now + 0.18);
  oscillator.frequency.linearRampToValueAtTime(520, now + 0.38);
  oscillator.frequency.linearRampToValueAtTime(880, now + 0.58);

  const peak = Math.max(0.05, getVolume() * (0.22 + strength * 0.2));
  gainNode.gain.setValueAtTime(0.0001, now);
  gainNode.gain.linearRampToValueAtTime(peak, now + 0.04);
  gainNode.gain.linearRampToValueAtTime(peak * 0.55, now + 0.22);
  gainNode.gain.linearRampToValueAtTime(peak, now + 0.4);
  gainNode.gain.exponentialRampToValueAtTime(0.0001, now + 0.72);

  oscillator.connect(gainNode);
  gainNode.connect(audioContext.destination);
  oscillator.start(now);
  oscillator.stop(now + 0.75);
}

function playMovementSound(type, strength) {
  switch (type) {
    case "left":
      playEnvelope(320, 170, 0.26, "triangle", strength);
      break;
    case "right":
      playEnvelope(210, 450, 0.24, "triangle", strength);
      break;
    case "up":
      playEnvelope(260, 620, 0.2, "sine", strength);
      break;
    case "down":
      playEnvelope(610, 230, 0.24, "sine", strength);
      break;
    case "forward":
      playEnvelope(180, 260, 0.14, "square", strength);
      playEnvelope(260, 380, 0.2, "triangle", strength, 0.08);
      break;
    case "backward":
      playAlarm(strength);
      break;
    default:
      playEnvelope(180, 240, 0.14, "square", strength);
  }
}

function drawOverlay(result) {
  const canvas = elements.overlayCanvas;
  overlayContext.clearRect(0, 0, canvas.width, canvas.height);

  if (result.type === "idle" || !result.bounds) {
    return;
  }

  const scaleX = canvas.width / PROCESSING_WIDTH;
  const scaleY = canvas.height / PROCESSING_HEIGHT;
  const x = result.bounds.x * scaleX;
  const y = result.bounds.y * scaleY;
  const width = result.bounds.width * scaleX;
  const height = result.bounds.height * scaleY;
  const meta = MOVEMENT_META[result.type] || MOVEMENT_META.unknown;
  const overlayText = result.objectLabel
    ? `${meta.label} - ${result.objectLabel}`
    : meta.label;

  overlayContext.strokeStyle = meta.color;
  overlayContext.fillStyle = meta.color;
  overlayContext.lineWidth = 4;
  overlayContext.shadowColor = meta.color;
  overlayContext.shadowBlur = 18;
  overlayContext.strokeRect(x, y, width, height);

  overlayContext.shadowBlur = 0;
  overlayContext.fillRect(
    x,
    Math.max(12, y - 32),
    Math.max(180, overlayText.length * 7.4),
    24
  );
  overlayContext.fillStyle = "#04101d";
  overlayContext.font = '700 14px "Trebuchet MS", sans-serif';
  overlayContext.fillText(overlayText, x + 10, Math.max(29, y - 14));
}

function resizeOverlay() {
  const width = elements.cameraFeed.videoWidth || 1280;
  const height = elements.cameraFeed.videoHeight || 720;
  elements.overlayCanvas.width = width;
  elements.overlayCanvas.height = height;
}

function getSensitivityConfig() {
  const sensitivity = Number(elements.sensitivityRange.value);

  return {
    differenceThreshold: Math.max(14, 58 - sensitivity * 0.5),
    minActivePixels: Math.max(110, 760 - sensitivity * 7)
  };
}

function classifyMovement(current, previous) {
  if (!previous) {
    return { type: "unknown", strength: 0.35 };
  }

  const dx = current.centerX - previous.centerX;
  const dy = current.centerY - previous.centerY;
  const scaleDelta = (current.area - previous.area) / Math.max(previous.area, 1);
  const horizontal = Math.abs(dx);
  const vertical = Math.abs(dy);
  const depth = Math.abs(scaleDelta) * 30;
  let type = "unknown";

  if (scaleDelta <= -0.18 && depth > horizontal && depth > vertical) {
    type = "backward";
  } else if (scaleDelta >= 0.22 && depth >= horizontal && depth >= vertical) {
    type = "forward";
  } else if (horizontal >= vertical && horizontal > 2.6) {
    type = dx > 0 ? "right" : "left";
  } else if (vertical > 2.4) {
    type = dy > 0 ? "down" : "up";
  }

  const strength = Math.min(
    1,
    Math.max(horizontal / 12, vertical / 11, Math.abs(scaleDelta) * 2.7, 0.22)
  );

  return { type, strength };
}

function analyseMotion(grayFrame) {
  if (!state.previousGray) {
    state.previousGray = grayFrame;
    return { type: "idle", strength: 0, motionRatio: 0 };
  }

  const previousFrame = state.previousGray;
  const { differenceThreshold, minActivePixels } = getSensitivityConfig();
  const totalPixels = PROCESSING_WIDTH * PROCESSING_HEIGHT;

  let activePixels = 0;
  let sumX = 0;
  let sumY = 0;
  let minX = PROCESSING_WIDTH;
  let minY = PROCESSING_HEIGHT;
  let maxX = 0;
  let maxY = 0;

  for (let index = 0; index < grayFrame.length; index += 1) {
    const difference = Math.abs(grayFrame[index] - previousFrame[index]);

    if (difference <= differenceThreshold) {
      continue;
    }

    const x = index % PROCESSING_WIDTH;
    const y = (index - x) / PROCESSING_WIDTH;

    activePixels += 1;
    sumX += x;
    sumY += y;
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x);
    maxY = Math.max(maxY, y);
  }

  state.previousGray = grayFrame;

  const motionRatio = activePixels / totalPixels;

  if (activePixels < minActivePixels) {
    state.quietFrames += 1;

    if (state.quietFrames > 5) {
      state.previousMotion = null;
    }

    return { type: "idle", strength: 0, motionRatio };
  }

  state.quietFrames = 0;

  const rawMotion = {
    centerX: sumX / activePixels,
    centerY: sumY / activePixels,
    area: Math.max(1, (maxX - minX + 1) * (maxY - minY + 1)),
    bounds: {
      x: minX,
      y: minY,
      width: maxX - minX + 1,
      height: maxY - minY + 1
    }
  };

  const previousMotion = state.previousMotion;
  const smoothedMotion =
    previousMotion === null
      ? rawMotion
      : {
          centerX: previousMotion.centerX * 0.35 + rawMotion.centerX * 0.65,
          centerY: previousMotion.centerY * 0.35 + rawMotion.centerY * 0.65,
          area: previousMotion.area * 0.3 + rawMotion.area * 0.7,
          bounds: rawMotion.bounds
        };

  const classification = classifyMovement(smoothedMotion, previousMotion);
  state.previousMotion = {
    centerX: smoothedMotion.centerX,
    centerY: smoothedMotion.centerY,
    area: smoothedMotion.area
  };

  return {
    type: classification.type,
    strength: classification.strength,
    motionRatio,
    bounds: rawMotion.bounds
  };
}

function extractGrayFrame() {
  processingContext.drawImage(
    elements.cameraFeed,
    0,
    0,
    PROCESSING_WIDTH,
    PROCESSING_HEIGHT
  );

  const { data } = processingContext.getImageData(
    0,
    0,
    PROCESSING_WIDTH,
    PROCESSING_HEIGHT
  );
  const grayFrame = new Uint8Array(PROCESSING_WIDTH * PROCESSING_HEIGHT);

  for (let pixel = 0, grayIndex = 0; pixel < data.length; pixel += 4, grayIndex += 1) {
    grayFrame[grayIndex] =
      data[pixel] * 0.299 + data[pixel + 1] * 0.587 + data[pixel + 2] * 0.114;
  }

  return grayFrame;
}

function detectionLoop(timestamp) {
  if (!state.running) {
    return;
  }

  state.frameRequestId = window.requestAnimationFrame(detectionLoop);

  if (timestamp - state.lastProcessedAt < 85) {
    return;
  }

  if (elements.cameraFeed.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) {
    return;
  }

  state.lastProcessedAt = timestamp;
  const result = analyseMotion(extractGrayFrame());

  if (elements.recognitionToggle.checked && result.type !== "idle" && result.bounds) {
    result.objectLabel = estimateObjectGuess(result.bounds, result.motionRatio);
  }

  updateReadout(result);
  drawOverlay(result);

  const cooldown = Number(elements.cooldownRange.value);
  const enoughTimePassed = timestamp - state.lastTriggerAt >= cooldown;

  if (result.type !== "idle" && enoughTimePassed) {
    state.lastTriggerAt = timestamp;
    playMovementSound(result.type, result.strength);
    const screenshotSaved =
      result.type === "backward" && elements.autoScreenshotToggle.checked
        ? saveAlarmScreenshot(result)
        : false;
    const entry = createDetectionEntry(result, screenshotSaved);

    appendLog(entry);
    appendTimeline(entry);
  }
}

async function startSystem() {
  if (!navigator.mediaDevices?.getUserMedia) {
    elements.systemStatus.textContent = "This browser does not support camera access.";
    return;
  }

  elements.systemStatus.textContent = "Requesting camera access...";
  elements.startButton.disabled = true;

  try {
    await ensureAudioContext();

    const stream = await navigator.mediaDevices.getUserMedia({
      audio: false,
      video: {
        width: { ideal: 1280 },
        height: { ideal: 720 },
        facingMode: { ideal: "environment" }
      }
    });

    state.stream = stream;
    elements.cameraFeed.srcObject = stream;

    await elements.cameraFeed.play();
    resizeOverlay();

    state.running = true;
    state.previousGray = null;
    state.previousMotion = null;
    state.lastProcessedAt = 0;
    state.lastTriggerAt = 0;
    state.quietFrames = 0;

    elements.systemStatus.textContent = "Guard is active";
    elements.currentSoundLabel.textContent = "System ready";
    elements.recognizedObject.textContent = getRecognitionIdleLabel();
    elements.stopButton.disabled = false;
    window.requestAnimationFrame(detectionLoop);
  } catch (error) {
    console.error(error);
    elements.systemStatus.textContent =
      "Could not enable the camera. Check your browser permission.";
    elements.startButton.disabled = false;
  }
}

function stopStreamTracks() {
  if (!state.stream) {
    return;
  }

  for (const track of state.stream.getTracks()) {
    track.stop();
  }

  state.stream = null;
}

function stopSystem() {
  state.running = false;
  stopStreamTracks();

  if (state.frameRequestId) {
    window.cancelAnimationFrame(state.frameRequestId);
    state.frameRequestId = null;
  }

  elements.cameraFeed.srcObject = null;
  overlayContext.clearRect(0, 0, elements.overlayCanvas.width, elements.overlayCanvas.height);
  elements.systemStatus.textContent = "Guard stopped";
  elements.currentSoundLabel.textContent = "Standby";
  elements.recognizedObject.textContent = getRecognitionIdleLabel();
  elements.motionType.textContent = MOVEMENT_META.idle.label;
  elements.motionStrength.textContent = "0%";
  elements.hudMotionPercent.textContent = "0.0%";
  state.previousGray = null;
  state.previousMotion = null;
  setBadge("idle");
  elements.startButton.disabled = false;
  elements.stopButton.disabled = true;
}

function handleFeatureToggleChange() {
  if (!elements.fullTimelineToggle.checked) {
    elements.timelineList.innerHTML = "";
  }

  elements.recognizedObject.textContent = getRecognitionIdleLabel();
  renderTimeline();
  updateFeatureSummary();
}

async function testSounds() {
  const audioReady = await ensureAudioContext();

  if (!audioReady || !state.audioContext) {
    elements.currentSoundLabel.textContent = "Audio unavailable";
    return;
  }

  const sequence = ["left", "right", "up", "down", "forward", "backward"];
  primeAudioContext();

  const [firstType, ...rest] = sequence;
  playMovementSound(firstType, 0.75);
  elements.currentSoundLabel.textContent = MOVEMENT_META[firstType].sound;

  rest.forEach((type, index) => {
    window.setTimeout(() => {
      playMovementSound(type, 0.75);
      elements.currentSoundLabel.textContent = MOVEMENT_META[type].sound;
    }, (index + 1) * 420);
  });
}

elements.sensitivityRange.addEventListener("input", updateSliderLabels);
elements.cooldownRange.addEventListener("input", updateSliderLabels);
elements.volumeRange.addEventListener("input", updateSliderLabels);
elements.autoScreenshotToggle.addEventListener("change", handleFeatureToggleChange);
elements.nightModeToggle.addEventListener("change", handleFeatureToggleChange);
elements.recognitionToggle.addEventListener("change", handleFeatureToggleChange);
elements.fullTimelineToggle.addEventListener("change", handleFeatureToggleChange);
elements.startButton.addEventListener("click", startSystem);
elements.stopButton.addEventListener("click", stopSystem);
elements.testSoundsButton.addEventListener("click", testSounds);
window.addEventListener("resize", resizeOverlay);
window.addEventListener("beforeunload", stopStreamTracks);

updateSliderLabels();
renderEmptyLog();
renderTimeline();
updateFeatureSummary();
elements.recognizedObject.textContent = getRecognitionIdleLabel();
setBadge("idle");
