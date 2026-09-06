import type {Niche,CeilingType} from './measurement';
import {parts,id,initialModule,parseModule,validate,RULES,needsWallFiller,cornerStrip,type Module,section} from './model';
export type Opening={id:string;type:'window'|'door';wall:'back'|'left'|'right'|'front';offset:number;width:number;height:number;sill:number};
export type RoomObstacle={id:string;name:string;type:'column'|'beam'|'radiator';x:number;y:number;z:number;width:number;depth:number;height:number};
export const obstacleBounds=(o:RoomObstacle)=>({x:o.x,y:o.y,z:o.z,w:o.width,d:o.depth,h:o.height});
export type Room={width:number;depth:number;height:number;openings?:Opening[];obstacles?:RoomObstacle[];ceiling?:CeilingType};
export type PlacedModule={id:string;x:number;z:number;y?:number;rotation?:0|90|180|270;module:Module};
export type Project={version:3;measurement?:{number:string;date:string;notes:string;niche?:Niche};room:Room;modules:PlacedModule[];cloud?:{id:string;revision:number;owner:string;name?:string};calculation?:{markup:number;overrides:Record<string,number>;model?:'markup'|'sheet';sheetPrice?:number};offer?:{customer:string;price:string;notes:string}};
export function newProject(module=initialModule()):Project{return {version:3,room:{width:4000,depth:3000,height:2700,openings:[]},modules:[{id:id(),x:50,y:0,z:30,module}]};}
export function localToRoom(a:PlacedModule,u:number,v:number){const w=a.module.width,d=a.module.depth;switch(a.rotation??0){case 90:return{x:a.x+v,z:a.z+w-u};case 180:return{x:a.x+w-u,z:a.z+d-v};case 270:return{x:a.x+d-v,z:a.z+u};default:return{x:a.x+u,z:a.z+v};}}
export function roomToLocal(a:PlacedModule,x:number,z:number){const u=x-a.x,v=z-a.z;switch(a.rotation??0){case 90:return{x:a.module.width-v,z:u};case 180:return{x:a.module.width-u,z:a.module.depth-v};case 270:return{x:v,z:a.module.depth-u};default:return{x:u,z:v};}}
export function moduleCenter(a:PlacedModule){return localToRoom(a,a.module.width/2,a.module.depth/2);}
/** Вылет за боковину: угловая фальш 16, ФП торцом 16 + 5 к стене, стандартная ФП — её ширина. */
export function sideExtension(m:Module,side:'left'|'right'){if(m.sidePanels?.[side])return RULES.panel;if(m.cornerFiller===side)return cornerStrip(m)?0:RULES.panel;const w=m.wallFiller?.[side];if(!w)return 0;return RULES.panel+RULES.wallFillerEdgeGap;}
export function bounds(a:PlacedModule){const rear=!a.module.backType||a.module.backType==='nailed'?3:0;const cf=a.module.cornerFiller;const front=Math.max(a.module.depth+18,cf&&!cornerStrip(a.module)?a.module.depth+RULES.cornerFillerExtra:0);const points=[localToRoom(a,-sideExtension(a.module,'left'),-rear),localToRoom(a,a.module.width+sideExtension(a.module,'right'),front)];return{x:Math.min(...points.map(p=>p.x)),z:Math.min(...points.map(p=>p.z)),y:a.y??0,w:Math.abs(points[1].x-points[0].x),d:Math.abs(points[1].z-points[0].z),h:a.module.height};}
/** Габарит корпуса без фальшей — для поиска стыков и стен. */
function bodyBounds(a:PlacedModule){return bounds({...a,module:{...a.module,cornerFiller:undefined,wallFiller:undefined}});}
/**
 * Автоматические угловые фальши: если к боковине корпуса под 90° примыкает другой корпус (в пределах RULES.cornerSnap),
 * снаружи этой боковины ставится фальш-панель 16 мм глубиной корпус + 40, а корпус при необходимости отодвигается на её толщину.
 * Если стыка больше нет, фальш убирается. Вызывается перед проверкой проекта при каждом изменении.
 */
export function applyCornerFillers(p:Project):Project{return applyAutoFillers(p);}
/** Сдвиг корпуса вдоль его оси ширины на delta мм (delta>0 — вправо в локальных координатах). */
function shiftAlongWidth(a:PlacedModule,delta:number){const from=localToRoom(a,0,0),to=localToRoom(a,delta,0);a.x+=to.x-from.x;a.z+=to.z-from.z;}
/**
 * Автоматические фальши (регламент цеха по фальшпанелям + правило угла Макса):
 * — стык под 90°: снаружи боковины ставится угловая фальш 16 мм глубиной корпус + 40, корпус отодвигается на её толщину;
 * — боковина у стены при наличии фасадов/ящиков: планка торцом 100×16 (ширину менеджер может изменить), +5 мм к стене.
 * Корпус отодвигается от стены на вылет фальши. Если стык или стена больше не рядом — фальш убирается.
 */
export function applyAutoFillers(p:Project):Project{
  const n=structuredClone(p),t=RULES.panel,room=n.room;
  for(const a of n.modules){
    const rot=a.rotation??0;
    let corner:Module['cornerFiller'],kind:Module['cornerKind'];
    const perpendicular=(b:PlacedModule)=>b!==a&&Math.abs(((b.rotation??0)-rot+360)%360)%180===90;
    for(const side of ['left','right'] as const){
      const u=side==='left'?0:a.module.width,dir=side==='left'?-1:1;
      // 1) Фасад этого корпуса упирается в тело соседа: точка чуть внутри края фасада и на 15 мм перед ним лежит в соседе → планка из фасада.
      if(a.module.doors){
        const q0=localToRoom(a,u-dir*2,a.module.depth+18+2),q1=localToRoom(a,u-dir*2,a.module.depth+18+45);
        const probe={x:Math.min(q0.x,q1.x),z:Math.min(q0.z,q1.z),w:Math.abs(q1.x-q0.x)||1,d:Math.abs(q1.z-q0.z)||1,y:a.y??0,h:a.module.height};
        const hit=n.modules.find(b=>perpendicular(b)&&overlap(probe,bodyBounds(b)));
        if(hit){corner=side;kind='strip';break;}
      }
      // 2) Сосед примыкает к боковине: планка торцом с выступом 40.
      const p0=localToRoom(a,u,0),p1=localToRoom(a,u,a.module.depth),pOut=localToRoom(a,u+dir*RULES.cornerSnap,0);
      const strip={x:Math.min(p0.x,p1.x,pOut.x),z:Math.min(p0.z,p1.z,pOut.z),w:Math.max(p0.x,p1.x,pOut.x)-Math.min(p0.x,p1.x,pOut.x)||1,d:Math.max(p0.z,p1.z,pOut.z)-Math.min(p0.z,p1.z,pOut.z)||1,y:a.y??0,h:a.module.height};
      if(n.modules.some(b=>perpendicular(b)&&overlap(strip,bodyBounds(b)))){corner=side;kind='plank';break;}
    }
    const hadCorner=a.module.cornerFiller,hadKind=a.module.cornerKind;
    if(corner){a.module.cornerFiller=corner;a.module.cornerKind=kind;}else{delete a.module.cornerFiller;delete a.module.cornerKind;}
    if(corner&&kind==='plank'&&(hadCorner!==corner||hadKind!=='plank')){const b=bounds(a);for(const other of n.modules)if(other!==a&&overlap(b,bounds(other))){shiftAlongWidth(a,corner==='left'?t:-t);break;}}
    // Стены: боковина в пределах wallSnap от стены комнаты.
    const wf:Module['wallFiller']={};
    if(needsWallFiller(a.module))for(const side of ['left','right'] as const){
      if(corner===side)continue;
      const u=side==='left'?0:a.module.width,dir=side==='left'?-1:1;
      const face=localToRoom(a,u,a.module.depth/2),out=localToRoom(a,u+dir*10,a.module.depth/2);
      const nx=Math.sign(Math.round(out.x-face.x)),nz=Math.sign(Math.round(out.z-face.z));
      const dist=nx<0?face.x:nx>0?room.width-face.x:nz<0?face.z:room.depth-face.z;
      const allowance=sideExtension(a.module,side);
      if(dist>RULES.wallSnap+allowance)continue;
      const existing=a.module.wallFiller?.[side];
      wf[side]={kind:'edge',width:existing?.width??RULES.fillerStrip};
      const needed=sideExtension({...a.module,wallFiller:wf},side)-dist;
      if(needed>0){a.module.wallFiller={...a.module.wallFiller,[side]:wf[side]};shiftAlongWidth(a,side==='left'?needed:-needed);}
    }
    if(Object.keys(wf).length)a.module.wallFiller=wf;else delete a.module.wallFiller;
  }
  return n;
}
export function overlap(a:ReturnType<typeof bounds>,b:ReturnType<typeof bounds>){return a.x<b.x+b.w-0.1&&a.x+a.w>b.x+0.1&&a.y<b.y+b.h-0.1&&a.y+a.h>b.y+0.1&&a.z<b.z+b.d-0.1&&a.z+a.d>b.z+0.1;}
export function projectErrors(p:Project):string[]{
  const errors:string[]=[];
  if(p.measurement){const m=p.measurement;if(typeof m.number!=='string'||m.number.length>60||typeof m.notes!=='string'||m.notes.length>2000||typeof m.date!=='string'||(m.date!==''&&(!/^\d{4}-\d{2}-\d{2}$/.test(m.date)||!Number.isFinite(Date.parse(m.date))||new Date(m.date).toISOString().slice(0,10)!==m.date)))return ['Проверьте номер, дату и примечания замера.'];}

  if(p.measurement?.niche){const n=p.measurement.niche;if(![n.width,n.height,n.depth].every(v=>Number.isFinite(v)&&v>=500&&v<=20000)||!Number.isFinite(n.deviation)||n.deviation<0||n.deviation>300)return ['Проверьте минимальные размеры ниши и отклонение стены.'];}
  if(p.cloud&&(typeof p.cloud.id!=="string"||!/^[-A-Za-z0-9_]{1,64}$/.test(p.cloud.id)||!Number.isInteger(p.cloud.revision)||p.cloud.revision<1||typeof p.cloud.owner!=="string"||p.cloud.owner.length>120||(p.cloud.name!==undefined&&(typeof p.cloud.name!=="string"||p.cloud.name.length>100))))return ["Некорректная связь с кабинетом."];
  if(p.calculation&&((p.calculation.model!==undefined&&!['markup','sheet'].includes(p.calculation.model))||(p.calculation.sheetPrice!==undefined&&(!Number.isFinite(p.calculation.sheetPrice)||p.calculation.sheetPrice<5000||p.calculation.sheetPrice>100000))))return ['Проверьте модель цены и цену за лист (5 000–100 000 ₽).'];
  if(p.calculation&&(!Number.isFinite(p.calculation.markup)||p.calculation.markup<1||p.calculation.markup>10||!p.calculation.overrides||typeof p.calculation.overrides!=='object'||Array.isArray(p.calculation.overrides)||Object.keys(p.calculation.overrides).length>300||Object.values(p.calculation.overrides).some(v=>!Number.isFinite(v)||v<0||v>1e9)))return ['Проверьте цены и коэффициент сметы (от 1 до 10).'];
  if(p.offer&&(typeof p.offer.customer!=='string'||p.offer.customer.length>120||typeof p.offer.notes!=='string'||p.offer.notes.length>2000||typeof p.offer.price!=='string'||(p.offer.price!==''&&(!Number.isFinite(Number(p.offer.price))||Number(p.offer.price)<0||Number(p.offer.price)>1e12))))return ['Проверьте поля коммерческого предложения.'];
  if(!p.modules.length||p.modules.length>40)return ['В проекте должно быть от 1 до 40 модулей.'];
  if(new Set(p.modules.map(m=>m.id)).size!==p.modules.length)return ['Идентификаторы модулей повторяются.'];
  for(const v of [p.room.width,p.room.depth,p.room.height])if(!Number.isFinite(v)||v<500||v>20000)return ['Размеры помещения: от 500 до 20 000 мм.'];
  const obstacles=p.room.obstacles;
  if(obstacles!==undefined){
    if(!Array.isArray(obstacles)||obstacles.length>30)return ['Допустимо до 30 объектов замера.'];
    for(const o of obstacles)if(!o||typeof o.id!=='string'||!o.id||typeof o.name!=='string'||!o.name.trim()||o.name.length>80||!['column','beam','radiator'].includes(o.type)||![o.x,o.y,o.z,o.width,o.depth,o.height].every(Number.isFinite)||o.x<0||o.y<0||o.z<0||Math.min(o.width,o.depth,o.height)<10||o.x+o.width>p.room.width||o.z+o.depth>p.room.depth||o.y+o.height>p.room.height)return ['Объект замера «'+(typeof o?.name==='string'?o.name:'без названия')+'»: проверьте название, размеры и положение — он должен помещаться в комнате.'];
    if(new Set(obstacles.map(o=>o.id)).size!==obstacles.length)return ['Идентификаторы объектов замера повторяются.'];
  }
  if(p.room.openings&&(!Array.isArray(p.room.openings)||p.room.openings.length>30))return ['Допустимо до 30 окон и дверей.'];
  for(const [index,o] of (p.room.openings||[]).entries())if(!o||!['window','door'].includes(o.type)||!['back','left','right','front'].includes(o.wall)||typeof o.id!=='string'||!o.id.trim()||![o.offset,o.width,o.height,o.sill].every(Number.isFinite)||o.offset<0||o.width<200||o.height<200||o.sill<0||o.sill+o.height>p.room.height||o.offset+o.width>(o.wall==='back'||o.wall==='front'?p.room.width:p.room.depth))return ['Проём '+(index+1)+': проверьте параметры. Окно или дверь выходят за границы стены либо имеют некорректные данные.'];
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
  if(x.room.obstacles!==undefined){if(!Array.isArray(x.room.obstacles)||x.room.obstacles.length>30)throw Error('Неверные объекты замера.');p.room.obstacles=x.room.obstacles.map((o:any)=>({id:o?.id,name:o?.name,type:o?.type,x:o?.x,y:o?.y,z:o?.z,width:o?.width,depth:o?.depth,height:o?.height}));}
  for(const a of x.modules){if(!a||typeof a.id!=='string')throw Error('Некорректный модуль проекта.');const pos={id:a.id,x:a.x,z:a.z,y:a.y??0,...(a.rotation===undefined?{}:{rotation:a.rotation})};p.modules.push(...(x.version===2?legacyModules(a.module,pos):[{...pos,module:parseModule(a.module)}]));}
  if(x.measurement)p.measurement={number:x.measurement.number,date:x.measurement.date,notes:x.measurement.notes,...(x.measurement.niche===undefined?{}:{niche:{width:x.measurement.niche.width,height:x.measurement.niche.height,depth:x.measurement.niche.depth,deviation:x.measurement.niche.deviation}})};
  if(x.cloud)p.cloud={id:x.cloud.id,revision:x.cloud.revision,owner:x.cloud.owner,...(x.cloud.name===undefined?{}:{name:x.cloud.name})};
  if(x.calculation)p.calculation={markup:x.calculation.markup,overrides:x.calculation.overrides,...(x.calculation.model===undefined?{}:{model:x.calculation.model}),...(x.calculation.sheetPrice===undefined?{}:{sheetPrice:x.calculation.sheetPrice})};
  if(x.offer)p.offer={customer:x.offer.customer,price:x.offer.price,notes:x.offer.notes};const e=projectErrors(p);if(e.length)throw Error(e[0]);return p;
}
export function appendModule(p:Project,source:Module,anchor?:PlacedModule):Project{
  const n=structuredClone(p),module=structuredClone(source);module.sections.forEach(s=>s.id=id());module.name=`Модуль ${p.modules.length+1}`;
  const a:PlacedModule={id:id(),x:0,y:anchor?.y??0,z:0,rotation:anchor?.rotation??0,module},base=bounds(a);
  const moduleBounds=p.modules.map(bounds),occupied=[...moduleBounds,...(p.room.obstacles||[]).map(obstacleBounds)],preferredX=anchor?bounds(anchor).x+bounds(anchor).w:Math.max(...moduleBounds.filter(b=>b.y===0).map(b=>b.x+b.w),0),preferredZ=anchor?bounds(anchor).z:30;
  const xs=[preferredX,0,...occupied.flatMap(b=>[b.x+b.w,b.x-base.w,b.x]),p.room.width-base.w],zs=[preferredZ,30,0,...occupied.flatMap(b=>[b.z+b.d,b.z-base.d,b.z]),p.room.depth-base.d];
  for(const z of [...new Set(zs)])for(const x of [...new Set(xs)]){
    const box={...base,x,z};if(x<0||z<0||x+base.w>p.room.width||z+base.d>p.room.depth||base.y+base.h>p.room.height||occupied.some(b=>overlap(box,b)))continue;
    a.x=x-base.x;a.z=z-base.z;n.modules.push(a);return n;
  }
  // Keep the invalid candidate reviewable by the common commit validator.
  a.x=preferredX-base.x;a.z=preferredZ-base.z;n.modules.push(a);return n;
}
export function snapPlacement(p:Project,mid:string,position:{x:number;y:number;z:number},tolerance=35){
  const a=p.modules.find(a=>a.id===mid)!,ab=bounds({...a,x:0,z:0,y:0});const candidates={x:[-ab.x,p.room.width-ab.x-ab.w],y:[0],z:[-ab.z,p.room.depth-ab.z-ab.d]};
  for(const b of p.modules){if(b.id===mid)continue;const bb=bounds(b);candidates.x.push(bb.x-ab.x,bb.x+bb.w-ab.x,bb.x-ab.w-ab.x,bb.x+bb.w-ab.w-ab.x);candidates.y.push(b.y??0,(b.y??0)+b.module.height,(b.y??0)-a.module.height);candidates.z.push(bb.z-ab.z,bb.z+bb.d-ab.z,bb.z-ab.d-ab.z,bb.z+bb.d-ab.d-ab.z);}  const next={...position};for(const k of ['x','y','z'] as const){let diff=tolerance;for(const v of candidates[k])if(v>=0&&Math.abs(position[k]-v)<diff){diff=Math.abs(position[k]-v);next[k]=v;}next[k]=Math.round(next[k]);}return next;
}




export function closedModuleBounds(a:PlacedModule){
 const points=parts(a.module).filter(part=>part.role!=='fastener'&&part.role!=='light'&&!part.rotZ&&!part.rotY).flatMap(part=>[-1,1].flatMap(x=>[-1,1].flatMap(y=>[-1,1].map(z=>{const q=localToRoom(a,part.position[0]+x*part.size[0]/2,part.position[2]+z*part.size[2]/2);return {...q,y:(a.y??0)+part.position[1]+y*part.size[1]/2};}))));
 const x=Math.min(...points.map(p=>p.x)),y=Math.min(...points.map(p=>p.y)),z=Math.min(...points.map(p=>p.z));
 return {x,y,z,w:Math.max(...points.map(p=>p.x))-x,h:Math.max(...points.map(p=>p.y))-y,d:Math.max(...points.map(p=>p.z))-z};
}
export function compositionBounds(p:Project){return unionBounds(p.modules.map(closedModuleBounds));}
export function mountingCompositionBounds(p:Project){return unionBounds(p.modules.map(bounds));}
function unionBounds(bb:ReturnType<typeof bounds>[]){if(!bb.length)return {x:0,y:0,z:0,w:0,h:0,d:0};
 const x=Math.min(...bb.map(b=>b.x)),y=Math.min(...bb.map(b=>b.y)),z=Math.min(...bb.map(b=>b.z));
 return {x,y,z,w:Math.max(...bb.map(b=>b.x+b.w))-x,h:Math.max(...bb.map(b=>b.y+b.h))-y,d:Math.max(...bb.map(b=>b.z+b.d))-z};
}


export function snapComposition(p:Project,mid:string,position:{x:number;y:number;z:number},tolerance=35,ids?:readonly string[]){
 const a=p.modules.find(a=>a.id===mid);if(!a)return position;
 if(ids&&!ids.includes(mid))return snapPlacement(p,mid,position,tolerance);
 const moving=ids?p.modules.filter(a=>ids.includes(a.id)):p.modules;
 const b=mountingCompositionBounds({...p,modules:moving}),next={...position},sizes={x:b.w,y:b.h,z:b.d},limits={x:p.room.width,y:p.room.height,z:p.room.depth};
 for(const axis of ['x','y','z'] as const){const start=a[axis]??0,candidates=[start-b[axis],start+limits[axis]-b[axis]-sizes[axis]];let distance=tolerance;
  if(ids)for(const other of p.modules.filter(a=>!ids.includes(a.id))){const ob=bounds(other),size={x:ob.w,y:ob.h,z:ob.d}[axis];candidates.push(start+ob[axis]-b[axis],start+ob[axis]+size-b[axis],start+ob[axis]-b[axis]-sizes[axis],start+ob[axis]+size-b[axis]-sizes[axis]);}
  for(const candidate of candidates)if(Math.abs(candidate-position[axis])<distance){next[axis]=candidate;distance=Math.abs(candidate-position[axis]);}next[axis]=Math.round(next[axis]);}
 return next;
}

export function copyModuleGroup(p:Project,ids:readonly string[]):{project:Project;ids:string[]}{
 const selected=p.modules.filter(a=>ids.includes(a.id));
 if(!selected.length)throw Error('Отметьте корпуса для копирования.');
 return appendModuleGroup(p,selected,true);
}

export function appendModuleGroup(p:Project,selected:PlacedModule[],copyNames=false):{project:Project;ids:string[]}{
 if(!selected.length)throw Error('В шаблоне нет корпусов.');
 if(p.modules.length+selected.length>40)throw Error('После копирования будет больше 40 корпусов. Уменьшите группу.');
 const errors=projectErrors(p);if(errors.length)throw Error(errors[0]);
 const sourceErrors=projectErrors({version:3,room:{width:20000,depth:20000,height:20000},modules:selected});if(sourceErrors.length)throw Error(sourceErrors[0]);
 const copies=selected.map(a=>{const copy=structuredClone(a);copy.id=id();if(copyNames)copy.module.name=(copy.module.name.slice(0,72)+' · копия').slice(0,80);copy.module.sections.forEach(s=>s.id=id());return copy;});
 const group=mountingCompositionBounds({...p,modules:selected}),occupied=[...p.modules.map(bounds),...(p.room.obstacles||[]).map(obstacleBounds)];
 const xs=[group.x+group.w,0,...occupied.flatMap(b=>[b.x+b.w,b.x-group.w,b.x]),p.room.width-group.w];
 const zs=[copyNames?group.z:30,30,0,...occupied.flatMap(b=>[b.z+b.d,b.z-group.d,b.z]),p.room.depth-group.d];
 for(const z of [...new Set(zs)])for(const x of [...new Set(xs)]){
  const dx=x-group.x,dz=z-group.z,next=copies.map(a=>({...a,x:a.x+dx,z:a.z+dz})),bb=next.map(bounds);
  if(bb.some(b=>b.x<0||b.z<0||b.x+b.w>p.room.width||b.z+b.d>p.room.depth||b.y+b.h>p.room.height||occupied.some(o=>overlap(b,o))))continue;
  const project={...p,modules:[...p.modules,...next]};
  if(!projectErrors(project).length)return {project,ids:next.map(a=>a.id)};
 }
 throw Error('Для копии группы не найдено свободного места. Освободите место или измените замер помещения. Исходные корпуса сохранены.');
}
