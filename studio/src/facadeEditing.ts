import {parts,type Module} from './model';
import {syncKitchenLift} from './kitchenLift';

/** Explicit rehang of one real door; all other leaves retain their individual settings. */
export function setDoorHinge(module:Module,doorId:string,side:'left'|'right'|'top'):void {
 const door=parts(module).find(p=>p.id===doorId&&p.role==='door');
 const match=doorId.match(/:door:(\d+)$/),section=module.sections.find(s=>s.id===door?.sectionId);
 if(!door||!match||!section||module.raw)throw Error('Выберите отдельный распашной фасад.');
 const index=Number(match[1]);
 section.doorHinges=Array.from({length:Math.max(4,index+1,section.doorHinges?.length??0)},(_,i)=>i===index?side:section.doorHinges?.[i]??null);
 syncKitchenLift(module);
}
