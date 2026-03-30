/* NEW CODE: extended effects and controls */
const canvas = document.getElementById('mainCanvas');
const ctx = canvas.getContext('2d');
const video = document.getElementById('video');
const camBtn = document.getElementById('camBtn');
const fileInput = document.getElementById('fileInput');
const chaosSaveBtn = document.getElementById('chaosSaveBtn');

// efektide juhtnupud
const effectRGBSplit = document.getElementById('effectRGBSplit');
const effectDatamosh = document.getElementById('effectDatamosh');
const effectPixelSort = document.getElementById('effectPixelSort');
const effectAudioDist = document.getElementById('effectAudioDist');
const effectScanline = document.getElementById('effectScanline');
const effectVHS = document.getElementById('effectVHS');
const effectMirror = document.getElementById('effectMirror');
const effectFreeze = document.getElementById('effectFreeze');
const effectASCII = document.getElementById('effectASCII');

const rgbRange = document.getElementById('rgbRange');
const datamoshRange = document.getElementById('datamoshRange');
const pixelThreshold = document.getElementById('pixelThreshold');
const audioDistRange = document.getElementById('audioDistRange');
const mirrorCountInput = document.getElementById('mirrorCount');

const offscreenCanvas = document.createElement('canvas');
const offscreenCtx = offscreenCanvas.getContext('2d');
const freezeCanvas = document.createElement('canvas');
const freezeCtx = freezeCanvas.getContext('2d');

let sourceImage = null;
let sourceType = null; // 'video' or 'image'
let prevImageData = null;
let mouse = { x: 0, y: 0 };
let freezeRect = null; // {x,y,w,h}
let audioAnalyser = null;
let audioData = null;
let audioLevel = 0;
let audioCtx = null;
let lastTimestamp = 0;

const ASCII_CHARS = [' ', '.', ':', '-', '=', '+', '*', '#', '%', '@'];
const effects = {
  rgbSplit: false,
  datamosh: false,
  pixelSort: false,
  audioDist: false,
  scanline: false,
  vhs: false,
  mirror: false,
  freeze: false,
  ascii: false
};

const params = {
  rgbOffset: 20,
  datamoshMix: 0.15,
  pixelThreshold: 140,
  audioMax: 25,
  mirrorCount: 4
};

function resizeCanvas() {
  const parent = canvas.parentElement;
  const style = getComputedStyle(parent);
  const width = parent.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);
  const height = parent.clientHeight - parseFloat(style.paddingTop) - parseFloat(style.paddingBottom);

  canvas.width = Math.floor(width * window.devicePixelRatio);
  canvas.height = Math.floor(height * window.devicePixelRatio);
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;
  ctx.setTransform(window.devicePixelRatio, 0, 0, window.devicePixelRatio, 0, 0);

  offscreenCanvas.width = canvas.width;
  offscreenCanvas.height = canvas.height;
  freezeCanvas.width = canvas.width;
  freezeCanvas.height = canvas.height;

  offscreenCtx.setTransform(window.devicePixelRatio, 0, 0, window.devicePixelRatio, 0, 0);
  freezeCtx.setTransform(window.devicePixelRatio, 0, 0, window.devicePixelRatio, 0, 0);
}

function drawCoverToContext(context, source, ctxWidth, ctxHeight) {
  const sw = source.videoWidth || source.naturalWidth;
  const sh = source.videoHeight || source.naturalHeight;
  if (!sw || !sh) return;

  const canvasRatio = ctxWidth / ctxHeight;
  const sourceRatio = sw / sh;
  let sx = 0,
    sy = 0,
    sWidth = sw,
    sHeight = sh;

  if (sourceRatio > canvasRatio) {
    sWidth = sh * canvasRatio;
    sx = (sw - sWidth) / 2;
  } else {
    sHeight = sw / canvasRatio;
    sy = (sh - sHeight) / 2;
  }

  context.clearRect(0, 0, ctxWidth, ctxHeight);
  context.drawImage(source, sx, sy, sWidth, sHeight, 0, 0, ctxWidth, ctxHeight);
}

function setEffectsFromUI() {
  effects.rgbSplit = effectRGBSplit.checked;
  effects.datamosh = effectDatamosh.checked;
  effects.pixelSort = effectPixelSort.checked;
  effects.audioDist = effectAudioDist.checked;
  effects.scanline = effectScanline.checked;
  effects.vhs = effectVHS.checked;
  effects.mirror = effectMirror.checked;
  effects.freeze = effectFreeze.checked;
  effects.ascii = effectASCII.checked;

  params.rgbOffset = Number(rgbRange.value);
  params.datamoshMix = Number(datamoshRange.value) / 100;
  params.pixelThreshold = Number(pixelThreshold.value);
  params.audioMax = Number(audioDistRange.value);
  params.mirrorCount = Number(mirrorCountInput.value);

  if (effects.audioDist) {
    initAudio();
  }
}

function initAudio() {
  if (audioAnalyser) return;

  navigator.mediaDevices
    .getUserMedia({ audio: true, video: false })
    .then((stream) => {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const source = audioCtx.createMediaStreamSource(stream);
      audioAnalyser = audioCtx.createAnalyser();
      audioAnalyser.fftSize = 256;
      source.connect(audioAnalyser);
      audioData = new Uint8Array(audioAnalyser.frequencyBinCount);
    })
    .catch((e) => {
      console.warn('Microphone analysis failed:', e);
      effectAudioDist.checked = false;
      effects.audioDist = false;
    });
}

function updateAudioLevel() {
  if (!audioAnalyser || !audioData) return;

  audioAnalyser.getByteTimeDomainData(audioData);
  let sum = 0;
  for (let i = 0; i < audioData.length; i += 1) {
    const norm = (audioData[i] - 128) / 128;
    sum += norm * norm;
  }
  audioLevel = Math.min(1, Math.sqrt(sum / audioData.length));
}

function applyDatamosh(current, previous, mix) {
  if (!previous) return current;
  const out = new Uint8ClampedArray(current.data);
  for (let i = 0; i < current.data.length; i++) {
    out[i] = current.data[i] * (1 - mix) + previous.data[i] * mix;
  }
  current.data.set(out);
  return current;
}

function applyRGBSplit(imageData, offsetX, offsetY) {
  const w = imageData.width;
  const h = imageData.height;
  const src = imageData.data;
  const out = new Uint8ClampedArray(src.length);

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const index = (y * w + x) * 4;
      const rx = Math.min(w - 1, Math.max(0, x + offsetX));
      const bx = Math.min(w - 1, Math.max(0, x - offsetX));
      const ry = Math.min(h - 1, Math.max(0, y + offsetY));
      const by = Math.min(h - 1, Math.max(0, y - offsetY));
      const rIndex = (ry * w + rx) * 4;
      const gIndex = index;
      const bIndex = (by * w + bx) * 4;

      out[index] = src[rIndex];
      out[index + 1] = src[gIndex + 1];
      out[index + 2] = src[bIndex + 2];
      out[index + 3] = src[index + 3];
    }
  }

  imageData.data.set(out);
  return imageData;
}

function applyPixelSort(imageData, threshold) {
  const w = imageData.width;
  const h = imageData.height;
  const data = imageData.data;

  for (let y = 0; y < h; y++) {
    let segmentStart = null;
    for (let x = 0; x <= w; x++) {
      const isBright = x < w && (() => {
        const idx = (y * w + x) * 4;
        return (data[idx] + data[idx + 1] + data[idx + 2]) / 3 > threshold;
      })();

      if (isBright && segmentStart === null) segmentStart = x;
      if ((!isBright || x === w) && segmentStart !== null) {
        const segment = [];
        for (let sx = segmentStart; sx < x; sx++) {
          const idx = (y * w + sx) * 4;
          const lum = 0.2126 * data[idx] + 0.7152 * data[idx + 1] + 0.0722 * data[idx + 2];
          segment.push({ lum, color: [data[idx], data[idx + 1], data[idx + 2], data[idx + 3]] });
        }
        segment.sort((a, b) => a.lum - b.lum);
        for (let sx = segmentStart, i = 0; sx < x; sx++, i++) {
          const idx = (y * w + sx) * 4;
          const pix = segment[i];
          data[idx] = pix.color[0];
          data[idx + 1] = pix.color[1];
          data[idx + 2] = pix.color[2];
          data[idx + 3] = pix.color[3];
        }
        segmentStart = null;
      }
    }
  }

  return imageData;
}

function applyAudioDistortion(imageData, intensity) {
  const w = imageData.width;
  const h = imageData.height;
  const src = imageData.data;
  const out = new Uint8ClampedArray(src.length);

  for (let y = 0; y < h; y++) {
    const wave = Math.sin((y + lastTimestamp / 12) * 0.07) * 0.35;
    const shift = Math.round((mouse.x / w - 0.5) * intensity + wave * intensity * 0.45 + audioLevel * intensity);

    for (let x = 0; x < w; x++) {
      const fromX = Math.min(w - 1, Math.max(0, x + shift));
      const idx = (y * w + x) * 4;
      const srcIdx = (y * w + fromX) * 4;
      out[idx] = src[srcIdx];
      out[idx + 1] = src[srcIdx + 1];
      out[idx + 2] = src[srcIdx + 2];
      out[idx + 3] = src[srcIdx + 3];
    }
  }

  imageData.data.set(out);
  return imageData;
}

function applyVHSNoise(imageData, strength = 0.25) {
  const w = imageData.width;
  const h = imageData.height;
  const data = imageData.data;

  for (let y = 0; y < h; y++) {
    const lineDistort = Math.floor((Math.random() - 0.5) * 3 * strength);
    for (let x = 0; x < w; x++) {
      const idx = (y * w + x) * 4;
      const n = (Math.random() - 0.5) * 40 * strength;
      data[idx] = Math.min(255, Math.max(0, data[idx] + n));
      data[idx + 1] = Math.min(255, Math.max(0, data[idx + 1] + n));
      data[idx + 2] = Math.min(255, Math.max(0, data[idx + 2] + n));
      if (lineDistort !== 0) {
        const targetX = Math.min(w - 1, Math.max(0, x + lineDistort));
        const targetIdx = (y * w + targetX) * 4;
        if (targetIdx !== idx) {
          const dd = data.slice(idx, idx + 4);
          data[targetIdx] = dd[0];
          data[targetIdx + 1] = dd[1];
          data[targetIdx + 2] = dd[2];
        }
      }
    }
  }

  return imageData;
}

function renderMirrorDimension(context, sourceCanvas, count) {
  const cw = canvas.width / window.devicePixelRatio;
  const ch = canvas.height / window.devicePixelRatio;
  const w = cw;
  const h = ch;
  context.clearRect(0, 0, w, h);

  const halfW = w / 2;
  const halfH = h / 2;

  context.drawImage(sourceCanvas, 0, 0, w, h, 0, 0, halfW, halfH);

  context.save();
  context.translate(w, 0);
  context.scale(-1, 1);
  context.drawImage(sourceCanvas, 0, 0, w, h, 0, 0, halfW, halfH);
  context.restore();

  context.save();
  context.translate(0, h);
  context.scale(1, -1);
  context.drawImage(sourceCanvas, 0, 0, w, h, 0, 0, halfW, halfH);
  context.restore();

  context.save();
  context.translate(w, h);
  context.scale(-1, -1);
  context.drawImage(sourceCanvas, 0, 0, w, h, 0, 0, halfW, halfH);
  context.restore();

  if (count === 8) {
    const miniW = w / 4;
    const miniH = h / 4;
    for (let i = 0; i < 4; i++) {
      context.save();
      const x = i * miniW;
      const y = (i % 2 === 0 ? 0 : halfH);
      context.translate(x + miniW / 2, y + miniH / 2);
      context.rotate((i % 4) * Math.PI / 2);
      context.drawImage(sourceCanvas, 0, 0, w, h, -miniW / 2, -miniH / 2, miniW, miniH);
      context.restore();
    }
  }
}

function renderAscii(imageData) {
  const cw = canvas.width / window.devicePixelRatio;
  const ch = canvas.height / window.devicePixelRatio;
  const block = 8;
  ctx.fillStyle = '#02040f';
  ctx.fillRect(0, 0, cw, ch);
  ctx.fillStyle = '#65fffd';
  ctx.font = `${block}px monospace`;

  for (let y = 0; y < ch; y += block) {
    for (let x = 0; x < cw; x += block) {
      let r = 0,
        g = 0,
        b = 0,
        count = 0;

      for (let yy = y; yy < Math.min(ch, y + block); yy++) {
        for (let xx = x; xx < Math.min(cw, x + block); xx++) {
          const idx = (yy * cw + xx) * 4;
          r += imageData.data[idx];
          g += imageData.data[idx + 1];
          b += imageData.data[idx + 2];
          count++;
        }
      }

      if (count === 0) continue;

      const brightness = (r / count * 0.2126 + g / count * 0.7152 + b / count * 0.0722) / 255;
      const charIndex = Math.floor(brightness * (ASCII_CHARS.length - 1));
      const char = ASCII_CHARS[Math.max(0, Math.min(ASCII_CHARS.length - 1, charIndex))];
      ctx.fillText(char, x, y + block);
    }
  }
}

function applyScanlineOverlay() {
  const cw = canvas.width / window.devicePixelRatio;
  const ch = canvas.height / window.devicePixelRatio;
  const lineCount = Math.max(30, Math.floor(ch / 12));

  for (let i = 0; i < lineCount; i++) {
    const y = (i / lineCount) * ch;
    const alpha = 0.05 + 0.05 * Math.random();
    ctx.fillStyle = `rgba(70, 190, 255, ${alpha})`;
    ctx.fillRect(0, y, cw, 1);
  }
}

function applyFreezeRegion() {
  if (!freezeRect || !effects.freeze) return;

  ctx.drawImage(
    freezeCanvas,
    freezeRect.x,
    freezeRect.y,
    freezeRect.w,
    freezeRect.h,
    freezeRect.x,
    freezeRect.y,
    freezeRect.w,
    freezeRect.h
  );
}

function captureFreezeRegion() {
  if (!freezeRect) return;
  freezeCtx.clearRect(0, 0, freezeCanvas.width, freezeCanvas.height);
  freezeCtx.drawImage(canvas, 0, 0, canvas.width / window.devicePixelRatio, canvas.height / window.devicePixelRatio);
}

function drawLoop(timestamp) {
  lastTimestamp = timestamp;
  setEffectsFromUI();
  updateAudioLevel();

  const cw = canvas.width / window.devicePixelRatio;
  const ch = canvas.height / window.devicePixelRatio;

  offscreenCtx.clearRect(0, 0, cw, ch);

  if (sourceType === 'video' && video.readyState >= 2) {
    drawCoverToContext(offscreenCtx, video, cw, ch);
  } else if (sourceType === 'image' && sourceImage) {
    drawCoverToContext(offscreenCtx, sourceImage, cw, ch);
  }

  let currentData = offscreenCtx.getImageData(0, 0, cw, ch);

  if (effects.datamosh && prevImageData) {
    currentData = applyDatamosh(currentData, prevImageData, params.datamoshMix);
  }

  if (effects.rgbSplit) {
    const xOffset = Math.floor(((mouse.x / cw) - 0.5) * params.rgbOffset * 2);
    const yOffset = Math.floor(((mouse.y / ch) - 0.5) * params.rgbOffset * 2);
    currentData = applyRGBSplit(currentData, xOffset, yOffset);
  }

  if (effects.pixelSort) {
    currentData = applyPixelSort(currentData, params.pixelThreshold);
  }

  if (effects.audioDist) {
    const intensity = params.audioMax * (0.5 + audioLevel * 5);
    currentData = applyAudioDistortion(currentData, intensity);
  }

  if (effects.vhs) {
    currentData = applyVHSNoise(currentData, 0.2);
  }

  offscreenCtx.putImageData(currentData, 0, 0);

  if (effects.ascii) {
    renderAscii(currentData);
  } else if (effects.mirror) {
    renderMirrorDimension(ctx, offscreenCanvas, params.mirrorCount);
  } else {
    ctx.clearRect(0, 0, cw, ch);
    ctx.drawImage(offscreenCanvas, 0, 0, cw, ch);
  }

  if (effects.scanline) {
    applyScanlineOverlay();
  }

  if (effects.freeze && freezeRect) {
    applyFreezeRegion();
  }

  prevImageData = ctx.getImageData(0, 0, cw, ch);

  requestAnimationFrame(drawLoop);
}

canvas.addEventListener('mousemove', (event) => {
  const bounds = canvas.getBoundingClientRect();
  mouse.x = event.clientX - bounds.left;
  mouse.y = event.clientY - bounds.top;
});

canvas.addEventListener('click', (event) => {
  if (!effects.freeze) return;

  const bounds = canvas.getBoundingClientRect();
  const x = Math.max(0, event.clientX - bounds.left);
  const y = Math.max(0, event.clientY - bounds.top);
  const size = 150;

  if (freezeRect) {
    freezeRect = null;
    freezeCtx.clearRect(0, 0, freezeCanvas.width, freezeCanvas.height);
    return;
  }

  freezeRect = {
    x: Math.max(0, Math.min(cw - size, x - size / 2)),
    y: Math.max(0, Math.min(ch - size, y - size / 2)),
    w: size,
    h: size
  };

  captureFreezeRegion();
});

async function startCamera() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false });
    video.srcObject = stream;
    await video.play();
    sourceType = 'video';
    camBtn.textContent = 'Camera Active';
  } catch (error) {
    console.error('Camera error:', error);
    alert('Camera unavailable or permission denied.');
  }
}

camBtn.addEventListener('click', () => {
  if (video && video.srcObject) {
    const tracks = video.srcObject.getVideoTracks();
    tracks.forEach((track) => track.stop());
    video.srcObject = null;
    sourceType = null;
    camBtn.textContent = 'Turn Camera On';
    return;
  }
  startCamera();
});

fileInput.addEventListener('change', (event) => {
  const file = event.target.files?.[0];
  if (!file) return;

  const img = new Image();
  img.onload = () => {
    sourceImage = img;
    sourceType = 'image';
    if (video.srcObject) {
      const tracks = video.srcObject.getVideoTracks();
      tracks.forEach((track) => track.stop());
      video.srcObject = null;
      camBtn.textContent = 'Lülita kaamera sisse';
    }
  };
  img.onerror = () => alert('Image loading failed. Please try a different file.');
  img.src = URL.createObjectURL(file);
});

chaosSaveBtn.addEventListener('click', () => {
  const cw = canvas.width / window.devicePixelRatio;
  const ch = canvas.height / window.devicePixelRatio;
  const snapshot = ctx.getImageData(0, 0, cw, ch);

  for (let i = 0; i < snapshot.data.length; i += 4) {
    if (Math.random() > 0.97) {
      snapshot.data[i] = Math.min(255, snapshot.data[i] + Math.random() * 150);
      snapshot.data[i + 1] = Math.min(255, snapshot.data[i + 1] + Math.random() * 150);
      snapshot.data[i + 2] = Math.min(255, snapshot.data[i + 2] + Math.random() * 150);
    }
  }

  offscreenCtx.putImageData(snapshot, 0, 0);
  ctx.drawImage(offscreenCanvas, 0, 0, cw, ch);

  const link = document.createElement('a');
  link.download = `chaos-save-${Date.now()}.png`;
  link.href = canvas.toDataURL('image/png');
  link.click();
});

window.addEventListener('resize', () => {
  resizeCanvas();
});

// init
resizeCanvas();
ctx.fillStyle = '#101220';
ctx.fillRect(0, 0, canvas.width / window.devicePixelRatio, canvas.height / window.devicePixelRatio);
ctx.fillStyle = '#6f8ee0';
ctx.font = 'bold 20px sans-serif';
ctx.textAlign = 'center';
ctx.fillText('Select camera or load image', canvas.width / (2 * window.devicePixelRatio), canvas.height / (2 * window.devicePixelRatio));
requestAnimationFrame(drawLoop);
