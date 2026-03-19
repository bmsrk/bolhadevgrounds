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
