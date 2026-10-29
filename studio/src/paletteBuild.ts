// Сборка мебели из палитры «Добавить мебель» (перенесено из ModulePalette.tsx, w-formerrors 23.10: проверка формы paletteCheck.ts
// собирает те же модули без исключения на первой ошибке). Тексты ошибок прежние; ModulePalette.tsx реэкспортирует функции.
import {refitKDrawers} from './kitchenDrawers';
import {initialModule,section,deskModule,distribute,validate,id,drawersToRoof,roofEvenLayout,roofLayoutApplies,drawerFacesEqual,rearClear,parts,boxes,RULES,drawerConfig,drawerOffsets,drawerPitch,drawersBehindDoors,fb,type Module,type Section,type Part} from './model';
import {RADIUS,radiusMax,mansardIntrusions} from './shapes';
import {partCollisions} from './collisions';
import {SLIDES} from './hardware';
import {withDoorCount} from './paletteDoors';
import {fitSmallModule} from './smallSize';

import {createCornerModule} from './cornerWardrobe';
import {DEFAULT_KUPE,KUPE_DEPTH} from './kupe';
import {KITCHEN,kitchenBase,kitchenWall,kitchenWorktop,kitchenRowWidths,setWorktopMaterial} from './kitchen';
import type {PlacedModule} from './project';
// 'kitchen-corner' и 'kitchen-u' (w-lwing 23.10) — группы в угол комнаты, собираются kitchenCornerRow.ts (createKitchenCornerRow/createKitchenURow)
export type ModuleKind='empty'|'shelves'|'radius'|'wardrobe'|'drawers'|'hanging-drawer'|'desk'|'corner'|'kupe'|'kupe-wardrobe'|'kitchen-row'|'kitchen-corner'|'kitchen-u'|'kitchen-base'|'kitchen-wall'|'worktop';
/** Названия видов мебели палитры (имя нового модуля). */
export const KIND_LABEL:Record<ModuleKind,string>={empty:'Пустой шкаф',shelves:'Стеллаж',radius:'Стеллаж радиусный',wardrobe:'Для одежды',drawers:'Комод','hanging-drawer':'Подвесной ящик',corner:'Угловой шкаф',desk:'Стол','kupe-wardrobe':'Шкаф-купе','kitchen-row':'Кухня прямая','kitchen-corner':'Кухня угловая (Г)','kitchen-u':'Кухня П-образная','kitchen-base':'Нижний кухонный','kitchen-wall':'Навесной кухонный',worktop:'Столешница',kupe:'Двери купе'};
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
/** Стеллаж с радиусными полками (задача Макса 29.10.2026, shapes.ts): открытый торцевой, скругление у правого переднего угла
 *  радиусом «четверть круга» (до глубины/ширины полки), 4 полки поровну, дно и крыша тоже радиусные. */
export function radiusShelving(width:number,height:number,depth:number,source:Module,opts:{side?:'left'|'right';r?:number;shelves?:number}={}):Module{
  const m:Module={...initialModule(),name:KIND_LABEL.radius,width,height,depth,decor:source.decor,facadeDecor:source.facadeDecor,doors:false,sections:[section()],radius:{side:opts.side??'right',r:Math.max(RADIUS.min,Math.min(opts.r??radiusMax({width,depth}),radiusMax({width,depth})))}};
  m.sections[0].shelves=distribute(m,m.sections[0],opts.shelves??4);
  return m;
}
/** Мансарда (скос назад) у шкафа из палитры: задняя высота rear; полки, штанги — под скос (поровну по задней высоте, штанга — под верхней полкой). */
export function withMansard(m:Module,rear:number):Module{
  const n:Module={...structuredClone(m),mansard:{rear}};
  if(n.kitchen||n.radius||n.corner||n.desk||n.kupe||n.raw)return n;
  const low:Module={...n,height:Math.max(RULES.minH,rear-RULES.panel*2)};
  for(const [i,s] of n.sections.entries()){const k=s.shelves.length;if(!k)continue;const fr=distribute(low,low.sections[i],k),bl=boxes(low)[i],bh=boxes(n)[i];
    s.shelves=fr.map(f=>Math.round(((bl.bottom+f*(bl.top-bl.bottom)-bh.bottom)/(bh.top-bh.bottom))*1e4)/1e4);}
  return n;
}
/** «Опустить полки под скос» (кнопка панели и плашки ошибки, критик 29.10 блокер 4): полки — поровну под задней высотой (withMansard),
 *  штанга — ниже, пока она с держателями не уйдёт из-под крыши (с местом под плечики 50 мм; круг 2: и штанга без заданной высоты —
 *  у секции без полок она под крышей). Круг 2 критика 29.10 — после кнопки сквозь крышу не остаётся ничего, иначе отказ с причиной:
 *  выдвижные тремпели — верхняя полка (на ней они висят, от 0,6 высоты секции) выше, сколько позволяет скос; ящик (комод) — короб ниже
 *  (фасад тот же: шаг ящика держит высота фасада), не хватает до 68 мм — короче направляющая. */
export function fitUnderMansard(m:Module):Module{
  if(!m.mansard)return m;
  const n=withMansard(m,m.mansard.rear);
  const hits=(s:Section,roles:Part['role'][])=>mansardIntrusions(n,parts(n)).filter(x=>x.error&&x.part.sectionId===s.id&&roles.includes(x.part.role));
  for(const s of n.sections){
    const b=boxes(n).find(x=>x.id===s.id);if(!b)continue;
    const h=b.top-b.bottom,step=10/h;
    // штанга: без заданной высоты — с её места по деталям; ниже, пока штанга и держатели под крышей (и место под плечики)
    const rodHit=()=>mansardIntrusions(n,parts(n)).some(x=>x.part.sectionId===s.id&&(x.part.role==='rod'||(x.part.role==='flange'&&/:flange:\d+$/.test(x.part.id))));
    if(s.rod&&s.rodAt===undefined&&rodHit()){const rp=parts(n).find(p=>p.id===s.id+':rod');if(rp)s.rodAt=Math.round((rp.position[1]-b.bottom)/h*1e4)/1e4;}
    if(s.rodAt!==undefined)for(let k=0;k<300&&s.rodAt-step>=0.1&&rodHit();k++)s.rodAt=Math.round((s.rodAt-step)*1e4)/1e4;
    // выдвижные тремпели висят под верхней полкой от 0,6 высоты секции (иначе — под крышей): верхняя полка — самая высокая под скосом
    if(s.pullouts&&hits(s,['pantograph','shelf']).length&&s.shelves.length){
      const hi=s.shelves.indexOf(Math.max(...s.shelves)),floor=Math.max(0.6,...s.shelves.filter((_,j)=>j!==hi).map(f=>f+(RULES.panel+RULES.shelfMinClear)/h));
      const keep=s.shelves[hi];let ok=false;
      for(let f=Math.floor((1-(RULES.panel/2+RULES.shelfMinClear)/h)*1e4)/1e4;f>=floor&&!ok;f=Math.round((f-step)*1e4)/1e4){s.shelves[hi]=f;ok=!hits(s,['pantograph','shelf']).length;}
      if(!ok){s.shelves[hi]=keep;throw Error(`Под скос не встают выдвижные тремпели: они висят под верхней полкой не ниже 0,6 высоты секции (${Math.round(b.bottom+0.6*h)} мм от низа корпуса), а скос там ниже. Уберите тремпели или увеличьте высоту сзади / уменьшите глубину корпуса.`);}
    }
    if(s.drawers&&hits(s,['drawer']).length)fitDrawersUnderRoof(n,s,()=>hits(s,['drawer']));
  }
  const left=mansardIntrusions(n,parts(n)).filter(x=>x.error);
  if(left.length){const x=left[0],what=x.part.name.replace(/ · .*$/,'');
    throw Error(`Под скос не встаёт «${what}»: выше нижней пласти крыши на ${x.over} мм у задней кромки${x.part.role==='pantograph'?' — выдвижной тремпель висит под верхней полкой (от 0,6 высоты секции), под этим скосом ей места нет. Уберите тремпель':x.part.role==='drawer'?' — даже с коробом 68 мм и самой короткой направляющей. Уберите ящик':''} или увеличьте высоту сзади / уменьшите глубину корпуса.`);}
  return n;
}
/** Ящики секции под скос мансарды: короб того ящика, что проходит сквозь крышу, — ниже (до 68 мм), затем короче направляющая.
 *  Фасад и шаг ящика те же: у ящика задаётся высота фасада (как parts() строит фасад с заданной высотой — пол-зазора снизу, ящик ниже
 *  на пол-зазора), ящики выше не двигаются. Короб не уходит из-под крыши — секция остаётся как есть (отказ — в fitUnderMansard). */
function fitDrawersUnderRoof(n:Module,s:Section,hit:()=>ReturnType<typeof mansardIntrusions>):void{
  const g=s.drawerGap??(drawersBehindDoors(n,s)?RULES.drawerFrontGap:fb(n)),off=drawerOffsets(s),was=s.drawerConfigs;
  s.drawerConfigs=Array.from({length:s.drawers},(_,k)=>({...drawerConfig(n,s,k),y:off[k]}));
  const touched=new Set<number>();
  for(let guard=0;guard<40;guard++){
    const x=hit()[0];if(!x)return;
    const j=Number(x.part.id.split(':drawer:')[1].split(':')[0]),c=s.drawerConfigs[j];
    if(!touched.has(j)){touched.add(j);
      // фасад задаётся высотой (у фасада с высотой — пол-зазора снизу, зазор под ним 3 мм как у равных фасадов выше короба): верх фасада
      // тот же, шаг ящика не длиннее прежнего (ящики не пересекаются); верхний до крыши — шаг тот же (фасад тянется до верха фасадов сам)
      // шаг ящика в проверке — по зазору шага (s.drawerGap ?? 3), фасад — по зазору фасадов g: верхний — шаг тот же, остальные — верх фасада тот же
      const highest=off.every((o,k)=>k===j||o<=off[j]),G=s.drawerGap??RULES.drawerFrontGap,pitch=drawerPitch(c,G);
      if(c.facadeH===undefined)c.facadeH=Math.round((highest?pitch-G:Math.min(pitch-G,pitch-1.5*g))*100)/100;
    }
    if(c.height-x.over-1>=68){c.height=Math.floor(c.height-x.over-1);continue;}
    if(c.height>68){c.height=68;continue;}
    const shorter=[...SLIDES[c.slide].lengths].filter(l=>l<c.length).sort((a,b)=>b-a)[0];
    if(shorter===undefined){s.drawerConfigs=was;return;}
    c.length=shorter;
  }
}
/** Модуль палитры без проверки (проверка формы видит все ошибки собранного модуля). Угловой и двери купе проверяются сами. */
export function assembleModule(kind:ModuleKind,width:number,height:number,depth:number,source:Module,doors?:number,fit=true):Module{
  // волна 29.10: корпус от 100×100 — наполнение, которое в малый корпус не входит, снимается (smallSize.ts), а не запрещает размер
  const m=assembleRaw(kind,width,height,depth,source,doors);
  if(fit&&!['corner','kupe','worktop','desk'].includes(kind))fitSmallModule(m);
  return m;
}
/** Что палитра сняла с малого корпуса (сообщение менеджеру после добавления; пусто — ничего). */
export function paletteFitNotes(kind:ModuleKind,width:number,height:number,depth:number,source:Module,doors?:number):string[]{
  if(['corner','kupe','worktop','desk'].includes(kind))return [];
  try{return fitSmallModule(assembleRaw(kind,width,height,depth,source,doors));}catch{return [];}
}
function assembleRaw(kind:ModuleKind,width:number,height:number,depth:number,source:Module,doors?:number):Module{
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
  if(kind==='radius')return radiusShelving(width,height,depth,source);
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
  if(kind==='drawers'){m.doors=false;if(height<350)m.plinthHeight=0;/* низкий ящичный модуль (подвесной ящик) — без цоколя: его поднимают «От пола» */
    // правка Макса 29.10.2026: фасады комода равные со старта (drawersToRoof → evenDrawerConfigs); высокому комоду — 4–5 ящиков,
    // если при трёх короб вышел бы выше 300 и фасады не сравнять
    const fits=()=>!validate(m).some(e=>/ящики не помещаются|для ящиков нужно/.test(e));
    // (критик 29.10: равные фасады встают и выше короба — палитра по-прежнему даёт высокому комоду больше ящиков, а не высокие фасады)
    const tall=[3,4,5].find(n=>{s.drawers=n;try{s.drawerConfigs=roofLayoutApplies(m,s)?roofEvenLayout(m,s,{plainOnly:true}):drawersToRoof(m,s);}catch{return false;}return fits()&&drawerFacesEqual(m,s);});
    if(tall===undefined)for(const n of [3,2,1]){s.drawers=n;try{s.drawerConfigs=drawersToRoof(m,s);}catch{delete s.drawerConfigs;}if(fits())break;}
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
