/**
 * main.js — App entry point
 * Wires together DrawingEngine, GestureHandler, and UI
 */

// ── UI Controller ────────────────────────────────────────────────
class UIController {
  constructor() {
    this.modePill   = document.getElementById('mode-pill');
    this.modeLabel  = document.getElementById('mode-label');
    this.modeDot    = document.getElementById('mode-dot');
    this.cursor     = document.getElementById('finger-cursor');
    this.selRing    = document.getElementById('sel-ring');
    this.guideItems = document.querySelectorAll('.guide-item');
  }

  setMode(gesture) {
    const labels = {
      draw:  '☝️  DRAW MODE',
      pinch: '🤌  MOVE MODE',
      erase: '✌️  ERASE MODE',
      idle:  '🖐️  IDLE',
    };
    this.modePill.className  = `mode-pill ${gesture}`;
    this.modeLabel.textContent = labels[gesture] || 'SHOW YOUR HAND';

    this.guideItems.forEach(el => {
      el.classList.toggle('active', el.dataset.gesture === gesture);
    });
  }

  setCursor(visible, x = 0, y = 0, gesture = 'idle') {
    if (!visible) { this.cursor.style.display = 'none'; return; }
    this.cursor.style.display = 'block';
    this.cursor.style.left    = x + 'px';
    this.cursor.style.top     = y + 'px';
    this.cursor.className     = gesture;
  }

  setSelRing(bbox) {
    if (!bbox) { this.selRing.style.display = 'none'; return; }
    this.selRing.style.display = 'block';
    this.selRing.style.left    = bbox.x + 'px';
    this.selRing.style.top     = bbox.y + 'px';
    this.selRing.style.width   = bbox.w + 'px';
    this.selRing.style.height  = bbox.h + 'px';
  }
}

// ── Loader sequence ──────────────────────────────────────────────
function runLoader(onDone) {
  const fill      = document.getElementById('loader-fill');
  const statusTxt = document.getElementById('loader-status');
  const steps = [
    [10, 'Loading MediaPipe model…'],
    [35, 'Initialising Flask server…'],
    [60, 'Connecting camera stream…'],
    [85, 'Starting gesture engine…'],
    [100,'Ready! 🚀'],
  ];
  let i = 0;
  const next = () => {
    if (i >= steps.length) { setTimeout(onDone, 400); return; }
    const [pct, msg] = steps[i++];
    fill.style.width   = pct + '%';
    statusTxt.textContent = msg;
    setTimeout(next, 480);
  };
  next();
}

// ── Boot ─────────────────────────────────────────────────────────
window.addEventListener('DOMContentLoaded', () => {
  const loader     = document.getElementById('loader');
  const app        = document.getElementById('app');
  const drawCanvas = document.getElementById('draw-canvas');
  const fxCanvas   = document.getElementById('fx-canvas');

  runLoader(() => {
    loader.classList.add('fade-out');
    app.classList.remove('hidden');

    // Init engine + UI
    const ui     = new UIController();
    const engine = new DrawingEngine(drawCanvas, fxCanvas);
    const handler = new GestureHandler(engine, ui);

    // Animation loop
    function loop() {
      requestAnimationFrame(loop);
      engine.tick();
    }
    loop();

    // ── Toolbar ──────────────────────────────────────────────
    // Line type buttons
    document.querySelectorAll('.line-type').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.line-type').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        engine.setLineType(btn.dataset.line);
      });
    });

    // Colour swatches
    document.querySelectorAll('.swatch').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.swatch').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        engine.color = btn.dataset.color;
      });
    });

    // Brush size
    const sizeSlider = document.getElementById('brush-size');
    sizeSlider.addEventListener('input', () => {
      engine.brushSize = Number(sizeSlider.value);
    });

    // Undo
    document.getElementById('undo-btn').addEventListener('click', () => engine.undo());

    // Clear
    document.getElementById('clear-btn').addEventListener('click', () => {
      engine.clear();
      ui.setSelRing(null);
    });

    // Keyboard shortcuts
    document.addEventListener('keydown', e => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'z') engine.undo();
      if (e.key === 'Escape') engine.clear();
    });
  });
});
