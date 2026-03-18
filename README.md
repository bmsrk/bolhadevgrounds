# Startup Devgrounds

A lightweight, browser-only, real-time 2D top-down "virtual office" built with:

- **TypeScript** (strict mode)
- **Vite** for bundling
- **Trystero 0.22.0** (BitTorrent strategy) for P2P networking — no backend required
- **Canvas-only rendering** — no frameworks, no SVG sprites

Live at: <https://bmsrk.github.io/bolhadevgrounds/>

## Getting Started

```bash
npm install
npm run dev        # local dev server at http://localhost:5173/bolhadevgrounds/
```

Open two browser tabs at the same `?room=` URL to see P2P in action.

## Controls

| Key | Action |
|---|---|
| WASD / Arrow keys | Move |
| Shift + move | Sprint |

## Scripts

| Script | Description |
|---|---|
| `npm run dev` | Start Vite dev server |
| `npm run build` | Type-check + production build |
| `npm run preview` | Preview production build locally |
| `npm run lint` | Lint TypeScript source |

## Architecture

```
src/
├── main.ts          # Entry point, bootstrap, game loop
├── types.ts         # Shared TypeScript types
├── constants.ts     # World size, speeds, timeouts, colours
├── game/
│   ├── loop.ts      # requestAnimationFrame loop with delta-time
│   ├── input.ts     # Keyboard state tracker
│   ├── physics.ts   # AABB collision + player movement
│   ├── render.ts    # All canvas draw calls
│   └── map.ts       # Static map: zones, colliders, furniture
├── net/
│   ├── room.ts      # Trystero room join/leave, channel wiring
│   ├── messages.ts  # Message encode/decode helpers
│   └── presence.ts  # Peer state store, smoothing, timeout watchdog
└── ui/
    └── overlay.ts   # DOM overlay: name panel, room bar, chat panel
```

## Deployment

Pushes to `main` trigger the GitHub Actions workflow (`.github/workflows/pages.yml`)
which builds the project and deploys `dist/` to GitHub Pages automatically.

> **Note:** Trystero 0.22.0 is used (latest stable as of bootstrapping).
> The problem statement referenced 0.21.x but 0.22.0 was the latest available.
