import {validate,type Module} from './model';
import type {Project} from './project';
const eligible=(m:Module)=>!m.raw&&!m.bazis&&!m.worktop&&!m.kupe&&!m.desk&&!['oven','dishwasher'].includes(m.kitchen?.appliance??'');
/** Copies appearance, never layout, per-leaf handles, openings or imported fabrication. Atomic. */
export function applyFacadeStyle(project:Project,sourceId:string):Project {
 const source=project.modules.find(a=>a.id===sourceId)?.module;
 if(!source||!eligible(source))throw Error('Выберите редактируемый корпус с фасадами.');
 const next=structuredClone(project);
 const keys=['doors','facadeDecor','drawerFacadeDecor','facadeMaterial','alu','vernissage','facadeT','edgeFacade'] as const;
 for(const a of next.modules){if(!eligible(a.module)||a.id===sourceId)continue;
  for(const key of keys){delete a.module[key];if(source[key]!==undefined)Object.assign(a.module,{[key]:structuredClone(source[key])});}
  if(source.doors)a.module.sections.forEach(s=>delete s.removedDoors);
  const error=validate(a.module)[0];if(error)throw Error(`${a.module.name}: ${error} Изменения не применены ни к одному модулю.`);
 }
 return next;
}
