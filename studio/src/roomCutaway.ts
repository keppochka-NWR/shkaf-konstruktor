/** «Ближние стены»: стена, за плоскостью которой стоит камера, скрывается целиком (Макс 16.10.2026).
 *  Координаты комнаты, мм: x 0..width (left→right), z 0..depth (back→front), y — высота. */
import {edgePoints,inwardNormal,pointInOutline,type RoomOutline} from './roomOutline';
export type CutawayWall='back'|'front'|'left'|'right';
export const CUTAWAY_WALLS:readonly CutawayWall[]=['back','front','left','right'];

/** Какие стены скрыть при камере в точке (x,z) комнаты. Камера внутри комнаты или режим выключен — ничего. */
export function hiddenWalls(room:{width:number;depth:number},camera:{x:number;z:number},enabled=true):Set<CutawayWall>{
  const hidden=new Set<CutawayWall>();
  if(!enabled||!Number.isFinite(camera.x)||!Number.isFinite(camera.z))return hidden;
  if(camera.z<0)hidden.add('back');
  if(camera.z>room.depth)hidden.add('front');
  if(camera.x<0)hidden.add('left');
  if(camera.x>room.width)hidden.add('right');
  return hidden;
}

export type RoomEdge={a:[number,number,number];b:[number,number,number];walls:CutawayWall[]};
/** 12 рёбер контура комнаты с принадлежностью стенам: вертикальный угол — двум стенам, периметр пола/потолка — одной. */
export function roomEdges(width:number,height:number,depth:number):RoomEdge[]{
  const edges:RoomEdge[]=[];
  for(const y of [0,height]){
    edges.push({a:[0,y,0],b:[width,y,0],walls:['back']});
    edges.push({a:[0,y,depth],b:[width,y,depth],walls:['front']});
    edges.push({a:[0,y,0],b:[0,y,depth],walls:['left']});
    edges.push({a:[width,y,0],b:[width,y,depth],walls:['right']});
  }
  for(const [x,xw] of [[0,'left'],[width,'right']] as const)for(const [z,zw] of [[0,'back'],[depth,'front']] as const)
    edges.push({a:[x,0,z],b:[x,height,z],walls:[zw,xw]});
  return edges;
}

/** Ребро видно, только если видны все его стены (стены прямоугольника — имена, стены контура — номера рёбер). */
export function edgeVisible<K>(walls:readonly K[],hidden:ReadonlySet<K>){return walls.every(w=>!hidden.has(w));}

/** Стена комнаты для «Ближних стен»: у прямоугольника — имя, у контура произвольной формы — номер ребра контура. */
export type CutKey=CutawayWall|number;
/** Контур произвольной формы (задача Макса 30.10.2026): скрыть стены, за линией которых стоит камера. Камера внутри контура —
 *  ничего. Прямая стена — по своей линии; дуга наружу (эркер, скруглённый угол) — по линии через её вершину, параллельной хорде
 *  (как дальняя грань прямоугольника: камера сбоку от эркера его не прячет); дуга внутрь — тоже по линии через её вершину (критик 30.10:
 *  камера между хордой и вогнутой дугой — уже за стеной, по хорде стена не пряталась). */
export function hiddenEdges(o:RoomOutline,camera:{x:number;z:number},enabled=true):Set<number>{
  const hidden=new Set<number>();
  if(!enabled||!Number.isFinite(camera.x)||!Number.isFinite(camera.z)||pointInOutline(camera,o,0))return hidden;
  o.forEach((a,i)=>{const b=o[(i+1)%o.length],n=inwardNormal(a,b);if((camera.x-a.x)*n.x+(camera.z-a.z)*n.z+(a.bulge??0)<0)hidden.add(i);});
  return hidden;
}
/** Рёбра контура для «Ближних стен»: низ и верх каждой стены (дуга — ломаной) — её стене, вертикаль в вершине — двум соседним. */
export function outlineEdges(o:RoomOutline,height:number):{a:[number,number,number];b:[number,number,number];walls:number[]}[]{
  const out:{a:[number,number,number];b:[number,number,number];walls:number[]}[]=[];
  o.forEach((p,i)=>{
    const pts=edgePoints(o,i);
    for(const y of [0,height])for(let k=0;k<pts.length-1;k++)out.push({a:[pts[k].x,y,pts[k].z],b:[pts[k+1].x,y,pts[k+1].z],walls:[i]});
    out.push({a:[p.x,0,p.z],b:[p.x,height,p.z],walls:[(i-1+o.length)%o.length,i]});
  });
  return out;
}

const KEY='studio-room-cutaway';
/** Настройка зрителя: по умолчанию ВКЛ; хранилище может быть недоступно — тогда просто по умолчанию. */
export function readCutaway():boolean{try{return localStorage.getItem(KEY)!=='0';}catch{return true;}}
export function saveCutaway(on:boolean){try{localStorage.setItem(KEY,on?'1':'0');}catch{/* настройка вида не важна для документа */}}
