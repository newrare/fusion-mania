import { layout } from '../managers/layout-manager.js';

/* Helpers replacing Phaser.Math statics to avoid a Phaser import */
const rnd = (min, max) => Math.random() * (max - min) + min;
const rndInt = (min, max) => Math.floor(rnd(min, max + 1));
const clamp = (val, min, max) => Math.min(Math.max(val, min), max);

/* Fewer stars on mobile — each star runs a continuous tween chain.
   Touch devices (capacitor/mobile browsers) get 18 instead of 45. */
const IS_TOUCH = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
const STAR_COUNT = IS_TOUCH ? 18 : 45;
/* Base Y position of each cloud layer as a fraction of screen height */
const CLOUD01_BASE_Y = 0.18; // upper area  — depth below rock
const CLOUD02_BASE_Y = 0.58; // middle/slightly below — depth above rock, below ground
/* Max vertical shift: ±20 % of screen height */
const CLOUD_Y_VARIATION = 0.2;

/**
 * Add the layered parallax background to a Phaser scene.
 *
 * Depth order (back → front):
 *   sky (0) → stars (1) → cloud01 (2) → rock (3) → cloud02 (4) → ground (5)
 *
 * - Sky: tint-based brightness oscillation (visible darkening/brightening cycle).
 * - Stars: twinkling circles in the upper half of the sky, short initial delay.
 * - Shooting stars: occasional diagonal streaks with gradient tail.
 * - Clouds: per-pass random direction, opacity, flipX only, Y/size variation.
 *
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

  /* ── Static background layers ────────────────────────────────────────────── */
  const sky = coverSize('bg-sky');
  const skyImg = scene.add.image(cx, cy, 'bg-sky').setDisplaySize(sky.w, sky.h).setDepth(0);

  const rock = coverSize('bg-rock');
  scene.add.image(cx, cy, 'bg-rock').setDisplaySize(rock.w, rock.h).setDepth(3);

  const ground = coverSize('bg-ground');
  scene.add.image(cx, cy, 'bg-ground').setDisplaySize(ground.w, ground.h).setDepth(5);

  /* ── Sky brightness variation (tint-based — clearly visible) ──────────────── */
  /* brightness 1.0 = full colour, 0.28 ≈ very dark night */
  const skyState = { brightness: 1.0 };
  const animateSkyBrightness = () => {
    const target = rnd(0.28, 1.0);
    scene.tweens.add({
      targets: skyState,
      brightness: target,
      duration: rndInt(4000, 14000),
      ease: 'Sine.easeInOut',
      onUpdate: () => {
        const v = Math.floor(skyState.brightness * 255);
        /* Shift toward cold blue as it darkens, as a moonlit sky would */
        const r = Math.floor(v * 0.62);
        const g = Math.floor(v * 0.74);
        const b = Math.min(255, Math.floor(v * 1.08));
        skyImg.setTint((r << 16) | (g << 8) | b);
      },
      onComplete: animateSkyBrightness,
    });
  };
  animateSkyBrightness();

  /* ── Twinkling stars (upper half of the sky) ─────────────────────────────── */
  for (let i = 0; i < STAR_COUNT; i++) {
    const x = rndInt(4, width - 4);
    const y = rndInt(4, Math.floor(height * 0.48));
    /* scene.add.arc: explicit arc API available in all Phaser 3 versions */
    const star = scene.add
      .arc(x, y, rnd(1.0, 2.5), 0, 360, false, 0xffffff, 1)
      .setAlpha(0)
      .setDepth(1);

    const twinkle = () => {
      const peak = rnd(0.55, 1.0);
      const rise = rndInt(400, 1600);
      const hold = rndInt(150, 2500);
      const fall = rndInt(400, 1600);
      const idle = rndInt(400, 5500);
      scene.tweens.add({
        targets: star,
        alpha: peak,
        duration: rise,
        ease: 'Sine.easeInOut',
        onComplete: () => {
          scene.tweens.add({
            targets: star,
            alpha: 0,
            duration: fall,
            delay: hold,
            ease: 'Sine.easeInOut',
            onComplete: () => scene.time.delayedCall(idle, twinkle),
          });
        },
      });
    };
    /* Stagger over 3 s so all stars don't pop on at the same time */
    scene.time.delayedCall(rndInt(0, 3000), twinkle);
  }

  /* ── Shooting stars ──────────────────────────────────────────────────────── */
  const spawnShootingStar = () => {
    const headX = rndInt(Math.floor(width * 0.08), Math.floor(width * 0.92));
    const headY = rndInt(8, Math.floor(height * 0.38));
    const toRight = Math.random() < 0.5;
    const angle = rnd(15, 50) * (Math.PI / 180);
    const tailLen = rnd(50, 130);
    const travelDist = rnd(90, 200);
    const duration = rndInt(300, 750);
    const cosA = Math.cos(angle);
    const sinA = Math.sin(angle);
    const dirX = toRight ? cosA : -cosA;
    const dirY = sinA;

    const g = scene.add.graphics().setDepth(1);
    /* Draw gradient tail in local space: head at (0,0), tail opposite to travel */
    const steps = 10;
    for (let s = 0; s < steps; s++) {
      const t0 = s / steps;
      const t1 = (s + 1) / steps;
      g.lineStyle(Math.max(0.4, 1.8 - t0 * 1.3), 0xffffff, (1 - t0) * 0.95);
      g.beginPath();
      g.moveTo(-dirX * tailLen * t0, -dirY * tailLen * t0);
      g.lineTo(-dirX * tailLen * t1, -dirY * tailLen * t1);
      g.strokePath();
    }
    g.x = headX;
    g.y = headY;

    /* Move the star across the sky */
    scene.tweens.add({
      targets: g,
      x: headX + dirX * travelDist,
      y: headY + dirY * travelDist,
      duration,
      ease: 'Linear',
    });
    /* Fade out in the second half of the travel */
    scene.tweens.add({
      targets: g,
      alpha: 0,
      duration: duration * 0.45,
      delay: duration * 0.55,
      ease: 'Sine.easeIn',
      onComplete: () => {
        g.destroy();
        scene.time.delayedCall(rndInt(4000, 30000), spawnShootingStar);
      },
    });
  };
  scene.time.delayedCall(rndInt(800, 6000), spawnShootingStar);

  /* ── Cloud helpers ───────────────────────────────────────────────────────── */

  /**
   * Spawn a single cloud that crosses the screen once, then calls onDone.
   * @param {{ key: string, depth: number, baseY: number }} cfg
   * @param {(() => void) | undefined} onDone  Called when the cloud exits the screen.
   */
  const spawnCloudOnce = (cfg, onDone) => {
    const goRight = Math.random() < 0.5;
    const opacity = rnd(0.1, 1.0);
    const flipX = Math.random() < 0.5;
    /* Random size: 60–100 % of the base size, no distortion */
    const sizeFactor = rnd(0.6, 1.0);
    const yShift = rnd(-CLOUD_Y_VARIATION, CLOUD_Y_VARIATION) * height;
    const y = clamp(cfg.baseY + yShift, 0, height);

    const img = scene.textures.get(cfg.key).getSourceImage();
    const cloudW = width * rnd(0.45, 0.9) * sizeFactor;
    const cloudH = (img.height / img.width) * cloudW;

    const startX = goRight ? -(cloudW / 2) : width + cloudW / 2;
    const endX = goRight ? width + cloudW / 2 : -(cloudW / 2);
    /* Speed: 8–20 px/s (20 is the max, very slow passes are possible) */
    const speedPxPerSec = rnd(8, 20);
    const moveDuration = ((width + cloudW) / speedPxPerSec) * 1000;

    const cloud = scene.add
      .image(startX, y, cfg.key)
      .setDisplaySize(cloudW, cloudH)
      .setAlpha(0)
      .setDepth(cfg.depth)
      .setFlipX(flipX);

    /* Fade in as the cloud enters the screen */
    scene.tweens.add({ targets: cloud, alpha: opacity, duration: 2000, ease: 'Sine.easeIn' });

    /* Traverse the screen */
    scene.tweens.add({
      targets: cloud,
      x: endX,
      duration: moveDuration,
      ease: 'Linear',
      onComplete: () => {
        cloud.destroy();
        if (onDone) onDone();
      },
    });
  };

  /**
   * Main scheduling loop for one cloud layer.
   * - 15 % of the time: skips this cycle entirely (produces "no cloud" gaps).
   * - 30 % of the time: spawns a bonus cloud slightly offset in time.
   * - Always spawns a primary cloud whose arrival triggers the next loop.
   * @param {{ key: string, depth: number, baseY: number }} cfg
   */
  const cloudLoop = (cfg) => {
    /* Occasional empty sky — no cloud this cycle */
    if (Math.random() < 0.15) {
      scene.time.delayedCall(rndInt(6000, 18000), () => cloudLoop(cfg));
      return;
    }

    /* Occasionally add a bonus cloud (independent, does not drive the loop) */
    if (Math.random() < 0.3) {
      scene.time.delayedCall(rndInt(400, 4000), () => spawnCloudOnce(cfg, undefined));
    }

    /* Primary cloud — drives the next iteration when it exits the screen */
    spawnCloudOnce(cfg, () => {
      scene.time.delayedCall(rndInt(3000, 18000), () => cloudLoop(cfg));
    });
  };

  /* ── Kick off each cloud layer independently ─────────────────────────────── */
  scene.time.delayedCall(rndInt(0, 2000), () =>
    cloudLoop({ key: 'bg-cloud01', depth: 2, baseY: height * CLOUD01_BASE_Y }),
  );
  scene.time.delayedCall(rndInt(0, 2000), () =>
    cloudLoop({ key: 'bg-cloud02', depth: 4, baseY: height * CLOUD02_BASE_Y }),
  );
}
