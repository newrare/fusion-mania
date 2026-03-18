import Phaser from 'phaser';
import { SCENE_KEYS, GAME_WIDTH, GAME_HEIGHT } from '../configs/constants.js';

export class PreloadScene extends Phaser.Scene {
  constructor() {
    super({ key: SCENE_KEYS.PRELOAD });
  }

  preload() {
    // Progress bar
    const barW = GAME_WIDTH * 0.6;
    const barH = 8;
    const barX = (GAME_WIDTH - barW) / 2;
    const barY = GAME_HEIGHT / 2;

    const bg = this.add.rectangle(barX + barW / 2, barY, barW, barH, 0x333333).setOrigin(0.5);
    const fill = this.add.rectangle(barX, barY, 0, barH, 0xb464ff).setOrigin(0, 0.5);

    this.load.on('progress', (/** @type {number} */ value) => {
      fill.width = barW * value;
    });

    // Load assets here when they exist
    // this.load.image('background', 'assets/images/background_one_rock.png');
  }

  create() {
    this.scene.start(SCENE_KEYS.TITLE);
  }
}
