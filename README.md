# Arena Zero

A browser-based multiplayer FPS built with Three.js, Socket.IO and an authoritative Node server. The arena is designed around Poly Haven CC0 environment materials/models and a Poly Haven service pistol.

## Features

- Correct camera-relative WASD movement: W always advances along the horizontal camera-forward vector; A/D strafe perpendicular to it.
- Pointer-lock mouse look, adjustable sensitivity/FOV, sprint, crouch, jump, ADS, recoil, head bob, reload and hit markers.
- Authoritative multiplayer snapshots over Socket.IO with player join/leave, scoreboard, kill feed, respawn and timed match reset.
- Server-side bots that acquire targets, rotate/strafe/chase, shoot, reload, die and respawn.
- Server-validated hitscan shooting with arena occlusion, body/head damage, rate-of-fire enforcement and ammo state.
- Poly Haven PBR arena surfaces, HDR lighting and GLTF props/weapon when downloaded.
- ACES tone mapping, soft shadows, fog and restrained bloom.
- Zero required account/API key for Poly Haven asset installation.

## Setup

```bash
npm install
npm run assets
npm run dev
```

Open `http://localhost:3000` in two browser windows to test multiplayer. For another computer on the same LAN, open `http://<host-PC-IP>:3000`.

### Commands explained

- `npm install` installs the exact JavaScript dependencies declared in `package.json`.
- `npm run assets` runs the Poly Haven downloader, selects compact glTF/PBR/HDR variants from the public API, verifies checksums when supplied, and writes them under `public/assets/polyhaven/` plus `manifest.json`.
- `npm run dev` starts the authoritative game server and Vite in development middleware mode.
- `npm run build` produces the optimized production client in `dist/`.
- `npm start` serves the built client and multiplayer server from one Node process.
- `npm run check` runs Node syntax checks on the main source files.

## Controls

| Input | Action |
|---|---|
| W A S D | Move / strafe |
| Mouse | Look |
| Left click | Fire |
| Right click | Aim down sights |
| Shift | Sprint |
| Ctrl or C | Crouch |
| Space | Jump |
| R | Reload |
| Esc | Release cursor |

## Asset policy

Poly Haven assets are CC0 and may be used commercially. The included downloader uses Poly Haven's public API and presents a visible in-game Poly Haven credit because live API usage asks for attribution. The downloader sets a unique User-Agent. Large binary assets are intentionally excluded from Git so the repo stays lightweight; run `npm run assets` after cloning.

Selected Poly Haven assets:

- `service_pistol` — first-person weapon
- `barrel_03` — arena prop
- `wooden_crate_02` — arena prop
- `concrete_road_barrier` — cover prop
- `security_light` — dressing prop
- `concrete_floor`, `concrete`, `container_side` — PBR materials
- `reinforced_concrete_01` — HDRI lighting/environment

## Character animation note

Combatants use procedural runtime bodies and motion so this repository does not redistribute third-party character/animation source files. Mixamo can be integrated later for humanoid character animation; Adobe permits Mixamo content in commercial games but raw character/animation redistribution is restricted, so those files should be obtained by the project owner and kept out of a public asset repository.

## Production deployment

Run `npm run build`, then `npm start`. For internet multiplayer, deploy the Node process on a host that supports WebSockets and expose the configured `PORT` environment variable. This implementation is suitable as a polished prototype/vertical slice; a public competitive release should add authentication, matchmaking, persistent accounts, anti-cheat telemetry, lag compensation/history rewind, moderation, analytics, load testing and a dedicated scalable state service.
