/**
 * src/game/map-loader.ts — Runtime map switching and caching.
 *
 * Wraps `generateMap()` from room-generator.ts with:
 *  - A definition registry (all MapDefinition objects from map-definitions.ts)
 *  - A simple in-memory cache keyed by map id
 *  - Helpers for listing and looking up definitions
 *
 * Usage:
 *   import { loadMap, getMapDefinition, listMaps } from './map-loader.js';
 *   import { MAP_DEFINITIONS } from './map-definitions.js';
 *
 *   const def  = getMapDefinition('startup-hq')!;
 *   const map  = loadMap(def);  // cached after first call
 *   const all  = listMaps();
 */

import type { GameMap } from '../types.js';
import type { MapDefinition } from './map-definitions.js';
import { MAP_DEFINITIONS } from './map-definitions.js';
import { generateMap } from './room-generator.js';

// ── In-memory cache ───────────────────────────────────────────────────────────

const _cache = new Map<string, GameMap>();

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Generate (or retrieve from cache) a `GameMap` for the given definition.
 *
 * The same definition `id` always returns the same cached instance — this
 * means the network-deterministic guarantee holds: every peer that calls
 * `loadMap()` with the same `MapDefinition` gets an identical `GameMap`.
 *
 * To force regeneration (e.g. after a hot-reload in dev mode) call
 * `clearMapCache(def.id)` first.
 */
export function loadMap(def: MapDefinition): GameMap {
  const cached = _cache.get(def.id);
  if (cached) return cached;

  const map = generateMap(def.seed, def.rooms);
  _cache.set(def.id, map);
  return map;
}

/**
 * Evict a specific map from the cache.
 * The next `loadMap()` call for that id will regenerate the map.
 */
export function clearMapCache(id: string): void {
  _cache.delete(id);
}

/**
 * Evict all maps from the cache.
 */
export function clearAllMapCaches(): void {
  _cache.clear();
}

/**
 * Look up a `MapDefinition` by its unique `id`.
 * Returns `undefined` if no definition with that id exists.
 */
export function getMapDefinition(id: string): MapDefinition | undefined {
  return MAP_DEFINITIONS.find(d => d.id === id);
}

/**
 * Return all available `MapDefinition` objects.
 */
export function listMaps(): MapDefinition[] {
  return [...MAP_DEFINITIONS];
}
