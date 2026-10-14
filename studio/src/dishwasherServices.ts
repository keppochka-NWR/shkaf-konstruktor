import type {RoomWarning} from './roomWarnings';
import * as THREE from 'three';
import {localToRoom,overlap,type Project,type RoomObstacle,type PlacedModule} from './project';
import {parts} from './model';
export type Route={kind:'water'|'waste';points:[number,number,number][];radius:number};
export function dishwasherRoutes(o:RoomObstacle,modules:PlacedModule[]):Route[]{
 const a=modules.find(a=>a.id===o.sinkModuleId),c=a?.module.worktop?.cutouts.find(c=>c.fixture&&c.plumbing);if(!a||!c||(a.rotation??0)!==0)return [];
 const top=(a.y??0)+a.module.worktop!.thickness,cx=c.x+c.width/2,cz=(c.z??(a.module.depth-c.depth)/2)+c.depth/2,water=localToRoom(a,cx-60,0),drain=localToRoom(a,cx,cz),rear=localToRoom(a,0,0).z;
 const serviceZ=Math.min(o.z-20,rear+70),loop=top-130;
 if(serviceZ<10||loop<o.y+250)return [];
 return [{kind:'water',radius:6,points:[[water.x,top-300,water.z],[water.x,top-300,serviceZ],[water.x,o.y+150,serviceZ],[o.x+20,o.y+150,serviceZ],[o.x+20,o.y+150,o.z]]},{kind:'waste',radius:11,points:[[o.x+45,o.y+200,o.z],[o.x+45,o.y+200,serviceZ],[o.x+45,loop,serviceZ],[drain.x,loop,serviceZ],[drain.x,top-260,serviceZ],[drain.x,top-260,drain.z]]}];
}
export function dishwasherServiceModel(o:RoomObstacle,modules:PlacedModule[]){const group=new THREE.Group();for(const route of dishwasherRoutes(o,modules)){const mat=new THREE.MeshStandardMaterial({color:route.kind==='water'?0x397ba6:0x777f83,roughness:.55});for(let i=1;i<route.points.length;i++){const a=new THREE.Vector3(...route.points[i-1]),b=new THREE.Vector3(...route.points[i]),v=b.clone().sub(a);if(v.length()<.01)continue;const mesh=new THREE.Mesh(new THREE.CylinderGeometry(route.radius,route.radius,v.length(),12),mat);mesh.position.copy(a.add(b).multiplyScalar(.5));mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),v.normalize());group.add(mesh);}}return group;}
export function dishwasherServiceWarnings(p:Project){const out:RoomWarning[]=[];for(const o of p.room.obstacles??[]){if(o.type!=='dishwasher'||!o.sinkModuleId)continue;const routes=dishwasherRoutes(o,p.modules),warn=(message:string)=>out.push({moduleId:o.sinkModuleId!,obstacleId:o.id,kind:'dishwasher-services',message});if(!routes.length){warn('Посудомойка: подключение недоступно. Выберите мойку на прямой столешнице и оставьте место для трассы за техникой.');continue;}
 for(const route of routes){let length=0;for(let i=1;i<route.points.length;i++){const a=route.points[i-1],b=route.points[i],r=route.radius;length+=Math.hypot(...a.map((v,j)=>v-b[j]));const envelope={x:Math.min(a[0],b[0])-r,y:Math.min(a[1],b[1])-r,z:Math.min(a[2],b[2])-r,w:Math.abs(a[0]-b[0])+2*r,h:Math.abs(a[1]-b[1])+2*r,d:Math.abs(a[2]-b[2])+2*r};
 for(const m of p.modules)for(const part of parts(m.module).filter(x=>x.material==='board'||x.role==='door')){const corners=[[-1,-1],[1,-1],[1,1],[-1,1]].map(([x,z])=>localToRoom(m,part.position[0]+x*part.size[0]/2,part.position[2]+z*part.size[2]/2));const xs=corners.map(c=>c.x),zs=corners.map(c=>c.z);if(overlap(envelope,{x:Math.min(...xs),z:Math.min(...zs),y:(m.y??0)+part.position[1]-part.size[1]/2,w:Math.max(...xs)-Math.min(...xs),d:Math.max(...zs)-Math.min(...zs),h:part.size[1]}))warn('Шланг ПММ пересекает '+m.module.name+' / '+part.name);}}
 if(length>2500)warn('Трасса ПММ длиннее 2,5 м: сверьте допустимую длину с паспортом техники.');}}
 return out.filter((v,i,a)=>a.findIndex(x=>x.message===v.message)===i);}
