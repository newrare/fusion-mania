import { layout } from '../managers/layout-manager.js';

/**
 * Add the layered parallax background to a Phaser scene.
 * Layers back → front: sky, rock, ground, cloud02, cloud01.
 * Images use "cover" sizing (fill viewport, preserve aspect ratio, crop excess).
 * Clouds scroll continuously at different speeds for a parallax feel.
 * @param {Phaser.Scene} scene
 */
export function addBackground(scene) {
  const { width, height } = layout;
  const cx = width / 2;
  const cy = height / 2;

  /**
   * Compute display size to cover the full viewport while preserving aspect ratio.
   * @param {string} key Phaser texture key
   * @returns {{ w: number, h: number }}
   */
  const coverSize = (key) => {
    const img = scene.textures.get(key).getSourceImage();
    const scale = Math.max(width / img.width, height / img.height);
    return { w: img.width * scale, h: img.height * scale };
  };

  // Static layers (cover)
  const sky = coverSize('bg-sky');
  scene.add.image(cx, cy, 'bg-sky').setDisplaySize(sky.w, sky.h).setDepth(0);

  const rock = coverSize('bg-rock');
  scene.add.image(cx, cy, 'bg-rock').setDisplaySize(rock.w, rock.h).setDepth(1);

  const ground = coverSize('bg-ground');
  scene.add.image(cx, cy, 'bg-ground').setDisplaySize(ground.w, ground.h).setDepth(2);

  // Scrolling clouds — tileSprite loops seamlessly
  const cloud02 = scene.add
    .tileSprite(cx, cy, width, height, 'bg-cloud02')
    .setDepth(3);

  const cloud01 = scene.add
    .tileSprite(cx, cy, width, height, 'bg-cloud01')
    .setDepth(4);

  const onUpdate = (_, delta) => {
    cloud02.tilePositionX -= delta * 0.006;
    cloud01.tilePositionX -= delta * 0.012;
  };

  scene.events.on('update', onUpdate);
  scene.events.once('shutdown', () => scene.events.off('update', onUpdate));
}
