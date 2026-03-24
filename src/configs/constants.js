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
};

/** Default options */
export const DEFAULT_OPTIONS = {
  music: true,
  sound: true,
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
  [POWER_TYPES.FIRE_H]:     { nameKey: 'power.fire_h',     svgId: 's-fire-h' },
  [POWER_TYPES.FIRE_V]:     { nameKey: 'power.fire_v',     svgId: 's-fire-v' },
  [POWER_TYPES.FIRE_X]:     { nameKey: 'power.fire_x',     svgId: 's-fire-x' },
  [POWER_TYPES.BOMB]:       { nameKey: 'power.bomb',       svgId: 's-bomb' },
  [POWER_TYPES.ICE]:        { nameKey: 'power.ice',        svgId: 's-ice' },
  [POWER_TYPES.TELEPORT]:   { nameKey: 'power.teleport',   svgId: 's-teleport' },
  [POWER_TYPES.EXPEL_H]:    { nameKey: 'power.expel_h',    svgId: 's-exp-r' },
  [POWER_TYPES.EXPEL_V]:    { nameKey: 'power.expel_v',    svgId: 's-exp-d' },
  [POWER_TYPES.WIND_UP]:    { nameKey: 'power.wind_up',    svgId: 's-wind-u' },
  [POWER_TYPES.WIND_DOWN]:  { nameKey: 'power.wind_down',  svgId: 's-wind-d' },
  [POWER_TYPES.WIND_LEFT]:  { nameKey: 'power.wind_left',  svgId: 's-wind-l' },
  [POWER_TYPES.WIND_RIGHT]: { nameKey: 'power.wind_right', svgId: 's-wind-r' },
  [POWER_TYPES.LIGHTNING]:  { nameKey: 'power.lightning',   svgId: 's-lightning' },
  [POWER_TYPES.NUCLEAR]:    { nameKey: 'power.nuclear',    svgId: 's-nuclear' },
  [POWER_TYPES.BLIND]:      { nameKey: 'power.blind',      svgId: 's-blind' },
  [POWER_TYPES.ADS]:        { nameKey: 'power.ads',        svgId: 's-ads' },
};

/** Grid sides where powers can be placed */
export const GRID_SIDES = ['top', 'bottom', 'left', 'right'];

/** Maps a grid side to the move direction that triggers it */
export const SIDE_TO_DIRECTION = {
  top: 'up',
  bottom: 'down',
  left: 'left',
  right: 'right',
};

/** Maps a move direction to the grid side */
export const DIRECTION_TO_SIDE = {
  up: 'top',
  down: 'bottom',
  left: 'left',
  right: 'right',
};

/** Moves between power placements */
export const POWER_PLACEMENT_INTERVAL = 2;

/** High-value tile threshold for danger coloring */
export const HIGH_VALUE_THRESHOLD = 32;

/** Default duration (in moves) for timed power effects */
export const POWER_DURATIONS = {
  ICE: 5,
  BLIND: 5,
  EXPEL: 5,
  WIND: 2,
};

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
