import type { GameMap } from '../types.js';
import { WORLD_WIDTH, WORLD_HEIGHT } from '../constants.js';

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
  furniture: [
    // Open workspace monitors
    ...[60, 130, 200].flatMap(y => [
      { type: 'rect' as const, x: 42, y: y + 8, w: 30, h: 22, color: '#1a3a6a' },
      { type: 'rect' as const, x: 162, y: y + 8, w: 30, h: 22, color: '#1a3a6a' },
      { type: 'rect' as const, x: 282, y: y + 8, w: 30, h: 22, color: '#1a3a6a' },
    ]),

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

    // Engineering monitors
    ...[50, 140].flatMap(y =>
      [740, 840, 940, 1040].map(x => ({
        type: 'rect' as const, x: x + 2, y: y + 6, w: 36, h: 26, color: '#2a1a4a',
      }))
    ),

    // Design monitors
    ...[740, 840, 940, 1040].map(x => ({
      type: 'rect' as const, x: x + 2, y: 386, w: 36, h: 26, color: '#4a1a2a',
    })),

    // Lounge sofa detail
    { type: 'rect', x: 42,  y: 382, w: 96, h: 46, color: '#4a3a10', label: 'Sofa' },
    { type: 'rect', x: 42,  y: 502, w: 96, h: 46, color: '#4a3a10' },
    // Coffee table
    { type: 'rect', x: 160, y: 420, w: 60, h: 40, color: '#3a2a08', label: '☕' },

    // Whiteboard (engineering area)
    { type: 'rect', x: 725, y: 260, w: 120, h: 50, color: '#f0f0ff', label: '📝 Board' },

    // Plant dots
    { type: 'circle', x: 390, y: 40,  r: 12, color: '#1a5a1a' },
    { type: 'circle', x: 390, y: 290, r: 12, color: '#1a5a1a' },
    { type: 'circle', x: 1250,y: 40,  r: 12, color: '#1a5a1a' },
    { type: 'circle', x: 1250,y: 690, r: 12, color: '#1a5a1a' },
    { type: 'circle', x: 40,  y: 690, r: 12, color: '#1a5a1a' },
  ],
};
