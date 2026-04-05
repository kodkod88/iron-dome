/**
 * ExplosionService — pure JS, no Phaser dependency.
 *
 * Manages a pool of spark particles spawned on each explosion.
 * Sparks are small fast-moving embers that shoot outward, arc downward
 * under gravity, and fade out — adding a layer of kinetic detail on top
 * of the existing concentric-circle explosion visuals in GameScene.
 *
 * Usage:
 *   triggerSparks(x, y, radius)  — spawn sparks (proportional to radius)
 *   update(dt)                   — advance positions / fade
 *   drawSparks(gfx)              — render into a Phaser Graphics object
 *   reset()                      — clear all particles (call on game restart)
 */

const MAX_SPARKS = 220;   // absolute cap across all active explosions
const GRAVITY    = 90;    // px/s² downward pull on sparks

export class ExplosionService {
  constructor() {
    /** @type {Array<{x,y,vx,vy,alpha,life,maxLife,radius,color}>} */
    this._sparks = [];
  }

  /**
   * Spawn sparks at the given world position.
   * Count scales with explosion radius so bigger blasts look bigger.
   * @param {number} x
   * @param {number} y
   * @param {number} radius  visual explosion radius
   */
  triggerSparks(x, y, radius) {
    const count = Math.min(28, Math.max(6, Math.floor(radius * 0.22)));
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = (60 + Math.random() * 180) * (0.5 + radius / 80);
      this._sparks.push({
        x, y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 20, // slight upward bias
        alpha:   0.95,
        life:    0,
        maxLife: 0.25 + Math.random() * 0.35,
        radius:  0.8 + Math.random() * 1.8,
        color:   Math.random() > 0.45 ? 0xffcc00 : 0xff5500,
      });
    }
    // Enforce total cap — drop oldest sparks first
    if (this._sparks.length > MAX_SPARKS) {
      this._sparks.splice(0, this._sparks.length - MAX_SPARKS);
    }
  }

  /**
   * Advance all spark particles.
   * @param {number} dt  seconds since last frame
   */
  update(dt) {
    for (const s of this._sparks) {
      s.x   += s.vx * dt;
      s.y   += s.vy * dt;
      s.vy  += GRAVITY * dt;  // arc under gravity
      s.life += dt;
      s.alpha = (1 - s.life / s.maxLife) * 0.95;
    }
    this._sparks = this._sparks.filter(s => s.life < s.maxLife);
  }

  /**
   * Draw all sparks into a Phaser Graphics object.
   * @param {Phaser.GameObjects.Graphics} gfx
   */
  drawSparks(gfx) {
    for (const s of this._sparks) {
      gfx.fillStyle(s.color, s.alpha);
      gfx.fillCircle(s.x, s.y, s.radius);
    }
  }

  /** Remove all particles — call on game restart. */
  reset() {
    this._sparks.length = 0;
  }
}
