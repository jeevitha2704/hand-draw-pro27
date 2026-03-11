/**
 * gestures.js — SSE listener + gesture → action bridge
 * Receives JSON from Flask /gesture_stream and drives the DrawingEngine
 */

class GestureHandler {
  constructor(engine, uiController) {
    this.engine = engine;
    this.ui     = uiController;

    // Smooth finger position
    this.sx = null; this.sy = null;
    this.ALPHA = 0.15; // More responsive smoothing

    // Move state
    this.selectedIdx  = -1;
    this.movePrevX    = null;
    this.movePrevY    = null;
    this.pinchActive  = false;

    // Draw state
    this.drawActive = false;

    this._connectSSE();
  }

  _connectSSE() {
    const es = new EventSource('/gesture_stream');
    es.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data);
        this._handle(data);
      } catch (_) {}
    };
    es.onerror = () => setTimeout(() => this._connectSSE(), 1000);
  }

  _smooth(rawX, rawY, W, H) {
    // rawX/Y are normalized 0-1, already mirrored by Python
    const ix = rawX * W;
    const iy = rawY * H;
    if (this.sx === null) { this.sx = ix; this.sy = iy; }
    this.sx += (ix - this.sx) * this.ALPHA;
    this.sy += (iy - this.sy) * this.ALPHA;
    return [this.sx, this.sy];
  }

  _handle(data) {
    const W = this.engine.W, H = this.engine.H;

    if (!data.detected) {
      // Don't immediately reset - allow brief tracking gaps
      this.ui.setCursor(false);
      this.ui.setMode('idle');
      this.ui.setSelRing(null);
      // Only end stroke after longer gap
      if (this.drawActive) {
        this._gapTimer = setTimeout(() => {
          this.drawActive = false;
          this.engine.endStroke();
        }, 200);
      }
      return;
    }

    // Clear gap timer if hand is detected again
    if (this._gapTimer) {
      clearTimeout(this._gapTimer);
      this._gapTimer = null;
    }

    const [sx, sy] = this._smooth(data.index_x, data.index_y, W, H);
    this.ui.setCursor(true, sx, sy, data.gesture);
    this.ui.setMode(data.gesture);

    // Pinch midpoint
    const px = data.thumb_x * W;
    const py = data.thumb_y * H;
    const pinchMidX = (sx + (W - px)) / 2;   // thumb also needs mirror
    const pinchMidY = (sy + py) / 2;

    switch (data.gesture) {

      // ── DRAW ──────────────────────────────────────────────
      case 'draw':
        this._resetMove();
        if (!this.drawActive) { this.engine.beginStroke(); this.drawActive = true; }
        this.engine.addPoint(sx, sy);
        this.ui.setSelRing(null);
        break;

      // ── PINCH → MOVE ──────────────────────────────────────
      case 'pinch':
        if (this.drawActive) { this.engine.endStroke(); this.drawActive = false; }

        if (!this.pinchActive) {
          // First frame: find nearest stroke
          this.pinchActive = true;
          this.selectedIdx = this.engine.findStrokeAt(sx, sy);
          this.movePrevX   = sx;
          this.movePrevY   = sy;
        }

        if (this.selectedIdx >= 0) {
          const dx = sx - this.movePrevX;
          const dy = sy - this.movePrevY;
          const bb = this.engine.translateStroke(this.selectedIdx, dx, dy);
          if (bb) this.ui.setSelRing(bb);
        }
        this.movePrevX = sx;
        this.movePrevY = sy;
        break;

      // ── ERASE ─────────────────────────────────────────────
      case 'erase':
        if (this.drawActive) { this.engine.endStroke(); this.drawActive = false; }
        this._resetMove();
        this.engine.eraseAt(sx, sy, 35);
        this.engine.drawEraseRing(sx, sy);
        this.ui.setSelRing(null);
        break;

      // ── IDLE ──────────────────────────────────────────────
      default:
        if (this.drawActive) { this.engine.endStroke(); this.drawActive = false; }
        this._resetMove();
        this.ui.setSelRing(null);
        break;
    }
  }

  _resetMove() {
    this.pinchActive = false;
    this.selectedIdx = -1;
    this.movePrevX   = null;
    this.movePrevY   = null;
  }

  _reset() {
    this._resetMove();
    this.sx = null; this.sy = null;
  }
}
