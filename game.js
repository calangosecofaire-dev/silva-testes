
const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");
const menu = document.getElementById("menu");
const game = document.getElementById("game");
const hpEl = document.getElementById("hp");
const ammoEl = document.getElementById("ammo");
const modeLabel = document.getElementById("modeLabel");

let mode="solo", socket=null, roomState=null, meId=null;
let keys={}, mouse={x:0,y:0,down:false};
let W=innerWidth,H=innerHeight;
const world={w:1400,h:800};
const walls=[
  {x:180,y:130,w:280,h:40},{x:760,y:100,w:45,h:250},
  {x:430,y:460,w:380,h:45},{x:1020,y:300,w:220,h:45},
  {x:160,y:650,w:260,h:40},{x:980,y:620,w:260,h:40}
];
let player={x:300,y:350,r:18,angle:0,hp:100,ammo:12,crouching:false,sprinting:false,jump:0,reload:0};
let bullets=[], bots=[];
let camera={x:0,y:0};

function resize(){W=canvas.width=innerWidth;H=canvas.height=innerHeight}
addEventListener("resize",resize);resize();

function resetSolo(){
  player={x:300,y:350,r:18,angle:0,hp:100,ammo:12,crouching:false,sprinting:false,jump:0,reload:0};
  bullets=[];
  bots=Array.from({length:7},(_,i)=>({id:"bot"+i,x:650+Math.random()*600,y:120+Math.random()*560,hp:100,r:18,dir:Math.random()*6.28,cool:30+Math.random()*80}));
}
function openGame(m){
  mode=m; menu.classList.add("hidden"); game.classList.remove("hidden");
  modeLabel.textContent=m==="solo"?"SOLO":"ONLINE";
  if(m==="solo") resetSolo();
}
document.getElementById("soloBtn").onclick=()=>openGame("solo");
document.getElementById("multiBtn").onclick=()=>document.getElementById("roomBox").classList.remove("hidden");
document.getElementById("joinBtn").onclick=()=>{
  openGame("multi");
  socket=io();
  socket.on("connect",()=>{
    meId=socket.id;
    socket.emit("joinRoom",{roomId:document.getElementById("room").value,name:document.getElementById("name").value});
  });
  socket.on("state",s=>roomState=s);
};
document.getElementById("exitBtn").onclick=()=>location.reload();

addEventListener("keydown",e=>{keys[e.key.toLowerCase()]=true;if(e.code==="Space")keys.jump=true});
addEventListener("keyup",e=>{keys[e.key.toLowerCase()]=false;if(e.code==="Space")keys.jump=false});
canvas.addEventListener("mousemove",e=>{mouse.x=e.clientX;mouse.y=e.clientY});
canvas.addEventListener("mousedown",()=>mouse.down=true);
addEventListener("mouseup",()=>mouse.down=false);

document.querySelectorAll("[data-k]").forEach(b=>{
  const k=b.dataset.k;
  b.onpointerdown=()=>keys[k]=true;
  b.onpointerup=b.onpointercancel=()=>keys[k]=false;
});
document.getElementById("shootBtn").onpointerdown=()=>mouse.down=true;
document.getElementById("shootBtn").onpointerup=()=>mouse.down=false;
document.getElementById("jumpBtn").onpointerdown=()=>keys.jump=true;
document.getElementById("jumpBtn").onpointerup=()=>keys.jump=false;
document.getElementById("crouchBtn").onclick=()=>player.crouching=!player.crouching;
document.getElementById("sprintBtn").onpointerdown=()=>keys.sprint=true;
document.getElementById("sprintBtn").onpointerup=()=>keys.sprint=false;
document.getElementById("reloadBtn").onclick=reload;

function collide(nx,ny,r=18){
  if(nx<r||ny<r||nx>world.w-r||ny>world.h-r)return true;
  return walls.some(o=>nx+r>o.x&&nx-r<o.x+o.w&&ny+r>o.y&&ny-r<o.y+o.h);
}
function reload(){
  if(player.reload>0||player.ammo===12)return;
  player.reload=70;
  if(mode==="multi"&&socket)socket.emit("reload");
}
function fire(){
  if(player.reload>0||player.ammo<=0)return;
  player.ammo--;
  let a=player.angle, speed=13;
  let b={x:player.x+Math.cos(a)*24,y:player.y+Math.sin(a)*24,vx:Math.cos(a)*speed,vy:Math.sin(a)*speed,life:90,owner:"me"};
  if(mode==="solo")bullets.push(b);
  else if(socket)socket.emit("shoot",b);
}
let shotCd=0;
function updatePlayer(){
  let dx=0,dy=0;
  if(keys["w"]||keys.up)dy--; if(keys["s"]||keys.down)dy++;
  if(keys["a"]||keys.left)dx--; if(keys["d"]||keys.right)dx++;
  player.crouching=!!keys["c"]||player.crouching;
  player.sprinting=!!keys["shift"]||!!keys.sprint;
  let speed=player.crouching?2.1:(player.sprinting?5.3:3.5);
  if(dx||dy){let l=Math.hypot(dx,dy);dx/=l;dy/=l}
  let nx=player.x+dx*speed, ny=player.y+dy*speed;
  if(!collide(nx,player.y))player.x=nx;
  if(!collide(player.x,ny))player.y=ny;
  if((keys.jump)&&player.jump<=0)player.jump=18;
  if(player.jump>0)player.jump--;
  if(keys["r"])reload();
  player.angle=Math.atan2(mouse.y-H/2,mouse.x-W/2);
  if(shotCd>0)shotCd--; if(mouse.down&&shotCd<=0){fire();shotCd=10}
  if(player.reload>0){player.reload--;if(player.reload===1)player.ammo=12}
}

function updateSolo(){
  updatePlayer();
  bullets.forEach(b=>{b.x+=b.vx;b.y+=b.vy;b.life--});
  for(const b of bullets){
    for(const bot of bots){
      if(bot.hp>0 && Math.hypot(bot.x-b.x,bot.y-b.y)<24){bot.hp-=40;b.life=0}
    }
  }
  bullets=bullets.filter(b=>b.life>0&&!collide(b.x,b.y,3));
  bots.forEach(bot=>{
    if(bot.hp<=0){bot.hp=100;bot.x=500+Math.random()*800;bot.y=100+Math.random()*600}
    bot.cool--;
    const d=Math.hypot(player.x-bot.x,player.y-bot.y);
    if(d<520){
      let a=Math.atan2(player.y-bot.y,player.x-bot.x);
      let nx=bot.x+Math.cos(a)*1.25, ny=bot.y+Math.sin(a)*1.25;
      if(!collide(nx,ny)) {bot.x=nx;bot.y=ny}
      if(bot.cool<=0){bot.cool=55+Math.random()*35;if(Math.random()<.5)player.hp-=10}
    }else{
      bot.x+=Math.cos(bot.dir)*.7;bot.y+=Math.sin(bot.dir)*.7;
      if(collide(bot.x,bot.y)){bot.dir+=2.4}
    }
  });
  if(player.hp<=0){player.hp=100;player.x=300;player.y=350}
}

function updateMulti(){
  if(!roomState||!roomState.players||!roomState.players[meId])return;
  const srv=roomState.players[meId];
  player.hp=srv.hp; player.ammo=srv.ammo;
  updatePlayer();
  socket.emit("playerUpdate",player);
}

function circle(x,y,r,fill){ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);ctx.fillStyle=fill;ctx.fill()}
function drawWorld(){
  camera.x=Math.max(0,Math.min(world.w-W,player.x-W/2));
  camera.y=Math.max(0,Math.min(world.h-H,player.y-H/2));
  ctx.save();ctx.translate(-camera.x,-camera.y);
  ctx.fillStyle="#162329";ctx.fillRect(0,0,world.w,world.h);
  ctx.strokeStyle="#21343a";ctx.lineWidth=1;
  for(let x=0;x<world.w;x+=50){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,world.h);ctx.stroke()}
  for(let y=0;y<world.h;y+=50){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(world.w,y);ctx.stroke()}
  walls.forEach(o=>{ctx.fillStyle="#39454a";ctx.fillRect(o.x,o.y,o.w,o.h);ctx.strokeStyle="#69767b";ctx.strokeRect(o.x,o.y,o.w,o.h)});
  if(mode==="solo"){
    bots.forEach(bot=>drawActor(bot.x,bot.y,0,"#d45656","BOT",bot.hp,false));
    bullets.forEach(b=>{circle(b.x,b.y,4,"#ffd45b")});
  }else if(roomState){
    Object.values(roomState.players).forEach(p=>drawActor(p.x,p.y,p.angle,p.id===meId?"#75d85f":"#4ea1ff",p.name,p.hp,p.crouching));
    roomState.bullets.forEach(b=>circle(b.x,b.y,4,"#ffd45b"));
  }
  if(mode==="solo")drawActor(player.x,player.y,player.angle,"#75d85f",document.getElementById("name").value,player.hp,player.crouching);
  ctx.restore();
}
function drawActor(x,y,a,color,name,hp,crouch){
  const rr=crouch?14:18, yy=y+(crouch?5:0);
  ctx.save();ctx.translate(x,yy);ctx.rotate(a);
  ctx.fillStyle="#2a2f34";ctx.fillRect(8,-5,28,10);
  ctx.restore();
  circle(x,yy,rr,color);
  ctx.fillStyle="#111";ctx.fillRect(x-24,yy-32,48,6);
  ctx.fillStyle="#7df25b";ctx.fillRect(x-24,yy-32,48*Math.max(0,hp)/100,6);
  ctx.fillStyle="#fff";ctx.font="12px Arial";ctx.textAlign="center";ctx.fillText(name||"Jogador",x,yy-39);
}
function draw(){
  ctx.clearRect(0,0,W,H);
  drawWorld();
  hpEl.textContent="VIDA "+Math.max(0,Math.round(player.hp));
  ammoEl.textContent=player.reload>0?"...":player.ammo;
  if(player.reload>0){ctx.fillStyle="#fff";ctx.font="18px Arial";ctx.textAlign="center";ctx.fillText("RECARREGANDO...",W/2,H-28)}
  ctx.strokeStyle="#fff";ctx.lineWidth=2;ctx.beginPath();ctx.arc(W/2,H/2,8,0,Math.PI*2);ctx.stroke();
}
function loop(){
  if(!game.classList.contains("hidden")){
    if(mode==="solo")updateSolo(); else updateMulti();
    draw();
  }
  requestAnimationFrame(loop);
}
loop();
