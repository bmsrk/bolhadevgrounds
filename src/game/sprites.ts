/**
 * src/game/sprites.ts — SVG sprite pre-loading cache.
 *
 * Sprites are served from public/sprites/<name>.svg and keyed by name.
 * Call `preloadSprites` once at startup; then `getSprite` returns the
 * decoded HTMLImageElement for use with ctx.drawImage(), or undefined
 * while the image is still loading (callers should fall back to plain shapes).
 */

/// <reference types="vite/client" />

const BASE = import.meta.env.BASE_URL as string;

const _cache = new Map<string, HTMLImageElement>();

/** Begin loading a sprite by name (idempotent – safe to call multiple times). */
function _load(name: string): void {
  if (_cache.has(name)) return;
  const img = new Image();
  img.src = `${BASE}sprites/${name}.svg`;
  _cache.set(name, img);
}

/**
 * Return the decoded image for `name`, or `undefined` if the image has not
 * finished loading yet.  Callers should render a fallback shape when undefined.
 */
export function getSprite(name: string): HTMLImageElement | undefined {
  const img = _cache.get(name);
  if (img && img.complete && img.naturalWidth > 0) return img;
  return undefined;
}

/** Pre-load a list of sprites.  Call once at application startup. */
export function preloadSprites(names: readonly string[]): void {
  for (const name of names) {
    _load(name);
  }
}
