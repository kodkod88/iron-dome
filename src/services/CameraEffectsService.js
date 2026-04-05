/**
 * CameraEffectsService — thin wrapper around a Phaser Camera.
 * Provides named shake presets so callers never use raw numbers.
 * Pure delegation — no state.
 */
export class CameraEffectsService {
  /** @param {Phaser.Cameras.Scene2D.Camera} camera */
  constructor(camera) {
    this._cam = camera;
  }

  /** Light ripple — interceptor hit, small missile. */
  shakeSmall()  { this._cam.shake(150, 0.002); }

  /** Medium hit — standard interception, area explosion. */
  shakeMedium() { this._cam.shake(400, 0.008); }

  /** Heavy detonation — large missile, cinematic explosion. */
  shakeLarge()  { this._cam.shake(900, 0.018); }
}
