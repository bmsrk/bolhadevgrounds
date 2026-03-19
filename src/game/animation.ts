/**
 * src/game/animation.ts — Character sprite-sheet animation state machine.
 *
 * Sheet layout (LimeZu "Modern Tiles Free" characters, 16 × 32 px frames):
 *
 *   <Char>_16x16.png           — full atlas (unused at runtime)
 *   <Char>_idle_16x16.png      — 4 frames × 1 row, one frame per direction:
 *                                 right (0) · up (1) · left (2) · down (3)
 *   <Char>_idle_anim_16x16.png — 24 frames × 1 row (4 directions × 6 frames):
 *                                 right (0–5) · up (6–11) · left (12–17) · down (18–23)
 *   <Char>_run_16x16.png       — 24 frames × 1 row (4 directions × 6 frames):
 *                                 right (0–5) · up (6–11) · left (12–17) · down (18–23)
 *   <Char>_phone_16x16.png     — 9 frames × 1 row  on-phone animation (non-directional)
 *   <Char>_sit_16x16.png       — 24 frames × 1 row (4 directions × 6 frames):
 *                                 right (0–5) · up (6–11) · left (12–17) · down (18–23)
 *   <Char>_sit2_16x16.png      — 24 frames × 1 row (4 directions × 6 frames)
 *   <Char>_sit3_16x16.png      — 12 frames × 1 row (2 directions × 6 frames):
 *                                 right/up (0–5) · left/down (6–11)
 *
 * Direction layout for 6-frame-per-direction sheets:
 *   srcX = (FACING_COL[facing] + frame) * CHAR_W,  srcY = 0
 *
 * Character sprite source dimensions: CHAR_W=16 px wide × CHAR_H=32 px tall.
 */

import type { AnimState, Facing, CharacterName, Animator } from '../types.js';

/** Source pixel width and height of one character frame in the sheet. */
export const CHAR_W = 16;
export const CHAR_H = 32;

/**
 * Maps facing direction → starting frame column in the 6-frame-per-direction
 * run/walk/idle_anim/sit/sit2 sheets.
 *
 * All four directions are laid out horizontally in a single 32 px-tall row:
 *   right (frames 0–5) · up (frames 6–11) · left (frames 12–17) · down (frames 18–23)
 *
 * Source formula: srcX = (FACING_COL[facing] + frame) * CHAR_W,  srcY = 0
 */
const FACING_COL: Record<Facing, number> = {
  right: 0,    // Frame columns 0-5
  up:    6,    // Frame columns 6-11
  left:  12,   // Frame columns 12-17
  down:  18,   // Frame columns 18-23
};

/**
 * Maps facing direction → frame index in the idle_16x16 sheet.
 * That sheet stores exactly one still-idle frame per direction:
 *   right (0) · up (1) · left (2) · down (3)
 */
const FACING_FRAME: Record<Facing, number> = {
  right: 0,
  up:    1,
  left:  2,
  down:  3,
};

/**
 * Maps facing direction → starting frame column in sit3_16x16.
 * sit3 has only 2 direction groups (6 frames each):
 *   right/up group (0–5) · left/down group (6–11)
 */
const SIT3_COL: Record<Facing, number> = {
  right: 0,
  up:    0,
  left:  6,
  down:  6,
};

/** Animation playback speed (frames per second) per state. */
const ANIM_FPS: Record<AnimState, number> = {
  idle:      0,    // static — never advances (directional still frame)
  idle_anim: 5,
  walk:      8,
  run:       12,
  sit:       6,
  sit2:      6,
  sit3:      6,
  phone:     6,
};

/** Number of animation frames per state (per direction where applicable). */
const ANIM_FRAMES: Record<AnimState, number> = {
  idle:      1,
  idle_anim: 6,    // 6 frames per direction (idle_anim_16x16 sheet)
  walk:      6,
  run:       6,
  sit:       6,    // 6 frames per direction (sit_16x16 sheet)
  sit2:      6,    // 6 frames per direction (sit2_16x16 sheet)
  sit3:      6,    // 6 frames per direction (sit3_16x16 has 2 dirs × 6 frames)
  phone:     9,    // 9-frame full phone cycle (non-directional)
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
      // idle_16x16 stores one directional frame per direction (down=0 left=1 right=2 up=3).
      // FACING_FRAME is a complete Record<Facing, number> so the lookup is always defined.
      return { sheetKey: `${c}-idle`, srcX: (FACING_FRAME[anim.facing] ?? 0) * CHAR_W, srcY: 0 };

    case 'idle_anim':
      // idle_anim_16x16 has 4 directions × 6 frames, same column layout as run.
      // FACING_COL is a complete Record<Facing, number> so the lookup is always defined.
      return {
        sheetKey: `${c}-idle-anim`,
        srcX: ((FACING_COL[anim.facing] ?? 0) + anim.frame) * CHAR_W,
        srcY: 0,
      };

    case 'walk':
    case 'run':
      return {
        sheetKey: `${c}-run`,
        srcX: ((FACING_COL[anim.facing] ?? 0) + anim.frame) * CHAR_W,
        srcY: 0,    // all directions are in one horizontal row
      };

    case 'sit':
      return {
        sheetKey: `${c}-sit`,
        srcX: ((FACING_COL[anim.facing] ?? 0) + anim.frame) * CHAR_W,
        srcY: 0,
      };

    case 'sit2':
      return {
        sheetKey: `${c}-sit2`,
        srcX: ((FACING_COL[anim.facing] ?? 0) + anim.frame) * CHAR_W,
        srcY: 0,
      };

    case 'sit3':
      // sit3 has only 2 direction groups; SIT3_COL maps facing to the right group
      return {
        sheetKey: `${c}-sit3`,
        srcX: ((SIT3_COL[anim.facing] ?? 0) + anim.frame) * CHAR_W,
        srcY: 0,
      };

    case 'phone':
      // phone animation is non-directional — cycles through all 9 frames
      return { sheetKey: `${c}-phone`, srcX: anim.frame * CHAR_W, srcY: 0 };

    default:
      return { sheetKey: `${c}-idle`, srcX: (FACING_FRAME[anim.facing] ?? 0) * CHAR_W, srcY: 0 };
  }
}
