import type { GameMap, TileLayer } from '../types.js';
import { WORLD_WIDTH, WORLD_HEIGHT } from '../constants.js';
import { generateMap } from './room-generator.js';

// ── Tile sheet constants ──────────────────────────────────────────────────────
// World: 1280 × 720 = 80 × 45 tiles at 16 px/tile.
// Room_Builder_free_16x16.png : 17 cols × 21 rows.
// Interiors_free_16x16.png    : 16 cols × 89 rows.
//
// Complete revamp — symmetric 2-row × 3-column zone grid:
//
//  col:  0   1–17  18  19–44  45  46–78  79
//  row 0  ┌─────────────────────────────────┐  outer top wall
//  1–16   │  OW  ║  MEETING   ║  ENG        │  top zones
//  row 17 ├──────╫────────────╫─────────────┤  horizontal wall (4-tile doors)
//  18–19  │           corridor               │  2-tile hallway
//  row 20 ├──────╫────────────╫─────────────┤  horizontal wall (4-tile doors)
//  21–43  │  LNG ║  PRODUCT   ║  DESIGN     │  bottom zones
//  row 44 └─────────────────────────────────┘  outer bottom wall
//
// Vertical walls at col 18 (x = 288) and col 45 (x = 720).
// Horizontal walls at row 17 (y = 272) and row 20 (y = 320).
// Doorways are 4 tiles (64 px) wide/tall for comfortable player passage.

const _TILE_COLS = 80;   // WORLD_WIDTH  / 16
const _TILE_ROWS = 45;   // WORLD_HEIGHT / 16
const _RB_COLS   = 17;   // Room_Builder sheet columns

// ── Room_Builder tile ID helper ───────────────────────────────────────────────
function rbTile(row: number, col: number): number { return row * _RB_COLS + col; }

// Floor tile palette (Room_Builder sheet)
const TILE_OFFICE_A = rbTile(17, 0);  // cool blue-gray A
const TILE_OFFICE_B = rbTile(17, 1);  // cool blue-gray B
const TILE_OFFICE_C = rbTile(17, 2);  // cool blue-gray C
const TILE_OFFICE_D = rbTile(18, 0);  // darker blue-gray A
const TILE_OFFICE_E = rbTile(18, 1);  // darker blue-gray B
const TILE_OFFICE_F = rbTile(18, 2);  // darker blue-gray C
const TILE_BEIGE_A  = rbTile(7,  0);  // warm beige A
const TILE_BEIGE_B  = rbTile(7,  1);  // warm beige B
const TILE_BEIGE_C  = rbTile(7,  2);  // warm beige C
const TILE_TAN_A    = rbTile(8,  0);  // warm tan A
const TILE_TAN_B    = rbTile(8,  1);  // warm tan B
const TILE_TAN_C    = rbTile(8,  2);  // warm tan C
const TILE_WOOD_A   = rbTile(11, 0);  // medium wood A
const TILE_WOOD_B   = rbTile(11, 1);  // medium wood B
const TILE_WOOD_C   = rbTile(11, 2);  // medium wood C
const TILE_DKWOOD_A = rbTile(12, 0);  // dark wood A
const TILE_DKWOOD_B = rbTile(12, 1);  // dark wood B
const TILE_DKWOOD_C = rbTile(12, 2);  // dark wood C
const TILE_TEAL_A   = rbTile(9,  0);  // teal A
const TILE_TEAL_B   = rbTile(9,  1);  // teal B
const TILE_TEAL_C   = rbTile(9,  2);  // teal C
const TILE_TEAL_D   = rbTile(10, 0);  // dark teal A
const TILE_TEAL_E   = rbTile(10, 1);  // dark teal B
const TILE_TEAL_F   = rbTile(10, 2);  // dark teal C
const TILE_STONE_A  = rbTile(19, 0);  // stone A
const TILE_STONE_B  = rbTile(19, 1);  // stone B
const TILE_STONE_C  = rbTile(19, 2);  // stone C
const TILE_STONE_D  = rbTile(20, 0);  // dark stone A
const TILE_STONE_E  = rbTile(20, 1);  // dark stone B
const TILE_STONE_F  = rbTile(20, 2);  // dark stone C
const TILE_WALL     = rbTile(0,  7);  // glass partition / wall tile

// ── Layout constants (tile coordinates) ──────────────────────────────────────
const _WC1 = 18;   // vertical wall col 1 (x = 288)
const _WC2 = 45;   // vertical wall col 2 (x = 720)
const _WR1 = 17;   // top corridor wall row    (y = 272)
const _WR2 = 20;   // bottom corridor wall row (y = 320)
// Top zone row range (between outer wall and top corridor wall)
const _TR1 = 1;
const _TR2 = 16;
// Bottom zone row range (between bottom corridor wall and outer bottom wall)
const _BR1 = 21;
const _BR2 = 43;

// Doorway gaps (tile coords, inclusive) — 4 tiles = 64 px
// Vertical walls: door rows within each zone half
const _DV_T1 = 7,  _DV_T2 = 10;   // top-zone door    (rows 7-10, y = 112-176)
const _DV_B1 = 30, _DV_B2 = 33;   // bottom-zone door (rows 30-33, y = 480-544)
// Horizontal walls: door cols per zone column
const _DH_L1 = 7,  _DH_L2 = 10;   // left-zone door   (cols 7-10,  x = 112-176)
const _DH_M1 = 29, _DH_M2 = 32;   // mid-zone door    (cols 29-32, x = 464-528)
const _DH_R1 = 60, _DH_R2 = 63;   // right-zone door  (cols 60-63, x = 960-1024)

// ── Floor tile pattern helpers ────────────────────────────────────────────────
function officeFloor(c: number, r: number): number {
  const x = c % 3, y = r % 2;
  return (y === 0
    ? [TILE_OFFICE_A, TILE_OFFICE_B, TILE_OFFICE_C]
    : [TILE_OFFICE_D, TILE_OFFICE_E, TILE_OFFICE_F])[x] ?? TILE_OFFICE_A;
}

function tanFloor(c: number, r: number): number {
  const x = c % 3, y = r % 2;
  return (y === 0
    ? [TILE_BEIGE_A, TILE_BEIGE_B, TILE_BEIGE_C]
    : [TILE_TAN_A,   TILE_TAN_B,   TILE_TAN_C  ])[x] ?? TILE_BEIGE_A;
}

function woodFloor(c: number, r: number): number {
  const x = c % 3, y = r % 2;
  return (y === 0
    ? [TILE_WOOD_A,   TILE_WOOD_B,   TILE_WOOD_C  ]
    : [TILE_DKWOOD_A, TILE_DKWOOD_B, TILE_DKWOOD_C])[x] ?? TILE_WOOD_A;
}

function tealFloor(c: number, r: number): number {
  const x = c % 3, y = r % 2;
  return (y === 0
    ? [TILE_TEAL_A, TILE_TEAL_B, TILE_TEAL_C]
    : [TILE_TEAL_D, TILE_TEAL_E, TILE_TEAL_F])[x] ?? TILE_TEAL_A;
}

function stoneFloor(c: number, r: number): number {
  const x = c % 3, y = r % 2;
  return (y === 0
    ? [TILE_STONE_A, TILE_STONE_B, TILE_STONE_C]
    : [TILE_STONE_D, TILE_STONE_E, TILE_STONE_F])[x] ?? TILE_STONE_A;
}

// ── Room interior border helper ───────────────────────────────────────────────
// Returns true for the 1-tile perimeter ring inside each zone's floor area.
function isRoomBorder(col: number, row: number): boolean {
  // Top zones (rows _TR1–_TR2 = 1–16)
  if (row >= _TR1 && row <= _TR2) {
    const onTopBot = row === _TR1 || row === _TR2;
    if (col >= 1        && col <= _WC1 - 1)         return onTopBot || col === 1        || col === _WC1 - 1;
    if (col >= _WC1 + 1 && col <= _WC2 - 1)         return onTopBot || col === _WC1 + 1 || col === _WC2 - 1;
    if (col >= _WC2 + 1 && col <= _TILE_COLS - 2)   return onTopBot || col === _WC2 + 1 || col === _TILE_COLS - 2;
  }
  // Bottom zones (rows _BR1–_BR2 = 21–43)
  if (row >= _BR1 && row <= _BR2) {
    const onTopBot = row === _BR1 || row === _BR2;
    if (col >= 1        && col <= _WC1 - 1)         return onTopBot || col === 1        || col === _WC1 - 1;
    if (col >= _WC1 + 1 && col <= _WC2 - 1)         return onTopBot || col === _WC1 + 1 || col === _WC2 - 1;
    if (col >= _WC2 + 1 && col <= _TILE_COLS - 2)   return onTopBot || col === _WC2 + 1 || col === _TILE_COLS - 2;
  }
  return false;
}

// ── Special floor feature bounds (derived from zone/door layout constants) ────
// Lounge centre rug — centred within the Lounge zone (col 1–17, row 21–43)
const _RUG_C1 = 6, _RUG_C2 = 12;   // cols 6–12  (centred on col 9, 7 tiles wide)
const _RUG_R1 = 28, _RUG_R2 = 36;  // rows 28–36 (centred on row 32, 9 tiles tall)
// Meeting carpet — centred under conference table (Meeting zone: col 19–44, row 1–16)
const _CARPET_C1 = 24, _CARPET_C2 = 40;  // cols 24–40 (within _WC1+1 to _WC2-1)
const _CARPET_R1 = 5,  _CARPET_R2 = 12;  // rows 5–12  (centred vertically in top zone)
// Reception mat — OW door-facing strip (_DH_L1/_DH_L2 = cols 7–10, just inside corridor wall)
const _MAT_C1 = _DH_L1, _MAT_C2 = _DH_L2;  // cols 7–10 (aligns with OW corridor doorway)
const _MAT_R1 = 15, _MAT_R2 = 16;           // rows 15–16 (2 tiles before corridor wall at row 17)

// ── Floor tile layer (z = 0) ──────────────────────────────────────────────────
const _floorLayer: TileLayer = {
  sheet:   'room-builder',
  mapCols: _TILE_COLS,
  mapRows: _TILE_ROWS,
  tileW:   16,
  tileH:   16,
  data: Array.from({ length: _TILE_COLS * _TILE_ROWS }, (_, i) => {
    const col = i % _TILE_COLS;
    const row = Math.floor(i / _TILE_COLS);

    // Outer border — skip (world background shows through)
    if (col === 0 || col === _TILE_COLS - 1 || row === 0 || row === _TILE_ROWS - 1) return -1;

    // ── Special floor features (checked before base zone patterns) ──────────

    // Lounge centre rug — warm beige/tan accent on wood floor
    if (col >= _RUG_C1 && col <= _RUG_C2 && row >= _RUG_R1 && row <= _RUG_R2) {
      const onRugEdge = col === _RUG_C1 || col === _RUG_C2 || row === _RUG_R1 || row === _RUG_R2;
      return onRugEdge
        ? ([TILE_TAN_A, TILE_TAN_B, TILE_TAN_C][col % 3] ?? TILE_TAN_A)
        : ([TILE_BEIGE_A, TILE_BEIGE_B, TILE_BEIGE_C][col % 3] ?? TILE_BEIGE_A);
    }

    // Meeting carpet — contrasting beige underlay for conference table area
    if (col >= _CARPET_C1 && col <= _CARPET_C2 && row >= _CARPET_R1 && row <= _CARPET_R2) {
      return ([TILE_BEIGE_A, TILE_BEIGE_B, TILE_BEIGE_C][col % 3] ?? TILE_BEIGE_A);
    }

    // Reception mat — OW entrance strip facing the corridor door
    if (col >= _MAT_C1 && col <= _MAT_C2 && row >= _MAT_R1 && row <= _MAT_R2) {
      return TILE_OFFICE_D;
    }

    // ── Room interior borders — 1-tile perimeter ring (darker shade) ─────────
    if (isRoomBorder(col, row)) {
      if (row <= _WR1) {
        // Top zones
        if (col <= _WC1 - 1) return [TILE_OFFICE_D, TILE_OFFICE_E, TILE_OFFICE_F][col % 3] ?? TILE_OFFICE_D;
        if (col <= _WC2 - 1) return [TILE_TAN_A,    TILE_TAN_B,    TILE_TAN_C   ][col % 3] ?? TILE_TAN_A;
        return                       [TILE_TEAL_D,   TILE_TEAL_E,   TILE_TEAL_F  ][col % 3] ?? TILE_TEAL_D;
      } else {
        // Bottom zones
        if (col <= _WC1 - 1) return [TILE_DKWOOD_A, TILE_DKWOOD_B, TILE_DKWOOD_C][col % 3] ?? TILE_DKWOOD_A;
        if (col <= _WC2 - 1) return [TILE_TAN_A,    TILE_TAN_B,    TILE_TAN_C   ][col % 3] ?? TILE_TAN_A;
        return                       [TILE_STONE_D,  TILE_STONE_E,  TILE_STONE_F ][col % 3] ?? TILE_STONE_D;
      }
    }

    // ── Base floor patterns ───────────────────────────────────────────────────
    // Per-column floor picker for top zones (OW / Meeting / Engineering)
    const topFloor = (c: number, r: number) =>
      c <= _WC1 ? officeFloor(c, r) : c < _WC2 ? tanFloor(c, r) : tealFloor(c, r);

    // Per-column floor picker for bottom zones (Lounge / Product / Design)
    const botFloor = (c: number, r: number) =>
      c <= _WC1 ? woodFloor(c, r) : c < _WC2 ? tanFloor(c, r) : stoneFloor(c, r);

    if (row <= _WR1) return topFloor(col, row);   // rows 1–17 (top zones + top wall)
    if (row < _WR2)  return stoneFloor(col, row); // rows 18–19 (corridor — neutral stone)
    return botFloor(col, row);                     // rows 20–43 (bottom wall + bottom zones)
  }),
  offsetX: 0,
  offsetY: 0,
  z:       0,
  alpha:   0.55,
};

// ── Wall / partition overlay tile layer (z = 1) ───────────────────────────────
const _wallLayer: TileLayer = {
  sheet:   'room-builder',
  mapCols: _TILE_COLS,
  mapRows: _TILE_ROWS,
  tileW:   16,
  tileH:   16,
  data: Array.from({ length: _TILE_COLS * _TILE_ROWS }, (_, i) => {
    const col = i % _TILE_COLS;
    const row = Math.floor(i / _TILE_COLS);

    // ── Outer border walls ────────────────────────────────────────────────────
    if (col === 0 || col === _TILE_COLS - 1 || row === 0 || row === _TILE_ROWS - 1)
      return TILE_WALL;

    // ── Vertical wall at _WC1 (col 18, x = 288) ──────────────────────────────
    if (col === _WC1) {
      if (row >= _TR1 && row <= _TR2)  // top zone segment
        return (row >= _DV_T1 && row <= _DV_T2) ? -1 : TILE_WALL;
      if (row >= _BR1 && row <= _BR2)  // bottom zone segment
        return (row >= _DV_B1 && row <= _DV_B2) ? -1 : TILE_WALL;
    }

    // ── Vertical wall at _WC2 (col 45, x = 720) ──────────────────────────────
    if (col === _WC2) {
      if (row >= _TR1 && row <= _TR2)
        return (row >= _DV_T1 && row <= _DV_T2) ? -1 : TILE_WALL;
      if (row >= _BR1 && row <= _BR2)
        return (row >= _DV_B1 && row <= _DV_B2) ? -1 : TILE_WALL;
    }

    // ── Horizontal wall at _WR1 (row 17, y = 272) ────────────────────────────
    if (row === _WR1) {
      if (col === _WC1 || col === _WC2) return TILE_WALL; // wall-column intersections
      if (col >= 1 && col <= _WC1 - 1)                   // OW section (cols 1-17)
        return (col >= _DH_L1 && col <= _DH_L2) ? -1 : TILE_WALL;
      if (col >= _WC1 + 1 && col <= _WC2 - 1)            // Meeting section (cols 19-44)
        return (col >= _DH_M1 && col <= _DH_M2) ? -1 : TILE_WALL;
      if (col >= _WC2 + 1 && col <= _TILE_COLS - 2)       // Eng section (cols 46-78)
        return (col >= _DH_R1 && col <= _DH_R2) ? -1 : TILE_WALL;
    }

    // ── Horizontal wall at _WR2 (row 20, y = 320) ────────────────────────────
    if (row === _WR2) {
      if (col === _WC1 || col === _WC2) return TILE_WALL;
      if (col >= 1 && col <= _WC1 - 1)
        return (col >= _DH_L1 && col <= _DH_L2) ? -1 : TILE_WALL;
      if (col >= _WC1 + 1 && col <= _WC2 - 1)
        return (col >= _DH_M1 && col <= _DH_M2) ? -1 : TILE_WALL;
      if (col >= _WC2 + 1 && col <= _TILE_COLS - 2)
        return (col >= _DH_R1 && col <= _DH_R2) ? -1 : TILE_WALL;
    }

    return -1;
  }),
  offsetX: 0,
  offsetY: 0,
  z:       1,
  alpha:   1.0,
};

// ── Interiors tile helper ─────────────────────────────────────────────────────
const _iT = (tileId: number) => ({ sheet: 'interiors' as const, tileId });

/**
 * Static fallback map for "Startup Devgrounds".
 *
 * Layout: 6 rooms in a 2-row × 3-column grid separated by a central corridor.
 * All room boundaries are proper wall tiles with 4-tile (64 px) doorway openings.
 *
 * @deprecated Prefer `generateGameMap()` for the procedurally generated version.
 */
export const STATIC_GAME_MAP: GameMap = {
  worldWidth:  WORLD_WIDTH,
  worldHeight: WORLD_HEIGHT,

  // ── Zones (background tint + label) ──────────────────────────────────────
  // Zone pixel bounds match tile grid exactly.
  //   Top zones:    y = 16–272  (rows 1-16,  256 px)
  //   Bottom zones: y = 336–704 (rows 21-43, 368 px)
  //   Left column:  x = 16–288  (cols 1-17,  272 px)
  //   Mid column:   x = 304–720 (cols 19-44, 416 px)
  //   Right column: x = 736–1264 (cols 46-78, 528 px)
  zones: [
    { x:  16, y:  16, w: 272, h: 256, label: 'Open Workspace', color: 'rgba(52,152,219,0.10)'  },
    { x: 304, y:  16, w: 416, h: 256, label: 'Meeting Room',   color: 'rgba(46,204,113,0.10)'  },
    { x: 736, y:  16, w: 528, h: 256, label: 'Engineering',    color: 'rgba(155,89,182,0.10)'  },
    { x:  16, y: 336, w: 272, h: 368, label: 'Lounge',         color: 'rgba(241,196,15,0.10)'  },
    { x: 304, y: 336, w: 416, h: 368, label: 'Product Area',   color: 'rgba(230,126,34,0.10)'  },
    { x: 736, y: 336, w: 528, h: 368, label: 'Design Studio',  color: 'rgba(231,76,60,0.10)'   },
  ],

  // ── Colliders (walls + large furniture) ──────────────────────────────────
  colliders: [],

  // ── Furniture shapes (visual only, no collision) ──────────────────────────
  furniture: [
    // ══════════════════════════════════════════════════════════════════════════
    // OPEN WORKSPACE  (x = 16-288, y = 16-272)
    // ══════════════════════════════════════════════════════════════════════════

    // Desk surfaces — cool blue-gray theme
    ...[35, 108, 180].flatMap(y => [30, 160].map(x => ({
      type: 'rect' as const, x, y, w: 90, h: 40,
      color: '#1c2a3a', tileSprite: _iT(161),
    }))),
    // Monitors on desks
    ...[35, 108, 180].flatMap(y => [30, 160].map(x => ({
      type: 'rect' as const, x: x + 6, y: y + 8, w: 36, h: 26,
      color: '#1a3a6a', tileSprite: _iT(136),
    }))),
    // Reception desk + monitor
    { type: 'rect', x: 170, y: 226, w: 90, h: 34, color: '#1c3a4a', tileSprite: _iT(161), label: '🖥️ Reception' },
    { type: 'rect', x: 183, y: 233, w: 36, h: 26, color: '#1a3a6a', tileSprite: _iT(136) },
    // Whiteboard on west wall
    { type: 'rect', x: 22, y: 205, w: 96, h: 54, color: '#f0f0ff', tileSprite: _iT(648), label: '📋 Board' },
    // Corner plants
    { type: 'rect', x: 22,  y: 22, w: 28, h: 28, color: '#1a6a1a', tileSprite: _iT(16) },
    { type: 'rect', x: 240, y: 22, w: 22, h: 22, color: '#1a5a1a', tileSprite: _iT(1)  },

    // ══════════════════════════════════════════════════════════════════════════
    // MEETING ROOM  (x = 304-720, y = 16-272)
    // ══════════════════════════════════════════════════════════════════════════

    // Conference table
    { type: 'rect', x: 382, y: 80, w: 260, h: 136, color: '#1a3a50', tileSprite: _iT(161), label: '📋 Meeting' },
    // North chairs (y ≈ 72)
    { type: 'circle', x: 418, y: 72, r: 10, color: '#1e3a50' },
    { type: 'circle', x: 463, y: 72, r: 10, color: '#1e3a50' },
    { type: 'circle', x: 512, y: 72, r: 10, color: '#1e3a50' },
    { type: 'circle', x: 560, y: 72, r: 10, color: '#1e3a50' },
    { type: 'circle', x: 607, y: 72, r: 10, color: '#1e3a50' },
    // South chairs
    { type: 'circle', x: 418, y: 222, r: 10, color: '#1e3a50' },
    { type: 'circle', x: 463, y: 222, r: 10, color: '#1e3a50' },
    { type: 'circle', x: 512, y: 222, r: 10, color: '#1e3a50' },
    { type: 'circle', x: 560, y: 222, r: 10, color: '#1e3a50' },
    { type: 'circle', x: 607, y: 222, r: 10, color: '#1e3a50' },
    // West chairs
    { type: 'circle', x: 374, y: 114, r: 10, color: '#1e3a50' },
    { type: 'circle', x: 374, y: 148, r: 10, color: '#1e3a50' },
    // East chairs
    { type: 'circle', x: 650, y: 114, r: 10, color: '#1e3a50' },
    { type: 'circle', x: 650, y: 148, r: 10, color: '#1e3a50' },
    // Projector screen (north wall)
    { type: 'rect', x: 443, y: 22, w: 176, h: 40, color: '#0a0a1a', tileSprite: _iT(152), label: '📺 Projector' },
    // Whiteboards on side walls
    { type: 'rect', x: 312, y: 28, w: 54, h: 52, color: '#f0f0ff', tileSprite: _iT(648) },
    { type: 'rect', x: 676, y: 28, w: 36, h: 52, color: '#f0f0ff', tileSprite: _iT(648) },
    // Corner plants
    { type: 'rect', x: 308, y: 240, w: 22, h: 22, color: '#1a5a1a', tileSprite: _iT(1) },
    { type: 'rect', x: 690, y: 240, w: 22, h: 22, color: '#1a5a1a', tileSprite: _iT(1) },

    // ══════════════════════════════════════════════════════════════════════════
    // ENGINEERING  (x = 736-1264, y = 16-272)
    // ══════════════════════════════════════════════════════════════════════════

    // Desk surfaces — dark purple theme
    ...[30, 122].flatMap(y => [752, 852, 952, 1052, 1152].map(x => ({
      type: 'rect' as const, x, y, w: 80, h: 40,
      color: '#1a1030', tileSprite: _iT(128),
    }))),
    // Monitors
    ...[30, 122].flatMap(y => [752, 852, 952, 1052, 1152].map(x => ({
      type: 'rect' as const, x: x + 6, y: y + 8, w: 36, h: 26,
      color: '#2a1a4a', tileSprite: _iT(136),
    }))),
    // Server rack (east wall)
    { type: 'rect', x: 1194, y: 22, w: 56, h: 242, color: '#0a1a2a', tileSprite: _iT(152), label: '⚙️ Servers' },
    // Architecture + sprint whiteboards
    { type: 'rect', x:  742, y: 200, w: 150, h: 56, color: '#f0f0ff', tileSprite: _iT(648), label: '📐 Architecture' },
    { type: 'rect', x:  940, y: 200, w: 150, h: 56, color: '#f0f0ff', tileSprite: _iT(648), label: '📝 Board' },
    // Plants
    { type: 'rect', x: 740,  y: 22,  w: 22, h: 22, color: '#1a5a1a', tileSprite: _iT(1) },
    { type: 'rect', x: 1150, y: 244, w: 22, h: 22, color: '#1a5a1a', tileSprite: _iT(1) },

    // ══════════════════════════════════════════════════════════════════════════
    // LOUNGE  (x = 16-288, y = 336-704)
    // ══════════════════════════════════════════════════════════════════════════

    // Kitchen counter (top of zone)
    { type: 'rect', x: 22, y: 338, w: 252, h: 36, color: '#3a2a10', tileSprite: _iT(161), label: '☕ Kitchen' },
    // Sofas
    { type: 'rect', x: 22, y: 408, w: 106, h: 56, color: '#5a4820', tileSprite: _iT(177), label: '🛋️ Sofa' },
    { type: 'rect', x: 22, y: 528, w: 106, h: 56, color: '#5a4820', tileSprite: _iT(177) },
    // Coffee table between sofas
    { type: 'rect', x: 148, y: 438, w: 82, h: 52, color: '#3a2a08', tileSprite: _iT(161) },
    // TV / wall screen
    { type: 'rect', x: 22, y: 632, w: 120, h: 66, color: '#0a0a1a', tileSprite: _iT(152), label: '📺 TV' },
    // Game table
    { type: 'rect', x: 158, y: 578, w: 90, h: 66, color: '#2a1a40', tileSprite: _iT(176), label: '🏓 Games' },
    // Plants
    { type: 'rect', x: 240, y: 632, w: 28, h: 28, color: '#1a6a1a', tileSprite: _iT(16) },
    { type: 'rect', x:  22, y: 676, w: 22, h: 22, color: '#1a5a1a', tileSprite: _iT(1)  },

    // ══════════════════════════════════════════════════════════════════════════
    // PRODUCT AREA  (x = 304-720, y = 336-704)
    // ══════════════════════════════════════════════════════════════════════════

    // Desk surfaces — warm orange theme
    ...[380, 460].flatMap(y => [318, 440, 562].map(x => ({
      type: 'rect' as const, x, y, w: 80, h: 40,
      color: '#20140a', tileSprite: _iT(161),
    }))),
    // Monitors
    ...[380, 460].flatMap(y => [318, 440, 562].map(x => ({
      type: 'rect' as const, x: x + 6, y: y + 8, w: 36, h: 26,
      color: '#3a2008', tileSprite: _iT(136),
    }))),
    // Kanban / sprint boards (south wall)
    { type: 'rect', x: 314, y: 632, w: 128, h: 52, color: '#f0f0e0', tileSprite: _iT(648), label: '📋 Sprint'  },
    { type: 'rect', x: 462, y: 632, w: 128, h: 52, color: '#f0f0e0', tileSprite: _iT(648), label: '📊 Backlog' },
    { type: 'rect', x: 604, y: 632, w: 102, h: 52, color: '#f0f0e0', tileSprite: _iT(648) },
    // Meeting pod — round table + chairs
    { type: 'circle', x: 580, y: 510, r: 38, color: '#20140a' },
    { type: 'circle', x: 580, y: 465, r: 10, color: '#20140a' },
    { type: 'circle', x: 622, y: 510, r: 10, color: '#20140a' },
    { type: 'circle', x: 580, y: 555, r: 10, color: '#20140a' },
    { type: 'circle', x: 538, y: 510, r: 10, color: '#20140a' },
    // Plants
    { type: 'rect', x: 308, y: 344, w: 22, h: 22, color: '#1a5a1a', tileSprite: _iT(1) },
    { type: 'rect', x: 690, y: 676, w: 22, h: 22, color: '#1a5a1a', tileSprite: _iT(1) },

    // ══════════════════════════════════════════════════════════════════════════
    // DESIGN STUDIO  (x = 736-1264, y = 336-704)
    // ══════════════════════════════════════════════════════════════════════════

    // Desk surfaces — deep red theme
    ...[748, 868, 988, 1108].map(x => ({
      type: 'rect' as const, x, y: 363, w: 80, h: 40,
      color: '#2e0e16', tileSprite: _iT(161),
    })),
    // Monitors
    ...[748, 868, 988, 1108].map(x => ({
      type: 'rect' as const, x: x + 6, y: 371, w: 36, h: 26,
      color: '#4a1a2a', tileSprite: _iT(136),
    })),
    // Large design display wall (east side)
    { type: 'rect', x: 1146, y: 443, w: 100, h: 200, color: '#1a0010', tileSprite: _iT(152), label: '🎨 Design' },
    // Drawing / design boards
    { type: 'rect', x:  742, y: 553, w: 132, h: 72, color: '#f0f0e8', tileSprite: _iT(648), label: '✏️ Sketches' },
    { type: 'rect', x:  898, y: 553, w: 132, h: 72, color: '#f0f0e8', tileSprite: _iT(648), label: '🖌️ Design'   },
    { type: 'rect', x: 1058, y: 553, w: 120, h: 72, color: '#f0f0e8', tileSprite: _iT(648) },
    // Plants
    { type: 'rect', x:  738, y: 676, w: 28, h: 28, color: '#1a6a1a', tileSprite: _iT(16) },
    { type: 'rect', x: 1232, y: 352, w: 22, h: 22, color: '#1a5a1a', tileSprite: _iT(1)  },

    // ══════════════════════════════════════════════════════════════════════════
    // CORRIDOR  (y = 288-320)
    // ══════════════════════════════════════════════════════════════════════════

    // Water cooler near left wall
    { type: 'rect', x: 248, y: 294, w: 24, h: 24, color: '#2a3a4a', tileSprite: _iT(161) },
    // Small plants at key corridor points
    { type: 'rect', x: 620, y: 296, w: 20, h: 20, color: '#1a5a1a', tileSprite: _iT(1) },
    { type: 'rect', x:1234, y: 292, w: 22, h: 22, color: '#1a5a1a', tileSprite: _iT(1) },
  ],

  tiles: [_floorLayer, _wallLayer],

  spawnPoint: { x: WORLD_WIDTH / 2, y: WORLD_HEIGHT / 2 },

  interactiveObjects: [
    { x:  100, y: 375, r: 40, label: '☕ Grab a coffee'          },
    { x:  515, y: 128, r: 65, label: '📋 Join the meeting'       },
    { x:  855, y: 208, r: 55, label: '📐 View architecture'      },
    { x:   65, y: 535, r: 55, label: '🛋️ Take a break'           },
    { x:  490, y: 490, r: 50, label: '💻 Product backlog'        },
    { x:  960, y: 548, r: 50, label: '🎨 Design review'          },
    { x: 1100, y:  85, r: 50, label: '⚙️ Engineering standup'    },
    { x:  205, y: 618, r: 45, label: '🏓 Game room'              },
    { x:  222, y: 248, r: 40, label: '🖥️ Reception'              },
  ],
};

/**
 * Generate a procedural GameMap.
 * @param seed - Optional deterministic seed. The same seed always produces
 *               the same map layout. If omitted, seed 0 is used.
 */
export function generateGameMap(seed?: number): GameMap {
  return generateMap(seed ?? 0);
}

/**
 * The active game map — procedurally generated with a fixed seed so the
 * default layout is stable. Existing imports of `GAME_MAP` continue to work
 * without changes.
 *
 * To obtain a static fallback use `STATIC_GAME_MAP`.
 */
export const GAME_MAP: GameMap = generateGameMap(0);
