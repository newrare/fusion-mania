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
};

/** Swipe detection */
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
export const MAX_SAVE_SLOTS = 10;

/** Default options */
export const DEFAULT_OPTIONS = {
  music: true,
  sound: true,
};

/** Audio file paths and settings */
export const AUDIO = {
  MUSIC: 'sounds/music.wav',
  MUSIC_VOLUME: 0.03,
  SFX_VOLUME: 0.3,
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
  ICE: 4,
  BLIND: 5,
  EXPEL: 5,
  WIND: 3,
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
  /** Enemy levels in progression order */
  LEVELS: [2, 4, 8, 16, 32, 64, 128, 256, 512, 1024, 2048],
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
