# Graphics Roadmap — Startup Devgrounds

> Last updated: 2026-03-18

---

## ✅ Phase 1 — SVG Furniture Sprites (DONE)

All five SVG sprites are loaded via `src/game/sprites.ts`, rendered by `src/game/render.ts`, and wired into `src/game/map.ts`.

| Sprite key | File | Used in |
|---|---|---|
| `monitor-bar` | `public/sprites/monitor-bar.svg` | Open Workspace desks (rows 1 & 3) |
| `monitor-line` | `public/sprites/monitor-line.svg` | Open Workspace desk (row 2) · Engineering desks |
| `monitor-design` | `public/sprites/monitor-design.svg` | Design Studio desks |
| `monitor-product` | `public/sprites/monitor-product.svg` | Product Area desks |
| `whiteboard-graph` | `public/sprites/whiteboard-graph.svg` | Engineering whiteboard |

**Renderer notes:**
- `getSprite(name)` returns the decoded `HTMLImageElement` or `undefined` while loading.
- Furniture items with a `sprite` key draw the SVG via `ctx.drawImage`; otherwise fall back to a coloured rectangle + label.

---

## ✅ Phase 2 — Tile-Based Map Rendering (DONE)

### What was built

| File | Role |
|---|---|
| `src/game/tilemap.ts` | `loadTileSheet` + `drawTileLayer` renderer |
| `src/types.ts` → `TileLayer` | Map layer schema (flat row-major tile ID array, z-ordering, alpha) |
| `src/game/map.ts` → `_floorLayer` | 80 × 45 floor layer using `Room_Builder_free_16x16.png`, `alpha: 0.45` |

### How tile IDs work
- **Sheet columns** are derived automatically from `img.naturalWidth / tileW` on load.
- **Tile ID** = `sheetRow * sheetCols + sheetCol` (0-based, row-major).
- Change `_floorLayer.data` values in `map.ts` to use different tiles per zone area.
- z = 0 draws **below** zone colour overlays; z = 1 draws **above** them.

### Tile sheet notes (Room Builder free, 16 × 16)
Open `public/pixelart/Modern tiles_Free/Interiors_free/16x16/Room_Builder_free_16x16.png` to inspect tile IDs. Tile 0 (top-left) is the default; replace array values per zone for varied floors.

---

## ✅ Phase 3 — Pixel-Art Player Avatars (DONE)

### What was built

| File | Role |
|---|---|
| `src/game/animation.ts` | `Animator` state machine · `tickAnimator` · `facingFromVelocity` · `getFrameSource` |
| `src/game/sprites.ts` | `loadSheet` · `drawSheetFrame` · `sheetReady` for PNG spritesheets |
| `src/types.ts` → `AnimState`, `Facing`, `CharacterName`, `Animator` | Shared animation types |
| `src/game/render.ts` → `drawPlayer` | Draws 32 × 64 sprite + selection ellipse; falls back to circle while sheets load |
| `src/main.ts` | Preloads all character sheets; assigns character from ID hash; ticks local + peer animators each frame |
| `src/net/messages.ts` | Decodes `character` from `hello`, `animState` + `facing` from `state` (with fallbacks for older clients) |
| `src/net/presence.ts` | `upsertPeer` stores `character`; `recordSample` stores `animState` + `facing` |

### Character assignment
Four characters (Adam, Alex, Amelia, Bob) are assigned **deterministically from the player ID hash**, so the same player always gets the same character.

### Animation sheet layout (16 × 32 px frames, LimeZu Modern Tiles Free)

| State | Sheet suffix | Frames |
|---|---|---|
| `idle_anim` | `_idle_anim_16x16.png` | 4 |
| `walk` | `_run_16x16.png` | 6 per direction (rows: down/left/right/up) |
| `run` | `_run_16x16.png` (faster) | 6 per direction |
| `phone` | `_phone_16x16.png` | 2 |
| `sit` | `_sit_16x16.png` | 1 |

> **Note:** `CHAR_W = 16`, `CHAR_H = 32` are defined in `animation.ts`. If your sheets use a different layout (e.g. 16 × 16), adjust those constants and re-check `FACING_ROW`.

---

## ✅ Phase 4 — Polish & Additional Sprites (DONE)

### New SVG sprites

| Sprite key | File | Used in |
|---|---|---|
| `monitor-video` | `public/sprites/monitor-video.svg` | Lounge wall screen (2 × 2 video call grid) |
| `monitor-idle` | `public/sprites/monitor-idle.svg` | One empty Open Workspace desk (screensaver) |

### Zone-entry flash (HUD)
When the local player crosses a zone boundary, a `▶ Zone Name` label fades in at the top-centre of the canvas over ~0.5 s. Managed by `zoneFlash` in `GameState`; updated in the `main.ts` game loop; rendered in `render.ts` in canvas space (above the day/night overlay).

### Ambient particles — Lounge dust motes
Up to 60 gold `#f39c12` particles drift upward in the Lounge zone (x 20–260, y 320–700). Spawned at ~5/s, fade out over 1.5–3 s. Rendered before the HUD, inside world-space.

### Proximity tooltips
Four interactive objects are registered in `src/game/map.ts → INTERACTIVE_OBJECTS`:

| Object | Trigger centre | Radius | Tooltip |
|---|---|---|---|
| Coffee table | (190, 440) | 45 px | ☕ Grab a coffee |
| Conference table | (550, 130) | 65 px | 📋 Join the meeting |
| Engineering whiteboard | (785, 285) | 55 px | 📝 View architecture |
| Lounge sofa area | (95, 570) | 55 px | 🛋️ Take a break |

### Day / night mode
`getDayNightAlpha()` in `render.ts` blends a dark `rgba(10,8,25)` overlay over the full canvas:

| Time | Overlay alpha |
|---|---|
| 10:00 – 18:00 | 0 (full day) |
| 18:00 → 22:00 | 0 → 0.45 (dusk) |
| 22:00 – 6:00 | 0.45 (deep night) |
| 6:00 → 10:00 | 0.45 → 0 (dawn) |

---

## 🗂️ Available Pixel-Art Assets (reference)

All assets live under `public/pixelart/Modern tiles_Free/` (LimeZu "Modern Tiles – Free" pack).

### Characters (`Characters_free/`)
Adam · Alex · Amelia · Bob — each with 8 animation sheets at 16 × 16 px. RPG Maker MV sheets also present under `RPGMAKERMV/`.

### Interior Tilesets (`Interiors_free/`)
`Interiors_free_*.png` + `Room_Builder_free_*.png` at 16 / 32 / 48 px.

### Legacy / Old Assets (`Old/`)
`idle_*.png` · `run_horizontal_*.png` · `Tileset_*_1/2/3/9/16.png` at 16 / 32 / 48 px.

---

## Asset Licence

All pixel-art assets in `public/pixelart/Modern tiles_Free/` are distributed under the licence in `public/pixelart/Modern tiles_Free/LICENSE.txt`. Review before shipping.

> Last updated: 2026-03-18

---

## ✅ Phase 1 — SVG Furniture Sprites (DONE)

All five SVG sprites are loaded via `src/game/sprites.ts`, rendered by `src/game/render.ts`, and wired into `src/game/map.ts`.

| Sprite key | File | Used in |
|---|---|---|
| `monitor-bar` | `public/sprites/monitor-bar.svg` | Open Workspace desks (rows 1 & 3) |
| `monitor-line` | `public/sprites/monitor-line.svg` | Open Workspace desk (row 2) · Engineering desks |
| `monitor-design` | `public/sprites/monitor-design.svg` | Design Studio desks |
| `monitor-product` | `public/sprites/monitor-product.svg` | Product Area desks |
| `whiteboard-graph` | `public/sprites/whiteboard-graph.svg` | Engineering whiteboard |

**Renderer notes:**
- `getSprite(name)` returns the decoded `HTMLImageElement` or `undefined` while loading.
- Furniture items with a `sprite` key draw the SVG via `ctx.drawImage`; otherwise fall back to a coloured rectangle + label.
- Player avatars are still plain coloured circles (see Phase 3).

---

## 🗂️ Available Pixel-Art Assets (not yet integrated)

All assets live under `public/pixelart/Modern tiles_Free/` and are from the **"Modern Tiles – Free"** pack.

### Characters (`Characters_free/`)

Four characters, each with **8 animation sheets** at **16 × 16 px**:

| Character | Sheets available |
|---|---|
| **Adam** | `_16x16` · `_idle_16x16` · `_idle_anim_16x16` · `_phone_16x16` · `_run_16x16` · `_sit_16x16` · `_sit2_16x16` · `_sit3_16x16` |
| **Alex** | same set |
| **Amelia** | same set |
| **Bob** | same set |

RPG Maker MV format sheets are also present under `Characters_free/RPGMAKERMV/`.

### Interior Tilesets (`Interiors_free/`)

| File | Resolution |
|---|---|
| `Interiors_free_16x16.png` · `Room_Builder_free_16x16.png` | 16 × 16 px |
| `Interiors_free_32x32.png` · `Room_Builder_free_32x32.png` | 32 × 32 px |
| `Interiors_free_48x48.png` · `Room_Builder_free_48x48.png` | 48 × 48 px |

### Legacy / Old Assets (`Old/`)

| Files | Sizes |
|---|---|
| `idle_*.png` · `run_horizontal_*.png` | 16 / 32 / 48 px |
| `Tileset_*_1/2/3/9/16.png` (numbered variants) | 16 / 32 / 48 px |

---

## 🔜 Phase 2 — Tile-Based Map Rendering

**Goal:** Replace the flat-colour zones + coloured-rect furniture with tiles drawn from the interior tilesets.

### Tasks

- [ ] **Pick a tile size** — 16 × 16 px is the best fit at the current world size (1280 × 720 px). 32 × 32 is viable with a zoom-out. Decide before building the renderer.
- [ ] **Tile-sheet parser** — create `src/game/tilemap.ts` with helpers to slice a tile sheet into a `CanvasImageSource` grid by `(col, row)` or tile ID.
- [ ] **Map layer format** — extend `GameMap` (in `src/types.ts`) with a `tiles: TileLayer[]` field; each layer holds a 2-D array of tile IDs + a z-order index.
- [ ] **Tile renderer** — add a `drawTileLayer` call in `render.ts` between the background fill and the furniture loop.
- [ ] **Room Builder tiles** — use `Room_Builder_free_16x16.png` for walls, floors, and doors; `Interiors_free_16x16.png` for furniture tiles (desks, chairs, sofas, plants).
- [ ] **Remove plain-rect colliders** — once tile walls are drawn, reuse the existing AABB colliders; no physics changes needed.
- [ ] **Static tile map data** — encode the map as a JSON tile array in `src/game/map.ts` (or a separate `src/game/tilemap-data.ts`).

**Stretch:** Use the 32 × 32 sheets plus a 2× CSS `image-rendering: pixelated` zoom for a crisper look on high-DPI screens.

---

## 🔜 Phase 3 — Pixel-Art Player Avatars

**Goal:** Replace the circle + name-label player renderer with animated pixel-art character sprites.

### Tasks

- [ ] **Sprite-sheet loader** — extend `src/game/sprites.ts` to support PNG spritesheets (currently only SVG). Add a `loadSheet(path, frameW, frameH)` helper.
- [ ] **Animation state machine** — create `src/game/animation.ts`:
  - States: `idle` · `walk` · `run` (sprint) · `sit` · `phone`
  - Drive from `input.ts` velocity and a future `peer.state` field.
- [ ] **Character assignment** — assign one of `{ Adam, Alex, Amelia, Bob }` to each player at join time (random, or let users pick from the name panel in `src/ui/overlay.ts`).
- [ ] **`drawPlayer` rewrite** — in `src/game/render.ts`:
  - Draw the correct animation frame from the preloaded sheet via `ctx.drawImage(sheet, srcX, srcY, 16, 16, x - 8, y - 8, 16, 16)`.
  - Keep the name label above; remove the glow circle (or keep as a selection ring for the local player only).
- [ ] **Network sync** — add an `animation` field to the position message (`src/net/messages.ts`) so remote peers reflect the correct walk/idle/sit frame.

### Animation sheet layout (16 × 16, Modern Tiles Free)

| State | Sheet suffix | Expected frames |
|---|---|---|
| Idle (static) | `_16x16.png` | 1 |
| Idle (animated) | `_idle_anim_16x16.png` | 4 |
| Walking/Running | `_run_16x16.png` | 4 per direction |
| Sitting | `_sit_16x16.png` · `_sit2_16x16.png` · `_sit3_16x16.png` | 1 each |
| On phone | `_phone_16x16.png` | 2 |

---

## 🔜 Phase 4 — Polish & Additional Sprites

- [ ] **Zone transition overlays** — subtle animated pixel-art doorway frames when a player crosses zone boundaries.
- [ ] **Interactive objects** — coffee machine, printer, bookshelf using `Interiors_free` tiles; trigger a tooltip or emoji reaction on proximity.
- [ ] **More monitor variants** — a `monitor-video.svg` for the Lounge (video call screen), a `monitor-idle.svg` (screensaver) for empty desks.
- [ ] **Ambient particles** — canvas-only dust motes or light rays over the Lounge using the existing `render.ts` pass.
- [ ] **Day/night mode** — multiply-blend a dark overlay driven by the system clock; tint the `rgba` zone colours accordingly.

---

## Asset Licence

All pixel-art assets in `public/pixelart/Modern tiles_Free/` are distributed under the licence in `public/pixelart/Modern tiles_Free/LICENSE.txt`. Review before shipping.
