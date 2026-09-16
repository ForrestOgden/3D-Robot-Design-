import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { RGBELoader } from 'three/addons/loaders/RGBELoader.js';
import { OBSTACLES, ARENA_HALF } from './shared.js';
import { gameplayAssetEntries } from './assetCatalog.js';

const texLoader = new THREE.TextureLoader();
const gltfLoader = new GLTFLoader();
const rgbeLoader = new RGBELoader();

function setRepeat(tex, rx, ry, color = false) {
  if (!tex) return;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(rx, ry);
  tex.anisotropy = 8;
  if (color) tex.colorSpace = THREE.SRGBColorSpace;
}

async function loadTexture(url) {
  if (!url) return null;
  try { return await texLoader.loadAsync(url); }
  catch { return null; }
}

async function pbrFrom(entry, repeat = [1, 1], fallback = 0x666a6d) {
  if (!entry) return new THREE.MeshStandardMaterial({ color: fallback, roughness: .8, metalness: .05 });
  const [map, normalMap, roughnessMap, aoMap, metalnessMap] = await Promise.all([
    loadTexture(entry.diffuse), loadTexture(entry.normal), loadTexture(entry.roughness),
    loadTexture(entry.ao), loadTexture(entry.metalness)
  ]);
  setRepeat(map, ...repeat, true);
  setRepeat(normalMap, ...repeat);
  setRepeat(roughnessMap, ...repeat);
  setRepeat(aoMap, ...repeat);
  setRepeat(metalnessMap, ...repeat);
  return new THREE.MeshStandardMaterial({
    map: map || null,
    normalMap: normalMap || null,
    roughnessMap: roughnessMap || null,
    aoMap: aoMap || null,
    metalnessMap: metalnessMap || null,
    color: map ? 0xffffff : fallback,
    roughness: roughnessMap ? 1 : .78,
    metalness: metalnessMap ? 1 : .05,
    normalScale: new THREE.Vector2(.85, .85)
  });
}

function box(scene, o, material, { cast = true, receive = true } = {}) {
  const g = new THREE.BoxGeometry(o.w, o.h, o.d);
  if (g.attributes.uv && !g.attributes.uv2) g.setAttribute('uv2', new THREE.BufferAttribute(g.attributes.uv.array, 2));
  const m = new THREE.Mesh(g, material);
  m.position.set(o.x, o.h / 2 + (o.y || 0), o.z);
  m.castShadow = cast;
  m.receiveShadow = receive;
  scene.add(m);
  return m;
}

function cloneModel(root, pos, scale = 1, rot = 0) {
  const m = root.clone(true);
  m.position.set(...pos);
  m.scale.setScalar(scale);
  m.rotation.y = rot;
  m.traverse(x => {
    if (x.isMesh) {
      x.castShadow = true;
      x.receiveShadow = true;
      x.frustumCulled = true;
    }
  });
  return m;
}

function addStripe(scene, x, z, w, d, color = 0xe4d9a6) {
  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(w, d),
    new THREE.MeshStandardMaterial({ color, roughness: .78, metalness: 0, polygonOffset: true, polygonOffsetFactor: -2 })
  );
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.set(x, .018, z);
  mesh.receiveShadow = true;
  scene.add(mesh);
}

function addBuilding(scene, x, z, w, d, h, material, rotation = 0, accentMat = null) {
  const group = new THREE.Group();
  const shell = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
  shell.position.y = h / 2;
  shell.castShadow = true;
  shell.receiveShadow = true;
  group.add(shell);

  const windowMat = new THREE.MeshStandardMaterial({
    color: 0x60717a, emissive: 0x141b1f, emissiveIntensity: .75,
    roughness: .24, metalness: .18
  });
  const frontZ = -d / 2 - .012;
  const rows = Math.max(1, Math.floor((h - 3) / 2.4));
  const cols = Math.max(2, Math.floor(w / 3.1));
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const win = new THREE.Mesh(new THREE.PlaneGeometry(1.25, 1.05), windowMat);
      win.position.set((col - (cols - 1) / 2) * 2.6, 2.1 + row * 2.35, frontZ);
      group.add(win);
    }
  }

  const roof = new THREE.Mesh(new THREE.BoxGeometry(w + .25, .24, d + .25), accentMat || material);
  roof.position.y = h + .12;
  roof.castShadow = true;
  group.add(roof);

  if (accentMat) {
    const unit = new THREE.Mesh(new THREE.BoxGeometry(Math.min(4, w * .28), 1.15, Math.min(3, d * .35)), accentMat);
    unit.position.set(w * .18, h + .7, 0);
    unit.castShadow = true;
    group.add(unit);
  }

  group.position.set(x, 0, z);
  group.rotation.y = rotation;
  scene.add(group);
  return group;
}

function addPipe(scene, x, y, z, length, material, horizontal = true) {
  const pipe = new THREE.Mesh(new THREE.CylinderGeometry(.115, .115, length, 12), material);
  pipe.position.set(x, y, z);
  pipe.rotation.z = horizontal ? Math.PI / 2 : 0;
  pipe.castShadow = true;
  scene.add(pipe);
}

export async function loadAssetManifest() {
  try {
    const r = await fetch('/assets/manifest.json', { cache: 'no-store' });
    if (!r.ok) throw new Error('manifest unavailable');
    return await r.json();
  } catch {
    return null;
  }
}

export async function buildArena(scene, manifest) {
  const M = manifest?.materials || {};
  const [concreteFloor, asphalt, wallConcrete, slabConcrete, brick, corrugated, metal, containerMat] = await Promise.all([
    pbrFrom(M.concrete_floor, [18, 18], 0x5e6060),
    pbrFrom(M.asphalt_floor, [24, 24], 0x313436),
    pbrFrom(M.concrete_wall_009 || M.concrete, [5, 2], 0x696b68),
    pbrFrom(M.concrete_slab_wall || M.concrete, [4, 2], 0x76746d),
    pbrFrom(M.brick_wall_001, [4, 3], 0x6d4a3d),
    pbrFrom(M.corrugated_iron, [3, 2], 0x5e6467),
    pbrFrom(M.metal_plate_02, [3, 3], 0x555b60),
    pbrFrom(M.container_side, [2, 1], 0x4e5c61)
  ]);

  const outer = new THREE.Mesh(new THREE.PlaneGeometry(180, 180), asphalt);
  outer.rotation.x = -Math.PI / 2;
  outer.position.y = -.03;
  outer.receiveShadow = true;
  scene.add(outer);

  const ground = new THREE.Mesh(new THREE.PlaneGeometry(ARENA_HALF * 2, ARENA_HALF * 2), concreteFloor);
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = 0;
  ground.receiveShadow = true;
  scene.add(ground);

  const wallH = 5, wallT = 1;
  const perimeter = [
    [0, -ARENA_HALF, ARENA_HALF * 2 + 2, wallT, wallConcrete],
    [0, ARENA_HALF, ARENA_HALF * 2 + 2, wallT, slabConcrete],
    [-ARENA_HALF, 0, wallT, ARENA_HALF * 2 + 2, brick],
    [ARENA_HALF, 0, wallT, ARENA_HALF * 2 + 2, wallConcrete]
  ];
  for (const [x, z, w, d, mat] of perimeter) box(scene, { x, z, w, d, h: wallH }, mat);

  for (const o of OBSTACLES) {
    const material = o.type === 'container' ? containerMat : o.type === 'crate' ? corrugated : wallConcrete;
    box(scene, o, material);
  }

  const buildingSpecs = [
    [-49, -25, 17, 13, 13, brick, 0], [-50, 5, 20, 12, 18, wallConcrete, 0], [-49, 28, 15, 13, 11, corrugated, 0],
    [49, -27, 19, 12, 15, slabConcrete, Math.PI], [50, 1, 18, 14, 20, brick, Math.PI], [49, 29, 14, 11, 12, wallConcrete, Math.PI],
    [-26, -50, 17, 14, 16, wallConcrete, Math.PI / 2], [1, -50, 22, 13, 12, brick, Math.PI / 2], [29, -50, 15, 12, 18, corrugated, Math.PI / 2],
    [-27, 50, 16, 12, 12, brick, -Math.PI / 2], [1, 50, 20, 14, 17, slabConcrete, -Math.PI / 2], [29, 50, 16, 12, 14, wallConcrete, -Math.PI / 2]
  ];
  for (const spec of buildingSpecs) addBuilding(scene, ...spec, metal);

  for (let x = -28; x <= 28; x += 14) addStripe(scene, x, 0, .16, 68, 0xd8d1ad);
  for (let z = -28; z <= 28; z += 14) addStripe(scene, 0, z, 68, .12, 0x8d9aa0);
  addStripe(scene, 0, -32, 20, .28, 0xe2a845);
  addStripe(scene, 0, 32, 20, .28, 0xe2a845);

  for (const y of [2.1, 3.3]) {
    addPipe(scene, 0, y, -37.3, 58, metal, true);
    addPipe(scene, 0, y, 37.3, 58, metal, true);
  }
  for (const x of [-31, 31]) addPipe(scene, x, 2.6, 0, 22, metal, false);

  const models = {};
  if (manifest?.models) {
    for (const [id, url] of Object.entries(manifest.models)) {
      if (id === 'service_pistol') continue;
      try {
        const gltf = await gltfLoader.loadAsync(url);
        gltf.scene._clips = gltf.animations || [];
        models[id] = gltf.scene;
      } catch (e) { console.warn(`Model failed: ${id}`, e); }
    }
  }

  for (const [id, asset] of gameplayAssetEntries()) {
    if (models[id]) continue;
    const localUrl = manifest?.externalModels?.[id]?.url;
    let loaded = null;
    for (const url of [localUrl, asset.url].filter(Boolean)) {
      try { loaded = await gltfLoader.loadAsync(url); break; }
      catch (e) { console.warn(`Gameplay asset failed: ${id} from ${url}`, e); }
    }
    if (loaded) {
      loaded.scene._clips = loaded.animations || [];
      models[id] = loaded.scene;
    }
  }

  models.service_pistol = models.weapon_service_pistol || null;
  if (models.service_pistol) {
    models.service_pistol._operatorPoses = {
      stand: models.operator_recon_stand || null,
      crouch: models.operator_recon_crouch || null,
      run: models.operator_recon_crouch || null
    };
  }

  const scatter = (id, placements) => {
    const root = models[id];
    if (!root) return;
    for (const [x, y, z, scale = 1, rot = 0] of placements) scene.add(cloneModel(root, [x, y, z], scale, rot));
  };

  scatter('barrel_03', [
    [-12, 0, -18, 1, .3], [13, 0, 17, 1, 2.1], [19, 0, -8, 1, 1.2], [-21, 0, 10, 1, 4.3],
    [25, 0, 24, 1, .8], [-27, 0, -24, 1, 2.8]
  ]);
  scatter('old_military_crate', [[-8, 0, 9, .85, .4], [9, 0, -8, .9, 1.1], [-18, 0, -5, .8, -.5]]);
  scatter('wooden_military_crate', [[17, 0, 4, .85, .2], [25, 0, -17, .8, 1.7], [-25, 0, 18, .85, -.9]]);
  scatter('wooden_crate_02', [[-7, 0, -27, .75, .1], [7, 0, 27, .75, 1.2]]);
  scatter('plastic_crate_02', [[12, 0, 24, .9, .4], [-13, 0, -24, .9, 1.8]]);
  scatter('trashbag', [[-34, 0, -10, .9, .1], [-33.3, 0, -9.4, .7, 1], [34, 0, 11, .85, 2], [33.4, 0, 10.3, .65, -.7]]);
  scatter('concrete_road_barrier', [[-5, 0, -20, 1, 0], [5, 0, -20, 1, 0], [-5, 0, 20, 1, 0], [5, 0, 20, 1, 0]]);
  scatter('concrete_road_barrier_02', [[-22, 0, -4, 1, Math.PI / 2], [22, 0, 4, 1, Math.PI / 2]]);

  if (models.security_light) {
    const lights = [
      [-34, 4.3, -34, Math.PI * .25], [34, 4.3, 34, Math.PI * 1.25],
      [-34, 4.3, 34, Math.PI * .75], [34, 4.3, -34, Math.PI * 1.75]
    ];
    for (const [x, y, z, rot] of lights) {
      scene.add(cloneModel(models.security_light, [x, y, z], 1, rot));
      const lamp = new THREE.PointLight(0xffd7a6, 28, 17, 2.1);
      lamp.position.set(x, y + .15, z);
      lamp.castShadow = false;
      scene.add(lamp);
    }
  }

  if (manifest?.hdri) {
    try {
      const hdr = await rgbeLoader.loadAsync(manifest.hdri);
      hdr.mapping = THREE.EquirectangularReflectionMapping;
      scene.environment = hdr;
      scene.background = hdr;
      scene.environmentIntensity = .72;
      scene.backgroundIntensity = .62;
      scene.backgroundBlurriness = .16;
    } catch (e) {
      console.warn('HDRI failed', e);
    }
  }

  return { models, materials: { concreteFloor, asphalt, wallConcrete, slabConcrete, brick, corrugated, metal, containerMat } };
}
