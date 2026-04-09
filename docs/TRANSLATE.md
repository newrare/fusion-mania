# Localization — Fusion Mania

## Overview

Fusion Mania supports multiple languages. The player can switch between **English** and **French** from the in-game options. The choice is persisted in `localStorage` and survives page reloads and app restarts.

## How It Works

### Locale files

Each supported language has its own file in `src/locales/`:

```
src/locales/
├── en.js      # English translations
└── fr.js      # French translations
```

A locale file exports a flat object mapping **dot-separated keys** to translated strings:

```js
// src/locales/en.js
export const en = {
  'menu.play': 'Play',
  'menu.options': 'Options',
  'game.gameover': 'Game Over',
  // ...
};
```

```js
// src/locales/fr.js
export const fr = {
  'menu.play': 'Jouer',
  'menu.options': 'Options',
  'game.gameover': 'Partie terminée',
  // ...
};
```

> **Rule:** Every key present in `en.js` must also be present in `fr.js` (and vice versa). Missing keys will log a warning and return the raw key as fallback.

### I18nManager

The singleton `i18n` in `src/managers/I18nManager.js` provides the API:

| Method / Property        | Description                                                     |
|--------------------------|-----------------------------------------------------------------|
| `i18n.t(key, params?)`   | Translate a key. Optionally interpolate `{param}` values.       |
| `i18n.setLocale(code)`   | Switch language (`'en'` or `'fr'`). Persists to `localStorage`. |
| `i18n.locale`            | Current locale code (read-only).                                |
| `i18n.availableLocales`  | Array of supported locale codes.                                |
| `i18n.onChange(callback)`| Subscribe to locale changes. Returns an unsubscribe function.   |

### Usage in Scenes & Components

Import `i18n` and call `t()` wherever you need translated text:

```js
import { i18n } from '../managers/i18n-manager.js';

// In a scene's create():
new Title(this, x, y, i18n.t('menu.title'));
new Button(this, x, y, i18n.t('menu.play'), () => { /* ... */ });
```

### Interpolation

Use `{placeholder}` in translation values and pass a params object:

```js
// In locale file:
'game.welcome': 'Welcome, {name}!'

// In code:
i18n.t('game.welcome', { name: 'Alice' }); // → "Welcome, Alice!"
```

### Reacting to Language Changes

When the player changes the language in the options screen, subscribe with `onChange` to update visible text:

```js
const unsub = i18n.onChange(() => {
  titleText.setText(i18n.t('menu.title'));
  playButton.setText(i18n.t('menu.play'));
});

// Clean up when leaving the scene:
this.events.on('shutdown', unsub);
```

### Persistence

The selected locale is saved under the `localStorage` key `fusionmania_locale`. On startup, `I18nManager` reads this value. If none is found, it defaults to `en`.

## Adding a New Language

1. Create `src/locales/<code>.js` (e.g. `es.js` for Spanish).
2. Export an object with the same keys as `en.js`.
3. Import it in `src/managers/i18n-manager.js` and add it to the `LOCALES` map:
   ```js
   import { es } from '../locales/es.js';
   const LOCALES = { en, fr, es };
   ```
5. The new language will automatically appear in `i18n.availableLocales`.

## Key Naming Convention

Keys use **dot-separated namespaces** matching the area of the game:

| Prefix      | Area              | Example                |
|-------------|-------------------|------------------------|
| `menu.*`    | Main menu         | `menu.play`            |
| `options.*` | Options screen    | `options.language`     |
| `game.*`    | In-game UI        | `game.gameover`        |
| `modal.*`   | Generic modals    | `modal.confirm`        |
