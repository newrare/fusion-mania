# Layout System — Fusion Mania

The game uses a **`LayoutManager`** singleton (`src/managers/layout-manager.js`) that computes all dimensions at runtime from the actual viewport. There are no hardcoded pixel values for game dimensions anywhere in the codebase.

## How it works

**`Phaser.Scale.RESIZE`** — the Phaser canvas always fills 100% of the viewport. On every resize (and once at boot in `BootScene`), `layout.update(w, h)` is called and cascades:

1. **Safe zone** — the rectangle where all gameplay elements must stay:
   - Reads `env(safe-area-inset-*)` CSS variables (notch, home bar, camera cutout on real devices)
   - Applies a minimum comfortable padding on top of device insets: `5% top`, `4% bottom`, `3% sides`
   - The column width is **capped at 480 px** (widest flagship phone in CSS px, e.g. Samsung Galaxy S24 Ultra ~480 px, iPhone 16 Pro Max ~440 px) and **centered** in the viewport — so on tablet and desktop the UI stays in a narrow centered column, matching the vertical mobile design intent
   - Exposes: `layout.safe.{ top, bottom, left, right, width, height, cx, cy }`

2. **Grid metrics** — computed proportionally from the safe zone:
   - Grid occupies 87% of the safe-area width, capped at 400 px to avoid oversized grids on desktop
   - `tileSize`, `gap`, `padding` are all derived from that single width value
   - Exposes: `layout.grid.{ tileSize, gap, padding, totalWidth, x, y }`

3. **CSS custom properties** — pushed to `#game-container` on every update, consumed by `main.css`:

   | Property            | Description                      |
   |---------------------|----------------------------------|
   | `--fm-tile-size`    | Tile width & height in px        |
   | `--fm-tile-font`    | Base tile font size in px        |
   | `--fm-grid-gap`     | Gap between cells in px          |
   | `--fm-grid-padding` | Grid inner padding in px         |
   | `--fm-grid-width`   | Total grid container width in px |
   | `--fm-safe-width`   | Safe zone width in px (for HUD)  |

## Safe zone debug overlay (DEV only)

When running `npm run dev`, a green rectangle is drawn over each scene showing the exact safe zone boundaries, with corner markers and the dimensions of both the viewport and the safe area. This overlay is **automatically stripped from production builds** via `import.meta.env.DEV`.

## How to use it in a new scene

```js
import { layout } from '../managers/layout-manager.js';

create() {
  // Position an element at the center of the safe area
  this.add.dom(layout.safe.cx, layout.safe.cy).createFromHTML(html);

  // Anchor a HUD element to the top of the safe area
  this.add.dom(layout.safe.cx, layout.safe.top).createFromHTML(hud).setOrigin(0.5, 0);

  // React to future resizes (e.g. orientation change)
  const unsub = layout.onChange(() => this.#rebuild());
  this.events.once('shutdown', unsub);
}
```

## Background (cover sizing)

Background images use **CSS cover logic** (`Math.max(scaleX, scaleY)`) so they always fill the full viewport while preserving their aspect ratio, regardless of the device's aspect ratio. Clouds use `tileSprite` and scroll at different speeds for a parallax effect.
