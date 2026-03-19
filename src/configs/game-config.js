import Phaser from 'phaser';
import { BootScene } from '../scenes/boot-scene.js';
import { PreloadScene } from '../scenes/preload-scene.js';
import { TitleScene } from '../scenes/title-scene.js';
import { GridScene } from '../scenes/grid-scene.js';

/** @type {Phaser.Types.Core.GameConfig} */
const gameConfig = {
  type: Phaser.AUTO,
  parent: 'game-container',
  backgroundColor: '#1a0a2e',
  scale: {
    mode: Phaser.Scale.RESIZE,
  },
  dom: {
    createContainer: true,
  },
  scene: [BootScene, PreloadScene, TitleScene, GridScene],
};

export default gameConfig;
