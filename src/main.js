import './styles.css';
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { GTAOPass } from 'three/addons/postprocessing/GTAOPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { io } from 'socket.io-client';
import { loadAssetManifest, buildArena } from './arena.js';
import { createOperator, updateOperator } from './operator.js';
import { createViewModel } from './viewmodel.js';
import { SnapshotHistory } from './killcam.js';
import {
  EYE_OFFSET, WALK_SPEED, SPRINT_SPEED, CROUCH_SPEED, GRAVITY, JUMP_SPEED,
  PLAYER_RADIUS, MAX_HEALTH, KILLCAM_REPLAY_MS, WEAPON,
  resolveArenaMove, clamp, lerp
} from './shared.js';

const $ = id => document.getElementById(id);
const ui = {
  menu: $('menu'), hud: $('hud'), play: $('playButton'), name: $('nameInput'), sens: $('sensitivity'), fov: $('fov'),
  health: $('health'), maxHealth: $('maxHealth'), healthBar: $('healthBar'), healthPanel: $('healthPanel'),
  ammo: $('ammo'), reserve: $('reserve'), timer: $('matchTimer'), score: $('scoreLine'), ping: $('ping'),
  feed: $('killfeed'), hit: $('hitmarker'), hitDamage: $('hitDamage'), damage: $('damageVignette'),
  respawn: $('respawn'), asset: $('assetStatus'), crosshair: $('crosshair'),
  reloadIndicator: $('reloadIndicator'), reloadBar: $('reloadBar'), deathBars: $('deathBars'),
  killcam: $('killcam'), killcamKiller: $('killcamKiller'), killcamHealth: $('killcamHealth'), killcamWeapon: $('killcamWeapon')
};

const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.04;
document.querySelector('#app').appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x737d80);
scene.fog = new THREE.FogExp2(0x707a7c, .0085);
const camera = new THREE.PerspectiveCamera(92, innerWidth / innerHeight, .045, 260);
camera.rotation.order = 'YXZ';
scene.add(camera);

const hemi = new THREE.HemisphereLight(0xc7dcdf, 0x342f29, .68);
scene.add(hemi);
const sun = new THREE.DirectionalLight(0xfff0d4, 4.2);
sun.position.set(-24, 38, -18);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.left = -60;
sun.shadow.camera.right = 60;
sun.shadow.camera.top = 60;
sun.shadow.camera.bottom = -60;
sun.shadow.camera.near = 1;
sun.shadow.camera.far = 115;
sun.shadow.bias = -.00018;
sun.shadow.normalBias = .018;
scene.add(sun);

const composer = new EffectComposer(renderer);
const renderPass = new RenderPass(scene, camera);
composer.addPass(renderPass);
const gtaoPass = new GTAOPass(scene, camera, innerWidth, innerHeight);
gtaoPass.output = GTAOPass.OUTPUT.Default;
gtaoPass.blendIntensity = .74;
gtaoPass.updateGtaoMaterial({ radius: .23, distanceExponent: 1.8, thickness: 1.25, distanceFallOff: 1, scale: 1, samples: 16 });
gtaoPass.updatePdMaterial({ radius: 6, rings: 2, samples: 16, lumaPhi: 8, depthPhi: 2, normalPhi: 3 });
composer.addPass(gtaoPass);
const bloomPass = new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), .13, .48, .88);
composer.addPass(bloomPass);
composer.addPass(new OutputPass());

const manifest = await loadAssetManifest();
const arena = await buildArena(scene, manifest);
const models = arena.models || {};
const assetModelCount = Object.keys(manifest?.models || {}).length;
const gameplayModelCount = Object.keys(manifest?.externalModels || {}).length;
const assetMaterialCount = Object.keys(manifest?.materials || {}).length;
ui.asset.textContent = manifest
  ? `HQ pack ready · ${assetMaterialCount} Poly Haven PBR materials · ${assetModelCount} environment models · ${gameplayModelCount} audited gameplay models · HDR environment`
  : 'HQ asset pack not installed — direct CC0 gameplay assets + fallback environment materials active. Run npm run assets.';

const viewmodel = createViewModel(camera, models.service_pistol || null);
const socket = io({ transports: ['websocket', 'polling'] });
const history = new SnapshotHistory(7000);

let myId = null;
let matchEndsAt = Date.now() + 480000;
let lastSnapshotWall = performance.now();
let snapshotDt = 1 / 30;
let yaw = 0, pitch = 0, ads = false, seq = 0, lastFireLocal = 0, alive = true;
let deathState = null;
let hiddenKillcamOperator = null;
let hitTimer = 0, hitDamageTimer = 0, damageTimer = 0;
const remotes = new Map();
const keys = new Set();
const me = {
  x: 0, y: 0, z: 0, vy: 0,
  health: MAX_HEALTH, maxHealth: MAX_HEALTH,
  ammo: WEAPON.magSize, reserve: WEAPON.reserve,
  crouch: false, sprint: false, kills: 0, deaths: 0
};

function updateHealthUI() {
  const max = me.maxHealth || MAX_HEALTH;
  const ratio = clamp(me.health / max, 0, 1);
  ui.health.textContent = String(Math.max(0, Math.ceil(me.health)));
  ui.maxHealth.textContent = String(max);
  ui.healthBar.style.transform = `scaleX(${ratio})`;
  ui.healthPanel.classList.toggle('low', ratio <= .32);
}
updateHealthUI();

function showHitmarker({ head = false, killed = false, damage = 0 }) {
  clearTimeout(hitTimer);
  clearTimeout(hitDamageTimer);
  ui.hit.classList.remove('show', 'head', 'kill');
  void ui.hit.offsetWidth;
  if (head) ui.hit.classList.add('head');
  if (killed) ui.hit.classList.add('kill');
  ui.hit.classList.add('show');
  ui.hitDamage.textContent = `${killed ? 'ELIM ' : ''}+${Math.round(damage)}`;
  ui.hitDamage.classList.add('show');
  hitTimer = setTimeout(() => ui.hit.classList.remove('show'), killed ? 150 : 105);
  hitDamageTimer = setTimeout(() => ui.hitDamage.classList.remove('show'), 300);
}

function flashDamage() {
  clearTimeout(damageTimer);
  ui.damage.classList.add('active');
  damageTimer = setTimeout(() => ui.damage.classList.remove('active'), 150);
}

function restoreHiddenKiller() {
  if (hiddenKillcamOperator) hiddenKillcamOperator.group.visible = true;
  hiddenKillcamOperator = null;
}

function beginDeath(d) {
  restoreHiddenKiller();
  deathState = {
    ...d,
    receivedAt: performance.now(),
    collapseYaw: yaw,
    collapsePitch: pitch,
    collapseRoll: (Math.random() > .5 ? 1 : -1) * (.18 + Math.random() * .12)
  };
  alive = false;
  ads = false;
  ui.deathBars.classList.remove('hidden');
  ui.respawn.classList.remove('hidden');
  ui.crosshair.style.opacity = '0';
  viewmodel.root.visible = false;
}

function finishDeathState() {
  restoreHiddenKiller();
  deathState = null;
  ui.killcam.classList.add('hidden');
  ui.deathBars.classList.add('hidden');
  ui.respawn.classList.add('hidden');
  ui.crosshair.style.opacity = '1';
  viewmodel.root.visible = true;
}

function shoot() {
  if (!alive || viewmodel.reloading || document.pointerLockElement !== renderer.domElement) return;
  const now = performance.now() / 1000;
  if (now - lastFireLocal < WEAPON.fireInterval || me.ammo <= 0) return;
  lastFireLocal = now;
  me.ammo--;
  ui.ammo.textContent = String(me.ammo);
  viewmodel.kick(ads);
  socket.emit('fire', { ads });
}

renderer.domElement.addEventListener('mousedown', e => {
  if (e.button === 0) shoot();
  if (e.button === 2 && alive && !viewmodel.reloading) ads = true;
});
renderer.domElement.addEventListener('mouseup', e => { if (e.button === 2) ads = false; });
renderer.domElement.addEventListener('contextmenu', e => e.preventDefault());

addEventListener('keydown', e => {
  keys.add(e.code);
  if (e.code === 'KeyR' && alive && !viewmodel.reloading) socket.emit('reload');
  if (e.code === 'KeyC' || e.code === 'Space') e.preventDefault();
});
addEventListener('keyup', e => keys.delete(e.code));
addEventListener('blur', () => keys.clear());

addEventListener('mousemove', e => {
  if (document.pointerLockElement !== renderer.domElement || !alive) return;
  const s = Number(ui.sens.value) * .0022;
  yaw -= e.movementX * s;
  pitch = clamp(pitch - e.movementY * s, -1.48, 1.48);
});

ui.fov.addEventListener('input', () => { if (alive) camera.fov = Number(ui.fov.value); });
ui.play.addEventListener('click', () => {
  socket.emit('join', { name: ui.name.value });
  renderer.domElement.requestPointerLock();
  ui.menu.classList.add('hidden');
  ui.hud.classList.remove('hidden');
});
document.addEventListener('pointerlockchange', () => {
  if (document.pointerLockElement !== renderer.domElement && !ui.hud.classList.contains('hidden')) ui.menu.classList.remove('hidden');
  else if (document.pointerLockElement === renderer.domElement) ui.menu.classList.add('hidden');
});

socket.on('welcome', d => {
  myId = d.id;
  matchEndsAt = d.matchEndsAt;
  me.maxHealth = d.maxHealth || MAX_HEALTH;
  updateHealthUI();
});

socket.on('snapshot', d => {
  const nowWall = performance.now();
  snapshotDt = clamp((nowWall - lastSnapshotWall) / 1000, .016, .12);
  lastSnapshotWall = nowWall;
  matchEndsAt = d.matchEndsAt;

  for (const p of d.players) p._snap = d.serverTime;
  history.push(d.serverTime, d.players);

  let self = null;
  const seen = new Set();
  for (const p of d.players) {
    if (p.id === myId) { self = p; continue; }
    seen.add(p.id);
    let r = remotes.get(p.id);
    if (!r) {
      r = createOperator(scene, p, {
        stand: models.operator_recon_stand || null,
        crouch: models.operator_recon_crouch || null,
        run: models.operator_recon_crouch || null
      });
      remotes.set(p.id, r);
    }
    r.snapshot = p;
  }
  for (const [id, r] of remotes) {
    if (!seen.has(id)) {
      if (hiddenKillcamOperator === r) hiddenKillcamOperator = null;
      scene.remove(r.group);
      remotes.delete(id);
    }
  }

  if (self) {
    const wasAlive = alive;
    me.health = self.health;
    me.maxHealth = self.maxHealth || MAX_HEALTH;
    me.ammo = self.ammo;
    me.reserve = self.reserve;
    me.kills = self.kills;
    me.deaths = self.deaths;
    alive = self.alive;
    updateHealthUI();
    ui.ammo.textContent = String(me.ammo);
    ui.reserve.textContent = String(me.reserve);
    ui.score.textContent = `${self.kills} K — ${self.deaths} D`;

    if (Math.hypot(me.x - self.x, me.z - self.z) > 4) {
      me.x = self.x; me.y = self.y; me.z = self.z; me.vy = 0;
    }

    if (!wasAlive && alive) finishDeathState();
    if (!alive) {
      const remaining = Math.max(0, (self.respawnAt - Date.now()) / 1000);
      ui.respawn.classList.remove('hidden');
      ui.respawn.textContent = `RESPAWN ${remaining.toFixed(1)}s`;
    }
  }
});

socket.on('hit', d => showHitmarker(d));
socket.on('damage', d => {
  me.health = d.health;
  updateHealthUI();
  flashDamage();
});
socket.on('reloadStart', d => {
  viewmodel.startReload(d.duration);
  ui.reloadIndicator.classList.remove('hidden');
});
socket.on('death', d => beginDeath(d));

socket.on('shot', s => {
  if (s.id === myId) return;
  const start = new THREE.Vector3(s.origin.x, s.origin.y, s.origin.z);
  const endDistance = s.hit ? start.distanceTo(new THREE.Vector3(s.hit.x, s.hit.y, s.hit.z)) : 10;
  const end = new THREE.Vector3(
    s.origin.x + s.dir.x * Math.min(10, endDistance),
    s.origin.y + s.dir.y * Math.min(10, endDistance),
    s.origin.z + s.dir.z * Math.min(10, endDistance)
  );
  const geo = new THREE.BufferGeometry().setFromPoints([start, end]);
  const mat = new THREE.LineBasicMaterial({ color: 0xffd5a1, transparent: true, opacity: .5 });
  const line = new THREE.Line(geo, mat);
  scene.add(line);
  setTimeout(() => { scene.remove(line); geo.dispose(); mat.dispose(); }, 48);
});

socket.on('kill', k => {
  const el = document.createElement('div');
  el.textContent = `${k.killer}  ›  ${k.victim}${k.headshot ? '  HEADSHOT' : ''}`;
  if (k.headshot) el.classList.add('headshot');
  ui.feed.prepend(el);
  setTimeout(() => el.remove(), 3900);
});
socket.on('matchReset', d => { matchEndsAt = d.matchEndsAt; });

setInterval(() => {
  const started = performance.now();
  socket.timeout(1000).emit('ping-test', err => {
    if (!err) ui.ping.textContent = `${Math.round(performance.now() - started)} ms`;
  });
}, 2000);

function localMove(dt) {
  if (!alive) return;
  const forward = (keys.has('KeyW') ? 1 : 0) - (keys.has('KeyS') ? 1 : 0);
  const right = (keys.has('KeyD') ? 1 : 0) - (keys.has('KeyA') ? 1 : 0);
  const length = Math.hypot(forward, right) || 1;
  const f = forward / length, r = right / length;

  me.crouch = keys.has('ControlLeft') || keys.has('ControlRight') || keys.has('KeyC');
  me.sprint = (keys.has('ShiftLeft') || keys.has('ShiftRight')) && !me.crouch && f > 0 && !ads;
  const speed = me.crouch ? CROUCH_SPEED : me.sprint ? SPRINT_SPEED : WALK_SPEED;
  const sy = Math.sin(yaw), cy = Math.cos(yaw);
  const dx = (-sy * f + cy * r) * speed * dt;
  const dz = (-cy * f - sy * r) * speed * dt;
  [me.x, me.z] = resolveArenaMove(me.x, me.z, me.x + dx, me.z + dz, PLAYER_RADIUS);

  const jumpNow = keys.has('Space') && me.y <= .001 && !me.crouch;
  if (jumpNow) { me.vy = JUMP_SPEED; keys.delete('Space'); }
  me.vy -= GRAVITY * dt;
  me.y += me.vy * dt;
  if (me.y < 0) { me.y = 0; me.vy = 0; }

  socket.emit('input', { f, r, jump: jumpNow, crouch: me.crouch, sprint: me.sprint, yaw, pitch, seq: ++seq });

  const moving = Math.hypot(f, r) > 0;
  const t = performance.now() / 1000;
  const bobFreq = me.sprint ? 14.2 : me.crouch ? 7.3 : 10.6;
  const bobAmp = me.sprint ? .029 : me.crouch ? .011 : .019;
  const bob = moving && me.y <= .001 ? Math.sin(t * bobFreq) * bobAmp : 0;
  const side = moving ? Math.cos(t * bobFreq * .5) * (me.sprint ? .014 : .01) : 0;

  const recoil = viewmodel.update(dt, { ads, sprint: me.sprint, bob, side, alive: true });
  const eye = EYE_OFFSET * (me.crouch ? .72 : 1);
  camera.position.set(me.x, me.y + eye + bob, me.z);
  camera.rotation.y = yaw + recoil.cameraYaw;
  camera.rotation.x = pitch + recoil.cameraPitch + side * .16;
  camera.rotation.z = recoil.cameraRoll + side * .14;

  const targetFov = Number(ui.fov.value) + (me.sprint ? 4.5 : 0) - (ads ? 11.5 : 0);
  camera.fov = lerp(camera.fov, targetFov, 1 - Math.exp(-dt * 10));
  camera.updateProjectionMatrix();
  ui.crosshair.style.opacity = ads ? '.35' : '1';
}

function renderDeathCamera(dt) {
  if (!deathState) {
    camera.position.set(me.x, me.y + EYE_OFFSET * .72, me.z);
    return;
  }

  const elapsed = performance.now() - deathState.receivedAt;
  const respawnRemaining = Math.max(0, (deathState.respawnAt - Date.now()) / 1000);
  ui.respawn.textContent = `RESPAWN ${respawnRemaining.toFixed(1)}s`;

  if (elapsed < 360) {
    restoreHiddenKiller();
    ui.killcam.classList.add('hidden');
    const q = elapsed / 360;
    const eased = 1 - (1 - q) ** 3;
    camera.position.set(me.x, me.y + EYE_OFFSET - eased * .72, me.z);
    camera.rotation.y = deathState.collapseYaw + eased * .06 * Math.sign(deathState.collapseRoll);
    camera.rotation.x = deathState.collapsePitch - eased * .24;
    camera.rotation.z = deathState.collapseRoll * eased;
    camera.fov = lerp(camera.fov, 96, 1 - Math.exp(-dt * 7));
    camera.updateProjectionMatrix();
    return;
  }

  const replayDuration = Math.max(1200, KILLCAM_REPLAY_MS - 360);
  if (elapsed < KILLCAM_REPLAY_MS && deathState.killerId) {
    ui.killcam.classList.remove('hidden');
    ui.killcamKiller.textContent = deathState.killer || 'OPERATOR';
    ui.killcamWeapon.textContent = deathState.weapon || WEAPON.name;
    const q = clamp((elapsed - 360) / replayDuration, 0, 1);
    const replayTime = deathState.serverTime - 1450 + q * 1550;
    const attacker = history.sample(deathState.killerId, replayTime) || history.latest(deathState.killerId);
    if (attacker) {
      ui.killcamHealth.textContent = String(Math.max(0, Math.ceil(attacker.health ?? deathState.killerHealth ?? 0)));
      const r = remotes.get(deathState.killerId);
      if (r) {
        if (hiddenKillcamOperator && hiddenKillcamOperator !== r) hiddenKillcamOperator.group.visible = true;
        hiddenKillcamOperator = r;
        r.group.visible = false;
      }
      const eye = EYE_OFFSET * (attacker.crouch ? .72 : 1);
      camera.position.set(attacker.x, attacker.y + eye, attacker.z);
      camera.rotation.y = attacker.yaw;
      camera.rotation.x = attacker.pitch;
      camera.rotation.z = 0;
      camera.fov = lerp(camera.fov, 88, 1 - Math.exp(-dt * 9));
      camera.updateProjectionMatrix();
      return;
    }
  }

  ui.killcam.classList.add('hidden');
  restoreHiddenKiller();
  const attacker = history.latest(deathState.killerId);
  if (attacker) {
    const sy = Math.sin(attacker.yaw), cy = Math.cos(attacker.yaw);
    const target = new THREE.Vector3(attacker.x, attacker.y + 1.35, attacker.z);
    camera.position.set(attacker.x + sy * 3.1, attacker.y + 2.15, attacker.z + cy * 3.1);
    camera.lookAt(target);
    camera.rotation.z = 0;
    camera.fov = lerp(camera.fov, 82, 1 - Math.exp(-dt * 6));
    camera.updateProjectionMatrix();
  } else {
    camera.position.set(me.x + 2.4, me.y + 2.2, me.z + 2.4);
    camera.lookAt(me.x, me.y + .55, me.z);
  }
}

let prev = performance.now();
function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(.04, (now - prev) / 1000);
  prev = now;

  if (alive) localMove(dt);
  else renderDeathCamera(dt);

  for (const r of remotes.values()) {
    if (r.snapshot) updateOperator(r, r.snapshot, dt, snapshotDt);
  }
  if (hiddenKillcamOperator && deathState && performance.now() - deathState.receivedAt < KILLCAM_REPLAY_MS) {
    hiddenKillcamOperator.group.visible = false;
  }

  if (viewmodel.reloading) {
    ui.reloadIndicator.classList.remove('hidden');
    ui.reloadBar.style.width = `${Math.round(viewmodel.reloadProgress * 100)}%`;
  } else {
    ui.reloadIndicator.classList.add('hidden');
    ui.reloadBar.style.width = '0%';
  }

  const sec = Math.max(0, Math.ceil((matchEndsAt - Date.now()) / 1000));
  ui.timer.textContent = `${String((sec / 60) | 0).padStart(2, '0')}:${String(sec % 60).padStart(2, '0')}`;
  composer.render(dt);
}
requestAnimationFrame(frame);

addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
  composer.setSize(innerWidth, innerHeight);
  gtaoPass.setSize(innerWidth, innerHeight);
});
