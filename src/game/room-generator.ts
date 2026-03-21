/**
 * src/game/room-generator.ts — Procedural room generation engine.
 *
 * Uses the tile registry to generate a complete GameMap with procedural rooms.
 * The layout mirrors the existing static map structure (2 rows × 3 columns of
 * rooms with a central corridor) but uses proper directional wall tiles, seeded
 * randomness, and rule-based furniture placement per room purpose.
 */

import type { GameMap, TileLayer, Collider, Zone, FurnitureShape } from '../types.js';
import { WORLD_WIDTH, WORLD_HEIGHT } from '../constants.js';
import {
  type FloorTheme,
  type FurnitureType,
  getFloorTiles,
  getWallTile,
  getFurnitureTiles,
} from './tile-registry.js';

// ── Seeded RNG (mulberry32) ───────────────────────────────────────────────────

/**
 * Creates a deterministic pseudo-random number generator using the mulberry32
 * algorithm. Returns a function that yields values in [0, 1).
 */
export function createRng(seed: number): () => number {
  let s = seed >>> 0;
  return function () {
    s += 0x6d2b79f5;
    let z = s;
    z = Math.imul(z ^ (z >>> 15), z | 1);
    z ^= z + Math.imul(z ^ (z >>> 7), z | 61);
    return ((z ^ (z >>> 14)) >>> 0) / 0x100000000;
  };
}

// ── Room template types ───────────────────────────────────────────────────────

export interface RoomTemplate {
  /** Human-readable name */
  name: string;
  /** Room purpose — affects furniture selection */
  purpose: 'office' | 'meeting' | 'lounge' | 'engineering' | 'design' | 'product' | 'corridor' | 'generic';
  /** Floor theme to use */
  floorTheme: FloorTheme;
  /** Min/max dimensions in tiles */
  minWidth: number;  maxWidth: number;
  minHeight: number; maxHeight: number;
  /** Door positions: which edges can have doors */
  doorEdges: ('north' | 'south' | 'east' | 'west')[];
  /** Zone color (rgba) for the overlay */
  zoneColor: string;
  /** Furniture density: 0.0 = empty, 1.0 = packed */
  furnitureDensity: number;
  /** Hand-placed furniture added after procedural generation */
  furnitureOverrides?: import('../types.js').FurnitureShape[];
  /** Per-cell tile overrides applied after procedural generation (tile-grid coords) */
  tileOverrides?: { col: number; row: number; tileId: number }[];
}

export interface GeneratedRoom {
  /** Position in the tile grid (top-left corner of interior, excluding walls) */
  gridX: number;
  gridY: number;
  /** Dimensions in tiles (interior only, excluding walls) */
  widthTiles: number;
  heightTiles: number;
  /** The floor tile layer data (flat row-major for the full 80×45 world) */
  floorData: number[];
  /** The wall tile layer data */
  wallData: number[];
  /** Generated colliders (pixel coords, world-relative) */
  colliders: Collider[];
  /** Generated furniture shapes */
  furniture: FurnitureShape[];
  /** Zone definition */
  zone: Zone;
  /** Door positions (tile coords) */
  doors: { edge: 'north' | 'south' | 'east' | 'west'; tilePos: number }[];
  /** Template used */
  template: RoomTemplate;
}

// ── Default room templates ────────────────────────────────────────────────────

export const DEFAULT_TEMPLATES: RoomTemplate[] = [
  {
    name: 'Open Workspace',
    purpose: 'office',
    floorTheme: 'office',
    minWidth: 16, maxWidth: 20,
    minHeight: 14, maxHeight: 18,
    doorEdges: ['south', 'east'],
    zoneColor: 'rgba(52,152,219,0.05)',
    furnitureDensity: 0.7,
  },
  {
    name: 'Meeting Room',
    purpose: 'meeting',
    floorTheme: 'tan',
    minWidth: 22, maxWidth: 28,
    minHeight: 14, maxHeight: 18,
    doorEdges: ['south', 'east', 'west'],
    zoneColor: 'rgba(46,204,113,0.05)',
    furnitureDensity: 0.6,
  },
  {
    name: 'Engineering',
    purpose: 'engineering',
    floorTheme: 'teal',
    minWidth: 30, maxWidth: 34,
    minHeight: 14, maxHeight: 18,
    doorEdges: ['south', 'west'],
    zoneColor: 'rgba(155,89,182,0.05)',
    furnitureDensity: 0.7,
  },
  {
    name: 'Lounge',
    purpose: 'lounge',
    floorTheme: 'wood',
    minWidth: 16, maxWidth: 20,
    minHeight: 20, maxHeight: 26,
    doorEdges: ['north', 'east'],
    zoneColor: 'rgba(241,196,15,0.05)',
    furnitureDensity: 0.6,
  },
  {
    name: 'Product Area',
    purpose: 'product',
    floorTheme: 'beige',
    minWidth: 22, maxWidth: 28,
    minHeight: 20, maxHeight: 26,
    doorEdges: ['north', 'east', 'west'],
    zoneColor: 'rgba(230,126,34,0.05)',
    furnitureDensity: 0.6,
  },
  {
    name: 'Design Studio',
    purpose: 'design',
    floorTheme: 'stone',
    minWidth: 30, maxWidth: 34,
    minHeight: 20, maxHeight: 26,
    doorEdges: ['north', 'west'],
    zoneColor: 'rgba(231,76,60,0.05)',
    furnitureDensity: 0.65,
  },
];

// ── Tile constants ────────────────────────────────────────────────────────────

const TILE_W = 16;
const TILE_H = 16;
const MAP_COLS = WORLD_WIDTH  / TILE_W;  // 80
const MAP_ROWS = WORLD_HEIGHT / TILE_H;  // 45

const _RB_COLS = 17;
function rbTile(row: number, col: number): number { return row * _RB_COLS + col; }

// Default wall tile fallback (glass partition — same as static map)
const WALL_DEFAULT = rbTile(0, 7);

// Specific directional wall tiles from Room Builder sheet
const WALL_TOP      = rbTile(0, 0);   // north-facing wall top edge
const WALL_BOTTOM   = rbTile(1, 0);   // south-facing wall bottom edge
const WALL_LEFT     = rbTile(2, 0);   // west-facing wall left edge
const WALL_RIGHT    = rbTile(3, 0);   // east-facing wall right edge
const WALL_CORNER_TL = rbTile(0, 3);  // outer top-left corner
const WALL_CORNER_TR = rbTile(0, 4);  // outer top-right corner
const WALL_CORNER_BL = rbTile(1, 3);  // outer bottom-left corner
const WALL_CORNER_BR = rbTile(1, 4);  // outer bottom-right corner

// Helper: get wall tile by category from registry, or fall back to default
function resolveWallTile(category: Parameters<typeof getWallTile>[0]): number {
  const entry = getWallTile(category);
  return entry ? entry.tileId : WALL_DEFAULT;
}

// Floor tile for corridor (stone)
function corridorFloor(c: number, r: number): number {
  const tiles = getFloorTiles('stone');
  if (tiles.length === 0) return rbTile(19, 0);
  return tiles[(c % 3) + (r % 2) * 3 < tiles.length ? (c % 3) + (r % 2) * 3 : 0]!.tileId;
}

// ── Floor fill helpers ────────────────────────────────────────────────────────

function fillFloorForTheme(col: number, row: number, theme: FloorTheme): number {
  const tiles = getFloorTiles(theme);
  if (tiles.length === 0) return rbTile(17, 0); // office fallback
  const idx = (col % 3) + (row % 2) * Math.min(3, tiles.length);
  return tiles[idx % tiles.length]!.tileId;
}

/**
 * Paint a 1-tile-wide perimeter border inside a room's floor rect using the
 * "flipped row parity" trick — flipping r+1 ensures the border always uses the
 * alternate shade of the same theme, creating a visible frame without needing
 * a separate dark-theme lookup.
 */
function fillFloorBorder(
  data: number[],
  x: number, y: number, w: number, h: number,
  theme: FloorTheme,
): void {
  for (let r = y; r < y + h; r++) {
    for (let c = x; c < x + w; c++) {
      if (c < 0 || c >= MAP_COLS || r < 0 || r >= MAP_ROWS) continue;
      if (c === x || c === x + w - 1 || r === y || r === y + h - 1) {
        // Pass r + 1 to flip row parity: fillFloorForTheme alternates shades on
        // even/odd rows, so incrementing r guarantees the border always uses the
        // opposite shade from its adjacent interior tile, creating a visible frame.
        data[r * MAP_COLS + c] = fillFloorForTheme(c, r + 1, theme);
      }
    }
  }
}

/** Fill an arbitrary rect with a flat floor theme (used for carpets and rugs). */
function fillFloorRect(
  data: number[],
  x: number, y: number, w: number, h: number,
  theme: FloorTheme,
): void {
  for (let r = y; r < y + h; r++) {
    for (let c = x; c < x + w; c++) {
      if (c < 0 || c >= MAP_COLS || r < 0 || r >= MAP_ROWS) continue;
      data[r * MAP_COLS + c] = fillFloorForTheme(c, r, theme);
    }
  }
}

// ── Furniture tile ID helpers (matching map.ts _iT ids exactly) ───────────────

function iT(tileId: number): { sheet: 'interiors'; tileId: number } {
  return { sheet: 'interiors' as const, tileId };
}

// Lookup a furniture tileId for a given type (first match wins)
function furnitureTileId(type: FurnitureType): number {
  const entries = getFurnitureTiles(type);
  return entries.length > 0 ? entries[0]!.tileId : 161; // default: desk surface
}

type TileSpriteEntry = { sheet: 'interiors' | 'room-builder'; tileId: number; offsetX: number; offsetY: number; w: number; h: number };

/**
 * Build a tileSprites composite for a rectangular grid of tiles.
 * Each tile is rendered at TILE_W × TILE_H (16 × 16 px).
 * @param sheet   - tile sheet name
 * @param tileIds - 2D array [row][col] of tile IDs (-1 = skip)
 */
function makeTileComposite(
  sheet: 'interiors' | 'room-builder',
  tileIds: number[][],
): TileSpriteEntry[] {
  const sprites: TileSpriteEntry[] = [];
  for (let row = 0; row < tileIds.length; row++) {
    const rowArr = tileIds[row]!;
    for (let col = 0; col < rowArr.length; col++) {
      const tid = rowArr[col]!;
      if (tid < 0) continue;
      sprites.push({
        sheet,
        tileId: tid,
        offsetX: col * TILE_W,
        offsetY: row * TILE_H,
        w: TILE_W,
        h: TILE_H,
      });
    }
  }
  return sprites;
}

/**
 * Create a single-row composite of `count` repeated tiles.
 * Convenience wrapper for makeTileComposite.
 */
function makeSingleRowComposite(
  sheet: 'interiors' | 'room-builder',
  tileId: number,
  count: number,
): TileSpriteEntry[] {
  return makeTileComposite(sheet, [Array(count).fill(tileId)]);
}

// ── Furniture placement helpers ───────────────────────────────────────────────

interface FurniturePlacement {
  furniture: FurnitureShape[];
  colliders: Collider[];
}

function placeOfficeFurniture(
  rx: number, ry: number, rw: number, rh: number,
  rng: () => number,
): FurniturePlacement {
  const furniture: FurnitureShape[] = [];
  const colliders: Collider[] = [];
  const deskTile = furnitureTileId('desk');
  const monitorTile = furnitureTileId('monitor');
  const plantTile = 1;  // small plant (_iT(1))
  const bigPlantTile = 16; // big plant (_iT(16))

  // Desk is 5 tiles wide × 2 tiles tall (80×32) rendered as a multi-tile composite
  const deskTilesW = 5, deskTilesH = 2;
  const deskW = deskTilesW * TILE_W;   // 80 px
  const deskH = deskTilesH * TILE_H;   // 32 px
  const gapX = 8, gapY = 16;
  const startX = rx + 14;
  const startY = ry + 20;
  const cols = Math.min(2, Math.floor((rw - 28) / (deskW + gapX)));
  const rows = Math.min(3, Math.floor((rh - 60) / (deskH + gapY)));

  for (let dr = 0; dr < rows; dr++) {
    for (let dc = 0; dc < cols; dc++) {
      const x = startX + dc * (deskW + gapX);
      const y = startY + dr * (deskH + gapY);
      if (x + deskW > rx + rw - 10 || y + deskH > ry + rh - 30) continue;
      // Desk: 5×2 tiles
      furniture.push({
        type: 'rect', x, y, w: deskW, h: deskH, color: '#1c2a3a',
        tileSprites: makeTileComposite(
          'interiors',
          [[deskTile, deskTile, deskTile, deskTile, deskTile],
           [deskTile, deskTile, deskTile, deskTile, deskTile]],
        ),
      });
      // Monitor: single tile at native size, centred on desk
      furniture.push({
        type: 'rect', x: x + TILE_W, y: y + 2, w: TILE_W, h: TILE_H, color: '#1a3a6a',
        tileSprites: makeSingleRowComposite('interiors', monitorTile, 1),
      });
      colliders.push({ x, y, w: deskW, h: deskH });
    }
  }

  // Corner plants (native tile size 16×16)
  if (rng() > 0.3) {
    furniture.push({ type: 'rect', x: rx + 6, y: ry + 6, w: TILE_W, h: TILE_H, color: '#1a6a1a', tileSprite: iT(bigPlantTile) });
  }
  if (rng() > 0.5) {
    furniture.push({ type: 'rect', x: rx + rw - 22, y: ry + 6, w: TILE_W, h: TILE_H, color: '#1a5a1a', tileSprite: iT(plantTile) });
  }

  return { furniture, colliders };
}

function placeMeetingFurniture(
  rx: number, ry: number, rw: number, rh: number,
  _rng: () => number,
): FurniturePlacement {
  const furniture: FurnitureShape[] = [];
  const colliders: Collider[] = [];

  // Central conference table — multi-tile composite (tiles in a grid)
  const tW = Math.round(rw * 0.55), tH = Math.round(rh * 0.5);
  const tx = rx + Math.round((rw - tW) / 2);
  const ty = ry + Math.round((rh - tH) / 2);
  const tableTilesW = Math.max(1, Math.round(tW / TILE_W));
  const tableTilesH = Math.max(1, Math.round(tH / TILE_H));
  const actualTW = tableTilesW * TILE_W;
  const actualTH = tableTilesH * TILE_H;
  furniture.push({
    type: 'rect', x: tx, y: ty, w: actualTW, h: actualTH, color: '#1a3a50', label: '📋 Meeting',
    tileSprites: makeTileComposite(
      'interiors',
      Array.from({ length: tableTilesH }, () => Array(tableTilesW).fill(161)),
    ),
  });
  colliders.push({ x: tx, y: ty, w: actualTW, h: actualTH });

  // Chairs around the table (use actualTW/TH)
  const chairCount = Math.min(5, Math.floor(actualTW / 50));
  for (let i = 0; i < chairCount; i++) {
    const cx = tx + 20 + i * Math.round(actualTW / chairCount);
    furniture.push({ type: 'circle', x: cx, y: ty - 12, r: 10, color: '#1e3a50' });
    furniture.push({ type: 'circle', x: cx, y: ty + actualTH + 12, r: 10, color: '#1e3a50' });
  }
  // Side chairs
  const sideRows = Math.min(2, Math.floor(actualTH / 40));
  for (let i = 0; i < sideRows; i++) {
    const cy = ty + 20 + i * Math.round(actualTH / sideRows);
    furniture.push({ type: 'circle', x: tx - 12, y: cy, r: 10, color: '#1e3a50' });
    furniture.push({ type: 'circle', x: tx + actualTW + 12, y: cy, r: 10, color: '#1e3a50' });
  }

  // Projector screen on north wall — multi-tile (horizontal strip)
  const screenTiles = Math.max(2, Math.round(actualTW * 0.65 / TILE_W));
  const screenW = screenTiles * TILE_W;
  const sx = rx + Math.round((rw - screenW) / 2);
  furniture.push({
    type: 'rect', x: sx, y: ry + 6, w: screenW, h: TILE_H, color: '#0a0a1a', label: '📺 Projector',
    tileSprites: makeSingleRowComposite('interiors', 152, screenTiles),
  });

  // Whiteboards — 2×3 tile composite
  furniture.push({
    type: 'rect', x: rx + 8, y: ry + 8, w: 2 * TILE_W, h: 3 * TILE_H, color: '#f0f0ff',
    tileSprites: makeTileComposite('interiors', [[648, 648], [648, 648], [648, 648]]),
  });

  return { furniture, colliders };
}

function placeLoungeFurniture(
  rx: number, ry: number, rw: number, rh: number,
  rng: () => number,
): FurniturePlacement {
  const furniture: FurnitureShape[] = [];
  const colliders: Collider[] = [];

  // Kitchen counter (top) — multi-tile horizontal strip
  const counterTiles = Math.max(2, Math.floor((rw - 12) / TILE_W));
  const counterW = counterTiles * TILE_W;
  furniture.push({
    type: 'rect', x: rx + 6, y: ry + 6, w: counterW, h: TILE_H, color: '#3a2a10', label: '☕ Kitchen',
    tileSprites: makeSingleRowComposite('interiors', 161, counterTiles),
  });
  colliders.push({ x: rx + 6, y: ry + 6, w: counterW, h: TILE_H });

  // Two sofas — 3×2 tile composite each
  const sofaTilesW = 3, sofaTilesH = 2;
  const sofaW = sofaTilesW * TILE_W, sofaH = sofaTilesH * TILE_H;
  furniture.push({
    type: 'rect', x: rx + 6, y: ry + 48, w: sofaW, h: sofaH, color: '#5a4820', label: '🛋️ Sofa',
    tileSprites: makeTileComposite('interiors', [[177, 177, 177], [177, 177, 177]]),
  });
  colliders.push({ x: rx + 6, y: ry + 48, w: sofaW, h: sofaH });
  if (rh > 120) {
    furniture.push({
      type: 'rect', x: rx + 6, y: ry + 108, w: sofaW, h: sofaH, color: '#5a4820',
      tileSprites: makeTileComposite('interiors', [[177, 177, 177], [177, 177, 177]]),
    });
    colliders.push({ x: rx + 6, y: ry + 108, w: sofaW, h: sofaH });
  }

  // Coffee table — 2×2 tile composite
  furniture.push({
    type: 'rect', x: rx + sofaW + 16, y: ry + 56, w: 2 * TILE_W, h: 2 * TILE_H, color: '#3a2a08',
    tileSprites: makeTileComposite('interiors', [[161, 161], [161, 161]]),
  });

  // TV on south wall — multi-tile horizontal
  if (rh > 130) {
    const tvTiles = Math.min(5, Math.floor(rw / TILE_W / 2));
    const tvW = tvTiles * TILE_W;
    furniture.push({
      type: 'rect', x: rx + 6, y: ry + rh - 3 * TILE_H, w: tvW, h: TILE_H, color: '#0a0a1a', label: '📺 TV',
      tileSprites: makeSingleRowComposite('interiors', 152, tvTiles),
    });
  }

  // Plants (native 16×16 tile size)
  if (rng() > 0.4) {
    furniture.push({ type: 'rect', x: rx + rw - 22, y: ry + rh - 22, w: TILE_W, h: TILE_H, color: '#1a6a1a', tileSprite: iT(16) });
  }

  return { furniture, colliders };
}

function placeEngineeringFurniture(
  rx: number, ry: number, rw: number, rh: number,
  rng: () => number,
): FurniturePlacement {
  const furniture: FurnitureShape[] = [];
  const colliders: Collider[] = [];
  const deskTile = 128;  // _iT(128) engineering desk
  const monitorTile = furnitureTileId('monitor');

  // Desk: 5 tiles wide × 2 tiles tall
  const deskTilesW = 5, deskTilesH = 2;
  const deskW = deskTilesW * TILE_W;
  const deskH = deskTilesH * TILE_H;
  const colCount = Math.min(4, Math.floor((rw - 60) / (deskW + 10)));
  const rowCount = Math.min(2, Math.floor((rh - 80) / (deskH + 20)));
  const startX = rx + 16;
  const startY = ry + 16;

  for (let dr = 0; dr < rowCount; dr++) {
    for (let dc = 0; dc < colCount; dc++) {
      const x = startX + dc * (deskW + 10);
      const y = startY + dr * (deskH + 30);
      if (x + deskW > rx + rw - 60 || y + deskH > ry + rh - 40) continue;
      furniture.push({
        type: 'rect', x, y, w: deskW, h: deskH, color: '#1a1030',
        tileSprites: makeTileComposite(
          'interiors',
          [[deskTile, deskTile, deskTile, deskTile, deskTile],
           [deskTile, deskTile, deskTile, deskTile, deskTile]],
        ),
      });
      furniture.push({
        type: 'rect', x: x + TILE_W, y: y + 2, w: TILE_W, h: TILE_H, color: '#2a1a4a',
        tileSprites: makeSingleRowComposite('interiors', monitorTile, 1),
      });
      colliders.push({ x, y, w: deskW, h: deskH });
    }
  }

  // Server rack on east wall — 2×N tile composite
  const srX = rx + rw - 2 * TILE_W - 8;
  const srTilesH = Math.max(2, Math.floor((rh - 30) / TILE_H));
  const srH = srTilesH * TILE_H;
  furniture.push({
    type: 'rect', x: srX, y: ry + 6, w: 2 * TILE_W, h: srH, color: '#0a1a2a', label: '⚙️ Servers',
    tileSprites: makeTileComposite(
      'interiors',
      Array.from({ length: srTilesH }, () => [152, 152]),
    ),
  });
  colliders.push({ x: srX, y: ry + 6, w: 2 * TILE_W, h: srH, label: 'server-rack' });

  // Whiteboards — multi-tile composite
  if (rng() > 0.3) {
    const wbTiles = Math.max(2, Math.floor(Math.min(150, rw - 30) / TILE_W));
    furniture.push({
      type: 'rect', x: rx + 16, y: ry + rh - 3 * TILE_H, w: wbTiles * TILE_W, h: 3 * TILE_H, color: '#f0f0ff', label: '📐 Architecture',
      tileSprites: makeTileComposite('interiors', Array.from({ length: 3 }, () => Array(wbTiles).fill(648))),
    });
  }

  // Plants (native tile size)
  if (rng() > 0.5) {
    furniture.push({ type: 'rect', x: rx + 6, y: ry + 6, w: TILE_W, h: TILE_H, color: '#1a5a1a', tileSprite: iT(1) });
  }

  return { furniture, colliders };
}

function placeProductFurniture(
  rx: number, ry: number, rw: number, rh: number,
  rng: () => number,
): FurniturePlacement {
  const furniture: FurnitureShape[] = [];
  const colliders: Collider[] = [];
  const deskTile = furnitureTileId('desk');
  const monitorTile = furnitureTileId('monitor');

  // Desk: 5 tiles wide × 2 tiles tall
  const deskTilesW = 5, deskTilesH = 2;
  const deskW = deskTilesW * TILE_W;
  const deskH = deskTilesH * TILE_H;
  const colCount = Math.min(3, Math.floor((rw - 40) / (deskW + 12)));
  const rowCount = Math.min(2, Math.floor((rh - 100) / (deskH + 20)));
  const startX = rx + 14;
  const startY = ry + rh / 2 - rowCount * (deskH + 20) / 2;

  for (let dr = 0; dr < rowCount; dr++) {
    for (let dc = 0; dc < colCount; dc++) {
      const x = startX + dc * (deskW + 12);
      const y = startY + dr * (deskH + 20);
      if (x + deskW > rx + rw - 14 || y + deskH > ry + rh - 40) continue;
      furniture.push({
        type: 'rect', x, y, w: deskW, h: deskH, color: '#20140a',
        tileSprites: makeTileComposite(
          'interiors',
          [[deskTile, deskTile, deskTile, deskTile, deskTile],
           [deskTile, deskTile, deskTile, deskTile, deskTile]],
        ),
      });
      furniture.push({
        type: 'rect', x: x + TILE_W, y: y + 2, w: TILE_W, h: TILE_H, color: '#3a2008',
        tileSprites: makeSingleRowComposite('interiors', monitorTile, 1),
      });
      colliders.push({ x, y, w: deskW, h: deskH });
    }
  }

  // Kanban boards (south wall) — multi-tile composites
  const boardTilesW = 5, boardTilesH = 3;
  const boardW = boardTilesW * TILE_W, boardH = boardTilesH * TILE_H;
  const boardGap = 8;
  const boardCount = Math.min(3, Math.floor((rw - 30) / (boardW + boardGap)));
  for (let i = 0; i < boardCount; i++) {
    const bx = rx + 10 + i * (boardW + boardGap);
    const by = ry + rh - boardH - 4;
    const boardLabel = i === 0 ? '📋 Sprint' : i === 1 ? '📊 Backlog' : null;
    const boardShape: FurnitureShape = {
      type: 'rect', x: bx, y: by, w: boardW, h: boardH, color: '#f0f0e0',
      tileSprites: makeTileComposite('interiors', Array.from({ length: boardTilesH }, () => Array(boardTilesW).fill(648))),
    };
    if (boardLabel) boardShape.label = boardLabel;
    furniture.push(boardShape);
  }
  if (boardCount > 0) {
    colliders.push({ x: rx + 10, y: ry + rh - boardH - 4, w: boardCount * (boardW + boardGap) - boardGap, h: boardH });
  }

  // Pod table
  if (rw > 200 && rng() > 0.4) {
    const podX = rx + rw - 80;
    const podY = ry + rh / 2 - 20;
    furniture.push({ type: 'circle', x: podX, y: podY, r: 38, color: '#20140a' });
    furniture.push({ type: 'circle', x: podX, y: podY - 50, r: 10, color: '#20140a' });
    furniture.push({ type: 'circle', x: podX + 50, y: podY, r: 10, color: '#20140a' });
    furniture.push({ type: 'circle', x: podX, y: podY + 50, r: 10, color: '#20140a' });
    furniture.push({ type: 'circle', x: podX - 50, y: podY, r: 10, color: '#20140a' });
  }

  // Plants (native tile size)
  furniture.push({ type: 'rect', x: rx + 6, y: ry + 6, w: TILE_W, h: TILE_H, color: '#1a5a1a', tileSprite: iT(1) });

  return { furniture, colliders };
}

function placeDesignFurniture(
  rx: number, ry: number, rw: number, rh: number,
  rng: () => number,
): FurniturePlacement {
  const furniture: FurnitureShape[] = [];
  const colliders: Collider[] = [];
  const deskTile = furnitureTileId('desk');
  const monitorTile = furnitureTileId('monitor');

  // Desk: 5 tiles wide × 2 tiles tall
  const deskTilesW = 5, deskTilesH = 2;
  const deskW = deskTilesW * TILE_W;
  const deskH = deskTilesH * TILE_H;
  const colCount = Math.min(4, Math.floor((rw - 40) / (deskW + 8)));
  const startX = rx + 12;
  const startY = ry + 20;

  for (let dc = 0; dc < colCount; dc++) {
    const x = startX + dc * (deskW + 8);
    const y = startY;
    if (x + deskW > rx + rw - 12) continue;
    furniture.push({
      type: 'rect', x, y, w: deskW, h: deskH, color: '#2e0e16',
      tileSprites: makeTileComposite(
        'interiors',
        [[deskTile, deskTile, deskTile, deskTile, deskTile],
         [deskTile, deskTile, deskTile, deskTile, deskTile]],
      ),
    });
    furniture.push({
      type: 'rect', x: x + TILE_W, y: y + 2, w: TILE_W, h: TILE_H, color: '#4a1a2a',
      tileSprites: makeSingleRowComposite('interiors', monitorTile, 1),
    });
    colliders.push({ x, y, w: deskW, h: deskH });
  }

  // Large display wall (east) — 2×N tile composite
  const dispTilesH = Math.max(2, Math.min(12, Math.floor((rh - 80) / TILE_H)));
  const dispH = dispTilesH * TILE_H;
  const dispX = rx + rw - 2 * TILE_W - 8;
  furniture.push({
    type: 'rect', x: dispX, y: ry + 50, w: 2 * TILE_W, h: dispH, color: '#1a0010', label: '🎨 Design',
    tileSprites: makeTileComposite('interiors', Array.from({ length: dispTilesH }, () => [152, 152])),
  });
  colliders.push({ x: dispX, y: ry + 50, w: 2 * TILE_W, h: dispH, label: 'large-display' });

  // Drawing boards (south) — multi-tile composites
  const boardTilesW = 5, boardTilesH = 4;
  const boardW = boardTilesW * TILE_W, boardH = boardTilesH * TILE_H;
  const boardGap = 8;
  const boardCount = Math.min(3, Math.floor((rw - 80) / (boardW + boardGap)));
  for (let i = 0; i < boardCount; i++) {
    const bx = rx + 6 + i * (boardW + boardGap);
    const by = ry + rh - boardH - 4;
    const boardLabel = i === 0 ? '✏️ Sketches' : i === 1 ? '🖌️ Design' : null;
    const boardShape: FurnitureShape = {
      type: 'rect', x: bx, y: by, w: boardW, h: boardH, color: '#f0f0e8',
      tileSprites: makeTileComposite('interiors', Array.from({ length: boardTilesH }, () => Array(boardTilesW).fill(648))),
    };
    if (boardLabel) boardShape.label = boardLabel;
    furniture.push(boardShape);
  }
  if (boardCount > 0) {
    colliders.push({ x: rx + 6, y: ry + rh - boardH - 4, w: boardCount * (boardW + boardGap) - boardGap, h: boardH });
  }

  // Plants (native tile size)
  if (rng() > 0.4) {
    furniture.push({ type: 'rect', x: rx + 6, y: ry + rh - TILE_H - 4, w: TILE_W, h: TILE_H, color: '#1a6a1a', tileSprite: iT(16) });
  }

  return { furniture, colliders };
}

function placeFurnitureForPurpose(
  purpose: RoomTemplate['purpose'],
  rx: number, ry: number, rw: number, rh: number,
  rng: () => number,
): FurniturePlacement {
  switch (purpose) {
    case 'office':      return placeOfficeFurniture(rx, ry, rw, rh, rng);
    case 'meeting':     return placeMeetingFurniture(rx, ry, rw, rh, rng);
    case 'lounge':      return placeLoungeFurniture(rx, ry, rw, rh, rng);
    case 'engineering': return placeEngineeringFurniture(rx, ry, rw, rh, rng);
    case 'product':     return placeProductFurniture(rx, ry, rw, rh, rng);
    case 'design':      return placeDesignFurniture(rx, ry, rw, rh, rng);
    default: return { furniture: [], colliders: [] };
  }
}

// ── Wall drawing helpers ──────────────────────────────────────────────────────

/**
 * Draw a rectangular room's walls into the wallData array.
 * wallX/wallY/wallW/wallH are the full tile bounds (including the 1-tile border).
 * doorGaps: set of tile indices (world-relative col or row) where walls are omitted.
 */
function drawRoomWalls(
  wallData: number[],
  wallX: number, wallY: number, wallW: number, wallH: number,
  doorCols: Set<number>,
  doorRows: Set<number>,
): void {
  const tl = resolveWallTile('wall-corner-tl') || WALL_CORNER_TL;
  const tr = resolveWallTile('wall-corner-tr') || WALL_CORNER_TR;
  const bl = resolveWallTile('wall-corner-bl') || WALL_CORNER_BL;
  const br = resolveWallTile('wall-corner-br') || WALL_CORNER_BR;
  const top    = resolveWallTile('wall-top')    || WALL_TOP;
  const bottom = resolveWallTile('wall-bottom') || WALL_BOTTOM;
  const left   = resolveWallTile('wall-left')   || WALL_LEFT;
  const right  = resolveWallTile('wall-right')  || WALL_RIGHT;

  const x2 = wallX + wallW - 1;
  const y2 = wallY + wallH - 1;

  for (let c = wallX; c <= x2; c++) {
    for (let r = wallY; r <= y2; r++) {
      if (c < 0 || c >= MAP_COLS || r < 0 || r >= MAP_ROWS) continue;
      const idx = r * MAP_COLS + c;
      const isTop    = r === wallY;
      const isBottom = r === y2;
      const isLeft   = c === wallX;
      const isRight  = c === x2;

      // Is this tile in a door gap?
      if ((isTop || isBottom) && doorCols.has(c)) continue;
      if ((isLeft || isRight) && doorRows.has(r)) continue;

      let tile: number;
      if      (isTop    && isLeft)  tile = tl;
      else if (isTop    && isRight) tile = tr;
      else if (isBottom && isLeft)  tile = bl;
      else if (isBottom && isRight) tile = br;
      else if (isTop)               tile = top;
      else if (isBottom)            tile = bottom;
      else if (isLeft)              tile = left;
      else if (isRight)             tile = right;
      else continue; // interior — skip

      wallData[idx] = tile;
    }
  }
}

// ── Layout algorithm ──────────────────────────────────────────────────────────

/** Generate a door gap set of tile column/row indices for a given wall segment */
function makeDoorGap(
  wallPos: number,       // the tile col/row of the wall
  wallStart: number,     // start tile of the wall segment (interior side)
  wallEnd: number,       // end tile of the wall segment (interior side)
  doorSize: number,      // number of tiles wide/tall (default 4)
  rng: () => number,
): Set<number> {
  const gap = new Set<number>();
  // Place door roughly in the centre of the wall segment with slight random offset
  const rangeLen = wallEnd - wallStart - doorSize;
  if (rangeLen < 1) return gap; // wall too small for door
  const offset = Math.floor(rng() * rangeLen);
  const start = wallStart + offset;
  for (let i = 0; i < doorSize; i++) {
    gap.add(start + i);
  }
  void wallPos; // wallPos used by caller to select which gap set applies
  return gap;
}

// ── Main generation function ──────────────────────────────────────────────────

/**
 * Generate a complete GameMap with procedural rooms.
 * @param seed - Deterministic seed (default: 0)
 * @param templates - Room templates for each of the 6 grid cells (top-left → bottom-right)
 */
export function generateMap(seed = 0, templates: RoomTemplate[] = DEFAULT_TEMPLATES): GameMap {
  const rng = createRng(seed);

  // ── Layout dimensions (mirrors current static map) ────────────────────────
  // The world is 80×45 tiles.
  // 2-row × 3-column grid with a 2-tile corridor between rows.
  // Outer border: 1 tile on each side.
  // Vertical partitions at configurable columns.
  // Horizontal corridor at configurable rows.
  //
  // We randomise the column widths and row heights within the template ranges.

  const tmpl = [...templates];
  while (tmpl.length < 6) tmpl.push(DEFAULT_TEMPLATES[tmpl.length % DEFAULT_TEMPLATES.length]!);

  // Column widths (3 columns). Must sum to MAP_COLS - 2 (outer walls).
  const innerCols = MAP_COLS - 2;  // 78

  // Pick widths for col 0 and col 1 based on template min/max, remainder goes to col 2
  const c0W = clampRandom(rng, tmpl[0]!.minWidth,  tmpl[0]!.maxWidth,  14, innerCols - 40);
  const c1W = clampRandom(rng, tmpl[1]!.minWidth,  tmpl[1]!.maxWidth,  20, innerCols - c0W - 20);
  const c2W = innerCols - c0W - c1W;

  // Row heights (2 rows) plus 2-tile corridor
  const corridorH = 2;
  const innerRows = MAP_ROWS - 2 - corridorH; // 41
  const r0H = clampRandom(rng, tmpl[0]!.minHeight, tmpl[0]!.maxHeight, 12, innerRows - 16);
  const r1H = innerRows - r0H;

  // Tile grid positions
  const col0X = 1;
  const col1X = col0X + c0W;
  const col2X = col1X + c1W;
  const row0Y = 1;
  const corridorY = row0Y + r0H;
  const row1Y = corridorY + corridorH;

  // ── Door gaps ─────────────────────────────────────────────────────────────
  // Horizontal walls (top corridor border at corridorY, bottom at corridorY+corridorH-1+1)
  // Vertical walls at col1X and col2X
  const DOOR_SIZE = 4;

  // Vertical wall 1 (at col1X): door rows in top zone and bottom zone
  const dvT1 = makeDoorGap(col1X, row0Y + 1, row0Y + r0H - 1, DOOR_SIZE, rng);
  const dvB1 = makeDoorGap(col1X, row1Y + 1, row1Y + r1H - 1, DOOR_SIZE, rng);

  // Vertical wall 2 (at col2X): same
  const dvT2 = makeDoorGap(col2X, row0Y + 1, row0Y + r0H - 1, DOOR_SIZE, rng);
  const dvB2 = makeDoorGap(col2X, row1Y + 1, row1Y + r1H - 1, DOOR_SIZE, rng);

  // Horizontal wall top (at corridorY): door cols per column
  const dhL_top = makeDoorGap(corridorY, col0X + 1, col0X + c0W - 1, DOOR_SIZE, rng);
  const dhM_top = makeDoorGap(corridorY, col1X + 1, col1X + c1W - 1, DOOR_SIZE, rng);
  const dhR_top = makeDoorGap(corridorY, col2X + 1, col2X + c2W - 1, DOOR_SIZE, rng);

  // Horizontal wall bottom (at row1Y-1):
  const dhL_bot = makeDoorGap(row1Y - 1, col0X + 1, col0X + c0W - 1, DOOR_SIZE, rng);
  const dhM_bot = makeDoorGap(row1Y - 1, col1X + 1, col1X + c1W - 1, DOOR_SIZE, rng);
  const dhR_bot = makeDoorGap(row1Y - 1, col2X + 1, col2X + c2W - 1, DOOR_SIZE, rng);

  // ── Initialise tile data arrays ───────────────────────────────────────────
  const size = MAP_COLS * MAP_ROWS;
  const floorData = new Array<number>(size).fill(-1);
  const wallData  = new Array<number>(size).fill(-1);

  // ── Fill floor tiles ──────────────────────────────────────────────────────

  // Helper: fill rect with floor
  function fillFloor(x: number, y: number, w: number, h: number, theme: FloorTheme) {
    for (let r = y; r < y + h; r++) {
      for (let c = x; c < x + w; c++) {
        if (c < 0 || c >= MAP_COLS || r < 0 || r >= MAP_ROWS) continue;
        floorData[r * MAP_COLS + c] = fillFloorForTheme(c, r, theme);
      }
    }
  }

  // Top row rooms
  fillFloor(col0X, row0Y, c0W, r0H, tmpl[0]!.floorTheme);
  fillFloor(col1X, row0Y, c1W, r0H, tmpl[1]!.floorTheme);
  fillFloor(col2X, row0Y, c2W, r0H, tmpl[2]!.floorTheme);
  // Corridor
  fillFloor(col0X, corridorY, innerCols, corridorH, 'stone');
  // Bottom row rooms
  fillFloor(col0X, row1Y, c0W, r1H, tmpl[3]!.floorTheme);
  fillFloor(col1X, row1Y, c1W, r1H, tmpl[4]!.floorTheme);
  fillFloor(col2X, row1Y, c2W, r1H, tmpl[5]!.floorTheme);

  // Corridor stone floor for each tile
  for (let r = corridorY; r < corridorY + corridorH; r++) {
    for (let c = col0X; c < col0X + innerCols; c++) {
      if (c < 0 || c >= MAP_COLS || r < 0 || r >= MAP_ROWS) continue;
      floorData[r * MAP_COLS + c] = corridorFloor(c, r);
    }
  }

  // ── Room interior border rings (1-tile perimeter, alternate shade) ─────────
  fillFloorBorder(floorData, col0X, row0Y, c0W, r0H, tmpl[0]!.floorTheme);
  fillFloorBorder(floorData, col1X, row0Y, c1W, r0H, tmpl[1]!.floorTheme);
  fillFloorBorder(floorData, col2X, row0Y, c2W, r0H, tmpl[2]!.floorTheme);
  fillFloorBorder(floorData, col0X, row1Y, c0W, r1H, tmpl[3]!.floorTheme);
  fillFloorBorder(floorData, col1X, row1Y, c1W, r1H, tmpl[4]!.floorTheme);
  fillFloorBorder(floorData, col2X, row1Y, c2W, r1H, tmpl[5]!.floorTheme);

  // ── Lounge centre rug — warm beige/tan accent on wood floor ───────────────
  if (tmpl[3]!.purpose === 'lounge' && c0W > 8 && r1H > 10) {
    const rugX = col0X + Math.floor(c0W * 0.28);
    const rugY = row1Y + Math.floor(r1H * 0.30);
    const rugW = Math.max(4, Math.floor(c0W * 0.50));
    const rugH = Math.max(4, Math.floor(r1H * 0.38));
    fillFloorRect(floorData, rugX, rugY, rugW, rugH, 'beige');
    fillFloorBorder(floorData, rugX, rugY, rugW, rugH, 'tan');
  }

  // ── Meeting room carpet — contrasting underlay beneath conference table ────
  if (tmpl[1]!.purpose === 'meeting' && c1W > 8 && r0H > 6) {
    const carpetX = col1X + Math.floor(c1W * 0.22);
    const carpetY = row0Y + Math.floor(r0H * 0.22);
    const carpetW = Math.max(4, Math.floor(c1W * 0.56));
    const carpetH = Math.max(3, Math.floor(r0H * 0.54));
    fillFloorRect(floorData, carpetX, carpetY, carpetW, carpetH, 'beige');
    fillFloorBorder(floorData, carpetX, carpetY, carpetW, carpetH, 'tan');
  }

  // ── Outer border walls ────────────────────────────────────────────────────
  // Draw full outer border
  drawRoomWalls(wallData, 0, 0, MAP_COLS, MAP_ROWS, new Set(), new Set());

  // ── Internal walls ────────────────────────────────────────────────────────

  // Vertical wall at col1X (between room 0/1 and room 3/4)
  // Top zone segment
  for (let r = row0Y; r < row0Y + r0H; r++) {
    if (dvT1.has(r)) continue;
    wallData[r * MAP_COLS + col1X] = WALL_RIGHT;
  }
  // Bottom zone segment
  for (let r = row1Y; r < row1Y + r1H; r++) {
    if (dvB1.has(r)) continue;
    wallData[r * MAP_COLS + col1X] = WALL_RIGHT;
  }

  // Vertical wall at col2X
  for (let r = row0Y; r < row0Y + r0H; r++) {
    if (dvT2.has(r)) continue;
    wallData[r * MAP_COLS + col2X] = WALL_RIGHT;
  }
  for (let r = row1Y; r < row1Y + r1H; r++) {
    if (dvB2.has(r)) continue;
    wallData[r * MAP_COLS + col2X] = WALL_RIGHT;
  }

  // Horizontal wall at corridorY (top of corridor) — south-facing (bottom of top rooms)
  for (let c = col0X; c < col0X + c0W; c++) {
    if (dhL_top.has(c)) continue;
    wallData[corridorY * MAP_COLS + c] = WALL_BOTTOM;
  }
  for (let c = col1X; c < col1X + c1W; c++) {
    if (dhM_top.has(c)) continue;
    wallData[corridorY * MAP_COLS + c] = WALL_BOTTOM;
  }
  for (let c = col2X; c < col2X + c2W; c++) {
    if (dhR_top.has(c)) continue;
    wallData[corridorY * MAP_COLS + c] = WALL_BOTTOM;
  }

  // Horizontal wall at row1Y-1 (bottom of corridor) — north-facing (top of bottom rooms)
  const corrBotY = row1Y - 1;
  for (let c = col0X; c < col0X + c0W; c++) {
    if (dhL_bot.has(c)) continue;
    wallData[corrBotY * MAP_COLS + c] = WALL_TOP;
  }
  for (let c = col1X; c < col1X + c1W; c++) {
    if (dhM_bot.has(c)) continue;
    wallData[corrBotY * MAP_COLS + c] = WALL_TOP;
  }
  for (let c = col2X; c < col2X + c2W; c++) {
    if (dhR_bot.has(c)) continue;
    wallData[corrBotY * MAP_COLS + c] = WALL_TOP;
  }

  // ── Colliders ─────────────────────────────────────────────────────────────
  const allColliders: Collider[] = [];

  // Outer walls
  allColliders.push({ x: 0, y: 0, w: WORLD_WIDTH, h: TILE_H, label: 'outer-top' });
  allColliders.push({ x: 0, y: WORLD_HEIGHT - TILE_H, w: WORLD_WIDTH, h: TILE_H, label: 'outer-bottom' });
  allColliders.push({ x: 0, y: 0, w: TILE_W, h: WORLD_HEIGHT, label: 'outer-left' });
  allColliders.push({ x: WORLD_WIDTH - TILE_W, y: 0, w: TILE_W, h: WORLD_HEIGHT, label: 'outer-right' });

  // Vertical wall colliders (with door gaps)
  addVerticalWallColliders(allColliders, col1X, row0Y, row0Y + r0H - 1, dvT1, 'vw1-t');
  addVerticalWallColliders(allColliders, col1X, row1Y, row1Y + r1H - 1, dvB1, 'vw1-b');
  addVerticalWallColliders(allColliders, col2X, row0Y, row0Y + r0H - 1, dvT2, 'vw2-t');
  addVerticalWallColliders(allColliders, col2X, row1Y, row1Y + r1H - 1, dvB2, 'vw2-b');

  // Horizontal wall colliders (top corridor border)
  addHorizontalWallColliders(allColliders, corridorY, col0X, col0X + c0W - 1, dhL_top, 'cw-t-l');
  addHorizontalWallColliders(allColliders, corridorY, col1X, col1X + c1W - 1, dhM_top, 'cw-t-m');
  addHorizontalWallColliders(allColliders, corridorY, col2X, col2X + c2W - 1, dhR_top, 'cw-t-r');

  // Horizontal wall colliders (bottom corridor border)
  addHorizontalWallColliders(allColliders, corrBotY, col0X, col0X + c0W - 1, dhL_bot, 'cw-b-l');
  addHorizontalWallColliders(allColliders, corrBotY, col1X, col1X + c1W - 1, dhM_bot, 'cw-b-m');
  addHorizontalWallColliders(allColliders, corrBotY, col2X, col2X + c2W - 1, dhR_bot, 'cw-b-r');

  // ── Zones ─────────────────────────────────────────────────────────────────
  const zones: Zone[] = [
    makeZone(col0X, row0Y, c0W, r0H, tmpl[0]!),
    makeZone(col1X, row0Y, c1W, r0H, tmpl[1]!),
    makeZone(col2X, row0Y, c2W, r0H, tmpl[2]!),
    makeZone(col0X, row1Y, c0W, r1H, tmpl[3]!),
    makeZone(col1X, row1Y, c1W, r1H, tmpl[4]!),
    makeZone(col2X, row1Y, c2W, r1H, tmpl[5]!),
  ];

  // ── Furniture ─────────────────────────────────────────────────────────────
  const allFurniture: FurnitureShape[] = [];

  function addRoomFurniture(gridX: number, gridY: number, gridW: number, gridH: number, t: RoomTemplate) {
    // Convert tile coords to pixel coords (interior only, inside walls)
    const rx = gridX * TILE_W + TILE_W;      // one tile inside
    const ry = gridY * TILE_H + TILE_H;
    const rw = (gridW - 2) * TILE_W;
    const rh = (gridH - 2) * TILE_H;
    if (rw <= 0 || rh <= 0) return;
    const placed = placeFurnitureForPurpose(t.purpose, rx, ry, rw, rh, rng);
    allFurniture.push(...placed.furniture);
    allColliders.push(...placed.colliders);
  }

  addRoomFurniture(col0X, row0Y, c0W, r0H, tmpl[0]!);
  addRoomFurniture(col1X, row0Y, c1W, r0H, tmpl[1]!);
  addRoomFurniture(col2X, row0Y, c2W, r0H, tmpl[2]!);
  addRoomFurniture(col0X, row1Y, c0W, r1H, tmpl[3]!);
  addRoomFurniture(col1X, row1Y, c1W, r1H, tmpl[4]!);
  addRoomFurniture(col2X, row1Y, c2W, r1H, tmpl[5]!);

  // Apply furnitureOverrides per template
  const roomGrids = [
    { t: tmpl[0]!, gx: col0X, gy: row0Y },
    { t: tmpl[1]!, gx: col1X, gy: row0Y },
    { t: tmpl[2]!, gx: col2X, gy: row0Y },
    { t: tmpl[3]!, gx: col0X, gy: row1Y },
    { t: tmpl[4]!, gx: col1X, gy: row1Y },
    { t: tmpl[5]!, gx: col2X, gy: row1Y },
  ];
  for (const { t } of roomGrids) {
    if (t.furnitureOverrides) {
      allFurniture.push(...t.furnitureOverrides);
    }
  }

  // Apply tileOverrides per template (overwrite floor or wall data at specific cells)
  const roomTileBounds = [
    { t: tmpl[0]!, x: col0X, y: row0Y, w: c0W, h: r0H },
    { t: tmpl[1]!, x: col1X, y: row0Y, w: c1W, h: r0H },
    { t: tmpl[2]!, x: col2X, y: row0Y, w: c2W, h: r0H },
    { t: tmpl[3]!, x: col0X, y: row1Y, w: c0W, h: r1H },
    { t: tmpl[4]!, x: col1X, y: row1Y, w: c1W, h: r1H },
    { t: tmpl[5]!, x: col2X, y: row1Y, w: c2W, h: r1H },
  ];
  for (const { t, x: bx, y: by } of roomTileBounds) {
    if (t.tileOverrides) {
      for (const ov of t.tileOverrides) {
        const tc = bx + ov.col;
        const tr = by + ov.row;
        if (tc >= 0 && tc < MAP_COLS && tr >= 0 && tr < MAP_ROWS) {
          floorData[tr * MAP_COLS + tc] = ov.tileId;
        }
      }
    }
  }

  // Corridor decorations
  const corrPx = corridorY * TILE_H;
  allFurniture.push({ type: 'rect', x: (col0X + c0W - 3) * TILE_W, y: corrPx + 2, w: 24, h: 24, color: '#2a3a4a', tileSprite: iT(161) });
  allFurniture.push({ type: 'rect', x: (col1X + c1W / 2 | 0) * TILE_W, y: corrPx + 2, w: 20, h: 20, color: '#1a5a1a', tileSprite: iT(1) });

  // ── Assemble TileLayers ───────────────────────────────────────────────────
  const floorLayer: TileLayer = {
    sheet:   'room-builder',
    mapCols: MAP_COLS,
    mapRows: MAP_ROWS,
    tileW:   TILE_W,
    tileH:   TILE_H,
    data:    floorData,
    offsetX: 0,
    offsetY: 0,
    z:       0,
    alpha:   0.9,
  };

  const wallLayer: TileLayer = {
    sheet:   'room-builder',
    mapCols: MAP_COLS,
    mapRows: MAP_ROWS,
    tileW:   TILE_W,
    tileH:   TILE_H,
    data:    wallData,
    offsetX: 0,
    offsetY: 0,
    z:       1,
    alpha:   1.0,
  };

  return {
    worldWidth:  WORLD_WIDTH,
    worldHeight: WORLD_HEIGHT,
    zones,
    colliders:   allColliders,
    furniture:   allFurniture,
    tiles:       [floorLayer, wallLayer],
  };
}

// ── Utility helpers ───────────────────────────────────────────────────────────

function clampRandom(rng: () => number, min: number, max: number, hardMin: number, hardMax: number): number {
  const lo = Math.max(min, hardMin);
  const hi = Math.min(max, hardMax);
  if (lo >= hi) return lo;
  return lo + Math.floor(rng() * (hi - lo + 1));
}

function makeZone(gridX: number, gridY: number, gridW: number, gridH: number, tmpl: RoomTemplate): Zone {
  return {
    x: gridX * TILE_W,
    y: gridY * TILE_H,
    w: gridW * TILE_W,
    h: gridH * TILE_H,
    label: tmpl.name,
    color: tmpl.zoneColor,
  };
}

/**
 * Add AABB colliders for a vertical wall segment, splitting around door gaps.
 * tileCol: the tile column of the wall
 * rowStart/rowEnd: inclusive tile row range (world coords)
 * gapRows: set of tile rows that are open (doorway)
 */
function addVerticalWallColliders(
  colliders: Collider[],
  tileCol: number,
  rowStart: number,
  rowEnd: number,
  gapRows: Set<number>,
  label: string,
): void {
  const px = tileCol * TILE_W;
  let segStart = -1;
  for (let r = rowStart; r <= rowEnd + 1; r++) {
    const isGap = gapRows.has(r) || r > rowEnd;
    if (!isGap && segStart === -1) {
      segStart = r;
    } else if (isGap && segStart !== -1) {
      colliders.push({
        x: px,
        y: segStart * TILE_H,
        w: TILE_W,
        h: (r - segStart) * TILE_H,
        label: `${label}-seg`,
      });
      segStart = -1;
    }
  }
}

/**
 * Add AABB colliders for a horizontal wall segment, splitting around door gaps.
 */
function addHorizontalWallColliders(
  colliders: Collider[],
  tileRow: number,
  colStart: number,
  colEnd: number,
  gapCols: Set<number>,
  label: string,
): void {
  const py = tileRow * TILE_H;
  let segStart = -1;
  for (let c = colStart; c <= colEnd + 1; c++) {
    const isGap = gapCols.has(c) || c > colEnd;
    if (!isGap && segStart === -1) {
      segStart = c;
    } else if (isGap && segStart !== -1) {
      colliders.push({
        x: segStart * TILE_W,
        y: py,
        w: (c - segStart) * TILE_W,
        h: TILE_H,
        label: `${label}-seg`,
      });
      segStart = -1;
    }
  }
}

