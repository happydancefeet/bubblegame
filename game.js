/* Bubble Lab: Protein Scoop - Vanilla JS */

const state = {
  screen: 'costume',
  costumes: [],
  selectedCostumeId: null,
  score: 0,
  threshold: 20, // can be tuned later or derived from difficulty
  timeLeftMs: 60_000,
  timerId: null,
  zoom: 1,
};

// Costume definitions
const MOLECULE_HEADS = ['⭐️ Gold', '🍭 Sugar', '🧲 Magnet', '⚡ Zapper'];
const COSTUMES = [
  { id: 'short-gold', length: 40, head: '⭐️ Gold', color: '#ffd166' },
  { id: 'medium-sugar', length: 70, head: '🍭 Sugar', color: '#ef476f' },
  { id: 'long-magnet', length: 110, head: '🧲 Magnet', color: '#06d6a0' },
  { id: 'xl-zapper', length: 150, head: '⚡ Zapper', color: '#118ab2' },
  { id: 'short-zapper', length: 50, head: '⚡ Zapper', color: '#5e60ce' },
  { id: 'medium-gold', length: 80, head: '⭐️ Gold', color: '#f4a261' },
];

// DOM
const el = {
  screens: {
    costume: document.getElementById('screen-costume'),
    game: document.getElementById('screen-game'),
    results: document.getElementById('screen-results'),
  },
  costumeList: document.getElementById('costume-list'),
  btnStart: document.getElementById('btn-start'),
  btnRestart: document.getElementById('btn-restart'),
  btnPlayAgain: document.getElementById('btn-play-again'),
  btnChangeCostume: document.getElementById('btn-change-costume'),
  btnHowTo: document.getElementById('btn-howto'),
  btnCloseHowTo: document.getElementById('btn-close-howto'),
  previewCanvas: document.getElementById('preview-canvas'),
  gameCanvas: document.getElementById('game-canvas'),
  timer: document.getElementById('timer'),
  count: document.getElementById('count'),
  zoomIn: document.getElementById('zoom-in'),
  zoomOut: document.getElementById('zoom-out'),
  zoomLevel: document.getElementById('zoom-level'),
  scientist: document.getElementById('scientist'),
  finalScore: document.getElementById('final-score'),
  threshold: document.getElementById('threshold'),
  resultMessage: document.getElementById('result-message'),
  resultFace: document.getElementById('result-scientist-face'),
  resultScientist: document.getElementById('result-scientist'),
  modalHowTo: document.getElementById('modal-howto'),
};

// Utils
function clamp(value, min, max) { return Math.max(min, Math.min(max, value)); }
function formatTime(ms) {
  const seconds = Math.ceil(ms / 1000);
  const m = String(Math.floor(seconds / 60)).padStart(2, '0');
  const s = String(seconds % 60).padStart(2, '0');
  return `${m}:${s}`;
}

// Screen switching
function showScreen(name) {
  state.screen = name;
  for (const [key, sec] of Object.entries(el.screens)) {
    sec.classList.toggle('active', key === name);
  }
}

// Costume selection UI
function renderCostumes() {
  el.costumeList.innerHTML = '';
  COSTUMES.forEach((c) => {
    const card = document.createElement('button');
    card.className = 'costume-card';
    card.setAttribute('type', 'button');
    card.dataset.id = c.id;
    card.innerHTML = `
      <div class="costume-illustration">
        <svg width="120" height="60" viewBox="0 0 120 60" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
          <defs>
            <linearGradient id="g${c.id}" x1="0" y1="0" x2="120" y2="0">
              <stop offset="0%" stop-color="${c.color}" />
              <stop offset="100%" stop-color="#ffffff" />
            </linearGradient>
          </defs>
          <circle cx="20" cy="30" r="12" fill="#bdefff" stroke="#7ad0ff" stroke-width="3" />
          <rect x="40" y="28" rx="3" ry="3" width="${clamp(c.length, 30, 150)}" height="6" fill="url(#g${c.id})" />
          <text x="${clamp(40 + c.length + 10, 55, 110)}" y="34" font-size="14">${c.head.split(' ')[0]}</text>
        </svg>
      </div>
      <div class="costume-head">${c.head}</div>
      <div class="costume-meta">Length: ${c.length}</div>
    `;
    card.addEventListener('click', () => selectCostume(c.id));
    el.costumeList.appendChild(card);
  });
}

function selectCostume(id) {
  state.selectedCostumeId = id;
  Array.from(el.costumeList.children).forEach((child) => {
    child.classList.toggle('selected', child.dataset.id === id);
  });
  el.btnStart.disabled = false;
  drawPreview();
}

// Preview rendering
function drawPreview() {
  const ctx = el.previewCanvas.getContext('2d');
  const dpr = window.devicePixelRatio || 1;
  const size = 320;
  el.previewCanvas.width = size * dpr;
  el.previewCanvas.height = size * dpr;
  ctx.scale(dpr, dpr);
  ctx.clearRect(0, 0, size, size);
  // bubble
  ctx.save();
  ctx.translate(size / 2, size / 2);
  const bubbleR = 80;
  const gradient = ctx.createRadialGradient(-20, -20, 10, 0, 0, bubbleR);
  gradient.addColorStop(0, '#ffffff');
  gradient.addColorStop(1, '#bdefff');
  ctx.fillStyle = gradient;
  ctx.strokeStyle = '#7ad0ff';
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.arc(0, 0, bubbleR, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  // costume
  const costume = COSTUMES.find(c => c.id === state.selectedCostumeId) || COSTUMES[0];
  ctx.strokeStyle = costume.color;
  ctx.lineWidth = 8;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(-40, 0);
  ctx.lineTo(-40 + clamp(costume.length / 2, 20, 120), 0);
  ctx.stroke();
  ctx.restore();
}

// Game world
const world = {
  width: 2000,
  height: 1200,
  proteins: [],
  dropZone: { x: 0, y: 0, width: 9999, height: 120 }, // top strip
  bubble: { x: 200, y: 400, r: 40, vx: 0, vy: 0 },
  dragging: false,
  camera: { x: 0, y: 0 },
};

function seedProteins() {
  world.proteins = [];
  const num = 120;
  for (let i = 0; i < num; i++) {
    world.proteins.push({
      id: i,
      x: Math.random() * world.width,
      y: 200 + Math.random() * (world.height - 250), // avoid immediate drop zone spawn
      r: 8 + Math.random() * 6,
      collected: false,
    });
  }
}

function startGame() {
  state.score = 0;
  state.timeLeftMs = 60_000;
  state.zoom = 1;
  updateZoomLabel();
  seedProteins();
  // place bubble near bottom-left
  world.bubble.x = 180; world.bubble.y = world.height - 220;
  world.camera.x = 0; world.camera.y = 0;
  el.count.textContent = '0';
  el.resultMessage.classList.remove('good', 'bad');
  el.resultScientist && el.resultScientist.classList.remove('jump');

  showScreen('game');
  el.scientist.setAttribute('aria-hidden', 'false');
  setScientistEmotion('neutral');

  if (state.timerId) clearInterval(state.timerId);
  el.timer.textContent = formatTime(state.timeLeftMs);
  state.timerId = setInterval(() => {
    state.timeLeftMs -= 1000;
    if (state.timeLeftMs <= 0) {
      state.timeLeftMs = 0;
      el.timer.textContent = formatTime(state.timeLeftMs);
      clearInterval(state.timerId);
      endGame();
    } else {
      el.timer.textContent = formatTime(state.timeLeftMs);
    }
  }, 1000);
}

function endGame() {
  cancelAnimationFrame(animationHandle);
  showResults();
}

// Zoom
function updateZoomLabel() {
  el.zoomLevel.textContent = `${Math.round(state.zoom * 100)}%`;
}
function zoomBy(delta) {
  const prev = state.zoom;
  state.zoom = clamp(state.zoom + delta, 0.5, 2.5);
  if (state.zoom !== prev) updateZoomLabel();
}

// Scientist
function setScientistEmotion(kind) {
  el.scientist.classList.remove('happy', 'sad', 'neutral', 'jump');
  el.scientist.classList.add(kind);
  const face = el.scientist.querySelector('.face');
  if (kind === 'happy') face.textContent = '😄';
  else if (kind === 'sad') face.textContent = '😢';
  else face.textContent = '🙂';
}

// Canvas rendering and interaction
const ctx = el.gameCanvas.getContext('2d');
let animationHandle = 0;
let lastTs = 0;

function toScreen(x, y) {
  return {
    x: (x - world.camera.x) * state.zoom,
    y: (y - world.camera.y) * state.zoom,
  };
}
function toWorld(x, y) {
  return {
    x: x / state.zoom + world.camera.x,
    y: y / state.zoom + world.camera.y,
  };
}

function getCanvasCssSize() {
  const dpr = window.devicePixelRatio || 1;
  return { width: el.gameCanvas.width / dpr, height: el.gameCanvas.height / dpr };
}

function draw() {
  const dpr = window.devicePixelRatio || 1;
  const { width, height } = getCanvasCssSize();
  ctx.clearRect(0, 0, width, height);

  // tube background stripes
  const stripeH = 80 * state.zoom;
  for (let y = 0; y < height; y += stripeH) {
    ctx.fillStyle = (Math.floor(y / stripeH) % 2 === 0) ? 'rgba(255,255,255,0.8)' : 'rgba(255,255,255,0.6)';
    ctx.fillRect(0, y, width, stripeH);
  }

  // drop zone
  ctx.save();
  ctx.fillStyle = 'rgba(92,195,255,0.25)';
  ctx.fillRect(0, 0, width, 120 * state.zoom);
  ctx.restore();

  // proteins
  for (const p of world.proteins) {
    if (p.collected) continue;
    const s = toScreen(p.x, p.y);
    if (s.x < -50 || s.x > width + 50 || s.y < -50 || s.y > height + 50) continue;
    const r = p.r * state.zoom;
    ctx.beginPath();
    ctx.fillStyle = '#ffce56';
    ctx.strokeStyle = '#d9a400';
    ctx.lineWidth = 2;
    ctx.arc(s.x, s.y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }

  // bubble
  const b = world.bubble;
  const bs = toScreen(b.x, b.y);
  const br = b.r * state.zoom;
  const grad = ctx.createRadialGradient(bs.x - br/2, bs.y - br/2, br*0.2, bs.x, bs.y, br);
  grad.addColorStop(0, '#ffffff');
  grad.addColorStop(1, '#bdefff');
  ctx.fillStyle = grad;
  ctx.strokeStyle = '#7ad0ff';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.arc(bs.x, bs.y, br, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  // costume line sticking out
  const costume = COSTUMES.find(c => c.id === state.selectedCostumeId) || COSTUMES[0];
  ctx.strokeStyle = costume.color;
  ctx.lineWidth = Math.max(2, 4 * state.zoom);
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(bs.x - br * 0.6, bs.y);
  const lineLength = clamp(costume.length, 30, 200) * state.zoom;
  ctx.lineTo(bs.x - br * 0.6 - lineLength, bs.y);
  ctx.stroke();
}

function update(dt) {
  // collision and collection
  const b = world.bubble;
  for (const p of world.proteins) {
    if (p.collected) continue;
    const dx = p.x - b.x;
    const dy = p.y - b.y;
    const dist2 = dx*dx + dy*dy;
    const reach = b.r + 16; // bubble suction radius
    if (dist2 < reach * reach) {
      // move protein towards bubble
      p.x += dx * 0.15;
      p.y += dy * 0.15;
    }
    // collected if moved into drop zone
    if (!p.collected && p.y < world.dropZone.height) {
      p.collected = true;
      state.score += 1;
      el.count.textContent = String(state.score);
      // quick scientist feedback
      setScientistEmotion('happy');
      window.clearTimeout(update.scientistTimeout);
      update.scientistTimeout = window.setTimeout(() => setScientistEmotion('neutral'), 500);
    }
  }

  // camera follows bubble softly
  const { width, height } = getCanvasCssSize();
  world.camera.x += (b.x - world.camera.x - width / (2 * state.zoom)) * 0.05;
  world.camera.y += (b.y - world.camera.y - height / (2 * state.zoom)) * 0.05;
  world.camera.x = clamp(world.camera.x, 0, world.width - width / state.zoom);
  world.camera.y = clamp(world.camera.y, 0, world.height - height / state.zoom);
}

function loop(ts) {
  if (!lastTs) lastTs = ts;
  const dt = Math.min(33, ts - lastTs);
  lastTs = ts;
  update(dt);
  draw();
  animationHandle = requestAnimationFrame(loop);
}

// Pointer interactions
function getCanvasPointer(evt) {
  const rect = el.gameCanvas.getBoundingClientRect();
  const x = (evt.clientX - rect.left);
  const y = (evt.clientY - rect.top);
  return { x, y };
}

function onPointerDown(evt) {
  const pos = getCanvasPointer(evt);
  const worldPos = toWorld(pos.x, pos.y);
  const dx = worldPos.x - world.bubble.x;
  const dy = worldPos.y - world.bubble.y;
  const r = world.bubble.r;
  if (dx*dx + dy*dy < r*r*1.2) {
    world.dragging = true;
  }
}
function onPointerMove(evt) {
  if (!world.dragging) return;
  const pos = getCanvasPointer(evt);
  const w = toWorld(pos.x, pos.y);
  world.bubble.x = clamp(w.x, world.bubble.r, world.width - world.bubble.r);
  world.bubble.y = clamp(w.y, world.bubble.r, world.height - world.bubble.r);
}
function onPointerUp() { world.dragging = false; }

// Resize handling for crisp canvas
function resizeCanvas() {
  const dpr = window.devicePixelRatio || 1;
  const cssWidth = el.gameCanvas.clientWidth;
  const cssHeight = Math.round(cssWidth * 2/3);
  el.gameCanvas.style.height = cssHeight + 'px';
  el.gameCanvas.width = Math.round(cssWidth * dpr);
  el.gameCanvas.height = Math.round(cssHeight * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

// Results screen
function showResults() {
  showScreen('results');
  el.finalScore.textContent = String(state.score);
  el.threshold.textContent = String(state.threshold);
  let message = '';
  el.resultMessage.classList.remove('good', 'bad');
  el.resultScientist && el.resultScientist.classList.remove('jump');
  if (state.score >= state.threshold * 3) {
    message = 'Phenomenal! Triple detection!';
    el.resultFace.textContent = '🤩';
    el.resultMessage.classList.add('good');
    el.resultScientist && el.resultScientist.classList.add('jump');
  } else if (state.score >= state.threshold) {
    message = 'Success! The instrument detects the protein!';
    el.resultFace.textContent = '😄';
    el.resultMessage.classList.add('good');
  } else {
    message = "Oh no! Not enough proteins detected.";
    el.resultFace.textContent = '😢';
    el.resultMessage.classList.add('bad');
  }
  el.resultMessage.textContent = message;
}

// Event wiring
function wireUI() {
  renderCostumes();
  drawPreview();

  el.btnStart.addEventListener('click', () => {
    startGame();
    resizeCanvas();
    cancelAnimationFrame(animationHandle);
    lastTs = 0; animationHandle = requestAnimationFrame(loop);
  });

  el.btnRestart.addEventListener('click', () => {
    startGame();
    resizeCanvas();
    cancelAnimationFrame(animationHandle);
    lastTs = 0; animationHandle = requestAnimationFrame(loop);
  });

  el.btnPlayAgain.addEventListener('click', () => {
    showScreen('costume');
    setScientistEmotion('neutral');
  });
  el.btnChangeCostume.addEventListener('click', () => {
    showScreen('costume');
    setScientistEmotion('neutral');
  });

  // how to modal
  el.btnHowTo.addEventListener('click', () => el.modalHowTo.classList.remove('hidden'));
  el.btnCloseHowTo.addEventListener('click', () => el.modalHowTo.classList.add('hidden'));

  // zoom
  el.zoomIn.addEventListener('click', () => zoomBy(0.25));
  el.zoomOut.addEventListener('click', () => zoomBy(-0.25));

  // canvas interactions
  el.gameCanvas.addEventListener('pointerdown', onPointerDown);
  window.addEventListener('pointermove', onPointerMove);
  window.addEventListener('pointerup', onPointerUp);

  window.addEventListener('resize', resizeCanvas);
  resizeCanvas();
}

// Initialize
wireUI();
showScreen('costume');