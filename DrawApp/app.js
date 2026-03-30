const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const colorInput = document.getElementById('color');
const sizeInput = document.getElementById('size');
const eraserBtn = document.getElementById('eraser');
const undoBtn = document.getElementById('undo');
const clearBtn = document.getElementById('clear');
const saveBtn = document.getElementById('save');
const pipetteBtn = document.getElementById('pipette');
const cursorCanvas = document.getElementById('cursorCanvas');
const cursorCtx = cursorCanvas ? cursorCanvas.getContext('2d') : null;

let drawing = false;
let erasing = false;
let pipetting = false;
let last = {x:0,y:0};
const undoStack = [];
const MAX_UNDO = 30;

// stroke history for vector redraw (prevents blurring on resize)
let strokes = [];
let currentStroke = null;
let cursorPos = null;

function resizeCanvas(){
  const ratio = window.devicePixelRatio || 1;
  const w = Math.max(1, Math.floor(canvas.clientWidth));
  const h = Math.max(1, Math.floor(canvas.clientHeight));

  // set actual backing store size for high-DPI
  canvas.width = Math.max(1, Math.floor(w * ratio));
  canvas.height = Math.max(1, Math.floor(h * ratio));
  canvas.style.width = w + 'px';
  canvas.style.height = h + 'px';

  // reset transform for drawing in CSS pixels
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);

  // resize cursor overlay to match backing store
  if (cursorCanvas && cursorCtx){
    cursorCanvas.width = canvas.width;
    cursorCanvas.height = canvas.height;
    cursorCanvas.style.width = w + 'px';
    cursorCanvas.style.height = h + 'px';
    cursorCtx.setTransform(ratio, 0, 0, ratio, 0, 0);
    cursorCtx.clearRect(0,0,cursorCanvas.width,cursorCanvas.height);
    if (cursorPos && !pipetting) drawCursorAt(cursorPos.x, cursorPos.y);
  }

  // redraw vector strokes at the new size to keep them crisp
  redrawAll();
  ctx.lineCap = 'round';
}

function pushUndo(){
  try{
    if (undoStack.length >= MAX_UNDO) undoStack.shift();
    // save snapshot of strokes
    undoStack.push(JSON.stringify(strokes));
  }catch(e){}
}

function restoreFromDataURL(url){
  const img = new Image();
  img.onload = () => { ctx.clearRect(0,0,canvas.width,canvas.height); ctx.drawImage(img,0,0,canvas.width,canvas.height); };
  img.src = url;
}

function redrawAll(){
  const ratio = window.devicePixelRatio || 1;
  // reset transform and clear full backing store
  ctx.setTransform(1,0,0,1,0,0);
  ctx.clearRect(0,0,canvas.width,canvas.height);
  // set transform for drawing in CSS pixels
  ctx.setTransform(ratio,0,0,ratio,0,0);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  for (const s of strokes){
    if (!s.points || s.points.length === 0) continue;
    if (s.points.length === 1){
      const p = s.points[0];
      ctx.beginPath();
      ctx.globalCompositeOperation = s.erasing ? 'destination-out' : 'source-over';
      if (s.erasing){
        ctx.arc(p.x, p.y, s.size/2, 0, Math.PI*2);
        ctx.fill();
      }else{
        ctx.fillStyle = s.color;
        ctx.arc(p.x, p.y, s.size/2, 0, Math.PI*2);
        ctx.fill();
      }
    }else{
      ctx.beginPath();
      ctx.strokeStyle = s.color;
      ctx.lineWidth = s.size;
      ctx.globalCompositeOperation = s.erasing ? 'destination-out' : 'source-over';
      ctx.moveTo(s.points[0].x, s.points[0].y);
      for (let i=1;i<s.points.length;i++) ctx.lineTo(s.points[i].x, s.points[i].y);
      ctx.stroke();
    }
  }
  // restore default composite
  ctx.globalCompositeOperation = 'source-over';
}

function getPos(e){
  const rect = canvas.getBoundingClientRect();
  return { x: e.clientX - rect.left, y: e.clientY - rect.top };
}

function pointerDown(e){
  e.preventDefault();
  // if pipette mode: pick color and exit
  if (pipetting){
    pickColorFromEvent(e);
    pipetting = false;
    pipetteBtn && (pipetteBtn.style.background = '');
    canvas.classList.remove('pipette');
    return;
  }
  pushUndo();
  drawing = true;
  last = getPos(e);
  // start a new stroke (vector)
  currentStroke = {
    color: colorInput.value,
    size: parseInt(sizeInput.value,10),
    erasing: !!erasing,
    points: [ last ]
  };
  // begin path for immediate feedback
  ctx.beginPath();
  ctx.globalCompositeOperation = currentStroke.erasing ? 'destination-out' : 'source-over';
  ctx.strokeStyle = currentStroke.color;
  ctx.lineWidth = currentStroke.size;
  ctx.moveTo(last.x, last.y);
  // draw a dot immediately so a click without move places a point
  try{
    ctx.beginPath();
    if (currentStroke.erasing) ctx.globalCompositeOperation = 'destination-out';
    ctx.fillStyle = currentStroke.color;
    ctx.arc(last.x, last.y, currentStroke.size / 2, 0, Math.PI * 2);
    ctx.fill();
    // restore stroke composite for following segments
    ctx.globalCompositeOperation = currentStroke.erasing ? 'destination-out' : 'source-over';
  }catch(e){ }
}

function pointerMove(e){
  // kept for compatibility but replaced by handlePointerMove
}

function handlePointerMove(e){
  // always update cursor position
  const p = getPos(e);
  cursorPos = p;
  // drawing logic (if active)
  if (drawing && currentStroke){
    currentStroke.points.push(p);
    ctx.lineWidth = currentStroke.size;
    ctx.globalCompositeOperation = currentStroke.erasing ? 'destination-out' : 'source-over';
    ctx.strokeStyle = currentStroke.erasing ? 'rgba(0,0,0,1)' : currentStroke.color;
    ctx.beginPath();
    ctx.moveTo(last.x, last.y);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    last = p;
  }

  // draw cursor if available and not pipetting
  if (cursorCtx){
    if (pipetting){
      cursorCanvas.classList.add('hidden');
    }else{
      cursorCanvas.classList.remove('hidden');
      drawCursorAt(p.x, p.y);
    }
  }
}

function drawCursorAt(x,y){
  if (!cursorCtx) return;
  cursorCtx.clearRect(0,0,cursorCanvas.width,cursorCanvas.height);
  const size = parseInt(sizeInput.value,10) || 1;
  const r = size / 2;
  cursorCtx.beginPath();
  cursorCtx.strokeStyle = 'rgba(0,0,0,0.7)';
  cursorCtx.lineWidth = 2;
  cursorCtx.arc(x, y, r + 0.5, 0, Math.PI * 2);
  cursorCtx.stroke();
  cursorCtx.beginPath();
  cursorCtx.strokeStyle = 'rgba(255,255,255,0.9)';
  cursorCtx.lineWidth = 1;
  cursorCtx.arc(x, y, Math.max(0, r - 1), 0, Math.PI * 2);
  cursorCtx.stroke();
}

function clearCursor(){ if (cursorCtx) cursorCtx.clearRect(0,0,cursorCanvas.width,cursorCanvas.height); }

function pointerUp(e){
  drawing = false;
  try{ canvas.releasePointerCapture(e.pointerId); }catch(err){}
  if (currentStroke){
    strokes.push(currentStroke);
    currentStroke = null;
  }
}

function setup(){
  // initial sizing
  canvas.style.width = '100%';
  canvas.style.height = (window.innerHeight - document.querySelector('.toolbar').offsetHeight) + 'px';
  resizeCanvas();

  window.addEventListener('resize', ()=>{ canvas.style.height = (window.innerHeight - document.querySelector('.toolbar').offsetHeight) + 'px'; resizeCanvas(); });

  canvas.addEventListener('pointerdown', pointerDown);
  canvas.addEventListener('pointermove', handlePointerMove);
  canvas.addEventListener('pointerenter', e=>{
    if (!pipetting){ cursorCanvas && cursorCanvas.classList.remove('hidden'); canvas.style.cursor = 'none'; }
  });
  canvas.addEventListener('pointerleave', e=>{ clearCursor(); cursorCanvas && cursorCanvas.classList.add('hidden'); canvas.style.cursor = ''; });
  window.addEventListener('pointerup', pointerUp);

  eraserBtn.addEventListener('click', ()=>{ erasing = !erasing; eraserBtn.style.background = erasing ? '#ddd' : ''; });
  pipetteBtn && pipetteBtn.addEventListener('click', ()=>{ pipetting = !pipetting; pipetteBtn.style.background = pipetting ? '#ddd' : ''; canvas.classList.toggle('pipette', pipetting); });
  clearBtn.addEventListener('click', ()=>{ pushUndo(); strokes = []; redrawAll(); });
  sizeInput.addEventListener('input', ()=>{ if (cursorPos && cursorCtx && !pipetting) drawCursorAt(cursorPos.x, cursorPos.y); });
  saveBtn.addEventListener('click', ()=>{
    if (typeof isCanvasBlank === 'function' && isCanvasBlank()){
      showToast('Пустая картинка не сохранена');
      return;
    }
    const link = document.createElement('a');
    link.download = 'drawing.png';
    link.href = canvas.toDataURL('image/png');
    link.click();
  });
  undoBtn.addEventListener('click', ()=>{
    if (!undoStack.length) return;
    const snap = undoStack.pop();
    if (typeof snap === 'string' && snap.startsWith('data:')){
      // legacy raster undo
      restoreFromDataURL(snap);
    }else{
      try{ strokes = JSON.parse(snap || '[]'); }catch(e){ strokes = []; }
      redrawAll();
    }
  });

  // prevent context menu on canvas
  canvas.addEventListener('contextmenu', e=>e.preventDefault());
}

document.addEventListener('DOMContentLoaded', setup);

// ---------------- Gallery: save / load / persist ----------------
const saveGalleryBtn = document.getElementById('saveGallery');
const openGalleryBtn = document.getElementById('openGallery');
const galleryPanel = document.getElementById('galleryPanel');
const galleryItems = document.getElementById('galleryItems');
const closeGalleryBtn = document.getElementById('closeGallery');
const clearGalleryBtn = document.getElementById('clearGallery');

const GALLERY_KEY = 'drawapp_gallery_v1';
let gallery = [];

const toastEl = document.getElementById('toast');

function showToast(msg, ms = 1500){
  if (!toastEl) return;
  toastEl.textContent = msg;
  toastEl.classList.remove('hidden');
  setTimeout(()=>{ toastEl.classList.add('hidden'); }, ms);
}

function loadGallery(){
  try{
    const raw = localStorage.getItem(GALLERY_KEY);
    gallery = raw ? JSON.parse(raw) : [];
  }catch(e){ gallery = []; }
}

function saveGallery(){
  try{ localStorage.setItem(GALLERY_KEY, JSON.stringify(gallery)); }catch(e){}
}

function renderGallery(){
  galleryItems.innerHTML = '';
  if (!gallery.length){ galleryItems.innerHTML = '<div style="padding:8px;color:#666">Пусто</div>'; return; }
  gallery.forEach((dataUrl, idx)=>{
    const item = document.createElement('div'); item.className='item';
    const img = document.createElement('img'); img.src = dataUrl; img.title = 'Нажмите для загрузки';
    img.addEventListener('click', ()=>{ restoreFromDataURL(dataUrl); galleryPanel.classList.add('hidden'); });
    const del = document.createElement('button'); del.textContent = 'Удалить';
    del.addEventListener('click', ()=>{ gallery.splice(idx,1); saveGallery(); renderGallery(); });
    const dl = document.createElement('button'); dl.textContent = 'Скачать'; dl.style.marginLeft='4px';
    dl.addEventListener('click', ()=>{ const a=document.createElement('a'); a.href=dataUrl; a.download='drawing.png'; a.click(); });
    item.appendChild(img);
    const controls = document.createElement('div'); controls.style.display='flex'; controls.appendChild(del); controls.appendChild(dl);
    item.appendChild(controls);
    galleryItems.appendChild(item);
  });
}

function addToGallery(){
  try{
    // prevent saving an empty/blank canvas
    if (isCanvasBlank()){
      showToast('Пустая картинка не сохранена');
      return;
    }
    const url = canvas.toDataURL('image/png');
    gallery.unshift(url);
    if (gallery.length > 100) gallery.pop();
    saveGallery();
    renderGallery();
    showToast('Сохранено в галерею');
  }catch(e){ console.error('save gallery failed', e); }
}

// ----------------- Pipette helpers -----------------
function pickColorFromEvent(e){
  const rect = canvas.getBoundingClientRect();
  const factorX = canvas.width / rect.width;
  const factorY = canvas.height / rect.height;
  const x = Math.floor((e.clientX - rect.left) * factorX);
  const y = Math.floor((e.clientY - rect.top) * factorY);
  try{
    const d = ctx.getImageData(x, y, 1, 1).data;
    const r = d[0], g = d[1], b = d[2], a = d[3];
    if (a === 0) { showToast('Прозрачная область'); return; }
    const hex = rgbToHex(r,g,b);
    colorInput.value = hex;
    showToast('Цвет выбран: ' + hex);
  }catch(err){ console.error('pipette failed', err); }
}

function componentToHex(c) { const hex = c.toString(16); return hex.length == 1 ? '0' + hex : hex; }
function rgbToHex(r,g,b){ return '#' + componentToHex(r) + componentToHex(g) + componentToHex(b); }

function isCanvasBlank(){
  try{
    const w = canvas.width;
    const h = canvas.height;
    if (w === 0 || h === 0) return true;
    const data = ctx.getImageData(0,0,w,h).data;
    for (let i = 3; i < data.length; i += 4){
      if (data[i] !== 0) return false; // alpha channel not zero => drawn
    }
    return true;
  }catch(e){ return false; }
}

openGalleryBtn && openGalleryBtn.addEventListener('click', ()=>{ loadGallery(); renderGallery(); galleryPanel.classList.remove('hidden'); });
saveGalleryBtn && saveGalleryBtn.addEventListener('click', ()=>{ addToGallery(); });
closeGalleryBtn && closeGalleryBtn.addEventListener('click', ()=>{ galleryPanel.classList.add('hidden'); });
clearGalleryBtn && clearGalleryBtn.addEventListener('click', ()=>{ if (!confirm('Очистить галерею?')) return; gallery=[]; saveGallery(); renderGallery(); });

// preload gallery on load
loadGallery();

