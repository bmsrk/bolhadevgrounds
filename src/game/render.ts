import type { GameState, CharacterName, Animator } from '../types.js';
import type { GameMap } from '../types.js';
import { PLAYER_RADIUS } from '../constants.js';
import { getSprite, drawSheetFrame } from './sprites.js';
import { drawTileLayer, drawTile } from './tilemap.js';
import { getFrameSource, CHAR_W, CHAR_H } from './animation.js';

const LABEL_FONT   = '11px "Segoe UI", system-ui, sans-serif';
const NAME_FONT    = '12px "Segoe UI", system-ui, sans-serif';
const ZONE_FONT    = 'bold 13px "Segoe UI", system-ui, sans-serif';
const HUD_FONT     = 'bold 16px "Segoe UI", system-ui, sans-serif';
const TOOLTIP_FONT = '12px "Segoe UI", system-ui, sans-serif';

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

/** Day / night overlay alpha — 0 = full day, 0.45 = deep night. */
function getDayNightAlpha(): number {
  const now = new Date();
  const h   = now.getHours() + now.getMinutes() / 60;
  if (h >= 10 && h < 18) return 0;
  if (h >= 22 || h < 6)  return 0.45;
  if (h >= 18)            return ((h - 18) / 4) * 0.45;  // dusk  18 → 22
  return                         ((10 - h) / 4) * 0.45;  // dawn   6 → 10
}

/**
 * Main render function.  Clears the canvas and draws everything:
 * floor tiles, zones, overlay tiles, furniture, collider outlines (debug),
 * players, ambient particles, HUD overlays (zone flash, tooltip, day/night).
 */
export function render(
  canvas: HTMLCanvasElement,
  ctx:    CanvasRenderingContext2D,
  state:  GameState,
  map:    GameMap,
): void {
  const W = canvas.width;
  const H = canvas.height;

  // ── Camera / viewport offset (centre map in canvas) ──────────────────────
  const offX = Math.round((W - map.worldWidth)  / 2);
  const offY = Math.round((H - map.worldHeight) / 2);

  ctx.clearRect(0, 0, W, H);
  ctx.imageSmoothingEnabled = false;   // keep pixel-art tiles crisp

  ctx.save();
  ctx.translate(offX, offY);

  // ── World background ──────────────────────────────────────────────────────
  ctx.fillStyle = '#0f0f1e';
  ctx.fillRect(0, 0, map.worldWidth, map.worldHeight);

  // ── Floor tile layers (z = 0, below zones) ────────────────────────────────
  for (const layer of map.tiles) {
    if (layer.z === 0) drawTileLayer(ctx, layer);
  }

  // ── Zones ─────────────────────────────────────────────────────────────────
  for (const zone of map.zones) {
    ctx.fillStyle = zone.color;
    ctx.fillRect(zone.x, zone.y, zone.w, zone.h);

    ctx.save();
    ctx.font          = ZONE_FONT;
    ctx.fillStyle     = 'rgba(255,255,255,0.35)';
    ctx.textAlign     = 'center';
    ctx.textBaseline  = 'middle';
    ctx.fillText(zone.label, zone.x + zone.w / 2, zone.y + zone.h / 2);
    ctx.restore();
  }

  // ── Overlay tile layers (z = 1, above zones) ──────────────────────────────
  for (const layer of map.tiles) {
    if (layer.z === 1) drawTileLayer(ctx, layer);
  }

  // ── Furniture ─────────────────────────────────────────────────────────────
  for (const item of map.furniture) {
    ctx.save();
    ctx.fillStyle   = item.color;
    ctx.strokeStyle = 'rgba(255,255,255,0.15)';
    ctx.lineWidth   = 1;

    if (item.type === 'rect' && item.w !== undefined && item.h !== undefined) {
      let drawn = false;
      if (item.tileSprite) {
        drawn = drawTile(ctx, item.tileSprite.sheet, item.tileSprite.tileId, item.x, item.y, item.w, item.h);
      }
      if (!drawn) {
        const img = item.sprite ? getSprite(item.sprite) : undefined;
        if (img) {
          ctx.drawImage(img, item.x, item.y, item.w, item.h);
        } else {
          ctx.fillRect(item.x, item.y, item.w, item.h);
          ctx.strokeRect(item.x, item.y, item.w, item.h);
          if (item.label) {
            ctx.font         = LABEL_FONT;
            ctx.fillStyle    = 'rgba(255,255,255,0.6)';
            ctx.textAlign    = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(item.label, item.x + item.w / 2, item.y + item.h / 2);
          }
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
    ctx.lineWidth   = 1;
    for (const c of map.colliders) {
      ctx.strokeRect(c.x, c.y, c.w, c.h);
      if (c.label) {
        ctx.font      = LABEL_FONT;
        ctx.fillStyle = 'rgba(255,80,80,0.9)';
        ctx.fillText(c.label, c.x + 2, c.y + 12);
      }
    }
    ctx.restore();
  }

  // ── Peer players ──────────────────────────────────────────────────────────
  for (const peer of state.peers.values()) {
    const peerAnim: Readonly<Animator> = state.peerAnimators.get(peer.peerId)
      ?? { state: 'idle_anim', facing: 'down', frame: 0, timer: 0 };
    drawPlayer(ctx, peer.renderX, peer.renderY, peer.color, peer.name, false, peer.character, peerAnim);
  }

  // ── Local player ──────────────────────────────────────────────────────────
  drawPlayer(ctx, state.local.x, state.local.y, state.local.color, state.local.name, true, state.local.character, state.localAnimator);

  // ── Ambient particles (Lounge dust motes) ────────────────────────────────
  for (const p of state.particles) {
    const t = p.life / p.maxLife;
    ctx.save();
    ctx.globalAlpha = p.alpha * (1 - t * t);
    ctx.fillStyle   = '#f39c12';
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  ctx.restore(); // ── end world-space transform ──────────────────────────────

  // ─── HUD (canvas space) ───────────────────────────────────────────────────

  // ── Day / night overlay ───────────────────────────────────────────────────
  const nightAlpha = getDayNightAlpha();
  if (nightAlpha > 0) {
    ctx.save();
    ctx.fillStyle = `rgba(10,8,25,${nightAlpha.toFixed(3)})`;
    ctx.fillRect(0, 0, W, H);
    ctx.restore();
  }

  // ── Zone-entry flash ──────────────────────────────────────────────────────
  if (state.zoneFlash && state.zoneFlash.alpha > 0) {
    ctx.save();
    ctx.globalAlpha  = Math.min(1, state.zoneFlash.alpha);
    ctx.font         = HUD_FONT;
    ctx.textAlign    = 'center';
    ctx.textBaseline = 'top';
    ctx.shadowColor  = '#000';
    ctx.shadowBlur   = 8;
    ctx.fillStyle    = '#ffffff';
    ctx.fillText(`▶ ${state.zoneFlash.label}`, W / 2, 14);
    ctx.restore();
  }

  // ── Proximity tooltip ─────────────────────────────────────────────────────
  if (state.proximityTooltip) {
    const text = state.proximityTooltip;
    const cx   = state.local.x + offX;
    const cy   = state.local.y + offY - CHAR_H * 2 - 28;

    ctx.save();
    ctx.font    = TOOLTIP_FONT;
    const tw    = ctx.measureText(text).width;
    const ph    = 22;
    const pw    = tw + 18;

    ctx.fillStyle = 'rgba(0,0,0,0.78)';
    ctx.beginPath();
    ctx.rect(cx - pw / 2, cy - ph / 2, pw, ph);
    ctx.fill();

    ctx.strokeStyle = 'rgba(255,255,255,0.22)';
    ctx.lineWidth   = 0.5;
    ctx.stroke();

    ctx.fillStyle    = '#f0f0f0';
    ctx.textAlign    = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, cx, cy);
    ctx.restore();
  }
}

// ── Private ───────────────────────────────────────────────────────────────────

function drawPlayer(
  ctx:       CanvasRenderingContext2D,
  x:         number,
  y:         number,
  color:     string,
  name:      string,
  isLocal:   boolean,
  character: CharacterName,
  anim:      Readonly<Animator>,
): void {
  const DW = CHAR_W * 2;            // 32 px on canvas
  const DH = CHAR_H * 2;            // 64 px on canvas
  const dx = Math.round(x) - DW / 2;
  const dy = Math.round(y) - DH;    // feet at player.y

  const { sheetKey, srcX, srcY } = getFrameSource(character, anim);
  const drawn = drawSheetFrame(ctx, sheetKey, srcX, srcY, dx, dy, DW, DH);

  if (!drawn) {
    // Sprite not yet loaded – fall back to the original coloured circle
    ctx.save();
    ctx.shadowColor = color;
    ctx.shadowBlur  = isLocal ? 14 : 8;
    ctx.beginPath();
    ctx.arc(x, y, PLAYER_RADIUS, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
    if (isLocal) {
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth   = 2;
      ctx.stroke();
    }
    ctx.restore();
  } else if (isLocal) {
    // Subtle selection ellipse at the local player's feet
    ctx.save();
    ctx.strokeStyle = 'rgba(255,255,255,0.65)';
    ctx.lineWidth   = 1.5;
    ctx.shadowColor = color;
    ctx.shadowBlur  = 10;
    ctx.beginPath();
    ctx.ellipse(x, y, CHAR_W * 0.9, CHAR_W * 0.3, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  // Name label above the character's head
  ctx.save();
  ctx.font         = NAME_FONT;
  ctx.textAlign    = 'center';
  ctx.textBaseline = 'bottom';
  ctx.shadowColor  = '#000000';
  ctx.shadowBlur   = 4;
  ctx.fillStyle    = isLocal ? '#ffffff' : '#e0e0e0';
  ctx.fillText(name, x, dy - 3);
  ctx.restore();
}
