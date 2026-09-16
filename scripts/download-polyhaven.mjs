import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = path.join(root, 'public', 'assets', 'polyhaven');
await fs.mkdir(out, { recursive: true });

const UA = 'ArenaZeroFPS/2.0 (Poly Haven CC0 asset fetcher; https://github.com/ForrestOgden/arena-zero-fps)';
const API = 'https://api.polyhaven.com/files/';

const MODEL_IDS = [
  'service_pistol',
  'barrel_03',
  'concrete_road_barrier',
  'concrete_road_barrier_02',
  'security_light',
  'old_military_crate',
  'wooden_military_crate',
  'plastic_crate_02',
  'trashbag'
];

const MATERIAL_IDS = [
  'concrete_floor',
  'asphalt_floor',
  'concrete_wall_009',
  'concrete_slab_wall',
  'brick_wall_001',
  'corrugated_iron',
  'metal_plate_02',
  'container_side',
  'painted_concrete_02'
];

const HDRI_ID = 'urban_street_02';

async function json(url) {
  const r = await fetch(url, { headers: { 'User-Agent': UA } });
  if (!r.ok) throw new Error(`${r.status} ${url}`);
  return r.json();
}

function leaves(obj, p = []) {
  let a = [];
  if (!obj || typeof obj !== 'object') return a;
  if (typeof obj.url === 'string') a.push({ path: p.join('/').toLowerCase(), node: obj });
  for (const [k, v] of Object.entries(obj)) if (k !== 'url') a = a.concat(leaves(v, [...p, k]));
  return a;
}

function scorePath(x, wants) {
  let s = 0;
  for (const [needle, pts] of wants) if (x.path.includes(needle)) s += pts;
  if (x.path.includes('2k')) s += 34;
  else if (x.path.includes('1k')) s += 20;
  else if (x.path.includes('4k')) s += 10;
  if (x.path.includes('gltf')) s += 20;
  if (/\.(jpg|jpeg|png|webp)$/i.test(x.node.url)) s += 8;
  if (/\.glb$/i.test(x.node.url)) s += 30;
  if (/\.gltf$/i.test(x.node.url)) s += 25;
  return s;
}

function choose(data, wants) {
  return leaves(data).sort((a, b) => scorePath(b, wants) - scorePath(a, wants))[0];
}

async function download(url, dest, md5) {
  const r = await fetch(url, { headers: { 'User-Agent': UA } });
  if (!r.ok) throw new Error(`download ${r.status} ${url}`);
  const buf = Buffer.from(await r.arrayBuffer());
  if (md5 && crypto.createHash('md5').update(buf).digest('hex') !== md5) throw new Error(`checksum failed ${dest}`);
  await fs.mkdir(path.dirname(dest), { recursive: true });
  await fs.writeFile(dest, buf);
  return buf.length;
}

function ext(url) {
  try { return path.extname(new URL(url).pathname) || '.bin'; }
  catch { return '.bin'; }
}

async function model(id) {
  console.log(`Model ${id}`);
  const data = await json(API + id);
  const c = choose(data, [['gltf', 100], ['glb', 90], ['blend', -100], ['fbx', -30], ['usd', -30]]);
  if (!c) throw new Error(`No glTF for ${id}`);
  const dir = path.join(out, 'models', id);
  await fs.mkdir(dir, { recursive: true });
  const mainName = `${id}${ext(c.node.url)}`;
  await download(c.node.url, path.join(dir, mainName), c.node.md5);
  const includes = c.node.include || {};
  for (const [name, meta] of Object.entries(includes)) {
    if (meta?.url) await download(meta.url, path.join(dir, name), meta.md5);
  }
  return `/assets/polyhaven/models/${id}/${mainName}`;
}

async function material(id) {
  console.log(`Material ${id}`);
  const data = await json(API + id);
  const all = leaves(data);
  const select = tokens => all.sort((a, b) => scorePath(b, tokens) - scorePath(a, tokens))[0];
  const picks = {
    diffuse: select([['diff', 120], ['albedo', 110], ['basecolor', 110], ['jpg', 8], ['png', 6]]),
    normal: select([['nor_gl', 150], ['normal_gl', 140], ['nor', 85], ['dx', -120]]),
    roughness: select([['rough', 140], ['arm', 25]]),
    ao: select([['/ao', 135], ['ambient', 100], ['arm', 35]]),
    metalness: select([['metal', 140], ['arm', 35]])
  };
  const result = {};
  for (const [kind, c] of Object.entries(picks)) {
    if (!c) continue;
    const dest = path.join(out, 'materials', id, `${kind}${ext(c.node.url)}`);
    await download(c.node.url, dest, c.node.md5);
    result[kind] = `/assets/polyhaven/materials/${id}/${path.basename(dest)}`;
  }
  return result;
}

async function hdri(id) {
  console.log(`HDRI ${id}`);
  const data = await json(API + id);
  const c = choose(data, [['hdri', 100], ['2k', 100], ['1k', 80], ['hdr', 90], ['exr', 25], ['tonemapped', -120]]);
  if (!c) throw new Error('No HDRI');
  const dest = path.join(out, 'hdri', `${id}${ext(c.node.url)}`);
  await download(c.node.url, dest, c.node.md5);
  return `/assets/polyhaven/hdri/${path.basename(dest)}`;
}

const manifest = {
  source: 'Poly Haven',
  sourceUrl: 'https://polyhaven.com',
  license: 'CC0',
  generated: new Date().toISOString(),
  models: {},
  materials: {},
  hdri: null
};

for (const id of MODEL_IDS) {
  try { manifest.models[id] = await model(id); }
  catch (e) { console.warn(`Skipping ${id}: ${e.message}`); }
}
for (const id of MATERIAL_IDS) {
  try { manifest.materials[id] = await material(id); }
  catch (e) { console.warn(`Skipping ${id}: ${e.message}`); }
}
try { manifest.hdri = await hdri(HDRI_ID); }
catch (e) { console.warn(`Skipping HDRI: ${e.message}`); }

await fs.mkdir(path.join(root, 'public', 'assets'), { recursive: true });
await fs.writeFile(path.join(root, 'public', 'assets', 'manifest.json'), JSON.stringify(manifest, null, 2));
console.log('Wrote public/assets/manifest.json');
