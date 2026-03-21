# 🗺️ Bolhadevgrounds Feature Roadmap

> All features are designed for **GitHub Pages** deployment — static files only, no server, no backend, no database. Everything is 100% client-side + P2P (Trystero/BitTorrent WebRTC).

## Hard Constraints

| Constraint | Implication |
|---|---|
| **No server** | No WebSocket relay, no database, no auth server, no API endpoints |
| **No persistence across sessions** | Only `localStorage`/`IndexedDB` per browser. Nothing shared. |
| **P2P only (Trystero/BitTorrent)** | All sync goes through WebRTC data channels via public BitTorrent trackers |
| **Static assets only** | Everything must be bundled by Vite and served from `dist/` |
| **Peer discovery is slow** | BitTorrent tracker handshake takes 2-10s. Can't rely on instant connections |
| **WebRTC limits** | Practical peer limit ~8-15 per room before bandwidth/CPU issues |

---

## What Exists Today

| System | Status |
|---|---|
| Canvas rendering + tile map | ✅ Working |
| P2P networking (Trystero) | ✅ Working |
| Character selection + variants | ✅ Working |
| Text chat | ✅ Working |
| WASD movement + sprint | ✅ Working |
| AABB collision | ✅ Working |
| Procedural room generation | ✅ Working |
| Map definition system | ✅ Working |
| Zone detection + flash | ✅ Working |
| Proximity tooltips | ✅ Working |

---

## 🟢 Milestone 1 — Interactivity & Sitting

**Goal:** Players can interact with furniture.

| Feature | Description | Feasibility |
|---|---|---|
| **Sit on chairs (E key)** | Walk near chair → press E → snap to seat, play sit anim, lock movement. E again to stand. Broadcast `animState` (already in `StateMsg`). | ✅ Fully client-side |
| **Generalized interactive objects** | Extend `InteractiveObject` with an `action` field. Room generator auto-registers chair/desk zones. | ✅ Fully client-side |
| **E-key prompt overlay** | Render `[E] Sit` above player when in proximity radius. Replace current tooltip text. | ✅ Canvas draw call |
| **Sync sit state** | Already broadcasting `animState` + `facing`. Just need to also broadcast locked position so peers see you on the exact chair. | ✅ Existing net channel |

---

## 🟡 Milestone 2 — Presence & Social

**Goal:** Feel co-located.

| Feature | Description | Feasibility |
|---|---|---|
| **Typing indicator** | Broadcast `isTyping` bool in `StateMsg`. Render `...` bubble above peers. Cost: 1 extra bit per state packet. | ✅ Trivial |
| **Emotes (1-9 keys)** | New `emote` message type. Peer receives it, renders floating emoji above that peer for 2s. No persistence needed. | ✅ P2P broadcast |
| **Player roster sidebar** | DOM panel listing connected peer names + current zones. Built from `state.peers` Map. | ✅ Client-side DOM |
| **System messages** | "X joined" / "X moved to Engineering" in chat. Triggered locally from `onPeerJoin` + zone change detection. | ✅ Local event |

> **Deferred: Proximity voice/audio** — Trystero supports WebRTC audio but BitTorrent tracker discovery is too slow/unreliable for real-time audio. Would need a TURN server for NAT traversal. Revisit if switching to a relay strategy.

---

## 🔵 Milestone 3 — Map Selector & Navigation

**Goal:** Use map definitions, let users pick their office.

| Feature | Description | Feasibility |
|---|---|---|
| **Map selector in name panel** | Dropdown/grid in the existing `#name-panel` before entering. Picks a `MapDefinition` from `map-definitions.ts`. | ✅ Client-side DOM |
| **`?map=` URL parameter** | Like `?room=` and `?seed=`. All peers must use the same map — include `mapId` in `HelloMsg` so late joiners know which map to load. Reject mismatches with a toast. | ✅ URL param + P2P validation |
| **Minimap renderer** | Draw tile layers at 1/10 scale onto an offscreen canvas. Render as corner overlay + use as map selector thumbnails. | ✅ Canvas, no dependencies |
| **In-game minimap (M key)** | Small corner overlay showing room outlines + player dots. Toggle with M. | ✅ Canvas overlay |
| **5+ built-in map presets** | Add map definitions using different room template combos. All defined in code, bundled by Vite. | ✅ Static TS module |

---

## 🟣 Milestone 4 — Camera & Larger Worlds

**Goal:** Break out of the 1280×720 fixed viewport.

| Feature | Description | Feasibility |
|---|---|---|
| **Camera follow system** | Smooth lerp camera centered on local player. Canvas `translate()` before all draw calls. | ✅ Client-side |
| **Larger world sizes** | With camera, maps can be 2560×1440+. Room generator already uses `WORLD_WIDTH`/`WORLD_HEIGHT` constants. | ✅ Just change constants per map |
| **Viewport culling** | Only draw tiles/furniture/peers within camera viewport ± margin. Huge perf win for bigger maps. | ✅ Math check per draw call |
| **Footstep particles** | Dust puffs based on floor theme. Extend `RoomTemplate` with `floorMaterial` metadata. | ✅ Client-side particles |
| **Zone transition animations** | Slide-in zone name, smooth fade instead of alpha flash. | ✅ Canvas animation |

---

## 🔴 Milestone 5 — Collaboration (P2P Only)

**Goal:** Give people reasons to use this as a virtual office.

| Feature | Description | Feasibility |
|---|---|---|
| **Sticky notes (per-browser)** | Place text notes on the map. Store in `localStorage` keyed by `roomId + mapId`. Only you see your own notes. | ✅ localStorage |
| **Shared sticky notes (P2P sync)** | Broadcast notes to peers as a `notes-sync` message. Peers see them while connected. Notes disappear when the author leaves (ephemeral). | ✅ P2P, ephemeral only |
| **Do-not-disturb mode** | Toggle DND — red indicator dot, suppress prompts. Broadcast in `StateMsg`. | ✅ 1 bool in state |
| **Room portals (door tiles)** | Door tile that changes `?room=` param. Triggers `room.leave()` → `joinGameRoom()` with new room ID. Full re-join, not seamless, but functional. | ✅ Client-side navigation |

> **Cut: Screen sharing** — Requires reliable WebRTC media streams. BitTorrent tracker P2P is too unreliable for sustained video. Would need a TURN/STUN server.
>
> **Reduced scope: Shared whiteboard** — Can do a local-only drawing board (personal notepad). Shared sync is possible P2P but conflict resolution without a server is painful. Defer.

---

## ⚫ Milestone 6 — Resilience & QoL

**Goal:** Handle edge cases and improve usability within static hosting limits.

| Feature | Description | Feasibility |
|---|---|---|
| **Reconnect on disconnect** | Detect Trystero disconnect, auto-rejoin after backoff. Show "Reconnecting..." toast. | ✅ Client-side retry |
| **Peer limit warning** | If `peers.size > 12`, show a warning that performance may degrade. Suggest splitting into sub-rooms. | ✅ Client-side check |
| **IndexedDB for chat history** | Persist last 500 chat messages per room in IndexedDB. Reload shows recent history (local only). | ✅ Browser API |
| **PWA / offline shell** | Add a service worker + `manifest.json` for installability. Cache static assets for instant reload. Won't work offline (needs peers) but loads faster. | ✅ Vite PWA plugin |
| **Mobile touch controls** | Virtual joystick overlay for mobile browsers. Touch to move, tap furniture to interact. | ✅ DOM + touch events |

---

## Execution Order

```
Now:    Visual fixes + map definitions
Next:   Milestone 1 (sit + interact)                     ~1 week
Then:   Milestone 2 (social: typing, emotes, roster)     ~1 week  
Then:   Milestone 3 (map selector + minimap)             ~1 week
Then:   Milestone 4 (camera + bigger worlds)             ~1-2 weeks
Then:   Milestone 5 (notes, DND, portals)                ~1-2 weeks
Later:  Milestone 6 (reconnect, PWA, mobile)             ongoing
```

---

## Explicitly NOT on the Roadmap (GitHub Pages constraint)

- ❌ Any backend / API / database
- ❌ OAuth / persistent user accounts
- ❌ Screen sharing / voice chat (unreliable without TURN)
- ❌ Cross-session shared state (notes, furniture customization visible to others after refresh)
- ❌ Push notifications
