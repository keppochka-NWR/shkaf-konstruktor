// Правка формы помещения — план и панель «Форма комнаты» (задача Макса 30.10.2026: «не все помещения ровные — 5-угольные, со
// скосом, со скруглениями; редактировать комнату свободнее», как в Базисе: тянуть углы, точные размеры с Enter, меню правой
// кнопкой, линии Q, Alt/Ctrl). Здесь без React: новый контур → проект (проёмы и объекты едут со своими стенами, мебель стоит на
// месте плана), короткая причина отказа, привязки угла, набор «dx;dz». Контур и его правки — roomOutline.ts.
import {roomOutline,rectOutline,normalizeOutline,outlineBounds,outlineError,edgeLength,edgePoint,edgeFrame,projectToEdges,legacyToEdge,cornerAngle,RECT_WALLS,
  type RoomOutline,type EdgeMap,type P2} from './roomOutline';
import {projectErrors,type Project,type Room,type Opening} from './project';

const r1=(v:number)=>{const r=Math.round(v*10)/10;return r===0?0:r;};
type WallItem={wall:Opening['wall'];edge?:number;offset:number;width:number};
const clampOff=(s:number,L:number,w:number)=>r1(Math.max(0,Math.min(L-w,s)));

/** Стена контура и отступ от её начала для проёма/объекта: своя edge (при контуре) или старая стена прямоугольника; старый
 *  проём без edge в комнате с контуром — по месту на прямоугольнике габарита на ближайшую стену. */
export function itemEdge(room:Pick<Room,'width'|'depth'|'outline'>,item:WallItem):{edge:number;offset:number}{
  const o=room.outline;
  if(o&&item.edge!==undefined&&Number.isInteger(item.edge)&&item.edge>=0&&item.edge<o.length)return {edge:item.edge,offset:item.offset};
  const l=legacyToEdge(room.width,room.depth,item.wall,item.offset,item.width);
  if(!o)return l;
  const mid=edgePoint(rectOutline(room.width,room.depth),l.edge,l.offset+item.width/2),pr=projectToEdges(o,mid);
  return {edge:pr.edge,offset:clampOff(pr.s-item.width/2,edgeLength(o,pr.edge),item.width)};
}
/** Старое имя стены для стены контура (для старых читателей): по внутренней нормали — к какой стене прямоугольника ближе. */
export function legacyWall(o:RoomOutline,e:number):Opening['wall']{
  const n=edgeFrame(o,e).n;
  return Math.abs(n.z)>=Math.abs(n.x)?(n.z>0?'back':'front'):(n.x>0?'left':'right');
}
/** Название стены в списках: «Стена 3 · 2850 мм». */
export const edgeTitle=(o:RoomOutline,e:number)=>`Стена ${e+1} · ${Math.round(edgeLength(o,e))} мм`;
/** Проём/объект → стена контура e с отступом offset (wall — для старых читателей). */
export function onEdge<T extends WallItem>(o:RoomOutline,item:T,e:number,offset:number):T{return {...item,edge:e,wall:legacyWall(o,e),offset:clampOff(offset,edgeLength(o,e),item.width)};}

/** Новый контур raw (после правки) → проект: габарит от 0 (мебель, объекты, размеры и линии Q сдвигаются вместе — на плане всё
 *  стоит на месте, едут только стены), проёмы и объекты на стенах — на своих стенах (edgeMap: старая стена → новая; undefined —
 *  ближайшая стена по месту на плане; без edgeMap — все по месту, так ставятся заготовки). Прямоугольник — снова без контура. */
export function applyOutline(p:Project,raw:RoomOutline,edgeMap?:EdgeMap):{project:Project;problem?:string}{
  const room=p.room,o0=roomOutline(room),b=outlineBounds(raw),dx=r1(-b.x0),dz=r1(-b.z0);
  const shifted:RoomOutline=raw.map(q=>({...q,x:r1(q.x+dx),z:r1(q.z+dz)}));
  const norm=normalizeOutline(shifted),target=norm.outline??rectOutline(norm.width,norm.depth);
  const same=!!norm.outline&&norm.outline.length===shifted.length&&norm.outline.every((q,k)=>Math.abs(q.x-shifted[k].x)<0.2&&Math.abs(q.z-shifted[k].z)<0.2);
  let problem:string|undefined;
  const place=<T extends WallItem>(item:T,label:string,fit:boolean):T=>{
    const old=itemEdge(room,item);let w=item.width,e:number|undefined=edgeMap?.[old.edge],s:number;
    // 1) стена и отступ в сдвинутом сыром контуре
    if(e!==undefined&&e>=0&&e<shifted.length)s=old.offset;
    else{const m=edgePoint(o0,old.edge,old.offset+w/2),pr=projectToEdges(shifted,{x:m.x+dx,z:m.z+dz});e=pr.edge;s=pr.s-w/2;}
    // объект во всю стену (плинтус, фартук, короб) — во всю новую стену
    const L0=edgeLength(o0,old.edge);if(fit&&Math.abs(w-L0)<1){w=r1(edgeLength(shifted,e));s=0;}
    // 2) после нормализации порядок вершин другой (прямоугольник, слитые точки) — снова по месту
    if(!same){const m=edgePoint(shifted,e,Math.max(0,Math.min(edgeLength(shifted,e)-w,s))+w/2),pr=projectToEdges(target,m);e=pr.edge;s=pr.s-w/2;}
    const L=edgeLength(target,e);
    // объект длиннее новой стены укорачивается по стене; проём — отказ
    if(w>L+0.1){if(fit)w=r1(L);else problem??=`${label} не помещается на стене ${e+1} (${Math.round(L)} мм)`;}
    const off=clampOff(s,L,w);
    if(norm.outline)return {...item,width:w,edge:e,wall:legacyWall(target,e),offset:off};
    // прямоугольник: старые правила (задняя и передняя — от левой стены, боковые — от задней)
    const wall=RECT_WALLS[e],next={...item,width:w,wall,offset:wall==='front'||wall==='left'?r1(L-off-w):off};delete next.edge;return next;
  };
  const nextRoom:Room={...room,width:norm.width,depth:norm.depth};
  if(norm.outline)nextRoom.outline=norm.outline;else delete nextRoom.outline;
  if(room.openings)nextRoom.openings=room.openings.map((o,i)=>place(o,(o.type==='window'?'Окно ':'Дверь ')+(i+1),false));
  if(room.fixtures)nextRoom.fixtures=room.fixtures.map((f,i)=>place(f,'О'+(i+1),true));
  if(room.obstacles&&(dx||dz))nextRoom.obstacles=room.obstacles.map(o=>({...o,x:r1(o.x+dx),z:r1(o.z+dz)}));
  const next:Project={...p,room:nextRoom};
  if(dx||dz){
    next.modules=p.modules.map(a=>({...a,x:r1(a.x+dx),z:r1(a.z+dz)}));
    if(p.dimensions)next.dimensions=p.dimensions.map(d=>({...d,from:[r1(d.from[0]+dx),r1(d.from[1]+dz)],to:[r1(d.to[0]+dx),r1(d.to[1]+dz)]}));
    // линия Q — плоскость n·P = at: сдвиг комнаты (dx, 0, dz) добавляет n·сдвиг
    if(p.guides)next.guides=p.guides.map(g=>({...g,at:r1(g.at+g.n[0]*dx+g.n[2]*dz)}));
  }
  return {project:next,problem};
}

/** Короткая причина отказа правки формы (в плашке и сообщении): ошибки контура, корпус вне комнаты, остальное — как есть. */
export function shapeProblem(next:Project,pre?:string):string|null{
  const o=next.room.outline,e=o?outlineError(o):null;
  if(e){const m=/стена (\d+) короче (\d+)/.exec(e);if(m)return `Стена ${m[1]} короче ${m[2]} мм`;if(/пересекает/.test(e))return 'Стены пересекаются';if(/полуокружности/.test(e))return 'Дуга больше полуокружности';if(/от 3 до/.test(e))return 'Нужно от 3 до 40 углов';if(/координаты/.test(e))return 'Комната больше 20 000 мм';return e;}
  if(pre)return pre;
  const errs=projectErrors(next,true);
  const out=errs.find(x=>/корпус выходит за границы помещения/.test(x));
  if(out)return `Корпус «${out.split(': корпус выходит')[0]}» оказывается вне комнаты`;
  if(errs.some(x=>/^Размеры помещения/.test(x)))return 'Комната от 500 до 20 000 мм по габариту';
  return errs[0]??null;
}
/** Правка формы целиком: новый контур → проект и причина отказа (null — можно). */
export function shapeEdit(p:Project,raw:RoomOutline,edgeMap?:EdgeMap):{project:Project;problem:string|null}{
  const r=applyOutline(p,raw,edgeMap);return {project:r.project,problem:shapeProblem(r.project,r.problem)};
}

/** Набор при тяге угла «dx;dz» (как «600;2400» у угла корпуса): число без знака идёт в сторону мыши по своей оси, «-» — явно
 *  влево/назад; одно число — только X, «;300» — только Z. null — набор неполный. */
export function parseShiftTyped(text:string,mouse:P2):P2|null{
  const parts=text.split(';');if(parts.length>2)return null;
  const val=(s:string,dir:number)=>{const t=s.trim().replace(',','.');if(!t)return 0;if(!/^-?\d*\.?\d*$/.test(t)||t==='-'||t==='.'||t==='-.')return NaN;const v=Number(t);return t.startsWith('-')?v:(dir<0?-v:v);};
  const x=val(parts[0],mouse.x),z=val(parts[1]??'',mouse.z);
  if(!Number.isFinite(x)||!Number.isFinite(z)||(!parts[0].trim()&&!(parts[1]??'').trim()))return null;
  return {x:r1(x),z:r1(z)};
}
/** Набор при переносе стены: одно число, без знака — в сторону мыши (наружу/внутрь). */
export function parseWallTyped(text:string,mouseOut:number):number|null{
  const t=text.trim().replace(',','.');if(!t||!/^-?\d*\.?\d*$/.test(t)||t==='-'||t==='.')return null;
  const v=Number(t);return Number.isFinite(v)?r1(t.startsWith('-')?v:mouseOut<0?-v:v):null;
}

/** Привязка угла при тяге (без Alt/Ctrl): шаг 10 мм; соседние стены — ровно по горизонтали/вертикали (x или z как у соседа),
 *  под 45°, и линии Q плана (xs — вертикальные линии x = …, zs — горизонтальные z = …). tol — допуск, мм. */
export function snapVertex(p:P2,prev:P2,next:P2,xs:number[],zs:number[],tol:number):{p:P2;what:string[]}{
  const what:string[]=[];let x=Math.round(p.x/10)*10,z=Math.round(p.z/10)*10;
  const pick=(v:number,raw:number,cands:{v:number;w:string}[])=>{let best:{v:number;w:string}|undefined;for(const c of cands)if(Math.abs(c.v-raw)<=tol&&(!best||Math.abs(c.v-raw)<Math.abs(best.v-raw)))best=c;return best;};
  const bx=pick(x,p.x,[...xs.map(v=>({v,w:'линия Q'})),{v:prev.x,w:'стена вертикально'},{v:next.x,w:'стена вертикально'}]);
  const bz=pick(z,p.z,[...zs.map(v=>({v,w:'линия Q'})),{v:prev.z,w:'стена горизонтально'},{v:next.z,w:'стена горизонтально'}]);
  if(bx){x=bx.v;what.push(bx.w);}if(bz){z=bz.v;what.push(bz.w);}
  if(!bx&&!bz){
    // 45° к соседу: точка на диагонали через соседа, если близко
    for(const q of [prev,next])for(const k of [1,-1]){
      const t=((p.x-q.x)+k*(p.z-q.z))/2,P={x:q.x+t,z:q.z+k*t};
      if(Math.hypot(P.x-p.x,P.z-p.z)<=tol){x=r1(P.x);z=r1(P.z);what.push('стена под 45°');return {p:{x,z},what};}
    }
  }
  return {p:{x:r1(x),z:r1(z)},what:[...new Set(what)]};
}

/** Таблица стен: длина, угол в начале стены (между стеной i−1 и i), стрела дуги. */
export function wallRows(o:RoomOutline){return o.map((q,i)=>({i,length:Math.round(edgeLength(o,i)),angle:cornerAngle(o,i),bulge:q.bulge??0}));}
/** Подпись стены по направлению: задняя/правая/передняя/левая, наискось — «скос», дуга — «дуга». */
export function wallName(o:RoomOutline,i:number):string{
  if(o[i].bulge)return 'дуга';
  const f=edgeFrame(o,i),ax=Math.abs(f.t.x),az=Math.abs(f.t.z);
  if(ax>0.02&&az>0.02)return 'скос';
  return ({back:'задняя',front:'передняя',left:'левая',right:'правая'} as const)[legacyWall(o,i)];
}
