import type {Module} from './model';
import {kitchenDrawerErrors,relayoutKDrawers,axisFits,withAxisH,AXIS_HEIGHTS,axisAvailable,type KDrawerSystem} from './kitchenDrawers';

// верх колонки фасадов под профилем L (height − faceTop) раскладка ставит сама (facadeColumn), здесь — только отступы у профилей C
const frontInset=(index:number,count:number)=>(index?13.5:0)+(index===count-1?0:13.5);
const proportions=(m:Module)=>m.kdrawers?.map((d,i)=>d.y1-d.y0+(m.gola?frontInset(i,m.kdrawers!.length):0));
/** Reconfigure a whole base-unit drawer stack without replacing its carcass or dimensions. */
export function layoutKitchenDrawers(m:Module,count:number,ratios?:number[],system?:KDrawerSystem,adjustment=0){
  ratios??=m.kdrawers?.length===count?proportions(m):undefined;
  const plain={...m,gola:undefined};
  let drawers=relayoutKDrawers(plain,count,ratios,system);
  if(m.gola){
    // Standard L 57.5 x 27 at the top and C 73 x 27 between fronts, from the existing profile geometry.
    const cutsFrom=(ds:typeof drawers)=>[{top0:0,top1:57.5,depth:27,r:6.5},...ds.slice(0,-1).map((d,i)=>{
      const center=(d.y1+ds[i+1].y0)/2,top=m.height-center;
      return {top0:top-36.5,top1:top+36.5,depth:27,r:5};
    })];
    const inset=(ds:typeof drawers)=>ds.map((d,i)=>({...d,y0:d.y0+(i?13.5:0),y1:d.y1-(i===count-1?0:13.5)}));
    // колонка фасадов с Gola — под профилем L (facadeColumn: height − faceTop), поэтому профили C ставятся по зазорам
    // раскладки с Gola, а не «плоской»: иначе профили стояли выше реальных зазоров и верхний ящик упирался в профиль
    m.gola={cuts:cutsFrom(drawers),faceTop:30};
    drawers=inset(relayoutKDrawers(m,count,ratios,system));
    m.gola={cuts:cutsFrom(drawers),faceTop:30};
    drawers=inset(relayoutKDrawers(m,count,ratios,system));
    drawers=drawers.map(d=>d.system==='axis-pro'&&!axisFits(m,d)?[...AXIS_HEIGHTS].reverse().map(h=>withAxisH(m,d,h)).find(k=>axisFits(m,k)&&axisAvailable(k))??d:d);
    const failed=drawers.findIndex(d=>!axisFits(m,d));
    if(failed>=0){
      // Preserve the bottom front requested by the manager; share the remaining height
      // between the upper fronts until the real boxes clear both Gola profiles.
      const donor=drawers.map((d,i)=>({i,h:d.y1-d.y0})).filter(d=>d.i!==failed&&(count<3||d.i!==0)).sort((a,b)=>b.h-a.h)[0];
      if(adjustment<80&&donor&&donor.h>100){const next=drawers.map((d,i)=>d.y1-d.y0+frontInset(i,count));next[failed]+=1;next[donor.i]-=1;return layoutKitchenDrawers(m,count,next,system,adjustment+1);}
      // причина — из проверки ящиков (пересечение профиля Gola / жёсткой полки), без неё — общая формулировка
      const why=kitchenDrawerErrors({...m,kdrawers:drawers}).find(e=>/пересекает профиль Gola|пересекает жёсткую полку/.test(e))??'ящик упирается в профиль Gola.';
      throw Error('Не хватает высоты для остальных фасадов: '+why+' Увеличьте верхний фасад, уменьшив нижний, либо уменьшите число ящиков.');
    }
  }
  return drawers;
}
export function setKitchenDrawerCount(m:Module,count:number){
  if(m.kitchen?.role!=='base'||m.kitchen.appliance)throw Error('Ящики доступны для нижнего корпуса без встроенной техники.');
  if(!Number.isInteger(count)||count<0||count>4)throw Error('Количество ящиков: от 0 до 4.');
  if(!count){delete m.kdrawers;m.doors=true;if(m.gola)m.gola={cuts:[{top0:0,top1:57.5,depth:27,r:6.5}],faceTop:30};return;}
  m.doors=false;
  m.sections=m.sections.map(s=>({...s,shelves:[],drawers:0,rod:false,pantograph:undefined,pullouts:undefined}));
  m.kdrawers=layoutKitchenDrawers(m,count);
}
export function setKitchenGola(m:Module,enabled:boolean){
  if(m.kitchen?.role!=='base')throw Error('Этот профиль доступен для нижних кухонных корпусов.');
  const ratios=proportions(m);
  if(enabled){m.gola={cuts:[{top0:0,top1:57.5,depth:27,r:6.5}],faceTop:30};m.noHandles=true;
    m.rails=m.rails?.map(r=>r.place.startsWith('front')?{...r,setback:Math.max(r.setback??0,28)}:r);
  }else{delete m.gola;delete m.noHandles;}
  if(m.kdrawers?.length)m.kdrawers=layoutKitchenDrawers(m,m.kdrawers.length,ratios,m.kdrawers[0].system);
}

export function resizeKitchenDrawerFront(m:Module,index:number,height:number){
  const ratios=proportions(m);if(!ratios||index<0||index>=ratios.length-1)throw Error('Выберите нижний или средний фасад.');
  const value=height+(m.gola?frontInset(index,ratios.length):0),delta=value-ratios[index];
  ratios[index]=value;ratios[ratios.length-1]-=delta;
  if(ratios.some(v=>v<=0))throw Error('Не хватает высоты для остальных фасадов.');
  const kdrawers=layoutKitchenDrawers(m,ratios.length,ratios);
  // верхнему ящику остаток может не хватить на фурнитуру под профилем Gola L (царга H-86 заходила в профиль молча, пока проверка
  // ящиков не знала профилей): раскладка с пересечением не возвращается — ошибка, как при нехватке высоты фасадов
  const bad=kitchenDrawerErrors({...m,kdrawers}).find(e=>/пересекает профиль Gola|пересекает жёсткую полку/.test(e));
  if(bad)throw Error('Не хватает высоты для остальных фасадов: '+bad);
  return kdrawers;
}
