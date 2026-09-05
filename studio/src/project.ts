import {id,initialModule,parseModule,validate,type Module,section} from './model';
export type Opening={id:string;type:'window'|'door';wall:'back'|'left'|'right'|'front';offset:number;width:number;height:number;sill:number};
export type Room={width:number;depth:number;height:number;openings?:Opening[]};
export type PlacedModule={id:string;x:number;z:number;y?:number;rotation?:0|90|180|270;module:Module};
export type Project={version:3;measurement?:{number:string;date:string;notes:string};room:Room;modules:PlacedModule[];cloud?:{id:string;revision:number;owner:string};calculation?:{markup:number;overrides:Record<string,number>};offer?:{customer:string;price:string;notes:string}};
export function newProject(module=initialModule()):Project{return {version:3,room:{width:4000,depth:3000,height:2700,openings:[]},modules:[{id:id(),x:50,y:0,z:30,module}]};}
export function localToRoom(a:PlacedModule,u:number,v:number){const w=a.module.width,d=a.module.depth;switch(a.rotation??0){case 90:return{x:a.x+v,z:a.z+w-u};case 180:return{x:a.x+w-u,z:a.z+d-v};case 270:return{x:a.x+d-v,z:a.z+u};default:return{x:a.x+u,z:a.z+v};}}
export function roomToLocal(a:PlacedModule,x:number,z:number){const u=x-a.x,v=z-a.z;switch(a.rotation??0){case 90:return{x:a.module.width-v,z:u};case 180:return{x:a.module.width-u,z:a.module.depth-v};case 270:return{x:v,z:a.module.depth-u};default:return{x:u,z:v};}}
export function moduleCenter(a:PlacedModule){return localToRoom(a,a.module.width/2,a.module.depth/2);}
export function bounds(a:PlacedModule){const rear=a.module.backType==='groove'?0:3;const points=[localToRoom(a,0,-rear),localToRoom(a,a.module.width,a.module.depth+18)];return{x:Math.min(...points.map(p=>p.x)),z:Math.min(...points.map(p=>p.z)),y:a.y??0,w:Math.abs(points[1].x-points[0].x),d:Math.abs(points[1].z-points[0].z),h:a.module.height};}
export function overlap(a:ReturnType<typeof bounds>,b:ReturnType<typeof bounds>){return a.x<b.x+b.w-0.1&&a.x+a.w>b.x+0.1&&a.y<b.y+b.h-0.1&&a.y+a.h>b.y+0.1&&a.z<b.z+b.d-0.1&&a.z+a.d>b.z+0.1;}
export function projectErrors(p:Project):string[]{
  const errors:string[]=[];
  if(p.measurement){const m=p.measurement;if(typeof m.number!=='string'||m.number.length>60||typeof m.notes!=='string'||m.notes.length>2000||typeof m.date!=='string'||(m.date!==''&&(!/^\d{4}-\d{2}-\d{2}$/.test(m.date)||!Number.isFinite(Date.parse(m.date))||new Date(m.date).toISOString().slice(0,10)!==m.date)))return ['Проверьте номер, дату и примечания замера.'];}

  if(p.cloud&&(typeof p.cloud.id!=="string"||!/^[-A-Za-z0-9_]{1,64}$/.test(p.cloud.id)||!Number.isInteger(p.cloud.revision)||p.cloud.revision<1||typeof p.cloud.owner!=="string"||p.cloud.owner.length>120))return ["Некорректная связь с кабинетом."];
  if(p.calculation&&(!Number.isFinite(p.calculation.markup)||p.calculation.markup<1||p.calculation.markup>10||!p.calculation.overrides||typeof p.calculation.overrides!=='object'||Array.isArray(p.calculation.overrides)||Object.keys(p.calculation.overrides).length>300||Object.values(p.calculation.overrides).some(v=>!Number.isFinite(v)||v<0||v>1e9)))return ['Проверьте цены и коэффициент сметы (от 1 до 10).'];
  if(p.offer&&(typeof p.offer.customer!=='string'||p.offer.customer.length>120||typeof p.offer.notes!=='string'||p.offer.notes.length>2000||typeof p.offer.price!=='string'||(p.offer.price!==''&&(!Number.isFinite(Number(p.offer.price))||Number(p.offer.price)<0||Number(p.offer.price)>1e12))))return ['Проверьте поля коммерческого предложения.'];
  if(!p.modules.length||p.modules.length>40)return ['В проекте должно быть от 1 до 40 модулей.'];
  if(new Set(p.modules.map(m=>m.id)).size!==p.modules.length)return ['Идентификаторы модулей повторяются.'];
  for(const v of [p.room.width,p.room.depth,p.room.height])if(!Number.isFinite(v)||v<500||v>20000)return ['Размеры помещения: от 500 до 20 000 мм.'];
  if(p.room.openings&&(!Array.isArray(p.room.openings)||p.room.openings.length>30))return ['Допустимо до 30 окон и дверей.'];
  for(const o of p.room.openings||[])if(!o||!['window','door'].includes(o.type)||!['back','left','right','front'].includes(o.wall)||typeof o.id!=='string'||![o.offset,o.width,o.height,o.sill].every(Number.isFinite)||o.offset<0||o.width<200||o.height<200||o.sill<0||o.sill+o.height>p.room.height||o.offset+o.width>(o.wall==='back'||o.wall==='front'?p.room.width:p.room.depth))errors.push('Окно или дверь выходят за границы стены.');
  const os=p.room.openings||[];
  if(new Set(os.map(o=>o.id)).size!==os.length)errors.push('Идентификаторы проёмов повторяются.');
  os.forEach((o,i)=>{for(const b of os.slice(0,i))if(o.wall===b.wall&&o.offset<b.offset+b.width&&o.offset+o.width>b.offset&&o.sill<b.sill+b.height&&o.sill+o.height>b.sill)errors.push('Окна и двери не должны пересекаться.');});
  p.modules.forEach((a,i)=>{
    if(a.rotation!==undefined&&![0,90,180,270].includes(a.rotation))errors.push('Поворот корпуса: 0, 90, 180 или 270 градусов.');
    errors.push(...validate(a.module).map(e=>`${a.module.name}: ${e}`));const b=bounds(a);
    if(![a.x,a.z,a.y??0].every(Number.isFinite)||b.x<0||b.y<0||b.z<0||b.x+b.w>p.room.width+0.1||b.z+b.d>p.room.depth+0.1||b.y+b.h>p.room.height+0.1)errors.push(`${a.module.name}: корпус выходит за границы помещения. Измените замер или положение.`);
    for(const other of p.modules.slice(0,i))if(overlap(b,bounds(other)))errors.push(`«${a.module.name}» пересекается с «${other.module.name}». Сдвиньте корпус или поставьте его сверху.`);
  });return [...new Set(errors)];
}
function legacyModules(raw:any,placement:{id:string;x:number;z:number;y?:number}):PlacedModule[]{
  if(!raw||!Number.isFinite(raw.width))throw Error('Нет размеров корпуса.');
  if(raw.width<=900)return [{...placement,module:parseModule(raw)}];
  if(raw.width>1200||!Array.isArray(raw.sections)||!raw.sections.length)throw Error('Некорректные размеры старого корпуса.');
  // Preserve total occupied width. Do not duplicate filling during migration.
  const count=Math.max(2,raw.sections.length),w=raw.width/count;
  return Array.from({length:count},(_,i)=>{const s=raw.sections[i]||section();const m=parseModule({...raw,width:w,name:(raw.name||'Модуль').slice(0,66)+' · '+(i+1),sections:[{...s,id:id(),weight:1}]});return {...placement,id:i===0?placement.id:id(),x:placement.x+i*w,module:m};});
}
export function parseProject(data:unknown):Project{
  const x=data as any;
  if(x?.version===1){const p=newProject();p.modules=legacyModules(x,{id:id(),x:50,y:0,z:30});const e=projectErrors(p);if(e.length)throw Error(e[0]);return p;}
  if(!x||![2,3].includes(x.version)||!x.room||!Array.isArray(x.modules)||x.modules.length>40)throw Error('Нужен файл проекта редактора.');
  const p:Project={version:3,room:{width:x.room.width,height:x.room.height,depth:x.room.depth,openings:[]},modules:[]};
  if(x.room.openings!==undefined){if(!Array.isArray(x.room.openings)||x.room.openings.length>30)throw Error('Неверные проёмы помещения.');p.room.openings=x.room.openings.map((o:any)=>({id:o?.id,type:o?.type,wall:o?.wall,offset:o?.offset,width:o?.width,height:o?.height,sill:o?.sill}));}
  for(const a of x.modules){if(!a||typeof a.id!=='string')throw Error('Некорректный модуль проекта.');const pos={id:a.id,x:a.x,z:a.z,y:a.y??0,...(a.rotation===undefined?{}:{rotation:a.rotation})};p.modules.push(...(x.version===2?legacyModules(a.module,pos):[{...pos,module:parseModule(a.module)}]));}
  if(x.measurement)p.measurement={number:x.measurement.number,date:x.measurement.date,notes:x.measurement.notes};
  if(x.cloud)p.cloud={id:x.cloud.id,revision:x.cloud.revision,owner:x.cloud.owner};
  if(x.calculation)p.calculation={markup:x.calculation.markup,overrides:x.calculation.overrides};
  if(x.offer)p.offer={customer:x.offer.customer,price:x.offer.price,notes:x.offer.notes};const e=projectErrors(p);if(e.length)throw Error(e[0]);return p;
}
export function appendModule(p:Project,source:Module):Project{
  const n=structuredClone(p),module=structuredClone(source);module.sections.forEach(s=>s.id=id());module.name=`Модуль ${p.modules.length+1}`;const x=Math.max(...p.modules.filter(a=>(a.y??0)===0).map(a=>bounds(a).x+bounds(a).w),0);n.modules.push({id:id(),x,y:0,z:30,module});return n;
}
export function snapPlacement(p:Project,mid:string,position:{x:number;y:number;z:number},tolerance=35){
  const a=p.modules.find(a=>a.id===mid)!,ab=bounds({...a,x:0,z:0,y:0});const candidates={x:[-ab.x,p.room.width-ab.x-ab.w],y:[0],z:[-ab.z,p.room.depth-ab.z-ab.d]};
  for(const b of p.modules){if(b.id===mid)continue;const bb=bounds(b);candidates.x.push(bb.x-ab.x,bb.x+bb.w-ab.x,bb.x-ab.w-ab.x,bb.x+bb.w-ab.w-ab.x);candidates.y.push(b.y??0,(b.y??0)+b.module.height,(b.y??0)-a.module.height);candidates.z.push(bb.z-ab.z,bb.z+bb.d-ab.z,bb.z-ab.d-ab.z,bb.z+bb.d-ab.d-ab.z);}  const next={...position};for(const k of ['x','y','z'] as const){let diff=tolerance;for(const v of candidates[k])if(v>=0&&Math.abs(position[k]-v)<diff){diff=Math.abs(position[k]-v);next[k]=v;}next[k]=Math.round(next[k]);}return next;
}



