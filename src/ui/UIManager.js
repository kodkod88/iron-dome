/**
 * UIManager — Phaser-aware.
 * Manages all HUD elements: score, health bar, level, start screen, game-over screen.
 * All elements are Phaser objects composited on the canvas (no DOM manipulation).
 */
import Phaser from 'phaser';
import { createButton } from './UIButtonFactory.js';

const BAR_WIDTH = 150;
const BAR_HEIGHT = 14;

export class UIManager {
  /**
   * @param {Phaser.Scene} scene
   */
  constructor(scene) {
    this._scene             = scene;
    this._startContainer    = null;
    this._gameOverContainer = null;
    this._healthBarGfx      = null;
    this._pauseContainer    = null;
    this._pauseCallback     = null;

    this._createHUD();
  }

  // ─── HUD ───────────────────────────────────────────────────────────────────

  _createHUD() {
    const s = this._scene;
    const style = { fontSize: '16px', fill: '#ffffff', fontFamily: 'monospace' };

    this._scoreText  = s.add.text(16,  16, 'SCORE: 0', style).setScrollFactor(0).setDepth(10);
    this._levelText  = s.add.text(400, 16, 'LEVEL 1',  style).setOrigin(0.5, 0).setScrollFactor(0).setDepth(10);
    this._healthLabel = s.add.text(784, 16, 'HEALTH',  style).setOrigin(1, 0).setScrollFactor(0).setDepth(10);
    this._healthValue = s.add.text(784, 34, '100',     style).setOrigin(1, 0).setScrollFactor(0).setDepth(10);

    this._healthBarGfx = s.add.graphics().setScrollFactor(0).setDepth(10);
    this._drawHealthBar(1);

    // Pause button — hidden until gameplay starts
    this._pauseBtn = createButton(s, '\u275a\u275a PAUSE', 400, 60, () => this._pauseCallback?.());
    this._pauseBtn.setScrollFactor(0).setDepth(10).setVisible(false);
  }

  _drawHealthBar(percent) {
    const gfx = this._healthBarGfx;
    gfx.clear();

    const x = 784 - BAR_WIDTH;
    const y = 54;

    // Background track
    gfx.fillStyle(0x333333, 0.8);
    gfx.fillRect(x, y, BAR_WIDTH, BAR_HEIGHT);

    // Filled portion — colour shifts from green → yellow → red
    const color = percent > 0.5 ? 0x44dd44 : percent > 0.25 ? 0xdddd00 : 0xdd2222;
    gfx.fillStyle(color, 1);
    gfx.fillRect(x, y, Math.round(BAR_WIDTH * percent), BAR_HEIGHT);

    // Border
    gfx.lineStyle(1, 0xffffff, 0.5);
    gfx.strokeRect(x, y, BAR_WIDTH, BAR_HEIGHT);
  }

  // ─── Public update methods ──────────────────────────────────────────────────

  /** @param {number} score */
  updateScore(score) {
    this._scoreText.setText(`SCORE: ${score}`);
  }

  /**
   * @param {number} percent  0.0–1.0
   * @param {number} value    integer health value
   */
  updateHealth(percent, value) {
    this._healthValue.setText(String(value));
    this._drawHealthBar(percent);
  }

  /** @param {number} level */
  updateLevel(level) {
    this._levelText.setText(`LEVEL ${level}`);
  }

  // ─── Pause ──────────────────────────────────────────────────────────────────

  /** Register the function called when pause button is clicked. */
  setPauseCallback(fn) { this._pauseCallback = fn; }

  showPauseButton() { this._pauseBtn.setVisible(true); }
  hidePauseButton() { this._pauseBtn.setVisible(false); }

  /** Sync button label with current pause state. */
  updatePauseLabel(isPaused) {
    this._pauseBtn.label.setText(isPaused ? '\u25b6 RESUME' : '\u275a\u275a PAUSE');
  }

  showPauseOverlay(onResume, onRestart) {
    if (this._pauseContainer) return; // already showing
    const s = this._scene;
    const { width, height } = s.scale;
    const c = s.add.container(0, 0).setDepth(18);

    const bg = s.add.graphics();
    bg.fillStyle(0x000000, 0.55);
    bg.fillRect(0, 0, width, height);
    c.add(bg);

    c.add(s.add.text(width / 2, height * 0.36, 'PAUSED', {
      fontSize: '52px', fill: '#ffffff', fontFamily: 'monospace',
      stroke: '#333333', strokeThickness: 5,
    }).setOrigin(0.5));

    const resumeBtn = createButton(s, 'RESUME  [ESC]', width / 2, height * 0.52 + 22, onResume);
    c.add(resumeBtn);

    const restartBtn = createButton(s, 'RESTART  [R]', width / 2, height * 0.62 + 22, () => onRestart?.());
    c.add(restartBtn);

    this._pauseContainer = c;
  }

  hidePauseOverlay() {
    if (this._pauseContainer) {
      this._pauseContainer.destroy();
      this._pauseContainer = null;
    }
  }

  // ─── Start screen ───────────────────────────────────────────────────────────

  /**
   * @param {Function} onStart  callback when player starts
   */
  showStartScreen(onStart) {
    const s = this._scene;
    const { width, height } = s.scale;
    const container = s.add.container(0, 0).setDepth(20);

    // Dark overlay
    const bg = s.add.graphics();
    bg.fillStyle(0x000000, 0.75);
    bg.fillRect(0, 0, width, height);
    container.add(bg);

    // Title
    const title = s.add.text(width / 2, height * 0.32, 'IRON DOME', {
      fontSize: '52px',
      fill: '#00eeff',
      fontFamily: 'monospace',
      stroke: '#003355',
      strokeThickness: 6,
    }).setOrigin(0.5);
    container.add(title);

    const subtitle = s.add.text(width / 2, height * 0.45, 'Defend the city.\nClick missiles to intercept them.', {
      fontSize: '18px',
      fill: '#aaddff',
      fontFamily: 'monospace',
      align: 'center',
    }).setOrigin(0.5);
    container.add(subtitle);

    const startBtn = createButton(s, 'START GAME', width / 2, height * 0.62 + 22, () => {
      container.destroy();
      onStart();
    });
    container.add(startBtn);

    this._startContainer = container;
  }

  hideStartScreen() {
    if (this._startContainer) {
      this._startContainer.destroy();
      this._startContainer = null;
    }
  }

  // ─── Game over screen ───────────────────────────────────────────────────────

  /**
   * @param {number}   score      final score
   * @param {Function} onRestart  callback when player restarts
   */
  showGameOver(score, onRestart) {
    if (this._gameOverContainer) this._gameOverContainer.destroy();

    const s = this._scene;
    const { width, height } = s.scale;
    const container = s.add.container(0, 0).setDepth(20);

    const bg = s.add.graphics();
    bg.fillStyle(0x000000, 0.82);
    bg.fillRect(0, 0, width, height);
    container.add(bg);

    const gameOverText = s.add.text(width / 2, height * 0.3, 'GAME OVER', {
      fontSize: '56px',
      fill: '#ff2222',
      fontFamily: 'monospace',
      stroke: '#440000',
      strokeThickness: 6,
    }).setOrigin(0.5);
    container.add(gameOverText);

    const scoreText = s.add.text(width / 2, height * 0.46, `FINAL SCORE: ${score}`, {
      fontSize: '24px',
      fill: '#ffdd44',
      fontFamily: 'monospace',
    }).setOrigin(0.5);
    container.add(scoreText);

    const playAgainBtn = createButton(s, 'PLAY AGAIN', width / 2, height * 0.6 + 22, () => {
      container.destroy();
      this._gameOverContainer = null;
      onRestart();
    });
    container.add(playAgainBtn);

    this._gameOverContainer = container;
  }
}
