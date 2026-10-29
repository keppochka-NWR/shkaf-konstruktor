import {useEffect,useMemo,useRef,useState,type ReactNode} from 'react';
import {Box,Rows3,Shirt,Archive,PanelTop,Columns2,SquareSplitHorizontal,CookingPot,PanelBottom,PanelTopOpen,RectangleHorizontal,CornerDownRight,CircleDashed} from 'lucide-react';
import {withMansard,radiusShelving} from './paletteBuild';
import {MANSARD,RADIUS,radiusMax} from './shapes';
import {validate} from './model';
import {createKitchenCornerRow,createKitchenURow} from './kitchenCornerRow';
import {RULES,type Module} from './model';
import {doorCountOptions,autoDoorCount} from './paletteDoors';
import {DEFAULT_KUPE,KUPE_DEPTH} from './kupe';
import {KITCHEN} from './kitchen';
import type {PlacedModule} from './project';
import {adaptToRow,type RowShortage} from './rowFit';
import {createKupeModule,createKupeWardrobe,createKitchenRow,createModule,createModuleRow,bodyWidths,KIND_LABEL,paletteFitNotes,type ModuleKind} from './paletteBuild';
import {paletteIssues,paletteAutoFix,SPLIT_KINDS,type PaletteField,type PaletteInput,type PalettePatch} from './paletteCheck';
// сборка мебели палитры живёт в paletteBuild.ts (w-formerrors 23.10) — прежние импорты из ModulePalette работают
export {createKupeModule,createKupeWardrobe,createKitchenRow,createModule,type ModuleKind} from './paletteBuild';
// «Кухня угловая (Г)» и «Кухня П-образная» (w-lwing 23.10) — группы в угол комнаты (kitchenCornerRow.ts)
const choices=([['empty',Box],['shelves',Rows3],['radius',CircleDashed],['wardrobe',Shirt],['drawers',Archive],['hanging-drawer',PanelTopOpen],['corner',Box],['desk',PanelTop],['kupe-wardrobe',Columns2],['kitchen-row',CookingPot],['kitchen-corner',CornerDownRight],['kitchen-u',Columns2],['kitchen-base',PanelBottom],['kitchen-wall',PanelTopOpen],['worktop',RectangleHorizontal],['kupe',SquareSplitHorizontal]] as const).map(([id,icon])=>({id,label:KIND_LABEL[id],icon}));
const SIZES:Partial<Record<ModuleKind,[number,number,number]>>={'kitchen-row':[3000,KITCHEN.baseHeight,KITCHEN.baseDepth],'kitchen-corner':[3000,KITCHEN.baseHeight,KITCHEN.baseDepth],'kitchen-u':[3600,KITCHEN.baseHeight,KITCHEN.baseDepth],'kitchen-base':[600,KITCHEN.baseHeight,KITCHEN.baseDepth],'kitchen-wall':[600,KITCHEN.wallHeight,KITCHEN.wallDepth],worktop:[2400,KITCHEN.worktopThickness,KITCHEN.worktopDepth],corner:[1050,2000,450],desk:[1200,750,600],drawers:[600,850,550],'hanging-drawer':[800,200,284],radius:[400,2000,400],kupe:[1600,2400,KUPE_DEPTH],'kupe-wardrobe':[1800,2400,600]};
/** Типы распашных шкафов, между которыми габариты палитры переносятся при смене типа (v5). */
const KEEP_SIZES=['empty','shelves','wardrobe','drawers'] as const;
const categories=[{id:'wardrobe',label:'Шкафы распашные',kinds:['empty','shelves','radius','wardrobe','drawers','hanging-drawer','corner','desk']},{id:'kitchen',label:'Кухонные модули',kinds:['kitchen-row','kitchen-corner','kitchen-u','kitchen-base','kitchen-wall','worktop']},{id:'kupe',label:'Шкафы-купе',kinds:['kupe-wardrobe','kupe']}] as const;
const PALETTE_KEY='studio-palette';
type PaletteChoice={category:string;kind:ModuleKind;width:number;height:number;depth:number;/** K6 (критик 22.10): установка дверей купе и число дверей — тоже переживают пересоздание палитры */mount?:'free'|'inside';doors?:'auto'|number;bodies?:number;
  /** критик релиза 24.10: угловая (Г) и П-образная кухня — длина по боковой/левой стене и сторона второго крыла тоже переживают пересоздание */side?:number;wing?:'left'|'right';left?:number};
/** Сохранённый выбор палитры этой вкладки; несогласованная запись (категория без такого вида) отбрасывается. */
function readPalette():PaletteChoice|null{
  try{const v=JSON.parse(sessionStorage.getItem(PALETTE_KEY)||'null') as PaletteChoice|null;const c=categories.find(x=>x.id===v?.category);
    return v&&c&&(c.kinds as readonly string[]).includes(v.kind)&&[v.width,v.height,v.depth].every(Number.isFinite)?v:null;}catch{return null;}
}
const MAX_BODIES=6;
const plural=(n:number,one:string,few:string,many:string)=>{const a=n%10,b=n%100;return a===1&&b!==11?one:a>=2&&a<=4&&(b<10||b>=20)?few:many;};
export function ModulePalette({source,onAdd,onAddGroup,kitchenTemplates,fit,room}:{source:Module;onAdd:(module:Module)=>boolean;/** keep — группа встаёт на свои координаты (угловая кухня — в угол комнаты), без поиска места */onAddGroup:(group:PlacedModule[],keep?:boolean)=>boolean;kitchenTemplates?:ReactNode;
  /** комната — для «Кухня угловая (Г)» и «Кухня П-образная»: ряды у задней и боковых стен, длины — в пределах стен (проверка формы) */room?:{width:number;depth:number;height:number};
  /** Нехватка места в ряду у стены (rowFit.ts): модуль сужается под остаток с сообщением (решение Макса 29.10) или отказ с причиной. */
  fit?:(module:Module)=>RowShortage|null}) {
  // T1 (18.10): выбор палитры живёт дольше экземпляра — после первого шкафа редактор пересоздаётся, а категория и размеры остаются.
  const [saved]=useState(readPalette);
  const [kind,setKind]=useState<ModuleKind>(saved?.kind??'empty'),[width,setWidth]=useState(saved?.width??600),[height,setHeight]=useState(saved?.height??2000),[depth,setDepth]=useState(saved?.depth??550),[error,setError]=useState('');
  const [category,setCategory]=useState<string>(saved?.category??'wardrobe');
  const [kupeMount,setKupeMount]=useState<'free'|'inside'>(saved?.mount==='inside'?'inside':'free');
  // w-formerrors (23.10): шкаф шире 1300 — несколько корпусов вплотную в ряд; ширина в форме — общая
  const [bodies,setBodies]=useState(Number.isInteger(saved?.bodies)&&saved!.bodies!>=1&&saved!.bodies!<=MAX_BODIES?saved!.bodies!:1);
  // проверка формы «после выхода из поля»: значения последней проверки, поля, которые уже покидали, и было ли «Добавить»
  const [probe,setProbe]=useState<PaletteInput|null>(null),[seen,setSeen]=useState<ReadonlySet<PaletteField>>(new Set()),[submitted,setSubmitted]=useState(false),[recheck,setRecheck]=useState(0),[fixedNote,setFixedNote]=useState('');
  const resetCheck=()=>{setProbe(null);setSeen(new Set());setSubmitted(false);setFixedNote('');};
  // «Кухня угловая (Г)» (w-lwing 23.10): длина по боковой стене и у какой стены второе крыло
  const okLen=(v:unknown)=>typeof v==='number'&&Number.isFinite(v)&&v>0;
  const [cornerSide,setCornerSide]=useState(okLen(saved?.side)?saved!.side!:2400),[cornerWing,setCornerWing]=useState<'left'|'right'>(saved?.wing==='left'?'left':'right');
  // «Кухня П-образная»: длина по левой стене (по правой — cornerSide), по задней — во всю ширину комнаты
  const [uLeft,setULeft]=useState(okLen(saved?.left)?saved!.left!:2400);
  const cornerKitchen=kind==='kitchen-corner'||kind==='kitchen-u';
  // фигурные детали (29.10.2026, shapes.ts): мансарда у шкафа/стеллажа; сторона и радиус у радиусного стеллажа (0 — четверть круга)
  const [mansardOn,setMansardOn]=useState(false),[mansardRear,setMansardRear]=useState(1700);
  const [radSide,setRadSide]=useState<'left'|'right'>('right'),[radR,setRadR]=useState(0);
  const mansardKind=kind==='empty'||kind==='shelves'||kind==='wardrobe';
  const shaped=(m:Module):Module=>{let n=m;if(kind==='radius')n=radiusShelving(m.width,m.height,m.depth,source,{side:radSide,r:radR||radiusMax(m)});else if(mansardKind&&mansardOn)n={...withMansard(m,mansardRear),name:m.name+' · мансарда'};if(n!==m){const e=validate(n)[0];if(e)throw Error(e);}return n;};
  // v5 (замер удобства 22.10): смена типа шкафа (Пустой → Стеллаж) не сбрасывает введённые габариты, если новый тип их принимает;
  // у кухни, купе, углового и стола размеры значат другое — там, как раньше, размеры типа (П-образная — по задней стене во всю ширину комнаты)
  const pick=(next:ModuleKind)=>{const same=(KEEP_SIZES as readonly string[]).includes(kind)&&(KEEP_SIZES as readonly string[]).includes(next);let keep=false;if(same&&next!==kind){try{createModule(next,Math.max(...bodyWidths(width,bodies)),height,depth,source);keep=true;}catch{keep=false;}}
    setKind(next);if(!keep&&next!==kind){const sz=SIZES[next]??[600,2000,550];setWidth(next==='kitchen-u'&&room?room.width:sz[0]);setHeight(sz[1]);setDepth(sz[2]);setBodies(1);}setError('');setDoors('auto');if(next!==kind)resetCheck();};
  // п.21 волны 22.10: число дверей до «Добавить в комнату» — распашной шкаф (секции под двери) и двери купе; варианты — только допустимые по размерам
  const [doors,setDoors]=useState<'auto'|number>(typeof saved?.doors==='number'&&Number.isInteger(saved.doors)&&saved.doors>0&&saved.doors<8?saved.doors:'auto');
  useEffect(()=>{try{sessionStorage.setItem(PALETTE_KEY,JSON.stringify({category,kind,width,height,depth,mount:kupeMount,doors,bodies,side:cornerSide,wing:cornerWing,left:uLeft}));}catch{/* без хранилища выбор не запоминается */}},[category,kind,width,height,depth,kupeMount,doors,bodies,cornerSide,cornerWing,uLeft]);
  const kupeKind=kind==='kupe'||kind==='kupe-wardrobe';
  const splitKind=SPLIT_KINDS.includes(kind),rowBodies=splitKind?bodies:1,widths=bodyWidths(width,rowBodies),bodyW=Math.max(...widths);
  const doorChoice=useMemo(()=>{
    if(kupeKind){let why='';const ok=[1,2,3,4,5,6,7].filter(n=>{try{createKupeModule(width,height,source,n);return true;}catch(e){why=why||(e as Error).message;return false;}});return {options:ok,auto:ok.includes(DEFAULT_KUPE.doors)?DEFAULT_KUPE.doors:ok[0]??DEFAULT_KUPE.doors,why:ok.length?'':why};}
    if(kind!=='empty'&&kind!=='wardrobe')return null;
    // u3 (замер удобства 22.10): причина — по факту (высота, глубина…), а не всегда «измените ширину»
    try{const base=createModule(kind,bodyW,height,depth,source);return {options:doorCountOptions(base),auto:autoDoorCount(base),why:'',autoArg:undefined as number|undefined};}catch(e){
      // v1 (замер удобства 22.10): 1288 × 2500 — «авто» (одна секция, створки шире 600) не собирается, но 4 двери в 2 секциях можно:
      // варианты считаем от собранного шкафа с любым допустимым числом дверей; «Авто» тогда — первый допустимый вариант
      for(let n=2;n<=14;n++){try{const base=createModule(kind,bodyW,height,depth,source,n),options=doorCountOptions(base);if(options.length)return {options,auto:options[0],why:'',autoArg:options[0] as number|undefined};}catch{/* следующее число */}}
      return {options:[],auto:0,why:(e as Error).message,autoArg:undefined as number|undefined};}
  },[kind,kupeKind,width,height,depth,source,bodyW]);
  const doorValue=doors!=='auto'&&doorChoice?.options.includes(doors)?doors:'auto';
  const doorArg=doorValue==='auto'?(kupeKind?doorChoice?.auto:doorChoice&&'autoArg' in doorChoice?doorChoice.autoArg:undefined):doorValue;
  const input:PaletteInput={kind,width,height,depth,doors:doorArg,mount:kupeMount,bodies:rowBodies,...(cornerKitchen?{side:cornerSide,wing:cornerWing,room,...(kind==='kitchen-u'?{left:uLeft}:{})}:{})};
  // проверка — по значениям на момент выхода из поля (без мигания ошибок при наборе)
  useEffect(()=>{if(recheck)setProbe(input);},[recheck]); // eslint-disable-line react-hooks/exhaustive-deps
  const issues=useMemo(()=>probe?paletteIssues(probe,source):[],[probe,source]);
  const shown=submitted?issues:issues.filter(x=>x.field&&x.field!=='doors'?seen.has(x.field):seen.size>0);
  const bad=(f:PaletteField)=>shown.some(x=>x.field===f);
  const leave=(f:PaletteField)=>{setSeen(s=>s.has(f)?s:new Set([...s,f]));setRecheck(n=>n+1);};
  const again=()=>{if(probe)setRecheck(n=>n+1);};
  const applyPatch=(p:PalettePatch)=>{if(p.width!==undefined)setWidth(p.width);if(p.height!==undefined)setHeight(p.height);if(p.depth!==undefined)setDepth(p.depth);if(p.bodies!==undefined)setBodies(p.bodies);if(p.doors!==undefined)setDoors(p.doors);if(p.side!==undefined)setCornerSide(p.side);if(p.left!==undefined)setULeft(p.left);setError('');setRecheck(n=>n+1);};
  const autoFix=()=>{const r=paletteAutoFix(input,source),p=r.patch,parts:string[]=[];
    if(p.bodies!==undefined&&p.bodies>1){const ws=bodyWidths(p.width??width,p.bodies);parts.push(`${p.bodies} ${plural(p.bodies,'корпус','корпуса','корпусов')} ${ws[0]===ws[ws.length-1]?'по '+ws[0]:ws.join(' + ')}`);}
    else if(p.width!==undefined)parts.push((cornerKitchen?'по задней стене ':'ширина ')+p.width);
    if(p.left!==undefined)parts.push('по левой стене '+p.left);if(p.side!==undefined)parts.push((kind==='kitchen-u'?'по правой стене ':'по боковой стене ')+p.side);
    if(p.height!==undefined)parts.push('высота '+p.height);if(p.depth!==undefined)parts.push('глубина '+p.depth);
    if(p.doors!==undefined)parts.push(`${p.doors} ${plural(p.doors,'дверь','двери','дверей')}${kupeKind?'':` · ${Math.ceil(p.doors/2)} ${plural(Math.ceil(p.doors/2),'секция','секции','секций')}`}`);
    applyPatch(p);setSubmitted(r.left.length>0);setFixedNote(parts.length?`Исправлено: ${parts.join(', ')}.${r.left.length?'':' Нажмите «Добавить в комнату».'}`:'');};
  // кнопка «Добавить в комнату» прилипает к низу панели (m11) — варианты прокручиваем к середине, чтобы она их не закрывала
  const issuesRef=useRef<HTMLDivElement>(null),addRef=useRef<HTMLButtonElement>(null);
  // критик релиза 24.10 (1366×768): список ошибок уводил «Добавить в комнату» за нижний край — левая панель докручивается так,
  // чтобы были видны список и под ним кнопка (кнопка в обычном потоке, поля не перекрывает); не помещаются оба — видна кнопка
  const revealIssues=()=>requestAnimationFrame(()=>{issuesRef.current?.scrollIntoView?.({block:'nearest'});addRef.current?.scrollIntoView?.({block:'nearest'});});
  // после каждой проверки с ошибками (и после «Исправлено…»); пока курсор в поле размеров — не дёргаем панель из-под ввода
  useEffect(()=>{if(!shown.length&&!fixedNote)return;const ae=document.activeElement;if(ae instanceof HTMLInputElement&&ae.closest('.module-palette'))return;revealIssues();},[probe,submitted,fixedNote]); // eslint-disable-line react-hooks/exhaustive-deps
  const narrowed=(w:number):Module=>{try{return shaped(createModule(kind,w,height,depth,source,doorArg));}catch{return shaped(createModule(kind,w,height,depth,source));}};
  // решение Макса 29.10.2026: в остаток до стены (не хватает места на фальш) модуль ДОБАВЛЯЕТСЯ сразу, суженный (600 → 580 + фальш 20),
  // и менеджер видит, что ширина другая, чем в палитре (сообщение «Размер изменён»); сузить нельзя — отказ с причиной. Диалога из трёх кнопок нет.
  const adapt=(m:Module,s:RowShortage)=>{const r=adaptToRow(m,s,narrowed);if('error' in r){setError(r.error);return;}
    if(onAdd(r.module)){setError('');resetCheck();setTimeout(()=>window.dispatchEvent(new CustomEvent('studio-note',{detail:{title:'Размер изменён',text:r.note}})),700);}};
  // отказ сборки — все ошибки формы списком у полей (w-formerrors); если разбор ничего не нашёл — прежнее сообщение
  const refuse=(e:unknown)=>{const list=paletteIssues(input,source);if(list.length){setProbe(input);setSubmitted(true);setError('');setFixedNote('');revealIssues();}else setError((e as Error).message);};
  const add=()=>{try{
      // угловая (Г) и П-образная кухня (w-lwing): группа встаёт на свои координаты — в угол комнаты (keep), без поиска места
      if(cornerKitchen){if(!room)throw Error(`${kind==='kitchen-u'?'П-образная':'Угловая'} кухня ставится в комнату: откройте проект с помещением.`);
        const group=kind==='kitchen-u'?createKitchenURow(source,{left:uLeft,back:width,right:cornerSide,room,height,depth}):createKitchenCornerRow(source,{back:width,side:cornerSide,wing:cornerWing,room,height,depth});
        if(onAddGroup(group,true)){setError('');resetCheck();}return;}
      if(kind==='kupe-wardrobe'||kind==='kitchen-row'){const ok=kind==='kupe-wardrobe'?onAddGroup(createKupeWardrobe(width,height,depth,source,doorArg,kupeMount)):onAddGroup(createKitchenRow(width,source,height,depth));if(ok){setError('');resetCheck();}return;}
      if(rowBodies>1){if(onAddGroup(createModuleRow(kind,width,rowBodies,height,depth,source,doorArg).map(a=>({...a,module:shaped(a.module)})))){setError('');resetCheck();setBodies(1);/* заказ 7437584: «Корпусов в ряд» не остаётся 3 для следующей мебели (список прячется при 1 и узкой ширине) */}return;}
      const m=shaped(createModule(kind,width,height,depth,source,doorArg)),s=fit?.(m);if(s){adapt(m,s);return;}
      if(onAdd(m)){setError('');resetCheck();smallNote();}}catch(e){refuse(e);}};
  // волна 29.10: малый корпус — что палитра сняла (двери, ящики, полки, цоколь…) — сообщением, не ошибкой
  // первый корпус ставится из пустой комнаты — редактор с приёмником сообщений появляется после, поэтому с задержкой
  const smallNote=()=>{const notes=paletteFitNotes(kind,width,height,depth,source,doorArg);if(notes.length)setTimeout(()=>window.dispatchEvent(new CustomEvent('studio-note',{detail:{title:'Малый корпус',text:notes.join(' ')}})),700);};
  const note=kind==='radius'?'Открытый торцевой стеллаж: боковина у соседнего шкафа, задник ЛДСП, 4 жёсткие полки, дно и крыша — со скруглённым передним углом. В раскрое — по габариту с пометкой «фигурная», кромка по дуге — криволинейная.'
    :kind==='corner'?'Пятиугольный корпус с диагональными дверями и двумя боковыми блоками. Стороны угла одинаковые. Антресоль добавляется отдельно.'
    :kind==='kupe'?'Размеры проёма. Ставьте перед корпусами или в нишу между стенами. Глубина направляющих 100 мм. Цена — по калькулятору купе.'
    :kind==='kupe-wardrobe'&&kupeMount==='inside'?'Боковины до пола и крыша на всю глубину; двери купе между боковинами под крышей, нижняя направляющая на полу. Дно, цоколь и секции — за дверями, 100 мм глубины занимают направляющие.'
    :kind==='kupe-wardrobe'?'Корпуса без распашных дверей и двери купе на всю ширину. Глубина — общая, 100 мм из неё занимают направляющие.'
    :kind==='kitchen-corner'?'Г-образная кухня в углу комнаты: ряд по задней стене от угла и ряд по боковой стене от задней. В углу — нижний угловой с фальшпанелью (глухая часть в угол) и над ним навесной угловой; второе крыло — от линии фасадов первого, с угловой планкой. Столешница двумя кусками, навесные по обоим крыльям.'
    :kind==='kitchen-u'?'П-образная кухня: левая, задняя (во всю ширину комнаты) и правая стены. В обоих углах — нижний и навесной угловые, крылья — от линии фасадов задней стены, с угловой планкой. Столешница тремя кусками, навесные по всем стенам.'
    :kind==='kitchen-row'?'Ширина — длина ряда корпусов; у боковых стен нужен запас по 20 мм под фальши (16 + 4). Высота — нижние корпуса с опорами, глубина — нижние корпуса без фасадов. Нижние корпуса на ножках (ящики, мойка, распашные), столешница во всю длину, навесные над ней на регламентный зазор.'
    :kind==='kitchen-base'?'Нижний кухонный: на ножках с цокольной планкой, вместо крыши царги под столешницу.'
    :kind==='kitchen-wall'?'Навесной кухонный: на навесах. Поставьте его на нужную высоту в сцене.'
    :kind==='worktop'?'Столешница — отдельным объектом. Ставьте сверху на нижние корпуса.'
    :rowBodies>1?`Размеры в мм. Создаются ${rowBodies} ${plural(rowBodies,'корпус','корпуса','корпусов')} вплотную в ряд.`
    :'Размеры в мм. Создаётся отдельный корпус.';
  // у угловой (Г) — «По задней стене» и «По боковой стене», у П-образной — ещё «По левой стене», боковая — «По правой стене» (w-lwing)
  const fields:{key:Exclude<PaletteField,'doors'>;label:string;value:number;set:(n:number)=>void}[]=[...(kind==='kitchen-u'?[{key:'left' as const,label:'По левой стене',value:uLeft,set:setULeft}]:[]),{key:'width',label:kind==='corner'?'Сторона угла':kind==='kupe'?'Ширина проёма':cornerKitchen?'По задней стене':'Ширина',value:width,set:setWidth},...(kind==='kitchen-corner'?[{key:'side' as const,label:'По боковой стене',value:cornerSide,set:setCornerSide}]:kind==='kitchen-u'?[{key:'side' as const,label:'По правой стене',value:cornerSide,set:setCornerSide}]:[]),{key:'height',label:kind==='kupe'?'Высота проёма':'Высота',value:height,set:setHeight},...(kind==='kupe'?[]:[{key:'depth' as const,label:kind==='corner'?'Глубина боковины':'Глубина',value:depth,set:setDepth}])];
  const limitText=(f:PaletteField)=>{const x=shown.find(i=>i.field===f&&i.limit);if(!x?.limit)return '';const v=f==='width'?bodyW:f==='height'?height:f==='side'?cornerSide:f==='left'?uLeft:depth;return x.limit.max!==undefined&&v>x.limit.max?`до ${x.limit.max}`:x.limit.min!==undefined?`от ${x.limit.min}`:'';};
  return <details className="module-palette" open><summary>Добавить мебель</summary>
    <div className="catalog-tabs" role="tablist" aria-label="Категория мебели">{categories.map(c=><button type="button" role="tab" key={c.id} aria-selected={category===c.id} onClick={()=>{setCategory(c.id);pick(c.kinds[0]);}}>{c.label}</button>)}</div>
    <div className="module-kinds">{choices.filter(c=>(categories.find(x=>x.id===category)!.kinds as readonly string[]).includes(c.id)).map(c=><button key={c.id} type="button" aria-pressed={kind===c.id} onClick={()=>pick(c.id)}><c.icon size={23}/><span>{c.label}</span></button>)}</div>
    <div className="module-sizes">{fields.map(f=><label key={f.label} className={bad(f.key)?'has-error':undefined}>{f.label}<input aria-label={`${f.label} новой мебели`} aria-invalid={bad(f.key)||undefined} type="number" value={f.value} onChange={e=>{f.set(Number(e.target.value));if(fixedNote)setFixedNote('');}} onBlur={()=>leave(f.key)} onKeyDown={e=>{if(e.key==='Enter')leave(f.key);}}/>{bad(f.key)&&limitText(f.key)&&<small className="pf-limit">{limitText(f.key)}</small>}</label>)}</div>
    {splitKind&&(rowBodies>1||width>RULES.maxW)&&<label className="palette-bodies">Корпусов в ряд<select aria-label="Корпусов в ряд у новой мебели" value={rowBodies} onChange={e=>{setBodies(Number(e.target.value));again();}}>
      {Array.from({length:MAX_BODIES},(_,i)=>i+1).map(n=><option key={n} value={n}>{n}{n>1?` · ${(()=>{const ws=bodyWidths(width,n);return ws[0]===ws[n-1]?'по '+ws[0]:ws.join(' + ');})()} мм`:' · один корпус'}</option>)}
    </select><small>{rowBodies>1?`Ширина ${width} — общая: ${rowBodies} ${plural(rowBodies,'корпус','корпуса','корпусов')} ${widths[0]===widths[widths.length-1]?'по '+widths[0]:widths.join(' + ')} мм вплотную в ряд.`:`Корпус не шире ${RULES.maxW} мм — шире делим на корпуса.`}</small></label>}
    {doorChoice&&<label className={'palette-doors'+(bad('doors')?' has-error':'')}>{kupeKind?'Дверей купе':'Дверей'}<select aria-label={kupeKind?'Дверей купе у новой мебели':'Дверей у новой мебели'} aria-invalid={bad('doors')||undefined} value={String(doorValue)} onChange={e=>{setDoors(e.target.value==='auto'?'auto':Number(e.target.value));again();}}>
      <option value="auto">Авто{doorChoice.auto?` · ${doorChoice.auto}`:''}</option>
      {doorChoice.options.map(n=><option key={n} value={n}>{n}{kupeKind?'':` · секций ${Math.ceil(n/2)}`}</option>)}
    </select>{!doorChoice.options.length&&!shown.length&&<small>{doorChoice.why?`Число дверей не выбирается: ${doorChoice.why}`:'При этой ширине число дверей не выбирается — измените ширину.'}</small>}</label>}
    {kind==='kitchen-corner'&&<label className="hardware-field">Второе крыло<select aria-label="Второе крыло угловой кухни" value={cornerWing} onChange={e=>{setCornerWing(e.target.value==='left'?'left':'right');again();}}><option value="right">у правой стены</option><option value="left">у левой стены</option></select></label>}
    {mansardKind&&<label className="hardware-field palette-mansard"><span><input type="checkbox" aria-label="Мансарда (скос назад) у новой мебели" checked={mansardOn} onChange={e=>{setMansardOn(e.target.checked);setError('');}}/> Мансарда (скос назад)</span></label>}
    {mansardKind&&mansardOn&&<label className="hardware-field">Высота сзади, мм<input type="number" aria-label="Высота сзади новой мебели" value={mansardRear} onChange={e=>{setMansardRear(Number(e.target.value));setError('');}}/><small>Спереди — высота {height}; сзади от {MANSARD.minRear} до {height-MANSARD.minDrop}. Крыша наклонная, полки — под скос.</small></label>}
    {kind==='radius'&&<label className="hardware-field">Скругление полок<select aria-label="Сторона скругления новой мебели" value={radSide} onChange={e=>setRadSide(e.target.value==='left'?'left':'right')}><option value="right">справа спереди (боковина слева)</option><option value="left">слева спереди (боковина справа)</option></select></label>}
    {kind==='radius'&&<label className="hardware-field">Радиус, мм<input type="number" aria-label="Радиус скругления новой мебели" value={radR||radiusMax({width,depth})} onChange={e=>{const v=Number(e.target.value);setRadR(v>=radiusMax({width,depth})?0:v);setError('');}}/><small>{RADIUS.min}–{radiusMax({width,depth})}; наибольший — полка четвертью круга.</small></label>}
    {kind==='kupe-wardrobe'&&<label className="hardware-field">Установка дверей<select aria-label="Установка дверей купе" value={kupeMount} onChange={e=>{setKupeMount(e.target.value==='inside'?'inside':'free');again();}}><option value="inside">внутри шкафа</option><option value="free">отдельно (ниша или перед корпусами)</option></select></label>}
    <small>{note}</small>
    {shown.length>0&&<div className="palette-issues" role="alert" aria-label="Ошибки формы" ref={issuesRef}>
      <p className="pi-title">{submitted?'Не добавлено':'Не добавится'} — {plural(shown.length,'ошибка','ошибки','ошибок')}: {shown.length}</p>
      <ol>{shown.map((x,i)=><li key={i} data-field={x.field}>
        <b>{x.problem}</b>
        <span className="pi-action">Что сделать: {x.action}</span>
        {x.fixes.length>0&&<span className="pi-fixes">{x.fixes.map(f=><button key={f.label} type="button" className="outline" onClick={()=>applyPatch(f.patch)}>{f.label}</button>)}</span>}
      </li>)}</ol>
      {shown.some(x=>x.auto)&&<button type="button" className="primary pi-auto" onClick={autoFix}>Исправить автоматически</button>}
    </div>}
    {fixedNote&&!shown.length&&<p className="palette-fixed" role="status">{fixedNote}</p>}
    {error&&<p role="alert">{error}</p>}
    <button className="primary full" onClick={add} ref={addRef}>Добавить в комнату</button>
    {category==='kitchen'&&kitchenTemplates&&<details className="catalog-presets"><summary>Готовые кухонные модули</summary>{kitchenTemplates}</details>}
  </details>;
}
