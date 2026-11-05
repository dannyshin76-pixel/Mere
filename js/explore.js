'use strict';
/* ---------------- movement ---------------- */
let camX=0,camY=0,camA=0,anim=null,queued=null,pendingBattle=null,lastBump=0;
function syncCam(){camX=S.x+.5;camY=S.y+.5;camA=dirAng(S.dir)}
function input(cmd){if(mode!=='explore')return;if(anim){queued=cmd;return}
  const now=performance.now();
  if(cmd==='tl'||cmd==='tr'){const s=cmd==='tl'?-1:1;S.dir=(S.dir+s+4)%4;anim={t0:now,dur:150,x0:camX,y0:camY,a0:camA,x1:camX,y1:camY,a1:camA+s*Math.PI/2};renderHeader();return}
  if(cmd==='w'){log('The party waits.');tick();return}
  const d={f:S.dir,b:(S.dir+2)%4,l:(S.dir+3)%4,r:(S.dir+1)%4}[cmd];if(d==null)return;step(d)}
function step(d){const F=cur(),nx=S.x+DIRS[d][0],ny=S.y+DIRS[d][1];
  const e=enemyAt(nx,ny);if(e){startBattle(e,'party');return}
  const ch=chestAt(nx,ny);if(ch){openChest(ch);return}
  if(campAt(nx,ny)){mode='camp';renderAll();return}
  const c=cellAt(F,nx,ny);
  if(c===10){const A=floorOf('A1');log('You descend into the Mossy Cellar.');goFloor('A1',A.up.ax,A.up.ay,A.up.dir);return}
  if(c===11){if(S.flags.sunKey){const B=floorOf('B1');log('The Sun Key turns. The gate of Hollow Keep groans open.','gold');goFloor('B1',B.up.ax,B.up.ay,B.up.dir)}else bump('A sealed iron gate. Its lock is shaped like a sun.');return}
  if(c===12){const nk=DEFS[S.floor].down,N=floorOf(nk);goFloor(nk,N.up.ax,N.up.ay,N.up.dir);return}
  if(c===13){const d0=DEFS[S.floor];if(d0.up==='field'){const a=FIELD_ARRIVE[d0.zone];goFloor('field',a.x,a.y,a.dir)}else{const N=floorOf(d0.up);goFloor(d0.up,N.down.ax,N.down.ay,N.down.dir)}return}
  if(SOLID[c]){bump(c===3?'Deep water blocks the way.':c===7?'A tree blocks the way.':'');return}
  S.x=nx;S.y=ny;S.steps++;
  anim={t0:performance.now(),dur:170,x0:camX,y0:camY,a0:camA,x1:nx+.5,y1:ny+.5,a1:camA};
  tick();if(S.steps%8===0)save()}
function bump(msg){const now=performance.now();if(msg&&now-lastBump>900){log(msg)}lastBump=now}
function afterAnim(){if(pendingBattle){const p=pendingBattle;pendingBattle=null;setTimeout(()=>startBattle(p.e,'enemy'),90);return}
  if(queued){const q=queued;queued=null;input(q)}}
function los(F,x0,y0,x1,y1){let dx=Math.abs(x1-x0),dy=Math.abs(y1-y0),sx=x0<x1?1:-1,sy=y0<y1?1:-1,err=dx-dy,x=x0,y=y0;
  while(!(x===x1&&y===y1)){const e2=2*err;if(e2>-dy){err-=dy;x+=sx}if(e2<dx){err+=dx;y+=sy}if(x===x1&&y===y1)break;const c=cellAt(F,x,y);if(WALLS[c]||c===7)return false}return true}
function tick(){const F=cur(),list=enemies();S.tick++;
  const D=bfsPlayer(F);
  for(const e of list){if(e.boss)continue;if(e.stun>0){e.stun--;continue}
    const dist=Math.abs(e.x-S.x)+Math.abs(e.y-S.y),sees=dist<=6&&los(F,e.x,e.y,S.x,S.y);
    if(sees){if(!e.alert&&dist<=5)log(`${groupName(e)} ${e.group.length>1?'have':'has'} spotted you.`,'bad');e.alert=true;e.lost=0}else if(e.alert&&++e.lost>5)e.alert=false;
    const every=EN[e.group[0]].every;if(!every||S.tick%every!==0)continue;
    if(e.alert){let best=null,bd=D[e.y*F.w+e.x];if(bd<0)bd=999;
      for(const[dx,dy]of DIRS){const nx=e.x+dx,ny=e.y+dy;if(nx===S.x&&ny===S.y){best=[nx,ny];break}if(!inB(F,nx,ny))continue;const v=D[ny*F.w+nx];if(v>=0&&v<bd&&freeFor(F,nx,ny)){bd=v;best=[nx,ny]}}
      if(best){if(best[0]===S.x&&best[1]===S.y){if(!pendingBattle&&mode==='explore')pendingBattle={e}}else{e.x=best[0];e.y=best[1]}}}
    else if(rnd()<.3){const[dx,dy]=DIRS[rnd()*4|0],nx=e.x+dx,ny=e.y+dy;if(freeFor(F,nx,ny)){e.x=nx;e.y=ny}}}
  if(!anim&&pendingBattle){afterAnim()}}
function freeFor(F,x,y){return inB(F,x,y)&&!solidStatic(F,x,y)&&!enemyAt(x,y)&&!(x===S.x&&y===S.y)&&!nearCamp(F,x,y)}
function bfsPlayer(F){const w=F.w,h=F.h,D=new Int16Array(w*h).fill(-1),q=[S.y*w+S.x];D[q[0]]=0;
  for(let i=0;i<q.length;i++){const p=q[i],x=p%w,y=(p/w)|0;if(D[p]>14)continue;for(const[dx,dy]of DIRS){const nx=x+dx,ny=y+dy;if(!inB(F,nx,ny))continue;const np=ny*w+nx;if(D[np]>=0||solidStatic(F,nx,ny))continue;D[np]=D[p]+1;q.push(np)}}return D}
const groupName=e=>{const n=EN[e.group[0]].name,k=e.group.length;if(e.group.every(t=>t===e.group[0]))return k>1?`${['','','Two','Three','Four'][k]} ${n.replace(/f$/,'ve')}s`:`A ${n}`;return `A band of monsters`};
function goFloor(key,x,y,dir){S.floor=key;S.x=x;S.y=y;S.dir=dir;anim=null;queued=null;pendingBattle=null;fstate(key);syncCam();
  for(const e of enemies()){e.rx=e.x;e.ry=e.y;e.alert=false}
  const d=DEFS[key];banner(d.kind==='field'?'Overworld':d.sub,d.name);bigMap=false;mini.classList.remove('big');save();renderAll()}
function openChest(ch){fstate(S.floor).opened[ch.id]=true;const L=ch.loot;
  if(L.type==='gold'){S.gold+=L.n;log(`The chest holds ${L.n} gold.`,'gold')}
  else if(L.type==='item'){S.items[L.id]+=L.n;log(`Found ${L.n>1?L.n+' ':'a'+(L.id==='ether'?'n ':' ')}${ITEMS[L.id].name}${L.n>1?'s':''}.`,'gold')}
  else{const gr=L.gear,m=S.party[gr.who];for(const k of['atk','def','mag','spd'])if(gr[k])m.bonus[k]=(m.bonus[k]||0)+gr[k];m.gear.push(gr.name);
    const parts=['atk','def','mag'].filter(k=>gr[k]).map(k=>`${k.toUpperCase()} +${gr[k]}`).join(', ');log(`Found ${gr.name}! ${m.name} equips it (${parts}).`,'gold')}
  save();renderAll()}
function rest(){for(const m of S.party){m.hp=stat(m,'mhp');m.mp=stat(m,'mmp')}for(const k in S.floors)S.floors[k].enemies=spawnList(k);
  log('The party rests by the fire. HP and MP restored, progress saved.','good');mode='explore';save();renderAll()}
function buy(k){const it=ITEMS[k];if(S.gold<it.price)return;S.gold-=it.price;S.items[k]++;log(`Bought ${it.name === 'Ether'?'an':'a'} ${it.name}.`,'gold');save();renderAll()}
function useOutside(k){const m=S.party[selM],cl=S.party[3],mh=stat(m,'mhp');
  if(k==='potion'){S.items.potion--;const a=Math.min(50,mh-m.hp);m.hp+=a;floatOn(selM,'+'+a,'var(--good)');log(`${m.name} drinks a Potion and recovers ${a} HP.`,'good')}
  if(k==='ether'){S.items.ether--;const a=Math.min(20,stat(m,'mmp')-m.mp);m.mp+=a;floatOn(selM,'+'+a,'var(--mp)');log(`${m.name} recovers ${a} MP.`,'good')}
  if(k==='feather'){S.items.feather--;m.hp=Math.max(1,Math.round(mh*.4));floatOn(selM,'+'+m.hp,'var(--good)');log(`The Ember Feather flares. ${m.name} stands again.`,'good')}
  if(k==='mend'){cl.mp-=3;const a=Math.min(Math.round(stat(cl,'mag')*2.2+12),mh-m.hp);m.hp+=a;floatOn(selM,'+'+a,'var(--good)');log(`Tamsin mends ${m.name===cl.name?'their own wounds':m.name+'’s wounds'}: +${a} HP.`,'good')}
  if(k==='raise'){cl.mp-=10;m.hp=Math.max(1,Math.round(mh*.4));floatOn(selM,'+'+m.hp,'var(--good)');log(`Tamsin raises ${m.name}.`,'good')}
  save();renderAll()}
