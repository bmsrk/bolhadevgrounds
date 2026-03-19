import type { LocalPlayer, Collider, Rect } from '../types.js';
import { PLAYER_RADIUS, PLAYER_SPEED, PLAYER_SPRINT_MULT, WORLD_WIDTH, WORLD_HEIGHT } from '../constants.js';
import type { InputState } from './input.js';

/** Returns true if two axis-aligned bounding boxes overlap. */
export function rectsOverlap(a: Rect, b: Rect): boolean {
  return (
    a.x < b.x + b.w &&
    a.x + a.w > b.x &&
    a.y < b.y + b.h &&
    a.y + a.h > b.y
  );
}

/** AABB for a circular player (square approximation). */
function playerRect(x: number, y: number): Rect {
  return {
    x: x - PLAYER_RADIUS,
    y: y - PLAYER_RADIUS,
    w: PLAYER_RADIUS * 2,
    h: PLAYER_RADIUS * 2,
  };
}

/**
 * Move the local player according to input state, checking colliders and
 * world bounds. Mutates `player.x` and `player.y` in place.
 */
export function movePlayer(
  player: LocalPlayer,
  input: Readonly<InputState>,
  colliders: Collider[],
  dt: number,
): boolean {
  const speed = input.sprint
    ? PLAYER_SPEED * PLAYER_SPRINT_MULT
    : PLAYER_SPEED;

  let dx = 0;
  let dy = 0;
  if (input.left)  dx -= 1;
  if (input.right) dx += 1;
  if (input.up)    dy -= 1;
  if (input.down)  dy += 1;

  // Normalise diagonal movement
  if (dx !== 0 && dy !== 0) {
    const len = Math.sqrt(dx * dx + dy * dy);
    dx /= len;
    dy /= len;
  }

  if (dx === 0 && dy === 0) return false;

  const newX = Math.max(PLAYER_RADIUS, Math.min(WORLD_WIDTH  - PLAYER_RADIUS, player.x + dx * speed * dt));
  const newY = Math.max(PLAYER_RADIUS, Math.min(WORLD_HEIGHT - PLAYER_RADIUS, player.y + dy * speed * dt));

  // Try full movement first, then axis-separated fallback
  const fullRect = playerRect(newX, newY);
  const blocked  = colliders.some(c => rectsOverlap(fullRect, c));

  if (!blocked) {
    player.x = newX;
    player.y = newY;
  } else {
    // Try X axis only
    const xRect = playerRect(newX, player.y);
    if (!colliders.some(c => rectsOverlap(xRect, c))) {
      player.x = newX;
    }
    // Try Y axis only
    const yRect = playerRect(player.x, newY);
    if (!colliders.some(c => rectsOverlap(yRect, c))) {
      player.y = newY;
    }
  }

  return true;
}
