# Arena Zero v2.1

Arena Zero is a browser-based multiplayer FPS built with Three.js, Socket.IO and an authoritative Node server. v2.1 is a major combat, animation, asset-role and rendering pass focused on the things that make an FPS feel expensive: readable hit feedback, survivability, recoil, reload choreography, death presentation, killcam replay, character silhouette quality and physically based environment rendering.

## v2 upgrade

### Gunplay and survivability

- 60 Hz authoritative server simulation with 30 Hz multiplayer snapshots.
- 225 HP instead of 100 HP.
- Service pistol rebalanced to 22 body / 38 head damage at a 170 ms fire interval.
- Eleven body hits or six head hits to kill from full health.
- 4.5-second out-of-combat regeneration delay, then 30 HP/s recovery.
- 1.5 seconds of spawn protection after entering the arena or respawning.
- Server-confirmed white body, gold headshot and red elimination hitmarkers.
- Damage numbers, victim damage vignette and headshot-aware kill feed.
- Bots fire in slower human-like intervals, use wider spread, wait before firing after target acquisition, and penalize targets already engaged by another bot to reduce focus-fire deaths.

### Weapon presentation

- Spring-like visual recoil with separate camera pitch/yaw/roll and weapon translation.
- Reduced recoil impulse while aiming down sights.
- Muzzle flash geometry and short dynamic-light impulse.
- Procedural first-person sleeves and gloves.
- Server-approved reload start event.
- Multi-stage reload animation: lower weapon, clear magazine, support-hand replacement, seat magazine and recover to firing pose.
- A high-detail 37k-triangle CC0 duty pistol is used for gameplay; the Poly Haven multi-variant pistol is explicitly rejected for the equipped-weapon role.

### Characters and death

- High-detail ~30k-triangle CC0 tactical operator poses replace the old primitive procedural characters.
- Standing aim and advancing/crouched poses are complete matching character assemblies with the weapon baked correctly into the hands, so no second gun is attached.
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

**Poly Haven environment models:** `barrel_03`, `concrete_road_barrier`, `concrete_road_barrier_02`, `security_light`, `old_military_crate`, `wooden_military_crate`, `plastic_crate_02`, `trashbag`.

**Audited CC0 gameplay models:** high-detail Service Pistol Duty Loadout plus matching high-detail tactical operator standing/advancing poses. These are downloaded separately because Poly Haven's `service_pistol` is a multi-variant presentation scene rather than a single equipped weapon.

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
- `npm run assets` downloads the selected Poly Haven CC0 environment models, PBR maps and HDRI plus the audited CC0 gameplay pistol/operator GLBs into `public/assets/`, then writes `public/assets/manifest.json`.
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

Current automated regression coverage checks movement normalization, arena collision, ray/AABB occlusion, the 60 Hz simulation target, the 225 HP / eleven-body-hit / six-headshot survivability envelope, calculated TTK, delayed regeneration and spawn protection.

## Production boundary

This is an advanced browser FPS vertical slice, not a literal AAA studio production. A public competitive release should still add account/authentication infrastructure, matchmaking, persistent progression, server history rewind/lag compensation, anti-cheat telemetry, moderation, scalable room orchestration, full spatial audio, additional weapons, animation-captured humanoid rigs, level-of-detail pipelines, browser/device QA and large-scale load testing.

## Licensing

Poly Haven assets are CC0. See https://polyhaven.com/license. The project code does not redistribute raw Mixamo characters/animations or other assets with redistribution restrictions.

## v2.1 asset-role correction

The original Poly Haven `service_pistol` is an excellent CC0 presentation model, but it deliberately contains two grip variants, detachable magazines and bullets. Treating its complete GLB scene as a single equipped gun caused the duplicate/floating weapon parts visible in the v2 screenshot. Arena Zero now rejects that asset for the gameplay-weapon role while continuing to use Poly Haven for environment PBR assets.

The gameplay pistol is now the CC0 **Service Pistol, Duty Loadout (Mega Weapon Pack)** from 3DAssets.dev: a 37k-triangle assembled sidearm with reflex sight, weapon light, named magazine/slide/hammer pivots and authored clips (`slide-open`, `slide-close`, `magazine-open`, `magazine-close`, `cock`). The viewmodel normalizes its real-world scale and uses those clips for recoil/reload motion instead of displaying loose presentation parts.

NPCs now use the high-detail CC0 **Attacker Medium Operator** aiming/advancing poses from the Arctic Station FPS Kit. These are roughly 30k triangles each, use dark teal/black tactical gear, and already include their shouldered carbine in the baked pose. Arena Zero therefore does not attach a second weapon to them. This explicitly prevents the same duplicate-asset mistake on third-person characters.

Survivability was also raised to **225 HP** with 22 body / 38 head damage, 4.5-second delayed regeneration, 1.5 seconds of spawn protection, and slower, less accurate bots with target-spreading logic. The service pistol now needs 11 body hits or 6 headshots from full health.
