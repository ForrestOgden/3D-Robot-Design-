// Gameplay assets that are intentionally single-purpose and safe to instantiate as complete scene graphs.
// Environment art remains primarily Poly Haven. These CC0 assets replace Poly Haven's multi-variant
// presentation pistol and the old procedural operator bodies.
export const GAMEPLAY_ASSETS = Object.freeze({
  weapon_service_pistol: Object.freeze({
    role: 'weapon',
    source: '3DAssets.dev',
    license: 'CC0-1.0',
    page: 'https://3dassets.dev/assets/tactical-shooter-hill-town-service-pistol-bc484087',
    url: 'https://cdn.3dassets.dev/assets/27542/v1/model.glb',
    facing: '+Z',
    expectedHeightM: 0.189,
    description: 'Single assembled service pistol with only magazine and slide as movable parts.'
  }),
  operator_recon_stand: Object.freeze({
    role: 'operator-standing',
    source: '3DAssets.dev',
    license: 'CC0-1.0',
    page: 'https://3dassets.dev/assets/tactical-shooter-hill-town-recon-operator-standing-aim-4e708016',
    url: 'https://cdn.3dassets.dev/assets/27571/v1/model.glb',
    facing: '+Z',
    expectedHeightM: 1.722
  }),
  operator_recon_crouch: Object.freeze({
    role: 'operator-crouched',
    source: '3DAssets.dev',
    license: 'CC0-1.0',
    page: 'https://3dassets.dev/assets/tactical-shooter-hill-town-recon-operator-crouch-aim-2be4e72b',
    url: 'https://cdn.3dassets.dev/assets/27572/v1/model.glb',
    facing: '+Z',
    expectedHeightM: 1.355
  }),
  operator_recon_run: Object.freeze({
    role: 'operator-running',
    source: '3DAssets.dev',
    license: 'CC0-1.0',
    page: 'https://3dassets.dev/assets/tactical-shooter-hill-town-recon-operator-running-f971f4ae',
    url: 'https://cdn.3dassets.dev/assets/27573/v1/model.glb',
    facing: '+Z',
    expectedHeightM: 1.609
  })
});

export function gameplayAssetEntries() {
  return Object.entries(GAMEPLAY_ASSETS);
}
