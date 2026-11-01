// Что убирает «Скрыть фасады» (одно правило для сцены и кнопки): двери распашные и полотна купе с петлями и их ручками;
// ящики остаются с фасадами — это наполнение. Кнопка серая, только если скрывать нечего (критик 31.10).
import {parts,type Module,type Part} from './model';

export const hiddenWithFacades=(part:Pick<Part,'id'|'role'>)=>part.role==='door'||part.role==='hinge'||(part.role==='handle'&&!part.id.includes(':drawer:'))||(part.id.endsWith(':facade')&&!part.id.includes(':drawer:'));

export function hasHideableFacades(modules:Module[]):boolean{
 return modules.some(m=>{try{return parts(m).some(hiddenWithFacades);}catch{return false;}});
}
