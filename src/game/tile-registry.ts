/**
 * src/game/tile-registry.ts — Tile asset registry for procedural generation.
 *
 * Maps every semantically relevant tile in the two tile sheets to a structured
 * entry so the room generator knows what's a floor, a wall corner, a door, etc.
 *
 * Tile ID formula (row-major, 0-based):
 *   tileId = sheetRow * sheetCols + sheetCol
 *
 * Sheets:
 *   room-builder  — Room_Builder_free_16x16.png  : 17 cols × 21 rows
 *   interiors     — Interiors_free_16x16.png     : 16 cols × 89 rows
 */

// ── Category types ────────────────────────────────────────────────────────────

/** High-level tile role categories */
export type TileCategory =
  | 'floor'
  | 'wall'
  | 'wall-top'        // top edge of a wall (north face)
  | 'wall-bottom'     // bottom edge (south face)
  | 'wall-left'       // left edge (west face)
  | 'wall-right'      // right edge (east face)
  | 'wall-corner-tl'  // top-left corner
  | 'wall-corner-tr'  // top-right corner
  | 'wall-corner-bl'  // bottom-left corner
  | 'wall-corner-br'  // bottom-right corner
  | 'wall-inner-tl'   // inner corner top-left (concave)
  | 'wall-inner-tr'   // inner corner top-right
  | 'wall-inner-bl'   // inner corner bottom-left
  | 'wall-inner-br'   // inner corner bottom-right
  | 'door-horizontal' // horizontal doorway tile
  | 'door-vertical'   // vertical doorway tile
  | 'furniture'       // generic furniture
  | 'decoration'      // plants, rugs, wall art
  | 'empty';          // nothing / transparent

/** Visual floor theme grouping */
export type FloorTheme =
  | 'office'
  | 'beige'
  | 'tan'
  | 'wood'
  | 'dark-wood'
  | 'teal'
  | 'dark-teal'
  | 'stone'
  | 'dark-stone';

/** Furniture sub-categories for the interiors sheet */
export type FurnitureType =
  | 'desk'
  | 'chair'
  | 'monitor'
  | 'sofa'
  | 'table'
  | 'bookshelf'
  | 'plant'
  | 'rug'
  | 'kitchen'
  | 'whiteboard'
  | 'tv-screen'
  | 'server-rack'
  | 'lamp'
  | 'other';

// ── Registry entry type ───────────────────────────────────────────────────────

export interface TileRegistryEntry {
  /** The tile sheet this tile belongs to */
  sheet: 'room-builder' | 'interiors';
  /** The numeric tile ID (row-major in the sheet) */
  tileId: number;
  /** Row and column in the sheet for human readability */
  sheetRow: number;
  sheetCol: number;
  /** Semantic category */
  category: TileCategory;
  /** For floor tiles, which visual theme they belong to */
  floorTheme?: FloorTheme;
  /** For furniture/decoration tiles, the sub-type */
  furnitureType?: FurnitureType;
  /** Whether this tile blocks player movement */
  collides: boolean;
  /** Human-readable label for debugging */
  label: string;
  /** Tile span for multi-tile objects (default 1×1) */
  spanCols?: number;
  spanRows?: number;
}

// ── Internal helpers ──────────────────────────────────────────────────────────

const _RB_COLS = 17;  // Room_Builder sheet columns
const _IT_COLS = 16;  // Interiors sheet columns

function rb(row: number, col: number, category: TileCategory, label: string, opts: Partial<TileRegistryEntry> = {}): TileRegistryEntry {
  return {
    sheet: 'room-builder',
    tileId: row * _RB_COLS + col,
    sheetRow: row,
    sheetCol: col,
    category,
    collides: category !== 'floor' && category !== 'empty' && category !== 'decoration',
    label,
    ...opts,
  };
}

function it(row: number, col: number, category: TileCategory, label: string, opts: Partial<TileRegistryEntry> = {}): TileRegistryEntry {
  return {
    sheet: 'interiors',
    tileId: row * _IT_COLS + col,
    sheetRow: row,
    sheetCol: col,
    category,
    collides: category === 'furniture',
    label,
    ...opts,
  };
}

// ── Registry population ───────────────────────────────────────────────────────
//
// Room_Builder_free_16x16.png layout (17 cols × 21 rows):
//   Rows 0–6:   Wall variants (edges, corners, inner corners, door frames)
//   Rows 7–8:   Beige / tan floor
//   Rows 9–10:  Teal floor
//   Rows 11–12: Wood floor
//   Rows 13–16: Additional floor/pattern tiles
//   Rows 17–18: Office blue-gray floor
//   Rows 19–20: Stone floor

const _registry: TileRegistryEntry[] = [

  // ── Room Builder — wall tiles (rows 0–6) ────────────────────────────────────
  // Row 0: top wall / horizontal partitions
  rb(0, 0,  'wall-top',        'Wall top A'),
  rb(0, 1,  'wall-top',        'Wall top B'),
  rb(0, 2,  'wall-top',        'Wall top C'),
  rb(0, 3,  'wall-corner-tl',  'Wall corner top-left'),
  rb(0, 4,  'wall-corner-tr',  'Wall corner top-right'),
  rb(0, 5,  'wall-top',        'Wall top thin'),
  rb(0, 6,  'wall',            'Wall solid A'),
  rb(0, 7,  'wall',            'Wall glass partition', { collides: true }),  // TILE_WALL used in current map
  rb(0, 8,  'wall',            'Wall solid B'),
  rb(0, 9,  'wall-corner-tl',  'Wall corner TL variant'),
  rb(0, 10, 'wall-corner-tr',  'Wall corner TR variant'),
  rb(0, 11, 'door-horizontal', 'Door frame horizontal A', { collides: false }),
  rb(0, 12, 'door-horizontal', 'Door frame horizontal B', { collides: false }),
  rb(0, 13, 'wall-inner-tl',   'Wall inner corner TL'),
  rb(0, 14, 'wall-inner-tr',   'Wall inner corner TR'),
  rb(0, 15, 'wall-top',        'Wall top D'),
  rb(0, 16, 'wall-top',        'Wall top E'),

  // Row 1: bottom wall / horizontal partitions
  rb(1, 0,  'wall-bottom',     'Wall bottom A'),
  rb(1, 1,  'wall-bottom',     'Wall bottom B'),
  rb(1, 2,  'wall-bottom',     'Wall bottom C'),
  rb(1, 3,  'wall-corner-bl',  'Wall corner bottom-left'),
  rb(1, 4,  'wall-corner-br',  'Wall corner bottom-right'),
  rb(1, 5,  'wall-bottom',     'Wall bottom thin'),
  rb(1, 6,  'wall',            'Wall base A'),
  rb(1, 7,  'wall',            'Wall base B'),
  rb(1, 8,  'wall',            'Wall base C'),
  rb(1, 9,  'wall-corner-bl',  'Wall corner BL variant'),
  rb(1, 10, 'wall-corner-br',  'Wall corner BR variant'),
  rb(1, 11, 'door-horizontal', 'Door frame horizontal C', { collides: false }),
  rb(1, 12, 'door-horizontal', 'Door frame horizontal D', { collides: false }),
  rb(1, 13, 'wall-inner-bl',   'Wall inner corner BL'),
  rb(1, 14, 'wall-inner-br',   'Wall inner corner BR'),
  rb(1, 15, 'wall-bottom',     'Wall bottom D'),
  rb(1, 16, 'wall-bottom',     'Wall bottom E'),

  // Row 2: left wall
  rb(2, 0,  'wall-left',       'Wall left A'),
  rb(2, 1,  'wall-left',       'Wall left B'),
  rb(2, 2,  'wall-left',       'Wall left C'),
  rb(2, 3,  'wall-corner-tl',  'Wall corner TL thick'),
  rb(2, 4,  'wall-corner-bl',  'Wall corner BL thick'),
  rb(2, 5,  'wall-left',       'Wall left thin'),
  rb(2, 6,  'wall',            'Wall mid-left A'),
  rb(2, 7,  'wall',            'Wall mid-left B'),
  rb(2, 8,  'wall',            'Wall mid-left C'),
  rb(2, 9,  'wall-inner-tl',   'Wall inner TL variant'),
  rb(2, 10, 'wall-inner-bl',   'Wall inner BL variant'),
  rb(2, 11, 'door-vertical',   'Door frame vertical A', { collides: false }),
  rb(2, 12, 'door-vertical',   'Door frame vertical B', { collides: false }),

  // Row 3: right wall
  rb(3, 0,  'wall-right',      'Wall right A'),
  rb(3, 1,  'wall-right',      'Wall right B'),
  rb(3, 2,  'wall-right',      'Wall right C'),
  rb(3, 3,  'wall-corner-tr',  'Wall corner TR thick'),
  rb(3, 4,  'wall-corner-br',  'Wall corner BR thick'),
  rb(3, 5,  'wall-right',      'Wall right thin'),
  rb(3, 6,  'wall',            'Wall mid-right A'),
  rb(3, 7,  'wall',            'Wall mid-right B'),
  rb(3, 8,  'wall',            'Wall mid-right C'),
  rb(3, 9,  'wall-inner-tr',   'Wall inner TR variant'),
  rb(3, 10, 'wall-inner-br',   'Wall inner BR variant'),
  rb(3, 11, 'door-vertical',   'Door frame vertical C', { collides: false }),
  rb(3, 12, 'door-vertical',   'Door frame vertical D', { collides: false }),

  // Row 4: single-tile wall / partition variants
  rb(4, 0,  'wall',            'Wall single A'),
  rb(4, 1,  'wall',            'Wall single B'),
  rb(4, 2,  'wall',            'Wall single C'),
  rb(4, 3,  'wall-corner-tl',  'Wall corner TL single'),
  rb(4, 4,  'wall-corner-tr',  'Wall corner TR single'),
  rb(4, 5,  'wall-corner-bl',  'Wall corner BL single'),
  rb(4, 6,  'wall-corner-br',  'Wall corner BR single'),
  rb(4, 7,  'wall',            'Wall single D'),
  rb(4, 8,  'wall',            'Wall single E'),
  rb(4, 9,  'wall-inner-tl',   'Wall inner TL single'),
  rb(4, 10, 'wall-inner-tr',   'Wall inner TR single'),
  rb(4, 11, 'wall-inner-bl',   'Wall inner BL single'),
  rb(4, 12, 'wall-inner-br',   'Wall inner BR single'),

  // Row 5: door tiles
  rb(5, 0,  'door-horizontal', 'Door horizontal open A', { collides: false }),
  rb(5, 1,  'door-horizontal', 'Door horizontal open B', { collides: false }),
  rb(5, 2,  'door-horizontal', 'Door horizontal open C', { collides: false }),
  rb(5, 3,  'door-horizontal', 'Door horizontal frame left', { collides: false }),
  rb(5, 4,  'door-horizontal', 'Door horizontal frame right', { collides: false }),
  rb(5, 5,  'door-vertical',   'Door vertical open A', { collides: false }),
  rb(5, 6,  'door-vertical',   'Door vertical open B', { collides: false }),
  rb(5, 7,  'door-vertical',   'Door vertical open C', { collides: false }),
  rb(5, 8,  'door-vertical',   'Door vertical frame top', { collides: false }),
  rb(5, 9,  'door-vertical',   'Door vertical frame bottom', { collides: false }),

  // Row 6: additional wall details / windows
  rb(6, 0,  'wall',            'Wall window A'),
  rb(6, 1,  'wall',            'Wall window B'),
  rb(6, 2,  'wall',            'Wall window C'),
  rb(6, 3,  'wall',            'Wall window D'),
  rb(6, 4,  'wall',            'Wall window E'),
  rb(6, 5,  'wall',            'Wall accent A'),
  rb(6, 6,  'wall',            'Wall accent B'),

  // ── Room Builder — floor tiles ────────────────────────────────────────────

  // Rows 7–8: beige / tan floor (light beige row + dark tan row, 3 variants each)
  rb(7, 0,  'floor', 'Beige floor A', { collides: false, floorTheme: 'beige' }),
  rb(7, 1,  'floor', 'Beige floor B', { collides: false, floorTheme: 'beige' }),
  rb(7, 2,  'floor', 'Beige floor C', { collides: false, floorTheme: 'beige' }),
  rb(8, 0,  'floor', 'Tan floor A',   { collides: false, floorTheme: 'tan'   }),
  rb(8, 1,  'floor', 'Tan floor B',   { collides: false, floorTheme: 'tan'   }),
  rb(8, 2,  'floor', 'Tan floor C',   { collides: false, floorTheme: 'tan'   }),

  // Rows 9–10: teal floor
  rb(9,  0, 'floor', 'Teal floor A',      { collides: false, floorTheme: 'teal'      }),
  rb(9,  1, 'floor', 'Teal floor B',      { collides: false, floorTheme: 'teal'      }),
  rb(9,  2, 'floor', 'Teal floor C',      { collides: false, floorTheme: 'teal'      }),
  rb(10, 0, 'floor', 'Dark teal floor A', { collides: false, floorTheme: 'dark-teal' }),
  rb(10, 1, 'floor', 'Dark teal floor B', { collides: false, floorTheme: 'dark-teal' }),
  rb(10, 2, 'floor', 'Dark teal floor C', { collides: false, floorTheme: 'dark-teal' }),

  // Rows 11–12: wood floor
  rb(11, 0, 'floor', 'Wood floor A',      { collides: false, floorTheme: 'wood'      }),
  rb(11, 1, 'floor', 'Wood floor B',      { collides: false, floorTheme: 'wood'      }),
  rb(11, 2, 'floor', 'Wood floor C',      { collides: false, floorTheme: 'wood'      }),
  rb(12, 0, 'floor', 'Dark wood floor A', { collides: false, floorTheme: 'dark-wood' }),
  rb(12, 1, 'floor', 'Dark wood floor B', { collides: false, floorTheme: 'dark-wood' }),
  rb(12, 2, 'floor', 'Dark wood floor C', { collides: false, floorTheme: 'dark-wood' }),

  // Rows 13–16: additional floor/pattern tiles (mixed / transition)
  rb(13, 0, 'floor', 'Pattern floor A',  { collides: false, floorTheme: 'beige' }),
  rb(13, 1, 'floor', 'Pattern floor B',  { collides: false, floorTheme: 'beige' }),
  rb(13, 2, 'floor', 'Pattern floor C',  { collides: false, floorTheme: 'beige' }),
  rb(14, 0, 'floor', 'Pattern floor D',  { collides: false, floorTheme: 'tan'   }),
  rb(14, 1, 'floor', 'Pattern floor E',  { collides: false, floorTheme: 'tan'   }),
  rb(14, 2, 'floor', 'Pattern floor F',  { collides: false, floorTheme: 'tan'   }),
  rb(15, 0, 'floor', 'Pattern floor G',  { collides: false, floorTheme: 'wood'  }),
  rb(15, 1, 'floor', 'Pattern floor H',  { collides: false, floorTheme: 'wood'  }),
  rb(15, 2, 'floor', 'Pattern floor I',  { collides: false, floorTheme: 'wood'  }),
  rb(16, 0, 'floor', 'Pattern floor J',  { collides: false, floorTheme: 'teal'  }),
  rb(16, 1, 'floor', 'Pattern floor K',  { collides: false, floorTheme: 'teal'  }),
  rb(16, 2, 'floor', 'Pattern floor L',  { collides: false, floorTheme: 'teal'  }),

  // Rows 17–18: office blue-gray floor
  rb(17, 0, 'floor', 'Office floor A',      { collides: false, floorTheme: 'office'    }),
  rb(17, 1, 'floor', 'Office floor B',      { collides: false, floorTheme: 'office'    }),
  rb(17, 2, 'floor', 'Office floor C',      { collides: false, floorTheme: 'office'    }),
  rb(18, 0, 'floor', 'Dark office floor A', { collides: false, floorTheme: 'office'    }),
  rb(18, 1, 'floor', 'Dark office floor B', { collides: false, floorTheme: 'office'    }),
  rb(18, 2, 'floor', 'Dark office floor C', { collides: false, floorTheme: 'office'    }),

  // Rows 19–20: stone floor
  rb(19, 0, 'floor', 'Stone floor A',      { collides: false, floorTheme: 'stone'      }),
  rb(19, 1, 'floor', 'Stone floor B',      { collides: false, floorTheme: 'stone'      }),
  rb(19, 2, 'floor', 'Stone floor C',      { collides: false, floorTheme: 'stone'      }),
  rb(20, 0, 'floor', 'Dark stone floor A', { collides: false, floorTheme: 'dark-stone' }),
  rb(20, 1, 'floor', 'Dark stone floor B', { collides: false, floorTheme: 'dark-stone' }),
  rb(20, 2, 'floor', 'Dark stone floor C', { collides: false, floorTheme: 'dark-stone' }),

  // ── Interiors sheet — furniture & decorations ─────────────────────────────
  //
  // Interiors_free_16x16.png: 16 cols × 89 rows
  // Tile ID = row * 16 + col
  //
  // Row 0: empty / transparent tiles
  it(0, 0, 'empty', 'Empty tile', { collides: false }),

  // Row 0–1: small plants / decorations
  it(0, 1,  'decoration', 'Small plant',    { collides: false, furnitureType: 'plant' }),
  it(1, 0,  'decoration', 'Big plant',      { collides: false, furnitureType: 'plant' }),

  // Row 8–9: desk surfaces (various styles)
  // tileId 128 = row 8, col 0; tileId 161 = row 10, col 1
  it(8,  0,  'furniture', 'Desk (engineering)',   { collides: true, furnitureType: 'desk' }),  // _iT(128)
  it(8,  1,  'furniture', 'Desk surface B',        { collides: true, furnitureType: 'desk' }),
  it(10, 1,  'furniture', 'Desk surface (office)', { collides: true, furnitureType: 'desk' }),  // _iT(161)

  // Row 8: monitor; Row 9: TV/Screen
  // tileId 136 = row 8, col 8; tileId 152 = row 9, col 8
  it(8,  8,  'furniture', 'Monitor',  { collides: false, furnitureType: 'monitor' }),  // _iT(136)
  it(9,  8,  'furniture', 'TV/Screen', { collides: false, furnitureType: 'tv-screen' }),  // _iT(152)

  // Row 10–11: chairs
  it(10, 0, 'furniture', 'Chair A',  { collides: true, furnitureType: 'chair' }),
  it(10, 2, 'furniture', 'Chair B',  { collides: true, furnitureType: 'chair' }),
  it(10, 4, 'furniture', 'Chair C',  { collides: true, furnitureType: 'chair' }),
  it(11, 2, 'furniture', 'Chair D',  { collides: true, furnitureType: 'chair' }),
  it(11, 3, 'furniture', 'Chair E',  { collides: true, furnitureType: 'chair' }),

  // Row 11: game table and sofa
  // tileId 176 = row 11, col 0; tileId 177 = row 11, col 1
  it(11, 0,  'furniture', 'Game table', { collides: true, furnitureType: 'table' }),  // _iT(176)
  it(11, 1,  'furniture', 'Sofa',       { collides: true, furnitureType: 'sofa'  }),  // _iT(177)

  // Row 12–13: bookshelves
  it(12, 0, 'furniture', 'Bookshelf A', { collides: true, furnitureType: 'bookshelf' }),
  it(12, 1, 'furniture', 'Bookshelf B', { collides: true, furnitureType: 'bookshelf' }),
  it(12, 2, 'furniture', 'Bookshelf C', { collides: true, furnitureType: 'bookshelf' }),
  it(13, 0, 'furniture', 'Bookshelf D', { collides: true, furnitureType: 'bookshelf' }),

  // Row 14–15: kitchen items
  it(14, 0, 'furniture', 'Kitchen counter A', { collides: true, furnitureType: 'kitchen' }),
  it(14, 1, 'furniture', 'Kitchen counter B', { collides: true, furnitureType: 'kitchen' }),
  it(14, 2, 'furniture', 'Kitchen sink',      { collides: true, furnitureType: 'kitchen' }),
  it(15, 0, 'furniture', 'Kitchen stove',     { collides: true, furnitureType: 'kitchen' }),
  it(15, 1, 'furniture', 'Kitchen fridge',    { collides: true, furnitureType: 'kitchen' }),

  // Row 40: whiteboard  (_iT(648) = row 40, col 8)
  it(40, 8, 'furniture', 'Whiteboard', { collides: true, furnitureType: 'whiteboard' }),

  // Row 20–21: lamps
  it(20, 0, 'decoration', 'Floor lamp A', { collides: false, furnitureType: 'lamp' }),
  it(20, 1, 'decoration', 'Floor lamp B', { collides: false, furnitureType: 'lamp' }),
  it(21, 0, 'decoration', 'Desk lamp',    { collides: false, furnitureType: 'lamp' }),

  // Row 22–23: rugs
  it(22, 0, 'decoration', 'Rug A',         { collides: false, furnitureType: 'rug' }),
  it(22, 1, 'decoration', 'Rug B',         { collides: false, furnitureType: 'rug' }),
  it(22, 2, 'decoration', 'Rug C',         { collides: false, furnitureType: 'rug' }),
  it(23, 0, 'decoration', 'Rug round',     { collides: false, furnitureType: 'rug' }),

  // Row 30–31: server rack
  it(30, 0, 'furniture', 'Server rack A', { collides: true, furnitureType: 'server-rack' }),
  it(30, 1, 'furniture', 'Server rack B', { collides: true, furnitureType: 'server-rack' }),
  it(31, 0, 'furniture', 'Server rack C', { collides: true, furnitureType: 'server-rack' }),

  // Explicitly catalog the tile IDs already used in the static map:
  // _iT(1)   = row 0, col 1 → already listed as 'Small plant'
  // _iT(16)  = row 1, col 0 → already listed as 'Big plant'
  // _iT(128) = row 8, col 0 → Desk variant (eng) — overriding with correct tileId
  // _iT(136) = row 8, col 8 → Monitor
  // _iT(152) = row 9, col 8 → TV/Screen
  // _iT(161) = row 10, col 1 → Desk surface (office)
  // _iT(176) = row 11, col 0 → Game table
  // _iT(177) = row 11, col 1 → Sofa
  // _iT(648) = row 40, col 8 → Whiteboard
];

// ── Canonical entries for the exact tileIds used in map.ts ───────────────────
// These entries override the approximations above to guarantee lookupTile() works.
const _mapTsOverrides: TileRegistryEntry[] = [
  {
    sheet: 'interiors', tileId: 1,   sheetRow: 0,  sheetCol: 1,
    category: 'decoration', collides: false, label: 'Small plant', furnitureType: 'plant',
  },
  {
    sheet: 'interiors', tileId: 16,  sheetRow: 1,  sheetCol: 0,
    category: 'decoration', collides: false, label: 'Big plant', furnitureType: 'plant',
  },
  {
    sheet: 'interiors', tileId: 128, sheetRow: 8,  sheetCol: 0,
    category: 'furniture', collides: true,  label: 'Desk (engineering)', furnitureType: 'desk',
  },
  {
    sheet: 'interiors', tileId: 136, sheetRow: 8,  sheetCol: 8,
    category: 'furniture', collides: false, label: 'Monitor', furnitureType: 'monitor',
  },
  {
    sheet: 'interiors', tileId: 152, sheetRow: 9,  sheetCol: 8,
    category: 'furniture', collides: false, label: 'TV / Screen', furnitureType: 'tv-screen',
  },
  {
    sheet: 'interiors', tileId: 161, sheetRow: 10, sheetCol: 1,
    category: 'furniture', collides: true,  label: 'Desk surface (office)', furnitureType: 'desk',
  },
  {
    sheet: 'interiors', tileId: 176, sheetRow: 11, sheetCol: 0,
    category: 'furniture', collides: true,  label: 'Game table', furnitureType: 'table',
  },
  {
    sheet: 'interiors', tileId: 177, sheetRow: 11, sheetCol: 1,
    category: 'furniture', collides: true,  label: 'Sofa', furnitureType: 'sofa',
  },
  {
    sheet: 'interiors', tileId: 648, sheetRow: 40, sheetCol: 8,
    category: 'furniture', collides: true,  label: 'Whiteboard', furnitureType: 'whiteboard',
  },
];

// Build final deduplicated registry: overrides win on duplicate (sheet, tileId)
function _buildRegistry(): TileRegistryEntry[] {
  const map = new Map<string, TileRegistryEntry>();
  for (const e of _registry) {
    map.set(`${e.sheet}:${e.tileId}`, e);
  }
  for (const e of _mapTsOverrides) {
    map.set(`${e.sheet}:${e.tileId}`, e);
  }
  return Array.from(map.values());
}

const TILE_REGISTRY: readonly TileRegistryEntry[] = _buildRegistry();

// ── Query helpers ─────────────────────────────────────────────────────────────

/** Get all floor tiles for a given theme */
export function getFloorTiles(theme: FloorTheme): TileRegistryEntry[] {
  return TILE_REGISTRY.filter(e => e.category === 'floor' && e.floorTheme === theme);
}

/** Get a random floor tile for a theme */
export function randomFloorTile(theme: FloorTheme, rng: () => number = Math.random): TileRegistryEntry {
  const tiles = getFloorTiles(theme);
  if (tiles.length === 0) {
    // Fallback: return first floor tile in registry
    const fallback = TILE_REGISTRY.find(e => e.category === 'floor');
    if (!fallback) throw new Error(`No floor tiles found for theme ${theme}`);
    return fallback;
  }
  return tiles[Math.floor(rng() * tiles.length)]!;
}

/** Get wall tiles by edge direction category */
export function getWallTile(category: TileCategory): TileRegistryEntry | undefined {
  return TILE_REGISTRY.find(e => e.category === category && e.sheet === 'room-builder');
}

/** Get furniture tiles by sub-type */
export function getFurnitureTiles(type: FurnitureType): TileRegistryEntry[] {
  return TILE_REGISTRY.filter(e => e.furnitureType === type);
}

/** Get all tiles that collide */
export function getCollidingTiles(): TileRegistryEntry[] {
  return TILE_REGISTRY.filter(e => e.collides);
}

/** Lookup a tile by sheet + id */
export function lookupTile(sheet: string, tileId: number): TileRegistryEntry | undefined {
  return TILE_REGISTRY.find(e => e.sheet === sheet && e.tileId === tileId);
}

export { TILE_REGISTRY };
