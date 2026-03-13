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

    // Add hand tracking visualization
    const handCanvas = document.createElement('canvas');
    handCanvas.id = 'hand-canvas';
    handCanvas.style.position = 'absolute';
    handCanvas.style.top = '0';
    handCanvas.style.left = '0';
    handCanvas.style.pointerEvents = 'none';
    handCanvas.style.zIndex = '1';
    document.getElementById('stage').appendChild(handCanvas);
    
    const handCtx = handCanvas.getContext('2d');
    handCanvas.width = drawCanvas.width;
    handCanvas.height = drawCanvas.height;

    // Store latest landmarks for visualization
    handler.latestLandmarks = null;

    // Override gesture handler to store landmarks
    const originalHandle = handler._handle.bind(handler);
    handler._handle = function(data) {
      if (data.landmarks && data.landmarks.length > 0) {
        this.latestLandmarks = data.landmarks;
      } else {
        this.latestLandmarks = null;
      }
      originalHandle(data);
    };

    // Animation loop
    function loop() {
      requestAnimationFrame(loop);
      engine.tick();
      
      // Draw hand skeleton if landmarks are available
      if (handler.latestLandmarks) {
        handCtx.clearRect(0, 0, handCanvas.width, handCanvas.height);
        
        const landmarks = handler.latestLandmarks;
        const scaleX = handCanvas.width;
        const scaleY = handCanvas.height;
        
        // Draw connections (hand skeleton)
        handCtx.strokeStyle = 'rgba(192, 192, 192, 0.8)'; // Silver
        handCtx.lineWidth = 2;
        
        // Draw hand connections
        const connections = [
          [0,1], [1,2], [2,3], [3,4], // Thumb
          [0,5], [5,6], [6,7], [7,8], // Index
          [5,9], [9,10], [10,11], [11,12], // Middle
          [9,13], [13,14], [14,15], [15,16], // Ring
          [13,17], [17,18], [18,19], [19,20], // Pinky
          [0,17] // Palm
        ];
        
        connections.forEach(([start, end]) => {
          if (landmarks[start] && landmarks[end]) {
            handCtx.beginPath();
            handCtx.moveTo(landmarks[start].x * scaleX, landmarks[start].y * scaleY);
            handCtx.lineTo(landmarks[end].x * scaleX, landmarks[end].y * scaleY);
            handCtx.stroke();
          }
        });
        
        // Draw landmark points
        landmarks.forEach(landmark => {
          handCtx.fillStyle = 'white';
          handCtx.beginPath();
          handCtx.arc(landmark.x * scaleX, landmark.y * scaleY, 4, 0, Math.PI * 2);
          handCtx.fill();
          
          handCtx.strokeStyle = 'rgba(192, 192, 192, 0.6)'; // Silver outline
          handCtx.lineWidth = 1;
          handCtx.beginPath();
          handCtx.arc(landmark.x * scaleX, landmark.y * scaleY, 6, 0, Math.PI * 2);
          handCtx.stroke();
        });
      } else {
        handCtx.clearRect(0, 0, handCanvas.width, handCanvas.height);
      }
    }
    loop();

    // ── Toolbar ──────────────────────────────────────────────
    // Line type buttons
    document.querySelectorAll('.line-type').forEach(btn => {
      console.log('Found line type button:', btn);
      btn.addEventListener('click', () => {
        console.log('Line type clicked:', btn.dataset.line);
        document.querySelectorAll('.line-type').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        engine.setLineType(btn.dataset.line);
      });
    });

    // Colour swatches
    document.querySelectorAll('.swatch').forEach(btn => {
      console.log('Found color swatch:', btn);
      btn.addEventListener('click', () => {
        console.log('Color clicked:', btn.dataset.color);
        document.querySelectorAll('.swatch').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        engine.setColor(btn.dataset.color);
      });
    });

    // Brush size
    const sizeSlider = document.getElementById('brush-size');
    if (sizeSlider) {
      console.log('Found brush size slider');
      sizeSlider.addEventListener('input', () => {
        console.log('Brush size changed:', sizeSlider.value);
        engine.setBrushSize(Number(sizeSlider.value));
      });
    }

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
