# Arena Zero asset-role audit

## Rejected for equipped weapon: Poly Haven `service_pistol`

Poly Haven describes this model as a worn pistol with **two grip variants, detachable magazines and bullets**. That is useful as a presentation/source asset but it is not semantically safe to instantiate its entire GLB scene graph as a single equipped FPS weapon. The v2 screenshot showed the result: multiple pistol configurations and loose magazines were visible together.

Environment use of Poly Haven remains unchanged because its surfaces, HDRIs and scene props map cleanly to their gameplay roles.

## Selected equipped weapon

- Service Pistol (Tactical Shooter Hill Town)
- Source: 3DAssets.dev
- License: CC0 1.0
- Direct GLB: `https://cdn.3dassets.dev/assets/27542/v1/model.glb`
- Role validation: one assembled pistol; only magazine and slide are movable; +Y up / +Z forward; named magazine/slide animation clips.

## Selected third-person operators

All from the same CC0 Tactical Shooter Hill Town pack so proportions/material language remain consistent:

- Recon Operator Standing Aim — `27571`
- Recon Operator Crouched Aim — `27572`
- Recon Operator Running — `27573`

These are baked-pose models with a carbine already modelled into the hands. Arena Zero therefore treats them as **complete character poses** and never attaches an additional weapon mesh.

## Other sources reviewed

- Sketchfab has downloadable rigged military characters under CC BY and some CC0 models, but many require attribution and its download flow is less deterministic for an automated web build.
- itch.io has useful CC0 FPS arms and weapon packs, but the stronger candidates found were intentionally retro/PSX or low-poly rather than matching the realistic environment.
- 3DAssets.dev was selected for this correction because the chosen assets are CC0, self-contained GLBs, have permanent CORS-enabled URLs, documented real-world dimensions/orientation, and explicit movable-part semantics.
