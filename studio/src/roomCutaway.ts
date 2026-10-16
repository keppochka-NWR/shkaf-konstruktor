/** «Ближние стены»: стена, за плоскостью которой стоит камера, скрывается целиком (Макс 16.10.2026).
 *  Координаты комнаты, мм: x 0..width (left→right), z 0..depth (back→front), y — высота. */
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

/** Ребро видно, только если видны все его стены. */
export function edgeVisible(walls:readonly CutawayWall[],hidden:ReadonlySet<CutawayWall>){return walls.every(w=>!hidden.has(w));}

const KEY='studio-room-cutaway';
/** Настройка зрителя: по умолчанию ВКЛ; хранилище может быть недоступно — тогда просто по умолчанию. */
export function readCutaway():boolean{try{return localStorage.getItem(KEY)!=='0';}catch{return true;}}
export function saveCutaway(on:boolean){try{localStorage.setItem(KEY,on?'1':'0');}catch{/* настройка вида не важна для документа */}}
