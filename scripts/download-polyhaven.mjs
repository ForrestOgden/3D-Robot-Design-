import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const out=path.join(root,'public','assets','polyhaven');
await fs.mkdir(out,{recursive:true});
const UA='ArenaZeroFPS/1.0 (Poly Haven asset fetcher)';
const API='https://api.polyhaven.com/files/';
const MODEL_IDS=['service_pistol','barrel_03','wooden_crate_02','concrete_road_barrier','security_light'];
const MATERIAL_IDS=['concrete_floor','concrete','container_side'];
const HDRI_ID='reinforced_concrete_01';

async function json(url){const r=await fetch(url,{headers:{'User-Agent':UA}});if(!r.ok)throw new Error(`${r.status} ${url}`);return r.json();}
function leaves(obj,p=[]){let a=[];if(!obj||typeof obj!=='object')return a;if(typeof obj.url==='string')a.push({path:p.join('/').toLowerCase(),node:obj});for(const [k,v] of Object.entries(obj))if(k!=='url')a=a.concat(leaves(v,[...p,k]));return a;}
function scorePath(x,wants){let s=0;for(const [needle,pts] of wants)if(x.path.includes(needle))s+=pts;if(x.path.includes('1k'))s+=25;else if(x.path.includes('2k'))s+=12;if(x.path.includes('gltf'))s+=15;if(x.node.url.endsWith('.glb'))s+=25;if(x.node.url.endsWith('.gltf'))s+=20;return s;}
function choose(data,wants){return leaves(data).sort((a,b)=>scorePath(b,wants)-scorePath(a,wants))[0];}
async function download(url,dest,md5){const r=await fetch(url,{headers:{'User-Agent':UA}});if(!r.ok)throw new Error(`download ${r.status} ${url}`);const buf=Buffer.from(await r.arrayBuffer());if(md5&&crypto.createHash('md5').update(buf).digest('hex')!==md5)throw new Error(`checksum failed ${dest}`);await fs.mkdir(path.dirname(dest),{recursive:true});await fs.writeFile(dest,buf);return buf.length;}
function ext(url){try{return path.extname(new URL(url).pathname)||'.bin';}catch{return '.bin';}}
async function model(id){
  console.log(`Model ${id}`);const data=await json(API+id);const c=choose(data,[['gltf',80],['glb',70],['blend',-100],['fbx',-20],['usd',-30]]);if(!c)throw new Error(`No glTF for ${id}`);
  const dir=path.join(out,'models',id);await fs.mkdir(dir,{recursive:true});
  const mainName=`${id}${ext(c.node.url)}`;await download(c.node.url,path.join(dir,mainName),c.node.md5);
  const includes=c.node.include||{};for(const [name,meta] of Object.entries(includes)){if(meta?.url)await download(meta.url,path.join(dir,name),meta.md5);}
  return `/assets/polyhaven/models/${id}/${mainName}`;
}
async function material(id){
  console.log(`Material ${id}`);const data=await json(API+id);const all=leaves(data);const select=(tokens)=>all.sort((a,b)=>scorePath(b,tokens)-scorePath(a,tokens))[0];const picks={
    diffuse:select([['diff',100],['albedo',90],['basecolor',90],['jpg',5],['png',4]]),
    normal:select([['nor_gl',120],['normal_gl',110],['nor',75],['dx',-80]]),
    roughness:select([['rough',120],['arm',30]]),
    ao:select([['/ao',110],['ambient',90],['arm',40]])
  };const result={};for(const [kind,c] of Object.entries(picks)){if(!c)continue;const dest=path.join(out,'materials',id,`${kind}${ext(c.node.url)}`);await download(c.node.url,dest,c.node.md5);result[kind]=`/assets/polyhaven/materials/${id}/${path.basename(dest)}`;}return result;
}
async function hdri(id){console.log(`HDRI ${id}`);const data=await json(API+id);const c=choose(data,[['hdri',80],['1k',80],['hdr',70],['exr',20],['tonemapped',-80]]);if(!c)throw new Error('No HDRI');const dest=path.join(out,'hdri',`${id}${ext(c.node.url)}`);await download(c.node.url,dest,c.node.md5);return `/assets/polyhaven/hdri/${path.basename(dest)}`;}

const manifest={source:'Poly Haven',license:'CC0',generated:new Date().toISOString(),models:{},materials:{},hdri:null};
for(const id of MODEL_IDS)try{manifest.models[id]=await model(id);}catch(e){console.warn(`Skipping ${id}: ${e.message}`);}for(const id of MATERIAL_IDS)try{manifest.materials[id]=await material(id);}catch(e){console.warn(`Skipping ${id}: ${e.message}`);}try{manifest.hdri=await hdri(HDRI_ID);}catch(e){console.warn(`Skipping HDRI: ${e.message}`);}await fs.writeFile(path.join(root,'public','assets','manifest.json'),JSON.stringify(manifest,null,2));console.log('Wrote public/assets/manifest.json');
