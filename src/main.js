/**
 * main.js — Game entry point.
 * Instantiates the Phaser.Game with the shared configuration.
 */
import Phaser from 'phaser';
import { GameConfig } from './game/GameConfig.js';

// eslint-disable-next-line no-new
new Phaser.Game(GameConfig);
