# Arena Zero asset-role audit

## Why the screenshot showed floating duplicate guns

Poly Haven's `service_pistol` is a good CC0 **presentation/source asset**, but its published model intentionally contains multiple grip variants plus detachable magazines and bullets. Arena Zero v2 incorrectly instantiated the entire scene graph as though every child mesh were one equipped weapon. That was the root cause of the two pistols and loose magazines appearing together in first person.

The fix is architectural: gameplay no longer accepts a model just because it is visually related to a weapon. An asset now has to pass a **role audit**: one assembled object for the equipped-weapon role, known real-world orientation/scale, deterministic movable parts, and no alternative configurations sitting in the same scene graph.

Poly Haven remains the primary environment source because its PBR materials, HDRIs, barriers, crates, barrels and architectural surfaces map cleanly to their gameplay roles.

## Equipped weapon selected

**Service Pistol, Duty Loadout (Mega Weapon Pack)** — 3DAssets.dev

- Direct GLB: `https://cdn.3dassets.dev/assets/33455/v1/model.glb`
- Asset page: `https://3dassets.dev/assets/mega-weapon-pack-service-pistol-duty-loadout-f0007eea`
- License: CC0 1.0 Universal
- 37,152 triangles / 39,127 vertices
- One assembled duty pistol with reflex sight and weapon light
- Named slide, hammer and magazine pivots
- Animation clips: `slide-open`, `slide-close`, `magazine-open`, `magazine-close`, `cock`
- +Y up / +Z muzzle direction; dimensions are published in metres

The viewmodel loads exactly one copy of this GLB and uses its authored part animations for recoil/reload. It does **not** manufacture a second gun, second magazine, or an alternate grip variant.

## Third-person operator selected

**Attacker Medium Operator** from the CC0 **Arctic Station FPS Kit** — 3DAssets.dev

- Standing aim: `https://cdn.3dassets.dev/assets/28523/v1/model.glb`
- Advancing pose: `https://cdn.3dassets.dev/assets/28524/v1/model.glb`
- License: CC0 1.0 Universal
- About 30,200 triangles per pose
- Dark teal / black modern tactical clothing, plate carrier, webbing and shouldered bullpup carbine
- +Y up / +Z facing; metre scale; ground contact at y=0

The weapon is intentionally modelled into these rigid operator poses. Arena Zero therefore **never attaches another gun** to the character. Standing and advancing/crouched states swap complete matching poses rather than combining unrelated meshes.

## Other sources reviewed

- **Sketchfab:** several downloadable rigged military characters exist, but the strongest candidates found were CC BY rather than CC0, which adds attribution/redistribution requirements and a less deterministic automated download path.
- **itch.io:** useful CC0 FPS arms/weapon packs exist, but the reviewed packs leaned retro/PSX or low-poly and did not match the photoreal PBR arena target.
- **Poly Haven:** retained for environment realism, but its multi-variant `service_pistol` is deliberately excluded from the equipped-weapon role.
- **3DAssets.dev:** selected for gameplay objects because the chosen GLBs are CC0, self-contained, CORS-enabled, documented in metres/orientation, and expose explicit movable-part semantics.

## Validation rules going forward

1. Never instantiate an entire source/presentation scene as a gameplay object without inspecting its variants/parts.
2. One equipped weapon = one assembled weapon root.
3. A character with a baked weapon never receives a second weapon attachment.
4. External asset dimensions and forward axis must be normalized before placement.
5. Detachable parts are driven by named nodes/clips when provided; procedural duplicates are fallback-only.
6. New gameplay assets must have a documented license and source page in `src/assetCatalog.js`.
