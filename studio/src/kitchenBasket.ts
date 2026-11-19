import type {Module,Part} from './model';
/** FOCUS manufacturer drawing: full extension 420, minimum cabinet depth465,
 * free installation height170, case16/18. Wire section/height in preview are schematic. */
export const FOCUS_BASKETS=[{article:'090535',base:600},{article:'090537',base:800}] as const;
export const FOCUS_SOURCE='https://allpremial.ru/upload/iblock/b2d/wd8buezdp9sqf2fsxxtcjlmv11xdhl6v/Инструкция 90537.pdf';
export type KitchenBasket={article:string};
export function basketErrors(m:Module):string[]{
 const v=m.kitchen?.basket;if(!v)return [];
 const b=FOCUS_BASKETS.find(b=>b.article===v.article);if(!b)return ['Корзина: неизвестная модель.'];
 const e:string[]=[];
 if(m.kitchen?.role!=='base'||m.kitchen.appliance||m.corner||m.raw||m.cornerKind)e.push('FOCUS: нужна отдельная прямая нижняя тумба без техники.');
 if(m.width!==b.base)e.push(`FOCUS: нужна база ${b.base} мм.`);
 const rear=m.backType==='groove'?(m.grooveInset??16)+4:m.backType==='board'?17:0;
 if(m.depth-rear<465)e.push('FOCUS: свободная глубина должна быть не менее465 мм.');
 const floor=(m.feet?.height??m.plinthHeight??0)+16;
 if(m.height-floor-16<170)e.push('FOCUS: свободная высота должна быть не менее170 мм.');
 if(m.sections.length!==1||m.kdrawers?.length||m.kitchen?.premialPullout||m.sections.some(s=>s.shelves.length||s.drawers||s.rod||s.pantograph||s.pullouts))e.push('Для корзины освободите секцию от полок, ящиков и другого наполнения.');
 if(!m.doors||m.sections.some(s=>s.doorSplit!==undefined||s.doorRows?.length||(s.doorLeaves??1)>1))e.push('Для крепления FOCUS нужен один цельный фасад.');
 if(m.rails?.some(r=>!r.place.endsWith('top')))e.push('Нижняя царга мешает установке корзины.');
 return e;
}
export function applyBasketParts(m:Module,out:Part[]){
 const v=m.kitchen?.basket;if(!v||!FOCUS_BASKETS.some(b=>b.article===v.article))return;
 for(let i=out.length-1;i>=0;i--)if(out[i].role==='hinge')out.splice(i,1);
 for(const p of out)if(p.role==='door'){p.hingeless=true;p.openShift=0;}
 const floor=(m.feet?.height??m.plinthHeight??0)+16,x0=36,x1=m.width-36,z0=m.depth-420,y=floor+50;
 const add=(name:string,size:[number,number,number],position:[number,number,number])=>out.push({id:`kitchen-basket:${v.article}:${out.length}`,name,size,position,length:size[0],width:size[2],thickness:size[1],material:'metal',decor:'',role:'fastener',grain:'length',grainAxis:0,edge:[0,0,0,0],external:true});
 add('Корзина FOCUS — дно',[x1-x0,2,416],[m.width/2,y,z0+208]);
 for(const h of [30,80]){
  for(const x of [x0,x1])add('Борт корзины FOCUS',[4,4,416],[x,y+h,z0+208]);
  for(const z of [z0,z0+416])add('Борт корзины FOCUS',[x1-x0,4,4],[m.width/2,y+h,z]);
 }
 for(const x of [x0,x1])for(const z of [z0,z0+416])add('Стойка корзины FOCUS',[4,80,4],[x,y+40,z]);
 for(const x of [25,m.width-25])add('Направляющая FOCUS',[16,30,420],[x,floor+25,z0+210]);
}
