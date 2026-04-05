/**
 * HealthService — pure JS.
 * Tracks city health; game ends when health reaches zero.
 */
export class HealthService {
  /**
   * @param {number} [maxHealth=100]
   */
  constructor(maxHealth = 100) {
    this._maxHealth = maxHealth;
    this._health = maxHealth;
  }

  /**
   * Reduce health by amount, clamped to zero.
   * @param {number} amount
   */
  takeDamage(amount) {
    this._health = Math.max(0, this._health - amount);
  }

  /** @returns {boolean} */
  isGameOver() {
    return this._health <= 0;
  }

  /** @returns {number} current health integer */
  getHealth() {
    return this._health;
  }

  /** @returns {number} 0.0–1.0 */
  getHealthPercent() {
    return this._health / this._maxHealth;
  }

  /** Restore to full health (call on game restart). */
  reset() {
    this._health = this._maxHealth;
  }
}
