/**
 * src/main.ts — Bootstrap, UI wiring, game loop kick-off.
 * This module is the single entry point imported by index.html.
 */

import { WORLD_WIDTH, WORLD_HEIGHT, PLAYER_COLORS, SEND_HZ, MAX_CHAT_MESSAGES } from './constants.js';
import type { GameState, LocalPlayer, NetMsg, ChatEntry } from './types.js';
import { GAME_MAP } from './game/map.js';
import { startLoop } from './game/loop.js';
import { initInput, getInput } from './game/input.js';
import { movePlayer } from './game/physics.js';
import { render, resizeCanvas } from './game/render.js';
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
  id:    playerId,
  name:  savedName || 'Player',
  x:     WORLD_WIDTH  / 2,
  y:     WORLD_HEIGHT / 2,
  color: colorFromId(playerId),
};

const state: GameState = {
  local,
  peers:         new Map(),
  chat:          [],
  isTyping:      false,
  debugColliders: false,
};

// ── Canvas setup ──────────────────────────────────────────────────────────

const canvas = document.getElementById('game-canvas') as HTMLCanvasElement;
const ctx    = canvas.getContext('2d');
if (!ctx) throw new Error('Could not get 2D context');

resizeCanvas(canvas);
window.addEventListener('resize', () => resizeCanvas(canvas));

// ── Input ─────────────────────────────────────────────────────────────────

initInput();

// ── Network ───────────────────────────────────────────────────────────────

const roomId = getRoomId();
let roomHandle: RoomHandle | null = null;

function broadcastHello(): void {
  if (!roomHandle) return;
  roomHandle.send({
    type: 'hello',
    playerId: state.local.id,
    name:     state.local.name,
    x:        state.local.x,
    y:        state.local.y,
    color:    state.local.color,
  });
}

function handleMsg(msg: NetMsg, peerId: string): void {
  switch (msg.type) {
    case 'hello':
      upsertPeer(state.peers, peerId, msg.playerId, msg.name, msg.color, msg.x, msg.y);
      // Reply with our own hello so the newcomer sees us
      if (roomHandle) {
        roomHandle.send({
          type: 'hello',
          playerId: state.local.id,
          name:     state.local.name,
          x:        state.local.x,
          y:        state.local.y,
          color:    state.local.color,
        }, peerId);
      }
      break;

    case 'state':
      recordSample(state.peers, peerId, msg.x, msg.y, msg.seq, msg.ts);
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
            type: 'hello',
            playerId: state.local.id,
            name:     state.local.name,
            x:        state.local.x,
            y:        state.local.y,
            color:    state.local.color,
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
    type:     'state',
    playerId: state.local.id,
    x:        state.local.x,
    y:        state.local.y,
    seq:      _seq,
    ts:       Date.now(),
  });
}, Math.round(1000 / SEND_HZ));

// Watchdog: evict timed-out peers every 2 seconds
setInterval(() => {
  evictStalePeers(state.peers);
}, 2_000);

// ── Game loop ─────────────────────────────────────────────────────────────

startLoop((dt: number) => {
  const input = getInput();

  // Only move when not typing in chat
  if (!state.isTyping) {
    movePlayer(state.local, input, GAME_MAP.colliders, dt);
  }

  // Smooth peer positions
  smoothPeers(state.peers, dt);

  // Render
  render(canvas, ctx, state, GAME_MAP);
});

// ── Cleanup on unload ─────────────────────────────────────────────────────

window.addEventListener('beforeunload', () => {
  roomHandle?.send({ type: 'bye', playerId: state.local.id });
  void roomHandle?.leave();
});
