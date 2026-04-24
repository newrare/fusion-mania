import Phaser from 'phaser';
import { BootScene } from '../scenes/boot-scene.js';
import { PreloadScene } from '../scenes/preload-scene.js';
import { TitleScene } from '../scenes/title-scene.js';
import { TutorialScene } from '../scenes/tutorial-scene.js';
import { GameScene } from '../scenes/game-scene.js';

/* Cap the Phaser canvas resolution on high-DPI mobile screens.
   The canvas renders background imagery (sky, clouds, stars) — 2× is
   indistinguishable from 3× at phone viewing distance but costs 44 % fewer pixels. */
const maxDpr = Math.min(window.devicePixelRatio || 1, 2);

/** @type {Phaser.Types.Core.GameConfig} */
const gameConfig = {
  type: Phaser.CANVAS,
  parent: 'game-container',
  backgroundColor: '#1a0a2e',
  /* Use CANVAS renderer instead of AUTO/WEBGL. The game draws tiles via DOM/CSS,
     so the Phaser canvas only renders static backgrounds + star tweens. CANVAS
     avoids the WebGL context overhead and the heavy texture-upload pipeline that
     WebGL requires on mobile for what amounts to a few image blits. */
  scale: {
    mode: Phaser.Scale.RESIZE,
  },
  render: {
    pixelArt: false,
    resolution: maxDpr,
  },
  physics: {
    default: 'matter',
    matter: {
      gravity: { y: 1.5 },
      debug: false,
      enableSleeping: true,
      /* Cap the physics timestep at 30 Hz (33.3 ms). Without this, a large
         frame-time spike on mobile (common in WebView) produces an enormous
         delta that Matter.js applies in a single step, causing bodies to
         teleport instead of falling smoothly. */
      getDelta: () => 33.33,
    },
  },
  dom: {
    createContainer: true,
  },
  scene: [BootScene, PreloadScene, TitleScene, TutorialScene, GameScene],
};

export default gameConfig;
