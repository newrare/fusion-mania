/** Scene keys used across the game */
export const SCENE_KEYS = {
  BOOT: 'BootScene',
  PRELOAD: 'PreloadScene',
  TITLE: 'TitleScene',
  GRID: 'GameScene',
};

/** Grid dimensions */
export const GRID_SIZE = 4;

/** All possible tile values (admin panel, scoring, theming) */
export const TILE_VALUES = [2, 4, 8, 16, 32, 64, 128, 256, 512, 1024, 2048, 4096];

/** Tile spawn values and probabilities */
export const SPAWN_VALUES = [2, 4];
export const SPAWN_WEIGHTS = [0.9, 0.1];

/** Animation durations (ms) */
export const ANIM = {
  SLIDE_DURATION: 120,
  MERGE_DURATION: 300,
  SPAWN_DURATION: 200,
  MERGE_PARTICLES_DURATION: 80,
  /** Reference duration for fire-ball flight across one grid width (ms).
   * Also used as the base for computing per-ball speed (px/ms). */
  FIRE_BALL_DURATION: 500,
  /** Duration of the ZAP tile-destruction animation (ms) */
  FIRE_ZAP_DURATION: 650,
  /** Duration of the teleport cross-arc swap animation (ms) */
  TELEPORT_DURATION: 540,
  /** Duration of a single lightning bolt strike animation (ms) */
  LIGHTNING_ANIM_DURATION: 1500,
  /** Delay between consecutive lightning strikes when multiple columns are hit (ms) */
  LIGHTNING_STRIKE_DELAY: 350,
  /** Delay from strike start to bolt impact (26% of LIGHTNING_ANIM_DURATION — matches the CSS keyframe) */
  LIGHTNING_IMPACT_AT: 390,
  /** Duration of bomb explosion animation (ms) */
  BOMB_DURATION: 700,
  /** Duration of nuclear blast animation (ms); tiles are removed at NUCLEAR_TILE_REMOVE_AT */
  NUCLEAR_DURATION: 1900,
  /** Delay inside NUCLEAR_DURATION before tile DOM nodes are removed (ms) */
  NUCLEAR_TILE_REMOVE_AT: 820,
  /** Duration of ads modal display (ms) */
  ADS_DURATION: 3000,
  /** Duration of the ads overlay entrance animation (ms) — countdown starts after this */
  ADS_OPEN_DURATION: 1500,
  /** Duration of the ads overlay exit animation (ms) */
  ADS_CLOSE_DURATION: 300,
  /** Duration of the directional bump animation when no tile can move (ms) */
  BUMP_DURATION: 180,
};

/** Background pan settings */
export const BG = {
  /** Horizontal pan speed for narrow viewports (px/s). Lower = slower drift. */
  PAN_SPEED_PX_S: 4,
  /** Viewport coverage threshold above which panning is disabled (0–1). */
  PAN_THRESHOLD: 0.9,
};

/** Swipe detection — detect-on-move architecture.
 *  Direction fires during touchmove as soon as the threshold is crossed.
 *  One direction per gesture (flag-based), no time-based cooldown. */
export const SWIPE_THRESHOLD = 30;

/** localStorage keys */
export const STORAGE_KEYS = {
  LOCALE: 'fusionmania_locale',
  SAVE: 'fusionmania_save',
  RANKINGS: 'fusionmania_rankings',
  OPTIONS: 'fusionmania_options',
  THEME: 'fusionmania_theme',
  SAVE_SLOTS: 'fusionmania_save_slots',
  AUTOSAVE: 'fusionmania_autosave',
};

/** Maximum number of save slots */
export const MAX_SAVE_SLOTS = 8;

/** Default options */
export const DEFAULT_OPTIONS = {
  music: true,
  sound: true,
};

/** Audio file paths and settings */
export const AUDIO = {
  MUSIC: 'sounds/music.wav',
  MUSIC_VOLUME: 0.05,
  /** Base SFX volume — each key can be adjusted via SFX_VOLUMES multiplier */
  SFX_VOLUME: 0.3,
  /** Per-key volume multipliers (applied on top of SFX_VOLUME). Tune these to balance levels on mobile. */
  SFX_VOLUMES: {
    click: 0.5,
    hover: 0.15,
    fusion: 1.5,
    victory: 0.9,
    gameOver: 0.9,
    notification: 0.8,
    gridHurt: 0.9,
    enemyHurt: 0.5,
    enemyDeath: 1.0,
    enemyIn: 0.8,
    contamination: 0.5,
  },
  /** Per-key volume multipliers for power SFX */
  POWER_SFX_VOLUMES: {
    'fire-h': 0.9,
    'fire-v': 0.9,
    'fire-x': 0.9,
    bomb: 1.0,
    lightning: 0.9,
    nuclear: 1.0,
    teleport: 0.8,
    ice: 0.7,
    'expel-h-in': 0.8,
    'expel-v-in': 0.8,
    wind: 0.7,
    blind: 0.7,
  },
  SFX: {
    click: 'sounds/sfx-click.ogg',
    hover: 'sounds/sfx-hover.ogg',
    fusion: 'sounds/sfx-fusion.ogg',
    victory: 'sounds/sfx-victory.ogg',
    gameOver: 'sounds/sfx-game-over.ogg',
    notification: 'sounds/sfx-notification.ogg',
    gridHurt: 'sounds/sfx-grid-hurt.ogg',
    enemyHurt: 'sounds/sfx-enemy-hurt.ogg',
    enemyDeath: 'sounds/sfx-death-enemy.ogg',
    enemyIn: 'sounds/sfx-enemy-in.ogg',
    contamination: 'sounds/sfx-contamination.ogg',
  },
  /**
   * Maps power identifiers to SFX file paths.
   * Expel powers use -in (tile fuses with expel) / -out (tile leaves grid).
   * All wind variants share a single SFX. Lightning is played per-strike.
   */
  POWER_SFX: {
    'fire-h': 'sounds/sfx-power-fire-horizontal.ogg',
    'fire-v': 'sounds/sfx-power-fire-vertical.ogg',
    'fire-x': 'sounds/sfx-power-fire-cross.ogg',
    bomb: 'sounds/sfx-power-bomb.ogg',
    lightning: 'sounds/sfx-power-lightning.ogg',
    nuclear: 'sounds/sfx-power-nuclear.ogg',
    teleport: 'sounds/sfx-power-teleport.ogg',
    ice: 'sounds/sfx-power-ice.ogg',
    'expel-h-in': 'sounds/sfx-power-expel-horizontal.ogg',
    'expel-v-in': 'sounds/sfx-power-expel-vertical.ogg',
    wind: 'sounds/sfx-power-wind.ogg',
    blind: 'sounds/sfx-power-blind.ogg',
  },
};

/** Power type identifiers */
export const POWER_TYPES = {
  FIRE_H: 'fire-h',
  FIRE_V: 'fire-v',
  FIRE_X: 'fire-x',
  BOMB: 'bomb',
  ICE: 'ice',
  TELEPORT: 'teleport',
  EXPEL_H: 'expel-h',
  EXPEL_V: 'expel-v',
  WIND_UP: 'wind-up',
  WIND_DOWN: 'wind-down',
  WIND_LEFT: 'wind-left',
  WIND_RIGHT: 'wind-right',
  LIGHTNING: 'lightning',
  NUCLEAR: 'nuclear',
  BLIND: 'blind',
  ADS: 'ads',
};

/** Power metadata: name key (i18n), SVG symbol ID */
export const POWER_META = {
  [POWER_TYPES.FIRE_H]: { nameKey: 'power.fire_h', svgId: 's-fire-h' },
  [POWER_TYPES.FIRE_V]: { nameKey: 'power.fire_v', svgId: 's-fire-v' },
  [POWER_TYPES.FIRE_X]: { nameKey: 'power.fire_x', svgId: 's-fire-x' },
  [POWER_TYPES.BOMB]: { nameKey: 'power.bomb', svgId: 's-bomb' },
  [POWER_TYPES.ICE]: { nameKey: 'power.ice', svgId: 's-ice' },
  [POWER_TYPES.TELEPORT]: { nameKey: 'power.teleport', svgId: 's-teleport' },
  [POWER_TYPES.EXPEL_H]: { nameKey: 'power.expel_h', svgId: 's-exp-r' },
  [POWER_TYPES.EXPEL_V]: { nameKey: 'power.expel_v', svgId: 's-exp-d' },
  [POWER_TYPES.WIND_UP]: { nameKey: 'power.wind_up', svgId: 's-wind-u' },
  [POWER_TYPES.WIND_DOWN]: { nameKey: 'power.wind_down', svgId: 's-wind-d' },
  [POWER_TYPES.WIND_LEFT]: { nameKey: 'power.wind_left', svgId: 's-wind-l' },
  [POWER_TYPES.WIND_RIGHT]: { nameKey: 'power.wind_right', svgId: 's-wind-r' },
  [POWER_TYPES.LIGHTNING]: { nameKey: 'power.lightning', svgId: 's-lightning' },
  [POWER_TYPES.NUCLEAR]: { nameKey: 'power.nuclear', svgId: 's-nuclear' },
  [POWER_TYPES.BLIND]: { nameKey: 'power.blind', svgId: 's-blind' },
  [POWER_TYPES.ADS]: { nameKey: 'power.ads', svgId: 's-ads' },
};

/** Moves between power placements */
export const POWER_PLACEMENT_INTERVAL = 2;

/** Power categories for badge coloring — ordered by severity */
export const POWER_CATEGORIES = {
  danger: [
    POWER_TYPES.FIRE_H,
    POWER_TYPES.FIRE_V,
    POWER_TYPES.FIRE_X,
    POWER_TYPES.BOMB,
    POWER_TYPES.NUCLEAR,
    POWER_TYPES.LIGHTNING,
  ],
  warning: [POWER_TYPES.TELEPORT, POWER_TYPES.EXPEL_H, POWER_TYPES.EXPEL_V, POWER_TYPES.BLIND],
  info: [
    POWER_TYPES.WIND_UP,
    POWER_TYPES.WIND_DOWN,
    POWER_TYPES.WIND_LEFT,
    POWER_TYPES.WIND_RIGHT,
    POWER_TYPES.ICE,
  ],
};

/**
 * Behavioral classification — how a power is charged and triggered.
 * - `target`: charged on a grid edge; uses the targeted tile (sunburst) as source.
 * - `global`: charged on a grid edge; affects the whole grid (no targeted tile).
 * - `special`: charged on a grid edge; has a bespoke visual on potential victims.
 * - `direct`: not charged — applied directly to a random tile by the game/enemy.
 */
export const POWER_BEHAVIOR = {
  target: [
    POWER_TYPES.FIRE_H,
    POWER_TYPES.FIRE_V,
    POWER_TYPES.FIRE_X,
    POWER_TYPES.BOMB,
    POWER_TYPES.TELEPORT,
  ],
  global: [
    POWER_TYPES.NUCLEAR,
    POWER_TYPES.WIND_UP,
    POWER_TYPES.WIND_DOWN,
    POWER_TYPES.WIND_LEFT,
    POWER_TYPES.WIND_RIGHT,
    POWER_TYPES.BLIND,
    POWER_TYPES.ADS,
  ],
  special: [POWER_TYPES.LIGHTNING],
  direct: [POWER_TYPES.ICE, POWER_TYPES.EXPEL_H, POWER_TYPES.EXPEL_V],
};

/**
 * Get the badge color category for a power type.
 * @param {string} type — POWER_TYPES value
 * @returns {'danger' | 'warning' | 'info'}
 */
export function getPowerCategory(type) {
  if (POWER_CATEGORIES.danger.includes(type)) return 'danger';
  if (POWER_CATEGORIES.warning.includes(type)) return 'warning';
  return 'info';
}

/** Default duration (in moves) for timed power effects */
export const POWER_DURATIONS = {
  ICE: 200,
  BLIND: 2,
  EXPEL: 5,
  WIND: 2,
};

/**
 * Grid Life system — HP bar for Free mode.
 * When destructive powers or expel effects remove tiles, the grid takes damage.
 * Damage formula: sum(log2(tileValue)) × DAMAGE_MULTIPLIER × (1 + totalDestroyed × SCALING_FACTOR)
 */
export const GRID_LIFE = {
  /** Starting HP — tune this for desired game length */
  MAX_HP: 50,
  /** Base damage multiplier — lower = easier, higher = harder */
  DAMAGE_MULTIPLIER: 1.0,
  /** Extra damage per tile previously destroyed (+0.5% each) */
  SCALING_FACTOR: 0.005,
  /** HP percentage below which the critical screen overlay appears */
  CRITICAL_THRESHOLD: 0.1,
};

/**
 * Battle Mode — enemy system constants.
 */
export const BATTLE = {
  /** Moves in classic phase before an enemy can appear */
  CLASSIC_MOVES: 10,
  /** HP multiplier for enemy: HP = log2(level) × HP_PER_LEVEL */
  HP_PER_LEVEL: 10,
  /** Enemy levels in progression order (legacy — used as fallback when no battleLevel is set) */
  LEVELS: [2, 4, 8, 16, 32, 64, 128, 256, 512, 1024, 2048],
  /**
   * 30 battle levels grouped into 3 tiers of 10.
   * Each entry is an array of enemy values; the last one is the Boss.
   */
  BATTLE_LEVELS: [
    // ── Easy (1–10) ──
    [2, 4, 8],
    [2, 8, 16],
    [2, 16, 32],
    [4, 16, 32],
    [4, 16, 64],
    [4, 32, 64],
    [8, 32, 128],
    [8, 64, 128],
    [16, 64, 256],
    [16, 128, 256],
    // ── Normal (11–20) ──
    [4, 16, 64, 256],
    [4, 32, 128, 256],
    [8, 32, 128, 512],
    [8, 64, 256, 512],
    [8, 64, 256, 512],
    [16, 64, 256, 512],
    [16, 128, 256, 1024],
    [16, 128, 512, 1024],
    [32, 128, 512, 1024],
    [32, 256, 512, 1024],
    // ── Hard (21–30) ──
    [8, 32, 64, 256, 1024],
    [8, 32, 128, 256, 1024],
    [16, 32, 128, 512, 1024],
    [16, 64, 128, 512, 1024],
    [16, 64, 256, 512, 2048],
    [32, 64, 256, 1024, 2048],
    [32, 128, 256, 1024, 2048],
    [32, 128, 512, 1024, 2048],
    [64, 128, 512, 1024, 2048],
    [64, 256, 512, 1024, 2048],
  ],
  /** Tier boundaries for BATTLE_LEVELS (0-indexed) */
  TIER_EASY: { start: 0, end: 10 },
  TIER_NORMAL: { start: 10, end: 20 },
  TIER_HARD: { start: 20, end: 30 },
  /** Level difficulty bonus multiplier applied to the final score (always, win or lose) */
  LEVEL_BONUS_EASY: 0.05,
  LEVEL_BONUS_NORMAL: 0.10,
  LEVEL_BONUS_HARD: 0.20,
  /** Additional victory score bonus multiplier applied on top of level bonus upon winning */
  VICTORY_BONUS_EASY: 0.10,
  VICTORY_BONUS_NORMAL: 0.25,
  VICTORY_BONUS_HARD: 0.50,
  /** Available powers for each enemy level */
  LEVEL_POWERS: {
    2: [POWER_TYPES.ICE],
    4: [POWER_TYPES.WIND_UP, POWER_TYPES.WIND_DOWN, POWER_TYPES.WIND_LEFT, POWER_TYPES.WIND_RIGHT],
    8: [POWER_TYPES.EXPEL_V, POWER_TYPES.EXPEL_H],
    16: [POWER_TYPES.BLIND],
    32: [POWER_TYPES.FIRE_H, POWER_TYPES.FIRE_V, POWER_TYPES.ADS],
    64: [POWER_TYPES.FIRE_X, POWER_TYPES.ADS],
    128: [POWER_TYPES.BOMB, POWER_TYPES.ADS],
    256: [
      POWER_TYPES.ICE,
      POWER_TYPES.WIND_UP,
      POWER_TYPES.WIND_DOWN,
      POWER_TYPES.WIND_LEFT,
      POWER_TYPES.WIND_RIGHT,
      POWER_TYPES.EXPEL_V,
      POWER_TYPES.EXPEL_H,
      POWER_TYPES.BLIND,
      POWER_TYPES.FIRE_H,
      POWER_TYPES.FIRE_V,
      POWER_TYPES.TELEPORT,
      POWER_TYPES.LIGHTNING,
      POWER_TYPES.ADS,
    ],
    512: [
      POWER_TYPES.ICE,
      POWER_TYPES.WIND_UP,
      POWER_TYPES.WIND_DOWN,
      POWER_TYPES.WIND_LEFT,
      POWER_TYPES.WIND_RIGHT,
      POWER_TYPES.EXPEL_V,
      POWER_TYPES.EXPEL_H,
      POWER_TYPES.BLIND,
      POWER_TYPES.FIRE_H,
      POWER_TYPES.FIRE_V,
      POWER_TYPES.FIRE_X,
      POWER_TYPES.TELEPORT,
      POWER_TYPES.LIGHTNING,
      POWER_TYPES.ADS,
    ],
    1024: [
      POWER_TYPES.ICE,
      POWER_TYPES.WIND_UP,
      POWER_TYPES.WIND_DOWN,
      POWER_TYPES.WIND_LEFT,
      POWER_TYPES.WIND_RIGHT,
      POWER_TYPES.EXPEL_V,
      POWER_TYPES.EXPEL_H,
      POWER_TYPES.BLIND,
      POWER_TYPES.FIRE_H,
      POWER_TYPES.FIRE_V,
      POWER_TYPES.FIRE_X,
      POWER_TYPES.BOMB,
      POWER_TYPES.TELEPORT,
      POWER_TYPES.LIGHTNING,
      POWER_TYPES.ADS,
    ],
    2048: [
      POWER_TYPES.ICE,
      POWER_TYPES.WIND_UP,
      POWER_TYPES.WIND_DOWN,
      POWER_TYPES.WIND_LEFT,
      POWER_TYPES.WIND_RIGHT,
      POWER_TYPES.EXPEL_V,
      POWER_TYPES.EXPEL_H,
      POWER_TYPES.BLIND,
      POWER_TYPES.FIRE_H,
      POWER_TYPES.FIRE_V,
      POWER_TYPES.FIRE_X,
      POWER_TYPES.BOMB,
      POWER_TYPES.NUCLEAR,
      POWER_TYPES.TELEPORT,
      POWER_TYPES.LIGHTNING,
      POWER_TYPES.ADS,
    ],
  },
  /**
   * Initial power stock per enemy level.
   * Each entry maps a power type to the number of times the enemy can cast it
   * during the fight. When the counter reaches 0, the power is removed.
   * Tune these values to balance the difficulty of each enemy.
   */
  ENEMY_POWER_STOCK: {
    2: {
      [POWER_TYPES.ICE]: 3,
    },
    4: {
      [POWER_TYPES.WIND_UP]: 1,
      [POWER_TYPES.WIND_DOWN]: 1,
      [POWER_TYPES.WIND_LEFT]: 1,
      [POWER_TYPES.WIND_RIGHT]: 1,
    },
    8: {
      [POWER_TYPES.EXPEL_H]: 2,
      [POWER_TYPES.EXPEL_V]: 2,
    },
    16: {
      [POWER_TYPES.BLIND]: 3,
    },
    32: {
      [POWER_TYPES.FIRE_H]: 2,
      [POWER_TYPES.FIRE_V]: 2,
      [POWER_TYPES.ADS]: 1,
    },
    64: {
      [POWER_TYPES.FIRE_X]: 2,
      [POWER_TYPES.ADS]: 2,
    },
    128: {
      [POWER_TYPES.BOMB]: 3,
      [POWER_TYPES.ADS]: 2,
    },
    256: {
      [POWER_TYPES.ICE]: 2,
      [POWER_TYPES.WIND_UP]: 1,
      [POWER_TYPES.WIND_DOWN]: 1,
      [POWER_TYPES.EXPEL_H]: 1,
      [POWER_TYPES.EXPEL_V]: 1,
      [POWER_TYPES.BLIND]: 2,
      [POWER_TYPES.FIRE_H]: 1,
      [POWER_TYPES.FIRE_V]: 1,
      [POWER_TYPES.TELEPORT]: 2,
      [POWER_TYPES.LIGHTNING]: 2,
      [POWER_TYPES.ADS]: 1,
    },
    512: {
      [POWER_TYPES.ICE]: 3,
      [POWER_TYPES.WIND_UP]: 1,
      [POWER_TYPES.WIND_DOWN]: 1,
      [POWER_TYPES.WIND_LEFT]: 1,
      [POWER_TYPES.WIND_RIGHT]: 1,
      [POWER_TYPES.EXPEL_H]: 2,
      [POWER_TYPES.EXPEL_V]: 2,
      [POWER_TYPES.BLIND]: 2,
      [POWER_TYPES.FIRE_H]: 2,
      [POWER_TYPES.FIRE_V]: 2,
      [POWER_TYPES.FIRE_X]: 1,
      [POWER_TYPES.TELEPORT]: 2,
      [POWER_TYPES.LIGHTNING]: 2,
      [POWER_TYPES.ADS]: 2,
    },
    1024: {
      [POWER_TYPES.ICE]: 3,
      [POWER_TYPES.WIND_UP]: 2,
      [POWER_TYPES.WIND_DOWN]: 2,
      [POWER_TYPES.WIND_LEFT]: 2,
      [POWER_TYPES.WIND_RIGHT]: 2,
      [POWER_TYPES.EXPEL_H]: 2,
      [POWER_TYPES.EXPEL_V]: 2,
      [POWER_TYPES.BLIND]: 3,
      [POWER_TYPES.FIRE_H]: 2,
      [POWER_TYPES.FIRE_V]: 2,
      [POWER_TYPES.FIRE_X]: 2,
      [POWER_TYPES.BOMB]: 2,
      [POWER_TYPES.TELEPORT]: 2,
      [POWER_TYPES.LIGHTNING]: 3,
      [POWER_TYPES.ADS]: 2,
    },
    2048: {
      [POWER_TYPES.ICE]: 4,
      [POWER_TYPES.WIND_UP]: 2,
      [POWER_TYPES.WIND_DOWN]: 2,
      [POWER_TYPES.WIND_LEFT]: 2,
      [POWER_TYPES.WIND_RIGHT]: 2,
      [POWER_TYPES.EXPEL_H]: 3,
      [POWER_TYPES.EXPEL_V]: 3,
      [POWER_TYPES.BLIND]: 3,
      [POWER_TYPES.FIRE_H]: 3,
      [POWER_TYPES.FIRE_V]: 3,
      [POWER_TYPES.FIRE_X]: 2,
      [POWER_TYPES.BOMB]: 2,
      [POWER_TYPES.NUCLEAR]: 1,
      [POWER_TYPES.TELEPORT]: 2,
      [POWER_TYPES.LIGHTNING]: 3,
      [POWER_TYPES.ADS]: 2,
    },
  },
  /** Duration of contamination animation (ms) */
  CONTAMINATE_DURATION: 400,
  /** Duration of enemy death animation (ms) */
  DEATH_DURATION: 800,
  /** Gravity for dead enemy tile physics (px/s²) */
  DEATH_GRAVITY: 1800,
};

/**
 * Enemy face image indices per emotion folder.
 * Matches the files present in public/images/faces/{folder}/.
 */
export const ENEMY_FACES = {
  ok: [
    1, 2, 7, 9, 13, 14, 17, 22, 23, 25, 27, 29, 31, 34, 38, 39, 41, 42, 43, 45, 46, 49, 54, 58, 59,
    63, 64, 66, 69, 72, 73, 83, 85, 86, 91, 93, 98,
  ],
  warning: [
    15, 18, 24, 26, 32, 40, 44, 47, 48, 50, 51, 52, 57, 62, 70, 77, 78, 80, 82, 89, 90, 92, 94, 96,
    99,
  ],
  danger: [
    3, 5, 8, 10, 16, 20, 21, 28, 30, 33, 35, 36, 37, 55, 60, 61, 65, 71, 74, 76, 81, 84, 88, 95,
    100,
  ],
  death: [6, 11, 12, 19, 56, 67, 68, 75, 87],
};

const LIFE_CAT_TO_FACE_FOLDER = { info: 'ok', warning: 'warning', danger: 'danger' };

/**
 * Returns a random face image URL for the given life category.
 * @param {'info' | 'warning' | 'danger' | 'death'} category
 * @returns {string}
 */
export function getRandomFaceUrl(category) {
  const folder = category === 'death' ? 'death' : (LIFE_CAT_TO_FACE_FOLDER[category] ?? 'ok');
  const nums = ENEMY_FACES[folder];
  const num = nums[Math.floor(Math.random() * nums.length)];
  return `images/faces/${folder}/${num}.png`;
}

/**
 * Combo hit label colors — pale red at level 1, escalating to vivid red.
 * Index 0 = first hit (x1), wraps around after the last entry.
 */
export const COMBO_COLORS = [
  '#ff9999', // x1 - pale rose
  '#ff7777', // x2
  '#ff5555', // x3
  '#ff3333', // x4
  '#ff1111', // x5
  '#ee0000', // x6
  '#cc0000', // x7
  '#aa0000', // x8+ - deep blood red
];
