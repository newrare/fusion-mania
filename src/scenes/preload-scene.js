import Phaser from 'phaser';
import { SCENE_KEYS } from '../configs/constants.js';
import { layout } from '../managers/layout-manager.js';

export class PreloadScene extends Phaser.Scene {
  constructor() {
    super({ key: SCENE_KEYS.PRELOAD });
  }

  preload() {
    // Progress bar
    const { width, height } = layout;
    const barW = width * 0.6;
    const barH = 8;
    const barX = (width - barW) / 2;
    const barY = height / 2;

    const bg = this.add.rectangle(barX + barW / 2, barY, barW, barH, 0x333333).setOrigin(0.5);
    const fill = this.add.rectangle(barX, barY, 0, barH, 0xb464ff).setOrigin(0, 0.5);

    this.load.on('progress', (/** @type {number} */ value) => {
      fill.width = barW * value;
    });

    // Background layers
    this.load.image('bg-sky',     'assets/images/background_one_sky.png');
    this.load.image('bg-rock',    'assets/images/background_one_rock.png');
    this.load.image('bg-ground',  'assets/images/background_one_ground.png');
    this.load.image('bg-cloud02', 'assets/images/background_one_cloud_02.png');
    this.load.image('bg-cloud01', 'assets/images/background_one_cloud_01.png');
  }

  create() {
    this.scene.start(SCENE_KEYS.TITLE);
  }
}
