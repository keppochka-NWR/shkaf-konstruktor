import type {Module, Part} from './model';
import {versaliteLayout, axisTop} from './kitchenDrawers';

export type OvenSpec = { visible: boolean; drawer: boolean; nicheHeight: number };
import {OVEN,OVEN_TOTAL_DEPTH} from './ovenDimensions';
export {OVEN_SOURCE} from './ovenDimensions';
// Generic layout model, referenced to a 594 x 595 front. Not a branded factory CAD.
export const ovenSupportTop=(m:Module)=>m.height-(m.kitchen?.oven?.nicheHeight??OVEN.baseNiche.heightMin);
export function ovenDrawerModule(m:Module):Module {
 return {...m,height:ovenSupportTop(m)-OVEN.frontBelowSupport,topType:'panel',rails:[],gola:undefined,kitchen:{...m.kitchen!,oven:undefined}};
}
export function configureOven(m:Module,patch:Partial<OvenSpec>={}) {
 if(m.kitchen?.appliance!=='oven')throw Error('Выберите корпус под духовку.');
 m.kitchen.oven={visible:true,drawer:true,nicheHeight:OVEN.baseNiche.heightMin,...m.kitchen.oven,...patch};
 m.doors=false;delete m.gola;
 m.sections=m.sections.map(s=>({...s,shelves:[],drawers:0,rod:false}));
 if(m.kitchen.oven.drawer)m.kdrawers=versaliteLayout(ovenDrawerModule(m),1);
 else delete m.kdrawers;
}
export function ovenErrors(m:Module):string[]{
 const o=m.kitchen?.oven;if(!o)return [];
 const e:string[]=[];
 if(m.kitchen?.appliance!=='oven'||m.kitchen.role!=='base')e.push('Духовка: нужен нижний корпус под духовку.');
 if(!Number.isFinite(o.nicheHeight)||o.nicheHeight<OVEN.baseNiche.heightMin||o.nicheHeight>OVEN.baseNiche.heightMax)e.push('Высота ниши духовки под столешницей: 600–604 мм (Bosch HBF113BR0B, стр. 3).');
 const innerWidth=m.width-32; // current base template has two 16 mm sides
 if(innerWidth<OVEN.baseNiche.widthMin||innerWidth>OVEN.baseNiche.widthMax||m.depth<OVEN.baseNiche.depthMin)e.push('Встраиваемая духовка: свободная ширина ниши 560–568 мм, глубина от 550 мм.');
 if(m.topType!=='none'||m.backType!=='none'||m.rails?.length||m.gola||m.doors||m.sections.length!==1||m.sections.some(s=>s.shelves.length||s.drawers||s.rod))e.push('Ниша духовки должна оставаться свободной: без крыши, задника, царг, Gola, распашных дверей и полок.');
 if(ovenSupportTop(m)-16<(m.feet?.height??m.plinthHeight??0)+16)e.push('Под духовкой не помещается опорная полка.');
 if(o.drawer && (m.kdrawers?.length!==1||m.kdrawers.some(d=>axisTop(d)>ovenSupportTop(m)-21||d.y1>ovenSupportTop(m))))e.push('Ящик под духовкой пересекает опорную полку: увеличьте высоту корпуса или уберите ящик.');
 return e;
}
export function ovenParts(m:Module):Part[]{
 const o=m.kitchen?.oven;if(!o)return [];
 const y=ovenSupportTop(m),depth=m.depth-50;
 const shelf:Part={id:'oven-support',name:'Опорная полка духовки · вентиляционный отступ сзади 50 мм',role:'shelf',material:'board',decor:m.decor,size:[m.width-32,16,depth],position:[m.width/2,y-8,50+depth/2],length:m.width-32,width:depth,thickness:16,grain:'length',grainAxis:0,edge:[1,1,1,1]};
 if(!o.visible)return [shelf];
 const appliance:Part={id:'layout-oven',name:'Духовка Bosch HBF113BR0B · компоновка, ручка по максимальному выступу',role:'fastener',material:'metal',decor:'',size:[OVEN.width,OVEN.height,OVEN_TOTAL_DEPTH],position:[m.width/2,y-OVEN.frontBelowSupport+OVEN.height/2,m.depth-OVEN.insertionDepth+OVEN_TOTAL_DEPTH/2],length:OVEN.height,width:OVEN.width,thickness:OVEN_TOTAL_DEPTH,grain:'length',grainAxis:0,edge:[0,0,0,0],external:true};
 // Body width 550 and handle design are approximate; insertion depth and fascia envelope follow p.3.
 appliance.collide=[{size:[550,570,OVEN.insertionDepth],position:[m.width/2,y+285,m.depth-OVEN.insertionDepth/2]},{size:[OVEN.width,OVEN.height,OVEN.metalFasciaDepth],position:[m.width/2,y-OVEN.frontBelowSupport+OVEN.height/2,m.depth+OVEN.metalFasciaDepth/2]},{size:[484,18,OVEN.handleProjectionMax],position:[m.width/2,y-OVEN.frontBelowSupport+OVEN.height/2+150,m.depth+OVEN.metalFasciaDepth+OVEN.handleProjectionMax/2]}];
 return [shelf,appliance];
}

/** Legacy projects keep their drawer dimensions on load. Report the newly identified
 * fascia overlap instead of silently trimming manufactured fronts or rejecting the file. */
export function ovenLayoutWarnings(m:Module):string[] {
 return m.kitchen?.oven?.drawer && m.kdrawers?.some(d=>d.y1>ovenSupportTop(m)-OVEN.frontBelowSupport)
  ? ['Фасад ящика заходит на нижний выступ духовки (8 мм). Пересоберите нижний ящик перед изготовлением.'] : [];
}
