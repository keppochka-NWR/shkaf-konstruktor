// Число дверей при добавлении шкафа из палитры (п.21 волны 22.10, правки менеджеров по реальным задачам).
// Распашной шкаф: N дверей → ceil(N/2) секций, в каждой по две створки, при нечётном N в последней — одна.
// Ширины секций — пропорционально числу створок. Допустимые N — те, при которых модуль проходит validate()
// (предел ширины фасада 600/640 мм, минимум секции) и створка не уже MIN_LEAF.
import {RULES,validate,parts,section,type Module} from './model';

/** Самая узкая распашная створка, которую предлагает палитра, мм (предположение, вопрос Максу 22.10). */
export const MIN_LEAF=250;
const MAX_DOORS=2*RULES.maxSections;

/** Секции и створки под N дверей; наполнение каждой секции — как у первой (штанга и полка «Для одежды» — в каждой). */
export function withDoorCount(m:Module,count:number):Module{
  const n=structuredClone(m),k=Math.ceil(count/2),first=n.sections[0];
  n.sections=Array.from({length:k},(_,i)=>{
    const leaves=(i===k-1&&count%2===1?1:2) as 1|2;
    const base=i===0?first:{...structuredClone(first),...section(),shelves:[...first.shelves],rod:first.rod,drawers:0};
    return {...base,weight:leaves,doorLeaves:leaves};
  });
  return n;
}
/** Сколько дверей можно поставить: число створок, при котором модуль собирается без ошибок, а створка не уже MIN_LEAF. */
export function doorCountOptions(m:Module):number[]{
  if(!m.doors)return [];
  const out:number[]=[];
  for(let count=1;count<=MAX_DOORS;count++){
    try{
      const n=withDoorCount(m,count);
      if(validate(n).length)continue;
      const doors=parts(n).filter(p=>p.role==='door');
      if(doors.length&&doors.every(p=>p.width>=MIN_LEAF))out.push(count);
    }catch{/* не собирается — не предлагаем */}
  }
  return out;
}
/** Двери «авто» — как раньше: одна секция, створки по ширине. Подпись: сколько их получится. */
export function autoDoorCount(m:Module){
  try{return parts(m).filter(p=>p.role==='door').length;}catch{return 0;}
}
