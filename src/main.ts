/**
 * src/main.ts — Bootstrap, UI wiring, game loop kick-off.
 * This module is the single entry point imported by index.html.
 */

import { PLAYER_COLORS, SEND_HZ, MAX_CHAT_MESSAGES } from './constants.js';
import type { GameState, LocalPlayer, NetMsg, ChatEntry, CharacterName, CharacterVariant, Facing } from './types.js';
import { GAME_MAP, generateGameMap } from './game/map.js';
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
import { initOverlay, appendChatMessage, showNameConflictToast, appendSystemMessage, updateRoster } from './ui/overlay.js';

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

const ALL_CHAR_NAMES: readonly CharacterName[] = ['Adam', 'Alex', 'Amelia', 'Bob'];

function getSavedCharacter(): CharacterName {
  const saved = localStorage.getItem('playerCharacter') as CharacterName | null;
  return ALL_CHAR_NAMES.includes(saved!) ? saved as CharacterName : 'Adam';
}

function getSavedVariant(): CharacterVariant {
  const raw = Number(localStorage.getItem('playerVariant'));
  return (raw >= 1 && raw <= 6) ? (raw as CharacterVariant) : 1;
}

function saveCharacter(char: CharacterName): void {
  localStorage.setItem('playerCharacter', char);
}

function saveVariant(variant: CharacterVariant): void {
  localStorage.setItem('playerVariant', String(variant));
}

/** Read room name from ?room= query parameter; fall back to 'lobby'. */
function getRoomId(): string {
  const params = new URLSearchParams(window.location.search);
  return params.get('room') ?? 'lobby';
}

/** Read optional ?seed= query parameter for deterministic map generation. */
function getMapSeed(): number | undefined {
  const params = new URLSearchParams(window.location.search);
  const raw = params.get('seed');
  if (raw === null) return undefined;
  const n = parseInt(raw, 10);
  return Number.isFinite(n) ? n : undefined;
}

function newUUID(): string {
  return crypto.randomUUID();
}

// ── Map generation ────────────────────────────────────────────────────────

// Use ?seed= query param for deterministic map; fall back to the module-level
// GAME_MAP (seed 0) so existing behaviour is unchanged when no seed is given.
const mapSeed   = getMapSeed();
const activeMap = mapSeed !== undefined ? generateGameMap(mapSeed) : GAME_MAP;

// ── Initialise game state ──────────────────────────────────────────────────

const playerId  = getOrCreatePlayerId();
const savedName = getSavedName();

const local: LocalPlayer = {
  id:        playerId,
  name:      savedName || 'Player',
  x:         activeMap.spawnPoint.x,
  y:         activeMap.spawnPoint.y,
  color:     colorFromId(playerId),
  character: getSavedCharacter(),
  variant:   getSavedVariant(),
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
  isSitting:        false,
  localEmote:       null,
};

// ── Canvas setup ──────────────────────────────────────────────────────────

const canvas = document.getElementById('game-canvas') as HTMLCanvasElement;
const ctx    = canvas.getContext('2d');
if (!ctx) throw new Error('Could not get 2D context');

resizeCanvas(canvas);
window.addEventListener('resize', () => resizeCanvas(canvas));

// ── Sprite pre-loading ────────────────────────────────────────────────────

// Preload pixel-art character sprite sheets (16 × 32 px frames).
//
// Sheet keys and corresponding PNG files per character:
//   <char>-idle       → <Char>_idle_16x16.png       4 frames (1 per direction: down·left·right·up)
//   <char>-idle-anim  → <Char>_idle_anim_16x16.png  24 frames (4 dirs × 6 frames, same layout as run)
//   <char>-run        → <Char>_run_16x16.png         24 frames (4 dirs × 6 frames)
//   <char>-phone      → <Char>_phone_16x16.png       9 frames (non-directional cycle)
//   <char>-sit        → <Char>_sit_16x16.png         24 frames (4 dirs × 6 frames)
//   <char>-sit2       → <Char>_sit2_16x16.png        24 frames (4 dirs × 6 frames)
//   <char>-sit3       → <Char>_sit3_16x16.png        12 frames (2 dirs × 6 frames: left/down · right/up)
//
// Direction column layout for 6-frame-per-direction sheets:
//   down (0–5) · left (6–11) · right (12–17) · up (18–23)
for (const char of ALL_CHAR_NAMES) {
  const n    = char;
  const base = `pixelart/Modern tiles_Free/Characters_free/${n}`;
  loadSheet(`${n.toLowerCase()}-idle`,      `${base}_idle_16x16.png`,       CHAR_W, CHAR_H);
  loadSheet(`${n.toLowerCase()}-idle-anim`, `${base}_idle_anim_16x16.png`,  CHAR_W, CHAR_H);
  loadSheet(`${n.toLowerCase()}-run`,       `${base}_run_16x16.png`,        CHAR_W, CHAR_H);
  loadSheet(`${n.toLowerCase()}-phone`,     `${base}_phone_16x16.png`,      CHAR_W, CHAR_H);
  loadSheet(`${n.toLowerCase()}-sit`,       `${base}_sit_16x16.png`,        CHAR_W, CHAR_H);
  loadSheet(`${n.toLowerCase()}-sit2`,      `${base}_sit2_16x16.png`,       CHAR_W, CHAR_H);
  loadSheet(`${n.toLowerCase()}-sit3`,      `${base}_sit3_16x16.png`,       CHAR_W, CHAR_H);
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

/** True once the player has confirmed their name and entered the game. */
let _nameEntered = false;

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
    variant:   state.local.variant,
  });
}

function handleMsg(msg: NetMsg, peerId: string): void {
  switch (msg.type) {
    case 'hello': {
      const isNewPeer = !state.peers.has(peerId);
      upsertPeer(state.peers, peerId, msg.playerId, msg.name, msg.color, msg.character, msg.variant, msg.x, msg.y);
      // Reply with our own hello only once the name is set and only to newcomers
      if (isNewPeer && _nameEntered && roomHandle) {
        roomHandle.send({
          type:      'hello',
          playerId:  state.local.id,
          name:      state.local.name,
          x:         state.local.x,
          y:         state.local.y,
          color:     state.local.color,
          character: state.local.character,
          variant:   state.local.variant,
        }, peerId);
        // System message: peer joined
        appendSystemMessage(`${msg.name} joined the room`);
        updateRoster(state.peers, activeMap.zones, state.local.name);
      }
      // Race-condition: another peer arrived at the same time with the same name.
      // The peer whose playerId sorts later loses and gets an auto-suffix.
      if (
        _nameEntered &&
        msg.name.toLowerCase() === state.local.name.toLowerCase() &&
        msg.playerId !== state.local.id &&
        state.local.id > msg.playerId
      ) {
        const newName = findUniqueName(state.local.name, getTakenNames());
        state.local.name = newName;
        saveName(newName);
        roomHandle?.send({ type: 'namechange', playerId: state.local.id, name: newName });
        showNameConflictToast(newName);
      }
      break;
    }

    case 'state':
      recordSample(state.peers, peerId, msg.x, msg.y, msg.seq, msg.ts, msg.animState, msg.facing, msg.isTyping);
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

    case 'bye': {
      const byePeer = state.peers.get(peerId);
      if (byePeer && _nameEntered) {
        appendSystemMessage(`${byePeer.name} left the room`);
      }
      state.peers.delete(peerId);
      updateRoster(state.peers, activeMap.zones, state.local.name);
      break;
    }

    case 'namechange': {
      const peer = state.peers.get(peerId);
      if (!peer) break;
      // Optional safety check: ensure the claimed playerId matches the stored one
      if (msg.playerId !== undefined && msg.playerId !== peer.playerId) break;
      peer.name = msg.name;
      updateRoster(state.peers, activeMap.zones, state.local.name);
      break;
    }

    case 'emote': {
      // Find the peer whose playerId matches (may differ from peerId)
      for (const peer of state.peers.values()) {
        if (peer.playerId === msg.playerId) {
          peer.emote = { emoji: msg.emoji, expiresAt: Date.now() + 2000 };
          break;
        }
      }
      break;
    }
  }
}

// Join the room immediately (before name entry) so we can detect taken names.
// We stay silent (no hello broadcast) until the player confirms their name.
roomHandle = joinGameRoom(
  roomId,
  // onPeerJoin — announce ourselves only after the name has been confirmed
  (peerId: string) => {
    if (!_nameEntered || !roomHandle) return;
    roomHandle.send({
      type:      'hello',
      playerId:  state.local.id,
      name:      state.local.name,
      x:         state.local.x,
      y:         state.local.y,
      color:     state.local.color,
      character: state.local.character,
      variant:   state.local.variant,
    }, peerId);
  },
  // onPeerLeave
  (peerId: string) => {
    // Only show the leave message if the peer wasn't already removed by a 'bye' message
    const peer = state.peers.get(peerId);
    if (peer && _nameEntered) {
      appendSystemMessage(`${peer.name} left the room`);
    }
    state.peers.delete(peerId);
    updateRoster(state.peers, activeMap.zones, state.local.name);
  },
  handleMsg,
);

/** Return the lower-cased set of names currently active in the room. */
function getTakenNames(): Set<string> {
  const names = new Set<string>();
  for (const peer of state.peers.values()) {
    names.add(peer.name.toLowerCase());
  }
  return names;
}

/**
 * Find the next available unique name by appending " (N)" suffixes until
 * no existing peer uses the same name (case-insensitive).
 */
function findUniqueName(base: string, taken: Set<string>): string {
  if (!taken.has(base.toLowerCase())) return base;
  let i = 2;
  while (taken.has(`${base} (${i})`.toLowerCase())) i++;
  return `${base} (${i})`;
}

// ── Overlay / UI ──────────────────────────────────────────────────────────

initOverlay(
  roomId,
  savedName,
  getSavedCharacter(),
  getSavedVariant(),
  // getTakenNames — checked before name is accepted
  getTakenNames,
  // onCharacterSelect — called when character or variant changes in the selector
  (char: CharacterName, variant: CharacterVariant) => {
    state.local.character = char;
    state.local.variant   = variant;
    saveCharacter(char);
    saveVariant(variant);
  },
  // onNameSave
  (name: string) => {
    saveName(name);
    state.local.name = name;
    _nameEntered = true;

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
    isTyping:  state.isTyping,
  });
}, Math.round(1000 / SEND_HZ));

// Watchdog: evict timed-out peers every 2 seconds
setInterval(() => {
  evictStalePeers(state.peers);
}, 2_000);

// ── Emote key map (1–9 keys) ──────────────────────────────────────────────

const EMOTE_MAP: Record<string, string> = {
  Digit1: '👋', Digit2: '😄', Digit3: '👍', Digit4: '❤️', Digit5: '🎉',
  Digit6: '🤔', Digit7: '😂', Digit8: '🙌', Digit9: '💡',
};

window.addEventListener('keydown', (e: KeyboardEvent) => {
  if (state.isTyping) return;
  const emoji = EMOTE_MAP[e.code];
  if (!emoji) return;
  // Show locally
  state.localEmote = { emoji, expiresAt: Date.now() + 2000 };
  // Broadcast to peers
  roomHandle?.send({ type: 'emote', playerId: state.local.id, emoji });
});

// ── Rising-edge interact (E key) tracking ─────────────────────────────────

let _prevInteract = false;

// ── Roster refresh interval ───────────────────────────────────────────────

setInterval(() => {
  if (_nameEntered) updateRoster(state.peers, activeMap.zones, state.local.name);
}, 2_000);

// ── Game loop ─────────────────────────────────────────────────────────────

startLoop((dt: number) => {
  const input = getInput();

  // ── Interact (E) rising edge — sit / stand toggle ─────────────────────
  const interactJustPressed = !state.isTyping && input.interact && !_prevInteract;
  _prevInteract = input.interact;

  if (interactJustPressed) {
    if (state.isSitting) {
      // Stand up
      state.isSitting = false;
    } else {
      // Check for a nearby 'sit' interactive object
      const seatObj = activeMap.interactiveObjects.find(obj => {
        if (obj.action !== 'sit') return false;
        const ddx = state.local.x - obj.x;
        const ddy = state.local.y - obj.y;
        return ddx * ddx + ddy * ddy < obj.r * obj.r;
      });
      if (seatObj) state.isSitting = true;
    }
  }

  // ── Movement ───────────────────────────────────────────────────────────
  let facingDir: Facing | null = null;
  if (!state.isTyping && !state.isSitting) {
    const moved = movePlayer(state.local, input, activeMap.colliders, dt);
    if (moved) {
      const dx = (input.right ? 1 : 0) - (input.left ? 1 : 0);
      const dy = (input.down  ? 1 : 0) - (input.up   ? 1 : 0);
      facingDir = facingFromVelocity(dx, dy);
    }
  }

  // ── Local animator ────────────────────────────────────────────────────
  const moving = !state.isTyping && !state.isSitting &&
    (input.up || input.down || input.left || input.right);
  tickAnimator(
    state.localAnimator,
    moving,
    input.sprint,
    facingDir,
    dt,
    state.isSitting ? 'sit' : undefined,
  );

  // ── Peer animators (advance frames locally between network updates) ───
  for (const [peerId, anim] of state.peerAnimators) {
    if (!state.peers.has(peerId)) { state.peerAnimators.delete(peerId); continue; }
    const isSit       = anim.state === 'sit' || anim.state === 'sit2' || anim.state === 'sit3';
    const peerMoving  = !isSit && (anim.state === 'walk' || anim.state === 'run');
    const peerSprint  = anim.state === 'run';
    tickAnimator(anim, peerMoving, peerSprint, null, dt, isSit ? anim.state : undefined);
  }

  // ── Expire local emote ────────────────────────────────────────────────
  if (state.localEmote && state.localEmote.expiresAt <= Date.now()) {
    state.localEmote = null;
  }

  // ── Expire peer emotes ────────────────────────────────────────────────
  const now = Date.now();
  for (const peer of state.peers.values()) {
    if (peer.emote && peer.emote.expiresAt <= now) {
      peer.emote = null;
    }
  }

  // ── Zone detection (show flash on enter) ─────────────────────────────
  const curZone = activeMap.zones.find(z =>
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

  // ── Ambient dust motes (Lounge zone, new layout: x = 16-288, y = 336-704) ──
  if (Math.random() < dt * 5) {
    state.particles.push({
      x:       22  + Math.random() * 252,
      y:       360 + Math.random() * 336,
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
  if (!state.isSitting) {
    for (const obj of activeMap.interactiveObjects) {
      const ddx = state.local.x - obj.x;
      const ddy = state.local.y - obj.y;
      if (ddx * ddx + ddy * ddy < obj.r * obj.r) {
        state.proximityTooltip = obj;
        break;
      }
    }
  }

  // ── Smooth peer positions ─────────────────────────────────────────────
  smoothPeers(state.peers, dt);

  // ── Render ────────────────────────────────────────────────────────────
  render(canvas, ctx, state, activeMap);
});

// ── Cleanup on unload ─────────────────────────────────────────────────────

window.addEventListener('beforeunload', () => {
  roomHandle?.send({ type: 'bye', playerId: state.local.id });
  void roomHandle?.leave();
});
