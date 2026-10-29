import {boxes,drawerConfig,drawerFaceSpan,drawerGripOn,drawerOffsets,drawerPitch,drawerStackHeight,drawersBehindDoors,fb,hasDrawerCap,innerTop,parts,RULES,type Module,type Section} from './model';
import type {DrawerConfig} from './hardware';

/** Grow a front upwards, pushing only the drawers it reaches. Source stays untouched. */
export function editDrawerConfig(m:Module,s:Section,index:number,patch:Partial<DrawerConfig>):DrawerConfig[] {
  const offsets=drawerOffsets(s);
  const configs=Array.from({length:s.drawers},(_,i)=>({...drawerConfig(m,s,i)}));
  if(!configs[index])throw Error('Ящик не найден.');
  const oldPitch=drawerPitch(configs[index],s.drawerGap);
  if(patch.y!==undefined)configs.forEach((c,i)=>c.y=offsets[i]);
  configs[index]={...configs[index],...patch};
  // критик 29.10 (п.5): фасад ниже короба с просветом — короб ниже вслед за фасадом (иначе между фасадами щель на разницу)
  if(patch.facadeH!==undefined&&!drawerGripOn(m,s,configs[index])){
    const c=configs[index],fh=patch.facadeH,clear=c.tray?10:RULES.drawerStep,need=fh+(s.drawerGap??RULES.drawerFrontGap)-clear,min=c.tray?40:68;
    if(c.height>need+0.01){if(need<min-0.01)throw Error(`Фасад ящика ${index+1} ${Math.round(fh)} мм ниже короба: короб не ниже ${min} мм, фасад — от ${Math.ceil(min+clear-(s.drawerGap??RULES.drawerFrontGap))} мм.`);configs[index]={...c,height:Math.floor(need*10)/10};}
  }
  const newPitch=drawerPitch(configs[index],s.drawerGap);
  if(patch.y!==undefined)return configs;
  const order=offsets.map((y,i)=>({y,i})).sort((a,b)=>a.y-b.y);
  if(newPitch<oldPitch&&configs.some(c=>c.y!==undefined)){
    // критик 29.10 (п.5): фасад/короб ниже — ящики, стоявшие на нём стопкой, опускаются вслед (без щели между фасадами);
    // верхний фасад до крыши при этом становится выше на столько же (он тянется до верха фасадов сам)
    configs.forEach((c,i)=>c.y=offsets[i]);
    let top=offsets[index]+oldPitch;const delta=oldPitch-newPitch;
    for(const next of order.slice(order.findIndex(o=>o.i===index)+1)){
      if(Math.abs(next.y-top)>0.01)break;
      top=next.y+drawerPitch(configs[next.i],s.drawerGap);configs[next.i].y=Math.round((next.y-delta)*100)/100;
    }
    return configs;
  }
  if(newPitch<=oldPitch)return configs;
  configs.forEach((c,i)=>c.y=offsets[i]);
  let top=offsets[index]+drawerPitch(configs[index],s.drawerGap);
  for(const next of order.slice(order.findIndex(o=>o.i===index)+1)){
    configs[next.i].y=Math.max(next.y,top);
    top=configs[next.i].y!+drawerPitch(configs[next.i],s.drawerGap);
  }
  const box=boxes(m).find(b=>b.id===s.id)!;
  const height=box.top-box.bottom,partitionCap=!!m.sectionLayout&&box.top<innerTop(m);
  const trayOnly=configs.every(c=>c.tray),cap=trayOnly?0:RULES.panel;
  const stack=drawerStackHeight({...s,drawerConfigs:configs});
  // комод с ящиками до крыши (полки над ящиками нет: «нет» или ящики до крыши, п.29) — потолок проёма — крыша, без запаса под полку
  // (заказ 7437584: ящики 260 / 260 / до крыши мышью не задавались — «не хватает 81 мм»)
  const noCap=!partitionCap&&!trayOnly&&!hasDrawerCap(m,{...s,drawerConfigs:configs},box);
  const ceiling=partitionCap||noCap?height:height-RULES.shelfMinClear-cap;
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

/** Видимая высота фасада ящика j — как его строит parts(): нижний накладной фасад опущен до низа фасадов, верхний «до крыши» —
 *  до верха фасадов, у фасада с заданной высотой — пол-зазора снизу. Поле «Высота фасада ящика» показывает и принимает ЕЁ
 *  (критик 29.10, п.5: менеджер вводит размер с эскиза, а модель понимала его как facadeH без продления — 196 → 210, «не хватает 15 мм»). */
export function visibleFacadeH(m:Module,s:Section,j:number):number|undefined{
  const sid=s.id,t={...m,sections:m.sections.map(x=>x.id===sid?s:x)};
  const p=parts(t).find(q=>q.id===`${sid}:drawer:${j}:facade`);
  return p?Math.round(p.size[1]*10)/10:undefined;
}
/** Настройки ящиков секции, при которых ВИДИМЫЙ фасад ящика j равен V: высота фасада модели подбирается с учётом продления фасада
 *  до низа/верха фасадов (editDrawerConfig: ящики выше сдвигаются вверх или опускаются вслед, без щели). Верхний фасад «до крыши»
 *  задают ящики ниже — для него понятная ошибка. */
export function facadeForVisible(m:Module,s:Section,j:number,V:number):DrawerConfig[]{
  const cur=visibleFacadeH(m,s,j);
  if(cur===undefined)throw Error('Фасад ящика не найден.');
  if(Math.abs(cur-V)<0.05)return Array.from({length:s.drawers},(_,i)=>({...drawerConfig(m,s,i)}));
  const c=drawerConfig(m,s,j),span=drawerFaceSpan(m,s,c),gap=s.drawerGap??(drawersBehindDoors(m,s)?RULES.drawerFrontGap:fb(m));
  // продление (видимая − модельная) при заданной высоте фасада: пол-зазора снизу добавляется, если высоты фасада ещё не было
  let fh=V-(cur-(span[1]-span[0]))-(c.facadeH===undefined&&!drawerGripOn(m,s,c)?gap/2:0);
  for(let k=0;k<4;k++){
    const configs=editDrawerConfig(m,s,j,{facadeH:Math.round(fh*10)/10});
    const got=visibleFacadeH(m,{...s,drawerConfigs:configs},j);
    if(got===undefined)break;
    if(Math.abs(got-V)<0.06)return configs;
    if(k===0&&Math.abs(got-cur)<0.05)throw Error(`Фасад ящика ${j+1} тянется до верха фасадов: его высоту задают ящики ниже. Измените их фасады или число ящиков.`);
    fh+=V-got;
  }
  throw Error(`Видимый фасад ${Math.round(V)} мм у ящика ${j+1} не получается: фасад продлевается до низа или верха фасадов. Измените число ящиков или фасады соседних ящиков.`);
}
