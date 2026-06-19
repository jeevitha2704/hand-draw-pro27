/**
 * demo.js — In-browser hand tracking with MediaPipe Tasks Vision.
 * Runs entirely client-side using the visitor's webcam, so it works on
 * static/serverless hosts (e.g. Vercel). Falls back to mouse drawing if
 * the camera or model is unavailable.
 */

import {
  FilesetResolver,
  HandLandmarker,
} from "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/vision_bundle.mjs";

const WASM_URL =
  "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm";
const MODEL_URL =
  "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task";

// MediaPipe hand landmark connections for the skeleton overlay.
const HAND_CONNECTIONS = [
  [0, 1], [1, 2], [2, 3], [3, 4],
  [0, 5], [5, 6], [6, 7], [7, 8],
  [5, 9], [9, 10], [10, 11], [11, 12],
  [9, 13], [13, 14], [14, 15], [15, 16],
  [13, 17], [17, 18], [18, 19], [19, 20],
  [0, 17],
];

const PINCH_THRESHOLD = 0.07;

function fingerUp(lm, tip, pip) {
  return lm[tip].y < lm[pip].y;
}

function dist(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

// Port of gesture.py classification.
function classify(lm) {
  const indexUp = fingerUp(lm, 8, 6);
  const middleUp = fingerUp(lm, 12, 10);
  const ringUp = fingerUp(lm, 16, 14);
  const pinkyUp = fingerUp(lm, 20, 18);
  const isPinch = dist(lm[8], lm[4]) < PINCH_THRESHOLD;

  if (isPinch && !middleUp && !ringUp && !pinkyUp) return "pinch";
  if (indexUp && middleUp && !ringUp && !pinkyUp) return "erase";
  if (indexUp && !middleUp && !ringUp && !pinkyUp) return "draw";
  return "idle";
}

class HandDrawApp {
  constructor() {
    this.ui = {
      loader: document.getElementById("loader"),
      loaderFill: document.getElementById("loader-fill"),
      loaderStatus: document.getElementById("loader-status"),
      app: document.getElementById("app"),
      modePill: document.getElementById("mode-pill"),
      modeLabel: document.getElementById("mode-label"),
      cursor: document.getElementById("finger-cursor"),
      selRing: document.getElementById("sel-ring"),
      notice: document.getElementById("status-notice"),
      camPreview: document.getElementById("cam-preview"),
      video: document.getElementById("cam-video"),
      overlay: document.getElementById("cam-overlay"),
    };

    this.engine = new DrawingEngine(
      document.getElementById("draw-canvas"),
      document.getElementById("fx-canvas")
    );

    // Smoothing + gesture state.
    this.sx = null;
    this.sy = null;
    this.ALPHA = 0.4;
    this.drawActive = false;
    this.pinchActive = false;
    this.selectedIdx = -1;
    this.movePrevX = null;
    this.movePrevY = null;
    this._gapTimer = null;
    this.lastVideoTime = -1;
    this.lastResult = null;

    this.setupToolbar();
    this.start();
  }

  setLoader(pct, msg) {
    this.ui.loaderFill.style.width = pct + "%";
    if (msg) this.ui.loaderStatus.textContent = msg;
  }

  setupToolbar() {
    document.querySelectorAll(".swatch").forEach((sw) => {
      sw.addEventListener("click", () => {
        document
          .querySelectorAll(".swatch")
          .forEach((s) => s.classList.remove("active"));
        sw.classList.add("active");
        this.engine.color = sw.dataset.color;
      });
    });

    const brush = document.getElementById("brush-size");
    const sizeLabel = document.querySelector(".size-label");
    brush.addEventListener("input", () => {
      this.engine.brushSize = Number(brush.value);
      sizeLabel.textContent = brush.value;
    });

    document.querySelectorAll(".line-type").forEach((btn) => {
      btn.addEventListener("click", () => {
        document
          .querySelectorAll(".line-type")
          .forEach((b) => b.classList.remove("active"));
        btn.classList.add("active");
        this.engine.setLineType(btn.dataset.line);
      });
    });

    document
      .getElementById("undo-btn")
      .addEventListener("click", () => this.engine.undo());
    document.getElementById("clear-btn").addEventListener("click", () => {
      this.engine.clear();
      this.setSelRing(null);
    });

    document.addEventListener("keydown", (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "z") this.engine.undo();
      if (e.key === "Escape") {
        this.engine.clear();
        this.setSelRing(null);
      }
    });
  }

  async start() {
    this.setLoader(10, "Loading hand-tracking model…");
    try {
      const vision = await FilesetResolver.forVisionTasks(WASM_URL);
      this.landmarker = await HandLandmarker.createFromOptions(vision, {
        baseOptions: { modelAssetPath: MODEL_URL, delegate: "GPU" },
        runningMode: "VIDEO",
        numHands: 1,
        minHandDetectionConfidence: 0.4,
        minHandPresenceConfidence: 0.4,
        minTrackingConfidence: 0.4,
      });
    } catch (e) {
      console.error("Model load failed", e);
      return this.fallbackToMouse("Couldn't load the hand-tracking model.");
    }

    this.setLoader(55, "Requesting camera…");
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 640, height: 480, facingMode: "user" },
        audio: false,
      });
      this.ui.video.srcObject = this.stream;
      await this.ui.video.play();
    } catch (e) {
      console.error("Camera failed", e);
      return this.fallbackToMouse(
        "Camera access was blocked. Drawing with the mouse instead."
      );
    }

    this.setLoader(100, "Ready! 🚀");
    this.showApp();
    this.ui.camPreview.classList.remove("hidden");
    requestAnimationFrame(() => this.loop());
  }

  showApp() {
    this.ui.loader.classList.add("fade-out");
    this.ui.loader.classList.add("hidden");
    this.ui.app.classList.remove("hidden");
  }

  fallbackToMouse(reason) {
    this.setLoader(100, "Starting…");
    this.showApp();
    if (this.ui.notice) {
      this.ui.notice.innerHTML =
        `<p><strong>⚠️ ${reason}</strong></p>` +
        `<p>Click and drag on the canvas to draw.</p>`;
    }
    this.setMode("idle");
    this.setupMouseDrawing();
  }

  setupMouseDrawing() {
    const canvas = document.getElementById("draw-canvas");
    let down = false;
    const pos = (e) => {
      const r = canvas.getBoundingClientRect();
      return [e.clientX - r.left, e.clientY - r.top];
    };
    canvas.addEventListener("mousedown", (e) => {
      down = true;
      this.engine.beginStroke();
      this.engine.addPoint(...pos(e));
    });
    canvas.addEventListener("mousemove", (e) => {
      if (down) this.engine.addPoint(...pos(e));
    });
    const end = () => {
      down = false;
      this.engine.endStroke();
    };
    canvas.addEventListener("mouseup", end);
    canvas.addEventListener("mouseleave", end);
  }

  // ── UI feedback ───────────────────────────────────────────
  setMode(gesture) {
    const labels = {
      draw: "☝️  DRAW",
      pinch: "🤌  MOVE",
      erase: "✌️  ERASE",
      idle: "🖐️  IDLE",
    };
    this.ui.modePill.className = `mode-pill ${gesture}`;
    this.ui.modeLabel.textContent = labels[gesture] || "SHOW YOUR HAND";
  }

  setCursor(visible, x = 0, y = 0, gesture = "idle") {
    if (!visible) {
      this.ui.cursor.style.display = "none";
      return;
    }
    this.ui.cursor.style.display = "block";
    this.ui.cursor.style.left = x + "px";
    this.ui.cursor.style.top = y + "px";
    this.ui.cursor.className = gesture;
  }

  setSelRing(bbox) {
    if (!bbox) {
      this.ui.selRing.style.display = "none";
      return;
    }
    this.ui.selRing.style.display = "block";
    this.ui.selRing.style.left = bbox.x + "px";
    this.ui.selRing.style.top = bbox.y + "px";
    this.ui.selRing.style.width = bbox.w + "px";
    this.ui.selRing.style.height = bbox.h + "px";
  }

  smooth(x, y) {
    if (this.sx === null) {
      this.sx = x;
      this.sy = y;
    }
    this.sx += (x - this.sx) * this.ALPHA;
    this.sy += (y - this.sy) * this.ALPHA;
    return [this.sx, this.sy];
  }

  // ── Main loop ─────────────────────────────────────────────
  loop() {
    requestAnimationFrame(() => this.loop());
    this.engine.tick();

    const v = this.ui.video;
    if (v.readyState >= 2) {
      if (v.currentTime !== this.lastVideoTime) {
        this.lastVideoTime = v.currentTime;
        try {
          this.lastResult = this.landmarker.detectForVideo(v, performance.now());
        } catch (_) {
          /* transient detect errors are non-fatal */
        }
      }
      this.handle(this.lastResult);
    }
  }

  handle(res) {
    const W = this.engine.W;
    const H = this.engine.H;
    const has = res && res.landmarks && res.landmarks.length > 0;

    this.drawOverlay(has ? res.landmarks[0] : null);

    if (!has) {
      this.setCursor(false);
      this.setMode("idle");
      this.setSelRing(null);
      if (this.drawActive && !this._gapTimer) {
        this._gapTimer = setTimeout(() => {
          this.drawActive = false;
          this.engine.endStroke();
          this._gapTimer = null;
        }, 200);
      }
      this._resetMove();
      return;
    }

    if (this._gapTimer) {
      clearTimeout(this._gapTimer);
      this._gapTimer = null;
    }

    const lm = res.landmarks[0];
    const gesture = classify(lm);
    // Mirror X so motion feels like a mirror.
    const [sx, sy] = this.smooth((1 - lm[8].x) * W, lm[8].y * H);

    this.setCursor(true, sx, sy, gesture);
    this.setMode(gesture);

    switch (gesture) {
      case "draw":
        this._resetMove();
        if (!this.drawActive) {
          this.engine.beginStroke();
          this.drawActive = true;
        }
        this.engine.addPoint(sx, sy);
        this.setSelRing(null);
        break;

      case "pinch":
        if (this.drawActive) {
          this.engine.endStroke();
          this.drawActive = false;
        }
        if (!this.pinchActive) {
          this.pinchActive = true;
          this.selectedIdx = this.engine.findStrokeAt(sx, sy);
          this.movePrevX = sx;
          this.movePrevY = sy;
        }
        if (this.selectedIdx >= 0) {
          const bb = this.engine.translateStroke(
            this.selectedIdx,
            sx - this.movePrevX,
            sy - this.movePrevY
          );
          if (bb) this.setSelRing(bb);
        }
        this.movePrevX = sx;
        this.movePrevY = sy;
        break;

      case "erase":
        if (this.drawActive) {
          this.engine.endStroke();
          this.drawActive = false;
        }
        this._resetMove();
        this.engine.eraseAt(sx, sy, 35);
        this.engine.drawEraseRing(sx, sy);
        this.setSelRing(null);
        break;

      default:
        if (this.drawActive) {
          this.engine.endStroke();
          this.drawActive = false;
        }
        this._resetMove();
        this.setSelRing(null);
        break;
    }
  }

  _resetMove() {
    this.pinchActive = false;
    this.selectedIdx = -1;
    this.movePrevX = null;
    this.movePrevY = null;
  }

  drawOverlay(lm) {
    const cv = this.ui.overlay;
    const v = this.ui.video;
    const w = (cv.width = v.videoWidth || 220);
    const h = (cv.height = v.videoHeight || 165);
    const ctx = cv.getContext("2d");
    ctx.clearRect(0, 0, w, h);
    if (!lm) return;

    ctx.strokeStyle = "rgba(0,245,255,0.85)";
    ctx.lineWidth = 2;
    for (const [a, b] of HAND_CONNECTIONS) {
      ctx.beginPath();
      ctx.moveTo(lm[a].x * w, lm[a].y * h);
      ctx.lineTo(lm[b].x * w, lm[b].y * h);
      ctx.stroke();
    }
    ctx.fillStyle = "#fff";
    for (const p of lm) {
      ctx.beginPath();
      ctx.arc(p.x * w, p.y * h, 3, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

window.addEventListener("DOMContentLoaded", () => new HandDrawApp());
