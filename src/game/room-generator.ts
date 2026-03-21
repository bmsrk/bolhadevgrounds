/**
 * src/game/room-generator.ts — Procedural room generation engine.
 *
 * Generates a single large open room centred in the world.
 * Furniture is placed exclusively along the four walls so the centre area
 * is always clear.  `spawnPoint` is the geometric centre of the room and is
 * guaranteed to be free of every collider.
 */

import type { GameMap, TileLayer, Collider, Zone, FurnitureShape, InteractiveObject } from '../types.js';
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

// ── Wall drawing helper ───────────────────────────────────────────────────────

/**
 * Draw a rectangular room's walls into the wallData array.
 * wallX/wallY/wallW/wallH are the full tile bounds (including the 1-tile border).
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
      else continue;

      wallData[idx] = tile;
    }
  }
}

// ── Single-room furniture placement ──────────────────────────────────────────

interface BigRoomPlacement {
  furniture:          FurnitureShape[];
  colliders:          Collider[];
  interactiveObjects: InteractiveObject[];
}

/**
 * Place furniture and interactive objects for the single big central room.
 *
 * Clear zone: x ∈ [240, 1040], y ∈ [160, 560].
 * All colliders sit outside this zone so the centre spawn point at
 * (WORLD_WIDTH/2, WORLD_HEIGHT/2) = (640, 360) is always collision-free.
 */
function placeBigRoomFurniture(rng: () => number): BigRoomPlacement {
  const furniture:          FurnitureShape[]   = [];
  const colliders:          Collider[]          = [];
  const interactiveObjects: InteractiveObject[] = [];

  const deskTile    = furnitureTileId('desk');    // 161
  const monitorTile = furnitureTileId('monitor'); // 136

  // ── North wall: 6 workstation desks (y = 32–64) ───────────────────────────
  // All desks sit at y = 32, well below the y = 160 clear-zone boundary.
  const deskW = 5 * TILE_W;  // 80 px
  const deskH = 2 * TILE_H;  // 32 px
  const deskY = 2 * TILE_H;  // y = 32 px  (row 2)
  for (const dx of [80, 272, 464, 656, 848, 1040]) {
    furniture.push({
      type: 'rect', x: dx, y: deskY, w: deskW, h: deskH, color: '#1c2a3a',
      tileSprites: makeTileComposite('interiors', [
        [deskTile, deskTile, deskTile, deskTile, deskTile],
        [deskTile, deskTile, deskTile, deskTile, deskTile],
      ]),
    });
    furniture.push({
      type: 'rect', x: dx + TILE_W, y: deskY + 4, w: TILE_W, h: TILE_H, color: '#1a3a6a',
      tileSprites: makeSingleRowComposite('interiors', monitorTile, 1),
    });
    colliders.push({ x: dx, y: deskY, w: deskW, h: deskH });
  }
  interactiveObjects.push({ x: 560, y: deskY + deskH + 30, r: 60, label: '💻 Open workspace', action: 'use' });

  // ── West wall: whiteboard (x = 32–80, y = 256–304) ───────────────────────
  // x = 32 < 240 clear-zone boundary ✓
  const wbX = 2 * TILE_W, wbY = 16 * TILE_H, wbW = 3 * TILE_W, wbH = 3 * TILE_H;
  furniture.push({
    type: 'rect', x: wbX, y: wbY, w: wbW, h: wbH, color: '#f0f0ff', label: '📋 Whiteboard',
    tileSprites: makeTileComposite('interiors', Array.from({ length: 3 }, () => [648, 648, 648])),
  });
  colliders.push({ x: wbX, y: wbY, w: wbW, h: wbH });
  interactiveObjects.push({ x: wbX + wbW + 35, y: wbY + wbH / 2, r: 50, label: '📋 Whiteboard', action: 'use' });

  // ── East wall: server rack (x = 1232–1264, y = 48–240) ───────────────────
  // x = 1232 > 1040 clear-zone boundary ✓
  const srX     = WORLD_WIDTH - 3 * TILE_W;  // 1232 px
  const srTilesH = 12;
  const srH     = srTilesH * TILE_H;          // 192 px
  const srY     = 3 * TILE_H;                 // y = 48
  furniture.push({
    type: 'rect', x: srX, y: srY, w: 2 * TILE_W, h: srH, color: '#0a1a2a', label: '⚙️ Servers',
    tileSprites: makeTileComposite('interiors', Array.from({ length: srTilesH }, () => [152, 152])),
  });
  colliders.push({ x: srX, y: srY, w: 2 * TILE_W, h: srH, label: 'server-rack' });
  interactiveObjects.push({ x: srX - 40, y: srY + srH / 2, r: 50, label: '⚙️ Server rack', action: 'use' });

  // ── South wall: lounge area (y ≥ 592) ────────────────────────────────────
  // All south furniture sits at y ≥ 592 > 560 clear-zone boundary ✓
  const sofaY    = WORLD_HEIGHT - 5 * TILE_H;  // y = 640
  const sofaRows = [[177, 177, 177, 177, 177, 177], [177, 177, 177, 177, 177, 177]];
  // Left sofa
  furniture.push({
    type: 'rect', x: 6 * TILE_W, y: sofaY, w: 6 * TILE_W, h: 2 * TILE_H, color: '#5a4820', label: '🛋️ Sofa',
    tileSprites: makeTileComposite('interiors', sofaRows),
  });
  colliders.push({ x: 6 * TILE_W, y: sofaY, w: 6 * TILE_W, h: 2 * TILE_H });
  // Coffee table
  furniture.push({
    type: 'rect', x: 14 * TILE_W, y: sofaY + 8, w: 3 * TILE_W, h: 2 * TILE_H, color: '#3a2a08',
    tileSprites: makeSingleRowComposite('interiors', 161, 3),
  });
  // Right sofa
  furniture.push({
    type: 'rect', x: 19 * TILE_W, y: sofaY, w: 6 * TILE_W, h: 2 * TILE_H, color: '#5a4820',
    tileSprites: makeTileComposite('interiors', sofaRows),
  });
  colliders.push({ x: 19 * TILE_W, y: sofaY, w: 6 * TILE_W, h: 2 * TILE_H });
  interactiveObjects.push({ x: 16 * TILE_W, y: sofaY - 20, r: 55, label: '🛋️ Lounge area', action: 'sit' });

  // TV on south wall
  const tvW = 8 * TILE_W, tvH = 2 * TILE_H;
  const tvX = WORLD_WIDTH / 2 - tvW / 2;   // centred horizontally
  const tvY = WORLD_HEIGHT - tvH - TILE_H;  // y = 672
  furniture.push({
    type: 'rect', x: tvX, y: tvY, w: tvW, h: tvH, color: '#0a0a1a', label: '📺 TV',
    tileSprites: makeTileComposite('interiors', Array.from({ length: 2 }, () => Array(8).fill(152))),
  });
  colliders.push({ x: tvX, y: tvY, w: tvW, h: tvH });
  interactiveObjects.push({ x: tvX + tvW / 2, y: tvY - 20, r: 55, label: '📺 Chill zone', action: 'sit' });

  // ── Corner plants ─────────────────────────────────────────────────────────
  furniture.push({ type: 'rect', x: 2 * TILE_W,             y: 2 * TILE_H,             w: TILE_W, h: TILE_H, color: '#1a6a1a', tileSprite: iT(16) });
  furniture.push({ type: 'rect', x: WORLD_WIDTH - 3 * TILE_W, y: 2 * TILE_H,             w: TILE_W, h: TILE_H, color: '#1a5a1a', tileSprite: iT(1)  });
  furniture.push({ type: 'rect', x: 2 * TILE_W,             y: WORLD_HEIGHT - 3 * TILE_H, w: TILE_W, h: TILE_H, color: '#1a5a1a', tileSprite: iT(1)  });
  furniture.push({ type: 'rect', x: WORLD_WIDTH - 3 * TILE_W, y: WORLD_HEIGHT - 3 * TILE_H, w: TILE_W, h: TILE_H, color: '#1a6a1a', tileSprite: iT(16) });

  // Optional mid-wall plants (seeded)
  if (rng() > 0.3) {
    furniture.push({ type: 'rect', x: 2 * TILE_W, y: 28 * TILE_H,             w: TILE_W, h: TILE_H, color: '#1a6a1a', tileSprite: iT(16) });
  }
  if (rng() > 0.3) {
    furniture.push({ type: 'rect', x: WORLD_WIDTH - 3 * TILE_W, y: 28 * TILE_H, w: TILE_W, h: TILE_H, color: '#1a5a1a', tileSprite: iT(1)  });
  }

  return { furniture, colliders, interactiveObjects };
}

// ── Main generation function ──────────────────────────────────────────────────

/**
 * Generate a GameMap with a single large open central room.
 *
 * The room fills the entire world interior (outer walls only, no partitions).
 * Furniture is placed along the walls, leaving the centre open.
 * `spawnPoint` is the geometric centre and is guaranteed clear of all colliders.
 *
 * @param seed - Deterministic seed; same seed always produces the same map.
 * @param room - Optional partial RoomTemplate to override the floor theme,
 *               zone name, and zone colour.
 */
export function generateMap(seed = 0, room?: Partial<RoomTemplate>): GameMap {
  const rng = createRng(seed);

  // ── Room configuration ────────────────────────────────────────────────────
  const FLOOR_THEMES: FloorTheme[] = ['office', 'tan', 'teal', 'wood', 'beige', 'stone'];
  const floorTheme: FloorTheme =
    room?.floorTheme ?? FLOOR_THEMES[Math.floor(rng() * FLOOR_THEMES.length)]!;
  const zoneName  = room?.name      ?? 'Main Hall';
  const zoneColor = room?.zoneColor ?? 'rgba(52,152,219,0.05)';

  // ── Tile data ─────────────────────────────────────────────────────────────
  const size = MAP_COLS * MAP_ROWS;
  const floorData = new Array<number>(size).fill(-1);
  const wallData  = new Array<number>(size).fill(-1);

  // Fill interior floor (cols 1–78, rows 1–43)
  for (let r = 1; r < MAP_ROWS - 1; r++) {
    for (let c = 1; c < MAP_COLS - 1; c++) {
      floorData[r * MAP_COLS + c] = fillFloorForTheme(c, r, floorTheme);
    }
  }

  // 1-tile perimeter border ring with alternate shade
  fillFloorBorder(floorData, 1, 1, MAP_COLS - 2, MAP_ROWS - 2, floorTheme);

  // Outer boundary walls
  drawRoomWalls(wallData, 0, 0, MAP_COLS, MAP_ROWS, new Set(), new Set());

  // ── Outer-wall colliders ─────────────────────────────────────────────────
  const allColliders: Collider[] = [
    { x: 0,                    y: 0,                     w: WORLD_WIDTH, h: TILE_H,       label: 'outer-top'    },
    { x: 0,                    y: WORLD_HEIGHT - TILE_H, w: WORLD_WIDTH, h: TILE_H,       label: 'outer-bottom' },
    { x: 0,                    y: 0,                     w: TILE_W,      h: WORLD_HEIGHT, label: 'outer-left'   },
    { x: WORLD_WIDTH - TILE_W, y: 0,                     w: TILE_W,      h: WORLD_HEIGHT, label: 'outer-right'  },
  ];

  // ── Furniture + interactive objects ──────────────────────────────────────
  const { furniture: allFurniture, colliders: furnColliders, interactiveObjects } =
    placeBigRoomFurniture(rng);
  allColliders.push(...furnColliders);

  // ── Tile layers ──────────────────────────────────────────────────────────
  const floorLayer: TileLayer = {
    sheet: 'room-builder', mapCols: MAP_COLS, mapRows: MAP_ROWS,
    tileW: TILE_W, tileH: TILE_H, data: floorData,
    offsetX: 0, offsetY: 0, z: 0, alpha: 0.9,
  };
  const wallLayer: TileLayer = {
    sheet: 'room-builder', mapCols: MAP_COLS, mapRows: MAP_ROWS,
    tileW: TILE_W, tileH: TILE_H, data: wallData,
    offsetX: 0, offsetY: 0, z: 1, alpha: 1.0,
  };

  return {
    worldWidth:  WORLD_WIDTH,
    worldHeight: WORLD_HEIGHT,
    zones: [{
      x: TILE_W,
      y: TILE_H,
      w: WORLD_WIDTH  - 2 * TILE_W,
      h: WORLD_HEIGHT - 2 * TILE_H,
      label: zoneName,
      color: zoneColor,
    }],
    colliders:          allColliders,
    furniture:          allFurniture,
    tiles:              [floorLayer, wallLayer],
    spawnPoint:         { x: WORLD_WIDTH / 2, y: WORLD_HEIGHT / 2 },
    interactiveObjects,
  };
}
