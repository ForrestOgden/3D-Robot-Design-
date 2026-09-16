import test from 'node:test';
import assert from 'node:assert/strict';
import {
  normalize2, resolveArenaMove, rayAabb, ARENA_HALF, PLAYER_RADIUS,
  TICK_RATE, MAX_HEALTH, HEALTH_REGEN_DELAY, SPAWN_PROTECTION_SECONDS, WEAPON,
  bodyShotsToKill, headShotsToKill, theoreticalTtk
} from '../src/shared.js';

test('diagonal input is normalized', () => {
  const [x, z] = normalize2(1, 1);
  assert.ok(Math.abs(Math.hypot(x, z) - 1) < 1e-9);
});

test('arena movement clamps to playable bounds', () => {
  const [x, z] = resolveArenaMove(0, 0, 999, -999);
  assert.ok(x <= ARENA_HALF - PLAYER_RADIUS);
  assert.ok(z >= -ARENA_HALF + PLAYER_RADIUS);
});

test('ray AABB detects a frontal wall', () => {
  const t = rayAabb({ x: 0, y: 1, z: 5 }, { x: 0, y: 0, z: -1 }, { x: 0, z: 0, w: 2, d: 2, h: 3 }, 20);
  assert.equal(t, 4);
});

test('ray AABB rejects a miss', () => {
  const t = rayAabb({ x: 5, y: 1, z: 5 }, { x: 0, y: 0, z: -1 }, { x: 0, z: 0, w: 2, d: 2, h: 3 }, 20);
  assert.equal(t, null);
});

test('authoritative simulation runs at 60 Hz', () => {
  assert.equal(TICK_RATE, 60);
});

test('survivability requires eleven body hits and six head hits', () => {
  assert.equal(MAX_HEALTH, 225);
  assert.equal(bodyShotsToKill(), 11);
  assert.equal(headShotsToKill(), 6);
});

test('pistol TTK is deliberately slower than the prior build', () => {
  assert.ok(Math.abs(theoreticalTtk(bodyShotsToKill()) - 1.7) < 1e-9);
  assert.ok(Math.abs(theoreticalTtk(headShotsToKill()) - .85) < 1e-9);
});

test('regeneration and spawn protection prevent chain deaths', () => {
  assert.equal(HEALTH_REGEN_DELAY, 4.5);
  assert.equal(SPAWN_PROTECTION_SECONDS, 1.5);
  assert.ok(WEAPON.damage < MAX_HEALTH / 8);
});
