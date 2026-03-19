/**
 * src/game/sprites.ts — SVG sprite cache + PNG spritesheet loader.
 *
 * SVG sprites : served from public/sprites/<key>.svg; use preloadSprites / getSprite.
 * PNG sheets  : served from any BASE-relative path; use loadSheet / drawSheetFrame.
 *
 * Call the preload helpers once at startup, then use the draw helpers each frame.
 * All loaders are idempotent and return gracefully while the image is still loading.
 */

/// <reference types="vite/client" />

const BASE = import.meta.env.BASE_URL as string;

/** Vite BASE_URL for building asset paths (re-exported for other modules). */
export const ASSET_BASE: string = BASE;

// ── SVG sprite cache ──────────────────────────────────────────────────────────

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

/** Pre-load a list of SVG sprites.  Call once at application startup. */
export function preloadSprites(names: readonly string[]): void {
  for (const name of names) {
    _load(name);
  }
}

// ── PNG spritesheet cache ─────────────────────────────────────────────────────

interface SheetEntry {
  img:    HTMLImageElement;
  frameW: number;
  frameH: number;
}

const _sheets = new Map<string, SheetEntry>();

/**
 * Pre-load a PNG spritesheet.
 * @param name   - Lookup key used by drawSheetFrame / sheetReady
 * @param path   - Path relative to the Vite BASE URL
 * @param frameW - Width  of one source frame in pixels
 * @param frameH - Height of one source frame in pixels
 */
export function loadSheet(
  name:   string,
  path:   string,
  frameW: number,
  frameH: number,
): void {
  if (_sheets.has(name)) return;
  const img = new Image();
  img.src = `${BASE}${path}`;
  _sheets.set(name, { img, frameW, frameH });
}

/** Return true if the sheet is loaded and ready to draw. */
export function sheetReady(name: string): boolean {
  return _getSheet(name) !== undefined;
}

/**
 * Draw one frame from a loaded PNG spritesheet.
 *
 * @param ctx  - Canvas 2D context
 * @param name - Sheet key as passed to loadSheet
 * @param srcX - X pixel offset inside the sheet (source pixels)
 * @param srcY - Y pixel offset inside the sheet (source pixels)
 * @param dx   - Destination X on canvas
 * @param dy   - Destination Y on canvas
 * @param dw   - Destination width  (scales the frame to this size)
 * @param dh   - Destination height (scales the frame to this size)
 *
 * @returns true if the frame was drawn; false if the sheet isn't ready yet.
 */
export function drawSheetFrame(
  ctx:  CanvasRenderingContext2D,
  name: string,
  srcX: number,
  srcY: number,
  dx:   number,
  dy:   number,
  dw:   number,
  dh:   number,
): boolean {
  const s = _getSheet(name);
  if (!s) return false;
  ctx.drawImage(s.img, srcX, srcY, s.frameW, s.frameH, dx, dy, dw, dh);
  return true;
}

// ── Internal ──────────────────────────────────────────────────────────────────

function _getSheet(name: string): SheetEntry | undefined {
  const s = _sheets.get(name);
  if (!s || !s.img.complete || s.img.naturalWidth === 0) return undefined;
  return s;
}
