import {MEASUREMENT_RULES} from './measurement';
import {id,section,boxes,drawerConfig,drawerOffsets,drawerStackHeight,doorCount,parts,RULES,type Module,type Section} from './model';
import {meshById,DEFAULT_MESH,MESH_WIDTH_TOLERANCE} from './mesh';
import {bounds,moduleCenter,mountingCompositionBounds,type Project,projectErrors} from './project';
import type {DrawerConfig} from './hardware';
export type FillKind='shelf'|'drawer'|'rod'|'pantograph'|'mesh';
export function removePart(p:Project,mid:string,sid:string,pid:string):Project{
  const n=structuredClone(p),m=n.modules.find(a=>a.id===mid)?.module,s=m?.sections.find(s=>s.id===sid);
  if(!m||!s)throw Error('Выберите элемент наполнения.');
  if(pid.includes(':shelf:')){const j=Number(pid.split(':shelf:')[1]);if(!Number.isInteger(j)||j<0||j>=s.shelves.length)throw Error('Полка не найдена.');s.shelves.splice(j,1);}
  else if(pid.includes(':drawer:')){const j=Number(pid.split(':drawer:')[1].split(':')[0]);if(!Number.isInteger(j)||j<0||j>=s.drawers)throw Error('Ящик не найден.');const offsets=drawerOffsets(s);s.drawerConfigs=Array.from({length:s.drawers},(_,k)=>({...drawerConfig(m,s,k),y:offsets[k]}));s.drawerConfigs.splice(j,1);s.drawers--;}
  else if(pid.includes(':pantograph:')){s.pantograph=false;delete s.rodAt;}
  else if(pid.endsWith(':rod')||pid.includes(':flange:')){s.rod=false;delete s.rodAt;}
  else throw Error('Эта деталь относится к конструкции корпуса.');
  return n;
}
export function moveModule(p:Project,mid:string,pos:{x:number;y:number;z:number}){const n=structuredClone(p),a=n.modules.find(a=>a.id===mid);if(!a)throw Error('Корпус не найден.');Object.assign(a,pos);return n;}
export function movePart(p:Project,mid:string,sid:string,pid:string,delta:number){
  const n=structuredClone(p),m=n.modules.find(a=>a.id===mid)!.module,s=m.sections.find(s=>s.id===sid)!,b=boxes(m).find(b=>b.id===sid)!;
  if(pid.includes(':shelf:')){const j=Number(pid.split(':shelf:')[1]);s.shelves[j]+=delta/(b.top-b.bottom);}
  else if(pid.includes(':drawer:')){const j=Number(pid.split(':drawer:')[1].split(':')[0]);const yy=drawerOffsets(s);s.drawerConfigs=Array.from({length:s.drawers},(_,k)=>({...drawerConfig(m,s,k),y:yy[k]}));s.drawerConfigs[j]={...s.drawerConfigs[j],y:Math.round(yy[j]+delta)};}
  else if(pid.includes(':rod')||pid.includes(':pantograph:')||pid.includes(':flange:')){const current=parts(m).find(p=>p.id===sid+':rod'||p.id===sid+':pantograph:rod')!;s.rodAt=(current.position[1]+delta-b.bottom)/(b.top-b.bottom);}
  return n;
}
export function insertItem(p:Project,kind:FillKind,mid:string,sid:string,worldY:number,drawer?:DrawerConfig,meshId:string=DEFAULT_MESH):Project{
  const source=p.modules.find(a=>a.id===mid)?.module;if(!source)throw Error('Перетащите элемент в корпус.');
  const target=source.sections.find(s=>s.id===sid),b=boxes(source).find(b=>b.id===sid);
  if(!target||!b)throw Error('Выберите секцию для наполнения.');
  if(kind==='shelf'&&target.shelves.length>=RULES.maxShelves)throw Error(`В секции уже ${RULES.maxShelves} полок. Выберите другую секцию или удалите ненужную полку.`);
  if((kind==='drawer'||kind==='mesh')&&target.drawers>=RULES.maxDrawers)throw Error(`В секции уже ${RULES.maxDrawers} ящиков. Выберите другую секцию или удалите ненужный ящик.`);
  if(kind==='mesh'){
    const item=meshById(meshId);if(!item)throw Error('Элемент Лемана Про не найден в каталоге.');
    kind='drawer';drawer={slide:'ball',length:250,height:item.h,mesh:item.id};
    // Ширина проверяется валидацией; здесь даём понятную подсказку сразу.
    const inner=b.width-(source.doors?RULES.drawerFiller*(doorCount(source,target)===2?2:1):0);
    if(inner<item.reqW||inner>item.reqW+MESH_WIDTH_TOLERANCE)throw Error(`«${item.label}» нужен проём ${item.reqW}–${item.reqW+MESH_WIDTH_TOLERANCE} мм внутри, сейчас ${Math.round(inner)}. Сделайте секцию ${Math.round(item.reqW+(b.width-inner)+2*RULES.panel)} мм по корпусу или выберите другой элемент.`);
  }
  const desired=Math.round((worldY-b.bottom)/5)*5;
  const candidates=[desired,0,drawerStackHeight(source.sections.find(s=>s.id===sid)!),...Array.from({length:Math.ceil((b.top-b.bottom)/16)},(_,i)=>i*16)].sort((a,b)=>Math.abs(a-desired)-Math.abs(b-desired));
  for(const y of candidates){
    const n=structuredClone(p),m=n.modules.find(a=>a.id===mid)!.module,s=m.sections.find(s=>s.id===sid)!;
    if(kind==='shelf'){if(s.shelves.length>=RULES.maxShelves)break;s.shelves.push(y/(b.top-b.bottom));s.shelves.sort((a,b)=>a-b);}
    else if(kind==='drawer'){
      if(s.drawers>=RULES.maxDrawers)break;
      s.drawerConfigs=Array.from({length:s.drawers},(_,j)=>drawerConfig(m,s,j));const cfg=drawer??drawerConfig(m,s,s.drawers);s.drawers++;s.drawerConfigs.push({...cfg,y});
    }else if(kind==='rod'){s.rod=true;s.pantograph=false;s.rodAt=y/(b.top-b.bottom);}
    else {s.pantograph=true;s.rod=false;s.rodAt=y/(b.top-b.bottom);}
    if(!projectErrors(n).length)return n;
  }
  throw Error(kind==='pantograph'?'Пантографу нужен внутренний проём от 545 мм и место по высоте.':'Здесь недостаточно свободного места. Переместите наполнение или увеличьте корпус.');
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
  const n=removePart(p,fromMid,fromSid,pid);
  return insertItem(n,kind,toMid,toSid,y,cfg);
}



export function moveDivider(p:Project,mid:string,rightSectionId:string,delta:number){
 const n=structuredClone(p),m=n.modules.find(a=>a.id===mid)?.module;
 if(!m||!Number.isFinite(delta))throw Error('Перегородка не найдена.');
 const i=m.sections.findIndex(s=>s.id===rightSectionId),bb=boxes(m);
 if(i<1)throw Error('Выберите внутреннюю перегородку.');
 m.sections.forEach((s,j)=>s.weight=bb[j].width+(j===i-1?delta:j===i?-delta:0));
 if(m.sections.some(s=>s.weight<RULES.minSection))throw Error(`Ширина секции должна быть не меньше ${RULES.minSection} мм.`);
 const error=projectErrors(n)[0];if(error)throw Error(error);
 return n;
}

export function mirrorModule(p:Project,mid:string):Project {
 const n=structuredClone(p),m=n.modules.find(a=>a.id===mid)?.module;
 if(!m)throw Error('Выберите корпус для отражения.');
 m.sections.reverse();
 m.hingeSide=m.hingeSide==='right'?'left':'right';
 const error=projectErrors(n)[0];if(error)throw Error(error);
 return n;
}

export function setWallDistance(p:Project,mid:string,axis:'x'|'y'|'z',distance:number,whole=false,ids?:readonly string[]):Project {
 const n=structuredClone(p),a=n.modules.find(a=>a.id===mid);
 if(!a||!Number.isFinite(distance)||distance<0)throw Error('Укажите неотрицательное расстояние от стены или пола.');
 const edge=bounds(a)[axis];
 const delta=distance-edge;
 for(const item of whole?n.modules:ids?.includes(mid)?n.modules.filter(item=>ids.includes(item.id)):[a])item[axis]=(item[axis]??0)+delta;
 const error=projectErrors(n)[0];if(error)throw Error(error);
 return n;
}

export function rotateModule(p:Project,mid:string,rotation:0|90|180|270):Project {
 const n=structuredClone(p),a=n.modules.find(a=>a.id===mid);
 if(!a||![0,90,180,270].includes(rotation))throw Error('Выберите поворот корпуса.');
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
 const y=(base.y??0)+base.module.height,height=Math.min(600,Math.floor(p.room.height-y-MEASUREMENT_RULES.ceilingClearance));
 if(height<RULES.minH)throw Error(`Над корпусом нужно хотя бы ${RULES.minH} мм для отдельной антресоли и ${MEASUREMENT_RULES.ceilingClearance} мм монтажного зазора. Измените высоту нижнего корпуса или замер помещения.`);
 n.modules.push({...base,id:id(),y,module:{...structuredClone(base.module),name:'Антресоль',height,plinthHeight:0,sections:[section()]}});
 const error=projectErrors(n)[0];if(error)throw Error(error);return n;
}


export function clearSection(p:Project,mid:string,sid:string):Project {
 const n=structuredClone(p),s=n.modules.find(a=>a.id===mid)?.module.sections.find(s=>s.id===sid);if(!s)throw Error('Выберите секцию.');
 s.shelves=[];s.drawers=0;s.rod=false;delete s.pantograph;delete s.rodAt;delete s.drawerConfigs;return n;
}
export function removeSection(p:Project,mid:string,sid:string):Project {
 const n=structuredClone(p),m=n.modules.find(a=>a.id===mid)?.module;if(!m||m.sections.length<2)throw Error('В корпусе должна остаться хотя бы одна секция.');
 const i=m.sections.findIndex(s=>s.id===sid);if(i<0)throw Error('Выберите секцию.');const bb=boxes(m),recipient=i===0?1:i-1;
 m.sections.forEach((s,j)=>s.weight=bb[j].width+(j===recipient?bb[i].width+RULES.panel:0));m.sections.splice(i,1);
 const error=projectErrors(n)[0];if(error)throw Error(error);return n;
}

export function applyDrawerSlide(p:Project,mid:string,sid:string,index:number):Project {
 const n=structuredClone(p),m=n.modules.find(a=>a.id===mid)?.module,s=m?.sections.find(s=>s.id===sid);
 if(!m||!s||!Number.isInteger(index)||index<0||index>=s.drawers)throw Error('Выберите ящик.');
 const chosen=drawerConfig(m,s,index),offsets=drawerOffsets(s);
 s.drawerConfigs=Array.from({length:s.drawers},(_,k)=>{const old=drawerConfig(m,s,k);return {...old,slide:chosen.slide,length:chosen.length,y:offsets[k],handle:old.slide===chosen.slide?old.handle:undefined};});
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
  const j=Number(pid.split(':drawer:')[1].split(':')[0]),cfg=drawerConfig(m,s,j);
  const next=insertItem(p,'drawer',mid,sid,b.bottom+drawerOffsets(s)[j]+cfg.height+RULES.drawerStep,cfg);
  return {project:next,partId:sid+':drawer:'+s.drawers+':facade'};
 }
 if(pid.includes(':shelf:')){
  const above=Math.min(b.top,...s.shelves.map(f=>b.bottom+f*(b.top-b.bottom)).filter(y=>y>part.position[1]+.01));
  const next=insertItem(p,'shelf',mid,sid,(part.position[1]+above)/2);
  const shelves=next.modules.find(a=>a.id===mid)!.module.sections.find(a=>a.id===sid)!.shelves;
  return {project:next,partId:sid+':shelf:'+shelves.findIndex(f=>!s.shelves.includes(f))};
 }
 throw Error('В этой секции можно копировать отдельные полки и ящики.');
}


export type SectionFilling={name:string;shelves:number[];drawers:DrawerConfig[];hanger:'rod'|'pantograph'|null;hangerHeight?:number};
export function captureSectionFilling(p:Project,mid:string,sid:string):SectionFilling{
 const m=p.modules.find(a=>a.id===mid)?.module,s=m?.sections.find(s=>s.id===sid);if(!m||!s)throw Error('Выберите секцию для копирования.');
 const b=boxes(m).find(b=>b.id===sid)!,offsets=drawerOffsets(s),hanger=s.pantograph?'pantograph':s.rod?'rod':null;
 const rod=parts(m).find(a=>a.id===sid+':rod'||a.id===sid+':pantograph:rod');
 return {name:m.name+' · секция '+(m.sections.indexOf(s)+1),shelves:s.shelves.map(f=>f*(b.top-b.bottom)),drawers:Array.from({length:s.drawers},(_,j)=>({...drawerConfig(m,s,j),y:offsets[j]})),hanger,...(hanger&&rod?{hangerHeight:rod.position[1]-b.bottom}:{})};
}
export function pasteSectionFilling(p:Project,mid:string,sid:string,copy:SectionFilling):Project{
 const n=structuredClone(p),m=n.modules.find(a=>a.id===mid)?.module,s=m?.sections.find(s=>s.id===sid);if(!m||!s)throw Error('Выберите секцию для вставки.');
 const b=boxes(m).find(b=>b.id===sid)!,height=b.top-b.bottom;
 s.shelves=copy.shelves.map(y=>y/height);s.drawers=copy.drawers.length;s.drawerConfigs=copy.drawers.map(c=>({...c}));s.rod=copy.hanger==='rod';s.pantograph=copy.hanger==='pantograph';
 if(copy.hanger&&copy.hangerHeight!==undefined)s.rodAt=copy.hangerHeight/height;else delete s.rodAt;
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
