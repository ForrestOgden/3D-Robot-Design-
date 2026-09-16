import './styles.css';
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { io } from 'socket.io-client';
import { loadAssetManifest, buildArena } from './arena.js';
import { EYE_OFFSET, WALK_SPEED, SPRINT_SPEED, CROUCH_SPEED, GRAVITY, JUMP_SPEED, PLAYER_RADIUS, resolveArenaMove, clamp, lerp } from './shared.js';

const ui={menu:document.querySelector('#menu'),hud:document.querySelector('#hud'),play:document.querySelector('#playButton'),name:document.querySelector('#nameInput'),sens:document.querySelector('#sensitivity'),fov:document.querySelector('#fov'),health:document.querySelector('#health'),ammo:document.querySelector('#ammo'),reserve:document.querySelector('#reserve'),timer:document.querySelector('#matchTimer'),score:document.querySelector('#scoreLine'),ping:document.querySelector('#ping'),feed:document.querySelector('#killfeed'),hit:document.querySelector('#hitmarker'),damage:document.querySelector('#damageVignette'),respawn:document.querySelector('#respawn'),asset:document.querySelector('#assetStatus')};

const renderer=new THREE.WebGLRenderer({antialias:true,powerPreference:'high-performance'});renderer.setPixelRatio(Math.min(devicePixelRatio,1.75));renderer.setSize(innerWidth,innerHeight);renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.08;document.querySelector('#app').appendChild(renderer.domElement);
const scene=new THREE.Scene();scene.background=new THREE.Color(0x8a9296);scene.fog=new THREE.FogExp2(0x899196,.012);
const camera=new THREE.PerspectiveCamera(92,innerWidth/innerHeight,.05,250);scene.add(camera);
const hemi=new THREE.HemisphereLight(0xcfe3ff,0x2f2a22,1.15);scene.add(hemi);const sun=new THREE.DirectionalLight(0xfff3db,3.1);sun.position.set(-18,34,-12);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);sun.shadow.camera.left=-55;sun.shadow.camera.right=55;sun.shadow.camera.top=55;sun.shadow.camera.bottom=-55;scene.add(sun);
const composer=new EffectComposer(renderer);composer.addPass(new RenderPass(scene,camera));composer.addPass(new UnrealBloomPass(new THREE.Vector2(innerWidth,innerHeight),.15,.55,.86));composer.addPass(new OutputPass());

let manifest=await loadAssetManifest();ui.asset.textContent=manifest?'Poly Haven assets ready.':'Poly Haven pack not installed yet — fallback materials active. Run npm run assets.';const models=await buildArena(scene,manifest);

const socket=io({transports:['websocket','polling']});let myId=null,matchEndsAt=Date.now()+480000,lastSnapshotAt=performance.now();
const remotes=new Map(); const keys=new Set(); let yaw=0,pitch=0,ads=false,seq=0,lastFireLocal=0,alive=true;
const me={x:0,y:0,z:0,vy:0,health:100,ammo:15,reserve:90,crouch:false,sprint:false,kills:0,deaths:0};

function makeCombatant(p){
  const group=new THREE.Group();
  const uniformMat=new THREE.MeshStandardMaterial({color:p.bot?0x7d3030:0x315a78,roughness:.66,metalness:.12});
  const armorMat=new THREE.MeshStandardMaterial({color:p.bot?0x282c2f:0x252d31,roughness:.48,metalness:.35});
  const jointMat=new THREE.MeshStandardMaterial({color:0x171b1e,roughness:.58,metalness:.22});
  const torso=new THREE.Mesh(new THREE.CapsuleGeometry(.34,.55,5,10),uniformMat);torso.position.y=1.18;torso.scale.set(1,.95,.72);group.add(torso);
  const vest=new THREE.Mesh(new THREE.BoxGeometry(.62,.52,.35),armorMat);vest.position.set(0,1.26,-.05);group.add(vest);
  const head=new THREE.Mesh(new THREE.SphereGeometry(.275,18,14),jointMat);head.position.y=1.76;group.add(head);
  const helmet=new THREE.Mesh(new THREE.SphereGeometry(.292,18,10,0,Math.PI*2,0,Math.PI*.58),armorMat);helmet.position.y=1.79;group.add(helmet);
  const visor=new THREE.Mesh(new THREE.BoxGeometry(.39,.105,.055),new THREE.MeshStandardMaterial({color:0x8eeaff,emissive:0x195f70,emissiveIntensity:2.3,metalness:.6,roughness:.2}));visor.position.set(0,1.76,-.255);group.add(visor);
  const limbs={};
  const limb=(name,x,y,len,rad=.105)=>{const pivot=new THREE.Group();pivot.position.set(x,y,0);const mesh=new THREE.Mesh(new THREE.CapsuleGeometry(rad,len,4,8),uniformMat);mesh.position.y=-len*.48;pivot.add(mesh);group.add(pivot);limbs[name]=pivot;return pivot;};
  limb('armL',-.43,1.47,.58,.09);limb('armR',.43,1.47,.58,.09);limb('legL',-.18,.91,.72,.12);limb('legR',.18,.91,.72,.12);
  const gun=new THREE.Mesh(new THREE.BoxGeometry(.11,.13,.42),armorMat);gun.position.set(.26,1.26,-.41);gun.rotation.x=-.08;group.add(gun);
  group.traverse(x=>{if(x.isMesh){x.castShadow=true;x.receiveShadow=true;}});scene.add(group);
  return {group,limbs,gun,target:new THREE.Vector3(),yaw:0,health:p.health,last:p,phase:Math.random()*6.28};
}
function updateRemoteVisual(r,p,dt){
  r.target.set(p.x,p.y,p.z);r.group.position.lerp(r.target,1-Math.exp(-dt*14));r.yaw=lerpAngle(r.yaw,p.yaw,1-Math.exp(-dt*14));r.group.rotation.y=r.yaw;
  const snapDt=Math.max(.02,(performance.now()-lastSnapshotAt)/1000);const speed=Math.hypot((p.x-r.last.x)||0,(p.z-r.last.z)||0)/snapDt;r.phase+=dt*Math.max(1,speed)*4.8;
  const stride=Math.min(.72,speed*.09)*Math.sin(r.phase);r.limbs.legL.rotation.x=stride;r.limbs.legR.rotation.x=-stride;r.limbs.armL.rotation.x=-stride*.62-.25;r.limbs.armR.rotation.x=stride*.28-1.05;
  r.group.position.y+=p.crouch?-.31:0;r.group.visible=p.alive;r.last=p;
}
function lerpAngle(a,b,t){let d=((b-a+Math.PI*3)%(Math.PI*2))-Math.PI;return a+d*t;}

const weaponPivot=new THREE.Group();camera.add(weaponPivot);weaponPivot.position.set(.36,-.34,-.62);let weaponRoot;
if(models.service_pistol){weaponRoot=models.service_pistol.clone(true);weaponRoot.scale.setScalar(1.45);weaponRoot.rotation.set(0,Math.PI,0);weaponRoot.position.set(.02,-.08,.1);weaponRoot.traverse(x=>{if(x.isMesh){x.castShadow=false;x.frustumCulled=false;}});weaponPivot.add(weaponRoot);}else{weaponRoot=new THREE.Mesh(new THREE.BoxGeometry(.13,.16,.42),new THREE.MeshStandardMaterial({color:0x22272b,metalness:.82,roughness:.28}));weaponRoot.position.z=.05;weaponPivot.add(weaponRoot);}
const muzzle=new THREE.PointLight(0xffb067,0,3,2);muzzle.position.set(.02,.02,-.38);weaponPivot.add(muzzle);

function fireVisual(){muzzle.intensity=20;setTimeout(()=>muzzle.intensity=0,28);weaponPivot.rotation.x-=.045;weaponPivot.position.z+=.025;}
function shoot(){if(!alive||document.pointerLockElement!==renderer.domElement)return;const now=performance.now()/1000;if(now-lastFireLocal<.145||me.ammo<=0)return;lastFireLocal=now;me.ammo--;ui.ammo.textContent=me.ammo;fireVisual();socket.emit('fire',{ads});}

renderer.domElement.addEventListener('mousedown',e=>{if(e.button===0)shoot();if(e.button===2)ads=true;});renderer.domElement.addEventListener('mouseup',e=>{if(e.button===2)ads=false;});renderer.domElement.addEventListener('contextmenu',e=>e.preventDefault());
addEventListener('keydown',e=>{keys.add(e.code);if(e.code==='KeyR')socket.emit('reload');if(e.code==='KeyC')e.preventDefault();});addEventListener('keyup',e=>keys.delete(e.code));
addEventListener('mousemove',e=>{if(document.pointerLockElement!==renderer.domElement)return;const s=Number(ui.sens.value)*.0022;yaw-=e.movementX*s;pitch=clamp(pitch-e.movementY*s,-1.48,1.48);});
ui.fov.addEventListener('input',()=>camera.fov=Number(ui.fov.value));
ui.play.addEventListener('click',()=>{socket.emit('join',{name:ui.name.value});renderer.domElement.requestPointerLock();ui.menu.classList.add('hidden');ui.hud.classList.remove('hidden');});
document.addEventListener('pointerlockchange',()=>{if(document.pointerLockElement!==renderer.domElement&&!ui.hud.classList.contains('hidden'))ui.menu.classList.remove('hidden');else if(document.pointerLockElement===renderer.domElement)ui.menu.classList.add('hidden');});

socket.on('welcome',d=>{myId=d.id;matchEndsAt=d.matchEndsAt;});
socket.on('snapshot',d=>{lastSnapshotAt=performance.now();matchEndsAt=d.matchEndsAt;let self=null;const seen=new Set();for(const p of d.players){if(p.id===myId){self=p;continue;}seen.add(p.id);let r=remotes.get(p.id);if(!r){r=makeCombatant(p);remotes.set(p.id,r);}r.snapshot=p;}for(const [id,r] of remotes)if(!seen.has(id)){scene.remove(r.group);remotes.delete(id);}if(self){me.health=self.health;me.ammo=self.ammo;me.reserve=self.reserve;me.kills=self.kills;me.deaths=self.deaths;alive=self.alive;ui.health.textContent=Math.max(0,Math.ceil(me.health));ui.ammo.textContent=me.ammo;ui.reserve.textContent=me.reserve;ui.score.textContent=`${self.kills} K — ${self.deaths} D`;if(Math.hypot(me.x-self.x,me.z-self.z)>4){me.x=self.x;me.y=self.y;me.z=self.z;me.vy=0;} if(!alive){ui.respawn.classList.remove('hidden');ui.respawn.textContent='RESPAWNING…';}else ui.respawn.classList.add('hidden');}});
socket.on('hit',d=>{ui.hit.classList.add('show');ui.hit.textContent=d.head?'✦':'×';setTimeout(()=>ui.hit.classList.remove('show'),110);});
socket.on('shot',s=>{if(s.id===myId)return;const geo=new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(s.origin.x,s.origin.y,s.origin.z),new THREE.Vector3(s.origin.x+s.dir.x*8,s.origin.y+s.dir.y*8,s.origin.z+s.dir.z*8)]);const line=new THREE.Line(geo,new THREE.LineBasicMaterial({color:0xffd7a1,transparent:true,opacity:.58}));scene.add(line);setTimeout(()=>{scene.remove(line);geo.dispose();line.material.dispose();},55);});
socket.on('kill',k=>{const el=document.createElement('div');el.textContent=`${k.killer}  ›  ${k.victim}`;ui.feed.prepend(el);setTimeout(()=>el.remove(),3500);});
socket.on('matchReset',d=>matchEndsAt=d.matchEndsAt);

let pingSent=0;setInterval(()=>{pingSent=performance.now();socket.timeout(1200).emit('ping-test',()=>{});},2000);socket.io.on('ping',()=>{ui.ping.textContent=`${Math.round(socket.io.engine.ping||0)} ms`;});

function localMove(dt){
  if(!alive)return;
  const forward=(keys.has('KeyW')?1:0)-(keys.has('KeyS')?1:0);const right=(keys.has('KeyD')?1:0)-(keys.has('KeyA')?1:0);let l=Math.hypot(forward,right)||1;const f=forward/l,r=right/l;
  me.crouch=keys.has('ControlLeft')||keys.has('ControlRight')||keys.has('KeyC');me.sprint=(keys.has('ShiftLeft')||keys.has('ShiftRight'))&&!me.crouch&&f>0;
  const speed=me.crouch?CROUCH_SPEED:me.sprint?SPRINT_SPEED:WALK_SPEED;const sy=Math.sin(yaw),cy=Math.cos(yaw);
  const dx=(-sy*f+cy*r)*speed*dt,dz=(-cy*f-sy*r)*speed*dt;[me.x,me.z]=resolveArenaMove(me.x,me.z,me.x+dx,me.z+dz,PLAYER_RADIUS);
  const jumpNow=keys.has('Space')&&me.y<=.001&&!me.crouch;if(jumpNow){me.vy=JUMP_SPEED;keys.delete('Space');}me.vy-=GRAVITY*dt;me.y+=me.vy*dt;if(me.y<0){me.y=0;me.vy=0;}
  socket.emit('input',{f,r,jump:jumpNow,crouch:me.crouch,sprint:me.sprint,yaw,pitch,seq:++seq});
  const moving=Math.hypot(f,r)>0;const t=performance.now()/1000;const bob=moving&&me.y<=.001?Math.sin(t*(me.sprint?15:11))*(me.sprint?.032:.022):0;const side=moving?Math.cos(t*(me.sprint?7.5:5.5))*.012:0;
  const eye=EYE_OFFSET*(me.crouch?.72:1);camera.position.set(me.x,me.y+eye+bob,me.z);camera.rotation.order='YXZ';camera.rotation.y=yaw;camera.rotation.x=pitch+side*.18;
  const targetFov=Number(ui.fov.value)+(me.sprint?5:0)-(ads?12:0);camera.fov=lerp(camera.fov,targetFov,1-Math.exp(-dt*10));camera.updateProjectionMatrix();
  const adsX=ads?.035:.36,adsY=ads?-.28:-.34,adsZ=ads?-.48:-.62;weaponPivot.position.x=lerp(weaponPivot.position.x,adsX,1-Math.exp(-dt*14));weaponPivot.position.y=lerp(weaponPivot.position.y,adsY+bob*.35,1-Math.exp(-dt*14));weaponPivot.position.z=lerp(weaponPivot.position.z,adsZ,1-Math.exp(-dt*14));weaponPivot.rotation.x*=Math.exp(-dt*16);
  if(keys.has('Mouse0'))shoot();
}

let prev=performance.now();function frame(now){requestAnimationFrame(frame);const dt=Math.min(.04,(now-prev)/1000);prev=now;localMove(dt);for(const r of remotes.values())if(r.snapshot)updateRemoteVisual(r,r.snapshot,dt);const sec=Math.max(0,Math.ceil((matchEndsAt-Date.now())/1000));ui.timer.textContent=`${String((sec/60)|0).padStart(2,'0')}:${String(sec%60).padStart(2,'0')}`;composer.render();}requestAnimationFrame(frame);
addEventListener('resize',()=>{camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight);composer.setSize(innerWidth,innerHeight);});
