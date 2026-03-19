/**
 * src/main.ts — Bootstrap, UI wiring, game loop kick-off.
 * This module is the single entry point imported by index.html.
 */

import { WORLD_WIDTH, WORLD_HEIGHT, PLAYER_COLORS, SEND_HZ, MAX_CHAT_MESSAGES } from './constants.js';
import type { GameState, LocalPlayer, NetMsg, ChatEntry, CharacterName, Facing } from './types.js';
import { GAME_MAP, INTERACTIVE_OBJECTS } from './game/map.js';
import { startLoop } from './game/loop.js';
import { initInput, getInput } from './game/input.js';
import { movePlayer } from './game/physics.js';
import { render, resizeCanvas } from './game/render.js';
import { loadSheet } from './game/sprites.js';
import { loadTileSheet } from './game/tilemap.js';
import { createAnimator, tickAnimator, facingFromVelocity, CHAR_W, CHAR_H } from './game/animation.js';
import { joinGameRoom } from './net/room.js';
import type { RoomHandle } from './net/room.js';
import { upsertPeer, recordSample, smoothPeers, evictStalePeers } from './net/presence.js';
import { initOverlay, appendChatMessage } from './ui/overlay.js';

// ── Helpers ────────────────────────────────────────────────────────────────

function getOrCreatePlayerId(): string {
  let id = sessionStorage.getItem('playerId');
  if (!id) {
    // crypto.randomUUID is available in all modern browsers
    id = crypto.randomUUID();
    sessionStorage.setItem('playerId', id);
  }
  return id;
}

function getSavedName(): string {
  return localStorage.getItem('playerName') ?? '';
}

function saveName(name: string): void {
  localStorage.setItem('playerName', name);
}

/** Deterministic color from player ID. */
function colorFromId(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = ((hash << 5) - hash + id.charCodeAt(i)) | 0;
  }
  const idx = Math.abs(hash) % PLAYER_COLORS.length;
  return PLAYER_COLORS[idx] ?? '#4a9eff';
}

/** Deterministic character assignment from player ID. */
const _CHAR_NAMES: readonly CharacterName[] = ['Adam', 'Alex', 'Amelia', 'Bob'];
function characterFromId(id: string): CharacterName {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = ((hash << 5) - hash + id.charCodeAt(i + 1 | 0)) | 0;
  }
  return _CHAR_NAMES[Math.abs(hash) % _CHAR_NAMES.length] ?? 'Adam';
}

/** Read room name from ?room= query parameter; fall back to 'lobby'. */
function getRoomId(): string {
  const params = new URLSearchParams(window.location.search);
  return params.get('room') ?? 'lobby';
}

function newUUID(): string {
  return crypto.randomUUID();
}

// ── Initialise game state ──────────────────────────────────────────────────

const playerId  = getOrCreatePlayerId();
const savedName = getSavedName();

const local: LocalPlayer = {
  id:        playerId,
  name:      savedName || 'Player',
  x:         WORLD_WIDTH  / 2,
  y:         WORLD_HEIGHT / 2,
  color:     colorFromId(playerId),
  character: characterFromId(playerId),
};

const state: GameState = {
  local,
  peers:            new Map(),
  chat:             [],
  isTyping:         false,
  debugColliders:   false,
  localAnimator:    createAnimator(),
  peerAnimators:    new Map(),
  particles:        [],
  zoneFlash:        null,
  currentZoneLabel: null,
  proximityTooltip: null,
};

// ── Canvas setup ──────────────────────────────────────────────────────────

const canvas = document.getElementById('game-canvas') as HTMLCanvasElement;
const ctx    = canvas.getContext('2d');
if (!ctx) throw new Error('Could not get 2D context');

resizeCanvas(canvas);
window.addEventListener('resize', () => resizeCanvas(canvas));

// ── Sprite pre-loading ────────────────────────────────────────────────────

// Preload pixel-art character sprite sheets (16 × 32 px frames)
// idle-anim uses the 4-frame directional idle sheet (_idle_16x16.png).
// run uses a single-row sheet with all 4 directions laid out horizontally:
//   down (0-5) · left (6-11) · right (12-17) · up (18-23)
for (const char of _CHAR_NAMES) {
  const n    = char;
  const base = `pixelart/Modern tiles_Free/Characters_free/${n}`;
  loadSheet(`${n.toLowerCase()}-idle`,      `${base}_16x16.png`,      CHAR_W, CHAR_H);
  loadSheet(`${n.toLowerCase()}-idle-anim`, `${base}_idle_16x16.png`, CHAR_W, CHAR_H);
  loadSheet(`${n.toLowerCase()}-run`,       `${base}_run_16x16.png`,  CHAR_W, CHAR_H);
  loadSheet(`${n.toLowerCase()}-phone`,     `${base}_phone_16x16.png`, CHAR_W, CHAR_H);
  loadSheet(`${n.toLowerCase()}-sit`,       `${base}_sit_16x16.png`,  CHAR_W, CHAR_H);
}

// Preload tile sheets for floor and furniture rendering
loadTileSheet(
  'room-builder',
  'pixelart/Modern tiles_Free/Interiors_free/16x16/Room_Builder_free_16x16.png',
  16, 16,
);
loadTileSheet(
  'interiors',
  'pixelart/Modern tiles_Free/Interiors_free/16x16/Interiors_free_16x16.png',
  16, 16,
);

// ── Input ─────────────────────────────────────────────────────────────────

initInput();

// ── Network ───────────────────────────────────────────────────────────────

const roomId = getRoomId();
let roomHandle: RoomHandle | null = null;

function broadcastHello(): void {
  if (!roomHandle) return;
  roomHandle.send({
    type:      'hello',
    playerId:  state.local.id,
    name:      state.local.name,
    x:         state.local.x,
    y:         state.local.y,
    color:     state.local.color,
    character: state.local.character,
  });
}

function handleMsg(msg: NetMsg, peerId: string): void {
  switch (msg.type) {
    case 'hello': {
      const isNewPeer = !state.peers.has(peerId);
      upsertPeer(state.peers, peerId, msg.playerId, msg.name, msg.color, msg.character, msg.x, msg.y);
      // Reply with our own hello only once so the newcomer sees us
      if (isNewPeer && roomHandle) {
        roomHandle.send({
          type:      'hello',
          playerId:  state.local.id,
          name:      state.local.name,
          x:         state.local.x,
          y:         state.local.y,
          color:     state.local.color,
          character: state.local.character,
        }, peerId);
      }
      break;
    }

    case 'state':
      recordSample(state.peers, peerId, msg.x, msg.y, msg.seq, msg.ts, msg.animState, msg.facing);
      // Sync peer animator state so it advances frames locally
      {
        let peerAnim = state.peerAnimators.get(peerId);
        if (!peerAnim) {
          peerAnim = createAnimator();
          state.peerAnimators.set(peerId, peerAnim);
        }
        peerAnim.state  = msg.animState;
        peerAnim.facing = msg.facing;
      }
      break;

    case 'chat': {
      const entry: ChatEntry = { ...msg, isLocal: false };
      state.chat.push(entry);
      if (state.chat.length > MAX_CHAT_MESSAGES) state.chat.shift();
      appendChatMessage(entry);
      break;
    }

    case 'bye':
      state.peers.delete(peerId);
      break;

    case 'namechange': {
      const peer = state.peers.get(peerId);
      if (!peer) break;
      // Optional safety check: ensure the claimed playerId matches the stored one
      if (msg.playerId !== undefined && msg.playerId !== peer.playerId) break;
      peer.name = msg.name;
      break;
    }
  }
}

// ── Overlay / UI ──────────────────────────────────────────────────────────

initOverlay(
  roomId,
  savedName,
  // onNameSave
  (name: string) => {
    saveName(name);
    state.local.name = name;

    // Start networking now that the player has a name
    roomHandle = joinGameRoom(
      roomId,
      // onPeerJoin
      (peerId: string) => {
        // Announce ourselves to the new peer
        if (roomHandle) {
          roomHandle.send({
            type:      'hello',
            playerId:  state.local.id,
            name:      state.local.name,
            x:         state.local.x,
            y:         state.local.y,
            color:     state.local.color,
            character: state.local.character,
          }, peerId);
        }
      },
      // onPeerLeave
      (peerId: string) => {
        state.peers.delete(peerId);
      },
      handleMsg,
    );

    broadcastHello();
  },
  // onChatSubmit
  (text: string) => {
    if (!text) return;
    const msg: NetMsg = {
      type:         'chat',
      id:           newUUID(),
      fromPlayerId: state.local.id,
      fromName:     state.local.name,
      text,
      ts:           Date.now(),
    };
    // Show locally
    const entry: ChatEntry = { ...msg, isLocal: true };
    state.chat.push(entry);
    if (state.chat.length > MAX_CHAT_MESSAGES) state.chat.shift();
    appendChatMessage(entry);
    // Broadcast
    roomHandle?.send(msg);
  },
  // onTypingChange
  (typing: boolean) => {
    state.isTyping = typing;
  },
  // onDebugToggle
  () => {
    state.debugColliders = !state.debugColliders;
  },
);

// ── State broadcast interval ──────────────────────────────────────────────

let _seq = 0;
setInterval(() => {
  if (!roomHandle) return;
  _seq++;
  roomHandle.send({
    type:      'state',
    playerId:  state.local.id,
    x:         state.local.x,
    y:         state.local.y,
    seq:       _seq,
    ts:        Date.now(),
    animState: state.localAnimator.state,
    facing:    state.localAnimator.facing,
  });
}, Math.round(1000 / SEND_HZ));

// Watchdog: evict timed-out peers every 2 seconds
setInterval(() => {
  evictStalePeers(state.peers);
}, 2_000);

// ── Game loop ─────────────────────────────────────────────────────────────

startLoop((dt: number) => {
  const input = getInput();

  // ── Movement ───────────────────────────────────────────────────────────
  let facingDir: Facing | null = null;
  if (!state.isTyping) {
    const moved = movePlayer(state.local, input, GAME_MAP.colliders, dt);
    if (moved) {
      const dx = (input.right ? 1 : 0) - (input.left ? 1 : 0);
      const dy = (input.down  ? 1 : 0) - (input.up   ? 1 : 0);
      facingDir = facingFromVelocity(dx, dy);
    }
  }

  // ── Local animator ────────────────────────────────────────────────────
  const moving = !state.isTyping &&
    (input.up || input.down || input.left || input.right);
  tickAnimator(state.localAnimator, moving, input.sprint, facingDir, dt);

  // ── Peer animators (advance frames locally between network updates) ───
  for (const [peerId, anim] of state.peerAnimators) {
    if (!state.peers.has(peerId)) { state.peerAnimators.delete(peerId); continue; }
    const peerMoving   = anim.state === 'walk' || anim.state === 'run';
    const peerSprinting = anim.state === 'run';
    tickAnimator(anim, peerMoving, peerSprinting, null, dt);
  }

  // ── Zone detection (show flash on enter) ─────────────────────────────
  const curZone = GAME_MAP.zones.find(z =>
    state.local.x >= z.x && state.local.x < z.x + z.w &&
    state.local.y >= z.y && state.local.y < z.y + z.h,
  );
  const curLabel = curZone?.label ?? null;
  if (curLabel !== state.currentZoneLabel) {
    state.currentZoneLabel = curLabel;
    if (curLabel && curZone) {
      state.zoneFlash = { label: curLabel, alpha: 1, color: curZone.color };
    }
  }
  if (state.zoneFlash) {
    state.zoneFlash.alpha -= dt * 2;
    if (state.zoneFlash.alpha <= 0) state.zoneFlash = null;
  }

  // ── Ambient dust motes (Lounge zone) ─────────────────────────────────
  if (Math.random() < dt * 5) {
    state.particles.push({
      x:       20  + Math.random() * 240,
      y:       320 + Math.random() * 380,
      vx:      (Math.random() - 0.5) * 8,
      vy:      -(4 + Math.random() * 10),
      alpha:   0.3 + Math.random() * 0.3,
      life:    0,
      maxLife: 1.5 + Math.random() * 1.5,
      r:       0.8 + Math.random() * 1.2,
    });
  }
  for (let i = state.particles.length - 1; i >= 0; i--) {
    const p = state.particles[i]!;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.life += dt;
    if (p.life >= p.maxLife) state.particles.splice(i, 1);
  }
  if (state.particles.length > 60) state.particles.splice(0, state.particles.length - 60);

  // ── Proximity tooltip ─────────────────────────────────────────────────
  state.proximityTooltip = null;
  for (const obj of INTERACTIVE_OBJECTS) {
    const ddx = state.local.x - obj.x;
    const ddy = state.local.y - obj.y;
    if (ddx * ddx + ddy * ddy < obj.r * obj.r) {
      state.proximityTooltip = obj.label;
      break;
    }
  }

  // ── Smooth peer positions ─────────────────────────────────────────────
  smoothPeers(state.peers, dt);

  // ── Render ────────────────────────────────────────────────────────────
  render(canvas, ctx, state, GAME_MAP);
});

// ── Cleanup on unload ─────────────────────────────────────────────────────

window.addEventListener('beforeunload', () => {
  roomHandle?.send({ type: 'bye', playerId: state.local.id });
  void roomHandle?.leave();
});
