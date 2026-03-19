import type { GameMap, TileLayer, InteractiveObject } from '../types.js';
import { WORLD_WIDTH, WORLD_HEIGHT } from '../constants.js';

// ── Floor tile layer (Room Builder 16 × 16) ───────────────────────────────────
// World is exactly 1280 × 720 = 80 × 45 tiles at 16 px each.
// Tile IDs are row-major within the sheet: id = sheetRow * sheetCols + sheetCol.
// Tile 0 is the first tile in the top-left corner of Room_Builder_free_16x16.png.
// Adjust the tile IDs below after inspecting the sheet to pick the correct floors.
const _TILE_COLS = 80;   // WORLD_WIDTH  / 16
const _TILE_ROWS = 45;   // WORLD_HEIGHT / 16

const _floorLayer: TileLayer = {
  sheet:   'room-builder',
  mapCols: _TILE_COLS,
  mapRows: _TILE_ROWS,
  tileW:   16,
  tileH:   16,
  data:    Array.from({ length: _TILE_COLS * _TILE_ROWS }, () => 0),
  offsetX: 0,
  offsetY: 0,
  z:       0,
  alpha:   0.45,   // semi-transparent so the dark world bg shows through
};

// ── Interactive proximity objects ─────────────────────────────────────────────
// These are checked each frame in main.ts; a tooltip is shown when the local
// player is within `r` px of the object centre.
export const INTERACTIVE_OBJECTS: readonly InteractiveObject[] = [
  { x: 190, y: 440, r: 45, label: '☕ Grab a coffee' },
  { x: 550, y: 130, r: 65, label: '📋 Join the meeting' },
  { x: 785, y: 285, r: 55, label: '📝 View architecture' },
  { x:  95, y: 570, r: 55, label: '🛋️ Take a break' },
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
    { x: 20,   y: 20,  w: 380, h: 280, label: 'Open Workspace',  color: 'rgba(52,152,219,0.08)' },
    { x: 420,  y: 20,  w: 280, h: 280, label: 'Meeting Room',    color: 'rgba(46,204,113,0.08)' },
    { x: 720,  y: 20,  w: 540, h: 280, label: 'Engineering',     color: 'rgba(155,89,182,0.08)' },
    { x: 20,   y: 320, w: 240, h: 380, label: 'Lounge',          color: 'rgba(241,196,15,0.08)' },
    { x: 280,  y: 320, w: 420, h: 380, label: 'Product Area',    color: 'rgba(230,126,34,0.08)' },
    { x: 720,  y: 320, w: 540, h: 380, label: 'Design Studio',   color: 'rgba(231,76,60,0.08)'  },
  ],

  // ── Colliders (solid walls / obstacles) ────────────────────────────────
  colliders: [
    // Outer walls
    { x: 0,   y: 0,             w: WORLD_WIDTH,  h: 10,  label: 'top'    },
    { x: 0,   y: WORLD_HEIGHT - 10, w: WORLD_WIDTH, h: 10,  label: 'bottom' },
    { x: 0,   y: 0,             w: 10,           h: WORLD_HEIGHT, label: 'left'   },
    { x: WORLD_WIDTH - 10, y: 0, w: 10,          h: WORLD_HEIGHT, label: 'right'  },

    // Meeting room walls
    { x: 418, y: 20,  w: 4,  h: 240, label: 'meet-left'  },
    { x: 698, y: 20,  w: 4,  h: 240, label: 'meet-right' },
    { x: 418, y: 256, w: 284, h: 4,  label: 'meet-bottom' },

    // Conference table
    { x: 460, y: 80,  w: 180, h: 100, label: 'conf-table' },

    // Engineering partition
    { x: 718, y: 20,  w: 4,  h: 240, label: 'eng-left' },

    // Lounge wall
    { x: 278, y: 318, w: 4,  h: 384, label: 'lounge-right' },

    // Large desks – open workspace
    { x: 40,  y: 60,  w: 80, h: 40  },
    { x: 40,  y: 130, w: 80, h: 40  },
    { x: 40,  y: 200, w: 80, h: 40  },
    { x: 160, y: 60,  w: 80, h: 40  },
    { x: 160, y: 130, w: 80, h: 40  },
    { x: 160, y: 200, w: 80, h: 40  },
    { x: 280, y: 60,  w: 80, h: 40  },
    { x: 280, y: 130, w: 80, h: 40  },

    // Engineering desks
    { x: 740, y: 50,  w: 80, h: 40  },
    { x: 840, y: 50,  w: 80, h: 40  },
    { x: 940, y: 50,  w: 80, h: 40  },
    { x: 1040,y: 50,  w: 80, h: 40  },
    { x: 740, y: 140, w: 80, h: 40  },
    { x: 840, y: 140, w: 80, h: 40  },
    { x: 940, y: 140, w: 80, h: 40  },
    { x: 1040,y: 140, w: 80, h: 40  },

    // Design desks
    { x: 740, y: 380, w: 80, h: 40  },
    { x: 840, y: 380, w: 80, h: 40  },
    { x: 940, y: 380, w: 80, h: 40  },
    { x: 1040,y: 380, w: 80, h: 40  },

    // Product desks
    { x: 300, y: 380, w: 80, h: 40  },
    { x: 420, y: 380, w: 80, h: 40  },
    { x: 540, y: 380, w: 80, h: 40  },

    // Lounge sofa
    { x: 40,  y: 380, w: 100, h: 50 },
    { x: 40,  y: 500, w: 100, h: 50 },
  ],

  // ── Furniture shapes (visual only, no collision) ────────────────────────
  // Pixel-art tile IDs reference Interiors_free_16x16.png (16 cols × 89 rows).
  // id = sheetRow * 16 + sheetCol.  Tile 136 = dark monitor screen (row 8 col 8).
  // Tile 152 = darker filled screen (row 9 col 8).  Tile 648 = light panel (row 40 col 8).
  furniture: [
    // Open workspace monitors – pixel-art screen tile on each desk
    ...[60, 130, 200].flatMap(y =>
      [42, 162, 282].map(x => ({
        type: 'rect' as const, x, y: y + 8, w: 30, h: 22, color: '#1a3a6a',
        tileSprite: { sheet: 'interiors', tileId: 136 },
      }))
    ),

    // Conference table top
    { type: 'rect', x: 462, y: 82, w: 176, h: 96, color: '#2a5070', label: '📋 Meeting' },

    // Conference chairs (circles)
    { type: 'circle', x: 480, y: 76,  r: 10, color: '#1e3a50' },
    { type: 'circle', x: 520, y: 76,  r: 10, color: '#1e3a50' },
    { type: 'circle', x: 560, y: 76,  r: 10, color: '#1e3a50' },
    { type: 'circle', x: 600, y: 76,  r: 10, color: '#1e3a50' },
    { type: 'circle', x: 480, y: 184, r: 10, color: '#1e3a50' },
    { type: 'circle', x: 520, y: 184, r: 10, color: '#1e3a50' },
    { type: 'circle', x: 560, y: 184, r: 10, color: '#1e3a50' },
    { type: 'circle', x: 600, y: 184, r: 10, color: '#1e3a50' },
    { type: 'circle', x: 454, y: 110, r: 10, color: '#1e3a50' },
    { type: 'circle', x: 454, y: 140, r: 10, color: '#1e3a50' },
    { type: 'circle', x: 648, y: 110, r: 10, color: '#1e3a50' },
    { type: 'circle', x: 648, y: 140, r: 10, color: '#1e3a50' },

    // Engineering monitors – pixel-art screen tile (purple desk theme)
    ...[50, 140].flatMap(y =>
      [740, 840, 940, 1040].map(x => ({
        type: 'rect' as const, x: x + 2, y: y + 6, w: 36, h: 26, color: '#2a1a4a',
        tileSprite: { sheet: 'interiors', tileId: 136 },
      }))
    ),

    // Design monitors – pixel-art screen tile (red desk theme)
    ...[740, 840, 940, 1040].map(x => ({
      type: 'rect' as const, x: x + 2, y: 386, w: 36, h: 26, color: '#4a1a2a',
      tileSprite: { sheet: 'interiors', tileId: 136 },
    })),

    // Product area monitors – pixel-art screen tile (orange desk theme)
    ...[300, 420, 540].map(x => ({
      type: 'rect' as const, x: x + 2, y: 386, w: 36, h: 26, color: '#3a2008',
      tileSprite: { sheet: 'interiors', tileId: 136 },
    })),

    // Lounge sofa detail
    { type: 'rect', x: 42,  y: 382, w: 96, h: 46, color: '#4a3a10', label: 'Sofa' },
    { type: 'rect', x: 42,  y: 502, w: 96, h: 46, color: '#4a3a10' },
    // Coffee table
    { type: 'rect', x: 160, y: 420, w: 60, h: 40, color: '#3a2a08', label: '☕' },

    // Whiteboard (engineering area) – pixel-art light panel tile
    { type: 'rect', x: 725, y: 260, w: 120, h: 50, color: '#f0f0ff', label: '📝 Board',
      tileSprite: { sheet: 'interiors', tileId: 648 } },

    // Lounge wall screen (video call) – pixel-art filled-screen tile
    { type: 'rect', x: 55, y: 592, w: 90, h: 55, color: '#0a0a1a',
      tileSprite: { sheet: 'interiors', tileId: 152 } },

    // Plant dots
    { type: 'circle', x: 390, y: 40,  r: 12, color: '#1a5a1a' },
    { type: 'circle', x: 390, y: 290, r: 12, color: '#1a5a1a' },
    { type: 'circle', x: 1250,y: 40,  r: 12, color: '#1a5a1a' },
    { type: 'circle', x: 1250,y: 690, r: 12, color: '#1a5a1a' },
    { type: 'circle', x: 40,  y: 690, r: 12, color: '#1a5a1a' },
  ],

  tiles: [_floorLayer],
};
