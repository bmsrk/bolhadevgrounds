// ─── Animation & character ────────────────────────────────────────────────────

export type AnimState    = 'idle' | 'idle_anim' | 'walk' | 'run' | 'sit' | 'sit2' | 'sit3' | 'phone';
export type Facing       = 'down' | 'left' | 'right' | 'up';
export type CharacterName = 'Adam' | 'Alex' | 'Amelia' | 'Bob';

export interface Animator {
  state:  AnimState;
  facing: Facing;
  frame:  number;
  timer:  number;
}

// ─── Identity ────────────────────────────────────────────────────────────────

export interface LocalPlayer {
  id:        string;         // UUID, sessionStorage
  name:      string;         // localStorage, editable
  x:         number;
  y:         number;
  color:     string;         // deterministic from id
  character: CharacterName;  // deterministic from id hash
}

// ─── Network messages (discriminated union) ───────────────────────────────────

export interface HelloMsg {
  type:      'hello';
  playerId:  string;
  name:      string;
  x:         number;
  y:         number;
  color:     string;
  character: CharacterName;
}

export interface StateMsg {
  type:      'state';
  playerId:  string;
  x:         number;
  y:         number;
  seq:       number;       // monotonically increasing, per sender
  ts:        number;       // Date.now()
  animState: AnimState;
  facing:    Facing;
}

export interface ChatMsg {
  type:         'chat';
  id:           string;   // uuid v4
  fromPlayerId: string;
  fromName:     string;
  text:         string;
  ts:           number;   // unix ms
}

export interface ByeMsg {
  type:     'bye';
  playerId: string;
}

export interface NameChangeMsg {
  type:     'namechange';
  playerId: string;
  name:     string;
}

export type NetMsg = HelloMsg | StateMsg | ChatMsg | ByeMsg | NameChangeMsg;

// ─── Peer state (maintained locally) ─────────────────────────────────────────

export interface PositionSample {
  x:  number;
  y:  number;
  ts: number;
}

export interface PeerState {
  peerId:    string;       // Trystero peer ID (not our playerId)
  playerId:  string;
  name:      string;
  color:     string;
  character: CharacterName;
  animState: AnimState;
  facing:    Facing;
  // Rendered position (smoothed)
  renderX:  number;
  renderY:  number;
  // Ring buffer of last N received state samples for interpolation
  samples:  PositionSample[];
  lastSeen: number;        // Date.now() of last state/hello received
  seq:      number;        // last accepted seq
}

// ─── Map / world ──────────────────────────────────────────────────────────────

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface Collider extends Rect {
  label?: string;          // debug label
}

export interface Zone extends Rect {
  label: string;
  color: string;           // fill colour for zone background tint
}

export interface FurnitureShape {
  type:    'rect' | 'circle';
  x:       number;
  y:       number;
  w?:      number;         // rect only
  h?:      number;         // rect only
  r?:      number;         // circle only
  color:   string;
  label?:  string;
  sprite?: string;         // SVG sprite key (legacy – prefer tileSprite)
  /** Pixel-art tile sprite drawn from a loaded TileSheet (see loadTileSheet). */
  tileSprite?: { sheet: string; tileId: number };
}

/**
 * A single tile map layer.
 * `data` is flat row-major: data[row * mapCols + col] = tile ID.
 * Tile ID = sheetRow * sheetCols + sheetCol  (0-based, row-major in sheet).
 * Use –1 to skip a tile (nothing drawn for that cell).
 */
export interface TileLayer {
  /** Registered TileSheet name (see loadTileSheet in tilemap.ts). */
  sheet:   string;
  mapCols: number;
  mapRows: number;
  tileW:   number;         // destination tile width  (px on canvas)
  tileH:   number;         // destination tile height (px on canvas)
  /** Flat row-major tile ID array; length === mapCols × mapRows. */
  data:    readonly number[];
  offsetX: number;
  offsetY: number;
  z:       number;         // 0 = floor (below zones), 1 = overlay (above zones)
  alpha?:  number;
}

export interface GameMap {
  worldWidth:  number;
  worldHeight: number;
  zones:       Zone[];
  colliders:   Collider[];
  furniture:   FurnitureShape[];
  tiles:       TileLayer[];
}

// ─── Interactive world objects (proximity triggers) ───────────────────────────

export interface InteractiveObject {
  x:     number;
  y:     number;
  r:     number;           // trigger radius
  label: string;           // tooltip text shown on proximity
}

// ─── Ambient particles ────────────────────────────────────────────────────────

export interface Particle {
  x:       number;
  y:       number;
  vx:      number;
  vy:      number;
  alpha:   number;
  life:    number;
  maxLife: number;
  r:       number;
}

// ─── Chat ─────────────────────────────────────────────────────────────────────

export interface ChatEntry extends ChatMsg {
  isLocal: boolean;
}

// ─── Game state (runtime) ─────────────────────────────────────────────────────

export interface GameState {
  local:          LocalPlayer;
  peers:          Map<string, PeerState>;    // key = peerId (Trystero)
  chat:           ChatEntry[];
  isTyping:       boolean;                   // true while chat input focused
  debugColliders: boolean;
  // Phase 3 – animation
  localAnimator:  Animator;
  peerAnimators:  Map<string, Animator>;     // key = peerId
  // Phase 4 – ambient & polish
  particles:        Particle[];
  zoneFlash:        { label: string; alpha: number; color: string } | null;
  currentZoneLabel: string | null;
  proximityTooltip: string | null;
}
