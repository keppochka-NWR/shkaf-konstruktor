// Сборка мебели из палитры «Добавить мебель» (перенесено из ModulePalette.tsx, w-formerrors 23.10: проверка формы paletteCheck.ts
// собирает те же модули без исключения на первой ошибке). Тексты ошибок прежние; ModulePalette.tsx реэкспортирует функции.
import {refitKDrawers} from './kitchenDrawers';
import {initialModule,section,deskModule,distribute,validate,id,drawersToRoof,RULES,type Module} from './model';
import {withDoorCount} from './paletteDoors';
import {createCornerModule} from './cornerWardrobe';
import {DEFAULT_KUPE,KUPE_DEPTH} from './kupe';
import {KITCHEN,kitchenBase,kitchenWall,kitchenWorktop,kitchenRowWidths} from './kitchen';
import type {PlacedModule} from './project';
export type ModuleKind='empty'|'shelves'|'wardrobe'|'drawers'|'desk'|'corner'|'kupe'|'kupe-wardrobe'|'kitchen-row'|'kitchen-base'|'kitchen-wall'|'worktop';
/** Названия видов мебели палитры (имя нового модуля). */
export const KIND_LABEL:Record<ModuleKind,string>={empty:'Пустой шкаф',shelves:'Стеллаж',wardrobe:'Для одежды',drawers:'Комод',corner:'Угловой шкаф',desk:'Стол','kupe-wardrobe':'Шкаф-купе','kitchen-row':'Кухня прямая','kitchen-base':'Нижний кухонный','kitchen-wall':'Навесной кухонный',worktop:'Столешница',kupe:'Двери купе'};
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
/** Модуль палитры без проверки (проверка формы видит все ошибки собранного модуля). Угловой и двери купе проверяются сами. */
export function assembleModule(kind:ModuleKind,width:number,height:number,depth:number,source:Module,doors?:number):Module{
  if(kind==='kitchen-base'||kind==='kitchen-wall'){
    const m={...(kind==='kitchen-base'?kitchenBase(initialModule(),width):kitchenWall(initialModule(),width)),height,depth,decor:source.decor,facadeDecor:source.facadeDecor};
    m.sections.forEach(s=>s.shelfDepth=depth-(kind==='kitchen-base'?2.5:22));
    return m;
  }
  if(kind==='worktop'){
    const m=kitchenWorktop(initialModule(),width);m.height=height;m.depth=depth;m.decor=source.decor;m.worktop!.thickness=height;
    m.sections=[{...section(),shelves:[],drawers:0,rod:false}];
    return m;
  }
  if(kind==='corner')return createCornerModule(width,height,depth,source);
  if(kind==='kupe')return createKupeModule(width,height,source,doors);
  let m:Module={...initialModule(),name:KIND_LABEL[kind],width,height,depth,decor:source.decor,facadeDecor:source.facadeDecor,sections:[section()]};
  if(kind==='desk')m={...deskModule(m),width,height,depth};
  else {
    const s=m.sections[0];
    if(kind==='shelves'){m.doors=false;s.shelves=distribute(m,s,4);}
    if(kind==='wardrobe'){s.rod=true;s.shelves=distribute(m,s,1);}
    // комод: ящики поровну до крыши, полки над ними нет (п.29 волны 22.10)
    if(kind==='drawers'){m.doors=false;s.drawers=3;try{s.drawerConfigs=drawersToRoof(m,s);}catch{/* низкий корпус — ящики по умолчанию, ошибку покажет validate */}}
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
