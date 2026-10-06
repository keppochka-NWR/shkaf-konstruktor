import type {Module,Part,Section,SectionBox} from './model';
import type {DrawerConfig} from './hardware';
import type {Project} from './project';

export type CornerSpec={level:'main'|'upper';sideDepth:number;bayWidth:number;bayDepth:number;middleClear:number;drawerHeight:number;slide:'ball'|'gtv0fpo';slideLength:number;fillingVersion?:1;sharedTop?:boolean};
export type CornerParameters={arm:number;height:number;sideDepth:number;upperClear:number;middleClear:number;bayWidth:number;bayDepth:number;drawerHeight:number;slide:'ball'|'gtv0fpo';slideLength:number;decor:string;facadeDecor:string;back:'hdf'|'none'};
export const CORNER_DEFAULT:CornerParameters={arm:1050,height:2446,sideDepth:450,upperClear:407,middleClear:326,bayWidth:350,bayDepth:400,drawerHeight:190,slide:'ball',slideLength:350,decor:'Белый',facadeDecor:'Белый',back:'hdf'};
export const CORNER_STORAGE='studio-corner-1050-20261005-v1';
const T=16, BASE=80;
export function cornerDrawer(m:Module,s:Section,j:number):DrawerConfig {
 const c=m.corner!;return s.drawerConfigs?.[j]??{slide:c.slide,height:c.drawerHeight,length:c.slideLength,handle:false};
}
export function cornerOffsets(m:Module,s:Section):number[]{let y=0;return Array.from({length:s.drawers},(_,j)=>{const cfg=cornerDrawer(m,s,j),start=cfg.y??y;y=start+cfg.height+40;return start;});}
export function cornerBoxes(m:Module):SectionBox[]{
 const c=m.corner!,bottom=c.level==='upper'?T:BASE+T,top=c.level==='upper'?m.height-T:m.height-c.middleClear-T-(c.sharedTop?0:T);
 return m.sections.map((s,i)=>({id:s.id,x:T,width:c.level==='upper'?Math.SQRT2*(m.width-c.sideDepth-T):i<2?c.bayWidth-T:Math.SQRT2*(m.width-c.bayWidth-2*T-c.bayDepth),bottom,top}));
}
/** Upgrade the earlier fixed example once; new empty sections stay empty. */
export function normalizeCorner(m:Module):Module{
 const c=m.corner;if(!c||c.fillingVersion===1)return m;
 c.sharedTop=c.level==='main';c.fillingVersion=1;
 const b=cornerBoxes(m)[0],span=b.top-b.bottom;
 if(c.level==='main'){
  m.sections.slice(0,2).forEach(s=>{const cap=3*(c.drawerHeight+40)+T;s.shelves=[1,2].map(k=>(cap+(span-cap)*k/3)/span);});
  const center=m.sections[2];if(center){center.shelves=[(300+T/2)/span];center.rod=true;center.rodAt=(span-70)/span;}
 }
 return m;
}
/** A normal, independently placeable closed corner carcass. */
export function createCornerModule(arm=1050,height=2000,sideDepth=450,source?:Pick<Module,'decor'|'facadeDecor'>):Module{
 const m=cornerProject({...CORNER_DEFAULT,decor:source?.decor??CORNER_DEFAULT.decor,facadeDecor:source?.facadeDecor??CORNER_DEFAULT.facadeDecor}).modules[0].module;
 m.width=arm;m.depth=arm;m.height=height;m.name='Угловой шкаф';m.corner!.sideDepth=sideDepth;m.corner!.sharedTop=false;
 m.sections.forEach(s=>s.id=crypto.randomUUID());
 const error=cornerErrors(m)[0];if(error)throw Error(error);return m;
}
export function createCornerUpper(base:Module,height:number):Module{
 const m=structuredClone(base);m.name='Угловая антресоль';m.height=height;m.plinthHeight=0;
 m.corner={...m.corner!,level:'upper',fillingVersion:1,sharedTop:false};
 m.sections=[{id:crypto.randomUUID(),weight:1,shelves:[],drawers:0,rod:false}];return m;
}
export const CORNER_NOTES=[
 'Источник — изображение пользователя от 05.10.2026. Габарит корпуса 1050 × 1050 × 2446 мм; боковины 450 мм; цоколь 80 мм. Фасады и накладной ХДФ выступают за габарит корпуса.',
 'Конструкция разделена на нижний корпус и антресоль. Дно антресоли одновременно закрывает нижний корпус: дополнительной дублирующей крыши нет. Угловой корпус шире прямого модуля; это отдельный тип конструкции.',
 'Высоты на изображении противоречат общей высоте: при ЛДСП 16 мм, цоколе 80 и верхних проёмах 407/326 нижний просвет получается 1569 мм, а не указанные 1588. В модели приоритет у общего габарита 2446. Под передней планкой высотой 80 просвет 246 мм.',
 'ЛДСП 16 мм одного белого декора принято временно; задники ХДФ 3 мм. Фасады гладкие. Изменение декоров разделяет материалы в раскрое.',
 'По три ящика с каждой стороны развёрнуты на 90° друг к другу. Глубина боковых полок 400, полочный блок 350. Чистый проём 334, вкладные фасады 330 мм с зазорами по 2. Размер 334 на исходном рисунке трактуется как проём; назначение уточнить.',
 'Направляющие и высота коробов на изображении не подписаны. Для предварительной деталировки приняты шариковые GTV с боковым зазором 13 мм, длина 350; дно ЛДСП 16. Можно выбрать геометрию GTV 0FPO 16 мм. Артикул и присадка подлежат согласованию.',
 'Над каждым блоком ящиков предусмотрена обязательная полка. В центре — штанга и трапециевидная полка из заготовки 618 × 350; её передний край подогнан к проёму. Контур центральной полки восстановлен предположительно.',
 'Точные петли для диагональных дверей и длинная ручка не выбраны. Показаны условные габариты. Проверка открывания механизма требует артикула; одновременно выдвигать встречные ящики нельзя.',
 'Раскрой предварительный: лист ЛДСП 2750 × 1830, ХДФ 2800 × 2070, поле 10 мм, промежуток 10 мм. Кромка вычтена из размеров заготовок. Фигурные детали укладываются по прямоугольным заготовкам с нанесённым контуром; обрезки внутри этих заготовок повторно не используются. Это не УП и не разрешение в производство.',
];

export function parseCorner(raw:unknown):CornerParameters{
 const x=raw as CornerParameters;
 if(!x||typeof x!=='object')throw Error('Нужны параметры углового шкафа.');
 const p={...x};
 for(const [key,lo,hi] of [['arm',950,1400],['height',2200,2800],['sideDepth',400,650],['upperClear',300,550],['middleClear',200,450],['bayWidth',300,400],['bayDepth',300,450],['drawerHeight',140,230],['slideLength',250,400]] as const){
  if(!Number.isFinite(p[key])||p[key]<lo||p[key]>hi)throw Error(`${key}: допустимо ${lo}–${hi} мм.`);
 }
 if(!['ball','gtv0fpo'].includes(p.slide)||![250,300,350,400].includes(p.slideLength))throw Error('Выберите направляющие и их длину.');
 if(!['hdf','none'].includes(p.back)||![p.decor,p.facadeDecor].every(s=>typeof s==='string'&&s.trim().length>0&&s.length<=100))throw Error('Проверьте материал.');
 if(p.slideLength+30>p.bayDepth)throw Error('Для выбранной направляющей нужен запас 30 мм по глубине блока.');
 const low=p.height-p.upperClear-2*T;
 if(low>2200)throw Error('Нижний корпус выше 2200 мм. Увеличьте антресоль или уменьшите общую высоту.');
 const inner=low-p.middleClear-T-BASE-T;
 if(inner<1100||3*(p.drawerHeight+40)+2*T>inner-320)throw Error('Ящики и полки не помещаются в нижней части.');
 if(p.arm-p.bayWidth-T-(T+p.bayDepth)<170)throw Error('Боковые блоки перекрывают центральный проём. Уменьшите их ширину или глубину.');
 if(T+p.bayDepth>p.sideDepth-10)throw Error('Блок наполнения выступает за боковину. Уменьшите его глубину.');
 return p;
}

export function cornerProject(raw:CornerParameters):Project{
 const p=parseCorner(raw),upper=p.upperClear+2*T,lower=p.height-upper;
 const spec:CornerSpec={level:'main',sideDepth:p.sideDepth,bayWidth:p.bayWidth,bayDepth:p.bayDepth,middleClear:p.middleClear,drawerHeight:p.drawerHeight,slide:p.slide,slideLength:p.slideLength};
 const section=(id:string,drawers=0)=>({id,weight:1,shelves:[],drawers,rod:false,drawerConfigs:Array.from({length:drawers},()=>({slide:p.slide,height:p.drawerHeight,length:p.slideLength,handle:false}))});
 const base:Module={version:1,name:'Угловой шкаф · низ',width:p.arm,depth:p.arm,height:lower,decor:p.decor,facadeDecor:p.facadeDecor,doors:true,plinthHeight:BASE,backType:p.back==='hdf'?'nailed':'none',handleId:'none',sections:[section('left',3),section('right',3),section('front')],corner:spec};
 normalizeCorner(base);
 return {version:3,room:{width:Math.max(2500,p.arm+800),depth:Math.max(2500,p.arm+800),height:Math.max(2800,p.height+150),openings:[]},modules:[{id:'corner-main',x:100,z:100,y:0,module:base},{id:'corner-upper',x:100,z:100,y:lower,module:{...base,name:'Угловой шкаф · антресоль',height:upper,plinthHeight:0,sections:[section('front')],corner:{...spec,level:'upper'}}}],measurement:{number:'Угловой шкаф по эскизу',date:'2026-10-05',notes:CORNER_NOTES.slice(0,3).join('\n')},offer:{customer:'Угловой шкаф '+p.arm+' × '+p.arm,price:'',notes:'Предварительная реконструкция по изображению; размеры и фурнитуру проверить до производства.'}};
}

export function parametersFromCornerProject(project:Project):CornerParameters{
 if(project.modules.length!==2)throw Error('Этот режим открывает один угловой шкаф из двух корпусов. Другие модули не будут удалены: откройте отдельный файл этого шкафа.');
 const low=project.modules.find(a=>a.module.corner?.level==='main'),top=project.modules.find(a=>a.module.corner?.level==='upper');
 if(!low||!top)throw Error('В файле нет двух частей углового шкафа.');
 if(top.module.width!==low.module.width||top.module.depth!==low.module.depth)throw Error('Размеры антресоли должны совпадать с нижним угловым корпусом.');
 const m=low.module,c=m.corner!;
 return parseCorner({arm:m.width,height:m.height+top.module.height,sideDepth:c.sideDepth,upperClear:top.module.height-32,middleClear:c.middleClear,bayWidth:c.bayWidth,bayDepth:c.bayDepth,drawerHeight:c.drawerHeight,slide:c.slide,slideLength:c.slideLength,decor:m.decor,facadeDecor:m.facadeDecor,back:m.backType==='none'?'none':'hdf'});
}

export function cornerErrors(m:Module):string[]{
 const c=m.corner;
 if(!c||!['main','upper'].includes(c.level))return ['Неизвестный тип углового корпуса.'];
 if(!Number.isFinite(m.width)||m.width!==m.depth||m.width<950||m.width>1400||!Number.isFinite(m.height)||m.height<(c.level==='upper'?300:1400)||m.height>2200)return ['Угловой корпус: стороны 950–1400; низ высотой 1400–2200, антресоль от 300 мм.'];
 if(![c.sideDepth,c.bayWidth,c.bayDepth,c.middleClear,c.drawerHeight,c.slideLength].every(Number.isFinite))return ['Некорректные параметры углового шкафа.'];
 if(c.sideDepth<400||c.sideDepth>650||c.bayWidth<300||c.bayWidth>400||c.bayDepth<300||c.bayDepth>450||c.middleClear<200||c.middleClear>450||c.drawerHeight<140||c.drawerHeight>230||![250,300,350,400].includes(c.slideLength)||!['ball','gtv0fpo'].includes(c.slide))return ['Параметры наполнения углового шкафа вне диапазона.'];
 if(m.width-c.bayWidth-T-(T+c.bayDepth)<170)return ['Боковые блоки перекрывают центральный проём.'];
 if(T+c.bayDepth>c.sideDepth-10)return ['Наполнение выступает за боковины.'];
 if(!['nailed','none'].includes(m.backType??'nailed'))return ['Для углового корпуса доступны накладной ХДФ или открытая задняя часть.'];
 if(c.fillingVersion!==1||m.sections.length!==(c.level==='main'?3:1))return ['Неверная структура углового наполнения.'];
 if(c.sharedTop!==undefined&&typeof c.sharedTop!=='boolean')return ['Неверное исполнение крыши.'];
 if(new Set(m.sections.map(s=>s.id)).size!==m.sections.length)return ['Секции должны иметь разные идентификаторы.'];
 if(m.doors&&Math.floor((Math.SQRT2*(m.width-c.sideDepth)-6)/2)>600)return ['Диагональный фасад шире 600 мм. Уменьшите сторону угла или увеличьте глубину боковин.'];
 const boxes=cornerBoxes(m),errors:string[]=[];
 m.sections.forEach((s,i)=>{
  const span=boxes[i].top-boxes[i].bottom;
  if(!Number.isInteger(s.drawers)||s.drawers<0||s.drawers>5||!Array.isArray(s.shelves)||s.shelves.length>10||s.shelves.some(f=>!Number.isFinite(f)||f*span<24||f*span>span-24))errors.push('Полки должны находиться внутри своего отделения, с отступом от дна и крыши.');
  if((i===2||c.level==='upper')&&s.drawers)errors.push('Ящики устанавливаются в левый или правый боковой блок.');
  if(s.pantograph||s.drawerConfigs?.some(d=>d.mesh||d.tray))errors.push('Для этого угла доступны обычные полки, штанга и ящики.');
  if(s.rod&&(i!==2||c.level!=='main'))errors.push('Штанга устанавливается в центральное отделение.');
  const rod=(s.rodAt??(span-70)/span)*span;
  if(s.rod&&(!Number.isFinite(rod)||rod<100||rod>span-30))errors.push('Штанга должна находиться внутри центрального отделения.');
  if(s.rod&&s.shelves.some(f=>Math.abs(f*span-rod)<40))errors.push('Штанга пересекается с полкой.');
  const offsets=cornerOffsets(m,s),ends:number[]=[];
  for(let j=0;j<s.drawers;j++){
   const d=cornerDrawer(m,s,j),y=offsets[j],end=y+d.height+40;
   if(!['ball','gtv0fpo'].includes(d.slide)||![250,300,350,400].includes(d.length)||d.length+30>c.bayDepth||!Number.isFinite(d.height)||d.height<140||d.height>230)errors.push('Проверьте ящик: высота 140–230 мм, направляющие GTV; запас по глубине 30 мм.');
   if(!Number.isFinite(y)||y<0||end+T>span-24)errors.push('Ящик и полка над ним не помещаются по высоте.');
   if(ends.some((e,k)=>y<e-.1&&end>offsets[k]+.1))errors.push('Ящики пересекаются по высоте.');ends.push(end);
  }
  const cap=ends.length?Math.max(...ends)+T:0;
  if(s.shelves.some(f=>f*span<cap+24))errors.push('Полки должны быть выше обязательной полки над ящиками.');
  const yy=s.shelves.map(f=>f*span).sort((a,b)=>a-b);if(yy.some((y,j)=>j>0&&y-yy[j-1]<80))errors.push('Расстояние между полками должно быть не меньше 80 мм.');
 });
 return [...new Set(errors)];
}

export function cornerParts(m:Module):Part[]{
 const c=m.corner!,w=m.width,h=m.height,d=c.sideDepth,t=T,out:Part[]=[],frontSection=m.sections.at(-1)!;
 const frontId=frontSection.id;
 function add(id:string,name:string,size:Part['size'],pos:Part['position'],role:Part['role']='body',axis:0|1|2=1,material:Part['material']='board',sid=frontId){
  const sorted=[...size].sort((a,b)=>b-a);
  const length=material==='board'?size[axis]:sorted[0],width=material==='board'?size.find((v,i)=>i!==axis&&v!==t)??sorted[1]:sorted[1];
  const part:Part={id,name,size,position:pos,length,width,thickness:material==='board'?t:sorted[2],role,material,decor:role==='door'?m.facadeDecor:id.endsWith(':facade')?m.drawerFacadeDecor??m.facadeDecor:m.decor,grain:'length',grainAxis:axis,edge:material==='board'?[.4,.4,2,.4]:[0,0,0,0],sectionId:sid};
  out.push(part);return part;
 }
 function plate(id:string,name:string,points:[number,number][],y:number,role:Part['role']='body',edge?:number[]){
  const x0=Math.min(...points.map(p=>p[0])),z0=Math.min(...points.map(p=>p[1])),x1=Math.max(...points.map(p=>p[0])),z1=Math.max(...points.map(p=>p[1]));
  const q=add(id,name,[x1-x0,t,z1-z0],[(x0+x1)/2,y,(z0+z1)/2],role,0);
  q.planContour=points.map(([x,z])=>[x-x0,z-z0]);q.contourEdges=edge??points.map(()=>.4);q.width=z1-z0;
  return q;
 }
 const pent:[number,number][]=[[0,0],[w-t,0],[w-t,d],[d,w-t],[0,w-t]];
 add('side-left','Боковина левая',[d,h,t],[d/2,h/2,w-t/2]);
 add('side-right','Боковина правая',[t,h,d],[w-t/2,h/2,d/2]);
 if(m.backType!=='none'){
  const a=add('back-a','Задник ХДФ · сторона А',[w-2,h-2,3],[(w-2)/2+1,h/2,-1.5],'body',1,'hdf');a.length=h-2;a.width=w-2;
  const b=add('back-b','Задник ХДФ · сторона Б',[3,h-2,w-2],[-1.5,h/2,(w-2)/2+1],'body',1,'hdf');b.length=h-2;b.width=w-2;
 }
 if(c.level==='upper'){
  plate('bottom','Дно антресоли · пятиугольное',pent,t/2,'body',[.4,.4,2,.4,.4]);
  plate('top','Крыша · пятиугольная',pent,h-t/2,'body',[.4,.4,2,.4,.4]);
 }else{
  plate('bottom','Дно · пятиугольное',pent,BASE+t/2,'body',[.4,.4,2,.4,.4]);
  if(!c.sharedTop)plate('top','Крыша · пятиугольная',pent,h-t/2,'body',[.4,.4,2,.4,.4]);
  const innerTop=cornerBoxes(m)[0].top;
  plate('middle-shelf','Общая полка · пятиугольная',pent,innerTop+t/2,'shelf',[.4,.4,2,.4,.4]);
  const frontLength=Math.SQRT2*(w-d),front=(w+d)/2;
  const plinth=add('plinth','Цоколь диагональный',[frontLength-4,BASE-2,t],[front-35,(BASE-2)/2,front-35],'body',0);plinth.rotY=45;
  const header=add('header','Передняя планка 80 мм',[Math.SQRT2*(w-t-d),80,t],[front-8,h-40-(c.sharedTop?0:t),front-8],'body',0);header.rotY=45;
  const partition=w-c.bayWidth-t,face=t+c.bayDepth,clear=c.bayWidth-t;
  const bottom=BASE+t,openH=innerTop-bottom;
  // Shelf banks stand against perpendicular sides, with drawers moving into the corner.
  for(const side of ['left','right'] as const){
   const swap=side==='left',s=m.sections[swap?0:1],sid=s.id;
   function local(id:string,name:string,size:Part['size'],position:Part['position'],role:Part['role']='body',axis:0|1|2=1,material:Part['material']='board'){
    // Local x is the clear drawer width, z is extension direction; left bank faces +X.
    const p=add(`${sid}:${id}`,name,size,swap?[position[2],position[1],w-t-position[0]]:[w-t-position[0],position[1],position[2]],role,axis,material,sid);
    if(swap)p.rotY=90;else p.rotY=0;
    // For the right bank, mirror placement only: symmetric boards need no winding change.
    return p;
   }
   if(swap)add(sid+':divider','Перегородка левая',[c.bayDepth,openH,t],[t+c.bayDepth/2,bottom+openH/2,partition+t/2],'body',1,'board',sid);
   else add(sid+':divider','Перегородка правая',[t,openH,c.bayDepth],[partition+t/2,bottom+openH/2,t+c.bayDepth/2],'body',1,'board',sid);
   const offsets=cornerOffsets(m,s),cap=bottom+Math.max(0,...offsets.map((y,j)=>y+cornerDrawer(m,s,j).height+40));
   if(s.drawers)local('drawer-cap','Обязательная полка над ящиками',[clear,t,c.bayDepth],[clear/2,cap+t/2,t+c.bayDepth/2],'shelf',0);
   s.shelves.forEach((f,k)=>{
    local(`shelf:${k}`,'Полка бокового блока',[clear,t,c.bayDepth],[clear/2,bottom+f*openH,t+c.bayDepth/2],'shelf',0);
   });
   for(let j=0;j<s.drawers;j++){
    const cfg=cornerDrawer(m,s,j),pitch=cfg.height+40;
    const hidden=cfg.slide==='gtv0fpo',boxW=clear-(hidden?10:26),boxD=cfg.length-(hidden?10:0),boxX=(clear-boxW)/2;
    const y=bottom+offsets[j]+20,frontZ=face-18,backZ=frontZ-boxD;
    for(const [label,x] of [['left',boxX+t/2],['right',boxX+boxW-t/2]] as const)
     local(`drawer:${j}:${label}`,`Ящик ${j+1} · боковина`,[t,cfg.height,boxD],[x,y+cfg.height/2,backZ+boxD/2],'drawer',2);
    const endH=cfg.height-(hidden?28:0),endY=y+(hidden?28:0);
    for(const [label,z] of [['rear',backZ+t/2],['front',frontZ-t/2]] as const)
     local(`drawer:${j}:${label}`,`Ящик ${j+1} · поперечина`,[boxW-2*t,endH,t],[clear/2,endY+endH/2,z],'drawer',0);
    local(`drawer:${j}:bottom`,`Ящик ${j+1} · дно ЛДСП`,[hidden?boxW-2*t:boxW,t,boxD],[clear/2,hidden?y+12+t/2:y-t/2,backZ+boxD/2],'drawer',0);
    if(!cfg.noFacade){const frontPart=local(`drawer:${j}:facade`,`Ящик ${j+1} · вкладной фасад`,[clear-4,pitch-4,t],[clear/2,bottom+offsets[j]+(pitch-4)/2+2,face-8],'drawer',1);frontPart.edge=[2,2,2,2];}
    for(const [label,x] of [['left',boxX-6],['right',boxX+boxW+6]] as const)
     local(`drawer:${j}:slide:${label}`,'Направляющая · '+cfg.slide,[hidden?20:12,hidden?12:45,cfg.length],[x,hidden?y+6:y+cfg.height/2,frontZ-cfg.length/2],'drawer',2,'metal');
   }
  }
  const central=Math.SQRT2*(partition-face),depth=350,rearWidth=Math.min(618,central+239),vfront=(partition+face)/Math.SQRT2;
  const local:[[number,number],[number,number],[number,number],[number,number]]=[[0,0],[rearWidth,0],[(rearWidth+central)/2,depth],[(rearWidth-central)/2,depth]];
  const center=(vfront-depth/2)/Math.SQRT2;
  frontSection.shelves.forEach((f,k)=>{
   const shelf=plate(frontId+':shelf:'+k,'Центральная полка · трапеция',local,bottom+f*openH,'shelf',[.4,.4,2,.4]);
   shelf.position=[center,shelf.position[1],center];shelf.rotY=45;
  });
  if(frontSection.rod){
   const rodCenter=(vfront-55)/Math.SQRT2;
   const rod=add(frontId+':rod','Штанга центрального отделения · крепления уточнить',[2*Math.SQRT2*(partition-rodCenter),25,25],[rodCenter,bottom+(frontSection.rodAt??(openH-70)/openH)*openH,rodCenter],'rod',0,'metal');rod.rotY=45;
  }
 }
 if(c.level==='upper')frontSection.shelves.forEach((f,k)=>plate(frontId+':shelf:'+k,'Полка антресоли · пятиугольная',pent,t+f*(h-2*t),'shelf',[.4,.4,2,.4,.4]));
 if(m.doors){
  const length=Math.SQRT2*(w-d),dw=Math.floor((length-6)/2),y0=c.level==='main'?BASE+2:2,dh=h-y0-2;
  for(let leaf=0;leaf<2;leaf++){
   if(frontSection.removedDoors?.includes(leaf))continue;
   const s=(leaf?1:-1)*(dw/2+1),v=(w+d)/Math.SQRT2+10;
   const q=add(`${frontId}:door:${leaf}`,'Распашной фасад '+(leaf+1),[dw,dh,t],[(v+s)/Math.SQRT2,y0+dh/2,(v-s)/Math.SQRT2],'door');q.rotY=45;q.hinge=leaf?'right':'left';q.edge=[2,2,2,2];
   if(leaf===1&&c.level==='main'){
    const along=s-dw/2+42,normal=v+26;
    const handle=add(frontId+':handle:1','Ручка условная · длина 900 мм',[22,900,34],[(normal+along)/Math.SQRT2,1100,(normal-along)/Math.SQRT2],'handle',1,'metal');handle.rotY=45;handle.simpleHandle=true;
   }
  }
 }
 return out;
}
