import type {Module} from './model';
import {facadePanel} from './facadePanels';

export function setPanelFacade(m:Module,target:'facadeDecor'|'drawerFacadeDecor',decor:string){
 const p=facadePanel(decor);
 if(p&&(!p.thickness||!p.sheet))throw Error('Размеры этой панели требуют подтверждения поставщика.');
 if(m.vernissage||m.alu||m.facadeMaterial==='external')throw Error('Сначала выберите основу «ЛДСП / мебельная панель». Смена основы относится ко всем фасадам корпуса.');
 if(target==='facadeDecor'){
  // Explicit drawer finish must retain its physical thickness.
  if(m.drawerFacadeDecor&&m.drawerFacadeT===undefined)m.drawerFacadeT=m.facadeT??16;
  m.facadeDecor=decor;m.facadeT=p?.thickness??16;
 }else{m.drawerFacadeDecor=decor;m.drawerFacadeT=p?.thickness??16;}
}
