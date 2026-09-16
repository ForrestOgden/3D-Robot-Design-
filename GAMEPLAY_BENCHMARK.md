# Arena Zero v2.1 gameplay benchmark

This document records the concrete references used for the v2 combat pass. Arena Zero is not intended to clone Call of Duty or Battlefield; the references are used to validate pacing, responsiveness and information feedback.

## Combat pacing

### Previous v1 profile

- Health: 100 HP
- Service pistol: 34 body / 72 head
- Fire interval: 145 ms
- Body shots to kill: 3
- Headshots to kill: 2
- Minimum theoretical body TTK after the first hit: 290 ms
- Minimum theoretical head TTK after the first hit: 145 ms

That profile was too abrupt for an arena where bots can acquire targets quickly.

### v2 profile

- Health: 150 HP
- Service pistol: 28 body / 48 head
- Fire interval: 170 ms
- Body shots to kill: 6
- Headshots to kill: 4
- Minimum theoretical body TTK after the first hit: 850 ms
- Minimum theoretical head TTK after the first hit: 510 ms
- Health regeneration begins after 5 seconds without damage and restores 22 HP/s.

Call of Duty's September 2026 Modern Warfare 4 beta notes explicitly describe increasing TTK to create more survivability and room for skill expression. Warzone's 2026 survivability pass uses 150 base health and passive regeneration after more than five seconds out of combat. Arena Zero borrows those high-level pacing signals but does not copy Warzone armor, weapon stats or game rules.

Sources:
- https://www.callofduty.com/patchnotes/2026/08/call-of-duty-modern-warfare-4-beta-patch-notes
- https://www.callofduty.com/patchnotes/2026/03/call-of-duty-bo7-warzone-season-02-reloaded-patch-notes

## Server responsiveness

The authoritative simulation now runs at 60 Hz with 30 Hz snapshots. Battlefield Labs describes 60 Hz as a target for more fluid gameplay, precise shooting/movement, better damage feedback and more accurate combat outcomes. Arena Zero uses the same simulation target while retaining client-side local movement prediction.

Source:
- https://www.ea.com/games/battlefield/news/gunplay-and-movement-philosophy

## Recoil and view feedback

The v2 pistol separates:

- authoritative shot direction/spread
- viewmodel kick and translation
- visual camera pitch/yaw/roll impulse
- exponential recovery
- ADS recoil reduction
- muzzle flash and short light impulse

Battlefield Labs specifically calls out recoil, camera shake and firing speed as components that make weapons distinctive and intentional. Battlefield's published gunplay material also emphasizes communicating inaccuracy/recoil through visible feedback rather than invisible spread alone.

Sources:
- https://www.ea.com/games/battlefield/news/gunplay-and-movement-philosophy
- https://www.ea.com/games/battlefield/news/gunplay-weapons-improvements-features-battlefield-5

## Hit feedback

v2 distinguishes body, headshot and elimination feedback:

- white body hitmarker
- gold headshot hitmarker
- red elimination hitmarker
- damage number beside the reticle
- immediate damage vignette for the victim
- headshot label in the kill feed

The server remains authoritative for whether a hit occurred and what damage was applied; the client only renders confirmed feedback.

## Death and killcam

- Remote players/bots no longer disappear instantly when killed; their tactical operator model falls and remains visible until respawn.
- The local player gets a short first-person collapse before the replay.
- The client stores ~7 seconds of authoritative snapshots and replays the killer's pre-kill point of view for roughly 2.6 seconds.
- The killcam displays killer identity, weapon and attacker health.
- Call of Duty's 2026 Warzone patch notes specifically added attacker health/armor visibility to killcams; Arena Zero shows attacker health only because it does not have armor.

Source:
- https://www.callofduty.com/patchnotes/2026/02/call-of-duty-bo7-warzone-season-02-patch-notes

## Lighting and rendering

Three.js does not provide Unreal Engine's Lumen system. v2 therefore uses a browser-appropriate "Lumen-style" stack rather than mislabeling it as Lumen:

- Poly Haven HDR environment lighting/reflections
- physically based materials
- dynamic directional sun and soft shadow maps
- local security lights
- GTAO contact shading
- fog
- restrained bloom
- ACES filmic tone mapping and sRGB output

Three.js documents GTAOPass as a higher-quality ambient-occlusion pass than SSAOPass.

Source:
- https://threejs.org/docs/pages/GTAOPass.html

## Asset policy

Poly Haven is the primary environment-realism source: CC0 PBR materials, HDRIs and scene props. The equipped pistol and third-person operators are separately audited CC0 gameplay GLBs from 3DAssets.dev because gameplay assets must be semantically single-purpose. Large binaries stay out of Git and are installed locally with `npm run assets`. See `ASSET_AUDIT.md`.

Sources:
- https://polyhaven.com/license
- https://polyhaven.com


## v2.1 playtest correction — survivability and asset semantics

The first v2 playtest exposed two problems that a pure stat/visual review did not catch:

1. **Asset semantics:** Poly Haven's `service_pistol` contains multiple presentation variants and detachable parts in one scene graph. It is no longer accepted as an equipped gameplay weapon. See `ASSET_AUDIT.md`.
2. **Practical lethality:** 150 HP still felt too fast once several server bots could acquire the same human target. v2.1 therefore changes both health/damage **and bot behavior**, rather than only inflating HP.

Current v2.1 combat profile:

- Health: **225 HP**
- Pistol: **22 body / 38 head**
- Fire interval: **170 ms**
- Body shots to kill: **11**
- Headshots to kill: **6**
- Theoretical body TTK: **1.70 s**
- Theoretical head TTK: **0.85 s**
- Regeneration delay: **4.5 s**; regeneration: **30 HP/s**
- Spawn protection: **1.5 s**
- Bot target acquisition now penalizes targets already being engaged by other bots.
- Bots get a reaction delay after switching targets, wider weapon spread, and a 0.52–0.80 s firing cadence rather than near-player cadence.

The earlier 150 HP v2 figures above are retained as historical context for the first upgrade pass; v2.1 supersedes them.
