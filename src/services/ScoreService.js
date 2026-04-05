/**
 * ScoreService — pure JS.
 * Tracks the player's score and awards points per interception.
 */

const INTERCEPT_SCORES = {
  small: 10,
  medium: 20,
  large: 40,
};

export class ScoreService {
  constructor() {
    this._score = 0;
  }

  /**
   * Award intercept points for a destroyed missile.
   * @param {'small'|'medium'|'large'} type
   */
  addInterceptScore(type) {
    this._score += INTERCEPT_SCORES[type] ?? 0;
  }

  /** @returns {number} */
  getScore() {
    return this._score;
  }

  /** Reset score to zero (call on game restart). */
  reset() {
    this._score = 0;
  }
}
