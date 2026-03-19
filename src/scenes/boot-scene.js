import Phaser from 'phaser';
import { SCENE_KEYS } from '../configs/constants.js';
import { layout } from '../managers/layout-manager.js';

export class BootScene extends Phaser.Scene {
  constructor() {
    super({ key: SCENE_KEYS.BOOT });
  }

  create() {
    layout.update(this.scale.width, this.scale.height);

    this.scale.on('resize', (gameSize) => {
      layout.update(gameSize.width, gameSize.height);
    });

    this.scene.start(SCENE_KEYS.PRELOAD);
  }
}
