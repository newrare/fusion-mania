import Phaser from 'phaser';
import { SCENE_KEYS } from '../configs/constants.js';
import { layout } from '../managers/layout-manager.js';
import { audioManager } from '../managers/audio-manager.js';

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
    this.load.image('bg-sky', 'images/background_one_sky.png');
    this.load.image('bg-rock', 'images/background_one_rock.png');
    this.load.image('bg-ground', 'images/background_one_ground.png');
    this.load.image('bg-cloud02', 'images/background_one_cloud_02.png');
    this.load.image('bg-cloud01', 'images/background_one_cloud_01.png');

    // Audio (HTML5 Audio — independent of Phaser's loader)
    audioManager.preload();
  }

  create() {
    // Inject SVG power sprite sheet into the document once (global <use> access)
    fetch('images/power-sprites.svg')
      .then((r) => r.text())
      .then((svg) => {
        const wrapper = document.createElement('div');
        wrapper.id = 'fm-power-svgs';
        wrapper.style.display = 'none';
        wrapper.innerHTML = svg;
        document.body.appendChild(wrapper);
      });

    this.scene.start(SCENE_KEYS.TITLE);
  }
}
