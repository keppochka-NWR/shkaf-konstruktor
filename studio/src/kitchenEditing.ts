import type {Module} from './model';
import {kitchenDrawerErrors,relayoutKDrawers,type KDrawerSystem} from './kitchenDrawers';

// верх колонки фасадов под профилем L (height − faceTop) раскладка ставит сама (facadeColumn), здесь — только отступы у профилей C
const frontInset=(index:number,count:number)=>(index?13.5:0)+(index===count-1?0:13.5);
const proportions=(m:Module)=>m.kdrawers?.map((d,i)=>d.y1-d.y0+(m.gola?frontInset(i,m.kdrawers!.length):0));
/** Reconfigure a whole base-unit drawer stack without replacing its carcass or dimensions. */
export function layoutKitchenDrawers(m:Module,count:number,ratios?:number[],system?:KDrawerSystem){
  ratios??=m.kdrawers?.length===count?proportions(m):undefined;
  const plain={...m,gola:undefined};
  let drawers=relayoutKDrawers(plain,count,ratios,system);
  if(m.gola){
    // Standard L 57.5 x 27 at the top and C 73 x 27 between fronts, from the existing profile geometry.
    const cuts=[{top0:0,top1:57.5,depth:27,r:6.5},...drawers.slice(0,-1).map((d,i)=>{
      const center=(d.y1+drawers[i+1].y0)/2,top=m.height-center;
      return {top0:top-36.5,top1:top+36.5,depth:27,r:5};
    })];
    m.gola={cuts,faceTop:30};
    drawers=relayoutKDrawers(m,count,ratios,system).map((d,i)=>({...d,
      y0:d.y0+(i?13.5:0),y1:d.y1-(i===count-1?0:13.5)}));
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
