import {memo,useMemo} from 'react';
import {parts,type Module} from './model';
import {localToRoom,type PlacedModule} from './project';

type Point=[number,number,number];
const project=([x,y,z]:Point)=>[(x-z)*.866,(x+z)*.5-y];
export const LibraryPreview=memo(function LibraryPreview({module,group}:{module:Module;group?:PlacedModule[]}){
 const drawing=useMemo(()=>{
  const bodies=group??[{id:'preview',x:0,y:0,z:0,module}];
  const faces:{points:Point[];depth:number;color:string}[]=[];
  for(const a of bodies){
   const ps=bodies.length>8?[{size:[a.module.width,a.module.height,a.module.depth],position:[a.module.width/2,a.module.height/2,a.module.depth/2],role:'body',material:'board',id:'body'}]:parts(a.module).filter(p=>p.role!=='door'&&p.id!=='back'&&p.role!=='hinge'&&p.role!=='handle'&&p.role!=='light'&&p.role!=='fastener'&&!p.id.includes(':slide:'));
   for(const p of ps){
    const corners:Point[]=[];for(const dx of [-1,1])for(const dy of [-1,1])for(const dz of [-1,1]){const q=localToRoom(a,p.position[0]+dx*p.size[0]/2,p.position[2]+dz*p.size[2]/2);corners.push([q.x,(a.y??0)+p.position[1]+dy*p.size[1]/2,q.z]);}
    const [x,y,z]=[0,1,2].map(i=>Math.min(...corners.map(q=>q[i]))),[X,Y,Z]=[0,1,2].map(i=>Math.max(...corners.map(q=>q[i])));
    const shade=p.material==='metal'?['#75848d','#a1afb6','#8d9ba4']:p.id.endsWith(':facade')?['#e5e9ec','#fafbfc','#f4f6f8']:['#b8a68c','#e6d7bf','#d5c1a2'];
    const visible:Point[][]=[[[X,y,z],[X,Y,z],[X,Y,Z],[X,y,Z]],[[x,Y,z],[x,Y,Z],[X,Y,Z],[X,Y,z]],[[x,y,Z],[X,y,Z],[X,Y,Z],[x,Y,Z]]];
    visible.forEach((points,i)=>faces.push({points,depth:points.reduce((n,q)=>n+q[0]+q[2]+q[1]*.001,0)/4,color:shade[i]}));
   }
  }
  faces.sort((a,b)=>a.depth-b.depth);const points=faces.flatMap(f=>f.points.map(project));
  const xs=points.map(p=>p[0]),ys=points.map(p=>p[1]),x=Math.min(...xs),y=Math.min(...ys),w=Math.max(...xs)-x,h=Math.max(...ys)-y,pad=Math.max(w,h)*.06;
  return {faces,viewBox:[x-pad,y-pad,w+2*pad,h+2*pad].join(' ')};
 },[module,group]);
 return <svg className="library-preview" viewBox={drawing.viewBox} role="img" aria-label={group&&group.length>8?'Схема расположения группы: '+group.length+' корпусов':'Схема наполнения: распашные фасады и задники скрыты'}>{drawing.faces.map((f,i)=><polygon key={i} points={f.points.map(p=>project(p).join(',')).join(' ')} fill={f.color} stroke="#78848b" strokeWidth=".5" vectorEffect="non-scaling-stroke"/>)}</svg>;
});
