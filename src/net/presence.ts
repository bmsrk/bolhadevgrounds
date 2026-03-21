import type { PeerState, PositionSample, CharacterName, CharacterVariant, AnimState, Facing } from '../types.js';
import { PEER_TIMEOUT_MS, SMOOTHING_SAMPLES } from '../constants.js';

/**
 * Peer state store.
 * Key = Trystero peerId.
 */
export type PeerStore = Map<string, PeerState>;

/** Add or reset a peer entry (called on 'hello'). */
export function upsertPeer(
  store:     PeerStore,
  peerId:    string,
  playerId:  string,
  name:      string,
  color:     string,
  character: CharacterName,
  variant:   CharacterVariant,
  x:         number,
  y:         number,
): void {
  const existing = store.get(peerId);
  if (existing) {
    existing.playerId  = playerId;
    existing.name      = name;
    existing.color     = color;
    existing.character = character;
    existing.variant   = variant;
    existing.renderX   = x;
    existing.renderY   = y;
    existing.lastSeen  = Date.now();
    existing.samples   = [{ x, y, ts: Date.now() }];
    existing.seq       = 0;
  } else {
    store.set(peerId, {
      peerId,
      playerId,
      name,
      color,
      character,
      variant,
      animState: 'idle_anim',
      facing:    'down',
      isTyping:  false,
      emote:     null,
      renderX:   x,
      renderY:   y,
      samples:   [{ x, y, ts: Date.now() }],
      lastSeen:  Date.now(),
      seq:       0,
    });
  }
}

/** Record a position sample from an incoming 'state' message. */
export function recordSample(
  store:     PeerStore,
  peerId:    string,
  x:         number,
  y:         number,
  seq:       number,
  ts:        number,
  animState: AnimState,
  facing:    Facing,
  isTyping?: boolean,
): void {
  const peer = store.get(peerId);
  if (!peer) return;

  // Drop out-of-order packets
  if (seq <= peer.seq) return;
  peer.seq       = seq;
  peer.lastSeen  = Date.now();
  peer.animState = animState;
  peer.facing    = facing;
  peer.isTyping  = isTyping ?? false;

  const sample: PositionSample = { x, y, ts };
  peer.samples.push(sample);
  if (peer.samples.length > SMOOTHING_SAMPLES) {
    peer.samples.shift();
  }
}

/**
 * Advance rendered positions toward the most recent sample.
 * Simple exponential smoothing — fast enough for ~15 Hz updates.
 */
export function smoothPeers(store: PeerStore, dt: number): void {
  const ALPHA = Math.min(1, dt * 10); // approach factor
  for (const peer of store.values()) {
    const target = peer.samples[peer.samples.length - 1];
    if (!target) continue;
    peer.renderX += (target.x - peer.renderX) * ALPHA;
    peer.renderY += (target.y - peer.renderY) * ALPHA;
  }
}

/** Remove peers that have not sent any message within PEER_TIMEOUT_MS. */
export function evictStalePeers(store: PeerStore): string[] {
  const now     = Date.now();
  const removed: string[] = [];
  for (const [peerId, peer] of store) {
    if (now - peer.lastSeen > PEER_TIMEOUT_MS) {
      store.delete(peerId);
      removed.push(peerId);
    }
  }
  return removed;
}
