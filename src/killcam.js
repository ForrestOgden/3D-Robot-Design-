import { lerp } from './shared.js';

function lerpAngle(a, b, t) {
  let d = ((b - a + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
  return a + d * t;
}

function blendEntity(a, b, t) {
  if (!a) return b ? { ...b } : null;
  if (!b) return { ...a };
  return {
    ...a,
    x: lerp(a.x, b.x, t),
    y: lerp(a.y, b.y, t),
    z: lerp(a.z, b.z, t),
    yaw: lerpAngle(a.yaw, b.yaw, t),
    pitch: lerp(a.pitch, b.pitch, t),
    health: lerp(a.health, b.health, t),
    alive: t < .5 ? a.alive : b.alive,
    crouch: t < .5 ? a.crouch : b.crouch,
    sprint: t < .5 ? a.sprint : b.sprint
  };
}

export class SnapshotHistory {
  constructor(windowMs = 6500) {
    this.windowMs = windowMs;
    this.frames = [];
  }

  push(serverTime, players) {
    const entities = new Map();
    for (const p of players) entities.set(p.id, { ...p });
    this.frames.push({ time: serverTime, entities });
    const cutoff = serverTime - this.windowMs;
    while (this.frames.length > 2 && this.frames[1].time < cutoff) this.frames.shift();
  }

  sample(id, time) {
    if (!id || this.frames.length === 0) return null;
    if (time <= this.frames[0].time) return this.frames[0].entities.get(id) ? { ...this.frames[0].entities.get(id) } : null;
    const last = this.frames[this.frames.length - 1];
    if (time >= last.time) return last.entities.get(id) ? { ...last.entities.get(id) } : null;

    let lo = 0, hi = this.frames.length - 1;
    while (lo + 1 < hi) {
      const mid = (lo + hi) >> 1;
      if (this.frames[mid].time <= time) lo = mid;
      else hi = mid;
    }
    const a = this.frames[lo], b = this.frames[hi];
    const span = Math.max(1, b.time - a.time);
    const t = Math.max(0, Math.min(1, (time - a.time) / span));
    return blendEntity(a.entities.get(id), b.entities.get(id), t);
  }

  latest(id) {
    if (!this.frames.length) return null;
    const p = this.frames[this.frames.length - 1].entities.get(id);
    return p ? { ...p } : null;
  }
}
