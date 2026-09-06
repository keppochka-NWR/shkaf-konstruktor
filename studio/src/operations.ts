import {id,section,boxes,drawerConfig,drawerOffsets,drawerStackHeight,parts,RULES,type Module,type Section} from './model';
import {bounds,type Project,projectErrors} from './project';
import type {DrawerConfig} from './hardware';
export type FillKind='shelf'|'drawer'|'rod'|'pantograph';
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
export function insertItem(p:Project,kind:FillKind,mid:string,sid:string,worldY:number,drawer?:DrawerConfig):Project{
  const source=p.modules.find(a=>a.id===mid)?.module;if(!source)throw Error('Перетащите элемент в корпус.');const b=boxes(source).find(b=>b.id===sid)!;
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
export function transferPart(p:Project,fromMid:string,fromSid:string,pid:string,toMid:string,toSid:string,y:number):Project{
  if(fromMid===toMid&&fromSid===toSid)throw Error('Выберите другой корпус или секцию.');
  const m=p.modules.find(a=>a.id===fromMid)?.module,s=m?.sections.find(s=>s.id===fromSid);if(!m||!s)throw Error('Элемент не найден.');
  const kind:FillKind=pid.includes(':pantograph:')?'pantograph':pid.includes(':drawer:')?'drawer':pid.includes(':shelf:')?'shelf':'rod';
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

export function setWallDistance(p:Project,mid:string,axis:'x'|'y'|'z',distance:number):Project {
 const n=structuredClone(p),a=n.modules.find(a=>a.id===mid);
 if(!a||!Number.isFinite(distance)||distance<0)throw Error('Укажите неотрицательное расстояние от стены или пола.');
 const edge=bounds(a)[axis];
 a[axis]=(a[axis]??0)+distance-edge;
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
 const y=(base.y??0)+base.module.height,height=Math.min(600,Math.floor(p.room.height-y));
 if(height<RULES.minH)throw Error(`Над корпусом нужно хотя бы ${RULES.minH} мм для отдельной антресоли. Измените высоту нижнего корпуса или замер помещения.`);
 n.modules.push({...base,id:id(),y,module:{...structuredClone(base.module),name:'Антресоль',height,plinthHeight:0,sections:[section()]}});
 const error=projectErrors(n)[0];if(error)throw Error(error);return n;
}

