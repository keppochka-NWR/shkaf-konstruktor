import {parts,validate} from './model';
import {projectErrors,type Project} from './project';
import {setKitchenGola} from './kitchenEditing';
import {blockingDesignChanges} from './editableDesignIssues';

/** Applies the current module's Gola state, preserving existing custom profiles. */
export function applyKitchenGola(project:Project,enabled:boolean,ids?:readonly string[]){
 let next=structuredClone(project);
 const changed:string[]=[],skipped:{name:string;reason:string}[]=[];
 for(const placed of project.modules){
  if(ids&&!ids.includes(placed.id))continue;
  const m=placed.module;
  const reason=m.raw||m.bazis?'Импортированный корпус':m.kitchen?.role!=='base'?'Не нижний кухонный корпус':m.kitchen.appliance==='oven'?'Модуль духовки: требуется отдельная схема профиля':!parts(m).some(p=>p.role==='door'||p.id.endsWith(':facade'))?'Нет фасадов':null;
  if(reason){skipped.push({name:m.name,reason});continue;}
  if(!!m.gola===enabled)continue;
  const candidate=structuredClone(next),target=candidate.modules.find(a=>a.id===placed.id)!.module;
  try{
   setKitchenGola(target,enabled);
   const errors=blockingDesignChanges(validate(m),validate(target));
   errors.push(...blockingDesignChanges(projectErrors(next),projectErrors(candidate)));
   if(errors.length)throw Error(errors[0]);
   next=candidate;changed.push(placed.id);
  }catch(e){skipped.push({name:m.name,reason:(e as Error).message});}
 }
 return {project:next,changed,skipped};
}
