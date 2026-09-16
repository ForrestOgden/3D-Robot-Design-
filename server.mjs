import express from 'express';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Server } from 'socket.io';
import { createServer as createViteServer } from 'vite';
import {
  TICK_RATE, SNAPSHOT_RATE, ARENA_HALF, PLAYER_RADIUS, EYE_OFFSET, GRAVITY,
  JUMP_SPEED, WALK_SPEED, SPRINT_SPEED, CROUCH_SPEED, MAX_HEALTH, MATCH_SECONDS,
  WEAPON, SPAWNS, OBSTACLES, normalize2, resolveArenaMove, rayAabb, clamp
} from './src/shared.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const isDev = process.argv.includes('--dev');
const PORT = Number(process.env.PORT || 3000);
const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: true, credentials: false }, transports: ['websocket','polling'] });

if (isDev) {
  const vite = await createViteServer({ server: { middlewareMode: true }, appType: 'spa' });
  app.use(vite.middlewares);
} else {
  app.use(express.static(path.join(__dirname, 'dist')));
  app.get('*path', (_req,res)=>res.sendFile(path.join(__dirname,'dist','index.html')));
}

const players = new Map();
const bots = new Map();
let matchEndsAt = Date.now() + MATCH_SECONDS * 1000;
let botSeq = 1;

function randomSpawn() {
  const p = SPAWNS[(Math.random() * SPAWNS.length) | 0];
  return { x: p[0] + (Math.random()-.5)*1.5, y: 0, z: p[2] + (Math.random()-.5)*1.5 };
}
function baseEntity(id, name, bot=false) {
  const p=randomSpawn();
  return { id,name,bot,x:p.x,y:0,z:p.z,vy:0,yaw:0,pitch:0,health:MAX_HEALTH,kills:0,deaths:0,alive:true,crouch:false,sprint:false,
    ammo:WEAPON.magSize,reserve:WEAPON.reserve,lastFire:0,reloadUntil:0,respawnAt:0,input:{f:0,r:0,jump:false,crouch:false,sprint:false,yaw:0,pitch:0,seq:0},lastInputSeq:0 };
}
function ensureBots() {
  const humans=players.size;
  const desired=Math.max(2, 7-humans);
  while (bots.size<desired) { const id=`bot-${botSeq++}`; bots.set(id,baseEntity(id,`BOT ${String(botSeq-1).padStart(2,'0')}`,true)); }
  while (bots.size>desired) bots.delete(bots.keys().next().value);
}
ensureBots();

function visibleEntities(){ return [...players.values(),...bots.values()].filter(p=>p.alive); }
function respawn(p){ const s=randomSpawn(); Object.assign(p,{x:s.x,y:0,z:s.z,vy:0,health:MAX_HEALTH,alive:true,ammo:WEAPON.magSize,reserve:WEAPON.reserve,reloadUntil:0,respawnAt:0}); }
function kill(victim,killer){
  if(!victim.alive) return;
  victim.alive=false; victim.health=0; victim.deaths++; victim.respawnAt=Date.now()+2500;
  if(killer && killer!==victim) killer.kills++;
  io.emit('kill',{killer:killer?.name||'World',victim:victim.name,bot:!!victim.bot});
}
function shotDirection(yaw,pitch,spread){
  const sy=Math.sin(yaw), cy=Math.cos(yaw), cp=Math.cos(pitch), sp=Math.sin(pitch);
  let x=-sy*cp, y=sp, z=-cy*cp;
  x += (Math.random()-.5)*spread; y += (Math.random()-.5)*spread; z += (Math.random()-.5)*spread;
  const l=Math.hypot(x,y,z)||1; return {x:x/l,y:y/l,z:z/l};
}
function raySphere(origin,dir,cx,cy,cz,r,maxDist){
  const ox=origin.x-cx,oy=origin.y-cy,oz=origin.z-cz;
  const b=ox*dir.x+oy*dir.y+oz*dir.z; const c=ox*ox+oy*oy+oz*oz-r*r; const h=b*b-c;
  if(h<0) return null; const t=-b-Math.sqrt(h); return t>=0&&t<=maxDist?t:null;
}
function fire(shooter, ads=false){
  const now=Date.now()/1000;
  if(!shooter.alive || shooter.reloadUntil*1>now || shooter.ammo<=0 || now-shooter.lastFire<WEAPON.fireInterval) return;
  shooter.lastFire=now; shooter.ammo--;
  const origin={x:shooter.x,y:shooter.y+EYE_OFFSET*(shooter.crouch?.72:1),z:shooter.z};
  const dir=shotDirection(shooter.yaw,shooter.pitch,ads?WEAPON.spreadAds:WEAPON.spreadHip);
  let wallDist=WEAPON.range;
  for(const o of OBSTACLES){ const t=rayAabb(origin,dir,o,WEAPON.range); if(t!==null) wallDist=Math.min(wallDist,t); }
  let hit=null, best=wallDist;
  for(const target of visibleEntities()){
    if(target===shooter) continue;
    const body=raySphere(origin,dir,target.x,target.y+0.95,target.z,0.55,best);
    const head=raySphere(origin,dir,target.x,target.y+1.55,target.z,0.28,best);
    const t=head??body;
    if(t!==null && t<best){best=t;hit={target,head:head!==null&&head<=t+1e-4};}
  }
  if(hit){ const dmg=hit.head?WEAPON.headDamage:WEAPON.damage; hit.target.health-=dmg; if(!shooter.bot) io.to(shooter.id).emit('hit',{head:hit.head,damage:dmg}); if(hit.target.health<=0) kill(hit.target,shooter); }
  io.emit('shot',{id:shooter.id,origin,dir,hit:hit?{x:origin.x+dir.x*best,y:origin.y+dir.y*best,z:origin.z+dir.z*best}:null});
}
function reload(p){ const now=Date.now()/1000; if(!p.alive||p.reloadUntil>now||p.ammo>=WEAPON.magSize||p.reserve<=0)return; p.reloadUntil=now+WEAPON.reloadSeconds; }
function finishReload(p,now){ if(p.reloadUntil&&now>=p.reloadUntil){const need=WEAPON.magSize-p.ammo,take=Math.min(need,p.reserve);p.ammo+=take;p.reserve-=take;p.reloadUntil=0;} }

io.on('connection',socket=>{
  const p=baseEntity(socket.id,'Operator',false); players.set(socket.id,p); ensureBots();
  socket.emit('welcome',{id:socket.id,matchEndsAt});
  socket.on('join',({name}={})=>{p.name=String(name||'Operator').replace(/[<>]/g,'').slice(0,18)||'Operator';});
  socket.on('input',input=>{
    if(!input||!Number.isFinite(input.yaw)||!Number.isFinite(input.pitch))return;
    p.input={f:clamp(Number(input.f)||0,-1,1),r:clamp(Number(input.r)||0,-1,1),jump:!!input.jump,crouch:!!input.crouch,sprint:!!input.sprint,yaw:input.yaw,pitch:clamp(input.pitch,-1.5,1.5),seq:Number(input.seq)||0};
  });
  socket.on('fire',({ads}={})=>fire(p,!!ads)); socket.on('reload',()=>reload(p));
  socket.on('disconnect',()=>{players.delete(socket.id);ensureBots();});
});

function moveEntity(p,dt){
  if(!p.alive){if(Date.now()>=p.respawnAt)respawn(p);return;}
  const i=p.input; p.yaw=i.yaw; p.pitch=i.pitch; p.crouch=i.crouch; p.sprint=i.sprint&&!i.crouch;
  let [f,r]=normalize2(i.f,i.r); const speed=p.crouch?CROUCH_SPEED:p.sprint?SPRINT_SPEED:WALK_SPEED;
  const sy=Math.sin(p.yaw),cy=Math.cos(p.yaw); const dx=(-sy*f+cy*r)*speed*dt; const dz=(-cy*f-sy*r)*speed*dt;
  [p.x,p.z]=resolveArenaMove(p.x,p.z,p.x+dx,p.z+dz,PLAYER_RADIUS);
  if(i.jump&&p.y<=0.001&&!p.crouch)p.vy=JUMP_SPEED;
  p.vy-=GRAVITY*dt; p.y+=p.vy*dt; if(p.y<0){p.y=0;p.vy=0;} p.lastInputSeq=i.seq;
}
function botThink(bot,dt){
  if(!bot.alive){if(Date.now()>=bot.respawnAt)respawn(bot);return;}
  const candidates=[...players.values(),...bots.values()].filter(x=>x!==bot&&x.alive);
  let target=null,dist=Infinity; for(const c of candidates){const d=(c.x-bot.x)**2+(c.z-bot.z)**2;if(d<dist){dist=d;target=c;}}
  if(!target)return; dist=Math.sqrt(dist);
  const dx=target.x-bot.x,dz=target.z-bot.z; const desired=Math.atan2(-dx,-dz); let delta=((desired-bot.yaw+Math.PI*3)%(Math.PI*2))-Math.PI; bot.yaw+=clamp(delta,-1.8*dt,1.8*dt);
  const dy=(target.y+1.3)-(bot.y+EYE_OFFSET); bot.pitch=clamp(Math.atan2(dy,Math.max(0.1,dist)),-0.7,0.7);
  const strafe=Math.sin(Date.now()/900+Number(bot.id.split('-')[1]||0))*0.55; bot.input={f:dist>7?1:dist<4?-0.25:0,r:strafe,jump:false,crouch:false,sprint:dist>18,yaw:bot.yaw,pitch:bot.pitch,seq:0};
  moveEntity(bot,dt); if(dist<28&&Math.abs(delta)<0.14&&Math.random()<dt*5.5)fire(bot,false); if(bot.ammo===0)reload(bot);
}

let last=performance.now(); let snapAcc=0;
setInterval(()=>{
  const nowMs=performance.now(),dt=Math.min(.05,(nowMs-last)/1000);last=nowMs; const now=Date.now()/1000;
  for(const p of players.values()){finishReload(p,now);moveEntity(p,dt);} for(const b of bots.values()){finishReload(b,now);botThink(b,dt);} snapAcc+=dt;
  if(snapAcc>=1/SNAPSHOT_RATE){snapAcc=0; const payload=[...players.values(),...bots.values()].map(p=>({id:p.id,name:p.name,bot:p.bot,x:p.x,y:p.y,z:p.z,yaw:p.yaw,pitch:p.pitch,health:p.health,kills:p.kills,deaths:p.deaths,alive:p.alive,crouch:p.crouch,sprint:p.sprint,ammo:p.ammo,reserve:p.reserve,reloadUntil:p.reloadUntil,lastInputSeq:p.lastInputSeq}));io.emit('snapshot',{players:payload,serverTime:Date.now(),matchEndsAt});}
  if(Date.now()>matchEndsAt){matchEndsAt=Date.now()+MATCH_SECONDS*1000; for(const p of [...players.values(),...bots.values()]){p.kills=0;p.deaths=0;respawn(p);}io.emit('matchReset',{matchEndsAt});}
},1000/TICK_RATE);

server.listen(PORT,'0.0.0.0',()=>console.log(`Arena Zero running at http://localhost:${PORT} (${isDev?'dev':'production'})`));
