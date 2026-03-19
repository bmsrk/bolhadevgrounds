/**
 * src/game/animation.ts — Character sprite-sheet animation state machine.
 *
 * Sheet layout (LimeZu "Modern Tiles Free" characters, 16 × 32 px frames):
 *
 *   <Char>_16x16.png      — 1 frame  (full atlas, static idle at srcX=0, srcY=0)
 *   <Char>_idle_16x16.png — 4 frames × 1 row   idle breathing loop
 *   <Char>_run_16x16.png  — 6 frames × 4 directions, laid out HORIZONTALLY in one row:
 *                           down (0–5) · left (6–11) · right (12–17) · up (18–23)
 *   <Char>_phone_16x16.png — frames × 1 row  on-phone animation
 *   <Char>_sit_16x16.png  — frames × 1 row  sitting
 *
 * All sheets are a single 32 px-tall row; directions vary the X offset only.
 * Character sprite source dimensions: CHAR_W=16 px wide × CHAR_H=32 px tall.
 */

import type { AnimState, Facing, CharacterName, Animator } from '../types.js';

/** Source pixel width and height of one character frame in the sheet. */
export const CHAR_W = 16;
export const CHAR_H = 32;

/**
 * Maps facing direction → starting frame column in the run/walk sheet.
 *
 * All four directions are laid out horizontally in a single 32 px-tall row:
 *   down (frames 0–5) · left (frames 6–11) · right (frames 12–17) · up (frames 18–23)
 *
 * Source formula: srcX = (FACING_COL[facing] + frame) * CHAR_W,  srcY = 0
 */
const FACING_COL: Record<Facing, number> = {
  down:  0,
  left:  6,
  right: 12,
  up:    18,
};

/** Animation playback speed (frames per second) per state. */
const ANIM_FPS: Record<AnimState, number> = {
  idle:      0,    // static — never advances
  idle_anim: 5,
  walk:      8,
  run:       12,
  sit:       0,
  phone:     3,
};

/** Number of animation frames per state. */
const ANIM_FRAMES: Record<AnimState, number> = {
  idle:      1,
  idle_anim: 4,
  walk:      6,
  run:       6,
  sit:       1,
  phone:     2,
};

// ── Public API ────────────────────────────────────────────────────────────────

export function createAnimator(): Animator {
  return { state: 'idle_anim', facing: 'down', frame: 0, timer: 0 };
}

/**
 * Advance the animator by `dt` seconds.
 *
 * @param anim           - Animator to mutate in place
 * @param moving         - Player moved this frame
 * @param sprinting      - Sprint key held
 * @param facingOverride - Facing derived from movement direction (null = keep current)
 * @param dt             - Delta-time in seconds
 */
export function tickAnimator(
  anim:           Animator,
  moving:         boolean,
  sprinting:      boolean,
  facingOverride: Facing | null,
  dt:             number,
): void {
  const desired: AnimState = moving ? (sprinting ? 'run' : 'walk') : 'idle_anim';

  if (desired !== anim.state) {
    anim.state = desired;
    anim.frame = 0;
    anim.timer = 0;
  }

  if (facingOverride !== null) anim.facing = facingOverride;

  const fps    = ANIM_FPS[anim.state]!;
  const frames  = ANIM_FRAMES[anim.state]!;
  if (fps > 0) {
    anim.timer += dt;
    const frameDur = 1 / fps;
    while (anim.timer >= frameDur) {
      anim.timer -= frameDur;
      anim.frame  = (anim.frame + 1) % frames;
    }
  }
}

/**
 * Derive the facing direction from a velocity vector.
 * Returns null when both components are zero (player not moving).
 */
export function facingFromVelocity(dx: number, dy: number): Facing | null {
  if (dx === 0 && dy === 0) return null;
  if (Math.abs(dx) >= Math.abs(dy)) return dx > 0 ? 'right' : 'left';
  return dy > 0 ? 'down' : 'up';
}

/**
 * Return the spritesheet key and source-pixel coordinates for the current
 * animation frame.  Sheet keys match those registered via `loadSheet`.
 */
export function getFrameSource(
  character: CharacterName,
  anim:      Readonly<Animator>,
): { sheetKey: string; srcX: number; srcY: number } {
  const c = character.toLowerCase();
  switch (anim.state) {
    case 'idle':
      return { sheetKey: `${c}-idle`, srcX: 0, srcY: 0 };

    case 'idle_anim':
      return { sheetKey: `${c}-idle-anim`, srcX: anim.frame * CHAR_W, srcY: 0 };

    case 'walk':
    case 'run':
      return {
        sheetKey: `${c}-run`,
        srcX: (FACING_COL[anim.facing]! + anim.frame) * CHAR_W,
        srcY: 0,    // all directions are in one horizontal row
      };

    case 'phone':
      return { sheetKey: `${c}-phone`, srcX: anim.frame * CHAR_W, srcY: 0 };

    case 'sit':
      return { sheetKey: `${c}-sit`, srcX: 0, srcY: 0 };

    default:
      return { sheetKey: `${c}-idle`, srcX: 0, srcY: 0 };
  }
}
