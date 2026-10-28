// Сборка мебели из палитры «Добавить мебель» (перенесено из ModulePalette.tsx, w-formerrors 23.10: проверка формы paletteCheck.ts
// собирает те же модули без исключения на первой ошибке). Тексты ошибок прежние; ModulePalette.tsx реэкспортирует функции.
import {refitKDrawers} from './kitchenDrawers';
import {initialModule,section,deskModule,distribute,validate,id,drawersToRoof,rearClear,parts,RULES,type Module} from './model';
import {partCollisions} from './collisions';
import {SLIDES} from './hardware';
import {withDoorCount} from './paletteDoors';

import {createCornerModule} from './cornerWardrobe';
import {DEFAULT_KUPE,KUPE_DEPTH} from './kupe';
import {KITCHEN,kitchenBase,kitchenWall,kitchenWorktop,kitchenRowWidths,setWorktopMaterial} from './kitchen';
import type {PlacedModule} from './project';
// 'kitchen-corner' и 'kitchen-u' (w-lwing 23.10) — группы в угол комнаты, собираются kitchenCornerRow.ts (createKitchenCornerRow/createKitchenURow)
export type ModuleKind='empty'|'shelves'|'wardrobe'|'drawers'|'hanging-drawer'|'desk'|'corner'|'kupe'|'kupe-wardrobe'|'kitchen-row'|'kitchen-corner'|'kitchen-u'|'kitchen-base'|'kitchen-wall'|'worktop';
/** Названия видов мебели палитры (имя нового модуля). */
export const KIND_LABEL:Record<ModuleKind,string>={empty:'Пустой шкаф',shelves:'Стеллаж',wardrobe:'Для одежды',drawers:'Комод','hanging-drawer':'Подвесной ящик',corner:'Угловой шкаф',desk:'Стол','kupe-wardrobe':'Шкаф-купе','kitchen-row':'Кухня прямая','kitchen-corner':'Кухня угловая (Г)','kitchen-u':'Кухня П-образная','kitchen-base':'Нижний кухонный','kitchen-wall':'Навесной кухонный',worktop:'Столешница',kupe:'Двери купе'};
/** Куда складывать ошибки вместо исключения на первой (проверка формы — все ошибки сразу). */
type Sink=string[]|undefined;
const fail=(sink:Sink,text:string)=>{if(sink)sink.push(text);else throw Error(text);};
const check=(m:Module,sink:Sink,prefix='')=>{if(sink){sink.push(...validate(m).map(e=>prefix+e));return;}const error=validate(m)[0];if(error)throw Error(prefix+error);};
/** Двери купе: проём W×H, глубина зоны направляющих 100 мм. */
export function createKupeModule(width:number,height:number,source:Module,doors?:number,sink?:string[]):Module{
  const m:Module={...initialModule(),name:'Двери купе',width,height,depth:KUPE_DEPTH,decor:source.decor,facadeDecor:source.facadeDecor,doors:false,plinthHeight:0,sections:[section()],kupe:{...structuredClone(DEFAULT_KUPE),...(doors?{doors}:{})}};
  check(m,sink);
  return m;
}
/** Шкаф-купе. mount 'free' (как было): корпуса без распашных дверей (каждый не шире 1300) и двери купе перед ними на всю ширину.
 *  mount 'inside' (менеджеры 22.10): один корпус — боковины до пола и крыша на всю глубину, секции за дверями на глубине depth − 100;
 *  двери купе между боковинами и под крышей, нижняя направляющая на полу (дно и цоколь — за дверями). */
export function createKupeWardrobe(width:number,height:number,depth:number,source:Module,doors?:number,mount:'free'|'inside'='free',sink?:string[]):PlacedModule[]{
  // проверка формы: при мелкой глубине остальное проверяем на минимальной глубине, чтобы показать и другие ошибки
  if(depth<350+KUPE_DEPTH){fail(sink,`Глубина шкафа-купе от ${350+KUPE_DEPTH} мм: ${KUPE_DEPTH} мм занимают направляющие.`);depth=350+KUPE_DEPTH;}
  if(mount==='inside'){
    const t=RULES.panel,bodyDepth=depth-KUPE_DEPTH,n=Math.max(1,Math.ceil((width-2*t)/1000));
    const m:Module={...initialModule(),name:'Корпус шкафа-купе',width,height,depth:bodyDepth,kupeZone:KUPE_DEPTH,decor:source.decor,facadeDecor:source.facadeDecor,doors:false,sections:Array.from({length:n},()=>section())};
    m.sections.forEach((s,i)=>{if(i%2===0){s.rod=true;s.shelves=distribute(m,s,1);}else s.shelves=distribute(m,s,5);});
    // задник ХДФ одним листом 2800×2070: у широкого и высокого шкафа (оба размера больше 2050) не выкраивается — без задника, к стене (вопрос Максу)
    if(Math.min(width,height)>RULES.hdfH-2*RULES.sheetMargin)m.backType='none';
    check(m,sink);
    const k=createKupeModule(width-2*t,height-t,source,doors,sink);k.kupe!.mount='inside';
    return [{id:id(),x:30,y:0,z:30,rotation:0,module:m},{id:id(),x:30+t,y:0,z:30+bodyDepth,rotation:0,module:k}];
  }
  const n=Math.max(1,Math.ceil(width/1200)),bw=Math.floor(width/n),bodyDepth=depth-KUPE_DEPTH,out:PlacedModule[]=[];
  for(let i=0;i<n;i++){
    // K6: корпус шкафа-купе (двери отдельно) — высота до листа, как при дверях внутри (kupeBody)
    const m:Module={...initialModule(),name:'Корпус шкафа-купе',width:i<n-1?bw:width-bw*(n-1),height,depth:bodyDepth,kupeBody:true,decor:source.decor,facadeDecor:source.facadeDecor,doors:false,sections:[section()]};
    const s=m.sections[0];if(i%2===0){s.rod=true;s.shelves=distribute(m,s,1);}else s.shelves=distribute(m,s,5);
    check(m,sink);
    out.push({id:id(),x:30+i*bw,y:0,z:30,rotation:0,module:m});
  }
  out.push({id:id(),x:30,y:0,z:30+bodyDepth,rotation:0,module:createKupeModule(width,height,source,doors,sink)});
  return out;
}
/** Прямая кухня по длине стены: нижние корпуса на ножках, столешница на всю длину (длиннее 4100 — двумя частями), навесные над ней на регламентный зазор. */
export function createKitchenRow(length:number,source:Module,height:number=KITCHEN.baseHeight,depth:number=KITCHEN.baseDepth,sink?:string[]):PlacedModule[]{
  if(!Number.isFinite(length)||length<600||length>6000){fail(sink,'Прямая кухня: длина стены 600–6000 мм.');length=Math.max(600,Math.min(6000,Number.isFinite(length)?length:600));}
  if(!Number.isFinite(height)||!Number.isFinite(depth)){fail(sink,'Введите высоту и глубину кухни в миллиметрах.');return [];}
  const look=(m:Module)=>({...m,decor:source.decor,facadeDecor:source.facadeDecor}),out:PlacedModule[]=[],z=3;let x=0;
  const widths=kitchenRowWidths(length);
  for(const w of widths){const b=look(kitchenBase(initialModule(),w.width,w.kind));b.height=height;b.depth=depth;b.sections.forEach(s=>s.shelfDepth=depth-2.5);if(b.kdrawers)b.kdrawers=refitKDrawers(b);check(b,sink,b.name+': ');out.push({id:id(),x,y:0,z,rotation:0,module:b});
    const top=look(kitchenWall(initialModule(),w.width));out.push({id:id(),x,y:height+KITCHEN.worktopThickness+KITCHEN.wallGap,z:0,rotation:0,module:top});x+=w.width;}
  const pieces=length>4100?[Math.round(length/2),length-Math.round(length/2)]:[length];let wx=0;
  for(const p of pieces){out.push({id:id(),x:wx,y:height,z:0,rotation:0,module:look({...kitchenWorktop(initialModule(),p),depth:depth+KITCHEN.worktopDepth-KITCHEN.baseDepth,sections:[{...section(),shelves:[],drawers:0,rod:false}]})});wx+=p;}
  return out;
}
/** Подвесной ящик (заказ 7437584, изделия 1, 4, 5): навесной корпус без цоколя на навесах, один ящик на всю высоту — скрытые направляющие
 *  DTC push-to-open (без ручки), длина — самая длинная, что встаёт в глубину. В комнату ставится низом на RULES.hangingFloorY от пола. */
export function hangingDrawer(width:number,height:number,depth:number,source:Module):Module{
  const m:Module={...initialModule(),name:KIND_LABEL['hanging-drawer'],width,height,depth,decor:source.decor,facadeDecor:source.facadeDecor,doors:false,hanging:true,plinthHeight:0,sections:[section()]};
  const s=m.sections[0];s.drawers=1;s.drawerCap=false; // ящик на всю высоту — полки над ним нет
  const len=[...SLIDES.gtv0fpo.lengths].reverse().find(l=>l<=depth-rearClear(m)-25)??SLIDES.gtv0fpo.lengths[0];
  try{const c=drawersToRoof(m,s)[0];s.drawerConfigs=[{...c,slide:'gtv0fpo',operation:'push',brand:'dtc',length:len}];}catch{/* низкий корпус — ошибку покажет validate */return m;}
  // навесы ABS стоят в задних верхних углах боковин: короб — ниже них (шаг 4 мм), фасад — на всю высоту корпуса (без зазора над ним)
  const cfg=s.drawerConfigs[0],hit=()=>partCollisions(parts(m),m).some(x=>x.names.some(n=>/^Навес|^Заглушка навеса/.test(n)));
  cfg.facadeH=height-2*RULES.panel-RULES.drawerFrontGap; // шаг = проём: ящик «до крыши», накладной фасад растягивается на дно и крышу
  while(cfg.height>68&&hit())cfg.height-=4;
  // dp-2810 (консоль прихожей 900 × 150): у низкого корпуса шаг давал короб 66 < 68 (модуль палитры не проходил проверку), а короб 68
  // упирается в навесы — короб не ниже 68, направляющая короче, пока короб не уйдёт от навесов в задних углах
  if(cfg.height<68)cfg.height=68;
  for(const l of [...SLIDES.gtv0fpo.lengths].filter(l=>l<cfg.length).reverse()){if(!hit())break;cfg.length=l;}
  return m;
}
/** Модуль палитры без проверки (проверка формы видит все ошибки собранного модуля). Угловой и двери купе проверяются сами. */
export function assembleModule(kind:ModuleKind,width:number,height:number,depth:number,source:Module,doors?:number):Module{
  if(kind==='kitchen-base'||kind==='kitchen-wall'){
    const m={...(kind==='kitchen-base'?kitchenBase(initialModule(),width):kitchenWall(initialModule(),width)),height,depth,decor:source.decor,facadeDecor:source.facadeDecor};
    m.sections.forEach(s=>s.shelfDepth=depth-(kind==='kitchen-base'?2.5:22));
    return m;
  }
  if(kind==='worktop'){
    const m=kitchenWorktop(initialModule(),width);m.height=height;m.depth=depth;m.decor=source.decor;m.worktop!.thickness=height;
    // мельче 400 кухонной столешницы не бывает (WORKTOP_LDSP_MIN_DEPTH…400): это шкафная — ЛДСП 32 в цвет корпуса (ТВ-зона заказа 7437584)
    if(depth<400)setWorktopMaterial(m,'ldsp',32);
    m.sections=[{...section(),shelves:[],drawers:0,rod:false}];
    return m;
  }
  if(kind==='hanging-drawer')return hangingDrawer(width,height,depth,source);
  if(kind==='corner')return createCornerModule(width,height,depth,source);
  if(kind==='kupe')return createKupeModule(width,height,source,doors);
  let m:Module={...initialModule(),name:KIND_LABEL[kind],width,height,depth,decor:source.decor,facadeDecor:source.facadeDecor,sections:[section()]};
  if(kind==='desk')m={...deskModule(m),width,height,depth};
  else {
    const s=m.sections[0];
    if(kind==='shelves'){m.doors=false;s.shelves=distribute(m,s,4);}
    if(kind==='wardrobe'){s.rod=true;s.shelves=distribute(m,s,1);}
    // комод: ящики поровну до крыши, полки над ними нет (п.29 волны 22.10)
    // комод: 3 ящика до крыши; низкий корпус (подвесной ящик 200, заказ 7437584) — столько ящиков, сколько помещается (2, затем 1)
  if(kind==='drawers'){m.doors=false;if(height<350)m.plinthHeight=0;/* низкий ящичный модуль (подвесной ящик) — без цоколя: его поднимают «От пола» */for(const n of [3,2,1]){s.drawers=n;try{s.drawerConfigs=drawersToRoof(m,s);}catch{delete s.drawerConfigs;}if(!validate(m).some(e=>/ящики не помещаются|для ящиков нужно/.test(e)))break;}
    // один ящик и тот не встал по умолчанию: короб ниже (проём − 68), направляющая — самая длинная, что входит по глубине
    if(s.drawers===1&&validate(m).some(e=>/ящики не помещаются/.test(e))){const inner=m.height-2*RULES.panel,len=[...SLIDES.gtv0fpo.lengths].reverse().find(l=>l<=m.depth-25)??250;s.drawerConfigs=[{slide:'gtv0fpo',height:Math.max(68,Math.min(RULES.drawerH,inner-68)),length:len}];}}
    // число дверей выбрано в палитре (п.21): секции и створки под него
    if(doors&&m.doors&&(kind==='empty'||kind==='wardrobe'))m=withDoorCount(m,doors);
  }
  return m;
}
export function createModule(kind:ModuleKind,width:number,height:number,depth:number,source:Module,doors?:number):Module {
  const m=assembleModule(kind,width,height,depth,source,doors);
  const error=validate(m)[0];if(error)throw Error(error);
  return m;
}
/** Ширины корпусов ряда из общей ширины: поровну, остаток — последнему (как корпуса шкафа-купе). */
export function bodyWidths(total:number,bodies:number):number[]{
  const n=Math.max(1,Math.round(bodies)),bw=Math.floor(total/n);
  return Array.from({length:n},(_,i)=>i<n-1?bw:total-bw*(n-1));
}
/** Несколько одинаковых корпусов вплотную в ряд (w-formerrors 23.10: «Ширина 2575 > 1300 — разделить на 2 корпуса»). */
export function createModuleRow(kind:ModuleKind,total:number,bodies:number,height:number,depth:number,source:Module,doors?:number):PlacedModule[]{
  let x=30;
  const ws=bodyWidths(total,bodies);
  return ws.map((w,i)=>{const m=createModule(kind,w,height,depth,source,doors);if(ws.length>1)m.name=`${m.name} ${i+1}`;const a:PlacedModule={id:id(),x,y:0,z:30,rotation:0,module:m};x+=w;return a;});
}
