// «Как мне быстро понять высоту левого модуля и сделать правый такой же высотой?» (Макс, 29.10.2026). Высота/глубина модуля —
// как у соседа слева/справа одним действием (круговое меню › Размеры), и выравнивание отмеченной группы по модулю (одна отмена).
// Правка — та же, что поле «Высота»/«Глубина» панели корпуса (App.tsx modify → commit): ящики подгоняются (fitDrawersAfterResize),
// малый корпус снимает невлезающее (resizeSmall), ширина в ряду не меняется, корпус под потолком растёт вниз (верх остаётся у потолка),
// стоящий на полу — вверх. Нарушение пределов — понятная причина, проект не меняется.
import {fitDrawersAfterResize,shelfMaxDepth,validate,type Module} from './model';
import {projectErrors,applyAutoFillers,bounds,type Project,type PlacedModule} from './project';
import {placeInRow,gaps} from './rowResize';
import {resizeSmall} from './smallSize';
import {layoutKitchenDrawers} from './kitchenEditing';

export type SizeKey='height'|'depth';
export const SIZE_WORD:Record<SizeKey,string>={height:'Высота',depth:'Глубина'};
type Side='left'|'right';

/** Высота или глубина корпуса id = value (как ввод в поле панели). notes — что снял малый корпус. */
export function setModuleSize(p:Project,id:string,key:SizeKey,value:number):{project:Project;notes:string[]}{
 const a=p.modules.find(x=>x.id===id);if(!a)throw Error('Модуль не найден.');
 const m=a.module,next=structuredClone(m);next[key]=value;
 if(key==='height'&&next.height!==m.height&&!next.corner){fitDrawersAfterResize(next,m);if(next.gola&&next.kdrawers?.length)next.kdrawers=layoutKitchenDrawers(next,next.kdrawers.length,undefined,next.kdrawers[0].system);}
 if(key==='depth'&&next.kitchen)for(const s of next.sections){if(s.shelfDepth!==undefined){const old=m.sections.find(v=>v.id===s.id)?.shelfDepth;if(!s.shelves.length)delete s.shelfDepth;else s.shelfDepth=Math.max(60,Math.min(shelfMaxDepth(next),next.depth-(m.depth-(old??s.shelfDepth))));}}
 const notes=resizeSmall(m,next,undefined,fitDrawersAfterResize).notes;
 const err=validate(next)[0];if(err)throw Error(`«${m.name}»: ${err}`);
 let n=placeInRow(p,id,next);
 // x4 (замер кухонь 22.10): корпус под потолком растёт по высоте вниз — верх остаётся у потолка (как commit в App.tsx)
 const top=(a.y??0)+m.height;
 if(key==='height'&&next.height>m.height&&(a.y??0)>0&&Math.abs(top-p.room.height)<=2){const y=Math.max(0,Math.round((top-next.height)*10)/10);n={...n,modules:n.modules.map(x=>x.id===id?{...x,y}:x)};}
 const pe=projectErrors(applyAutoFillers(n))[0];if(pe)throw Error(pe);
 return {project:n,notes};
}

/** Колонна модуля (уточнение Макса 29.10): соседом часто бывает СТОПКА — тумба с ящиками + малый модуль + высокий с дверью, всего 2500.
 *  Колонна — модули, стоящие друг на друге (по высоте вплотную, ±5 мм) над одним местом пола (план перекрывается не меньше чем на
 *  половину меньшего из двух). Высота колонны — от низа нижнего до верха верхнего. Столешницы, объекты «Ряда» Базиса и купе не входят. */
export type Column={ids:string[];bottom:number;top:number;height:number};
const STACK_GAP=5;
const inColumn=(m:PlacedModule['module'])=>!m.worktop&&!m.raw?.row&&!m.kupe;
export function columnOf(modules:readonly PlacedModule[],id:string):Column{
 const a=modules.find(x=>x.id===id);if(!a)throw Error('Модуль не найден.');
 const box=new Map(modules.map(x=>[x.id,bounds(x)]));
 const plan=(i:string,j:string)=>{const p=box.get(i)!,q=box.get(j)!,w=Math.min(p.x+p.w,q.x+q.w)-Math.max(p.x,q.x),d=Math.min(p.z+p.d,q.z+q.d)-Math.max(p.z,q.z);
  return w>0&&d>0&&w*d>=0.5*Math.min(p.w*p.d,q.w*q.d);};
 const span=(x:PlacedModule)=>({lo:x.y??0,hi:(x.y??0)+x.module.height});
 const ids=[a.id];
 for(let added=true;added;){added=false;
  for(const b of modules){
   if(ids.includes(b.id)||!inColumn(b.module))continue;
   const sb=span(b);
   if(ids.some(i=>{const o=modules.find(x=>x.id===i)!,so=span(o);return plan(i,b.id)&&(Math.abs(sb.lo-so.hi)<=STACK_GAP||Math.abs(so.lo-sb.hi)<=STACK_GAP);})){ids.push(b.id);added=true;}
  }
 }
 const spans=ids.map(i=>span(modules.find(x=>x.id===i)!)),bottom=Math.min(...spans.map(s=>s.lo)),top=Math.max(...spans.map(s=>s.hi));
 return {ids,bottom,top,height:Math.round((top-bottom)*10)/10};
}
/** Размер «как у соседа»: высота — колонны соседа, глубина — модуля соседа. */
const sizeOf=(p:Project,id:string,key:SizeKey)=>key==='height'?columnOf(p.modules,id).height:p.modules.find(x=>x.id===id)!.module[key];

export type NeighborSize={side:Side;id?:string;name?:string;value?:number;
 /** Модулей в колонне соседа (больше 1 — стопка). */
 stack?:number;
 /** Готовый проект (можно применить) или причина, почему пункт недоступен. */
 project?:Project;notes?:string[];problem?:string};
/** Сосед слева/справа (если смотреть на фасад) — ближайший модуль ряда на той же высоте, как у плашек зазоров; высота — его колонны. */
export function neighborSize(p:Project,id:string,side:Side,key:SizeKey):NeighborSize{
 const a=p.modules.find(x=>x.id===id);if(!a)return {side,problem:'Модуль не найден.'};
 let g;try{g=gaps(p,id)[side];}catch(e){return {side,problem:(e as Error).message};}
 const o=g.id?p.modules.find(x=>x.id===g.id):undefined;
 const where=side==='left'?'Слева':'Справа';
 if(!o)return {side,problem:`${where} нет соседнего модуля (${g.what}).`};
 if(o.module.kupe||o.module.worktop)return {side,id:o.id,name:o.module.name,problem:`${where} — ${o.module.kupe?'двери купе':'столешница'}, не корпус.`};
 const value=sizeOf(p,o.id,key),stack=key==='height'?columnOf(p.modules,o.id).ids.length:1,base={side,id:o.id,name:o.module.name,value,stack};
 if(Math.abs(value-a.module[key])<0.05)return {...base,problem:`${SIZE_WORD[key]} уже ${value} мм, как у ${stack>1?'колонны соседа':`«${o.module.name}»`}.`};
 try{const r=setModuleSize(p,id,key,value);return {...base,project:r.project,notes:r.notes};}
 catch(e){return {...base,problem:(e as Error).message};}
}

export type GroupSizeResult={project:Project;changed:string[];skipped:{id:string;name:string;reason:string}[];notes:string[];value:number};
/** «Выровнять высоту по …»: всем отмеченным — высота колонны (глубина модуля) sourceId. Модули самой колонны не трогаются.
 *  Не встающие — пропуск с причиной. Одна отмена. */
export function matchGroupSize(p:Project,ids:readonly string[],sourceId:string,key:SizeKey):GroupSizeResult{
 const src=p.modules.find(x=>x.id===sourceId);if(!src)throw Error('Модуль не найден.');
 const own=key==='height'?columnOf(p.modules,sourceId).ids:[sourceId];
 const value=sizeOf(p,sourceId,key);let n=p;const changed:string[]=[],skipped:GroupSizeResult['skipped']=[],notes:string[]=[];
 for(const id of ids){
  if(own.includes(id))continue;const a=n.modules.find(x=>x.id===id);if(!a)continue;
  if(a.module.kupe||a.module.worktop){skipped.push({id,name:a.module.name,reason:a.module.kupe?'двери купе':'столешница'});continue;}
  if(Math.abs(a.module[key]-value)<0.05)continue;
  try{const r=setModuleSize(n,id,key,value);n=r.project;changed.push(id);notes.push(...r.notes);}
  catch(e){skipped.push({id,name:a.module.name,reason:(e as Error).message.replace(/^«[^»]*»: /,'').replace(/\.$/,'')});}
 }
 if(!changed.length&&skipped.length)throw Error(`${SIZE_WORD[key]} ${value} мм не встала ни одному из отмеченных: `+skipped.map(s=>`«${s.name}» — ${s.reason}`).join('; ')+'.');
 return {project:n,changed,skipped,notes,value};
}
