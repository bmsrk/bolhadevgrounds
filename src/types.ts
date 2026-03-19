// ─── Identity ────────────────────────────────────────────────────────────────

export interface LocalPlayer {
  id: string;          // UUID, sessionStorage
  name: string;        // localStorage, editable
  x: number;
  y: number;
  color: string;       // deterministic from id
}

// ─── Network messages (discriminated union) ───────────────────────────────────

export interface HelloMsg {
  type: 'hello';
  playerId: string;
  name: string;
  x: number;
  y: number;
  color: string;
}

export interface StateMsg {
  type: 'state';
  playerId: string;
  x: number;
  y: number;
  seq: number;         // monotonically increasing, per sender
  ts: number;          // Date.now()
}

export interface ChatMsg {
  type: 'chat';
  id: string;          // uuid v4
  fromPlayerId: string;
  fromName: string;
  text: string;
  ts: number;          // unix ms
}

export interface ByeMsg {
  type: 'bye';
  playerId: string;
}

export interface NameChangeMsg {
  type: 'namechange';
  playerId: string;
  name: string;
}

export type NetMsg = HelloMsg | StateMsg | ChatMsg | ByeMsg | NameChangeMsg;

// ─── Peer state (maintained locally) ─────────────────────────────────────────

export interface PositionSample {
  x: number;
  y: number;
  ts: number;
}

export interface PeerState {
  peerId: string;       // Trystero peer ID (not our playerId)
  playerId: string;
  name: string;
  color: string;
  // Rendered position (smoothed)
  renderX: number;
  renderY: number;
  // Ring buffer of last 3 received state samples for interpolation
  samples: PositionSample[];
  lastSeen: number;     // Date.now() of last state/hello received
  seq: number;          // last accepted seq
}

// ─── Map / world ──────────────────────────────────────────────────────────────

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface Collider extends Rect {
  label?: string;       // debug label
}

export interface Zone extends Rect {
  label: string;
  color: string;        // fill colour for zone background
}

export interface FurnitureShape {
  type: 'rect' | 'circle';
  x: number;
  y: number;
  w?: number;           // rect only
  h?: number;           // rect only
  r?: number;           // circle only
  color: string;
  label?: string;
  sprite?: string;      // optional sprite name – loaded from public/sprites/<name>.svg
}

export interface GameMap {
  worldWidth: number;
  worldHeight: number;
  zones: Zone[];
  colliders: Collider[];
  furniture: FurnitureShape[];
}

// ─── Chat ─────────────────────────────────────────────────────────────────────

export interface ChatEntry extends ChatMsg {
  isLocal: boolean;
}

// ─── Game state (runtime) ─────────────────────────────────────────────────────

export interface GameState {
  local: LocalPlayer;
  peers: Map<string, PeerState>;   // key = peerId (Trystero)
  chat: ChatEntry[];
  isTyping: boolean;               // true while chat input focused
  debugColliders: boolean;
}
