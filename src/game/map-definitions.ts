/**
 * src/game/map-definitions.ts — Declarative map configuration system.
 *
 * Each MapDefinition describes a map at a high level.
 * Pass it to `loadMap()` in map-loader.ts to obtain a runnable `GameMap`.
 *
 * Adding a new map is as simple as pushing another object onto MAP_DEFINITIONS.
 */

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
  /** Room template for the single big central room. */
  room: Pick<RoomTemplate, 'name' | 'floorTheme' | 'zoneColor'>;
}

// ── Preset map definitions ────────────────────────────────────────────────────

/** Startup HQ — the default map. */
const STARTUP_HQ: MapDefinition = {
  id:   'startup-hq',
  name: 'Startup HQ',
  seed: 0,
  room: {
    name:       'Main Hall',
    floorTheme: 'office',
    zoneColor:  'rgba(52,152,219,0.05)',
  },
};

/** Coworking Space — warm beige tones. */
const COWORKING_SPACE: MapDefinition = {
  id:   'coworking-space',
  name: 'Coworking Space',
  seed: 42,
  room: {
    name:       'Open Floor',
    floorTheme: 'beige',
    zoneColor:  'rgba(243,156,18,0.05)',
  },
};

/** Game Studio — dark teal atmosphere. */
const GAME_STUDIO: MapDefinition = {
  id:   'game-studio',
  name: 'Game Studio',
  seed: 99,
  room: {
    name:       'Studio Floor',
    floorTheme: 'teal',
    zoneColor:  'rgba(26,188,156,0.05)',
  },
};

// ── Registry ──────────────────────────────────────────────────────────────────

/**
 * All available map definitions.
 * Add new maps here to make them available to `listMaps()` and `getMapDefinition()`.
 */
export const MAP_DEFINITIONS: MapDefinition[] = [
  STARTUP_HQ,
  COWORKING_SPACE,
  GAME_STUDIO,
];
