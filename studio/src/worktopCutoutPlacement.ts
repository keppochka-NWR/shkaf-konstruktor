import {relocateCutoutRails,relocateCutoutRailsForEditing} from './cutoutRails';
import {validate,parts} from './model';
import {localToRoom,roomToLocal,type Project,type PlacedModule} from './project';
import {sinkChecks} from './sinkChecks';
export type CutPoint={x:number;z:number};
export function cutoutPositionIssue(project:Project,topId:string,index:number,point:CutPoint):string|null{
 let p=structuredClone(project);const top=p.modules.find(a=>a.id===topId);
 const c=top?.module.worktop?.cutouts[index];if(!top||!c)return 'Вырез не найден.';
 Object.assign(c,point);
 const issue=validate(top.module)[0];if(issue)return issue;
 // Cabinet collisions are warnings during positioning, not a lock preventing repair.

 return null;
}
export function cutoutSnapPoints(project:Project,top:PlacedModule,index:number,z:number){
 const c=top.module.worktop!.cutouts[index],points:{x:number;z:number;label:string}[]=[];
 const aligned=project.modules.filter(a=>a.id!==top.id&&a.module.kitchen&&Math.abs(((a.rotation??0)-(top.rotation??0))%360)<.01);
 const center=(a:PlacedModule)=>{const q=localToRoom(a,a.module.width/2,a.module.depth/2);return roomToLocal(top,q.x,q.z);};
 const lower=aligned.filter(a=>a.module.kitchen?.role==='base'&&Math.abs((a.y??0)+a.module.height-(top.y??0))<2).filter(a=>{const q=center(a);return q.z>=0&&q.z<=top.module.depth;}).sort((a,b)=>center(a).x-center(b).x);
 for(const a of aligned){
  const k=a.module.kitchen!,q=center(a);
  if(q.z<0||q.z>top.module.depth)continue;
  if(c.kind==='sink'&&k.appliance==='sink'&&lower.includes(a))points.push({x:q.x-c.width/2,z,label:'Центр тумбы: '+a.module.name});
  if(c.kind==='hob'&&(k.appliance==='hood'||lower.includes(a)))points.push({x:q.x-c.width/2,z,label:(k.appliance==='hood'?'Ось вытяжки: ':'Центр модуля: ')+a.module.name});
 }
 if(c.kind==='hob')for(let i=0;i<lower.length-1;i++){
  const a=lower[i],b=lower[i+1],qa=center(a),qb=center(b);
  if(Math.abs(qa.z-qb.z)>30||Math.abs((qb.x-b.module.width/2)-(qa.x+a.module.width/2))>5)continue;
  points.push({x:((qa.x-a.module.width/2)+(qb.x+b.module.width/2))/2-c.width/2,z,label:'Центр пары: '+a.module.name+' + '+b.module.name});
 }
 return points.filter(p=>!cutoutPositionIssue(project,top.id,index,p));
}

export function moveWorktopCutout(project:Project,topId:string,index:number,point:CutPoint):Project {
 const issue=cutoutPositionIssue(project,topId,index,point);if(issue)throw Error(issue);
 const p=structuredClone(project),top=p.modules.find(a=>a.id===topId)!;
 Object.assign(top.module.worktop!.cutouts[index],point);
 return relocateCutoutRailsForEditing(p,topId);
}
