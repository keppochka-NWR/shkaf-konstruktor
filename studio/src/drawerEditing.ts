import {boxes,drawerConfig,drawerOffsets,drawerPitch,drawerStackHeight,innerTop,RULES,type Module,type Section} from './model';
import type {DrawerConfig} from './hardware';

/** Grow a front upwards, pushing only the drawers it reaches. Source stays untouched. */
export function editDrawerConfig(m:Module,s:Section,index:number,patch:Partial<DrawerConfig>):DrawerConfig[] {
  const offsets=drawerOffsets(s);
  const configs=Array.from({length:s.drawers},(_,i)=>({...drawerConfig(m,s,i)}));
  if(!configs[index])throw Error('Ящик не найден.');
  const oldPitch=drawerPitch(configs[index],s.drawerGap);
  if(patch.y!==undefined)configs.forEach((c,i)=>c.y=offsets[i]);
  configs[index]={...configs[index],...patch};
  if(patch.y!==undefined||drawerPitch(configs[index],s.drawerGap)<=oldPitch)return configs;
  configs.forEach((c,i)=>c.y=offsets[i]);
  const order=offsets.map((y,i)=>({y,i})).sort((a,b)=>a.y-b.y);
  let top=offsets[index]+drawerPitch(configs[index],s.drawerGap);
  for(const next of order.slice(order.findIndex(o=>o.i===index)+1)){
    configs[next.i].y=Math.max(next.y,top);
    top=configs[next.i].y!+drawerPitch(configs[next.i],s.drawerGap);
  }
  const box=boxes(m).find(b=>b.id===s.id)!;
  const height=box.top-box.bottom,partitionCap=!!m.sectionLayout&&box.top<innerTop(m);
  const trayOnly=configs.every(c=>c.tray),cap=trayOnly?0:RULES.panel;
  const stack=drawerStackHeight({...s,drawerConfigs:configs});
  const ceiling=partitionCap?height:height-RULES.shelfMinClear-cap;
  if(stack>ceiling+.001)throw Error(`Для увеличения фасада и подъёма верхних ящиков не хватает ${Math.ceil(stack-ceiling)} мм до крыши или перегородки. Уменьшите фасад либо увеличьте проём.`);
  s.shelves.forEach((f,j)=>{
    const y=f*height,half=RULES.panel/2;
    // заказ 7427796 (как validate в model.ts): без полки над ящиками жёсткая полка (посадочное место) может лежать прямо на ящиках —
    // её низ (у полки 32 — низ нижней плиты) не ниже верха шага ящика
    const seat=s.drawerCap===false&&s.fixed?.includes(j)?(s.thickShelves?.includes(j)?RULES.panel:0):undefined;
    for(const c of configs){
      const bottom=c.y!,end=bottom+drawerPitch(c,s.drawerGap)+(trayOnly?20:RULES.panel+RULES.shelfMinClear);
      if(seat!==undefined){const top=bottom+drawerPitch(c,s.drawerGap);if(y+half>bottom+.001&&y-half-seat<top-.001)throw Error(`Ящик заходит под посадочное место: опустите ящик или уменьшите фасад на ${Math.ceil(top-(y-half-seat))} мм.`);continue;}
      if(y+half>bottom-RULES.shelfMinClear+.001&&y-half<end-.001)
        throw Error(`Над ящиками мешает полка: для этой высоты фасада поднимите её минимум на ${Math.ceil(end+half-y)} мм либо уменьшите фасад.`);
    }
  });
  return configs;
}
