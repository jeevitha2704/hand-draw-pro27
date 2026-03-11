// Demo mode for static deployment
class DemoMode {
  constructor() {
    this.engine = null;
    this.ui = null;
    this.init();
  }

  init() {
    // Initialize UI
    this.ui = {
      cursor: document.getElementById('cursor'),
      modeLabel: document.getElementById('mode-label'),
      modeDot: document.getElementById('mode-dot'),
      loader: document.getElementById('loader'),
      app: document.getElementById('app'),
      loaderStatus: document.getElementById('loader-status'),
      loaderFill: document.getElementById('loader-fill')
    };

    // Initialize drawing engine
    this.engine = new DrawingEngine();

    // Setup event listeners
    this.setupEventListeners();

    // Simulate loading
    this.simulateLoading();
  }

  setupEventListeners() {
    // Color swatches
    document.querySelectorAll('.swatch').forEach(swatch => {
      swatch.addEventListener('click', () => {
        document.querySelectorAll('.swatch').forEach(s => s.classList.remove('active'));
        swatch.classList.add('active');
        this.engine.setColor(swatch.dataset.color);
      });
    });

    // Brush size
    const brushSize = document.getElementById('brush-size');
    const sizeLabel = document.querySelector('.size-label');
    brushSize.addEventListener('input', () => {
      this.engine.setBrushSize(brushSize.value);
      sizeLabel.textContent = brushSize.value;
    });

    // Line types
    document.querySelectorAll('.line-type').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.line-type').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.engine.setLineType(btn.dataset.line);
      });
    });

    // Undo/Clear
    document.getElementById('undo-btn').addEventListener('click', () => this.engine.undo());
    document.getElementById('clear-btn').addEventListener('click', () => this.engine.clear());

    // Mouse drawing for demo
    this.setupMouseDrawing();
  }

  setupMouseDrawing() {
    const drawCanvas = document.getElementById('draw-canvas');
    let isDrawing = false;

    drawCanvas.addEventListener('mousedown', (e) => {
      isDrawing = true;
      const rect = drawCanvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      this.engine.beginStroke();
      this.engine.addPoint(x, y);
    });

    drawCanvas.addEventListener('mousemove', (e) => {
      const rect = drawCanvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      
      if (isDrawing) {
        this.engine.addPoint(x, y);
      }
      
      // Update cursor
      this.ui.cursor.style.left = e.clientX + 'px';
      this.ui.cursor.style.top = e.clientY + 'px';
    });

    drawCanvas.addEventListener('mouseup', () => {
      isDrawing = false;
      this.engine.endStroke();
    });

    drawCanvas.addEventListener('mouseleave', () => {
      isDrawing = false;
      this.engine.endStroke();
    });
  }

  simulateLoading() {
    let progress = 0;
    const messages = [
      'Initializing demo interface...',
      'Loading drawing engine...',
      'Preparing canvas...',
      'Ready to draw!'
    ];

    const interval = setInterval(() => {
      progress += Math.random() * 20;
      if (progress >= 100) {
        progress = 100;
        clearInterval(interval);
        this.ui.loaderStatus.textContent = messages[3];
        setTimeout(() => this.showApp(), 500);
      } else {
        const msgIndex = Math.floor(progress / 25);
        this.ui.loaderStatus.textContent = messages[msgIndex];
      }
      this.ui.loaderFill.style.width = progress + '%';
    }, 200);
  }

  showApp() {
    this.ui.loader.classList.add('hidden');
    this.ui.app.classList.remove('hidden');
    this.ui.modeLabel.textContent = 'DEMO MODE';
    this.ui.modeDot.style.background = '#ff9800';
  }
}

// Initialize demo when page loads
window.addEventListener('DOMContentLoaded', () => {
  new DemoMode();
});
