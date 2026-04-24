/** Scene keys used across the game */
export const SCENE_KEYS = {
  BOOT: 'BootScene',
  PRELOAD: 'PreloadScene',
  TITLE: 'TitleScene',
  TUTORIAL: 'TutorialScene',
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
  /** Duration of the blind-immunity shield flash on immune tiles (ms) */
  BLIND_IMMUNITY_FLASH_DURATION: 500,
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
  animSkip: false,
};

/** Audio file paths and settings */
export const AUDIO = {
  MUSIC: 'sounds/music.wav',
  MUSIC_VOLUME: 0.05,
  /** Base SFX volume — each key can be adjusted via SFX_VOLUMES multiplier */
  SFX_VOLUME: 0.4,
  /** Per-key volume multipliers (applied on top of SFX_VOLUME). Tune these to balance levels on mobile [0.0 - 1.0]. */
  SFX_VOLUMES: {
    click: 0.5,
    fusion: 1.0,
    victory: 0.9,
    gameOver: 0.9,
    notification: 0.5,
    gridHurt: 0.9,
    enemyHurt: 0.3,
    enemyDeath: 1.0,
    enemyIn: 0.8,
    contamination: 0.2,
  },
  /** Per-key volume multipliers for power SFX */
  POWER_SFX_VOLUMES: {
    'fire-h': 0.9,
    'fire-v': 0.9,
    'fire-x': 0.9,
    bomb: 1.0,
    lightning: 0.9,
    nuclear: 1.0,
    teleport: 0.9,
    wind: 0.7,
    blind: 0.5,
  },
  SFX: {
    click: 'sounds/sfx-click.ogg',
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
  ICE: 6,
  BLIND: 3,
  EXPEL: 5,
  WIND: 4,
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
  /**
   * Fraction of total power budget available immediately at full HP (0–1).
   * The rest is unlocked proportionally as the enemy loses HP, ensuring
   * powers are spread across the full combat duration.
   */
  POWER_PACE_RATIO: 0.2,
  /**
   * Named enemy profiles — each defines a power stock (power type → cast count).
   * Profiles are independent of enemy level; assign them freely in BATTLE_LEVELS.
   * Add new profiles here to create new enemy archetypes.
   */
  ENEMY_PROFILES: {
    // ── Ice (theme 1 & 2) ──
    chiller: {
      [POWER_TYPES.ICE]: 5,
    },
    ice_minor: {
      [POWER_TYPES.ICE]: 4,
    },
    phantom: {
      [POWER_TYPES.TELEPORT]: 5,
    },
    frostbite: {
      [POWER_TYPES.ICE]: 5,
      [POWER_TYPES.TELEPORT]: 5,
    },
    glacier_minor: {
      [POWER_TYPES.ICE]: 5,
      [POWER_TYPES.WIND_UP]: 2,
    },
    glacier: {
      [POWER_TYPES.ICE]: 8,
      [POWER_TYPES.TELEPORT]: 3,
    },
    glacier_boss: {
      [POWER_TYPES.ICE]: 8,
      [POWER_TYPES.TELEPORT]: 5,
      [POWER_TYPES.ADS]: 1,
    },
    specter: {
      [POWER_TYPES.TELEPORT]: 5,
      [POWER_TYPES.BLIND]: 2,
    },
    wraith: {
      [POWER_TYPES.ICE]: 6,
      [POWER_TYPES.TELEPORT]: 5,
      [POWER_TYPES.BLIND]: 2,
    },
    banshee: {
      [POWER_TYPES.ICE]: 8,
      [POWER_TYPES.TELEPORT]: 6,
      [POWER_TYPES.BLIND]: 4,
      [POWER_TYPES.ADS]: 1,
    },
    abominable: {
      [POWER_TYPES.ICE]: 10,
      [POWER_TYPES.TELEPORT]: 8,
      [POWER_TYPES.BLIND]: 6,
      [POWER_TYPES.EXPEL_H]: 3,
      [POWER_TYPES.EXPEL_V]: 3,
      [POWER_TYPES.ADS]: 2,
    },
    // ── Expel (theme 3) ──
    pusher_v: {
      [POWER_TYPES.EXPEL_V]: 5,
    },
    pusher_h: {
      [POWER_TYPES.EXPEL_H]: 5,
    },
    both_pushers: {
      [POWER_TYPES.EXPEL_V]: 5,
      [POWER_TYPES.EXPEL_H]: 5,
    },
    repulsor: {
      [POWER_TYPES.EXPEL_V]: 6,
      [POWER_TYPES.EXPEL_H]: 4,
    },
    ejector: {
      [POWER_TYPES.EXPEL_V]: 6,
      [POWER_TYPES.EXPEL_H]: 6,
    },
    catapult: {
      [POWER_TYPES.EXPEL_V]: 8,
      [POWER_TYPES.EXPEL_H]: 8,
      [POWER_TYPES.ADS]: 1,
    },
    nullifier: {
      [POWER_TYPES.BLIND]: 10,
      [POWER_TYPES.TELEPORT]: 6,
      [POWER_TYPES.EXPEL_V]: 6,
      [POWER_TYPES.EXPEL_H]: 6,
      [POWER_TYPES.ADS]: 2,
    },
    // ── Blind (theme 4) ──
    dazzle: {
      [POWER_TYPES.BLIND]: 1,
    },
    blinder_mid: {
      [POWER_TYPES.BLIND]: 2,
    },
    blinder: {
      [POWER_TYPES.BLIND]: 5,
      [POWER_TYPES.ADS]: 1,
    },
    pure_blind: {
      [POWER_TYPES.BLIND]: 5,
    },
    phantom_mid: {
      [POWER_TYPES.BLIND]: 4,
      [POWER_TYPES.TELEPORT]: 3,
    },
    shade: {
      [POWER_TYPES.BLIND]: 6,
      [POWER_TYPES.TELEPORT]: 4,
    },
    void: {
      [POWER_TYPES.BLIND]: 8,
      [POWER_TYPES.TELEPORT]: 6,
      [POWER_TYPES.ADS]: 1,
    },
    // ── Multi-status (theme 5) ──
    trickster: {
      [POWER_TYPES.ICE]: 4,
      [POWER_TYPES.TELEPORT]: 4,
      [POWER_TYPES.BLIND]: 4,
      [POWER_TYPES.ADS]: 1,
    },
    frost_specter: {
      [POWER_TYPES.ICE]: 4,
      [POWER_TYPES.TELEPORT]: 3,
    },
    disruptor: {
      [POWER_TYPES.EXPEL_V]: 4,
      [POWER_TYPES.EXPEL_H]: 4,
      [POWER_TYPES.BLIND]: 2,
    },
    hex: {
      [POWER_TYPES.ICE]: 4,
      [POWER_TYPES.BLIND]: 4,
      [POWER_TYPES.TELEPORT]: 4,
    },
    hexmaster: {
      [POWER_TYPES.ICE]: 5,
      [POWER_TYPES.TELEPORT]: 5,
      [POWER_TYPES.EXPEL_V]: 4,
      [POWER_TYPES.EXPEL_H]: 4,
      [POWER_TYPES.BLIND]: 5,
      [POWER_TYPES.ADS]: 1,
    },
    puppetmaster: {
      [POWER_TYPES.ICE]: 8,
      [POWER_TYPES.TELEPORT]: 6,
      [POWER_TYPES.EXPEL_V]: 6,
      [POWER_TYPES.EXPEL_H]: 6,
      [POWER_TYPES.BLIND]: 8,
      [POWER_TYPES.WIND_UP]: 4,
      [POWER_TYPES.WIND_DOWN]: 4,
      [POWER_TYPES.ADS]: 2,
    },
    // ── Nuclear (theme 6) ──
    atomic_minor: {
      [POWER_TYPES.NUCLEAR]: 2,
    },
    atomic: {
      [POWER_TYPES.NUCLEAR]: 5,
      [POWER_TYPES.ADS]: 1,
    },
    reactor: {
      [POWER_TYPES.NUCLEAR]: 3,
      [POWER_TYPES.BOMB]: 2,
    },
    meltdown: {
      [POWER_TYPES.NUCLEAR]: 5,
      [POWER_TYPES.BOMB]: 3,
      [POWER_TYPES.ADS]: 1,
    },
    fission: {
      [POWER_TYPES.NUCLEAR]: 8,
      [POWER_TYPES.BOMB]: 4,
      [POWER_TYPES.ADS]: 2,
    },
    armageddon: {
      [POWER_TYPES.NUCLEAR]: 10,
      [POWER_TYPES.BOMB]: 5,
      [POWER_TYPES.FIRE_X]: 4,
      [POWER_TYPES.ADS]: 2,
    },
    // ── Lightning (theme 7) ──
    spark: {
      [POWER_TYPES.LIGHTNING]: 3,
    },
    bolt: {
      [POWER_TYPES.LIGHTNING]: 5,
    },
    thunderer: {
      [POWER_TYPES.LIGHTNING]: 10,
      [POWER_TYPES.ADS]: 1,
    },
    charged: {
      [POWER_TYPES.LIGHTNING]: 5,
      [POWER_TYPES.FIRE_H]: 2,
    },
    thunderstruck: {
      [POWER_TYPES.LIGHTNING]: 7,
      [POWER_TYPES.FIRE_V]: 2,
    },
    tempestuous: {
      [POWER_TYPES.LIGHTNING]: 8,
      [POWER_TYPES.FIRE_H]: 3,
      [POWER_TYPES.FIRE_V]: 3,
    },
    maelstrom: {
      [POWER_TYPES.LIGHTNING]: 12,
      [POWER_TYPES.FIRE_H]: 4,
      [POWER_TYPES.FIRE_V]: 4,
      [POWER_TYPES.FIRE_X]: 2,
      [POWER_TYPES.ADS]: 1,
    },
    zeus: {
      [POWER_TYPES.LIGHTNING]: 15,
      [POWER_TYPES.FIRE_H]: 5,
      [POWER_TYPES.FIRE_V]: 5,
      [POWER_TYPES.FIRE_X]: 3,
      [POWER_TYPES.NUCLEAR]: 1,
      [POWER_TYPES.ADS]: 2,
    },
    // ── Bomb (theme 8) ──
    primer: {
      [POWER_TYPES.BOMB]: 3,
    },
    explosive: {
      [POWER_TYPES.BOMB]: 5,
    },
    demolisher: {
      [POWER_TYPES.BOMB]: 10,
      [POWER_TYPES.ADS]: 1,
    },
    detonator: {
      [POWER_TYPES.BOMB]: 5,
      [POWER_TYPES.FIRE_X]: 2,
    },
    blaster: {
      [POWER_TYPES.BOMB]: 7,
      [POWER_TYPES.FIRE_X]: 3,
    },
    annihilator: {
      [POWER_TYPES.BOMB]: 10,
      [POWER_TYPES.FIRE_X]: 4,
      [POWER_TYPES.ADS]: 1,
    },
    obliterator: {
      [POWER_TYPES.BOMB]: 12,
      [POWER_TYPES.FIRE_X]: 5,
      [POWER_TYPES.NUCLEAR]: 1,
      [POWER_TYPES.ADS]: 1,
    },
    doomsday: {
      [POWER_TYPES.BOMB]: 15,
      [POWER_TYPES.FIRE_X]: 6,
      [POWER_TYPES.NUCLEAR]: 2,
      [POWER_TYPES.LIGHTNING]: 4,
      [POWER_TYPES.ADS]: 2,
    },
    // ── Fire (theme 9) ──
    pyro_v: {
      [POWER_TYPES.FIRE_V]: 5,
    },
    pyro_h: {
      [POWER_TYPES.FIRE_H]: 5,
    },
    incinerator: {
      [POWER_TYPES.FIRE_X]: 10,
      [POWER_TYPES.ADS]: 1,
    },
    flare: {
      [POWER_TYPES.FIRE_V]: 5,
      [POWER_TYPES.FIRE_H]: 3,
    },
    blaze: {
      [POWER_TYPES.FIRE_H]: 5,
      [POWER_TYPES.FIRE_V]: 5,
    },
    infernal: {
      [POWER_TYPES.FIRE_X]: 8,
      [POWER_TYPES.FIRE_H]: 3,
      [POWER_TYPES.FIRE_V]: 3,
      [POWER_TYPES.ADS]: 1,
    },
    apocalypse: {
      [POWER_TYPES.FIRE_X]: 10,
      [POWER_TYPES.FIRE_H]: 5,
      [POWER_TYPES.FIRE_V]: 5,
      [POWER_TYPES.BOMB]: 2,
      [POWER_TYPES.ADS]: 1,
    },
    firestorm: {
      [POWER_TYPES.FIRE_X]: 12,
      [POWER_TYPES.FIRE_H]: 6,
      [POWER_TYPES.FIRE_V]: 6,
      [POWER_TYPES.BOMB]: 3,
      [POWER_TYPES.NUCLEAR]: 1,
      [POWER_TYPES.ADS]: 2,
    },
    // ── Wind (theme 10) ──
    breezer_up: {
      [POWER_TYPES.WIND_UP]: 4,
    },
    breezer_down: {
      [POWER_TYPES.WIND_DOWN]: 5,
    },
    breezer_left: {
      [POWER_TYPES.WIND_LEFT]: 6,
    },
    breezer_right: {
      [POWER_TYPES.WIND_RIGHT]: 7,
    },
    tempest: {
      [POWER_TYPES.WIND_UP]: 5,
      [POWER_TYPES.WIND_DOWN]: 5,
      [POWER_TYPES.WIND_LEFT]: 5,
      [POWER_TYPES.WIND_RIGHT]: 5,
      [POWER_TYPES.ADS]: 1,
    },
    whirlwind: {
      [POWER_TYPES.WIND_UP]: 4,
      [POWER_TYPES.WIND_DOWN]: 4,
    },
    gale: {
      [POWER_TYPES.WIND_LEFT]: 5,
      [POWER_TYPES.WIND_RIGHT]: 5,
    },
    hurricane: {
      [POWER_TYPES.WIND_UP]: 5,
      [POWER_TYPES.WIND_DOWN]: 5,
      [POWER_TYPES.WIND_LEFT]: 5,
      [POWER_TYPES.WIND_RIGHT]: 5,
    },
    cyclone: {
      [POWER_TYPES.WIND_UP]: 7,
      [POWER_TYPES.WIND_DOWN]: 7,
      [POWER_TYPES.WIND_LEFT]: 7,
      [POWER_TYPES.WIND_RIGHT]: 7,
      [POWER_TYPES.ADS]: 1,
    },
    typhoon: {
      [POWER_TYPES.WIND_UP]: 8,
      [POWER_TYPES.WIND_DOWN]: 8,
      [POWER_TYPES.WIND_LEFT]: 8,
      [POWER_TYPES.WIND_RIGHT]: 8,
      [POWER_TYPES.BLIND]: 5,
      [POWER_TYPES.ICE]: 5,
      [POWER_TYPES.ADS]: 2,
    },
    // ── Mixed destruction (themes 6-9 combined) ──
    destroyer: {
      [POWER_TYPES.FIRE_X]: 8,
      [POWER_TYPES.LIGHTNING]: 8,
      [POWER_TYPES.BOMB]: 8,
      [POWER_TYPES.NUCLEAR]: 3,
      [POWER_TYPES.ADS]: 2,
    },
    // ── Boss ──
    overlord: {
      [POWER_TYPES.ICE]: 3,
      [POWER_TYPES.FIRE_H]: 3,
      [POWER_TYPES.FIRE_V]: 3,
      [POWER_TYPES.FIRE_X]: 2,
      [POWER_TYPES.BOMB]: 2,
      [POWER_TYPES.LIGHTNING]: 3,
      [POWER_TYPES.BLIND]: 3,
      [POWER_TYPES.TELEPORT]: 2,
      [POWER_TYPES.EXPEL_H]: 2,
      [POWER_TYPES.EXPEL_V]: 2,
      [POWER_TYPES.NUCLEAR]: 1,
      [POWER_TYPES.ADS]: 2,
    },
  },
  /**
   * 30 battle levels grouped into 3 tiers of 10.
   * Each entry is an array of { profile, level } pairs; the last one is the Boss.
   * Level drives HP (ceil(log2(level)) × HP_PER_LEVEL); profile drives power stock.
   *
   * Themes by level:
   *  1 = ice | 2 = teleport/ice | 3 = expel | 4 = blind | 5 = multi-status
   *  6 = nuclear | 7 = lightning | 8 = bomb | 9 = fire | 10 = wind
   *  11–20 = same themes, harder (Normal tier)
   *  21–30 = same themes, boss gauntlets (Hard tier)
   */
  BATTLE_LEVELS: [
    // ── Easy (1–10) ──
    // 1 — Ice: single chiller
    [{ profile: 'chiller', level: 16 }],
    // 2 — Teleport → Ice+Teleport
    [
      { profile: 'phantom', level: 8 },
      { profile: 'frostbite', level: 16 },
    ],
    // 3 — Expel V → Expel H
    [
      { profile: 'pusher_v', level: 16 },
      { profile: 'pusher_h', level: 32 },
    ],
    // 4 — Blind escalation
    [
      { profile: 'dazzle', level: 8 },
      { profile: 'blinder_mid', level: 16 },
      { profile: 'blinder', level: 32 },
    ],
    // 5 — Multi-status gauntlet
    [
      { profile: 'ice_minor', level: 4 },
      { profile: 'phantom', level: 8 },
      { profile: 'both_pushers', level: 16 },
      { profile: 'pure_blind', level: 32 },
      { profile: 'trickster', level: 64 },
    ],
    // 6 — Nuclear intro
    [
      { profile: 'atomic_minor', level: 32 },
      { profile: 'atomic', level: 64 },
    ],
    // 7 — Lightning escalation
    [
      { profile: 'spark', level: 8 },
      { profile: 'bolt', level: 16 },
      { profile: 'thunderer', level: 32 },
    ],
    // 8 — Bomb escalation
    [
      { profile: 'primer', level: 8 },
      { profile: 'explosive', level: 16 },
      { profile: 'demolisher', level: 32 },
    ],
    // 9 — Fire: V → H → Cross
    [
      { profile: 'pyro_v', level: 16 },
      { profile: 'pyro_h', level: 32 },
      { profile: 'incinerator', level: 64 },
    ],
    // 10 — Wind: each direction, then all
    [
      { profile: 'breezer_up', level: 8 },
      { profile: 'breezer_down', level: 16 },
      { profile: 'breezer_left', level: 32 },
      { profile: 'breezer_right', level: 64 },
      { profile: 'tempest', level: 128 },
    ],
    // ── Normal (11–20) ──
    // 11 — Ice+Wind → Ice+Teleport boss
    [
      { profile: 'glacier_minor', level: 8 },
      { profile: 'glacier', level: 32 },
      { profile: 'glacier_boss', level: 64 },
    ],
    // 12 — Teleport+Blind → Ice+Teleport+Blind boss
    [
      { profile: 'specter', level: 8 },
      { profile: 'wraith', level: 32 },
      { profile: 'banshee', level: 128 },
    ],
    // 13 — Expel heavier
    [
      { profile: 'repulsor', level: 16 },
      { profile: 'ejector', level: 64 },
      { profile: 'catapult', level: 128 },
    ],
    // 14 — Blind+Teleport escalation
    [
      { profile: 'phantom_mid', level: 16 },
      { profile: 'shade', level: 64 },
      { profile: 'void', level: 256 },
    ],
    // 15 — Full status mix
    [
      { profile: 'frost_specter', level: 8 },
      { profile: 'disruptor', level: 16 },
      { profile: 'hex', level: 64 },
      { profile: 'hexmaster', level: 256 },
    ],
    // 16 — Nuclear+Bomb
    [
      { profile: 'reactor', level: 32 },
      { profile: 'meltdown', level: 128 },
      { profile: 'fission', level: 256 },
    ],
    // 17 — Lightning+Fire
    [
      { profile: 'charged', level: 16 },
      { profile: 'thunderstruck', level: 32 },
      { profile: 'tempestuous', level: 128 },
      { profile: 'maelstrom', level: 512 },
    ],
    // 18 — Bomb+Fire cross
    [
      { profile: 'detonator', level: 16 },
      { profile: 'blaster', level: 32 },
      { profile: 'annihilator', level: 128 },
      { profile: 'obliterator', level: 512 },
    ],
    // 19 — Fire escalation
    [
      { profile: 'flare', level: 16 },
      { profile: 'blaze', level: 64 },
      { profile: 'infernal', level: 256 },
      { profile: 'apocalypse', level: 512 },
    ],
    // 20 — Full wind
    [
      { profile: 'whirlwind', level: 8 },
      { profile: 'gale', level: 32 },
      { profile: 'hurricane', level: 128 },
      { profile: 'cyclone', level: 512 },
    ],
    // ── Hard (21–30) ──
    // 21 — Ice/Teleport boss gauntlet
    [
      { profile: 'phantom', level: 8 },
      { profile: 'frostbite', level: 16 },
      { profile: 'glacier', level: 64 },
      { profile: 'banshee', level: 256 },
      { profile: 'abominable', level: 1024 },
    ],
    // 22 — Expel/Blind boss gauntlet
    [
      { profile: 'both_pushers', level: 16 },
      { profile: 'shade', level: 32 },
      { profile: 'ejector', level: 64 },
      { profile: 'void', level: 256 },
      { profile: 'nullifier', level: 1024 },
    ],
    // 23 — Fire boss gauntlet
    [
      { profile: 'pyro_v', level: 16 },
      { profile: 'pyro_h', level: 32 },
      { profile: 'incinerator', level: 128 },
      { profile: 'infernal', level: 256 },
      { profile: 'firestorm', level: 1024 },
    ],
    // 24 — Nuclear boss gauntlet
    [
      { profile: 'atomic_minor', level: 32 },
      { profile: 'reactor', level: 128 },
      { profile: 'meltdown', level: 256 },
      { profile: 'fission', level: 512 },
      { profile: 'armageddon', level: 1024 },
    ],
    // 25 — Lightning boss gauntlet
    [
      { profile: 'bolt', level: 16 },
      { profile: 'charged', level: 64 },
      { profile: 'thunderer', level: 128 },
      { profile: 'maelstrom', level: 512 },
      { profile: 'zeus', level: 1024 },
    ],
    // 26 — Bomb boss gauntlet
    [
      { profile: 'primer', level: 16 },
      { profile: 'detonator', level: 64 },
      { profile: 'annihilator', level: 256 },
      { profile: 'obliterator', level: 512 },
      { profile: 'doomsday', level: 1024 },
    ],
    // 27 — Wind boss gauntlet
    [
      { profile: 'breezer_down', level: 16 },
      { profile: 'breezer_right', level: 64 },
      { profile: 'hurricane', level: 128 },
      { profile: 'cyclone', level: 512 },
      { profile: 'typhoon', level: 1024 },
    ],
    // 28 — Mixed destruction gauntlet
    [
      { profile: 'reactor', level: 32 },
      { profile: 'thunderstruck', level: 64 },
      { profile: 'annihilator', level: 128 },
      { profile: 'maelstrom', level: 512 },
      { profile: 'destroyer', level: 1024 },
    ],
    // 29 — Mixed status gauntlet
    [
      { profile: 'frostbite', level: 16 },
      { profile: 'catapult', level: 32 },
      { profile: 'trickster', level: 128 },
      { profile: 'hexmaster', level: 512 },
      { profile: 'puppetmaster', level: 1024 },
    ],
    // 30 — Grand finale (all themes, overlord boss)
    [
      { profile: 'infernal', level: 64 },
      { profile: 'thunderer', level: 128 },
      { profile: 'obliterator', level: 256 },
      { profile: 'typhoon', level: 512 },
      { profile: 'overlord', level: 2048 },
    ],
  ],
  /** Tier boundaries for BATTLE_LEVELS (0-indexed) */
  TIER_EASY: { start: 0, end: 10 },
  TIER_NORMAL: { start: 10, end: 20 },
  TIER_HARD: { start: 20, end: 30 },
  /** Level difficulty bonus multiplier applied to the final score (always, win or lose) */
  LEVEL_BONUS_EASY: 0.05,
  LEVEL_BONUS_NORMAL: 0.1,
  LEVEL_BONUS_HARD: 0.2,
  /** Additional victory score bonus multiplier applied on top of level bonus upon winning */
  VICTORY_BONUS_EASY: 0.1,
  VICTORY_BONUS_NORMAL: 0.25,
  VICTORY_BONUS_HARD: 0.5,
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
