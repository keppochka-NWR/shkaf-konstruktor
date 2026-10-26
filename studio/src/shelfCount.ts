// Количество полок числом (п.17 волны 22.10): поле «Полок в секции» расставляет полки равномерно, как «Распределить полки».
import {RULES,distribute,plinth,drawerStackHeight,validate,boxes,type Module,type Section} from './model';

/** Сколько полок помещается равномерно: между поверхностями полок, дна, крыши и блока ящиков — не меньше 80 мм (как в validate). */
export function maxEvenShelves(m:Module,s:Section):number{
  const h=m.height-plinth(m)-2*RULES.panel;
  let base=s.drawers?drawerStackHeight(s)+RULES.panel:0;
  if(s.rod)base=Math.max(base+RULES.rodMinClear+RULES.rodTopOffset,s.rodAt===undefined?0:s.rodAt*h+RULES.rodTopOffset-RULES.panel/2);
  const fit=Math.floor((h-base-RULES.shelfMinClear)/(RULES.panel+RULES.shelfMinClear));
  // v3 (замер удобства 22.10): оценка выше осторожна (+16 над ящиками) — в нишу над ящиками комода полка не добавлялась («от 0 до 0»).
  // Итог сверяем с validate: сколько полок поровну реально проходит проверку (±2 от оценки).
  const ok=(n:number)=>{if(n<=0)return true;const t=structuredClone(m),ts=t.sections.find(x=>x.id===s.id);if(!ts)return false;ts.shelves=distribute(t,ts,n);for(const k of ['fixed','glassShelves','thickShelves','shelfLights'] as const)delete ts[k];const e0=new Set(validate({...t,sections:t.sections.map(x=>x.id===s.id?{...x,shelves:[]}:x)}));return validate(t).every(e=>e0.has(e));};
  let n=Math.max(0,Math.min(RULES.maxShelves,fit));
  for(let k=0;k<2&&n<RULES.maxShelves&&ok(n+1);k++)n++;
  while(n>0&&!ok(n))n--;
  return n;
}
/** Задать число полок секции: все полки заново поровну; жёсткость, стекло и подсветка остаются у полок с теми же номерами. */
export function setShelfCount(m:Module,s:Section,count:number){
  const n=Math.max(0,Math.min(RULES.maxShelves,Math.round(count)));
  // v5 (замер удобства 22.10): выставленные вручную проёмы не сбрасываются числом полок — новые полки встают в самые большие
  // проёмы, лишние снимаются сверху; поровну — только если полки уже стояли поровну (или кнопкой «Распределить полки»)
  const cur=[...s.shelves].sort((a,b)=>a-b),even=cur.length?distribute(m,s,cur.length):[];
  const manual=cur.length>0&&n>0&&cur.some((f,i)=>Math.abs(f-(even[i]??-1))>0.002);
  let kept:number[]|null=null;
  if(manual){
    const b=boxes(m).find(x=>x.id===s.id),inner=b?b.top-b.bottom:0,low=inner&&s.drawers?Math.min(1,(drawerStackHeight(s)+RULES.panel)/inner):0;
    const list=cur.slice(0,n);
    while(list.length<n){const pts=[low,...list,1];let best=0,at=-1;for(let i=0;i+1<pts.length;i++)if(pts[i+1]-pts[i]>best){best=pts[i+1]-pts[i];at=i;}if(at<0)break;list.push((pts[at]+pts[at+1])/2);list.sort((a,b)=>a-b);}
    const t=structuredClone(m),ts=t.sections.find(x=>x.id===s.id)!,e0=new Set(validate(t));ts.shelves=list;
    if(list.length===n&&validate(t).every(e=>e0.has(e)))kept=list;
  }
  s.shelves=kept??(n?distribute(m,s,n):[]);
  for(const key of ['fixed','glassShelves','thickShelves','shelfLights'] as const){const kept=s[key]?.filter(j=>j<n);if(kept?.length)s[key]=kept;else delete s[key];}
}
