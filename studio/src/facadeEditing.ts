import {parts,type Module} from './model';
import {syncKitchenLift} from './kitchenLift';

/** Explicit rehang of one real door; all other leaves retain their individual settings. */
export function setDoorHinge(module:Module,doorId:string,side:'left'|'right'|'top'|'bottom',lift:'adagio'|'sempre'='adagio'):void {
 const original=module;module=structuredClone(module);
 const door=parts(module).find(p=>p.id===doorId&&p.role==='door');
 const match=doorId.match(/:door:(\d+)$/),section=module.sections.find(s=>s.id===door?.sectionId);
 if(!door||!match||!section||module.raw)throw Error('Выберите отдельный распашной фасад.');
 if((side==='top'||side==='bottom')&&(module.doorMount==='inset'||module.skew||module.corner||module.alu))throw Error('Петли сверху и снизу пока доступны прямому накладному фасаду ЛДСП.');
 if(side==='top'&&lift==='sempre'&&(module.height<240||module.height>600||module.depth<165||door.size[0]>1800))throw Error('Premial СЕМПРЕ: корпус высотой 240–600 мм, глубиной от 165 мм; фасад шириной до 1800 мм.');
 const index=Number(match[1]);
 if(side==='top'){
  section.doorLifts=Array.from({length:Math.max(4,index+1,section.doorLifts?.length??0)},(_,i)=>i===index?lift:section.doorLifts?.[i]??null);

  delete module.kitchenLift;
 }else if(section.doorLifts){section.doorLifts[index]=null;if(!section.doorLifts.some(Boolean))delete section.doorLifts;}

 section.doorHinges=Array.from({length:Math.max(4,index+1,section.doorHinges?.length??0)},(_,i)=>i===index?side:section.doorHinges?.[i]??null);
 syncKitchenLift(module);
 if(side==='top'||side==='bottom'){
  if(!parts(module).some(p=>p.id.startsWith(doorId.replace(':door:',':hingeplate:')+':')))throw Error('У кромки фасада нужна горизонталь корпуса или жёсткая полка для крепления петель.');
 }
 Object.assign(original,module);if(!module.kitchenLift)delete original.kitchenLift;
}

/** Одностворчатые распашные фасады корпуса (одна створка в своём ряду секции). Двустворчатые пары не трогаем. */
export function singleLeafDoors(module:Module){
 const doors=parts(module).filter(p=>p.role==='door'&&/:door:\d+$/.test(p.id)&&(p.hinge==='left'||p.hinge==='right'));
 return doors.filter(d=>!doors.some(o=>o!==d&&o.sectionId===d.sectionId&&Math.abs(o.position[1]-d.position[1])<1));
}

/** Перевесить все одностворчатые фасады корпуса на одну сторону (меню корпуса «Фасады → Открывание»). */
export function setModuleHingeSide(module:Module,side:'left'|'right'):number{
 const doors=singleLeafDoors(module);
 if(!doors.length)throw Error('У корпуса нет одностворчатых распашных фасадов. Отдельный фасад — правой кнопкой по нему.');
 for(const d of doors)setDoorHinge(module,d.id,side);
 return doors.length;
}
