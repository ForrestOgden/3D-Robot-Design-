export const TICK_RATE = 60;
export const SNAPSHOT_RATE = 30;
export const ARENA_HALF = 38;
export const PLAYER_RADIUS = 0.42;
export const STAND_HEIGHT = 1.78;
export const CROUCH_HEIGHT = 1.18;
export const EYE_OFFSET = 1.62;
export const GRAVITY = 24;
export const JUMP_SPEED = 8.2;
export const WALK_SPEED = 6.2;
export const SPRINT_SPEED = 9.1;
export const CROUCH_SPEED = 3.4;
export const MAX_HEALTH = 225;
export const HEALTH_REGEN_DELAY = 4.5;
export const HEALTH_REGEN_RATE = 30;
export const SPAWN_PROTECTION_SECONDS = 1.5;
export const RESPAWN_MS = 5200;
export const KILLCAM_REPLAY_MS = 3000;
export const MATCH_SECONDS = 8 * 60;

export const WEAPON = {
  name: 'Service Pistol',
  magSize: 15,
  reserve: 90,
  damage: 22,
  headDamage: 38,
  fireInterval: 0.17,
  reloadSeconds: 1.9,
  range: 120,
  spreadHip: 0.013,
  spreadAds: 0.0028,
  recoilPitch: 0.040,
  recoilYaw: 0.012,
  recoilRoll: 0.010
};

export const SPAWNS = [
  [-29, 0, -29], [29, 0, 29], [-29, 0, 29], [29, 0, -29],
  [0, 0, -30], [0, 0, 30], [-30, 0, 0], [30, 0, 0]
];

export const OBSTACLES = [
  { x: 0, z: 0, w: 7, d: 7, h: 3.2, type: 'tower' },
  { x: -17, z: -13, w: 9, d: 3, h: 2.6, type: 'container' },
  { x: 17, z: 13, w: 9, d: 3, h: 2.6, type: 'container' },
  { x: 16, z: -15, w: 5, d: 5, h: 2.2, type: 'cover' },
  { x: -16, z: 15, w: 5, d: 5, h: 2.2, type: 'cover' },
  { x: 0, z: -20, w: 12, d: 1.4, h: 1.15, type: 'barrier' },
  { x: 0, z: 20, w: 12, d: 1.4, h: 1.15, type: 'barrier' },
  { x: -22, z: 2, w: 1.4, d: 12, h: 1.15, type: 'barrier' },
  { x: 22, z: -2, w: 1.4, d: 12, h: 1.15, type: 'barrier' },
  { x: -9, z: 7, w: 3, d: 3, h: 1.4, type: 'crate' },
  { x: 10, z: -6, w: 3, d: 3, h: 1.4, type: 'crate' }
];

export function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
export function lerp(a, b, t) { return a + (b - a) * t; }
export function normalize2(x, z) {
  const l = Math.hypot(x, z);
  return l > 1e-6 ? [x / l, z / l] : [0, 0];
}
export function collideCircleAabb(x, z, radius, box) {
  const minX = box.x - box.w / 2, maxX = box.x + box.w / 2;
  const minZ = box.z - box.d / 2, maxZ = box.z + box.d / 2;
  const qx = clamp(x, minX, maxX), qz = clamp(z, minZ, maxZ);
  return (x - qx) ** 2 + (z - qz) ** 2 < radius ** 2;
}
export function resolveArenaMove(x, z, nx, nz, radius = PLAYER_RADIUS) {
  nx = clamp(nx, -ARENA_HALF + radius, ARENA_HALF - radius);
  nz = clamp(nz, -ARENA_HALF + radius, ARENA_HALF - radius);
  for (const o of OBSTACLES) {
    if (!collideCircleAabb(nx, nz, radius, o)) continue;
    const tryX = collideCircleAabb(nx, z, radius, o) ? x : nx;
    const tryZ = collideCircleAabb(x, nz, radius, o) ? z : nz;
    nx = tryX; nz = tryZ;
  }
  return [nx, nz];
}
export function rayAabb(origin, dir, box, maxDist = 999) {
  const mins = [box.x - box.w/2, 0, box.z - box.d/2];
  const maxs = [box.x + box.w/2, box.h, box.z + box.d/2];
  let tmin = 0, tmax = maxDist;
  const o = [origin.x, origin.y, origin.z], d = [dir.x, dir.y, dir.z];
  for (let i=0;i<3;i++) {
    if (Math.abs(d[i]) < 1e-8) { if (o[i] < mins[i] || o[i] > maxs[i]) return null; continue; }
    let t1=(mins[i]-o[i])/d[i], t2=(maxs[i]-o[i])/d[i];
    if (t1>t2) [t1,t2]=[t2,t1];
    tmin=Math.max(tmin,t1); tmax=Math.min(tmax,t2);
    if (tmin>tmax) return null;
  }
  return tmin;
}
export function bodyShotsToKill(damage = WEAPON.damage, health = MAX_HEALTH) {
  return Math.ceil(health / damage);
}
export function headShotsToKill(damage = WEAPON.headDamage, health = MAX_HEALTH) {
  return Math.ceil(health / damage);
}
export function theoreticalTtk(shots, interval = WEAPON.fireInterval) {
  return Math.max(0, shots - 1) * interval;
}
