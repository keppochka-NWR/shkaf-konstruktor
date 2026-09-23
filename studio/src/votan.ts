import type { Casework } from './casework';
import {caseworkErrors} from './casework';
import type { Module } from './model';
import type { Project, PlacedModule } from './project';

export type VotanParameters={version:1;lowerHeight:number;upperHeight:number;outerDepth:number;leftLength:number;leftWidth:number;rightWidth:number;rightLength:number;endWidth:number;endDepth:number;groupGap:number;floorGap:number;drawerFace:number;upperDrawerFace:number;drawerGap:number;pantsWidth:number;pantsHeight:number;shelfCount:number;glass:'moru-bronze'|'satin-bronze';light:boolean};
export const VOTAN_DEFAULT:VotanParameters={version:1,lowerHeight:2100,upperHeight:400,outerDepth:600,leftLength:1830,leftWidth:1800,rightWidth:1800,rightLength:1800,endWidth:600,endDepth:200,groupGap:700,floorGap:12,drawerFace:320,upperDrawerFace:120,drawerGap:30,pantsWidth:650,pantsHeight:1000,shelfCount:2,glass:'moru-bronze',light:true};
export function parseVotan(raw:unknown):VotanParameters{
  if(!raw||typeof raw!=='object')throw Error('Не найден файл параметров заказа.');
  const p=raw as VotanParameters;
  if(p.version!==1||!['moru-bronze','satin-bronze'].includes(p.glass)||typeof p.light!=='boolean')throw Error('Неверный формат заказа Вотан.');
  const ranges:Record<string,[number,number]>={lowerHeight:[1900,2300],upperHeight:[300,600],outerDepth:[550,650],leftLength:[1700,2300],leftWidth:[1700,2300],rightWidth:[1700,2300],rightLength:[1700,2300],endWidth:[500,650],endDepth:[180,350],groupGap:[400,1600],floorGap:[10,15],drawerFace:[280,350],upperDrawerFace:[100,160],drawerGap:[20,40],pantsWidth:[550,750],pantsHeight:[600,1300],shelfCount:[0,4]};
  for(const [k,[lo,hi]] of Object.entries(ranges)){const n=p[k as keyof VotanParameters];if(typeof n!=='number'||!Number.isFinite(n)||n<lo||n>hi)throw Error(`${k}: допустимо ${lo}–${hi} мм.`);}
  if(!Number.isInteger(p.shelfCount))throw Error('Число полок должно быть целым.');
  // Whitelist fields. Never retain arbitrary imported metadata.
  const clean={...VOTAN_DEFAULT};for(const k of Object.keys(clean) as (keyof VotanParameters)[])(clean as unknown as Record<string,unknown>)[k]=p[k];
  const project=votanProject(clean);for(const a of project.modules){const err=caseworkErrors(a.module);if(err.length)throw Error(a.module.name+': '+err[0]);}
  return clean;
}
export function votanProject(p:VotanParameters):Project{
  const modules:PlacedModule[]=[],o=120,depth=p.outerDepth-22;
  function module(code:string,name:string,w:number,d:number,x:number,z:number,rotation:0|90|180|270,kind:Casework['kind'],blind=0,blindSide:'left'|'right'='right',openSide?:'left'|'right'){
    const base:Casework={kind,blind,blindSide,floorGap:p.floorGap,drawerFace:p.drawerFace,topDrawerFace:p.upperDrawerFace,drawerGap:p.drawerGap,filler:32,shelfCount:p.shelfCount,pantsWidth:p.pantsWidth,pantsHeight:p.pantsHeight,rodHeight:p.lowerHeight-100,light:p.light,openSide};
    for(const upper of [false,true]){
      const id=code+(upper?'-top':''),m:Module={version:1,name:code+' '+name+(upper?' · антресоль':''),width:w,height:upper?p.upperHeight:p.lowerHeight,depth:d,decor:'Дуб Вотан',facadeDecor:'Дуб Вотан',plinthHeight:0,backType:'nailed',doors:upper||kind!=='drawers',sections:[{id:id+'-section',weight:1,shelves:[],drawers:0,rod:false}],casework:{...base,kind:upper?'upper':kind,floorGap:upper?2:p.floorGap,light:upper?false:p.light}};
      if(kind!=='solid')m.alu={profile:'F1-17',color:'black',insert:p.glass};
      modules.push({id,x,y:upper?p.lowerHeight:0,z,rotation,module:m});
    }
  }
  // Outside depth includes frame 20 mm and front clearance 2 mm. It remains an approval assumption.
  module('A1','Штанга и два ящика',p.leftLength,depth,o,o,90,'hanging',p.outerDepth,'left');
  module('A2','Брючница 650',p.leftWidth-p.outerDepth,depth,o+p.outerDepth,o+p.leftLength-depth,180,'trousers');
  const rx=o+p.leftWidth+p.groupGap;
  module('B1','Проходной 1800',p.rightWidth,depth,rx,o,0,'hanging',p.outerDepth,'right');
  module('B2','Четыре ящика и полки',p.rightLength-p.outerDepth-p.endWidth,depth,rx+p.rightWidth-depth,o+p.outerDepth,270,'drawers',0,'left','left');
  module('B3','Фасады ЛДСП',p.endWidth,p.endDepth-22,rx+p.rightWidth-(p.endDepth-22),o+p.rightLength-p.endWidth,270,'solid');
  return {version:3,room:{width:rx+p.rightWidth+o,depth:Math.max(p.leftLength,p.rightLength)+2*o,height:p.lowerHeight+p.upperHeight+100},measurement:{number:'До замера',date:'',notes:'Габарит помещения и расстояние между группами условные. Проект для согласования. Blum, петли, брючница, подсветка требуют спецификации. Глубина корпуса = внешний габарит минус рамка 20 и зазор 2 мм — предварительно.'},modules};
}
export const VOTAN_NOTES=[
  'Расстановка двух групп соответствует виду сверху. Расстояние между ними 700 мм — условное до замера.',
  'Низ 2100 и антресоли 400 мм, материал Дуб Вотан 16 мм взяты из исходной B3D. Марку и толщины подтвердить для нового заказа.',
  'Глубина 600 мм принята по плану как внешний габарит; корпус 578 мм получен с учётом рамки и зазора. В исходнике есть детали глубиной 608 мм — требуется сверка узла.',
  'Проходной B1 задан 1800 мм по последнему уточнению вместо 1830 мм старого плана. Два ящика рядом под общей полкой.',
  'Новые B2: 320/320/320/120 мм, зазоры 30 мм. Две полки сверху и открытый доступ к ящикам показаны как рабочий вариант. Число полок и исполнение дверей уточнить.',
  'Высота внутренних ящиков A1 и B1 связана с 320 мм соседней группы как рабочее толкование. Ящики A1 сохранены по исходному виду.',
  'Брючница A2 показана условно в чистом проёме 650 мм. Высота 1000 мм предварительная. Ящика под ней нет.',
  'Короба ящиков, направляющие Blum и петли Premial показаны условно. Это не геометрия присадки и не спецификация выбранных артикулов.',
  'Чёрная кромка, без опор, низ фасадов 12 мм в диапазоне 10–15. Подсветка в крышах нижних модулей; управление делает клиент.',
  'Профиль F1-17 и бронзовое стекло показаны для сравнения. Рифление и матовость условные, точные образцы согласовать у Артели Три Брата.',
];
