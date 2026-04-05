/**
 * GameConfig — Phaser.Game configuration object.
 * Imported by main.js to instantiate the game.
 */
import Phaser from 'phaser';
import { GameScene } from './GameScene.js';

export const GameConfig = {
  type: Phaser.AUTO,
  width: 800,
  height: 600,
  backgroundColor: '#0a1628',
  scene: [GameScene],
  input: {
    mouse: true,
    touch: true,
  },
  render: {
    antialias: true,
  },
};
