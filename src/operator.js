import * as THREE from 'three';

const fallbackFabric = new THREE.MeshStandardMaterial({ color: 0x273033, roughness: .9, metalness: .02 });
const fallbackArmor = new THREE.MeshStandardMaterial({ color: 0x343c3e, roughness: .5, metalness: .2 });
const fallbackRubber = new THREE.MeshStandardMaterial({ color: 0x111516, roughness: .76, metalness: .04 });

function prep(root) {
  root.traverse(o => {
    if (!o.isMesh) return;
    o.castShadow = true;
    o.receiveShadow = true;
    o.frustumCulled = true;
  });
  return root;
}

function clonePose(source) {
  if (!source) return null;
  const clone = prep(source.clone(true));
  // 3DAssets.dev tactical operators face +Z. Arena Zero yaw=0 aims down -Z.
  clone.rotation.y = Math.PI;
  return clone;
}

function fallbackOperator() {
  const root = new THREE.Group();
  const torso = new THREE.Mesh(new THREE.CapsuleGeometry(.32, .5, 6, 12), fallbackFabric);
  torso.position.y = 1.17;
  torso.scale.set(1.05, .95, .78);
  root.add(torso);
  const vest = new THREE.Mesh(new THREE.BoxGeometry(.65, .56, .38), fallbackArmor);
  vest.position.set(0, 1.27, -.03);
  root.add(vest);
  const head = new THREE.Mesh(new THREE.SphereGeometry(.25, 18, 14), fallbackRubber);
  head.position.y = 1.75;
  root.add(head);
  const helmet = new THREE.Mesh(new THREE.SphereGeometry(.29, 18, 12, 0, Math.PI * 2, 0, Math.PI * .63), fallbackArmor);
  helmet.position.y = 1.81;
  root.add(helmet);
  for (const x of [-.18, .18]) {
    const leg = new THREE.Mesh(new THREE.CapsuleGeometry(.115, .64, 5, 10), fallbackFabric);
    leg.position.set(x, .55, 0);
    root.add(leg);
  }
  for (const x of [-.43, .43]) {
    const arm = new THREE.Mesh(new THREE.CapsuleGeometry(.095, .54, 5, 10), fallbackFabric);
    arm.position.set(x, 1.22, -.16);
    arm.rotation.x = -1.05;
    root.add(arm);
  }
  prep(root);
  return root;
}

export function createOperator(scene, p, poseSources = null) {
  const group = new THREE.Group();
  const bodyRoot = new THREE.Group();
  group.add(bodyRoot);

  const sources = poseSources || null;
  const poses = {
    stand: clonePose(sources?.stand),
    crouch: clonePose(sources?.crouch),
    run: clonePose(sources?.run)
  };
  const external = !!poses.stand;

  if (external) {
    for (const pose of Object.values(poses)) if (pose) bodyRoot.add(pose);
    poses.stand.visible = true;
    if (poses.crouch) poses.crouch.visible = false;
    if (poses.run) poses.run.visible = false;
  } else {
    poses.stand = fallbackOperator();
    bodyRoot.add(poses.stand);
  }

  scene.add(group);
  return {
    group,
    bodyRoot,
    poses,
    external,
    activePose: 'stand',
    target: new THREE.Vector3(),
    yaw: p.yaw || 0,
    last: { ...p },
    lastSnapId: null,
    motionSpeed: 0,
    lastSnapPosition: new THREE.Vector3(p.x, p.y, p.z),
    wasAlive: p.alive !== false,
    deathStart: 0,
    deathSide: Math.random() > .5 ? 1 : -1,
    deathPitch: .55 + Math.random() * .35
  };
}

function lerpAngle(a, b, t) {
  let d = ((b - a + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
  return a + d * t;
}

function setPose(r, name) {
  if (!r.poses[name]) name = 'stand';
  if (r.activePose === name) return;
  for (const [key, pose] of Object.entries(r.poses)) if (pose) pose.visible = key === name;
  r.activePose = name;
}

export function updateOperator(r, p, dt, snapshotDt = 1 / 30) {
  const alpha = 1 - Math.exp(-dt * 15);
  r.target.set(p.x, p.y, p.z);
  r.group.position.lerp(r.target, alpha);
  r.yaw = lerpAngle(r.yaw, p.yaw, alpha);
  r.group.rotation.y = r.yaw;

  if (r.wasAlive && !p.alive) {
    r.deathStart = performance.now();
    r.deathSide = Math.random() > .5 ? 1 : -1;
    r.deathPitch = (p.lastHitHead ? .85 : .5) + Math.random() * .25;
    setPose(r, 'stand');
  }
  if (!r.wasAlive && p.alive) {
    r.deathStart = 0;
    r.bodyRoot.rotation.set(0, 0, 0);
    r.bodyRoot.position.set(0, 0, 0);
    setPose(r, 'stand');
  }
  r.wasAlive = p.alive;

  if (!p.alive) {
    const t = Math.min(1, Math.max(0, (performance.now() - r.deathStart) / 820));
    const eased = 1 - (1 - t) ** 3;
    r.bodyRoot.rotation.z = r.deathSide * eased * 1.42;
    r.bodyRoot.rotation.x = eased * r.deathPitch * .22;
    r.bodyRoot.position.y = -.62 * eased;
    r.last = { ...p };
    return;
  }

  if (p._snap !== undefined && p._snap !== r.lastSnapId) {
    r.motionSpeed = Math.hypot(p.x - r.lastSnapPosition.x, p.z - r.lastSnapPosition.z) / Math.max(.02, snapshotDt);
    r.lastSnapPosition.set(p.x, p.y, p.z);
    r.lastSnapId = p._snap;
  }
  r.motionSpeed *= Math.exp(-dt * 1.25);

  const wantedPose = p.crouch && r.poses.crouch ? 'crouch' : (r.motionSpeed > 1.25 && r.poses.run ? 'run' : 'stand');
  setPose(r, wantedPose);

  r.bodyRoot.position.y += ((p.crouch && !r.external ? -.28 : 0) - r.bodyRoot.position.y) * alpha;
  r.bodyRoot.rotation.x *= Math.exp(-dt * 12);
  r.bodyRoot.rotation.z *= Math.exp(-dt * 12);
  r.last = { ...p };
}
