import {closedModuleBounds,closedModuleCorners,type Project} from './project';
/** Contact and overlap in the actual rotated footprint; distant units and stacked units with a gap are separate. */
export function connectedModuleIds(project:Project, seeds:string[]):string[]{
 const boxes=project.modules.map(m=>({id:m.id,b:closedModuleBounds(m),poly:closedModuleCorners(m)}));
 const touches=(a:typeof boxes[number],b:typeof boxes[number])=>{
  const eps=.5;
  if(a.b.y+a.b.h < b.b.y-eps || b.b.y+b.b.h<a.b.y-eps)return false;
  for(const polygon of [a.poly,b.poly])for(let i=0;i<polygon.length;i++){
   const q=polygon[i],r=polygon[(i+1)%polygon.length],dx=r.x-q.x,dz=r.z-q.z,length=Math.hypot(dx,dz);if(!length)continue;
   const axis={x:-dz/length,z:dx/length},pa=a.poly.map(p=>p.x*axis.x+p.z*axis.z),pb=b.poly.map(p=>p.x*axis.x+p.z*axis.z);
   if(Math.max(...pa)<Math.min(...pb)-eps||Math.max(...pb)<Math.min(...pa)-eps)return false;
  }return true;
 };
 const selected=new Set(seeds.filter(id=>boxes.some(b=>b.id===id))),queue=boxes.filter(b=>selected.has(b.id));
 for(let i=0;i<queue.length;i++)for(const other of boxes)if(!selected.has(other.id)&&touches(queue[i],other)){selected.add(other.id);queue.push(other);}
 return project.modules.filter(m=>selected.has(m.id)).map(m=>m.id);
}
export type SelectionIsolation={ids:string[];part?:{mid:string;pid:string}};
