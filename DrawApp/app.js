const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const colorInput = document.getElementById('color');
const sizeInput = document.getElementById('size');
const eraserBtn = document.getElementById('eraser');
const undoBtn = document.getElementById('undo');
const clearBtn = document.getElementById('clear');
const saveBtn = document.getElementById('save');

let drawing = false;
let erasing = false;
let last = {x:0,y:0};
const undoStack = [];
const MAX_UNDO = 30;

function resizeCanvas(){
  const ratio = window.devicePixelRatio || 1;
  const w = canvas.clientWidth;
  const h = canvas.clientHeight;
  const img = ctx.getImageData(0,0,canvas.width,canvas.height);
  canvas.width = Math.max(1, Math.floor(w * ratio));
  canvas.height = Math.max(1, Math.floor(h * ratio));
  canvas.style.width = w + 'px';
  canvas.style.height = h + 'px';
  ctx.scale(ratio, ratio);
  if (img.data){
    // best-effort restore (may be blank on first run)
    try{ ctx.putImageData(img,0,0); }catch(e){}
  }
  ctx.lineCap = 'round';
}

function pushUndo(){
  try{
    if (undoStack.length >= MAX_UNDO) undoStack.shift();
    undoStack.push(canvas.toDataURL());
  }catch(e){}
}

function restoreFromDataURL(url){
  const img = new Image();
  img.onload = () => { ctx.clearRect(0,0,canvas.width,canvas.height); ctx.drawImage(img,0,0,canvas.width,canvas.height); };
  img.src = url;
}

function getPos(e){
  const rect = canvas.getBoundingClientRect();
  return { x: e.clientX - rect.left, y: e.clientY - rect.top };
}

function pointerDown(e){
  e.preventDefault();
  canvas.setPointerCapture(e.pointerId);
  pushUndo();
  drawing = true;
  last = getPos(e);
  ctx.beginPath();
  ctx.moveTo(last.x, last.y);
}

function pointerMove(e){
  if (!drawing) return;
  const p = getPos(e);
  ctx.lineWidth = parseInt(sizeInput.value,10);
  ctx.globalCompositeOperation = erasing ? 'destination-out' : 'source-over';
  ctx.strokeStyle = erasing ? 'rgba(0,0,0,1)' : colorInput.value;
  ctx.beginPath();
  ctx.moveTo(last.x, last.y);
  ctx.lineTo(p.x, p.y);
  ctx.stroke();
  last = p;
}

function pointerUp(e){
  drawing = false;
  try{ canvas.releasePointerCapture(e.pointerId); }catch(err){}
}

function setup(){
  // initial sizing
  canvas.style.width = '100%';
  canvas.style.height = (window.innerHeight - document.querySelector('.toolbar').offsetHeight) + 'px';
  resizeCanvas();

  window.addEventListener('resize', ()=>{ canvas.style.height = (window.innerHeight - document.querySelector('.toolbar').offsetHeight) + 'px'; resizeCanvas(); });

  canvas.addEventListener('pointerdown', pointerDown);
  canvas.addEventListener('pointermove', pointerMove);
  window.addEventListener('pointerup', pointerUp);

  eraserBtn.addEventListener('click', ()=>{ erasing = !erasing; eraserBtn.style.background = erasing ? '#ddd' : ''; });
  clearBtn.addEventListener('click', ()=>{ pushUndo(); ctx.clearRect(0,0,canvas.width,canvas.height); });
  saveBtn.addEventListener('click', ()=>{
    const link = document.createElement('a');
    link.download = 'drawing.png';
    link.href = canvas.toDataURL('image/png');
    link.click();
  });
  undoBtn.addEventListener('click', ()=>{ if (!undoStack.length) return; const url = undoStack.pop(); restoreFromDataURL(url); });

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
    const url = canvas.toDataURL('image/png');
    gallery.unshift(url);
    if (gallery.length > 100) gallery.pop();
    saveGallery();
    renderGallery();
    galleryPanel.classList.remove('hidden');
  }catch(e){ console.error('save gallery failed', e); }
}

openGalleryBtn && openGalleryBtn.addEventListener('click', ()=>{ loadGallery(); renderGallery(); galleryPanel.classList.remove('hidden'); });
saveGalleryBtn && saveGalleryBtn.addEventListener('click', ()=>{ addToGallery(); });
closeGalleryBtn && closeGalleryBtn.addEventListener('click', ()=>{ galleryPanel.classList.add('hidden'); });
clearGalleryBtn && clearGalleryBtn.addEventListener('click', ()=>{ if (!confirm('Очистить галерею?')) return; gallery=[]; saveGallery(); renderGallery(); });

// preload gallery on load
loadGallery();

