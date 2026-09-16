import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { RGBELoader } from 'three/addons/loaders/RGBELoader.js';
import { OBSTACLES, ARENA_HALF } from './shared.js';

const texLoader=new THREE.TextureLoader();
const gltfLoader=new GLTFLoader();
const rgbeLoader=new RGBELoader();

function setRepeat(tex,rx,ry,color=false){ if(!tex)return;tex.wrapS=tex.wrapT=THREE.RepeatWrapping;tex.repeat.set(rx,ry);tex.anisotropy=8;if(color)tex.colorSpace=THREE.SRGBColorSpace; }
async function loadTexture(url){ if(!url)return null; try{return await texLoader.loadAsync(url);}catch{return null;} }
async function pbrFrom(entry,repeat=[1,1]){
  if(!entry)return new THREE.MeshStandardMaterial({color:0x666a6d,roughness:.84,metalness:.04});
  const [map,normalMap,roughnessMap,aoMap]=await Promise.all([loadTexture(entry.diffuse),loadTexture(entry.normal),loadTexture(entry.roughness),loadTexture(entry.ao)]);
  setRepeat(map,...repeat,true);setRepeat(normalMap,...repeat);setRepeat(roughnessMap,...repeat);setRepeat(aoMap,...repeat);
  return new THREE.MeshStandardMaterial({map:map||null,normalMap:normalMap||null,roughnessMap:roughnessMap||null,aoMap:aoMap||null,color:map?0xffffff:0x666a6d,roughness:.82,metalness:.05});
}
function box(scene,o,material){ const g=new THREE.BoxGeometry(o.w,o.h,o.d);g.setAttribute('uv2',new THREE.BufferAttribute(g.attributes.uv.array,2));const m=new THREE.Mesh(g,material);m.position.set(o.x,o.h/2,o.z);m.castShadow=true;m.receiveShadow=true;scene.add(m);return m; }
function cloneModel(root,pos,scale=1,rot=0){ const m=root.clone(true);m.position.set(...pos);m.scale.setScalar(scale);m.rotation.y=rot;m.traverse(x=>{if(x.isMesh){x.castShadow=true;x.receiveShadow=true;}});return m; }

export async function loadAssetManifest(){ try{const r=await fetch('/assets/manifest.json',{cache:'no-store'});if(!r.ok)throw 0;return await r.json();}catch{return null;} }

export async function buildArena(scene,manifest){
  const concrete=await pbrFrom(manifest?.materials?.concrete_floor,[18,18]);
  const wallMat=await pbrFrom(manifest?.materials?.concrete,[5,2]);
  const containerMat=await pbrFrom(manifest?.materials?.container_side,[2,1]);
  const ground=new THREE.Mesh(new THREE.PlaneGeometry(ARENA_HALF*2,ARENA_HALF*2),concrete);ground.rotation.x=-Math.PI/2;ground.receiveShadow=true;scene.add(ground);
  const wallH=5, wallT=1;
  for(const [x,z,w,d] of [[0,-ARENA_HALF,ARENA_HALF*2+2,wallT],[0,ARENA_HALF,ARENA_HALF*2+2,wallT],[-ARENA_HALF,0,wallT,ARENA_HALF*2+2],[ARENA_HALF,0,wallT,ARENA_HALF*2+2]]) box(scene,{x,z,w,d,h:wallH},wallMat);
  for(const o of OBSTACLES) box(scene,o,o.type==='container'?containerMat:wallMat);

  const grid=new THREE.GridHelper(ARENA_HALF*2,32,0x2c3940,0x1a2024);grid.position.y=.012;grid.material.transparent=true;grid.material.opacity=.25;scene.add(grid);
  const models={};
  if(manifest?.models){ for(const [id,url] of Object.entries(manifest.models)){try{models[id]=(await gltfLoader.loadAsync(url)).scene;}catch{}} }
  if(models.barrel_03){ for(const p of [[-12,0,-18],[13,0,17],[19,0,-8],[-21,0,10]])scene.add(cloneModel(models.barrel_03,p,1,Math.random()*6.28)); }
  if(models.wooden_crate_02){for(const p of [[-8,0,9],[9,0,-8],[-18,0,-5],[17,0,4]])scene.add(cloneModel(models.wooden_crate_02,p,.85,Math.random()*6.28));}
  if(models.concrete_road_barrier){for(const p of [[-5,0,-20],[5,0,-20],[-5,0,20],[5,0,20]])scene.add(cloneModel(models.concrete_road_barrier,p,1,Math.abs(p[2])===20?0:Math.PI/2));}
  if(models.security_light){for(const p of [[-34,4.3,-34],[34,4.3,34],[-34,4.3,34],[34,4.3,-34]])scene.add(cloneModel(models.security_light,p,1,Math.PI));}
  if(manifest?.hdri){try{const hdr=await rgbeLoader.loadAsync(manifest.hdri);hdr.mapping=THREE.EquirectangularReflectionMapping;scene.environment=hdr;scene.background=hdr;}catch{}}
  return models;
}
