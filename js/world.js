'use strict';
/* ---------------- floors ---------------- */
const FLOORS={};
function floorOf(key){return FLOORS[key]||(FLOORS[key]=key==='field'?buildField():genDungeon(key))}
function buildField(){
  const h=FIELD_MAP.length,w=FIELD_MAP[0].length,g=new Uint8Array(w*h);
  const F={key:'field',...DEFS.field,w,h,grid:g,trees:[],chests:[],spawns:[],objs:[]};
  const grp={s:['slime','slime'],w:['wolf','wolf'],g:['goblin','goblin']};let cid=0,sid=0;
  const loot=[{type:'item',id:'potion',n:2},{type:'gear',gear:{name:'Ash Charm',who:3,mag:2,def:1}}];
  for(let y=0;y<h;y++)for(let x=0;x<w;x++){const ch=FIELD_MAP[y][x],i=y*w+x;
    switch(ch){case'#':g[i]=1;break;case'R':g[i]=2;break;case'~':g[i]=3;break;case'T':g[i]=7;F.trees.push({x,y});break;
      case'A':g[i]=10;break;case'B':g[i]=11;break;case'C':F.objs.push({x,y,type:'camp'});break;
      case'c':F.chests.push({id:'fc'+cid,x,y,loot:loot[cid++]});break;
      case's':case'w':case'g':F.spawns.push({id:'f'+(sid++),x,y,group:grp[ch].slice()});break;}}
  return F}
function bfs(g,w,h,sx,sy,block){const D=new Int16Array(w*h).fill(-1);const q=[sy*w+sx];D[q[0]]=0;
  for(let i=0;i<q.length;i++){const p=q[i],x=p%w,y=(p/w)|0;for(const[dx,dy]of DIRS){const nx=x+dx,ny=y+dy;if(nx<0||ny<0||nx>=w||ny>=h)continue;const np=ny*w+nx;if(D[np]>=0||g[np]!==0||(block&&block.has(np)))continue;D[np]=D[p]+1;q.push(np)}}return D}
function genDungeon(key){
  const d=DEFS[key],w=d.w,h=d.h,R=mulberry(d.seed),g=new Uint8Array(w*h).fill(d.wall);
  const rooms=[];let tries=0;
  while(rooms.length<d.rooms&&tries<1500){tries++;const rw=3+(R()*4|0),rh=3+(R()*4|0),rx=2+(R()*(w-rw-3)|0),ry=2+(R()*(h-rh-3)|0);
    if(rx+rw>w-1||ry+rh>h-1)continue;
    if(rooms.some(o=>rx-2<o.x+o.w&&rx+rw+2>o.x&&ry-2<o.y+o.h&&ry+rh+2>o.y))continue;rooms.push({x:rx,y:ry,w:rw,h:rh})}
  for(const o of rooms)for(let y=o.y;y<o.y+o.h;y++)for(let x=o.x;x<o.x+o.w;x++)g[y*w+x]=0;
  const cx=o=>o.x+(o.w>>1),cy=o=>o.y+(o.h>>1);
  const dig=(a,b)=>{let x=cx(a),y=cy(a);const tx=cx(b),ty=cy(b);
    const hz=()=>{while(x!==tx){x+=Math.sign(tx-x);g[y*w+x]=0}},vt=()=>{while(y!==ty){y+=Math.sign(ty-y);g[y*w+x]=0}};
    if(R()<.5){hz();vt()}else{vt();hz()}};
  const linked=[rooms[0]],rest=rooms.slice(1);
  while(rest.length){let best=null,bd=1e9;for(const r of rest)for(const l of linked){const dd=Math.abs(cx(r)-cx(l))+Math.abs(cy(r)-cy(l));if(dd<bd){bd=dd;best=[r,l]}}
    dig(best[1],best[0]);linked.push(best[0]);rest.splice(rest.indexOf(best[0]),1)}
  for(let i=0;i<2;i++){const a=rooms[R()*rooms.length|0],b=rooms[R()*rooms.length|0];if(a!==b)dig(a,b)}
  const F={key,...d,w,h,grid:g,trees:[],chests:[],spawns:[],objs:[]};
  const edge=o=>{const c=[];
    for(let x=o.x;x<o.x+o.w;x++){c.push([x,o.y-1,x,o.y,2]);c.push([x,o.y+o.h,x,o.y+o.h-1,0])}
    for(let y=o.y;y<o.y+o.h;y++){c.push([o.x-1,y,o.x,y,1]);c.push([o.x+o.w,y,o.x+o.w-1,y,3])}
    for(let i=c.length-1;i>0;i--){const j=R()*(i+1)|0;[c[i],c[j]]=[c[j],c[i]]}
    for(const[sx,sy,ax,ay,dir]of c){if(sx<0||sy<0||sx>=w||sy>=h)continue;if(g[sy*w+sx]!==d.wall)continue;return{x:sx,y:sy,ax,ay,dir}}return null};
  const start=rooms[0];F.up=edge(start);g[F.up.y*w+F.up.x]=13;
  const dist=bfs(g,w,h,F.up.ax,F.up.ay);
  let end=rooms[1],ed=-1;for(const r of rooms){if(r===start)continue;const dd=dist[cy(r)*w+cx(r)];if(dd>ed){ed=dd;end=r}}
  const occ=new Set([F.up.ay*w+F.up.ax]);
  if(!d.boss){F.down=edge(end);g[F.down.y*w+F.down.x]=12;occ.add(F.down.ay*w+F.down.ax)}
  let sid=0;
  for(const r of rooms){if(r===start)continue;
    if(d.boss&&r===end){F.spawns.push({id:'boss',x:cx(r),y:cy(r),group:[d.boss],boss:true});occ.add(cy(r)*w+cx(r));continue}
    const n=1+(R()<.35?1:0);
    for(let i=0;i<n;i++)for(let t=0;t<12;t++){const x=r.x+(R()*r.w|0),y=r.y+(R()*r.h|0),k=y*w+x;if(occ.has(k))continue;occ.add(k);F.spawns.push({id:'e'+(sid++),x,y,group:d.pool[R()*d.pool.length|0].slice()});break}}
  const gear=d.gear.slice(),block=new Set();let cid=0;
  const base=()=>{let n=0;const D=bfs(g,w,h,F.up.ax,F.up.ay,block);for(let i=0;i<D.length;i++)if(D[i]>=0)n++;return n};
  for(const r of rooms){if(r===start)continue;if(!gear.length&&R()>=.5)continue;
    const corners=[[r.x,r.y],[r.x+r.w-1,r.y],[r.x,r.y+r.h-1],[r.x+r.w-1,r.y+r.h-1]];
    for(const[x,y]of corners){const k=y*w+x;if(occ.has(k))continue;const b0=base();block.add(k);const b1=base();if(b1<b0-1){block.delete(k);continue}
      occ.add(k);let loot;
      if(gear.length)loot={type:'gear',gear:gear.shift()};
      else{const L=d.depth,q=R();loot=q<.4?{type:'gold',n:Math.round((14+L*12)*(.8+R()*.5))}:q<.7?{type:'item',id:'potion',n:1+(R()<.4?1:0)}:q<.88?{type:'item',id:'ether',n:1}:{type:'item',id:'feather',n:1}}
      F.chests.push({id:key+'c'+(cid++),x,y,loot});break}}
  return F}

/* ---------------- state ---------------- */
const SAVE_KEY='hollowmere-save-v1';
let S,mode='explore',BT=null,selM=0,bigMap=false;
const EXPC={};
const stat=(m,k)=>{const c=CLASSES[m.cls];return Math.floor(c.base[k]+c.grow[k]*(m.lv-1))+(m.bonus[k]||0)};
const xpNext=lv=>Math.floor(14*Math.pow(lv,1.6));
function newParty(){return[{name:'Bram',cls:'knight'},{name:'Wren',cls:'rogue'},{name:'Isolde',cls:'mage'},{name:'Tamsin',cls:'cleric'}]
  .map(m=>({...m,lv:1,xp:0,bonus:{},gear:[],hp:0,mp:0})).map(m=>{m.hp=stat(m,'mhp');m.mp=stat(m,'mmp');return m})}
function fresh(){return{v:1,party:newParty(),gold:20,items:{potion:3,ether:1,feather:1},floor:'field',x:START.x,y:START.y,dir:START.dir,floors:{},flags:{},tick:0,steps:0}}
function spawnList(key){const F=floorOf(key);return F.spawns.filter(s=>!(s.boss&&S.flags['boss_'+key])).map(s=>({id:s.id,x:s.x,y:s.y,group:s.group.slice(),boss:!!s.boss,alert:false,stun:0,lost:0}))}
function fstate(key){return S.floors[key]||(S.floors[key]={enemies:spawnList(key),opened:{},exp:''})}
function exp(key){if(!EXPC[key]){const F=floorOf(key),a=new Uint8Array(F.w*F.h),s=fstate(key).exp||'';for(let i=0;i<a.length;i++)a[i]=s.charCodeAt(i)===49?1:0;EXPC[key]=a}return EXPC[key]}
function save(){try{for(const k in EXPC)if(S.floors[k])S.floors[k].exp=Array.from(EXPC[k]).join('');
  const out=JSON.stringify(S,(k,v)=>(k==='rx'||k==='ry'||k==='guard')?undefined:v);localStorage.setItem(SAVE_KEY,out)}catch(e){}}
function load(){try{const t=localStorage.getItem(SAVE_KEY);if(t){const s=JSON.parse(t);if(s&&s.v===1&&s.party)return s}}catch(e){}return null}
const cur=()=>floorOf(S.floor);
const enemies=()=>fstate(S.floor).enemies;
const inB=(F,x,y)=>x>=0&&y>=0&&x<F.w&&y<F.h;
const cellAt=(F,x,y)=>inB(F,x,y)?F.grid[y*F.w+x]:1;
const enemyAt=(x,y)=>enemies().find(e=>e.x===x&&e.y===y);
const chestAt=(x,y)=>cur().chests.find(c=>c.x===x&&c.y===y&&!fstate(S.floor).opened[c.id]);
const campAt=(x,y)=>cur().objs.find(o=>o.x===x&&o.y===y);
const solidStatic=(F,x,y)=>SOLID[cellAt(F,x,y)]||!!F.objs.find(o=>o.x===x&&o.y===y)||!!F.chests.find(c=>c.x===x&&c.y===y&&!fstate(F.key).opened[c.id]);
const nearCamp=(F,x,y)=>F.objs.some(o=>Math.abs(o.x-x)+Math.abs(o.y-y)<=2);
const alive=()=>S.party.filter(m=>m.hp>0);
