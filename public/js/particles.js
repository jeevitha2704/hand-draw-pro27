/**
 * particles.js — Lightweight spark particle system
 * Used by canvas.js for draw trail effects
 */

class ParticleSystem {
  constructor(ctx) {
    this.ctx = ctx;
    this.pool = [];
  }

  spawn(x, y, color, count = 6) {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = Math.random() * 3.5 + 0.5;
      this.pool.push({
        x, y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        color,
        life: 1,
        decay: Math.random() * 0.05 + 0.028,
        r: Math.random() * 3.5 + 0.8,
        isLine: Math.random() > 0.45,
        angle,
        len: Math.random() * 12 + 4,
      });
    }
  }

  update() {
    for (let i = this.pool.length - 1; i >= 0; i--) {
      const p = this.pool[i];
      p.x  += p.vx;
      p.y  += p.vy;
      p.vx *= 0.92;
      p.vy *= 0.92;
      p.vy += 0.06;
      p.life -= p.decay;
      if (p.life <= 0) this.pool.splice(i, 1);
    }
  }

  draw() {
    const ctx = this.ctx;
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    for (const p of this.pool) {
      ctx.globalAlpha = p.life;
      ctx.strokeStyle = p.color;
      ctx.fillStyle   = p.color;
      ctx.shadowBlur  = 8;
      ctx.shadowColor = p.color;
      if (p.isLine) {
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(
          p.x + Math.cos(p.angle) * p.len * p.life,
          p.y + Math.sin(p.angle) * p.len * p.life
        );
        ctx.stroke();
      } else {
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r * p.life, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.restore();
  }

  clear() { this.pool = []; }
}
