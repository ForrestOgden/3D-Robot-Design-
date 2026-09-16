// Gameplay assets that are intentionally single-purpose and safe to instantiate as complete scene graphs.
// Environment art remains primarily Poly Haven. These CC0 assets replace Poly Haven's multi-variant
// presentation pistol and the old procedural operator bodies.
export const GAMEPLAY_ASSETS = Object.freeze({
  weapon_service_pistol: Object.freeze({
    role: 'weapon',
    source: '3DAssets.dev',
    license: 'CC0-1.0',
    page: 'https://3dassets.dev/assets/mega-weapon-pack-service-pistol-duty-loadout-f0007eea',
    url: 'https://cdn.3dassets.dev/assets/33455/v1/model.glb',
    facing: '+Z',
    expectedHeightM: 0.189,
    description: 'High-detail single assembled duty pistol with reflex sight, weapon light, and named slide/magazine pivots.'
  }),
  operator_recon_stand: Object.freeze({
    role: 'operator-standing',
    source: '3DAssets.dev',
    license: 'CC0-1.0',
    page: 'https://3dassets.dev/assets/arctic-station-fps-kit-attacker-medium-aiming-fae9d485',
    url: 'https://cdn.3dassets.dev/assets/28523/v1/model.glb',
    facing: '+Z',
    expectedHeightM: 1.854,
    description: 'High-detail dark-teal/black tactical operator in a standing aim pose with weapon integrated into the rigid character mesh.'
  }),
  operator_recon_crouch: Object.freeze({
    role: 'operator-advancing',
    source: '3DAssets.dev',
    license: 'CC0-1.0',
    page: 'https://3dassets.dev/assets/arctic-station-fps-kit-attacker-medium-advancing-e7310a73',
    url: 'https://cdn.3dassets.dev/assets/28524/v1/model.glb',
    facing: '+Z',
    expectedHeightM: 1.596,
    description: 'Matching high-detail operator in a low advancing/crouched pose.'
  }),
  operator_recon_run: Object.freeze({
    role: 'operator-advancing-fast',
    source: '3DAssets.dev',
    license: 'CC0-1.0',
    page: 'https://3dassets.dev/assets/arctic-station-fps-kit-attacker-medium-advancing-e7310a73',
    url: 'https://cdn.3dassets.dev/assets/28524/v1/model.glb',
    facing: '+Z',
    expectedHeightM: 1.596,
    description: 'The same matching advancing pose is reused for locomotion so the character never receives a mismatched extra weapon or body.'
  })
});

export function gameplayAssetEntries() {
  return Object.entries(GAMEPLAY_ASSETS);
}
