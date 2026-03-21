/**
 * src/game/map-definitions.ts — Declarative map configuration system.
 *
 * Each MapDefinition describes a complete map layout at a high level.
 * Pass it to `loadMap()` in map-loader.ts to obtain a runnable `GameMap`.
 *
 * Adding a new map is as simple as pushing another object onto MAP_DEFINITIONS.
 */

import type { FloorTheme } from './tile-registry.js';
import type { RoomTemplate } from './room-generator.js';

// ── MapDefinition interface ───────────────────────────────────────────────────

export interface MapDefinition {
  /** Unique identifier used for caching and lookup. */
  id: string;
  /** Human-readable display name. */
  name: string;
  /**
   * Deterministic seed for the room-generator RNG.
   * The same seed always produces the same layout.
   */
  seed: number;
  /** Number of room columns in the grid (currently always 3). */
  gridCols: number;
  /** Number of room rows in the grid (currently always 2). */
  gridRows: number;
  /**
   * One RoomTemplate per grid cell, ordered left-to-right then top-to-bottom.
   * (i.e. [row0col0, row0col1, row0col2, row1col0, row1col1, row1col2])
   */
  rooms: RoomTemplate[];
  /** Corridor configuration. */
  corridor: {
    /** Height of the central corridor in tiles (default: 2). */
    height: number;
    /** Floor theme for the corridor. */
    floorTheme: FloorTheme;
  };
}

// ── Preset map definitions ────────────────────────────────────────────────────

/**
 * Startup HQ — the default map.
 * Uses the existing DEFAULT_TEMPLATES from room-generator.ts.
 */
const STARTUP_HQ: MapDefinition = {
  id:       'startup-hq',
  name:     'Startup HQ',
  seed:     0,
  gridCols: 3,
  gridRows: 2,
  corridor: { height: 2, floorTheme: 'stone' },
  rooms: [
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
  ],
};

/**
 * Coworking Space — more open areas focused on lounges and collaboration.
 * Two big open workspaces, a large meeting room, and a reception lounge.
 */
const COWORKING_SPACE: MapDefinition = {
  id:       'coworking-space',
  name:     'Coworking Space',
  seed:     42,
  gridCols: 3,
  gridRows: 2,
  corridor: { height: 2, floorTheme: 'stone' },
  rooms: [
    {
      name: 'Hot Desks',
      purpose: 'office',
      floorTheme: 'beige',
      minWidth: 18, maxWidth: 22,
      minHeight: 14, maxHeight: 18,
      doorEdges: ['south', 'east'],
      zoneColor: 'rgba(52,73,94,0.05)',
      furnitureDensity: 0.8,
    },
    {
      name: 'Conference Hall',
      purpose: 'meeting',
      floorTheme: 'tan',
      minWidth: 24, maxWidth: 30,
      minHeight: 14, maxHeight: 20,
      doorEdges: ['south', 'east', 'west'],
      zoneColor: 'rgba(39,174,96,0.05)',
      furnitureDensity: 0.5,
    },
    {
      name: 'Private Offices',
      purpose: 'office',
      floorTheme: 'office',
      minWidth: 26, maxWidth: 32,
      minHeight: 14, maxHeight: 18,
      doorEdges: ['south', 'west'],
      zoneColor: 'rgba(41,128,185,0.05)',
      furnitureDensity: 0.65,
    },
    {
      name: 'Reception Lounge',
      purpose: 'lounge',
      floorTheme: 'wood',
      minWidth: 18, maxWidth: 22,
      minHeight: 22, maxHeight: 28,
      doorEdges: ['north', 'east'],
      zoneColor: 'rgba(243,156,18,0.05)',
      furnitureDensity: 0.55,
    },
    {
      name: 'Community Kitchen',
      purpose: 'lounge',
      floorTheme: 'tan',
      minWidth: 24, maxWidth: 30,
      minHeight: 22, maxHeight: 28,
      doorEdges: ['north', 'east', 'west'],
      zoneColor: 'rgba(211,84,0,0.05)',
      furnitureDensity: 0.6,
    },
    {
      name: 'Focus Zone',
      purpose: 'office',
      floorTheme: 'dark-teal',
      minWidth: 26, maxWidth: 32,
      minHeight: 22, maxHeight: 28,
      doorEdges: ['north', 'west'],
      zoneColor: 'rgba(142,68,173,0.05)',
      furnitureDensity: 0.7,
    },
  ],
};

/**
 * Game Studio — engineering-heavy layout with a design studio.
 * Dense engineering desks, large design display wall, product sprint boards.
 */
const GAME_STUDIO: MapDefinition = {
  id:       'game-studio',
  name:     'Game Studio',
  seed:     99,
  gridCols: 3,
  gridRows: 2,
  corridor: { height: 2, floorTheme: 'dark-stone' },
  rooms: [
    {
      name: 'Engine Team',
      purpose: 'engineering',
      floorTheme: 'teal',
      minWidth: 20, maxWidth: 24,
      minHeight: 14, maxHeight: 18,
      doorEdges: ['south', 'east'],
      zoneColor: 'rgba(26,188,156,0.05)',
      furnitureDensity: 0.8,
    },
    {
      name: 'Sprint Room',
      purpose: 'meeting',
      floorTheme: 'dark-teal',
      minWidth: 22, maxWidth: 26,
      minHeight: 14, maxHeight: 18,
      doorEdges: ['south', 'east', 'west'],
      zoneColor: 'rgba(52,152,219,0.05)',
      furnitureDensity: 0.55,
    },
    {
      name: 'Tech Operations',
      purpose: 'engineering',
      floorTheme: 'stone',
      minWidth: 28, maxWidth: 34,
      minHeight: 14, maxHeight: 18,
      doorEdges: ['south', 'west'],
      zoneColor: 'rgba(155,89,182,0.05)',
      furnitureDensity: 0.75,
    },
    {
      name: 'Game Art Studio',
      purpose: 'design',
      floorTheme: 'dark-wood',
      minWidth: 20, maxWidth: 24,
      minHeight: 22, maxHeight: 28,
      doorEdges: ['north', 'east'],
      zoneColor: 'rgba(231,76,60,0.05)',
      furnitureDensity: 0.65,
    },
    {
      name: 'Product & Backlog',
      purpose: 'product',
      floorTheme: 'beige',
      minWidth: 22, maxWidth: 26,
      minHeight: 22, maxHeight: 28,
      doorEdges: ['north', 'east', 'west'],
      zoneColor: 'rgba(230,126,34,0.05)',
      furnitureDensity: 0.6,
    },
    {
      name: 'Break Room',
      purpose: 'lounge',
      floorTheme: 'wood',
      minWidth: 28, maxWidth: 34,
      minHeight: 22, maxHeight: 28,
      doorEdges: ['north', 'west'],
      zoneColor: 'rgba(241,196,15,0.05)',
      furnitureDensity: 0.5,
    },
  ],
};

// ── Registry ──────────────────────────────────────────────────────────────────

/**
 * All available map definitions, ordered by id.
 * Add new maps here to make them available to `listMaps()` and `getMapDefinition()`.
 */
export const MAP_DEFINITIONS: MapDefinition[] = [
  STARTUP_HQ,
  COWORKING_SPACE,
  GAME_STUDIO,
];
