import {parts,validate,RULES} from './model';
import {localToRoom,roomToLocal,type Project} from './project';
import {partCollisions} from './collisions';

/** Max, 16.11: below the upper drawer + 10 mm, otherwise rear rail top 200 mm below carcass top. */
export function relocateCutoutRails(project:Project,topId:string):Project{
 const p=structuredClone(project),top=p.modules.find(a=>a.id===topId);
 if(!top?.module.worktop)return p;
 for(const a of p.modules){
  const m=a.module;
  if(m.raw||m.bazis||m.kitchen?.role!=='base'||Math.abs((a.y??0)+m.height-(top.y??0))>2||Math.abs(((a.rotation??0)-(top.rotation??0))%360)>.01)continue;
  const q0=localToRoom(a,0,0),q1=localToRoom(a,m.width,m.depth),l=roomToLocal(top,q0.x,q0.z),r=roomToLocal(top,q1.x,q1.z);
  if(!top.module.worktop.cutouts.some(c=>{const z=c.z??(top.module.depth-c.depth)/2;return c.x<r.x&&c.x+c.width>l.x&&z<r.z&&z+c.depth>l.z;}))continue;
  if(m.topType!=='none')throw Error(m.name+': под вырезом сплошная крыша; требуется изменить конструкцию корпуса.');
  let upper=m.height-200,hasDrawer=false;
  if(m.kdrawers?.length){
   const i=m.kdrawers.reduce((best,d,j,ds)=>d.y1>ds[best].y1?j:best,0);
   const box=parts(m).filter(d=>d.id.startsWith('kd:'+i+':')&&!d.id.endsWith(':facade')&&d.role!=='handle');
   if(!box.length)throw Error(m.name+': не определён монтажный габарит верхнего ящика.');
   upper=Math.min(...box.map(d=>d.position[1]-d.size[1]/2))-10;hasDrawer=true;
  }else if(m.sections.some(s=>s.drawers>0))throw Error(m.name+': требуется проверить положение царг под ящиком этого типа.');
  const previous=m.rails??[],height=previous.find(r=>r.place==='rear-top')?.height??previous.find(r=>r.place==='front-top')?.height??RULES.railMin;
  const lower=previous.filter(r=>r.place.endsWith('bottom'));
  const rail=(place:'rear-top'|'front-top')=>({place,height,lay:'edge' as const,atTop:m.height-upper});
  m.rails=[...lower,rail('rear-top'),...(hasDrawer?[rail('front-top')]:[])];
  const error=validate(m)[0];if(error)throw Error(m.name+': '+error);
  const hit=partCollisions(parts(m),m).find(c=>[c.a,c.b].some(id=>/^rail:(rear|front)-top/.test(id)));
  if(hit)throw Error(m.name+': после переноса царга пересекает другую деталь; нужно изменить ящики или положение выреза.');
 }
 return p;
}

/** Preserve editable cut position if automatic rail relocation needs a manual construction decision. */
export function relocateCutoutRailsForEditing(p:Project,id:string):Project{try{return relocateCutoutRails(p,id);}catch{return p;}}
