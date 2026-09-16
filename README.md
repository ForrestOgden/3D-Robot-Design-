# Arena Zero v2

Arena Zero is a browser-based multiplayer FPS built with Three.js, Socket.IO and an authoritative Node server. v2 is a major combat, animation and rendering pass focused on the things that make an FPS feel expensive: readable hit feedback, survivability, recoil, reload choreography, death presentation, killcam replay, character silhouette quality and physically based environment rendering.

## v2 upgrade

### Gunplay and survivability

- 60 Hz authoritative server simulation with 30 Hz multiplayer snapshots.
- 150 HP instead of 100 HP.
- Service pistol rebalanced to 28 body / 48 head damage at a 170 ms fire interval.
- Six body hits or four head hits to kill from full health.
- Five-second out-of-combat regeneration delay, then 22 HP/s recovery.
- Server-confirmed white body, gold headshot and red elimination hitmarkers.
- Damage numbers, victim damage vignette and headshot-aware kill feed.
- Bots fire in more human-like intervals and use increased spread so deaths are less abrupt.

### Weapon presentation

- Spring-like visual recoil with separate camera pitch/yaw/roll and weapon translation.
- Reduced recoil impulse while aiming down sights.
- Muzzle flash geometry and short dynamic-light impulse.
- Procedural first-person sleeves and gloves.
- Server-approved reload start event.
- Multi-stage reload animation: lower weapon, clear magazine, support-hand replacement, seat magazine and recover to firing pose.
- Poly Haven service pistol is used when the asset pack is installed.

### Characters and death

- Rebuilt procedural tactical operators with layered uniform, armor vest, helmet, visor, mask, backpack, pouches, knee pads, boots, gloves and weapon.
- Improved run/walk/crouch/aim readability.
- Dead operators no longer vanish immediately; they play a fall animation and remain in the world until respawn.
- Local death begins with a short first-person collapse.

### Killcam

- Client retains roughly seven seconds of authoritative multiplayer snapshots.
- Death event identifies the killer, weapon, remaining health and authoritative server time.
- A replay camera reconstructs the killer's pre-kill point of view.
- Killcam UI shows killer callsign, weapon and attacker health.
- After the replay, the camera briefly spectates the attacker until respawn.

### Environment and lighting

Three.js does not implement Unreal Engine's Lumen. Arena Zero therefore uses a browser-appropriate **Lumen-style** rendering stack rather than falsely calling it Lumen:

- Poly Haven HDR image-based lighting and reflections.
- ACES filmic tone mapping and sRGB output.
- Dynamic sun with 2048px soft shadow map.
- GTAO contact shading.
- Local security lights.
- Atmospheric fog and restrained bloom.
- PBR concrete, asphalt, brick, slab concrete, corrugated metal, metal plate and container surfaces.
- Expanded industrial skyline, roof equipment, utility pipes, lane markings and dense prop dressing.

## Poly Haven asset pack

The downloader now attempts to install these CC0 assets at practical web resolutions:

**Models:** `service_pistol`, `barrel_03`, `concrete_road_barrier`, `concrete_road_barrier_02`, `security_light`, `old_military_crate`, `wooden_military_crate`, `plastic_crate_02`, `trashbag`.

**PBR materials:** `concrete_floor`, `asphalt_floor`, `concrete_wall_009`, `concrete_slab_wall`, `brick_wall_001`, `corrugated_iron`, `metal_plate_02`, `container_side`, with graceful fallback for unavailable IDs.

**HDRI:** `urban_street_02`.

Large binary art stays out of Git. The downloader uses Poly Haven's public API, identifies itself with a project-specific User-Agent and writes a local manifest.

## Install and run

```bash
npm install
npm run assets
npm run dev
```

- `npm install` installs the dependencies declared in `package.json`.
- `npm run assets` downloads the selected Poly Haven CC0 models, PBR maps and HDRI into `public/assets/polyhaven/` and writes `public/assets/manifest.json`.
- `npm run dev` starts the authoritative Node/Socket.IO server with Vite middleware for development.

Open `http://localhost:3000`. To test multiplayer locally, open a second browser window. For another machine on the same LAN, browse to `http://<host-PC-IP>:3000`.

## Other commands

```bash
npm run check
npm test
npm run build
npm start
```

- `npm run check` asks Node to parse all project JavaScript modules and fails on syntax errors.
- `npm test` runs the gameplay regression tests with Node's built-in test runner.
- `npm run build` creates the optimized Vite production client in `dist/`.
- `npm start` serves the production build and multiplayer WebSocket server from one Node process.

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

WASD is camera-relative: **W always moves along the horizontal camera-forward vector**, and A/D strafe perpendicular to it.

## Gameplay validation

See [`GAMEPLAY_BENCHMARK.md`](./GAMEPLAY_BENCHMARK.md) for the measured v1 → v2 TTK change and the official Call of Duty, Battlefield and Three.js references used to validate pacing, simulation rate, recoil feedback, killcam information and lighting choices.

Current automated regression coverage checks movement normalization, arena collision, ray/AABB occlusion, 60 Hz simulation target, the six-body/four-headshot survivability envelope, calculated TTK and the five-second regeneration delay.

## Production boundary

This is an advanced browser FPS vertical slice, not a literal AAA studio production. A public competitive release should still add account/authentication infrastructure, matchmaking, persistent progression, server history rewind/lag compensation, anti-cheat telemetry, moderation, scalable room orchestration, full spatial audio, additional weapons, animation-captured humanoid rigs, level-of-detail pipelines, browser/device QA and large-scale load testing.

## Licensing

Poly Haven assets are CC0. See https://polyhaven.com/license. The project code does not redistribute raw Mixamo characters/animations or other assets with redistribution restrictions.
