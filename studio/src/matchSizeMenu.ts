// Пункты кругового меню «Высота/Глубина как у соседа слева/справа (N)» и «Выровнять высоту/глубину отмеченных по …» (Макс, 29.10.2026).
// Отдельный файл — чтобы не трогать общий quickMenu.ts (его правят другие ветки); в App.tsx — по одной строке вставки.
import {ArrowLeftToLine,ArrowRightToLine,Ruler} from 'lucide-react';
import type {RadialItem} from './RadialMenu';
import type {Project} from './project';
import {neighborSize,columnOf,SIZE_WORD,type SizeKey} from './matchSize';

const KEYS:SizeKey[]=['height','depth'];
/** «Высота как у соседа слева (2500)» … Недоступный пункт — с причиной в подсказке (нет соседа, уже так, не встаёт по пределам). */
export function matchSizeItems(p:Project,id:string,apply:(project:Project,notes:string[])=>void):RadialItem[]{
 return KEYS.flatMap(key=>(['left','right'] as const).map(side=>{
  const n=neighborSize(p,id,side,key),where=side==='left'?'слева':'справа';
  return {id:`match-${key}-${side}`,label:`${SIZE_WORD[key]} как у соседа ${where}${n.value!==undefined?` (${n.value})`:''}`,icon:side==='left'?ArrowLeftToLine:ArrowRightToLine,disabled:!n.project,
   hint:n.problem??(n.stack&&n.stack>1?`Колонна из ${n.stack} модулей: ${n.value} мм`:`Как у «${n.name}»`),
   run:()=>{if(n.project)apply(n.project,n.notes??[]);}} as RadialItem;
 }));
}
/** Мультивыбор: «Выровнять высоту по «Шкаф» (2500)» — всем отмеченным размер модуля, по которому щёлкнули. */
export function groupSizeItems(p:Project,ids:readonly string[],sourceId:string,run:(key:SizeKey)=>void):RadialItem[]{
 const src=p.modules.find(a=>a.id===sourceId);if(!src||ids.length<2)return [];
 const col=columnOf(p.modules,sourceId);
 return KEYS.map(key=>{const v=key==='height'?col.height:src.module[key],same=ids.every(id=>{const a=p.modules.find(x=>x.id===id);return !a||(key==='height'&&col.ids.includes(id))||Math.abs(a.module[key]-v)<0.05;});
  return {id:'group-match-'+key,label:`Выровнять ${key==='height'?'высоту':'глубину'} по «${src.module.name}»${key==='height'&&col.ids.length>1?' · колонна':''} (${v})`,icon:Ruler,disabled:same,
   hint:same?`У всех уже ${v} мм`:`Всем отмеченным ${v} мм`,run:()=>run(key)} as RadialItem;});
}
