import {parts,type Part} from './model';
import {localToRoom,type PlacedModule} from './project';
import {UNDER_LIGHT_ID} from './kitchenUnderLight';

/** Extend matching LED segments to the shared cabinet boundary. External ends keep their setbacks. */
export function joinedUnderLightParts(a:PlacedModule,arrangement:PlacedModule[]):Part[]{
 const ps=parts(a.module),led=ps.find(p=>p.id===UNDER_LIGHT_ID);
 if(!led)return ps;
 let left=led.position[0]-led.size[0]/2,right=led.position[0]+led.size[0]/2;
 const point=(m:PlacedModule,x:number,z:number)=>localToRoom(m,x,z);
 const near=(u:{x:number;z:number},v:{x:number;z:number})=>Math.hypot(u.x-v.x,u.z-v.z)<0.5;
 for(const b of arrangement){
  if(b.id===a.id||!b.module.kitchen?.underLight||b.module.kitchen.role!=='wall')continue;
  if(((a.rotation??0)-(b.rotation??0))%360!==0||(a.module.lightType??'inset')!==(b.module.lightType??'inset')||(a.module.lightTone??'neutral')!==(b.module.lightTone??'neutral'))continue;
  const other=parts(b.module).find(p=>p.id===UNDER_LIGHT_ID);
  if(!other||Math.abs((a.y??0)+led.position[1]-(b.y??0)-other.position[1])>0.5||other.size[1]!==led.size[1]||other.size[2]!==led.size[2])continue;
  if(near(point(a,0,led.position[2]),point(b,b.module.width,other.position[2])))left=0;
  if(near(point(a,a.module.width,led.position[2]),point(b,0,other.position[2])))right=a.module.width;
 }
 return ps.map(p=>p===led?{...p,length:right-left,size:[right-left,p.size[1],p.size[2]],position:[(left+right)/2,p.position[1],p.position[2]]}:p);
}
