import test from 'node:test';
import assert from 'node:assert/strict';
import { GAMEPLAY_ASSETS, gameplayAssetEntries } from '../src/assetCatalog.js';

test('equipped weapon is a single-purpose audited CC0 gameplay asset', () => {
  const weapon = GAMEPLAY_ASSETS.weapon_service_pistol;
  assert.equal(weapon.role, 'weapon');
  assert.equal(weapon.license, 'CC0-1.0');
  assert.match(weapon.url, /\/33455\/v1\/model\.glb$/);
  assert.ok(!weapon.url.includes('polyhaven'));
  assert.ok(weapon.triangles >= 30000);
});

test('equipped weapon exposes the authored parts required by recoil and reload', () => {
  const clips = new Set(GAMEPLAY_ASSETS.weapon_service_pistol.expectedAnimations);
  for (const name of ['slide-open', 'slide-close', 'magazine-open', 'magazine-close']) {
    assert.ok(clips.has(name), `missing required weapon clip ${name}`);
  }
});

test('third-person operators are high-detail complete assemblies, not extra weapon attachments', () => {
  const stand = GAMEPLAY_ASSETS.operator_recon_stand;
  const advance = GAMEPLAY_ASSETS.operator_recon_crouch;
  assert.match(stand.role, /^operator-/);
  assert.match(advance.role, /^operator-/);
  assert.ok(stand.triangles >= 25000);
  assert.ok(advance.triangles >= 25000);
  assert.notEqual(stand.url, GAMEPLAY_ASSETS.weapon_service_pistol.url);
  assert.notEqual(advance.url, GAMEPLAY_ASSETS.weapon_service_pistol.url);
});

test('no audited gameplay asset points back at the rejected Poly Haven weapon scene', () => {
  for (const [, asset] of gameplayAssetEntries()) {
    assert.ok(!asset.url.includes('polyhaven.com'));
    assert.equal(asset.license, 'CC0-1.0');
  }
});
