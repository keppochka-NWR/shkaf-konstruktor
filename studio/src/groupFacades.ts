// Групповое редактирование фасадов (решение Макса 29.10.2026: «не мог выбрать нужные мне модули и отредактировать на них фасады за раз»).
// Отмеченные корпуса (Ctrl+щелчок в сцене или в списке слева) правятся одним изменением: меняется ТОЛЬКО поле, которое правит менеджер,
// у каждого корпуса — той же функцией, что и в его собственной панели (поэтому цена — как если бы правили по одному). Корпуса, к которым
// поле не относится (купе, столешница, нет дверей, push без ручек…), пропускаются с причиной: «к N модулям не применено: …».
// Всё — один проект на выходе, одна отмена Ctrl+Z.
import {parts,validate,drawerConfig,setModuleHandlePos,handleDoors,doorHandlePos,setAllHingeAngles,allHingeAngles,HANDLE_POS_LABEL,type HandlePos,type Module} from './model';
import {drawerHasHandle,HINGE_BRANDS,type HingeBrand} from './hardware';
import type {Project} from './project';
import {placeInRow} from './rowResize';
import {facadeKindBlock,setFacadeKind} from './facadeKind';
import {changeFacadeKind,facadeKind,type FacadeKind} from './facadeAppearance';
import {setModuleHingeSide,singleLeafDoors} from './facadeEditing';
import {DEFAULT_HANDLE,handleById} from './handles';
import {decorLabel} from './clientLabels';

export type GroupFacadeField='kind'|'facadeDecor'|'drawerFacadeDecor'|'handle'|'drawerHandle'|'handlePos'|'doorOpen'|'hingeBrand'|'hingeAngle'|'hingeSide';
export type GroupSkip={id:string;name:string;reason:string};
export type GroupResult={project:Project;changed:string[];skipped:GroupSkip[]};

/** Почему корпус вообще без фасадов для группы (как в facadeAppearance.eligible, но импорт Базиса-кухни правится, как в его панели). */
function noFacades(m:Module):string|null{
 if(m.kupe)return 'двери купе';
 if(m.worktop)return 'столешница';
 if(m.raw)return 'импорт Базиса как есть';
 if(m.desk)return 'стол';
 if(!parts(m).some(p=>p.facadeSide||p.role==='door'||p.id.endsWith(':facade')))return 'нет фасадов';
 return null;
}
const hasDrawerFronts=(m:Module)=>!!m.kdrawers?.length||m.sections.some(s=>s.drawers>0&&Array.from({length:s.drawers},(_,j)=>drawerConfig(m,s,j)).some(c=>!c.noFacade&&!c.mesh));
const sectionDrawerHandles=(m:Module)=>m.sections.some(s=>Array.from({length:s.drawers},(_,j)=>drawerConfig(m,s,j)).some(c=>drawerHasHandle(c)));
const doorHandles=(m:Module):string|null=>!m.doors?'нет распашных фасадов':m.doorOpen==='push'?'открывание нажатием, без ручек':m.noHandles?'без ручек':null;
const openOf=(m:Module)=>m.doorOpen==='push'?'push':m.hingeSoft===false?'simple':'handle';

type FieldDef={
 label:string;
 /** null — поле относится к корпусу; строка — короткая причина, почему нет. */
 applies:(m:Module,value?:string)=>string|null;
 /** Текущее значение у корпуса (для «разные»). */
 read:(m:Module)=>string;
 /** Та же правка, что в панели одного корпуса. */
 apply:(n:Module,value:string)=>void;
};

/** Поля «Фасадов и открывания», которые правятся у группы разом. Правка — та же, что делает панель/окно одного корпуса (App.tsx, KitchenPanel). */
export const GROUP_FIELDS:Record<GroupFacadeField,FieldDef>={
 kind:{label:'Тип фасадов',
  applies:(m,v)=>{
   if(v==='alu'&&m.kitchen&&m.bazis&&!m.alu)return 'кухня из Базиса — рамка ALU недоступна';
   if(!m.kitchen&&v&&v!=='external'){const why=facadeKindBlock(m,v as 'ldsp'|'alu'|'vernissage');if(why)return why.replace(/\.$/,'');}
   return null;},
  read:m=>facadeKind(m),
  // кухня — список «Материал фасадов» KitchenPanel (толщина модуля сохраняется), шкафы — «Тип фасадов» панели корпуса
  apply:(n,v)=>{if(n.kitchen){const k=changeFacadeKind(n,v as FacadeKind,{keepThickness:true});for(const key of Object.keys(n) as (keyof Module)[])delete n[key];Object.assign(n,k);}else setFacadeKind(n,v as 'ldsp'|'alu'|'vernissage');}},
 facadeDecor:{label:'Декор фасадов ЛДСП',
  applies:m=>m.vernissage?'фасады МДФ Вернисаж — не ЛДСП':m.alu?'алюминиевая рамка — не ЛДСП':null,
  read:m=>m.facadeDecor,
  apply:(n,v)=>{n.facadeDecor=v;}},
 drawerFacadeDecor:{label:'Декор фасадов ящиков',
  applies:m=>!hasDrawerFronts(m)?'нет ящиков с фасадом':m.vernissage?'фасады МДФ Вернисаж — не ЛДСП':m.alu&&m.aluDrawers?'ящики в рамке ALU':null,
  read:m=>m.drawerFacadeDecor??'',
  apply:(n,v)=>{if(v)n.drawerFacadeDecor=v;else delete n.drawerFacadeDecor;}},
 handle:{label:'Ручки распашных фасадов',
  applies:m=>doorHandles(m),
  read:m=>m.sections.some(s=>s.doorHandles?.some(Boolean))?'*individual':m.handleId??DEFAULT_HANDLE,
  // окно «Ручки» → «Распашных фасадов» (групповое назначение): индивидуальные ручки дверей снимаются, ящики сохраняют свою ручку
  apply:(n,v)=>{for(const s of n.sections)delete s.doorHandles;n.drawerHandleId??=n.handleId??DEFAULT_HANDLE;n.handleId=v===DEFAULT_HANDLE?undefined:v;}},
 drawerHandle:{label:'Ручки ящиков',
  applies:m=>m.noHandles?'без ручек':!sectionDrawerHandles(m)?(m.kdrawers?.length?'у кухонного модуля ручка ящиков общая с фасадами':'нет ящиков с ручкой'):null,
  read:m=>m.sections.some(s=>s.drawerConfigs?.some(c=>c.handleId))?'*individual':m.drawerHandleId??m.handleId??DEFAULT_HANDLE,
  apply:(n,v)=>{n.drawerHandleId=v;for(const s of n.sections)for(const c of s.drawerConfigs??[])delete c.handleId;}},
 handlePos:{label:'Расположение ручек',
  applies:m=>doorHandles(m)??(handleDoors(m).length?null:'нет распашных фасадов с ручкой'),
  read:m=>{const cur=handleDoors(m).map(id=>doorHandlePos(m,m.sections.find(x=>x.id===id.split(':')[0])!,Number(id.split(':door:')[1])));return cur.every(c=>c===cur[0])?cur[0]??'':'*mixed';},
  apply:(n,v)=>{setModuleHandlePos(n,v as HandlePos);}},
 doorOpen:{label:'Открывание фасадов',
  applies:m=>m.doors?null:'нет распашных фасадов',
  read:openOf,
  apply:(n,v)=>{if(v==='push'){n.doorOpen='push';delete n.hingeSoft;}else{delete n.doorOpen;if(v==='simple')n.hingeSoft=false;else delete n.hingeSoft;}}},
 hingeBrand:{label:'Петли',
  applies:m=>!m.doors?'нет распашных фасадов':m.kitchen?.premialPullout?'выдвижной Premial — без петель':null,
  read:m=>m.hingeBrand??'gtv',
  apply:(n,v)=>{if(v==='gtv')delete n.hingeBrand;else n.hingeBrand=v as HingeBrand;}},
 hingeAngle:{label:'Петли 155–165°',
  applies:m=>!m.doors?'нет распашных фасадов':m.kitchen?'кухонный модуль — угол петель у створки':m.doorOpen==='push'?'открывание нажатием':null,
  read:m=>allHingeAngles(m,165)?'165':'',
  apply:(n,v)=>{setAllHingeAngles(n,v==='165'?165:null);}},
 hingeSide:{label:'Петли одностворчатых фасадов',
  applies:m=>singleLeafDoors(m).length?null:'нет одностворчатых фасадов',
  read:m=>{const d=singleLeafDoors(m);return d.every(x=>x.hinge===d[0]?.hinge)?d[0]?.hinge??'':'*mixed';},
  apply:(n,v)=>{setModuleHingeSide(n,v as 'left'|'right');}},
};

export const OPEN_LABEL:Record<string,string>={handle:'Ручка · петли с доводчиком',simple:'Ручка · петли без доводчика',push:'Push-to-open · без ручек'};
export const KIND_LABEL:Record<string,string>={ldsp:'ЛДСП',vernissage:'МДФ Вернисаж',alu:'Алюминиевая рамка',external:'Другой поставщик'};
/** Подпись значения поля для сообщений и «разные». */
export function groupValueLabel(field:GroupFacadeField,v:string):string{
 if(v==='*individual')return 'индивидуальные';if(v==='*mixed')return 'разное по фасадам';
 if(field==='kind')return KIND_LABEL[v]??v;
 if(field==='facadeDecor'||field==='drawerFacadeDecor')return v?decorLabel(v):'как у распашных';
 if(field==='handle'||field==='drawerHandle')return handleById(v).label;
 if(field==='handlePos')return HANDLE_POS_LABEL[v as HandlePos]??v;
 if(field==='doorOpen')return OPEN_LABEL[v]??v;
 if(field==='hingeBrand')return HINGE_BRANDS[v as HingeBrand]?.label??v;
 if(field==='hingeAngle')return v?'155–165°':'стандарт 110°';
 if(field==='hingeSide')return v==='left'?'слева':v==='right'?'справа':v;
 return v;
}

const chosen=(p:Project,ids:readonly string[])=>ids.map(id=>p.modules.find(a=>a.id===id)).filter((a):a is Project['modules'][number]=>!!a);
const reasonOf=(field:GroupFacadeField,m:Module,value?:string)=>noFacades(m)??GROUP_FIELDS[field].applies(m,value);

/** Сводка поля по отмеченным корпусам: общее значение или null («разные»), к скольким относится. */
export function groupFacadeValue(p:Project,ids:readonly string[],field:GroupFacadeField):{value:string|null;applicable:number;total:number}{
 const list=chosen(p,ids),own=list.filter(a=>!reasonOf(field,a.module)),values=new Set(own.map(a=>GROUP_FIELDS[field].read(a.module)));
 return {value:values.size===1?[...values][0]:null,applicable:own.length,total:list.length};
}

/** Одна правка у каждого отмеченного корпуса (как в его панели, по очереди — placeInRow), пропуски — с причиной. */
export function applyEach(p:Project,ids:readonly string[],mutate:(n:Module,a:Project['modules'][number])=>string|null|void):GroupResult{
 let next=p;const changed:string[]=[],skipped:GroupSkip[]=[];
 for(const a of chosen(p,ids)){
  const n=structuredClone(a.module);let reason:string|null|void;
  try{reason=mutate(n,a);if(!reason)reason=validate(n)[0]?.replace(/\.$/,'')??null;}catch(e){reason=(e as Error).message.replace(/\.$/,'');}
  if(reason){skipped.push({id:a.id,name:a.module.name,reason});continue;}
  if(JSON.stringify(n)===JSON.stringify(a.module))continue;
  next=placeInRow(next,a.id,n);changed.push(a.id);
 }
 if(!changed.length&&skipped.length)throw Error('Не применено ни к одному из отмеченных модулей. '+skippedNote(skipped));
 return {project:next,changed,skipped};
}

/** Поле field = value у всех отмеченных корпусов, к которым оно относится. */
export function applyGroupFacade(p:Project,ids:readonly string[],field:GroupFacadeField,value:string):GroupResult{
 return applyEach(p,ids,n=>{const r=reasonOf(field,n,value);if(r)return r;GROUP_FIELDS[field].apply(n,value);});
}

type PatchKind='vernissage'|'alu';
/** Изменённые ключи выбора Вернисажа/ALU: было → стало (удалённые — undefined). */
export function changedKeys<T extends object>(before:T,after:T):Partial<Record<keyof T,unknown>>{
 const out:Partial<Record<keyof T,unknown>>={};
 for(const k of new Set([...Object.keys(before),...Object.keys(after)]) as Set<keyof T>)if(JSON.stringify(before[k])!==JSON.stringify(after[k]))out[k]=after[k];
 return out;
}
/** Вернисаж/ALU: у каждого корпуса с этим типом фасадов меняются только изменённые менеджером ключи (фрезеровка, плёнка, эмаль…). */
export function applyGroupPatch(p:Project,ids:readonly string[],kind:PatchKind,patch:Record<string,unknown>):GroupResult{
 return applyEach(p,ids,n=>{
  const r=noFacades(n);if(r)return r;
  const cur=n[kind] as Record<string,unknown>|undefined;
  if(!cur)return kind==='vernissage'?'фасады не МДФ Вернисаж':'фасады не в алюминиевой рамке';
  const v={...cur};for(const [k,x] of Object.entries(patch)){if(x===undefined)delete v[k];else v[k]=structuredClone(x);}
  Object.assign(n,{[kind]:v});
  // как VernissagePicker в панели корпуса: толщина фасада — по выбору МДФ
  if(kind==='vernissage')n.facadeT=(v as {thickness:number}).thickness;
 });
}
/** Какие ключи Вернисажа/ALU сейчас разные у отмеченных корпусов. */
export function groupPatchMixed(p:Project,ids:readonly string[],kind:PatchKind):{base:Record<string,unknown>|null;mixed:string[];count:number}{
 const list=chosen(p,ids).filter(a=>!noFacades(a.module)&&a.module[kind]).map(a=>a.module[kind] as unknown as Record<string,unknown>);
 if(!list.length)return {base:null,mixed:[],count:0};
 const keys=new Set(list.flatMap(o=>Object.keys(o)));
 return {base:list[0],mixed:[...keys].filter(k=>list.some(o=>JSON.stringify(o[k])!==JSON.stringify(list[0][k]))),count:list.length};
}

/** «К 2 модулям не применено: двери купе (Купе 1); нет распашных фасадов (Комод)». */
export function skippedNote(skipped:GroupSkip[]):string{
 if(!skipped.length)return '';
 const by=new Map<string,string[]>();for(const s of skipped)by.set(s.reason,[...(by.get(s.reason)??[]),s.name]);
 const n=skipped.length,word=n%10===1&&n%100!==11?'модулю':'модулям';
 return `К ${n} ${word} не применено: `+[...by].map(([r,names])=>`${r} (${names.join(', ')})`).join('; ')+'.';
}
