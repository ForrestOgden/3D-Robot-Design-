import test from 'node:test';
import assert from 'node:assert/strict';
import { normalize2, resolveArenaMove, rayAabb, ARENA_HALF, PLAYER_RADIUS, TICK_RATE, MAX_HEALTH, HEALTH_REGEN_DELAY, WEAPON, bodyShotsToKill, headShotsToKill, theoreticalTtk } from '../src/shared.js';

test('diagonal input is normalized',()=>{const [x,z]=normalize2(1,1);assert.ok(Math.abs(Math.hypot(x,z)-1)<1e-9);});
test('arena movement clamps to playable bounds',()=>{const [x,z]=resolveArenaMove(0,0,999,-999);assert.ok(x<=ARENA_HALF-PLAYER_RADIUS);assert.ok(z>=-ARENA_HALF+PLAYER_RADIUS);});
test('ray AABB detects a frontal wall',()=>{const t=rayAabb({x:0,y:1,z:5},{x:0,y:0,z:-1},{x:0,z:0,w:2,d:2,h:3},20);assert.equal(t,4);});
test('ray AABB rejects a miss',()=>{const t=rayAabb({x:5,y:1,z:5},{x:0,y:0,z:-1},{x:0,z:0,w:2,d:2,h:3},20);assert.equal(t,null);});
test('authoritative simulation runs at the 60 Hz combat target',()=>assert.equal(TICK_RATE,60));
test('survivability envelope requires six body hits and four head hits',()=>{assert.equal(MAX_HEALTH,150);assert.equal(bodyShotsToKill(),6);assert.equal(headShotsToKill(),4);});
test('pistol theoretical body-shot TTK is 0.85 seconds',()=>{assert.ok(Math.abs(theoreticalTtk(bodyShotsToKill())-.85)<1e-9);assert.ok(Math.abs(theoreticalTtk(headShotsToKill())-.51)<1e-9);});
test('health regeneration is delayed five seconds after damage',()=>{assert.equal(HEALTH_REGEN_DELAY,5);assert.ok(WEAPON.damage<MAX_HEALTH/3);});
