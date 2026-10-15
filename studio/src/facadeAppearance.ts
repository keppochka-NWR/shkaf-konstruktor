import {parts,validate,type Module} from './model';
import type {Project} from './project';
import {DEFAULT_VERNISSAGE} from './facadesVernissage';
import {DEFAULT_ALU} from './alu';
export type FacadeKind='ldsp'|'vernissage'|'alu'|'external';
export const facadeKind=(m:Module):FacadeKind=>m.vernissage?'vernissage':m.alu?'alu':m.facadeMaterial==='external'?'external':'ldsp';
export function changeFacadeKind(m:Module,kind:FacadeKind):Module {
 const n=structuredClone(m);
 if(kind===facadeKind(n))return n;
 delete n.vernissage;delete n.alu;delete n.facadeMaterial;delete n.facadeT;
 if(kind==='vernissage'){n.vernissage={...DEFAULT_VERNISSAGE};n.facadeT=DEFAULT_VERNISSAGE.thickness;}
 if(kind==='alu')n.alu={...DEFAULT_ALU};
 if(kind==='external')n.facadeMaterial='external';
 return n;
}
const keys=['facadeDecor','drawerFacadeDecor','facadeMaterial','alu','vernissage','facadeT','edgeFacade'] as const;
const eligible=(m:Module)=>!m.raw&&!m.bazis&&!m.kupe&&!m.worktop&&!m.desk&&parts(m).some(p=>p.facadeSide||p.role==='door'||p.id.endsWith(':facade'));
/** Appearance only. Never enables doors or copies dimensions, opening or drawer layout. */
export function applyFacadeAppearance(project:Project,id:string,draft:Module,scope:boolean|string[]=false):Project {
 const current=project.modules.find(a=>a.id===id);
 if(!current||!eligible(current.module))throw Error('Выберите редактируемый корпус с фасадами.');
 const next=structuredClone(project);
 for(const a of next.modules){
  const selected=Array.isArray(scope)?scope.includes(a.id):scope===true||a.id===id;
  if(!selected||!eligible(a.module))continue;
  for(const key of keys){delete a.module[key];if(draft[key]!==undefined)Object.assign(a.module,{[key]:structuredClone(draft[key])});}
  const errors=validate(a.module);if(errors.length)throw Error(a.module.name+': '+errors[0]+' Изменения не применены.');
 }
 return next;
}
