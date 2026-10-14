import type {Module, Part} from './model';
import {versaliteLayout, axisTop} from './kitchenDrawers';

export type OvenSpec = { visible: boolean; drawer: boolean; nicheHeight: number };
export const OVEN_SOURCE='https://media3.bosch-home.com/Documents/specsheet/en-GB/HBF113BR0B.pdf';
// Generic layout model, referenced to a 594 x 595 front. Not a branded factory CAD.
export const ovenSupportTop=(m:Module)=>m.height-(m.kitchen?.oven?.nicheHeight??600);
export function ovenDrawerModule(m:Module):Module {
 return {...m,height:ovenSupportTop(m),topType:'panel',rails:[],gola:undefined,kitchen:{...m.kitchen!,oven:undefined}};
}
export function configureOven(m:Module,patch:Partial<OvenSpec>={}) {
 if(m.kitchen?.appliance!=='oven')throw Error('Выберите корпус под духовку.');
 m.kitchen.oven={visible:true,drawer:true,nicheHeight:600,...m.kitchen.oven,...patch};
 m.doors=false;delete m.gola;
 m.sections=m.sections.map(s=>({...s,shelves:[],drawers:0,rod:false}));
 if(m.kitchen.oven.drawer)m.kdrawers=versaliteLayout(ovenDrawerModule(m),1);
 else delete m.kdrawers;
}
export function ovenErrors(m:Module):string[]{
 const o=m.kitchen?.oven;if(!o)return [];
 const e:string[]=[];
 if(m.kitchen?.appliance!=='oven'||m.kitchen.role!=='base')e.push('Духовка: нужен нижний корпус под духовку.');
 if(!Number.isFinite(o.nicheHeight)||o.nicheHeight<595||o.nicheHeight>610)e.push('Высота ниши духовки: 595–610 мм.');
 if(m.width<600||m.width>608||m.depth<550)e.push('Типовая духовка: корпус 600–608 мм, глубина от 550 мм.');
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
 const appliance:Part={id:'layout-oven',name:'Духовка 60 см · типовая компоновочная модель',role:'fastener',material:'metal',decor:'',size:[594,595,585],position:[m.width/2,y+297.5,m.depth-530+292.5],length:595,width:594,thickness:585,grain:'length',grainAxis:0,edge:[0,0,0,0],external:true};
 appliance.collide=[{size:[550,570,530],position:[m.width/2,y+285,m.depth-265]},{size:[594,595,20],position:[m.width/2,y+297.5,m.depth+10]},{size:[484,18,35],position:[m.width/2,y+447.5,m.depth+37.5]}];
 return [shelf,appliance];
}
