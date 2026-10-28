import {MEASUREMENT_RULES} from './measurement';
import {createCornerUpper} from './cornerWardrobe';
import {removeOpening,mirrorOpenings,resizeOpening} from './sectionLayout';
import {id,section,boxes,drawerConfig,drawerOffsets,drawerStackHeight,doorCount,fillerSides,parts,RULES,MAX_SHELVES_REASON,MAX_DRAWERS_REASON,type Module,type Section} from './model';
import {meshById,DEFAULT_MESH,MESH_WIDTH_TOLERANCE} from './mesh';
import {remapShelfSpec} from './lights';
import {bounds,moduleCenter,mountingCompositionBounds,type Project,projectErrors,applyAutoFillers} from './project';
import {placeInRow} from './rowResize';
import {mirrorKitchen} from './kitchen';
import type {DrawerConfig} from './hardware';
export type FillKind='shelf'|'drawer'|'rod'|'pantograph'|'mesh';
export function removePart(p:Project,mid:string,sid:string,pid:string):Project{
  const n=structuredClone(p),m=n.modules.find(a=>a.id===mid)?.module,s=m?.sections.find(s=>s.id===sid);
  if(!m||!s)throw Error('Выберите элемент наполнения.');
  if(pid.includes(':door:')){const k=Number(pid.split(':door:')[1]);if(!parts(m).some(part=>part.id===pid&&part.role==='door'))throw Error('Фасад не найден.');s.removedDoors=[...new Set([...(s.removedDoors??[]),k])];}
  else if(pid.includes(':shelf:')){const j=Number(pid.split(':shelf:')[1]);if(!Number.isInteger(j)||j<0||j>=s.shelves.length)throw Error('Полка не найдена.');s.shelves.splice(j,1);for(const key of ['fixed','glassShelves','thickShelves','shelfLights'] as const)if(s[key])s[key]=s[key]!.filter(k=>k!==j).map(k=>k>j?k-1:k);remapShelfSpec(s,k=>k===j?undefined:k>j?k-1:k);}
  else if(pid.includes(':drawer:')&&pid.endsWith(':facade')){const j=Number(pid.split(':drawer:')[1].split(':')[0]);if(!Number.isInteger(j)||j<0||j>=s.drawers)throw Error('Ящик не найден.');s.drawerConfigs=Array.from({length:s.drawers},(_,k)=>({...drawerConfig(m,s,k)}));s.drawerConfigs[j].noFacade=true;}
  else if(pid.includes(':drawer:')){const j=Number(pid.split(':drawer:')[1].split(':')[0]);if(!Number.isInteger(j)||j<0||j>=s.drawers)throw Error('Ящик не найден.');const offsets=drawerOffsets(s);s.drawerConfigs=Array.from({length:s.drawers},(_,k)=>({...drawerConfig(m,s,k),y:offsets[k]}));s.drawerConfigs.splice(j,1);s.drawers--;}
  else if(pid.includes(':pantograph:')){s.pantograph=false;delete s.rodAt;}
  else if(pid.includes(':pullout:')){const left=(s.pullouts??1)-1;if(left>0)s.pullouts=left;else delete s.pullouts;}
  // вешалка в два яруса (заказ 7437584): нижняя штанга, труба или её держатели — снимается только второй ярус
  else if(pid.endsWith(':rod:lower')||pid.includes(':flange:lower:')||pid.includes(':pipe')){delete s.rodLower;}
  else if(pid.endsWith(':rod')||pid.includes(':flange:')){s.rod=false;delete s.rodAt;delete s.rodLower;}
  else throw Error('Эта деталь относится к конструкции корпуса.');
  return n;
}
export function moveModule(p:Project,mid:string,pos:{x:number;y:number;z:number}){const n=structuredClone(p),a=n.modules.find(a=>a.id===mid);if(!a)throw Error('Корпус не найден.');Object.assign(a,pos);return n;}
export function movePart(p:Project,mid:string,sid:string,pid:string,delta:number){
  const n=structuredClone(p),m=n.modules.find(a=>a.id===mid)!.module,s=m.sections.find(s=>s.id===sid)!,b=boxes(m).find(b=>b.id===sid)!;
  if(pid.includes(':shelf:')){const j=Number(pid.split(':shelf:')[1]);s.shelves[j]=Math.round(s.shelves[j]*(b.top-b.bottom)+delta)/(b.top-b.bottom);}
  else if(pid.includes(':drawer:')){const j=Number(pid.split(':drawer:')[1].split(':')[0]);const yy=drawerOffsets(s);s.drawerConfigs=Array.from({length:s.drawers},(_,k)=>({...drawerConfig(m,s,k),y:yy[k]}));s.drawerConfigs[j]={...s.drawerConfigs[j],y:Math.round(yy[j]+delta)};}
  else if(pid.includes(':rod')||pid.includes(':pantograph:')||pid.includes(':flange:')){const current=parts(m).find(p=>p.id===sid+':rod'||p.id===sid+':pantograph:rod')!;s.rodAt=(current.position[1]+delta-b.bottom)/(b.top-b.bottom);}
  return n;
}
export function insertItem(p:Project,kind:FillKind,mid:string,sid:string,worldY:number,drawer?:DrawerConfig,meshId:string=DEFAULT_MESH):Project{
  const source=p.modules.find(a=>a.id===mid)?.module;if(!source)throw Error('Перетащите элемент в корпус.');
  const target=source.sections.find(s=>s.id===sid),b=boxes(source).find(b=>b.id===sid);
  if(!target||!b)throw Error('Выберите секцию для наполнения.');
  if(kind==='shelf'&&target.shelves.length>=RULES.maxShelves)throw Error(MAX_SHELVES_REASON);
  if((kind==='drawer'||kind==='mesh')&&target.drawers>=RULES.maxDrawers)throw Error(MAX_DRAWERS_REASON);
  if(kind==='mesh'){
    const item=meshById(meshId);if(!item)throw Error('Элемент Лемана Про не найден в каталоге.');
    kind='drawer';drawer={slide:'ball',length:250,height:item.h,mesh:item.id};
    // Ширина проверяется валидацией; здесь даём понятную подсказку сразу.
    const inner=b.width-fillerSides(source,target).left-fillerSides(source,target).right;
    if(inner<item.reqW||inner>item.reqW+MESH_WIDTH_TOLERANCE)throw Error(`«${item.label}» нужен проём ${item.reqW}–${item.reqW+MESH_WIDTH_TOLERANCE} мм внутри, сейчас ${Math.round(inner)}. Сделайте секцию ${Math.round(item.reqW+(b.width-inner)+2*RULES.panel)} мм по корпусу или выберите другой элемент.`);
  }
  const desired=Math.round((worldY-b.bottom)/5)*5;
  const candidates=[desired,0,drawerStackHeight(source.sections.find(s=>s.id===sid)!),...Array.from({length:Math.ceil((b.top-b.bottom)/16)},(_,i)=>i*16)].sort((a,b)=>Math.abs(a-desired)-Math.abs(b-desired));
  for(const y of candidates){
    const n=structuredClone(p),m=n.modules.find(a=>a.id===mid)!.module,s=m.sections.find(s=>s.id===sid)!;
    if(kind==='shelf'){
      if(s.shelves.length>=RULES.maxShelves)break;
      const fixedHeights=new Set((s.fixed??[]).map(j=>s.shelves[j])),glassHeights=new Set((s.glassShelves??[]).map(j=>s.shelves[j])),litHeights=new Set((s.shelfLights??[]).map(j=>s.shelves[j]));
      const oldShelves=[...s.shelves];
      s.shelves.push(y/(b.top-b.bottom));s.shelves.sort((a,b)=>a-b);
      // тон/тип подсветки полки (задача 14) — по высоте, как shelfLights
      remapShelfSpec(s,k=>{const j=s.shelves.indexOf(oldShelves[k]);return j<0?undefined:j;});
      if(s.fixed)s.fixed=s.shelves.flatMap((f,j)=>fixedHeights.has(f)?[j]:[]);
      // стеклянные полки — по высоте, как жёсткие: новая полка ниже не переносит «стекло» на соседнюю
      if(s.glassShelves)s.glassShelves=s.shelves.flatMap((f,j)=>glassHeights.has(f)?[j]:[]);
      if(s.thickShelves){const th=new Set(s.thickShelves.map(j=>oldShelves[j]));s.thickShelves=s.shelves.flatMap((f,j)=>th.has(f)?[j]:[]);} // посадочное место 32 — по высоте
      // подсветка полок (20.10.2026) — тоже по высоте: новая полка не забирает подсветку соседней
      if(s.shelfLights)s.shelfLights=s.shelves.flatMap((f,j)=>litHeights.has(f)?[j]:[]);
    }
    else if(kind==='drawer'){
      if(s.drawers>=RULES.maxDrawers)break;
      s.drawerConfigs=Array.from({length:s.drawers},(_,j)=>drawerConfig(m,s,j));const cfg=drawer??drawerConfig(m,s,s.drawers);s.drawers++;s.drawerConfigs.push({...cfg,y});
      const fillers=fillerSides(m,s);
      if((fillers.left||fillers.right)&&s.shelves.some(f=>f*(b.top-b.bottom)<drawerStackHeight(s)+RULES.panel))continue;
    }else if(kind==='rod'){s.rod=true;s.pantograph=false;s.rodAt=y/(b.top-b.bottom);}
    else {s.pantograph=true;s.rod=false;s.rodAt=y/(b.top-b.bottom);}
    const errs=projectErrors(n);if(!errs.length)return n;
    if(drawer?.mesh&&/Лемана|нужен проём|нужна глубина|фиксирована/.test(errs[0]))throw Error(errs[0]);
  }
  throw Error(kind==='pantograph'?'Пантографу нужен внутренний проём от 545 мм и место по высоте.':'Здесь недостаточно свободного места. Переместите наполнение или увеличьте корпус.');
}
/** Стеклянная полка из меню «Добавить»: та же вставка полки, что у панели, и та же отметка, что галочка «Стекло 6 мм вместо ЛДСП». */
export function insertGlassShelf(p:Project,mid:string,sid:string,worldY:number):Project{
  const n=insertItem(p,'shelf',mid,sid,worldY),pid=insertedPartId(p,n,mid,sid,'shelf');
  if(!pid)throw Error('Не удалось добавить полку.');
  const j=Number(pid.split(':shelf:')[1]),s=n.modules.find(a=>a.id===mid)!.module.sections.find(x=>x.id===sid)!;
  s.glassShelves=[...new Set([...(s.glassShelves??[]),j])].sort((a,z)=>a-z);
  const errs=projectErrors(n);if(errs.length)throw Error(errs[0]);
  return n;
}
export function insertedPartId(before:Project,after:Project,mid:string,sid:string,kind:FillKind):string|undefined{
  const previous=before.modules.find(a=>a.id===mid)?.module.sections.find(s=>s.id===sid);
  const current=after.modules.find(a=>a.id===mid)?.module.sections.find(s=>s.id===sid);
  if(!current)return undefined;
  if(kind==='shelf'){
    const index=current.shelves.findIndex(height=>!previous?.shelves.includes(height));
    return index<0?undefined:sid+':shelf:'+index;
  }
  if(kind==='drawer'||kind==='mesh'){if(current.drawers<=(previous?.drawers??0))return undefined;const j=current.drawers-1;return sid+':drawer:'+j+(current.drawerConfigs?.[j]?.mesh?':mesh':':facade');}
  if(kind==='pantograph')return current.pantograph?sid+':pantograph:rod':undefined;
  return current.rod?sid+':rod':undefined;
}
export function transferPart(p:Project,fromMid:string,fromSid:string,pid:string,toMid:string,toSid:string,y:number):Project{
  if(fromMid===toMid&&fromSid===toSid)throw Error('Выберите другой корпус или секцию.');
  const m=p.modules.find(a=>a.id===fromMid)?.module,s=m?.sections.find(s=>s.id===fromSid);if(!m||!s)throw Error('Элемент не найден.');
  const kind:FillKind=pid.includes(':pantograph:')?'pantograph':pid.includes(':drawer:')?'drawer':pid.includes(':shelf:')?'shelf':'rod';
  const target=p.modules.find(a=>a.id===toMid)?.module.sections.find(s=>s.id===toSid);
  if(!target)throw Error('Выберите принимающую секцию.');
  if((kind==='rod'||kind==='pantograph')&&(target.rod||target.pantograph))throw Error('В принимающей секции уже есть штанга или пантограф. Выберите свободную секцию или сначала уберите существующий элемент.');
  const cfg=kind==='drawer'?drawerConfig(m,s,Number(pid.split(':drawer:')[1].split(':')[0])):undefined;
  const n=removePart(p,fromMid,fromSid,kind==='drawer'?pid.replace(':facade',':bottom'):pid);
  return insertItem(n,kind,toMid,toSid,y,cfg);
}



export function moveDivider(p:Project,mid:string,rightSectionId:string,delta:number){
 const n=structuredClone(p),m=n.modules.find(a=>a.id===mid)?.module;
 if(!m||!Number.isFinite(delta))throw Error('Перегородка не найдена.');
  const i=m.sections.findIndex(s=>s.id===rightSectionId),bb=boxes(m);
  if(m.sectionLayout){resizeOpening(m,rightSectionId,bb[i].width-delta);const e=projectErrors(n)[0];if(e)throw Error(e);return n;}
 if(i<1)throw Error('Выберите внутреннюю перегородку.');
 m.sections.forEach((s,j)=>s.weight=bb[j].width+(j===i-1?delta:j===i?-delta:0));
 if(m.sections.some(s=>s.weight<RULES.minSection))throw Error(`Ширина секции должна быть не меньше ${RULES.minSection} мм.`);
 const error=projectErrors(n)[0];if(error)throw Error(error);
 return n;
}

export function mirrorModule(p:Project,mid:string):Project {
 const n=structuredClone(p),m=n.modules.find(a=>a.id===mid)?.module;
 if(!m)throw Error('Выберите корпус для отражения.');
 for(const sec of m.sections){if(sec.doorHinges){const hinges=[...sec.doorHinges];sec.doorHinges=hinges.map((_,k)=>{const h=hinges[doorCount(m,sec)===2?k^1:k];return h==='left'?'right':h==='right'?'left':h??null;});}if(sec.doorLifts&&doorCount(m,sec)===2)sec.doorLifts=Array.from({length:sec.doorLifts.length},(_,k)=>sec.doorLifts?.[k^1]??null);if(sec.doorHandles&&doorCount(m,sec)===2)sec.doorHandles=Array.from({length:sec.doorHandles.length},(_,k)=>sec.doorHandles?.[k^1]??null);if(sec.handleFloor&&doorCount(m,sec)===2)sec.handleFloor=Array.from({length:sec.handleFloor.length},(_,k)=>sec.handleFloor?.[k^1]??null);if(sec.handlePos&&doorCount(m,sec)===2)sec.handlePos=Array.from({length:sec.handlePos.length},(_,k)=>sec.handlePos?.[k^1]??null);if(sec.removedDoors&&doorCount(m,sec)===2)sec.removedDoors=sec.removedDoors.map(k=>k^1);if(sec.hingeSide)sec.hingeSide=sec.hingeSide==='right'?'left':'right';}
 if(m.sectionLayout)mirrorOpenings(m);
 // частичная перегородка — у секции справа от неё: после отражения справа оказывается бывшая левая секция
 if(m.sections.some(s=>s.divider)){const divs=m.sections.map(s=>s.divider);m.sections.forEach((s,i)=>{const d=divs[i+1];if(d)s.divider=d;else delete s.divider;});}
 m.sections.reverse();
 m.hingeSide=m.hingeSide==='right'?'left':'right';
 if(m.kitchen)mirrorKitchen(m); // поля кухни со стороной (пакет 0): xs↔xr, topConf↔topConfR, маркер −1 у направляющих и т. д.
 const error=projectErrors(n)[0];if(error)throw Error(error);
 return n;
}

/** Корпус стоит на другом корпусе (антресоль на нижнем): низ вплотную к верху соседа (±2 мм), перекрываются в плане. */
export function restsOnModule(p:Project,a:Project['modules'][number]):boolean{
 const y=a.y??0,b=bounds(a);
 return p.modules.some(o=>{if(o.id===a.id)return false;const q=bounds(o);return Math.abs((o.y??0)+o.module.height-y)<2&&q.x<b.x+b.w-1&&b.x<q.x+q.w-1&&q.z<b.z+b.d-1&&b.z<q.z+q.d-1;});
}
export function setWallDistance(p:Project,mid:string,axis:'x'|'y'|'z',distance:number,whole=false,ids?:readonly string[]):Project {
 let n=structuredClone(p);const a=n.modules.find(a=>a.id===mid);
 if(!a||!Number.isFinite(distance)||distance<0)throw Error('Укажите неотрицательное расстояние от стены или пола.');
 const edge=bounds(a)[axis];
 const delta=distance-edge;
 for(const item of whole?n.modules:ids?.includes(mid)?n.modules.filter(item=>ids.includes(item.id)):[a])item[axis]=(item[axis]??0)+delta;
 // «От пола» > 0 (решение Макса 23.10.2026): шкаф сразу становится навесным — без цоколя, на навесах (Module.hanging); опустили на пол —
 // снова стоит на полу (без цоколя, цоколь выбирается в «Опоры»). Только шкафы и стеллажи студии без ножек; кухни, купе, столы,
 // угловые — как были. Антресоль на нижнем корпусе (стоит на нём, «Антресоль») навесной не становится.
 if(axis==='y')for(const item of whole?n.modules:ids?.includes(mid)?n.modules.filter(item=>ids.includes(item.id)):[a]){const mm=item.module;
   if(mm.feet||mm.kitchen||mm.raw||mm.kupe||mm.desk||mm.worktop||mm.corner||mm.casework)continue;
   if((item.y??0)>0){if(!restsOnModule(n,item)){mm.hanging=true;mm.plinthHeight=0;delete mm.plinthRecess;}}
   else if(mm.hanging){delete mm.hanging;mm.plinthHeight=0;}}
 // Auto fillers change the mounting envelope near walls and perpendicular runs.
 // Keep the manager's distance tied to the final envelope, not the old filler.
 if(a.module.kitchen){for(let i=0;i<8;i++){
   n=applyAutoFillers(n);const current=n.modules.find(item=>item.id===mid)!;
   const correction=distance-bounds(current)[axis];if(Math.abs(correction)<0.01)break;
   for(const item of whole?n.modules:ids?.includes(mid)?n.modules.filter(item=>ids.includes(item.id)):[current])item[axis]=(item[axis]??0)+correction;
 }
   n=applyAutoFillers(n);
   if(Math.abs(bounds(n.modules.find(item=>item.id===mid)!)[axis]-distance)>0.01)throw Error('Этот отступ меняет состав угловых фальшей. Задайте другой отступ или отключите автофальши у выбранного корпуса и настройте стык отдельно.');
 }else if(axis!=='y'){
   // v2 (замер удобства 22.10): корпус стоял у стены с автофальшью (габарит с планкой 0, корпус 21); «От левой стены» 40 сдвигал
   // габарит на 40 — корпус уезжал на 61, планка у стены пропадала, и отступ становился 61. Введённое число — итоговый отступ:
   // после пересчёта автофальшей габарит модуля должен стоять ровно на distance (одна-две поправки).
   for(let i=0;i<4;i++){
     n=applyAutoFillers(n);const current=n.modules.find(item=>item.id===mid)!,correction=distance-bounds(current)[axis];
     if(Math.abs(correction)<0.01)break;
     for(const item of whole?n.modules:ids?.includes(mid)?n.modules.filter(item=>ids.includes(item.id)):[n.modules.find(item=>item.id===mid)!])item[axis]=(item[axis]??0)+correction;
   }
 }
 const error=projectErrors(n)[0];if(error)throw Error(error);
 return n;
}

export function rotateModule(p:Project,mid:string,rotation:number):Project {
 const n=structuredClone(p),a=n.modules.find(a=>a.id===mid);
 if(!a||!Number.isFinite(rotation)||Math.abs(rotation)>36000)throw Error('Выберите поворот корпуса.');
 const before=bounds(a);a.rotation=rotation;const after=bounds(a);
 if(after.w>p.room.width||after.d>p.room.depth)throw Error('В этом направлении корпус не помещается в комнате.');
 const x=Math.max(0,Math.min(p.room.width-after.w,before.x+(before.w-after.w)/2));
 const z=Math.max(0,Math.min(p.room.depth-after.d,before.z+(before.d-after.d)/2));
 a.x+=x-after.x;a.z+=z-after.z;
 const error=projectErrors(n)[0];if(error)throw Error(error);
 return n;
}

export function addUpperModule(p:Project,mid:string):Project {
 const n=structuredClone(p),base=n.modules.find(a=>a.id===mid);if(!base)throw Error('Выберите нижний корпус.');
 // мансарда (shapes.ts, 29.10.2026): над шкафом со скосом назад потолок скошен — антресоль не ставится
 if(base.module.mansard)throw Error('Над мансардным шкафом антресоль не ставится: потолок там скошен назад. Сделайте шкаф выше или уберите мансарду.');
 const y=(base.y??0)+base.module.height,height=Math.min(600,Math.floor(p.room.height-y-MEASUREMENT_RULES.ceilingClearance));
 if(height<RULES.minH)throw Error(`Над корпусом нужно хотя бы ${RULES.minH} мм для отдельной антресоли и ${MEASUREMENT_RULES.ceilingClearance} мм монтажного зазора. Измените высоту нижнего корпуса или замер помещения.`);
 // заказ 7427796: антресоль не копирует то, что относится только к нижнему корпусу — задник ЛДСП «от высоты» (ниша над сиденьем),
 // боковые фальшпанели/добор до потолка (они уже стоят у нижнего) и зеркало на двери
 const own=(m:Module):Module=>{const c:Module={...structuredClone(m),name:'Антресоль',height,plinthHeight:0,handleId:undefined,drawerHandleId:undefined,sections:[section()]};delete c.backFrom;delete c.sidePanels;delete c.mirror;delete c.facadeFrom;delete c.facadeTo;
   // заказы 7441182/7437584: сиденье, щит, утопленный цоколь и высоту фасадов по эскизу антресоль не наследует
   delete c.seatTop;delete c.seatPanel;delete c.plinthRecess;return c;};
 n.modules.push({...base,id:id(),y,module:base.module.corner?createCornerUpper(base.module,height):own(base.module)});
 const error=projectErrors(n)[0];if(error)throw Error(error);return n;
}


export function clearSection(p:Project,mid:string,sid:string):Project {
 const n=structuredClone(p),s=n.modules.find(a=>a.id===mid)?.module.sections.find(s=>s.id===sid);if(!s)throw Error('Выберите секцию.');
 s.shelves=[];s.drawers=0;s.rod=false;delete s.pantograph;delete s.rodAt;delete s.drawerConfigs;delete s.glassShelves;delete s.thickShelves;delete s.fixed;delete s.shelfLight;delete s.shelfLights;return n;
}
export function removeSection(p:Project,mid:string,sid:string):Project {
  const n=structuredClone(p),m=n.modules.find(a=>a.id===mid)?.module;if(!m||m.sections.length<2)throw Error('В корпусе должна остаться хотя бы одна секция.');
  if(m.sectionLayout){removeOpening(m,sid);const e=projectErrors(n)[0];if(e)throw Error(e);return n;}
 const i=m.sections.findIndex(s=>s.id===sid);if(i<0)throw Error('Выберите секцию.');const bb=boxes(m),recipient=i===0?1:i-1;
 m.sections.forEach((s,j)=>s.weight=bb[j].width+(j===recipient?bb[i].width+RULES.panel:0));m.sections.splice(i,1);
 const error=projectErrors(n)[0];if(error)throw Error(error);return n;
}

export function applyDrawerSlide(p:Project,mid:string,sid:string,index:number):Project {
 const n=structuredClone(p),m=n.modules.find(a=>a.id===mid)?.module,s=m?.sections.find(s=>s.id===sid);
 if(!m||!s||!Number.isInteger(index)||index<0||index>=s.drawers)throw Error('Выберите ящик.');
 const chosen=drawerConfig(m,s,index),offsets=drawerOffsets(s);
 // система целиком — тип, ход и бренд (заказ 7437584: «Скрытые Unihopper с доводчиком» другим ящикам приходили как DTC push — копировались
 // только тип и длина, а у старых шариковых ход не задан → у скрытых по умолчанию push)
 s.drawerConfigs=Array.from({length:s.drawers},(_,k)=>{const old=drawerConfig(m,s,k);const {operation:_o,brand:_b,...rest}=old;void _o;void _b;return {...rest,slide:chosen.slide,length:chosen.length,...(chosen.operation?{operation:chosen.operation}:{}),...(chosen.brand?{brand:chosen.brand}:{}),y:offsets[k],handle:old.slide===chosen.slide?old.handle:undefined};});
 const error=projectErrors(n)[0];if(error)throw Error(error);return n;
}


export function setCompositionDistance(p:Project,axis:'x'|'y'|'z',distance:number):Project {
 if(!Number.isFinite(distance)||distance<0)throw Error('Укажите неотрицательный отступ композиции.');
 const n=structuredClone(p),delta=distance-mountingCompositionBounds(p)[axis];
 for(const a of n.modules)a[axis]=(a[axis]??0)+delta;
 const error=projectErrors(n)[0];if(error)throw Error(error);return n;
}


export function compactDrawers(p:Project,mid:string,sid:string):Project {
 const n=structuredClone(p),m=n.modules.find(a=>a.id===mid)?.module,s=m?.sections.find(s=>s.id===sid);
 if(!m||!s||!s.drawers)throw Error('Выберите секцию с ящиками.');
 const offsets=drawerOffsets(s),order=offsets.map((y,index)=>({y,index})).sort((a,b)=>a.y-b.y);
 const configs=Array.from({length:s.drawers},(_,i)=>({...drawerConfig(m,s,i)}));let y=0;
 for(const {index} of order){configs[index].y=y;y+=configs[index].height+RULES.drawerStep;}
 s.drawerConfigs=configs;const error=projectErrors(n)[0];if(error)throw Error(error);return n;
}


export function moveComposition(p:Project,mid:string,pos:{x:number;y:number;z:number},ids?:readonly string[]):Project {
 const anchor=p.modules.find(a=>a.id===mid);if(!anchor)throw Error('Корпус не найден.');
 const delta={x:pos.x-anchor.x,y:pos.y-(anchor.y??0),z:pos.z-anchor.z};
 return {...p,modules:p.modules.map(a=>(!ids||ids.includes(mid)&&ids.includes(a.id)||a.id===mid)?({...a,x:a.x+delta.x,y:(a.y??0)+delta.y,z:a.z+delta.z}):a)};
}


export function duplicatePart(p:Project,mid:string,sid:string,pid:string):{project:Project;partId:string}{
 const m=p.modules.find(a=>a.id===mid)?.module,s=m?.sections.find(s=>s.id===sid),part=m&&parts(m).find(a=>a.id===pid&&a.sectionId===sid);
 if(!m||!s||!part)throw Error('Выберите полку или ящик для копирования.');
 const b=boxes(m).find(b=>b.id===sid)!;
 if(pid.includes(':drawer:')){
  const j=Number(pid.split(':drawer:')[1].split(':')[0]),cfg=drawerConfig(m,s,j),off=drawerOffsets(s);
  // u1 (замер удобства 22.10): сразу над этим ящиком, иначе над верхним ящиком секции; места нет — понятный отказ, не «молча»
  const top=Math.max(...Array.from({length:s.drawers},(_,k)=>off[k]+drawerConfig(m,s,k).height));
  for(const y of [...new Set([off[j]+cfg.height,top])]){
   try{const next=insertItem(p,'drawer',mid,sid,b.bottom+y+RULES.drawerStep,cfg);return {project:next,partId:sid+':drawer:'+s.drawers+':facade'};}catch{/* следующее место */}
  }
  throw Error(`Копия ящика не помещается: в секции нет места ещё под один ящик (фасад ${Math.round(cfg.height)} мм). Освободите место над ящиками, уменьшите ящики или увеличьте корпус.`);
 }
 if(pid.includes(':shelf:')){
  const above=Math.min(b.top,...s.shelves.map(f=>b.bottom+f*(b.top-b.bottom)).filter(y=>y>part.position[1]+.01));
  const next=insertItem(p,'shelf',mid,sid,(part.position[1]+above)/2);
  const shelves=next.modules.find(a=>a.id===mid)!.module.sections.find(a=>a.id===sid)!.shelves;
  return {project:next,partId:sid+':shelf:'+shelves.findIndex(f=>!s.shelves.includes(f))};
 }
 throw Error('В этой секции можно копировать отдельные полки и ящики.');
}


/** Заказ 7437584: копия несёт и настройки ящиков секции (зазор 30 / хват за фасад, полка над ящиками, посадка фасадов, зазор фасадов) и второй ярус штанги. */
export type SectionFilling={name:string;shelves:number[];drawers:DrawerConfig[];hanger:'rod'|'pantograph'|null;hangerHeight?:number;shelfDepth?:number;fixed?:number[];drawerGrip?:boolean;drawerCap?:boolean;drawerMount?:'inset';drawerGap?:number;rodLowerHeight?:number};
export function captureSectionFilling(p:Project,mid:string,sid:string):SectionFilling{
 const m=p.modules.find(a=>a.id===mid)?.module,s=m?.sections.find(s=>s.id===sid);if(!m||!s)throw Error('Выберите секцию для копирования.');
 const b=boxes(m).find(b=>b.id===sid)!,offsets=drawerOffsets(s),hanger=s.pantograph?'pantograph':s.rod?'rod':null;
 const rod=parts(m).find(a=>a.id===sid+':rod'||a.id===sid+':pantograph:rod');
 return {name:m.name+' · секция '+(m.sections.indexOf(s)+1),shelves:s.shelves.map(f=>f*(b.top-b.bottom)),drawers:Array.from({length:s.drawers},(_,j)=>({...drawerConfig(m,s,j),y:offsets[j]})),hanger,...(s.shelfDepth===undefined?{}:{shelfDepth:s.shelfDepth}),...(s.fixed?{fixed:[...s.fixed]}:{}),...(hanger&&rod?{hangerHeight:rod.position[1]-b.bottom}:{}),...(s.drawerGrip?{drawerGrip:true}:{}),...(s.drawerCap!==undefined?{drawerCap:s.drawerCap}:{}),...(s.drawerMount?{drawerMount:s.drawerMount}:{}),...(s.drawerGap!==undefined?{drawerGap:s.drawerGap}:{}),...(s.rod&&s.rodLower!==undefined?{rodLowerHeight:s.rodLower*(b.top-b.bottom)}:{})};
}
export function pasteSectionFilling(p:Project,mid:string,sid:string,copy:SectionFilling):Project{
 const n=structuredClone(p),m=n.modules.find(a=>a.id===mid)?.module,s=m?.sections.find(s=>s.id===sid);if(!m||!s)throw Error('Выберите секцию для вставки.');
 const b=boxes(m).find(b=>b.id===sid)!,height=b.top-b.bottom;
 s.shelves=copy.shelves.map(y=>y/height);s.drawers=copy.drawers.length;s.drawerConfigs=copy.drawers.map(c=>({...c}));s.rod=copy.hanger==='rod';s.pantograph=copy.hanger==='pantograph';
 if(copy.shelfDepth!==undefined)s.shelfDepth=copy.shelfDepth;else delete s.shelfDepth;
 if(copy.fixed)s.fixed=[...copy.fixed];else delete s.fixed;delete s.shelfLight;delete s.shelfLights;
 if(copy.hanger&&copy.hangerHeight!==undefined)s.rodAt=copy.hangerHeight/height;else delete s.rodAt;
 if(copy.drawerGrip)s.drawerGrip=true;else delete s.drawerGrip;
 if(copy.drawerCap!==undefined)s.drawerCap=copy.drawerCap;else delete s.drawerCap;
 if(copy.drawerMount)s.drawerMount=copy.drawerMount;else delete s.drawerMount;
 if(copy.drawerGap!==undefined)s.drawerGap=copy.drawerGap;else delete s.drawerGap;
 if(copy.hanger==='rod'&&copy.rodLowerHeight!==undefined)s.rodLower=copy.rodLowerHeight/height;else delete s.rodLower;
 const error=projectErrors(n)[0];if(error)throw Error('Наполнение не подходит этой секции: '+error);return n;
}


export function rotateModuleGroup(p:Project,ids:readonly string[]):Project{
 const chosen=p.modules.filter(a=>ids.includes(a.id));
 if(!chosen.length)throw Error('Отметьте корпуса для поворота.');
 const box=mountingCompositionBounds({...p,modules:chosen}),cx=box.x+box.w/2,cz=box.z+box.d/2;
 if(box.d>p.room.width||box.w>p.room.depth)throw Error('После поворота группа не помещается в комнате. Измените состав группы или замер.');
 const n=structuredClone(p);
 for(const a of n.modules.filter(a=>ids.includes(a.id))){
  const center=moduleCenter(a),x=cx+center.z-cz,z=cz-center.x+cx;
  a.rotation=(((a.rotation??0)+90)%360) as 0|90|180|270;
  const local=moduleCenter({...a,x:0,z:0});a.x=x-local.x;a.z=z-local.z;
 }
 const rotated=mountingCompositionBounds({...n,modules:n.modules.filter(a=>ids.includes(a.id))});
 const dx=Math.max(0,Math.min(p.room.width-rotated.w,rotated.x))-rotated.x;
 const dz=Math.max(0,Math.min(p.room.depth-rotated.d,rotated.z))-rotated.z;
 for(const a of n.modules.filter(a=>ids.includes(a.id))){a.x+=dx;a.z+=dz;}
 const error=projectErrors(n)[0];if(error)throw Error(error);
 return n;
}

/** Resize only the target opening; other section widths and contents stay intact. One undo step. */
export function fitMeshItem(p:Project,mid:string,sid:string,meshId:string,worldY:number):Project {
 const original=p.modules.find(a=>a.id===mid)?.module,item=meshById(meshId);
 if(!original||!item)throw Error('Выберите корпус и элемент из каталога.');
 const before=boxes(original),target=before.find(b=>b.id===sid);
 if(!target)throw Error('Секция не найдена.');
 let failure='Подходящая ширина превышает допустимый габарит корпуса.';
 const widths=Array.from({length:RULES.maxW-RULES.minW+1},(_,i)=>RULES.minW+i).sort((a,b)=>Math.abs(a-original.width)-Math.abs(b-original.width));
 for(const width of widths){
   const opening=target.width+width-original.width;if(opening<RULES.minSection)continue;
   const m=structuredClone(original);m.width=width;
   m.sections.forEach(s=>s.weight=s.id===sid?opening:before.find(b=>b.id===s.id)!.width);
   const sec=m.sections.find(s=>s.id===sid)!;
   const inner=boxes(m).find(b=>b.id===sid)!.width-fillerSides(m,sec).left-fillerSides(m,sec).right;
   if(inner<item.reqW-0.001||inner>item.reqW+MESH_WIDTH_TOLERANCE+0.001)continue;
   // ширина корпуса меняется по правилу ряда (rowResize): сосед сужается, у стены — от стены
   try{return insertItem(placeInRow(p,mid,m),'mesh',mid,sid,worldY,undefined,meshId);}catch(e){failure=(e as Error).message;}
 }
 throw Error('Не удалось подобрать корпус: '+failure+' Размеры и наполнение сохранены.');
}
