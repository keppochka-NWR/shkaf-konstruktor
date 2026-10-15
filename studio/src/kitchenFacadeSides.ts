import type {Module,Part} from './model';
export type FacadeSides = { left?: boolean; right?: boolean; toFloor?: boolean };
export const facadeSide = (m:Module, side:'left'|'right') => !!m.kitchen?.facadeSides?.[side];
export const facadeSideToFloor = (m:Module, side:'left'|'right') => facadeSide(m,side) && m.kitchen?.facadeSides?.toFloor !== false && ['base','tall'].includes(m.kitchen?.role??'');
/** Existing imported sideDown remains authoritative on unselected sides. */
export const droppedSide = (m:Module, side:'left'|'right') => facadeSideToFloor(m,side) || m.kitchen?.sideDown?.side===side;
export function facadeSideErrors(m:Module):string[] {
 if(!facadeSide(m,'left')&&!facadeSide(m,'right'))return [];
 if(m.alu||m.vernissage||(m.facadeT??16)!==16)return ['Боковины из фасадного материала: выберите плитный материал толщиной 16 мм. Рамочные фасады и МДФ другой толщины требуют отдельного конструктива стойки.'];
 if(m.corner||m.casework||m.kitchen?.sideRecess||m.kitchen?.sideNotch||m.kitchen?.sideStrip)return ['Фасадные боковины: для этого сложного корпуса сначала нужен отдельный конструктив торца.'];
 return [];
}
export function finishFacadeSides(m:Module,out:Part[]):void {
 for(const side of ['left','right'] as const){
  if(!facadeSide(m,side))continue;
  const p=out.find(p=>p.id===side);if(!p)continue;
  p.facadeSide=true;p.decor=m.facadeDecor;p.name+=' · фасадный материал';
  const edge=m.facadeMaterial==='external' ? m.facadeEdge??0 : m.edgeFacade??2;
  p.edge=[edge,edge,edge,edge];
  if(m.facadeMaterial==='external')p.external=true;
 }
}
