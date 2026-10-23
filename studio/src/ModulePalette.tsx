import {refitKDrawers} from './kitchenDrawers';
import {useEffect,useMemo,useRef,useState,type ReactNode} from 'react';
import {Box,Rows3,Shirt,Archive,PanelTop,Columns2,SquareSplitHorizontal,CookingPot,PanelBottom,PanelTopOpen,RectangleHorizontal,CornerDownRight} from 'lucide-react';
import {createKitchenCornerRow,createKitchenURow} from './kitchenCornerRow';
import {initialModule,section,deskModule,distribute,validate,id,drawersToRoof,RULES,type Module} from './model';
import {withDoorCount,doorCountOptions,autoDoorCount} from './paletteDoors';
import {createCornerModule} from './cornerWardrobe';
import {DEFAULT_KUPE,KUPE_DEPTH} from './kupe';
import {KITCHEN,kitchenBase,kitchenWall,kitchenWorktop,kitchenRowWidths} from './kitchen';
import type {PlacedModule} from './project';
import {rowShortageText,type RowShortage} from './rowFit';
export type ModuleKind='empty'|'shelves'|'wardrobe'|'drawers'|'desk'|'corner'|'kupe'|'kupe-wardrobe'|'kitchen-row'|'kitchen-corner'|'kitchen-u'|'kitchen-base'|'kitchen-wall'|'worktop';
const choices=[{id:'empty',label:'Пустой шкаф',icon:Box},{id:'shelves',label:'Стеллаж',icon:Rows3},{id:'wardrobe',label:'Для одежды',icon:Shirt},{id:'drawers',label:'Комод',icon:Archive},{id:'corner',label:'Угловой шкаф',icon:Box},{id:'desk',label:'Стол',icon:PanelTop},{id:'kupe-wardrobe',label:'Шкаф-купе',icon:Columns2},{id:'kitchen-row',label:'Кухня прямая',icon:CookingPot},{id:'kitchen-corner',label:'Кухня угловая (Г)',icon:CornerDownRight},{id:'kitchen-u',label:'Кухня П-образная',icon:Columns2},{id:'kitchen-base',label:'Нижний кухонный',icon:PanelBottom},{id:'kitchen-wall',label:'Навесной кухонный',icon:PanelTopOpen},{id:'worktop',label:'Столешница',icon:RectangleHorizontal},{id:'kupe',label:'Двери купе',icon:SquareSplitHorizontal}] as const;
const SIZES:Partial<Record<ModuleKind,[number,number,number]>>={'kitchen-row':[3000,KITCHEN.baseHeight,KITCHEN.baseDepth],'kitchen-corner':[3000,KITCHEN.baseHeight,KITCHEN.baseDepth],'kitchen-u':[3600,KITCHEN.baseHeight,KITCHEN.baseDepth],'kitchen-base':[600,KITCHEN.baseHeight,KITCHEN.baseDepth],'kitchen-wall':[600,KITCHEN.wallHeight,KITCHEN.wallDepth],worktop:[2400,KITCHEN.worktopThickness,KITCHEN.worktopDepth],corner:[1050,2000,450],desk:[1200,750,600],drawers:[600,850,550],kupe:[1600,2400,KUPE_DEPTH],'kupe-wardrobe':[1800,2400,600]};
/** Типы распашных шкафов, между которыми габариты палитры переносятся при смене типа (v5). */
const KEEP_SIZES=['empty','shelves','wardrobe','drawers'] as const;
/** Двери купе: проём W×H, глубина зоны направляющих 100 мм. */
export function createKupeModule(width:number,height:number,source:Module,doors?:number):Module{
  const m:Module={...initialModule(),name:'Двери купе',width,height,depth:KUPE_DEPTH,decor:source.decor,facadeDecor:source.facadeDecor,doors:false,plinthHeight:0,sections:[section()],kupe:{...structuredClone(DEFAULT_KUPE),...(doors?{doors}:{})}};
  const error=validate(m)[0];if(error)throw Error(error);
  return m;
}
/** Шкаф-купе. mount 'free' (как было): корпуса без распашных дверей (каждый не шире 1300) и двери купе перед ними на всю ширину.
 *  mount 'inside' (менеджеры 22.10): один корпус — боковины до пола и крыша на всю глубину, секции за дверями на глубине depth − 100;
 *  двери купе между боковинами и под крышей, нижняя направляющая на полу (дно и цоколь — за дверями). */
export function createKupeWardrobe(width:number,height:number,depth:number,source:Module,doors?:number,mount:'free'|'inside'='free'):PlacedModule[]{
  if(depth<350+KUPE_DEPTH)throw Error(`Глубина шкафа-купе от ${350+KUPE_DEPTH} мм: ${KUPE_DEPTH} мм занимают направляющие.`);
  if(mount==='inside'){
    const t=RULES.panel,bodyDepth=depth-KUPE_DEPTH,n=Math.max(1,Math.ceil((width-2*t)/1000));
    const m:Module={...initialModule(),name:'Корпус шкафа-купе',width,height,depth:bodyDepth,kupeZone:KUPE_DEPTH,decor:source.decor,facadeDecor:source.facadeDecor,doors:false,sections:Array.from({length:n},()=>section())};
    m.sections.forEach((s,i)=>{if(i%2===0){s.rod=true;s.shelves=distribute(m,s,1);}else s.shelves=distribute(m,s,5);});
    // задник ХДФ одним листом 2800×2070: у широкого и высокого шкафа (оба размера больше 2050) не выкраивается — без задника, к стене (вопрос Максу)
    if(Math.min(width,height)>RULES.hdfH-2*RULES.sheetMargin)m.backType='none';
    const error=validate(m)[0];if(error)throw Error(error);
    const k=createKupeModule(width-2*t,height-t,source,doors);k.kupe!.mount='inside';
    return [{id:id(),x:30,y:0,z:30,rotation:0,module:m},{id:id(),x:30+t,y:0,z:30+bodyDepth,rotation:0,module:k}];
  }
  const n=Math.max(1,Math.ceil(width/1200)),bw=Math.floor(width/n),bodyDepth=depth-KUPE_DEPTH,out:PlacedModule[]=[];
  for(let i=0;i<n;i++){
    // K6: корпус шкафа-купе (двери отдельно) — высота до листа, как при дверях внутри (kupeBody)
    const m:Module={...initialModule(),name:'Корпус шкафа-купе',width:i<n-1?bw:width-bw*(n-1),height,depth:bodyDepth,kupeBody:true,decor:source.decor,facadeDecor:source.facadeDecor,doors:false,sections:[section()]};
    const s=m.sections[0];if(i%2===0){s.rod=true;s.shelves=distribute(m,s,1);}else s.shelves=distribute(m,s,5);
    const error=validate(m)[0];if(error)throw Error(error);
    out.push({id:id(),x:30+i*bw,y:0,z:30,rotation:0,module:m});
  }
  out.push({id:id(),x:30,y:0,z:30+bodyDepth,rotation:0,module:createKupeModule(width,height,source,doors)});
  return out;
}
/** Прямая кухня по длине стены: нижние корпуса на ножках, столешница на всю длину (длиннее 4100 — двумя частями), навесные над ней на регламентный зазор. */
export function createKitchenRow(length:number,source:Module,height:number=KITCHEN.baseHeight,depth:number=KITCHEN.baseDepth):PlacedModule[]{
  if(!Number.isFinite(length)||length<600||length>6000)throw Error('Прямая кухня: длина стены 600–6000 мм.');
  if(!Number.isFinite(height)||!Number.isFinite(depth))throw Error('Введите высоту и глубину кухни в миллиметрах.');
  const look=(m:Module)=>({...m,decor:source.decor,facadeDecor:source.facadeDecor}),out:PlacedModule[]=[],z=3;let x=0;
  const widths=kitchenRowWidths(length);
  for(const w of widths){const b=look(kitchenBase(initialModule(),w.width,w.kind));b.height=height;b.depth=depth;b.sections.forEach(s=>s.shelfDepth=depth-2.5);if(b.kdrawers)b.kdrawers=refitKDrawers(b);const e=validate(b)[0];if(e)throw Error(b.name+': '+e);out.push({id:id(),x,y:0,z,rotation:0,module:b});
    const top=look(kitchenWall(initialModule(),w.width));out.push({id:id(),x,y:height+KITCHEN.worktopThickness+KITCHEN.wallGap,z:0,rotation:0,module:top});x+=w.width;}
  const pieces=length>4100?[Math.round(length/2),length-Math.round(length/2)]:[length];let wx=0;
  for(const p of pieces){out.push({id:id(),x:wx,y:height,z:0,rotation:0,module:look({...kitchenWorktop(initialModule(),p),depth:depth+KITCHEN.worktopDepth-KITCHEN.baseDepth,sections:[{...section(),shelves:[],drawers:0,rod:false}]})});wx+=p;}
  return out;
}
export function createModule(kind:ModuleKind,width:number,height:number,depth:number,source:Module,doors?:number):Module {
  if(kind==='kitchen-base'||kind==='kitchen-wall'){
    const m={...(kind==='kitchen-base'?kitchenBase(initialModule(),width):kitchenWall(initialModule(),width)),height,depth,decor:source.decor,facadeDecor:source.facadeDecor};
    m.sections.forEach(s=>s.shelfDepth=depth-(kind==='kitchen-base'?2.5:22));
    const error=validate(m)[0];if(error)throw Error(error);return m;
  }
  if(kind==='worktop'){
    const m=kitchenWorktop(initialModule(),width);m.height=height;m.depth=depth;m.decor=source.decor;m.worktop!.thickness=height;
    m.sections=[{...section(),shelves:[],drawers:0,rod:false}];
    const error=validate(m)[0];if(error)throw Error(error);return m;
  }
  if(kind==='corner')return createCornerModule(width,height,depth,source);
  if(kind==='kupe')return createKupeModule(width,height,source,doors);
  let m:Module={...initialModule(),name:choices.find(c=>c.id===kind)!.label,width,height,depth,decor:source.decor,facadeDecor:source.facadeDecor,sections:[section()]};
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
  const error=validate(m)[0];if(error)throw Error(error);
  return m;
}
const categories=[{id:'wardrobe',label:'Шкафы распашные',kinds:['empty','shelves','wardrobe','drawers','corner','desk']},{id:'kitchen',label:'Кухонные модули',kinds:['kitchen-row','kitchen-corner','kitchen-u','kitchen-base','kitchen-wall','worktop']},{id:'kupe',label:'Шкафы-купе',kinds:['kupe-wardrobe','kupe']}] as const;
const PALETTE_KEY='studio-palette';
type PaletteChoice={category:string;kind:ModuleKind;width:number;height:number;depth:number;/** K6 (критик 22.10): установка дверей купе и число дверей — тоже переживают пересоздание палитры */mount?:'free'|'inside';doors?:'auto'|number};
/** Сохранённый выбор палитры этой вкладки; несогласованная запись (категория без такого вида) отбрасывается. */
function readPalette():PaletteChoice|null{
  try{const v=JSON.parse(sessionStorage.getItem(PALETTE_KEY)||'null') as PaletteChoice|null;const c=categories.find(x=>x.id===v?.category);
    return v&&c&&(c.kinds as readonly string[]).includes(v.kind)&&[v.width,v.height,v.depth].every(Number.isFinite)?v:null;}catch{return null;}
}
export function ModulePalette({source,onAdd,onAddGroup,kitchenTemplates,fit,room}:{source:Module;onAdd:(module:Module)=>boolean;/** keep — группа встаёт на свои координаты (угловая кухня — в угол комнаты), без поиска места */onAddGroup:(group:PlacedModule[],keep?:boolean)=>boolean;kitchenTemplates?:ReactNode;
  /** комната — для «Кухня угловая (Г)»: ряды у задней и боковой стены */room?:{width:number;depth:number;height:number};
  /** Нехватка места в ряду у стены (rowFit.ts, m1 критика 22.10): вместо молчаливой расстановки перед шкафами — варианты. */
  fit?:(module:Module)=>RowShortage|null}) {
  // T1 (18.10): выбор палитры живёт дольше экземпляра — после первого шкафа редактор пересоздаётся, а категория и размеры остаются.
  const [saved]=useState(readPalette);
  const [kind,setKind]=useState<ModuleKind>(saved?.kind??'empty'),[width,setWidth]=useState(saved?.width??600),[height,setHeight]=useState(saved?.height??2000),[depth,setDepth]=useState(saved?.depth??550),[error,setError]=useState('');
  const [category,setCategory]=useState<string>(saved?.category??'wardrobe');
  const [kupeMount,setKupeMount]=useState<'free'|'inside'>(saved?.mount==='inside'?'inside':'free');
  // «Кухня угловая (Г)» (w-lwing 23.10): длина по боковой стене и у какой стены второе крыло
  const [cornerSide,setCornerSide]=useState(2400),[cornerWing,setCornerWing]=useState<'left'|'right'>('right');
  // «Кухня П-образная»: длина по левой стене (по правой — cornerSide), по задней — во всю ширину комнаты
  const [uLeft,setULeft]=useState(2400);
  // v5 (замер удобства 22.10): смена типа шкафа (Пустой → Стеллаж) не сбрасывает введённые габариты, если новый тип их принимает;
  // у кухни, купе, углового и стола размеры значат другое — там, как раньше, размеры типа
  const pick=(next:ModuleKind)=>{const same=(KEEP_SIZES as readonly string[]).includes(kind)&&(KEEP_SIZES as readonly string[]).includes(next);let keep=false;if(same&&next!==kind){try{createModule(next,width,height,depth,source);keep=true;}catch{keep=false;}}
    setKind(next);if(!keep&&next!==kind){const sz=SIZES[next]??[600,2000,550];setWidth(next==='kitchen-u'&&room?room.width:sz[0]);setHeight(sz[1]);setDepth(sz[2]);}setError('');setDoors('auto');};
  // п.21 волны 22.10: число дверей до «Добавить в комнату» — распашной шкаф (секции под двери) и двери купе; варианты — только допустимые по размерам
  const [doors,setDoors]=useState<'auto'|number>(typeof saved?.doors==='number'&&Number.isInteger(saved.doors)&&saved.doors>0&&saved.doors<8?saved.doors:'auto');
  useEffect(()=>{try{sessionStorage.setItem(PALETTE_KEY,JSON.stringify({category,kind,width,height,depth,mount:kupeMount,doors}));}catch{/* без хранилища выбор не запоминается */}},[category,kind,width,height,depth,kupeMount,doors]);
  const kupeKind=kind==='kupe'||kind==='kupe-wardrobe';
  const doorChoice=useMemo(()=>{
    if(kupeKind){let why='';const ok=[1,2,3,4,5,6,7].filter(n=>{try{createKupeModule(width,height,source,n);return true;}catch(e){why=why||(e as Error).message;return false;}});return {options:ok,auto:ok.includes(DEFAULT_KUPE.doors)?DEFAULT_KUPE.doors:ok[0]??DEFAULT_KUPE.doors,why:ok.length?'':why};}
    if(kind!=='empty'&&kind!=='wardrobe')return null;
    // u3 (замер удобства 22.10): причина — по факту (высота, глубина…), а не всегда «измените ширину»
    try{const base=createModule(kind,width,height,depth,source);return {options:doorCountOptions(base),auto:autoDoorCount(base),why:'',autoArg:undefined as number|undefined};}catch(e){
      // v1 (замер удобства 22.10): 1288 × 2500 — «авто» (одна секция, створки шире 600) не собирается, но 4 двери в 2 секциях можно:
      // варианты считаем от собранного шкафа с любым допустимым числом дверей; «Авто» тогда — первый допустимый вариант
      for(let n=2;n<=14;n++){try{const base=createModule(kind,width,height,depth,source,n),options=doorCountOptions(base);if(options.length)return {options,auto:options[0],why:'',autoArg:options[0] as number|undefined};}catch{/* следующее число */}}
      return {options:[],auto:0,why:(e as Error).message,autoArg:undefined as number|undefined};}
  },[kind,kupeKind,width,height,depth,source]);
  const doorValue=doors!=='auto'&&doorChoice?.options.includes(doors)?doors:'auto';
  const doorArg=doorValue==='auto'?(kupeKind?doorChoice?.auto:doorChoice&&'autoArg' in doorChoice?doorChoice.autoArg:undefined):doorValue;
  // m1 (критик 22.10): шкаф не встаёт в ряд у стены — сообщение с вариантами; смена вида/размеров убирает предложение
  const [offer,setOffer]=useState<{module:Module;s:RowShortage}|null>(null);
  useEffect(()=>{if(offer){setOffer(null);setError('');}},[kind,width,height,depth,doorValue]); // eslint-disable-line react-hooks/exhaustive-deps
  // кнопка «Добавить в комнату» прилипает к низу панели (m11) — варианты прокручиваем к середине, чтобы она их не закрывала
  const offerRef=useRef<HTMLDivElement>(null);
  useEffect(()=>{if(offer)offerRef.current?.scrollIntoView?.({block:'center'});},[offer]);
  const narrowed=(w:number,off:boolean):Module=>{let m:Module;try{m=createModule(kind,w,height,depth,source,doorArg);}catch{m=createModule(kind,w,height,depth,source);}return off?{...m,autoFillersOff:true}:m;};
  const take=(make:()=>Module)=>{try{const ok=onAdd(make());if(ok){setOffer(null);setError('');}}catch(e){setOffer(null);setError((e as Error).message);}};
  const note=kind==='corner'?'Пятиугольный корпус с диагональными дверями и двумя боковыми блоками. Стороны угла одинаковые. Антресоль добавляется отдельно.'
    :kind==='kupe'?'Размеры проёма. Ставьте перед корпусами или в нишу между стенами. Глубина направляющих 100 мм. Цена — по калькулятору купе.'
    :kind==='kupe-wardrobe'&&kupeMount==='inside'?'Боковины до пола и крыша на всю глубину; двери купе между боковинами под крышей, нижняя направляющая на полу. Дно, цоколь и секции — за дверями, 100 мм глубины занимают направляющие.'
    :kind==='kupe-wardrobe'?'Корпуса без распашных дверей и двери купе на всю ширину. Глубина — общая, 100 мм из неё занимают направляющие.'
    :kind==='kitchen-corner'?'Г-образная кухня в углу комнаты: ряд по задней стене от угла и ряд по боковой стене от задней. В углу — нижний угловой с фальшпанелью (глухая часть в угол) и над ним навесной угловой; второе крыло — от линии фасадов первого, с угловой планкой. Столешница двумя кусками, навесные по обоим крыльям.'
    :kind==='kitchen-u'?'П-образная кухня: левая, задняя (во всю ширину комнаты) и правая стены. В обоих углах — нижний и навесной угловые, крылья — от линии фасадов задней стены, с угловой планкой. Столешница тремя кусками, навесные по всем стенам.'
    :kind==='kitchen-row'?'Ширина — длина ряда корпусов; у боковых стен нужен запас по 21 мм под фальши. Высота — нижние корпуса с опорами, глубина — нижние корпуса без фасадов. Нижние корпуса на ножках (ящики, мойка, распашные), столешница во всю длину, навесные над ней на регламентный зазор.'
    :kind==='kitchen-base'?'Нижний кухонный: на ножках с цокольной планкой, вместо крыши царги под столешницу.'
    :kind==='kitchen-wall'?'Навесной кухонный: на навесах. Поставьте его на нужную высоту в сцене.'
    :kind==='worktop'?'Столешница — отдельным объектом. Ставьте сверху на нижние корпуса.'
    :'Размеры в мм. Создаётся отдельный корпус.';
  return <details className="module-palette" open><summary>Добавить мебель</summary>
    <div className="catalog-tabs" role="tablist" aria-label="Категория мебели">{categories.map(c=><button type="button" role="tab" key={c.id} aria-selected={category===c.id} onClick={()=>{setCategory(c.id);pick(c.kinds[0]);}}>{c.label}</button>)}</div>
    <div className="module-kinds">{choices.filter(c=>(categories.find(x=>x.id===category)!.kinds as readonly string[]).includes(c.id)).map(c=><button key={c.id} type="button" aria-pressed={kind===c.id} onClick={()=>pick(c.id)}><c.icon size={23}/><span>{c.label}</span></button>)}</div>
    <div className="module-sizes">{[...(kind==='kitchen-u'?[{label:'По левой стене',value:uLeft,set:setULeft}]:[]),{label:kind==='corner'?'Сторона угла':kind==='kupe'?'Ширина проёма':kind==='kitchen-corner'||kind==='kitchen-u'?'По задней стене':'Ширина',value:width,set:setWidth},...(kind==='kitchen-corner'?[{label:'По боковой стене',value:cornerSide,set:setCornerSide}]:kind==='kitchen-u'?[{label:'По правой стене',value:cornerSide,set:setCornerSide}]:[]),{label:kind==='kupe'?'Высота проёма':'Высота',value:height,set:setHeight},...(kind==='kupe'?[]:[{label:kind==='corner'?'Глубина боковины':'Глубина',value:depth,set:setDepth}])].map(f=><label key={f.label}>{f.label}<input aria-label={`${f.label} новой мебели`} type="number" value={f.value} onChange={e=>f.set(Number(e.target.value))}/></label>)}</div>
    {doorChoice&&<label className="palette-doors">{kupeKind?'Дверей купе':'Дверей'}<select aria-label={kupeKind?'Дверей купе у новой мебели':'Дверей у новой мебели'} value={String(doorValue)} onChange={e=>setDoors(e.target.value==='auto'?'auto':Number(e.target.value))}>
      <option value="auto">Авто{doorChoice.auto?` · ${doorChoice.auto}`:''}</option>
      {doorChoice.options.map(n=><option key={n} value={n}>{n}{kupeKind?'':` · секций ${Math.ceil(n/2)}`}</option>)}
    </select>{!doorChoice.options.length&&<small>{doorChoice.why?`Число дверей не выбирается: ${doorChoice.why}`:'При этой ширине число дверей не выбирается — измените ширину.'}</small>}</label>}
    {kind==='kitchen-corner'&&<label className="hardware-field">Второе крыло<select aria-label="Второе крыло угловой кухни" value={cornerWing} onChange={e=>setCornerWing(e.target.value==='left'?'left':'right')}><option value="right">у правой стены</option><option value="left">у левой стены</option></select></label>}
    {kind==='kupe-wardrobe'&&<label className="hardware-field">Установка дверей<select aria-label="Установка дверей купе" value={kupeMount} onChange={e=>setKupeMount(e.target.value==='inside'?'inside':'free')}><option value="inside">внутри шкафа</option><option value="free">отдельно (ниша или перед корпусами)</option></select></label>}
    <small>{note}</small>
    {error&&<p role="alert">{error}</p>}
    {offer&&<div className="palette-row-fit" role="group" aria-label="Шкаф не встаёт в ряд" ref={offerRef}>
      {offer.s.withFiller!==null&&<button type="button" className="outline" onClick={()=>take(()=>narrowed(offer.s.withFiller!,false))}>Сузить до {offer.s.withFiller} мм{offer.s.filler?' (с фальшем)':''}</button>}
      {offer.s.withoutFiller!==null&&<button type="button" className="outline" onClick={()=>take(()=>narrowed(offer.s.withoutFiller!,true))}>{offer.s.withoutFiller} мм без фальша у стены</button>}
      <button type="button" className="text-action" onClick={()=>take(()=>offer.module)}>Поставить отдельно (перед шкафами)</button>
    </div>}
    <button className="primary full" onClick={()=>{try{if(kind==='kitchen-u'){if(!room)throw Error('П-образная кухня ставится в комнату: откройте проект с помещением.');if(onAddGroup(createKitchenURow(source,{left:uLeft,back:width,right:cornerSide,room,height,depth}),true))setError('');return;}if(kind==='kitchen-corner'){if(!room)throw Error('Угловая кухня ставится в комнату: откройте проект с помещением.');if(onAddGroup(createKitchenCornerRow(source,{back:width,side:cornerSide,wing:cornerWing,room,height,depth}),true))setError('');return;}if(kind==='kupe-wardrobe'||kind==='kitchen-row'){const ok=kind==='kupe-wardrobe'?onAddGroup(createKupeWardrobe(width,height,depth,source,doorArg,kupeMount)):onAddGroup(createKitchenRow(width,source,height,depth));if(ok)setError('');return;}
      const m=createModule(kind,width,height,depth,source,doorArg),s=fit?.(m);if(s){setOffer({module:m,s});setError(rowShortageText(m.name,s));return;}
      setOffer(null);if(onAdd(m))setError('');}catch(e){setError((e as Error).message);}}}>Добавить в комнату</button>
    {category==='kitchen'&&kitchenTemplates&&<details className="catalog-presets"><summary>Готовые кухонные модули</summary>{kitchenTemplates}</details>}
  </details>;
}
