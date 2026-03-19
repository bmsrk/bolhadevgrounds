/**
 * src/game/tilemap.ts — PNG tile-sheet loader and tile-layer renderer.
 *
 * Tile IDs are row-major within the sheet:
 *   id = sheetRow * sheetCols + sheetCol   (0-based)
 * A tile ID of –1 is skipped (nothing is drawn for that cell).
 *
 * Typical usage
 * ─────────────
 *   // At startup:
 *   loadTileSheet('room-builder',
 *     'pixelart/Modern tiles_Free/Interiors_free/16x16/Room_Builder_free_16x16.png',
 *     16, 16);
 *
 *   // Inside the render pass (after ctx.save() + ctx.translate(offX, offY)):
 *   for (const layer of map.tiles) drawTileLayer(ctx, layer);
 */

import type { TileLayer } from '../types.js';
import { ASSET_BASE } from './sprites.js';

const BASE = ASSET_BASE;

interface TileSheetEntry {
  img:       HTMLImageElement;
  tileW:     number;
  tileH:     number;
  sheetCols: number;   // derived once the image finishes loading
}

const _sheets = new Map<string, TileSheetEntry>();

// ── Public API ────────────────────────────────────────────────────────────────

/** Pre-load a PNG tile sheet by name.  Idempotent – safe to call multiple times. */
export function loadTileSheet(
  name:  string,
  path:  string,
  tileW: number,
  tileH: number,
): void {
  if (_sheets.has(name)) return;
  const img   = new Image();
  const entry: TileSheetEntry = { img, tileW, tileH, sheetCols: 0 };
  img.onload = () => {
    entry.sheetCols = Math.floor(img.naturalWidth / tileW);
  };
  img.src = `${BASE}${path}`;
  _sheets.set(name, entry);
}

/**
 * Draw a single tile from a loaded tile sheet at the given destination rect.
 *
 * @param ctx    - Canvas 2D context
 * @param sheet  - Sheet key as passed to loadTileSheet
 * @param tileId - Row-major tile ID: `sheetRow * sheetCols + sheetCol` (0-based)
 * @param dx     - Destination X on canvas
 * @param dy     - Destination Y on canvas
 * @param dw     - Destination width  (scales the tile to this size)
 * @param dh     - Destination height (scales the tile to this size)
 *
 * @returns true if drawn; false if the sheet isn't ready yet.
 */
export function drawTile(
  ctx:    CanvasRenderingContext2D,
  sheet:  string,
  tileId: number,
  dx:     number,
  dy:     number,
  dw:     number,
  dh:     number,
): boolean {
  const s = _getSheet(sheet);
  if (!s) return false;
  const srcCol = tileId % s.sheetCols;
  const srcRow = Math.floor(tileId / s.sheetCols);
  ctx.drawImage(
    s.img,
    srcCol * s.tileW, srcRow * s.tileH, s.tileW, s.tileH,
    dx, dy, dw, dh,
  );
  return true;
}

/**
 * Draw one tile layer.
 * Must be called inside a `ctx.save()` / `ctx.restore()` block that already
 * has the world-space translate applied.
 */
export function drawTileLayer(ctx: CanvasRenderingContext2D, layer: TileLayer): void {
  const sheet = _getSheet(layer.sheet);
  if (!sheet) return;   // still loading – skip silently

  const { img, tileW: srcW, tileH: srcH, sheetCols } = sheet;

  const prevAlpha = ctx.globalAlpha;
  if (layer.alpha !== undefined) ctx.globalAlpha *= layer.alpha;

  for (let row = 0; row < layer.mapRows; row++) {
    for (let col = 0; col < layer.mapCols; col++) {
      const id = layer.data[row * layer.mapCols + col] ?? -1;
      if (id < 0) continue;

      const srcRow = Math.floor(id / sheetCols);
      const srcCol = id % sheetCols;

      ctx.drawImage(
        img,
        srcCol * srcW,                      srcRow * srcH,                      srcW, srcH,
        layer.offsetX + col * layer.tileW,  layer.offsetY + row * layer.tileH,  layer.tileW, layer.tileH,
      );
    }
  }

  ctx.globalAlpha = prevAlpha;
}

// ── Internal ──────────────────────────────────────────────────────────────────

function _getSheet(name: string): TileSheetEntry | undefined {
  const s = _sheets.get(name);
  if (!s || !s.img.complete || s.img.naturalWidth === 0 || s.sheetCols === 0) return undefined;
  return s;
}
