/**
 * canvas.js — Drawing engine
 * Manages strokes, erase, move, and rendering
 */

class DrawingEngine {
  constructor(drawCanvas, fxCanvas) {
    this.dc  = drawCanvas.getContext('2d');
    this.fxc = fxCanvas.getContext('2d');
    this.W   = drawCanvas.width;
    this.H   = drawCanvas.height;

    this.strokes      = [];   // completed strokes
    this.currentStroke = null;
    this.selectedIdx   = -1;

    this.color     = '#00f5ff';
    this.brushSize = 5;
    this.lineType  = 'normal';  // normal, straight, dashed, dotted, double
    this.hue       = 0;

    this.particles = new ParticleSystem(this.fxc);

    // Resize observer
    const ro = new ResizeObserver(() => this._resize(drawCanvas, fxCanvas));
    ro.observe(drawCanvas.parentElement);
    this._resize(drawCanvas, fxCanvas);
  }

  _resize(dc, fc) {
    const rect = dc.parentElement.getBoundingClientRect();
    dc.width = fc.width = this.W = rect.width;
    dc.height = fc.height = this.H = rect.height;
    this._redrawAll();
  }

  // ── Color helpers ────────────────────────────────────────
  getColor() {
    if (this.color === 'rainbow') {
      this.hue = (this.hue + 3) % 360;
      return `hsl(${this.hue}, 100%, 60%)`;
    }
    return this.color;
  }

  // ── Stroke rendering ─────────────────────────────────────
  _renderStroke(ctx, stroke) {
    if (!stroke || stroke.points.length < 2) return;
    const c = stroke.color;
    const lineType = stroke.lineType || 'normal';
    
    ctx.save();
    ctx.lineCap    = 'round';
    ctx.lineJoin   = 'round';
    ctx.globalCompositeOperation = 'screen';

    // Set line style based on type
    this._setLineStyle(ctx, lineType, stroke.size);

    // 3-pass glow
    const passes = [
      { lw: stroke.size * 5, alpha: 0.04, blur: 50 },
      { lw: stroke.size * 2, alpha: 0.20, blur: 20 },
      { lw: stroke.size,     alpha: 1.00, blur: 14 },
    ];
    
    for (const p of passes) {
      ctx.beginPath();
      ctx.strokeStyle = c;
      ctx.lineWidth   = p.lw;
      ctx.globalAlpha = p.alpha;
      ctx.shadowBlur  = p.blur;
      ctx.shadowColor = c;
      
      this._drawStrokePath(ctx, stroke.points, lineType);
      ctx.stroke();
    }
    
    // White core
    ctx.strokeStyle = 'rgba(255,255,255,0.75)';
    ctx.lineWidth   = stroke.size * 0.3;
    ctx.globalAlpha = 1;
    ctx.shadowBlur  = 4;
    ctx.beginPath();
    this._drawStrokePath(ctx, stroke.points, lineType);
    ctx.stroke();
    ctx.restore();
  }

  _setLineStyle(ctx, lineType, size) {
    switch(lineType) {
      case 'dashed':
        ctx.setLineDash([size * 3, size * 2]);
        break;
      case 'dotted':
        ctx.setLineDash([size * 0.5, size * 1.5]);
        break;
      case 'double':
        // Will be handled in drawing
        ctx.setLineDash([]);
        break;
      default:
        ctx.setLineDash([]);
    }
  }

  _drawStrokePath(ctx, points, lineType) {
    if (lineType === 'straight' && points.length >= 2) {
      // Draw straight line from first to last point
      ctx.moveTo(points[0].x, points[0].y);
      ctx.lineTo(points[points.length - 1].x, points[points.length - 1].y);
    } else if (lineType === 'double' && points.length >= 2) {
      // Draw two parallel lines
      const angle = Math.atan2(
        points[points.length - 1].y - points[0].y,
        points[points.length - 1].x - points[0].x
      );
      const offset = 4;
      const perpX = Math.cos(angle + Math.PI/2) * offset;
      const perpY = Math.sin(angle + Math.PI/2) * offset;
      
      // First line
      ctx.moveTo(points[0].x + perpX, points[0].y + perpY);
      for (let i = 1; i < points.length; i++)
        ctx.lineTo(points[i].x + perpX, points[i].y + perpY);
      
      // Second line
      ctx.moveTo(points[0].x - perpX, points[0].y - perpY);
      for (let i = 1; i < points.length; i++)
        ctx.lineTo(points[i].x - perpX, points[i].y - perpY);
    } else {
      // Normal curved line
      ctx.moveTo(points[0].x, points[0].y);
      for (let i = 1; i < points.length; i++)
        ctx.lineTo(points[i].x, points[i].y);
    }
  }

  _redrawAll() {
    this.dc.clearRect(0, 0, this.W, this.H);
    for (const s of this.strokes)  this._renderStroke(this.dc, s);
    if (this.currentStroke)        this._renderStroke(this.dc, this.currentStroke);
  }

  setLineType(type) {
    this.lineType = type;
  }

  // ── Draw ─────────────────────────────────────────────────
  beginStroke() {
    this.currentStroke = { points: [], color: this.getColor(), size: this.brushSize, lineType: this.lineType };
  }

  addPoint(x, y) {
    if (!this.currentStroke) this.beginStroke();
    const pts = this.currentStroke.points;
    if (pts.length > 0) {
      const last = pts[pts.length - 1];
      const d    = Math.hypot(x - last.x, y - last.y);
      if (d < 1) return; // only filter very close points
      if (d > 200) return; // filter teleports
    }
    pts.push({ x, y });
    this._redrawAll();
    if (Math.random() < 0.3) // reduce particle frequency for performance
      this.particles.spawn(x, y, this.currentStroke.color, 4);
  }

  endStroke() {
    if (this.currentStroke && this.currentStroke.points.length > 1) {
      this.strokes.push(this.currentStroke);
    }
    this.currentStroke = null;
  }

  // ── Erase ────────────────────────────────────────────────
  eraseAt(x, y, r = 35) {
    this.strokes = this.strokes.filter(s => {
      for (const p of s.points)
        if (Math.hypot(p.x - x, p.y - y) < r) return false;
      return true;
    });
    this._redrawAll();
  }

  drawEraseRing(x, y) {
    this.fxc.clearRect(0, 0, this.W, this.H);
    const ctx = this.fxc;
    ctx.save();
    ctx.beginPath();
    ctx.arc(x, y, 35, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(255,45,120,0.85)';
    ctx.lineWidth   = 2;
    ctx.shadowBlur  = 14;
    ctx.shadowColor = '#ff2d78';
    ctx.setLineDash([6, 4]);
    ctx.stroke();
    ctx.restore();
  }

  // ── Move ─────────────────────────────────────────────────
  _bbox(stroke) {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const p of stroke.points) {
      if (p.x < minX) minX = p.x; if (p.y < minY) minY = p.y;
      if (p.x > maxX) maxX = p.x; if (p.y > maxY) maxY = p.y;
    }
    const pad = 22;
    return { x: minX - pad, y: minY - pad, w: maxX - minX + pad * 2, h: maxY - minY + pad * 2 };
  }

  findStrokeAt(px, py) {
    for (let i = this.strokes.length - 1; i >= 0; i--) {
      for (const p of this.strokes[i].points)
        if (Math.hypot(p.x - px, p.y - py) < 45) return i;
    }
    return -1;
  }

  translateStroke(idx, dx, dy) {
    if (idx < 0 || idx >= this.strokes.length) return;
    for (const p of this.strokes[idx].points) { p.x += dx; p.y += dy; }
    this._redrawAll();
    return this._bbox(this.strokes[idx]);
  }

  getBbox(idx) {
    if (idx < 0 || idx >= this.strokes.length) return null;
    return this._bbox(this.strokes[idx]);
  }

  // ── Undo / Clear ─────────────────────────────────────────
  undo() {
    if (this.strokes.length > 0) this.strokes.pop();
    this._redrawAll();
  }

  clear() {
    this.strokes = [];
    this.currentStroke = null;
    this.particles.clear();
    this.dc.clearRect(0, 0, this.W, this.H);
    this.fxc.clearRect(0, 0, this.W, this.H);
  }

  // ── Animation tick ────────────────────────────────────────
  tick() {
    this.fxc.clearRect(0, 0, this.W, this.H);
    this.particles.update();
    this.particles.draw();
  }
}
