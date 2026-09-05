import {boxes,drawerConfig,drawerOffsets,drawerStackHeight,parts,RULES,type Module,type Section} from './model';
import {type Project,projectErrors} from './project';
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
export function insertItem(p:Project,kind:FillKind,mid:string,sid:string,worldY:number):Project{
  const source=p.modules.find(a=>a.id===mid)?.module;if(!source)throw Error('Перетащите элемент в корпус.');const b=boxes(source).find(b=>b.id===sid)!;
  const desired=Math.round((worldY-b.bottom)/5)*5;
  const candidates=[desired,0,drawerStackHeight(source.sections.find(s=>s.id===sid)!),...Array.from({length:Math.ceil((b.top-b.bottom)/16)},(_,i)=>i*16)].sort((a,b)=>Math.abs(a-desired)-Math.abs(b-desired));
  for(const y of candidates){
    const n=structuredClone(p),m=n.modules.find(a=>a.id===mid)!.module,s=m.sections.find(s=>s.id===sid)!;
    if(kind==='shelf'){if(s.shelves.length>=RULES.maxShelves)break;s.shelves.push(y/(b.top-b.bottom));s.shelves.sort((a,b)=>a-b);}
    else if(kind==='drawer'){
      if(s.drawers>=RULES.maxDrawers)break;
      s.drawerConfigs=Array.from({length:s.drawers},(_,j)=>drawerConfig(m,s,j));const cfg=drawerConfig(m,s,s.drawers);s.drawers++;s.drawerConfigs.push({...cfg,y});
    }else if(kind==='rod'){s.rod=true;s.pantograph=false;s.rodAt=y/(b.top-b.bottom);}
    else {s.pantograph=true;s.rod=false;s.rodAt=y/(b.top-b.bottom);}
    if(!projectErrors(n).length)return n;
  }
  throw Error(kind==='pantograph'?'Пантографу нужен внутренний проём от 545 мм и место по высоте.':'Здесь недостаточно свободного места. Переместите наполнение или увеличьте корпус.');
}


