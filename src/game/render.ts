import type { GameState } from '../types.js';
import type { GameMap } from '../types.js';
import { PLAYER_RADIUS } from '../constants.js';
import { getSprite } from './sprites.js';

const LABEL_FONT   = '11px "Segoe UI", system-ui, sans-serif';
const NAME_FONT    = '12px "Segoe UI", system-ui, sans-serif';
const ZONE_FONT    = 'bold 13px "Segoe UI", system-ui, sans-serif';

/** Resize the canvas to fill the window. Returns true if size changed. */
export function resizeCanvas(canvas: HTMLCanvasElement): boolean {
  const w = window.innerWidth;
  const h = window.innerHeight;
  if (canvas.width !== w || canvas.height !== h) {
    canvas.width  = w;
    canvas.height = h;
    return true;
  }
  return false;
}

/**
 * Main render function. Clears the canvas and draws everything:
 * map background, zones, furniture, collider outlines (debug), players.
 */
export function render(
  canvas: HTMLCanvasElement,
  ctx: CanvasRenderingContext2D,
  state: GameState,
  map: GameMap,
): void {
  const W = canvas.width;
  const H = canvas.height;

  // ── Camera / viewport offset (centre map in canvas) ──────────────────────
  const offX = Math.round((W - map.worldWidth)  / 2);
  const offY = Math.round((H - map.worldHeight) / 2);

  ctx.clearRect(0, 0, W, H);

  ctx.save();
  ctx.translate(offX, offY);

  // ── World background ──────────────────────────────────────────────────────
  ctx.fillStyle = '#0f0f1e';
  ctx.fillRect(0, 0, map.worldWidth, map.worldHeight);

  // ── Zones ─────────────────────────────────────────────────────────────────
  for (const zone of map.zones) {
    ctx.fillStyle = zone.color;
    ctx.fillRect(zone.x, zone.y, zone.w, zone.h);

    // Zone label
    ctx.save();
    ctx.font = ZONE_FONT;
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(zone.label, zone.x + zone.w / 2, zone.y + zone.h / 2);
    ctx.restore();
  }

  // ── Furniture ─────────────────────────────────────────────────────────────
  for (const item of map.furniture) {
    ctx.save();
    ctx.fillStyle = item.color;
    ctx.strokeStyle = 'rgba(255,255,255,0.15)';
    ctx.lineWidth = 1;

    if (item.type === 'rect' && item.w !== undefined && item.h !== undefined) {
      const img = item.sprite ? getSprite(item.sprite) : undefined;
      if (img) {
        // Sprite is ready – draw the SVG image directly (no border / label needed)
        ctx.drawImage(img, item.x, item.y, item.w, item.h);
      } else {
        // Sprite not yet loaded or not set – fall back to plain coloured rectangle
        ctx.fillRect(item.x, item.y, item.w, item.h);
        ctx.strokeRect(item.x, item.y, item.w, item.h);
        if (item.label) {
          ctx.font = LABEL_FONT;
          ctx.fillStyle = 'rgba(255,255,255,0.6)';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(item.label, item.x + item.w / 2, item.y + item.h / 2);
        }
      }
    } else if (item.type === 'circle' && item.r !== undefined) {
      ctx.beginPath();
      ctx.arc(item.x, item.y, item.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }
    ctx.restore();
  }

  // ── Debug: collider outlines ───────────────────────────────────────────────
  if (state.debugColliders) {
    ctx.save();
    ctx.strokeStyle = 'rgba(255,80,80,0.7)';
    ctx.lineWidth = 1;
    for (const c of map.colliders) {
      ctx.strokeRect(c.x, c.y, c.w, c.h);
      if (c.label) {
        ctx.font = LABEL_FONT;
        ctx.fillStyle = 'rgba(255,80,80,0.9)';
        ctx.fillText(c.label, c.x + 2, c.y + 12);
      }
    }
    ctx.restore();
  }

  // ── Peer players ──────────────────────────────────────────────────────────
  for (const peer of state.peers.values()) {
    drawPlayer(ctx, peer.renderX, peer.renderY, peer.color, peer.name, false);
  }

  // ── Local player ──────────────────────────────────────────────────────────
  drawPlayer(ctx, state.local.x, state.local.y, state.local.color, state.local.name, true);

  ctx.restore();
}

function drawPlayer(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  color: string,
  name: string,
  isLocal: boolean,
): void {
  // Shadow / glow
  ctx.save();
  ctx.shadowColor = color;
  ctx.shadowBlur  = isLocal ? 14 : 8;

  // Body circle
  ctx.beginPath();
  ctx.arc(x, y, PLAYER_RADIUS, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.fill();

  // Border ring for local player
  if (isLocal) {
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth   = 2;
    ctx.stroke();
  }
  ctx.restore();

  // Name label above the circle
  ctx.save();
  ctx.font = NAME_FONT;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'bottom';
  // Shadow for readability
  ctx.shadowColor = '#000000';
  ctx.shadowBlur  = 4;
  ctx.fillStyle = isLocal ? '#ffffff' : '#e0e0e0';
  ctx.fillText(name, x, y - PLAYER_RADIUS - 3);
  ctx.restore();
}
