/** Scene keys used across the game */
export const SCENE_KEYS = {
  BOOT: 'BootScene',
  PRELOAD: 'PreloadScene',
  TITLE: 'TitleScene',
  GRID: 'GridScene',
};

/** Grid dimensions */
export const GRID_SIZE = 4;

/** Tile spawn values and probabilities */
export const SPAWN_VALUES = [2, 4];
export const SPAWN_WEIGHTS = [0.9, 0.1];

/** Animation durations (ms) */
export const ANIM = {
  SLIDE_DURATION: 120,
  MERGE_DURATION: 150,
  SPAWN_DURATION: 100,
};

/** Swipe detection */
export const SWIPE_THRESHOLD = 30;

/** localStorage keys */
export const STORAGE_KEYS = {
  LOCALE: 'fusionmania_locale',
  SAVE: 'fusionmania_save',
  RANKINGS: 'fusionmania_rankings',
  OPTIONS: 'fusionmania_options',
};

/** Tile color palette (matching preview-game.html) */
export const TILE_COLORS = {
  2:    { bg: '#fff2ff', text: '#d44db8', border: '#d44db8' },
  4:    { bg: '#ffe5fd', text: '#c02ea8', border: '#c02ea8' },
  8:    { bg: '#ffd6f5', text: '#aa0f96', border: '#aa0f96' },
  16:   { bg: '#ffcaff', text: '#8800b8', border: '#8800b8' },
  32:   { bg: '#edd2ff', text: '#6600cc', border: '#6600cc' },
  64:   { bg: '#dcc2ff', text: '#4400e0', border: '#4400e0' },
  128:  { bg: 'linear-gradient(135deg, #c8b8ff, #a898ff)', text: '#1a00cc', border: '#1a00cc' },
  256:  { bg: 'linear-gradient(135deg, #b0ceff, #8ab2ff)', text: '#0030ee', border: '#0030ee' },
  512:  { bg: 'linear-gradient(135deg, #a0eedc, #6cd8c0, #a0eedc)', text: '#006699', border: '#006699' },
  1024: { bg: 'linear-gradient(135deg, #aaffe0, #72e8a8, #aaffe0)', text: '#00aa44', border: '#00aa44' },
  2048: { bg: 'linear-gradient(135deg, #fff580, #ffd0ea, #bce8ff, #c8ffda, #fff580)', text: '#cc8800', border: '#cc8800' },
};

/** Default options */
export const DEFAULT_OPTIONS = {
  music: true,
  sound: true,
};
