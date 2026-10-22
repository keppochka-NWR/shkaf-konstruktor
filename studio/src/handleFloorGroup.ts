// m6 (критик релиза 22.10): «Высота ручки от пола» была только у выбранного фасада. Здесь — то же поле для всех распашных дверей
// модуля (раздел «Ручки»): та же функция setDoorHandleFloor по каждой створке, те же пределы doorHandleFloorInfo.
import {parts,doorHandleFloorInfo,setDoorHandleFloor,type Module} from './model';

export type ModuleHandleFloor={ids:string[];value:number;min:number;max:number;mixed:boolean;set:boolean;long:'all'|'none'|'some'};
/** Двери модуля с вертикальной ручкой и их общая высота ручки от низа корпуса; undefined — таких дверей нет (push-to-open, без ручек). */
export function moduleHandleFloor(m:Module):ModuleHandleFloor|undefined{
  const doors=parts(m).filter(p=>p.role==='door').flatMap(d=>{const hf=doorHandleFloorInfo(m,d.id);return hf?[{id:d.id,hf}]:[];});
  if(!doors.length)return undefined;
  const values=new Set(doors.map(d=>d.hf.value)),longs=doors.filter(d=>d.hf.long).length;
  // общий предел — где ручка помещается на всех дверях; если такого нет (двери разной высоты) — объединение, у края ручка прижмётся к фасаду
  const lo=Math.max(...doors.map(d=>Math.min(d.hf.min,d.hf.max))),hi=Math.min(...doors.map(d=>Math.max(d.hf.min,d.hf.max)));
  const min=lo<=hi?lo:Math.min(...doors.map(d=>Math.min(d.hf.min,d.hf.max))),max=lo<=hi?hi:Math.max(...doors.map(d=>Math.max(d.hf.min,d.hf.max)));
  return {ids:doors.map(d=>d.id),value:doors[0].hf.value,min,max,mixed:values.size>1,set:doors.some(d=>d.hf.set),long:longs===doors.length?'all':longs?'some':'none'};
}
/** Задать высоту ручки от пола (от низа корпуса) всем распашным дверям модуля; null — вернуть правило. */
export function setModuleHandleFloor(m:Module,v:number|null){
  const g=moduleHandleFloor(m);if(!g)throw Error('В модуле нет распашных дверей с вертикальной ручкой.');
  for(const id of g.ids)setDoorHandleFloor(m,id,v);
}
