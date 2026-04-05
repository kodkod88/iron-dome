/**
 * MissileFactory — pure JS.
 * Creates Missile instances using an injected DifficultyService.
 * Open/Closed: new missile types only require updating MISSILE_TYPES in Missile.js.
 */
import { Missile } from '../entities/Missile.js';

export class MissileFactory {
  /**
   * @param {import('../services/DifficultyService.js').DifficultyService} difficultyService
   */
  constructor(difficultyService) {
    this._difficulty = difficultyService;
  }

  /**
   * Spawn a new missile with position and type driven by current difficulty.
   * @param {{canvasWidth: number, canvasHeight: number}} opts
   * @returns {Missile}
   */
  create({ canvasWidth, canvasHeight }) {
    const type = this._difficulty.getMissileType();
    const speedMultiplier = this._difficulty.getSpeedMultiplier();

    // Spawn along the top edge, random horizontal position
    const x = Math.random() * canvasWidth;
    const y = -20;

    // Aim at a random point in the city zone (centre 60% of screen width)
    const targetX = (0.2 + Math.random() * 0.6) * canvasWidth;
    const targetY = canvasHeight - 40;

    return new Missile({ type, x, y, targetX, targetY, speedMultiplier });
  }
}
