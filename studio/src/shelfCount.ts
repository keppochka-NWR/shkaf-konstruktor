// Количество полок числом (п.17 волны 22.10): поле «Полок в секции» расставляет полки равномерно, как «Распределить полки».
import {RULES,distribute,plinth,drawerStackHeight,type Module,type Section} from './model';

/** Сколько полок помещается равномерно: между поверхностями полок, дна, крыши и блока ящиков — не меньше 80 мм (как в validate). */
export function maxEvenShelves(m:Module,s:Section):number{
  const h=m.height-plinth(m)-2*RULES.panel;
  let base=s.drawers?drawerStackHeight(s)+RULES.panel:0;
  if(s.rod)base=Math.max(base+RULES.rodMinClear+RULES.rodTopOffset,s.rodAt===undefined?0:s.rodAt*h+RULES.rodTopOffset-RULES.panel/2);
  const fit=Math.floor((h-base-RULES.shelfMinClear)/(RULES.panel+RULES.shelfMinClear));
  return Math.max(0,Math.min(RULES.maxShelves,fit));
}
/** Задать число полок секции: все полки заново поровну; жёсткость, стекло и подсветка остаются у полок с теми же номерами. */
export function setShelfCount(m:Module,s:Section,count:number){
  const n=Math.max(0,Math.min(RULES.maxShelves,Math.round(count)));
  s.shelves=n?distribute(m,s,n):[];
  for(const key of ['fixed','glassShelves','shelfLights'] as const){const kept=s[key]?.filter(j=>j<n);if(kept?.length)s[key]=kept;else delete s[key];}
}
