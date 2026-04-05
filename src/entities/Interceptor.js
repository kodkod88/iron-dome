/**
 * Interceptor — pure JS entity, zero Phaser dependency.
 *
 * Two operating modes:
 *   Homing  — pass `target` (Missile). Tracks it until close enough.
 *   Area    — pass `destX`/`destY`. Flies to point then signals arrival via `arrivedAt`.
 *
 * Launch behaviour
 * ────────────────
 * When `launchAngle` is supplied the missile travels straight in that direction for
 * MIN_BOOST_DISTANCE px before homing begins, guaranteeing a clean upward exit and
 * preventing circling when the target is very close.
 *
 * Anti-circling system — missile detonates on the FIRST of these conditions:
 *   1. Proximity      — within PROXIMITY_RADIUS of target
 *   2. Dwell          — within NEAR_TARGET_RADIUS for NEAR_TARGET_MAX_TIME seconds
 *   3. Overshoot      — distance increasing for OVERSHOOT_FRAMES consecutive frames
 *                       after having been within NEAR_TARGET_RADIUS (passed closest approach)
 *   4. Max lifetime   — older than MAX_LIFETIME seconds
 *   5. Ground         — y ≥ groundY
 *
 * All detonation paths set `arrivedAt` so GameScene always fires the explosion.
 * Both modes populate `smoke[]` for the renderer.
 */

const PROXIMITY_RADIUS     = 50;   // px — detonate within this distance of target
const MIN_BOOST_DISTANCE   = 90;   // px — fly straight before homing (close-target safety)
const MAX_LIFETIME         = 3.2;  // s  — hard cap on interceptor lifespan
const NEAR_TARGET_RADIUS   = 90;   // px — dwell detection zone
const NEAR_TARGET_MAX_TIME = 0.5;  // s  — max dwell before forced detonation
const OVERSHOOT_FRAMES     = 3;    // consecutive frames of increasing dist → overshoot detonate
const MAX_SMOKE            = 22;
const TURN_RATE            = 3.2;  // radians per second — normal guidance
const TERMINAL_TURN_RATE   = 4.2;  // radians per second — tighter authority inside 160 px

/**
 * Rotate `current` angle toward `target` angle by at most `maxStep` radians,
 * always taking the shortest path around the circle.
 */
function turnToward(current, target, maxStep) {
  let diff = target - current;
  while (diff >  Math.PI) diff -= 2 * Math.PI;
  while (diff < -Math.PI) diff += 2 * Math.PI;
  if (Math.abs(diff) <= maxStep) return target;
  return current + Math.sign(diff) * maxStep;
}

export class Interceptor {
  /**
   * @param {object} opts
   * @param {number} opts.x
   * @param {number} opts.y
   * @param {object|null} [opts.target=null]   Missile to track (homing mode)
   * @param {number} [opts.destX]              destination x (area mode)
   * @param {number} [opts.destY]              destination y (area mode)
   * @param {number} [opts.speed=420]
   * @param {number} [opts.areaRadius=70]
   * @param {number|null} [opts.launchAngle=null]
   * @param {number} [opts.groundY=Infinity]   detonate if y reaches this
   */
  constructor({ x, y, target = null, destX, destY, speed = 420, areaRadius = 70, launchAngle = null, groundY = Infinity }) {
    this.x          = x;
    this.y          = y;
    this.target     = target;
    this.destX      = destX ?? null;
    this.destY      = destY ?? null;
    this.speed      = speed;
    this.areaRadius = areaRadius;
    this.radius     = 5;
    this.active     = true;

    /**
     * Set to {x, y} on any detonation. GameScene reads this to fire the explosion.
     * @type {{x:number, y:number}|null}
     */
    this.arrivedAt = null;

    /** Position history for smoke-trail rendering (index 0 = most recent). */
    this.smoke = [];

    // ── Safety trackers ──────────────────────────────────────────────────────
    this._boostLeft        = (launchAngle !== null) ? MIN_BOOST_DISTANCE : 0;
    this._lifetime         = 0;
    this._groundY          = groundY;
    // Overshoot detection (homing only, populated after boost ends)
    this._prevDistSq       = Infinity;
    this._increasingFrames = 0;
    // Dwell detection
    this._nearTargetTimer  = 0;

    // ── Initial heading ───────────────────────────────────────────────────────
    if (launchAngle !== null) {
      this._angle = launchAngle;
    } else if (target !== null) {
      this._angle = Math.atan2(target.y - y, target.x - x);
    } else {
      this._angle = Math.atan2((destY ?? y) - y, (destX ?? x) - x);
    }
  }

  /** Advance interceptor by one frame. @param {number} dt seconds */
  update(dt) {
    this.smoke.unshift({ x: this.x, y: this.y });
    if (this.smoke.length > MAX_SMOKE) this.smoke.pop();

    this._lifetime += dt;

    if (this._lifetime >= MAX_LIFETIME) {
      this.arrivedAt = { x: this.x, y: this.y };
      this.active    = false;
      return;
    }

    if (this.y >= this._groundY) {
      this.arrivedAt = { x: this.x, y: this.y };
      this.active    = false;
      return;
    }

    if (this.target !== null) {
      this._updateHoming(dt);
    } else {
      this._updateArea(dt);
    }
  }

  // ─── Private ────────────────────────────────────────────────────────────────

  _updateHoming(dt) {
    if (!this.target.active) {
      this.active = false;
      return;
    }

    const dx     = this.target.x - this.x;
    const dy     = this.target.y - this.y;
    const distSq = dx * dx + dy * dy;

    // 1. Proximity — hard detonation radius
    if (distSq < PROXIMITY_RADIUS * PROXIMITY_RADIUS) {
      this.arrivedAt = { x: this.target.x, y: this.target.y };
      this.active    = false;
      return;
    }

    const step = this.speed * dt;

    if (this._boostLeft > 0) {
      // Boost phase: straight upward, no homing. Skip all tracking.
      this._boostLeft -= step;
      this.x += Math.cos(this._angle) * step;
      this.y += Math.sin(this._angle) * step;
      return;
    }

    // ── Active homing: run all anti-circling checks ───────────────────────────

    // 2. Dwell near target
    if (distSq < NEAR_TARGET_RADIUS * NEAR_TARGET_RADIUS) {
      this._nearTargetTimer += dt;
      if (this._nearTargetTimer >= NEAR_TARGET_MAX_TIME) {
        this.arrivedAt = { x: this.target.x, y: this.target.y };
        this.active    = false;
        return;
      }
    } else {
      this._nearTargetTimer = 0;
    }

    // 3. Overshoot — distance increasing after we got close
    if (this._prevDistSq !== Infinity && distSq > this._prevDistSq) {
      this._increasingFrames++;
      if (this._increasingFrames >= OVERSHOOT_FRAMES &&
          this._prevDistSq < NEAR_TARGET_RADIUS * NEAR_TARGET_RADIUS) {
        this.arrivedAt = { x: this.target.x, y: this.target.y };
        this.active    = false;
        return;
      }
    } else {
      this._increasingFrames = 0;
    }
    this._prevDistSq = distSq;

    // Terminal guidance: increase turn authority when close
    const rate = (distSq < 160 * 160) ? TERMINAL_TURN_RATE : TURN_RATE;
    this._angle = turnToward(this._angle, Math.atan2(dy, dx), rate * dt);
    this.x += Math.cos(this._angle) * step;
    this.y += Math.sin(this._angle) * step;
  }

  _updateArea(dt) {
    const dx     = this.destX - this.x;
    const dy     = this.destY - this.y;
    const distSq = dx * dx + dy * dy;

    if (distSq < PROXIMITY_RADIUS * PROXIMITY_RADIUS) {
      this.arrivedAt = { x: this.destX, y: this.destY };
      this.active    = false;
      return;
    }

    const step = this.speed * dt;

    if (this._boostLeft > 0) {
      this._boostLeft -= step;
      this.x += Math.cos(this._angle) * step;
      this.y += Math.sin(this._angle) * step;
      return;
    }

    this._angle = turnToward(this._angle, Math.atan2(dy, dx), TURN_RATE * dt);
    this.x += Math.cos(this._angle) * step;
    this.y += Math.sin(this._angle) * step;
  }
}
