// m4 (критик релиза 22.10): «+» у «Ящики» и поле «Ящиков в секции» отказывали без объяснения («Здесь недостаточно свободного
// места»). Здесь — причина простыми словами: какое правило нарушает новый ящик на своём месте (поверх стопки ящиков), сколько
// высоты свободно до ближайшей полки или крыши и сколько ящиков секция вмещает сейчас. Та же вставка, что у insertItem.
import {boxes,drawerConfig,drawerPitch,drawerStackHeight,fillerSides,RULES,MAX_DRAWERS_REASON,type Module,type Section} from './model';
import {projectErrors,type Project} from './project';
import {roofDrawers,setDrawerCount} from './drawerModes';

const plural=(n:number)=>n%10===1&&n%100!==11?'ящик':n%10>=2&&n%10<=4&&(n%100<10||n%100>=20)?'ящика':'ящиков';
/** Проект с ещё одним ящиком поверх стопки секции (как insertItem при желаемой высоте = верх стопки) и что ему мешает. */
function drawerOnTop(p:Project,mid:string,sid:string):{next:Project;m:Module;s:Section;below?:number}|null{
  const next=structuredClone(p),m=next.modules.find(a=>a.id===mid)?.module,s=m?.sections.find(x=>x.id===sid),b=m&&boxes(m).find(x=>x.id===sid);
  if(!m||!s||!b)return null;
  // комод / ящики до крыши по правилу (правка 29.10): ещё один ящик — все снова поровну на весь проём (как insertItem)
  if(roofDrawers(m,s)){try{setDrawerCount(m,sid,s.drawers+1);return {next,m,s};}catch{return null;}}
  const y=drawerStackHeight(s);
  s.drawerConfigs=Array.from({length:s.drawers},(_,j)=>drawerConfig(m,s,j));const cfg=drawerConfig(m,s,s.drawers);s.drawers++;s.drawerConfigs.push({...cfg,y});
  // как в insertItem: за дверью с фальшами полка ниже верха ящиков не пускает ящик (фальш идёт до полки)
  const f=fillerSides(m,s),H=b.top-b.bottom,j=s.shelves.findIndex(v=>v*H<drawerStackHeight(s)+RULES.panel);
  return {next,m,s,below:(f.left||f.right)&&j>=0?j:undefined};
}
const fresh=(p:Project,base:Set<string>)=>projectErrors(p).filter(e=>!base.has(e));
/** Встаёт ли ещё один ящик поверх стопки (одна проверка проекта). Счётчик «Ящики» и поле «Ящиков в секции» добавляют только так:
 *  перебор всех высот insertItem при полной секции шёл десятки секунд и ставил ящик над полками, а не в стопку. */
export function drawerFitsOnTop(p:Project,mid:string,sid:string):boolean{
  const s=p.modules.find(a=>a.id===mid)?.module.sections.find(x=>x.id===sid);if(!s||s.drawers>=RULES.maxDrawers)return false;
  const t=drawerOnTop(p,mid,sid);if(!t||t.below!==undefined)return false;
  return !fresh(t.next,new Set(projectErrors(p))).length;
}
/** Сколько ящиков помещается в секцию при текущих полках и штанге (ящики добавляются поверх стопки, пока нет новых ошибок). */
export function drawerCapacity(p:Project,mid:string,sid:string):number{
  const base=new Set(projectErrors(p));let cur=p,count=p.modules.find(a=>a.id===mid)?.module.sections.find(x=>x.id===sid)?.drawers??0;
  while(count<RULES.maxDrawers){const t=drawerOnTop(cur,mid,sid);if(!t||t.below!==undefined||fresh(t.next,base).length)break;cur=t.next;count++;}
  return count;
}
/** Почему в секцию не добавить ещё ящик: правило, свободная высота над ящиками и предел секции. */
export function drawerAddReason(p:Project,mid:string,sid:string):string{
  const m=p.modules.find(a=>a.id===mid)?.module,s=m?.sections.find(x=>x.id===sid),b=m&&boxes(m).find(x=>x.id===sid);
  if(!m||!s||!b)return 'Выберите секцию с ящиками.';
  if(s.drawers>=RULES.maxDrawers)return MAX_DRAWERS_REASON;
  // комод (ящики до крыши поровну, критик 29.10): причина — почему N+1 равных фасадов не встают
  if(roofDrawers(m,s)){const c=structuredClone(m);try{setDrawerCount(c,sid,s.drawers+1);}catch(e){return `Ящик ${s.drawers+1} не добавить: ${(e as Error).message.replace(/^Ящики поровну до крыши не встают: /,'')} Сейчас в секции ${s.drawers} ${plural(s.drawers)} поровну до крыши.`;}}
  const t=drawerOnTop(p,mid,sid),base=new Set(projectErrors(p)),n=s.drawers+1;
  const stack=drawerStackHeight(s),pitch=drawerPitch(drawerConfig(m,s,s.drawers),s.drawerGap),H=b.top-b.bottom;
  const shelf=s.shelves.map((v,j)=>({y:v*H,j})).filter(x=>x.y>stack).sort((a,z)=>a.y-z.y)[0];
  const where=shelf?`полки ${shelf.j+1}`:'крыши',what=shelf?`полку ${shelf.j+1}`:'наполнение сверху',free=Math.max(0,Math.round((shelf?shelf.y-RULES.panel/2:H)-stack));
  let rule='';
  if(t?.below!==undefined)rule=`полка ${t.below+1} ниже верха ${n}-го ящика (${Math.round(drawerStackHeight(t.s))} мм от дна) — за дверью ящики идут под полкой.`;
  else if(t){const e=fresh(t.next,base)[0];if(e){const pre=m.name+': ';let r=e.startsWith(pre)?e.slice(pre.length):e;r=r.replace(/^Секция \d+: /,'');rule=r.charAt(0).toLowerCase()+r.slice(1);}}
  const cap=drawerCapacity(p,mid,sid);
  return `Ящик ${n} не помещается${rule?': '+rule:'.'} Над ящиками до ${where} свободно ${free} мм, сам ящик — ${pitch} мм`
    +(free<pitch?`, не хватает ${pitch-free} мм.`:'.')
    +` Сейчас в секции помещается ${cap} ${plural(cap)}: поднимите или уберите ${what}, уменьшите высоту ящиков или увеличьте корпус.`;
}
