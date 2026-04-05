/**
 * DifficultyService — pure JS.
 * Tracks elapsed game time and derives difficulty parameters.
 * Level increases every 30 seconds.
 *
 * NOTE: update() accepts milliseconds (raw Phaser delta).
 *       Missile/Interceptor.update() accept seconds — the asymmetry is intentional.
 */

const SCALING_INTERVAL_MS = 30_000;
const BASE_SPAWN_RATE_MS = 2000;
const MIN_SPAWN_RATE_MS = 500;
const SPAWN_RATE_REDUCTION_PER_LEVEL = 200;
const SPEED_INCREASE_PER_LEVEL = 0.08; // 8 % per level cap keeps game fair
const BASE_LARGE_CHANCE = 0.1;
const LARGE_CHANCE_INCREASE_PER_LEVEL = 0.05;
const MAX_LARGE_CHANCE = 0.5;
const MEDIUM_CHANCE = 0.3;

export class DifficultyService {
  constructor() {
    this._elapsedMs = 0;
  }

  /**
   * Advance the difficulty clock.
   * @param {number} deltaMs  milliseconds since last frame
   */
  update(deltaMs) {
    this._elapsedMs += deltaMs;
  }

  /** Current level (1-based). */
  getLevel() {
    return Math.floor(this._elapsedMs / SCALING_INTERVAL_MS) + 1;
  }

  /**
   * Milliseconds between missile spawns (decreases with level).
   * @returns {number}
   */
  getSpawnRate() {
    return Math.max(
      MIN_SPAWN_RATE_MS,
      BASE_SPAWN_RATE_MS - (this.getLevel() - 1) * SPAWN_RATE_REDUCTION_PER_LEVEL
    );
  }

  /**
   * Multiplier applied to all missile speeds.
   * @returns {number}
   */
  getSpeedMultiplier() {
    return 1 + (this.getLevel() - 1) * SPEED_INCREASE_PER_LEVEL;
  }

  /**
   * Probability (0–1) that a spawned missile is 'large'.
   * @returns {number}
   */
  getLargeMissileChance() {
    return Math.min(
      MAX_LARGE_CHANCE,
      BASE_LARGE_CHANCE + (this.getLevel() - 1) * LARGE_CHANCE_INCREASE_PER_LEVEL
    );
  }

  /**
   * Maximum number of missiles allowed in the sky simultaneously.
   * Increases by 1 each level, capped at 6.
   * @returns {number}
   */
  getMaxSimultaneousMissiles() {
    return Math.min(6, 1 + this.getLevel());
  }

  /**
   * Pick a random missile type weighted by current difficulty.
   * @returns {'small'|'medium'|'large'}
   */
  getMissileType() {
    const r = Math.random();
    const largeChance = this.getLargeMissileChance();
    if (r < largeChance) return 'large';
    if (r < largeChance + MEDIUM_CHANCE) return 'medium';
    return 'small';
  }

  /** Reset elapsed time (call on game restart). */
  reset() {
    this._elapsedMs = 0;
  }
}
