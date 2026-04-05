/**
 * Missile — pure JS entity, zero Phaser dependency.
 * Contains all business logic for an enemy missile:
 * type config, position, velocity, damage, trail.
 */

const MAX_TRAIL_LENGTH = 12;

// Speeds tuned so straight-down travel time is approx:
//   small 4–5 s, medium 5–6 s, large 6–7 s  (canvas height ≈ 572 px drop)
export const MISSILE_TYPES = {
  small:  { speed: 125, damage: 5,  radius: 6  },
  medium: { speed: 100, damage: 10, radius: 10 },
  large:  { speed: 82,  damage: 20, radius: 16 },
};

export class Missile {
  /**
   * @param {object} opts
   * @param {'small'|'medium'|'large'} opts.type
   * @param {number} opts.x          spawn x
   * @param {number} opts.y          spawn y
   * @param {number} opts.targetX    ground target x
   * @param {number} opts.targetY    ground target y
   * @param {number} [opts.speedMultiplier=1]
   */
  constructor({ type, x, y, targetX, targetY, speedMultiplier = 1 }) {
    const cfg = MISSILE_TYPES[type];

    this.type = type;
    this.x = x;
    this.y = y;
    this.radius = cfg.radius;
    this.damage = cfg.damage;
    this.speed = cfg.speed * speedMultiplier;
    this.active = true;

    /** @type {Array<{x:number, y:number}>} */
    this.trail = [];

    // Compute unit direction vector toward target
    const dx = targetX - x;
    const dy = targetY - y;
    const dist = Math.sqrt(dx * dx + dy * dy) || 1;
    this.vx = (dx / dist) * this.speed;
    this.vy = (dy / dist) * this.speed;
  }

  /**
   * Advance position by one frame.
   * @param {number} dt  seconds since last frame
   */
  update(dt) {
    this.x += this.vx * dt;
    this.y += this.vy * dt;

    // Prepend current position to trail, keep capped
    this.trail.unshift({ x: this.x, y: this.y });
    if (this.trail.length > MAX_TRAIL_LENGTH) {
      this.trail.pop();
    }
  }
}
