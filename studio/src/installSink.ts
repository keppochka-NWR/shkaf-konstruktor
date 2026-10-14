import {id,validate} from './model';
import {kitchenWorktop} from './kitchen';
import {localToRoom,roomToLocal,type Project} from './project';
/** One undoable installation; preserve existing surfaces and other cutouts. */
export function installSink(project:Project,cabinetId:string):Project {
 const p=structuredClone(project),a=p.modules.find(a=>a.id===cabinetId);
 if(!a||a.module.kitchen?.appliance!=='sink')throw Error('Выберите тумбу под мойку.');
 if(a.module.width<600||a.module.depth<500)throw Error('PRODIGY 6045: нужна тумба шириной от 600 и глубиной от 500 мм.');
 const center=localToRoom(a,a.module.width/2,a.module.depth/2);
 const tops=p.modules.filter(t=>t.module.worktop&&Math.abs((t.y??0)-(a.y??0)-a.module.height)<1);
 let t=tops.find(t=>{const q=roomToLocal(t,center.x,center.z);return q.x>0&&q.x<t.module.width&&q.z>0&&q.z<t.module.depth;});
 if(!t){
  const m=kitchenWorktop(a.module,a.module.width);delete m.kitchen;delete m.kdrawers;delete m.gola;
  m.depth=Math.max(600,a.module.depth+40);m.sections=m.sections.map(s=>({...s,shelves:[],drawers:0,rod:false}));
  t={id:id(),x:a.x,z:a.z,y:(a.y??0)+a.module.height,rotation:a.rotation,module:m};
  const before=localToRoom(a,0,0),after=localToRoom(t,0,0);t.x+=before.x-after.x;t.z+=before.z-after.z;p.modules.push(t);
 }
 const q=roomToLocal(t,center.x,center.z),cuts=t.module.worktop!.cutouts;
 const existing=cuts.find(c=>c.kind==='sink'&&Math.abs(c.x+c.width/2-q.x)<a.module.width/2);
 if(existing?.fixture==='210245')return p;
 const cut={kind:'sink' as const,x:q.x-280,z:q.z-180+25,width:560,depth:360,fixture:'210245',drainDrop:420,tap:true,plumbing:true};
 if(existing)Object.assign(existing,cut);else cuts.push(cut);
 const errors=validate(t.module);if(errors.length)throw Error(errors[0]);return p;
}
