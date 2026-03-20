import type { GameMap, TileLayer, InteractiveObject } from '../types.js';
import { WORLD_WIDTH, WORLD_HEIGHT } from '../constants.js';

// ── Floor tile layer (Room Builder 16 × 16) ───────────────────────────────────
// World is exactly 1280 × 720 = 80 × 45 tiles at 16 px each.
// Room_Builder_free_16x16.png has 17 columns.
// Tile IDs: id = sheetRow * 17 + sheetCol  (0-based, row-major in sheet).
//
// Tile palette used:
//   289 / 290 / 291  — cool blue-gray office floor  (row 17, cols 0-2)
//   306 / 307 / 308  — slightly darker blue-gray     (row 18, cols 0-2)
//   119 / 120 / 121  — warm beige floor              (row 7,  cols 0-2)
//   136 / 137 / 138  — warm tan/wood floor           (row 8,  cols 0-2)
//   187 / 188 / 189  — medium-brown wood floor       (row 11, cols 0-2)
//   204 / 205 / 206  — darker brown wood floor       (row 12, cols 0-2)
const _TILE_COLS = 80;   // WORLD_WIDTH  / 16
const _TILE_ROWS = 45;   // WORLD_HEIGHT / 16
const _RB_COLS   = 17;   // Room_Builder sheet columns (for tile id formula)

// ── Tile helpers ─────────────────────────────────────────────────────────────
/** Return a Room_Builder tile id from sheet row and column. */
function rbTile(row: number, col: number): number { return row * _RB_COLS + col; }

// Named tile IDs
const TILE_OFFICE_A  = rbTile(17, 0);   // 289 — cool blue-gray office floor A
const TILE_OFFICE_B  = rbTile(17, 1);   // 290 — cool blue-gray office floor B
const TILE_OFFICE_C  = rbTile(17, 2);   // 291 — cool blue-gray office floor C
const TILE_OFFICE_D  = rbTile(18, 0);   // 306 — darker blue-gray floor A
const TILE_OFFICE_E  = rbTile(18, 1);   // 307 — darker blue-gray floor B
const TILE_OFFICE_F  = rbTile(18, 2);   // 308 — darker blue-gray floor C
const TILE_BEIGE_A   = rbTile(7,  0);   // 119 — warm beige floor A
const TILE_BEIGE_B   = rbTile(7,  1);   // 120 — warm beige floor B
const TILE_BEIGE_C   = rbTile(7,  2);   // 121 — warm beige floor C
const TILE_TAN_A     = rbTile(8,  0);   // 136 — warm tan/wood floor A
const TILE_TAN_B     = rbTile(8,  1);   // 137 — warm tan floor B
const TILE_TAN_C     = rbTile(8,  2);   // 138 — warm tan floor C
const TILE_WOOD_A    = rbTile(11, 0);   // 187 — medium-brown wood A
const TILE_WOOD_B    = rbTile(11, 1);   // 188 — medium-brown wood B
const TILE_WOOD_C    = rbTile(11, 2);   // 189 — medium-brown wood C
const TILE_DKWOOD_A  = rbTile(12, 0);   // 204 — darker brown wood A
const TILE_DKWOOD_B  = rbTile(12, 1);   // 205 — darker brown wood B
const TILE_DKWOOD_C  = rbTile(12, 2);   // 206 — darker brown wood C

// Cool teal floor (rows 9–10)
const TILE_TEAL_A    = rbTile(9,  0);   // 153 — teal A
const TILE_TEAL_B    = rbTile(9,  1);   // 154 — teal B
const TILE_TEAL_C    = rbTile(9,  2);   // 155 — teal C
const TILE_TEAL_D    = rbTile(10, 0);   // 170 — dark teal A
const TILE_TEAL_E    = rbTile(10, 1);   // 171 — dark teal B
const TILE_TEAL_F    = rbTile(10, 2);   // 172 — dark teal C

// Warm neutral / stone floor (rows 19–20)
const TILE_STONE_A   = rbTile(19, 0);   // 323 — warm neutral A
const TILE_STONE_B   = rbTile(19, 1);   // 324 — warm neutral B
const TILE_STONE_C   = rbTile(19, 2);   // 325 — warm neutral C
const TILE_STONE_D   = rbTile(20, 0);   // 340 — stone A
const TILE_STONE_E   = rbTile(20, 1);   // 341 — stone B
const TILE_STONE_F   = rbTile(20, 2);   // 342 — stone C

// Glass-partition wall tile (Room_Builder row 0, col 7 — medium gray #c1c1c8)
const TILE_PARTITION = rbTile(0, 7);    //   7 — partition wall

/** Return a repeating 3×2 tile pattern index for (col, row) in world tiles. */
function officeFloor(col: number, row: number): number {
  const x = col % 3;
  const y = row % 2;
  const base = y === 0
    ? [TILE_OFFICE_A, TILE_OFFICE_B, TILE_OFFICE_C]
    : [TILE_OFFICE_D, TILE_OFFICE_E, TILE_OFFICE_F];
  return base[x] ?? TILE_OFFICE_A;
}

function beigeFloor(col: number, row: number): number {
  const x = col % 3;
  return [TILE_BEIGE_A, TILE_BEIGE_B, TILE_BEIGE_C][x] ?? TILE_BEIGE_A;
}

function woodFloor(col: number, row: number): number {
  const x = col % 3;
  const y = row % 2;
  return y === 0
    ? ([TILE_WOOD_A,   TILE_WOOD_B,   TILE_WOOD_C  ][x] ?? TILE_WOOD_A)
    : ([TILE_DKWOOD_A, TILE_DKWOOD_B, TILE_DKWOOD_C][x] ?? TILE_DKWOOD_A);
}

/** Cool teal floor for the Engineering zone. */
function tealFloor(col: number, row: number): number {
  const x = col % 3;
  const y = row % 2;
  return y === 0
    ? ([TILE_TEAL_A, TILE_TEAL_B, TILE_TEAL_C][x] ?? TILE_TEAL_A)
    : ([TILE_TEAL_D, TILE_TEAL_E, TILE_TEAL_F][x] ?? TILE_TEAL_D);
}

/** Warm stone / neutral floor for the Design Studio and Product Area zones. */
function stoneFloor(col: number, row: number): number {
  const x = col % 3;
  const y = row % 2;
  return y === 0
    ? ([TILE_STONE_A, TILE_STONE_B, TILE_STONE_C][x] ?? TILE_STONE_A)
    : ([TILE_STONE_D, TILE_STONE_E, TILE_STONE_F][x] ?? TILE_STONE_D);
}

// ── Zone boundaries in tile coords ───────────────────────────────────────────
// Zones (px → tiles): Open Workspace 0-24×0-18, Meeting 26-44×0-18,
//   Engineering 45-79×0-18, Lounge 0-17×20-44, Product 18-44×20-44,
//   Design 45-79×20-44.
const _ZO = { x1:  0, x2: 25, y1:  0, y2: 18 };   // Open Workspace
const _ZM = { x1: 26, x2: 44, y1:  0, y2: 18 };   // Meeting Room
const _ZE = { x1: 45, x2: 79, y1:  0, y2: 18 };   // Engineering
const _ZL = { x1:  0, x2: 17, y1: 20, y2: 44 };   // Lounge
const _ZP = { x1: 18, x2: 44, y1: 20, y2: 44 };   // Product Area
const _ZD = { x1: 45, x2: 79, y1: 20, y2: 44 };   // Design Studio

const _floorLayer: TileLayer = {
  sheet:   'room-builder',
  mapCols: _TILE_COLS,
  mapRows: _TILE_ROWS,
  tileW:   16,
  tileH:   16,
  data: Array.from({ length: _TILE_COLS * _TILE_ROWS }, (_, i) => {
    const col = i % _TILE_COLS;
    const row = Math.floor(i / _TILE_COLS);

    // Lounge zone — warm wood floor
    if (col >= _ZL.x1 && col <= _ZL.x2 && row >= _ZL.y1 && row <= _ZL.y2)
      return woodFloor(col, row);

    // Meeting room — warm beige/tan floor
    if (col >= _ZM.x1 && col <= _ZM.x2 && row >= _ZM.y1 && row <= _ZM.y2)
      return beigeFloor(col, row);

    // Engineering — cool teal floor
    if (col >= _ZE.x1 && col <= _ZE.x2 && row >= _ZE.y1 && row <= _ZE.y2)
      return tealFloor(col, row);

    // Design Studio — warm stone / neutral floor
    if (col >= _ZD.x1 && col <= _ZD.x2 && row >= _ZD.y1 && row <= _ZD.y2)
      return stoneFloor(col, row);

    // Product Area — warm beige floor
    if (col >= _ZP.x1 && col <= _ZP.x2 && row >= _ZP.y1 && row <= _ZP.y2)
      return beigeFloor(col, row);

    // Corridor between floor halves (row 19) — neutral office tile
    if (row === 19) return officeFloor(col, row);

    // Default: cool blue-gray office tiles (Open Workspace + borders)
    return officeFloor(col, row);
  }),
  offsetX: 0,
  offsetY: 0,
  z:       0,
  alpha:   0.55,
};

// ── Wall / partition overlay tile layer (z = 1) ───────────────────────────────
// Draws glass-partition tiles at zone boundaries, rendered above zone colour
// fills.  Positions align with the physics colliders already in place.
//
// Partition columns (tile coords):
//   col 26  — meeting-room left wall  (pixel x ≈ 416)
//   col 44  — meeting-room right / engineering-left wall  (pixel x ≈ 704)
//   col 17  — lounge-right / product-area-left wall       (pixel x ≈ 272)
//
// Rows start at 2 (skip outer-wall band + entry gap) and end at 16 (upper half)
// or 43 (lower half).
const _wallLayer: TileLayer = {
  sheet:   'room-builder',
  mapCols: _TILE_COLS,
  mapRows: _TILE_ROWS,
  tileW:   16,
  tileH:   16,
  data: Array.from({ length: _TILE_COLS * _TILE_ROWS }, (_, i) => {
    const col = i % _TILE_COLS;
    const row = Math.floor(i / _TILE_COLS);

    // Meeting-room left glass partition
    if (col === 26 && row >= 2 && row <= 16) return TILE_PARTITION;
    // Meeting-room right / engineering-left glass partition
    if (col === 44 && row >= 2 && row <= 16) return TILE_PARTITION;
    // Lounge-right / product-area-left glass partition
    if (col === 17 && row >= 20 && row <= 43) return TILE_PARTITION;

    return -1;
  }),
  offsetX: 0,
  offsetY: 0,
  z:       1,
  alpha:   1.0,
};

// ── Interactive proximity objects ─────────────────────────────────────────────
// These are checked each frame in main.ts; a tooltip is shown when the local
// player is within `r` px of the object centre.
export const INTERACTIVE_OBJECTS: readonly InteractiveObject[] = [
  { x: 190, y: 440, r: 45, label: '☕ Grab a coffee'          },
  { x: 550, y: 130, r: 65, label: '📋 Join the meeting'       },
  { x: 785, y: 285, r: 55, label: '📝 View architecture'      },
  { x:  95, y: 570, r: 55, label: '🛋️ Take a break'           },
  { x: 400, y: 400, r: 40, label: '💻 Product backlog'        },
  { x: 960, y: 400, r: 50, label: '🎨 Design review'          },
  { x: 960, y: 130, r: 50, label: '⚙️ Engineering standup'    },
  { x: 280, y: 570, r: 45, label: '🏓 Game room'              },
];

/**
 * Static map definition for "Startup Devgrounds".
 * Zones divide the office into functional areas.
 * Colliders block movement (walls, large furniture).
 * Furniture shapes are purely decorative silhouettes.
 */
export const GAME_MAP: GameMap = {
  worldWidth:  WORLD_WIDTH,
  worldHeight: WORLD_HEIGHT,

  // ── Zones (background tint areas) ──────────────────────────────────────
  zones: [
    { x: 20,   y: 20,  w: 380, h: 280, label: 'Open Workspace',  color: 'rgba(52,152,219,0.10)' },
    { x: 420,  y: 20,  w: 280, h: 280, label: 'Meeting Room',    color: 'rgba(46,204,113,0.10)' },
    { x: 720,  y: 20,  w: 540, h: 280, label: 'Engineering',     color: 'rgba(155,89,182,0.10)' },
    { x: 20,   y: 320, w: 240, h: 380, label: 'Lounge',          color: 'rgba(241,196,15,0.10)' },
    { x: 280,  y: 320, w: 420, h: 380, label: 'Product Area',    color: 'rgba(230,126,34,0.10)' },
    { x: 720,  y: 320, w: 540, h: 380, label: 'Design Studio',   color: 'rgba(231,76,60,0.10)'  },
  ],

  // ── Colliders (solid walls / obstacles) ────────────────────────────────
  colliders: [
    // Outer walls
    { x: 0,   y: 0,             w: WORLD_WIDTH,  h: 10,  label: 'top'    },
    { x: 0,   y: WORLD_HEIGHT - 10, w: WORLD_WIDTH, h: 10,  label: 'bottom' },
    { x: 0,   y: 0,             w: 10,           h: WORLD_HEIGHT, label: 'left'   },
    { x: WORLD_WIDTH - 10, y: 0, w: 10,          h: WORLD_HEIGHT, label: 'right'  },

    // Meeting room walls (glass partitions)
    { x: 418, y: 20,  w: 4,  h: 240, label: 'meet-left'   },
    { x: 698, y: 20,  w: 4,  h: 240, label: 'meet-right'  },
    { x: 418, y: 256, w: 284, h: 4,  label: 'meet-bottom' },

    // Conference table (solid obstacle)
    { x: 460, y: 80,  w: 180, h: 100, label: 'conf-table' },

    // Engineering partition wall
    { x: 718, y: 20,  w: 4,  h: 240, label: 'eng-left' },

    // Lounge partition wall
    { x: 278, y: 318, w: 4,  h: 384, label: 'lounge-right' },

    // Open workspace desks (3 columns × 3 rows)
    { x: 40,  y: 60,  w: 80, h: 40 },
    { x: 40,  y: 130, w: 80, h: 40 },
    { x: 40,  y: 200, w: 80, h: 40 },
    { x: 160, y: 60,  w: 80, h: 40 },
    { x: 160, y: 130, w: 80, h: 40 },
    { x: 160, y: 200, w: 80, h: 40 },
    { x: 280, y: 60,  w: 80, h: 40 },
    { x: 280, y: 130, w: 80, h: 40 },
    { x: 280, y: 200, w: 80, h: 40 },

    // Engineering desks (2 rows × 4 columns)
    { x: 740,  y: 50,  w: 80, h: 40 },
    { x: 840,  y: 50,  w: 80, h: 40 },
    { x: 940,  y: 50,  w: 80, h: 40 },
    { x: 1040, y: 50,  w: 80, h: 40 },
    { x: 740,  y: 140, w: 80, h: 40 },
    { x: 840,  y: 140, w: 80, h: 40 },
    { x: 940,  y: 140, w: 80, h: 40 },
    { x: 1040, y: 140, w: 80, h: 40 },

    // Design Studio desks (1 row × 4 columns)
    { x: 740,  y: 380, w: 80, h: 40 },
    { x: 840,  y: 380, w: 80, h: 40 },
    { x: 940,  y: 380, w: 80, h: 40 },
    { x: 1040, y: 380, w: 80, h: 40 },

    // Product Area desks (1 row × 4 columns)
    { x: 300, y: 380, w: 80, h: 40 },
    { x: 400, y: 380, w: 80, h: 40 },
    { x: 500, y: 380, w: 80, h: 40 },
    { x: 600, y: 380, w: 80, h: 40 },

    // Lounge sofas
    { x: 40,  y: 380, w: 100, h: 50 },
    { x: 40,  y: 500, w: 100, h: 50 },

    // Game room table (lounge area)
    { x: 155, y: 480, w: 90,  h: 60 },
  ],

  // ── Furniture shapes (visual only, no collision) ────────────────────────
  // Pixel-art tile IDs reference Interiors_free_16x16.png (16 cols × 89 rows).
  // id = sheetRow * 16 + sheetCol.
  //   Tile 136 (row=8,col=8)  = dark monitor screen
  //   Tile 152 (row=9,col=8)  = darker filled screen
  //   Tile 648 (row=40,col=8) = light panel / whiteboard
  furniture: [
    // ── Open workspace monitors (blue desk theme) ──────────────────────
    ...[60, 130, 200].flatMap(y =>
      [42, 162, 282].map(x => ({
        type: 'rect' as const, x, y: y + 8, w: 30, h: 22, color: '#1a3a6a',
        tileSprite: { sheet: 'interiors', tileId: 136 },
      }))
    ),
    // Desk surfaces
    ...[60, 130, 200].flatMap(y =>
      [40, 160, 280].map(x => ({
        type: 'rect' as const, x, y, w: 80, h: 38, color: '#1c2a3a',
        tileSprite: { sheet: 'interiors', tileId: 161 },
      }))
    ),

    // ── Conference table & chairs ──────────────────────────────────────
    { type: 'rect', x: 462, y: 82, w: 176, h: 96, color: '#1a3a50', label: '📋 Meeting',
      tileSprite: { sheet: 'interiors', tileId: 161 } },
    // North chairs
    { type: 'circle', x: 480, y: 76,  r: 10, color: '#1e3a50' },
    { type: 'circle', x: 520, y: 76,  r: 10, color: '#1e3a50' },
    { type: 'circle', x: 560, y: 76,  r: 10, color: '#1e3a50' },
    { type: 'circle', x: 600, y: 76,  r: 10, color: '#1e3a50' },
    // South chairs
    { type: 'circle', x: 480, y: 184, r: 10, color: '#1e3a50' },
    { type: 'circle', x: 520, y: 184, r: 10, color: '#1e3a50' },
    { type: 'circle', x: 560, y: 184, r: 10, color: '#1e3a50' },
    { type: 'circle', x: 600, y: 184, r: 10, color: '#1e3a50' },
    // Side chairs
    { type: 'circle', x: 454, y: 110, r: 10, color: '#1e3a50' },
    { type: 'circle', x: 454, y: 140, r: 10, color: '#1e3a50' },
    { type: 'circle', x: 648, y: 110, r: 10, color: '#1e3a50' },
    { type: 'circle', x: 648, y: 140, r: 10, color: '#1e3a50' },

    // ── Engineering monitors (purple desk theme) ───────────────────────
    ...[50, 140].flatMap(y =>
      [740, 840, 940, 1040].map(x => ({
        type: 'rect' as const, x: x + 2, y: y + 6, w: 36, h: 26, color: '#2a1a4a',
        tileSprite: { sheet: 'interiors', tileId: 136 },
      }))
    ),
    // Desk surfaces
    ...[50, 140].flatMap(y =>
      [740, 840, 940, 1040].map(x => ({
        type: 'rect' as const, x, y, w: 80, h: 38, color: '#1a1030',
        tileSprite: { sheet: 'interiors', tileId: 128 },
      }))
    ),
    // Engineering whiteboards
    { type: 'rect', x: 725, y: 240, w: 140, h: 55, color: '#f0f0ff', label: '📐 Architecture',
      tileSprite: { sheet: 'interiors', tileId: 648 } },
    { type: 'rect', x: 900, y: 240, w: 120, h: 55, color: '#f0f0ff', label: '📝 Board',
      tileSprite: { sheet: 'interiors', tileId: 648 } },

    // ── Design Studio monitors (red desk theme) ────────────────────────
    ...[740, 840, 940, 1040].map(x => ({
      type: 'rect' as const, x: x + 2, y: 386, w: 36, h: 26, color: '#4a1a2a',
      tileSprite: { sheet: 'interiors', tileId: 136 },
    })),
    // Desk surfaces
    ...[740, 840, 940, 1040].map(x => ({
      type: 'rect' as const, x, y: 380, w: 80, h: 38, color: '#2e0e16',
      tileSprite: { sheet: 'interiors', tileId: 161 },
    })),
    // Design Studio big screen (for design reviews)
    { type: 'rect', x: 1100, y: 380, w: 150, h: 90, color: '#1a0010',
      tileSprite: { sheet: 'interiors', tileId: 152 }, label: '🎨 Design' },

    // ── Product Area monitors (orange desk theme) ──────────────────────
    ...[300, 400, 500, 600].map(x => ({
      type: 'rect' as const, x: x + 2, y: 386, w: 36, h: 26, color: '#3a2008',
      tileSprite: { sheet: 'interiors', tileId: 136 },
    })),
    // Desk surfaces
    ...[300, 400, 500, 600].map(x => ({
      type: 'rect' as const, x, y: 380, w: 80, h: 38, color: '#20140a',
      tileSprite: { sheet: 'interiors', tileId: 161 },
    })),
    // Product backlog board
    { type: 'rect', x: 285, y: 460, w: 120, h: 70, color: '#3a2800', label: '📋 Backlog',
      tileSprite: { sheet: 'interiors', tileId: 648 } },

    // ── Lounge ────────────────────────────────────────────────────────
    // Sofas
    { type: 'rect', x: 42,  y: 382, w: 96, h: 46, color: '#5a4820', label: '🛋️ Sofa',
      tileSprite: { sheet: 'interiors', tileId: 177 } },
    { type: 'rect', x: 42,  y: 502, w: 96, h: 46, color: '#5a4820',
      tileSprite: { sheet: 'interiors', tileId: 177 } },
    // Coffee table
    { type: 'rect', x: 158, y: 425, w: 70, h: 50, color: '#3a2a08', label: '☕',
      tileSprite: { sheet: 'interiors', tileId: 161 } },
    // Lounge wall screen (video call)
    { type: 'rect', x: 42, y: 595, w: 100, h: 60, color: '#0a0a1a', label: '📺 TV',
      tileSprite: { sheet: 'interiors', tileId: 152 } },

    // ── Game room (lounge corner) ──────────────────────────────────────
    { type: 'rect', x: 157, y: 482, w: 88, h: 56, color: '#2a1a40', label: '🏓 Games',
      tileSprite: { sheet: 'interiors', tileId: 176 } },

    // ── Plants / greenery — pixel-art tile sprites ─────────────────────
    // Large plants (28 × 28 canvas px, Interiors tile id 16 — bright green)
    { type: 'rect', x: 376, y:  26, w: 28, h: 28, color: '#1a6a1a',
      tileSprite: { sheet: 'interiors', tileId: 16 } },
    { type: 'rect', x: 376, y: 276, w: 28, h: 28, color: '#1a6a1a',
      tileSprite: { sheet: 'interiors', tileId: 16 } },
    { type: 'rect', x: 1236, y:  26, w: 28, h: 28, color: '#1a6a1a',
      tileSprite: { sheet: 'interiors', tileId: 16 } },
    { type: 'rect', x: 1236, y: 676, w: 28, h: 28, color: '#1a6a1a',
      tileSprite: { sheet: 'interiors', tileId: 16 } },
    { type: 'rect', x:  26,  y: 676, w: 28, h: 28, color: '#1a6a1a',
      tileSprite: { sheet: 'interiors', tileId: 16 } },
    // Medium plants (22 × 22 canvas px, Interiors tile id 1 — medium green)
    { type: 'rect', x: 704, y: 299, w: 22, h: 22, color: '#1a5a1a',
      tileSprite: { sheet: 'interiors', tileId: 1 } },
    { type: 'rect', x: 704, y: 679, w: 22, h: 22, color: '#1a5a1a',
      tileSprite: { sheet: 'interiors', tileId: 1 } },
    { type: 'rect', x: 259, y: 299, w: 22, h: 22, color: '#1a5a1a',
      tileSprite: { sheet: 'interiors', tileId: 1 } },
  ],

  tiles: [_floorLayer, _wallLayer],
};
