import * as THREE from 'three';
import { lerp, WEAPON } from './shared.js';

function expDamp(current, target, lambda, dt) {
  return lerp(current, target, 1 - Math.exp(-lambda * dt));
}

function findMagazine(root) {
  let found = null;
  root?.traverse(o => {
    if (!found && /(^|[_\-.\s])(mag|magazine|clip)([_\-.\s]|$)/i.test(o.name || '')) found = o;
  });
  return found;
}

export function createViewModel(camera, weaponSource = null) {
  const root = new THREE.Group();
  root.name = 'viewmodel-root';
  camera.add(root);

  const weaponAnchor = new THREE.Group();
  root.add(weaponAnchor);

  const gunMetal = new THREE.MeshStandardMaterial({ color: 0x24292c, metalness: .78, roughness: .26 });
  const gloveMat = new THREE.MeshStandardMaterial({ color: 0x171a19, metalness: .04, roughness: .87 });
  const sleeveMat = new THREE.MeshStandardMaterial({ color: 0x343b39, metalness: .02, roughness: .94 });

  let weapon;
  let weaponScale = 1;
  let authoredMuzzle = null;
  let weaponMixer = null;
  const weaponActions = new Map();
  if (weaponSource) {
    weapon = weaponSource.clone(true);
    // Normalize any audited sidearm to a ~29 cm presentation length instead of trusting author scale.
    const initialBox = new THREE.Box3().setFromObject(weapon);
    const initialSize = initialBox.getSize(new THREE.Vector3());
    const authoredLength = Math.max(initialSize.x, initialSize.z, .001);
    weaponScale = .29 / authoredLength;
    weapon.scale.setScalar(weaponScale);
    weapon.rotation.set(0, Math.PI, 0);
    weapon.position.set(.015, -.075, .075);
    if (weaponSource._assetMeta?.muzzle) authoredMuzzle = new THREE.Vector3(...weaponSource._assetMeta.muzzle);
    weapon.traverse(x => {
      if (x.isMesh) {
        x.castShadow = false;
        x.receiveShadow = false;
        x.frustumCulled = false;
        x.renderOrder = 3;
      }
    });
    if (weaponSource._clips?.length) {
      weaponMixer = new THREE.AnimationMixer(weapon);
      for (const clip of weaponSource._clips) {
        const action = weaponMixer.clipAction(clip);
        action.setLoop(THREE.LoopOnce, 1);
        action.clampWhenFinished = true;
        weaponActions.set(clip.name.toLowerCase(), action);
      }
    }
  } else {
    weapon = new THREE.Mesh(new THREE.BoxGeometry(.13, .16, .44), gunMetal);
    weapon.position.z = .05;
  }
  weaponAnchor.add(weapon);

  // Procedural sleeves and gloves keep the viewmodel visually grounded even when the pistol asset has no arms.
  const rightForearm = new THREE.Mesh(new THREE.CapsuleGeometry(.085, .52, 5, 10), sleeveMat);
  rightForearm.position.set(.30, -.48, .04);
  rightForearm.rotation.set(-1.05, 0, -.18);
  root.add(rightForearm);
  const rightGlove = new THREE.Mesh(new THREE.BoxGeometry(.16, .14, .19), gloveMat);
  rightGlove.position.set(.23, -.27, -.35);
  rightGlove.rotation.set(-.2, .12, -.08);
  root.add(rightGlove);

  const leftArm = new THREE.Group();
  const leftForearm = new THREE.Mesh(new THREE.CapsuleGeometry(.083, .52, 5, 10), sleeveMat);
  leftForearm.position.y = -.23;
  leftForearm.rotation.z = -.08;
  leftArm.add(leftForearm);
  const leftGlove = new THREE.Mesh(new THREE.BoxGeometry(.16, .14, .19), gloveMat);
  leftGlove.position.set(0, -.51, -.015);
  leftArm.add(leftGlove);
  leftArm.position.set(-.42, -.5, -.34);
  leftArm.rotation.set(-.7, -.18, .8);
  leftArm.visible = false;
  root.add(leftArm);

  const fallbackMagazine = new THREE.Mesh(new THREE.BoxGeometry(.038, .13, .045), gunMetal);
  fallbackMagazine.position.set(.025, -.10, -.015);
  fallbackMagazine.visible = false;
  weaponAnchor.add(fallbackMagazine);
  const embeddedMagazine = findMagazine(weapon);

  // Place muzzle FX from the audited model's published connector rather than a hard-coded legacy offset.
  const muzzlePosition = authoredMuzzle
    ? authoredMuzzle.clone().multiplyScalar(weaponScale).applyAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI).add(weapon.position)
    : new THREE.Vector3(.02, .015, -.22);
  const muzzleLight = new THREE.PointLight(0xffad62, 0, 3.2, 2);
  muzzleLight.position.copy(muzzlePosition);
  root.add(muzzleLight);
  const muzzleFlash = new THREE.Mesh(
    new THREE.ConeGeometry(.045, .15, 8, 1, true),
    new THREE.MeshBasicMaterial({ color: 0xffd094, transparent: true, opacity: .92, blending: THREE.AdditiveBlending, depthWrite: false })
  );
  muzzleFlash.rotation.x = -Math.PI / 2;
  muzzleFlash.position.copy(muzzlePosition).add(new THREE.Vector3(0, 0, -.055));
  muzzleFlash.visible = false;
  root.add(muzzleFlash);

  const state = {
    recoilPitch: 0, recoilYaw: 0, recoilRoll: 0,
    weaponKick: 0, weaponLift: 0, flash: 0,
    reloadStart: 0, reloadDuration: WEAPON.reloadSeconds,
    reloading: false, reloadProgress: 0,
    magClosePlayed: false, slideCloseAt: 0, slideClosePlayed: false
  };

  function playAssetClip(name, speed = 1) {
    const action = weaponActions.get(name);
    if (!action) return false;
    const counterpart = name.endsWith('-open') ? weaponActions.get(name.replace('-open', '-close')) : name.endsWith('-close') ? weaponActions.get(name.replace('-close', '-open')) : null;
    counterpart?.stop();
    action.stop();
    action.reset();
    action.timeScale = speed;
    action.play();
    return true;
  }

  function kick(ads = false) {
    state.recoilPitch += WEAPON.recoilPitch * (ads ? .62 : 1);
    state.recoilYaw += (Math.random() - .5) * WEAPON.recoilYaw * (ads ? .65 : 1);
    state.recoilRoll += (Math.random() - .5) * WEAPON.recoilRoll;
    state.weaponKick = Math.min(.12, state.weaponKick + .07);
    state.weaponLift = Math.min(.07, state.weaponLift + .035);
    state.flash = .045;
    if (playAssetClip('slide-open', 5.5)) {
      state.slideCloseAt = performance.now() + 58;
      state.slideClosePlayed = false;
    }
    muzzleLight.intensity = 22;
    muzzleFlash.visible = true;
    muzzleFlash.rotation.z = Math.random() * Math.PI;
    muzzleFlash.scale.setScalar(.85 + Math.random() * .45);
  }

  function startReload(duration = WEAPON.reloadSeconds) {
    if (state.reloading) return;
    state.reloading = true;
    state.reloadStart = performance.now();
    state.reloadDuration = Math.max(.4, duration);
    state.reloadProgress = 0;
    state.magClosePlayed = false;
    playAssetClip('magazine-open', 1.35);
  }

  function updateReload() {
    if (!state.reloading) {
      leftArm.visible = false;
      fallbackMagazine.visible = false;
      if (embeddedMagazine) embeddedMagazine.visible = true;
      return { roll: 0, pitch: 0, x: 0, y: 0, z: 0 };
    }

    const t = Math.min(1, (performance.now() - state.reloadStart) / (state.reloadDuration * 1000));
    state.reloadProgress = t;
    leftArm.visible = t > .19 && t < .89;

    // Pistol drops into the workspace, magazine clears the well, replacement magazine seats, then the weapon settles.
    let roll = 0, pitch = 0, x = 0, y = 0, z = 0;
    if (t < .18) {
      const q = t / .18;
      roll = -.38 * q; pitch = .22 * q; x = -.07 * q; y = -.19 * q; z = .09 * q;
    } else if (t < .72) {
      roll = -.38; pitch = .22; x = -.07; y = -.19; z = .09;
    } else {
      const q = (t - .72) / .28;
      const s = 1 - q;
      roll = -.38 * s; pitch = .22 * s; x = -.07 * s; y = -.19 * s; z = .09 * s;
    }

    const assetHasMagazineClips = weaponActions.has('magazine-open') && weaponActions.has('magazine-close');
    if (assetHasMagazineClips) {
      fallbackMagazine.visible = false;
      if (t >= .50 && !state.magClosePlayed) {
        state.magClosePlayed = true;
        playAssetClip('magazine-close', 1.35);
      }
    } else {
      if (embeddedMagazine) embeddedMagazine.visible = !(t > .23 && t < .70);
      fallbackMagazine.visible = t > .22 && t < .72;
      if (fallbackMagazine.visible) {
        if (t < .43) {
          const q = (t - .22) / .21;
          fallbackMagazine.position.set(.025 - .01 * q, -.10 - .24 * q, -.015 + .05 * q);
          fallbackMagazine.rotation.z = -.16 * q;
        } else {
          const q = Math.min(1, (t - .43) / .29);
          fallbackMagazine.position.set(-.10 + .125 * q, -.34 + .24 * q, .035 - .05 * q);
          fallbackMagazine.rotation.z = -.22 * (1 - q);
        }
      }
    }
    leftArm.position.x = -.50 + Math.sin(Math.min(1, Math.max(0, (t - .18) / .55)) * Math.PI) * .28;
    leftArm.position.y = -.54 + Math.sin(Math.min(1, Math.max(0, (t - .18) / .58)) * Math.PI) * .16;
    leftArm.rotation.z = .82 - Math.sin(Math.min(1, Math.max(0, (t - .18) / .60)) * Math.PI) * .38;

    if (t >= 1) {
      state.reloading = false;
      state.reloadProgress = 1;
      leftArm.visible = false;
      fallbackMagazine.visible = false;
      if (embeddedMagazine) embeddedMagazine.visible = true;
    }
    return { roll, pitch, x, y, z };
  }

  function update(dt, { ads = false, sprint = false, bob = 0, side = 0, alive = true } = {}) {
    state.recoilPitch = expDamp(state.recoilPitch, 0, 9.5, dt);
    state.recoilYaw = expDamp(state.recoilYaw, 0, 11, dt);
    state.recoilRoll = expDamp(state.recoilRoll, 0, 12, dt);
    state.weaponKick = expDamp(state.weaponKick, 0, 17, dt);
    state.weaponLift = expDamp(state.weaponLift, 0, 15, dt);
    state.flash = Math.max(0, state.flash - dt);
    weaponMixer?.update(dt);
    if (state.slideCloseAt && !state.slideClosePlayed && performance.now() >= state.slideCloseAt) {
      state.slideClosePlayed = true;
      state.slideCloseAt = 0;
      playAssetClip('slide-close', 5.5);
    }
    if (state.flash <= 0) {
      muzzleLight.intensity = 0;
      muzzleFlash.visible = false;
    }

    const reload = updateReload();
    const sprintDrop = sprint && !ads && !state.reloading ? .10 : 0;
    const baseX = ads ? .035 : .36;
    const baseY = ads ? -.28 : -.34;
    const baseZ = ads ? -.48 : -.62;

    root.position.x = expDamp(root.position.x, baseX + reload.x + side * .18, 15, dt);
    root.position.y = expDamp(root.position.y, baseY + bob * .34 - sprintDrop + reload.y + state.weaponLift, 15, dt);
    root.position.z = expDamp(root.position.z, baseZ + reload.z + state.weaponKick, 15, dt);
    root.rotation.x = expDamp(root.rotation.x, reload.pitch - state.recoilPitch * .72, 18, dt);
    root.rotation.y = expDamp(root.rotation.y, state.recoilYaw * .8, 18, dt);
    root.rotation.z = expDamp(root.rotation.z, reload.roll + state.recoilRoll + (sprint ? -.11 : 0), 14, dt);
    root.visible = alive;

    return {
      cameraPitch: state.recoilPitch * .42,
      cameraYaw: state.recoilYaw * .32,
      cameraRoll: state.recoilRoll * .18,
      reloading: state.reloading,
      reloadProgress: state.reloadProgress
    };
  }

  return {
    root,
    weapon,
    kick,
    startReload,
    update,
    get reloading() { return state.reloading; },
    get reloadProgress() { return state.reloadProgress; }
  };
}
