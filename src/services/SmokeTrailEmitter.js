/**
 * SmokeTrailEmitter — pure JS.
 * Central particle manager for missile / interceptor smoke trails.
 *
 * Callers feed world positions each frame via emit(); the emitter ages,
 * expands, and fades every particle independently.
 *
 * Capacity: MAX_PARTICLES shared across all entities.
 * When full, new emissions are silently dropped (no crash, graceful degradation).
 */

const MAX_PARTICLES = 250;

export class SmokeTrailEmitter {
  constructor() {
    /** @type {Array<object>} */
    this._particles = [];
  }

  /**
   * Emit one smoke puff at world position (x, y).
   * @param {number} x
   * @param {number} y
   * @param {object} [opts]
   * @param {number} [opts.life=0.9]         lifetime in seconds
   * @param {number} [opts.radius=2.5]       initial radius px
   * @param {number} [opts.maxRadius=11]     radius at end-of-life
   * @param {number} [opts.alpha=0.40]       initial alpha (fades to 0)
   * @param {number} [opts.color=0xb8b8b8]   fill colour hex
   * @param {number} [opts.vx]               horizontal drift (randomised if omitted)
   * @param {number} [opts.vy=-14]           vertical drift px/s (upward)
   */
  emit(x, y, opts = {}) {
    if (this._particles.length >= MAX_PARTICLES) return;
    const life = opts.life ?? 0.9;
    this._particles.push({
      x,
      y,
      life,
      maxLife:   life,
      radius:    opts.radius    ?? 2.5,
      maxRadius: opts.maxRadius ?? 11,
      alpha:     opts.alpha     ?? 0.40,
      color:     opts.color     ?? 0xb8b8b8,
      vx:        opts.vx        ?? (Math.random() - 0.5) * 6,
      vy:        opts.vy        ?? -14,
    });
  }

  /**
   * Advance all particles by dt seconds.  Dead particles are removed.
   * @param {number} dt seconds
   */
  update(dt) {
    for (let i = this._particles.length - 1; i >= 0; i--) {
      const p = this._particles[i];
      p.life -= dt;
      if (p.life <= 0) {
        this._particles.splice(i, 1);
        continue;
      }
      p.x  += p.vx * dt;
      p.y  += p.vy * dt;
      p.vy *= 0.97;   // light drag — drift decelerates
    }
  }

  /**
   * Render all smoke particles into a Phaser Graphics layer.
   * Call this after gfx.clear() so smoke sits below the entity bodies.
   * @param {Phaser.GameObjects.Graphics} gfx
   */
  draw(gfx) {
    for (const p of this._particles) {
      const t = p.life / p.maxLife;                           // 1 = fresh, 0 = expired
      const a = p.alpha * t;                                  // linear fade
      const r = p.radius + (p.maxRadius - p.radius) * (1 - t); // expand with age
      gfx.fillStyle(p.color, a);
      gfx.fillCircle(p.x, p.y, r);
    }
  }

  /** Remove all particles — call on game restart. */
  reset() {
    this._particles.length = 0;
  }
}
