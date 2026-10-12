import type {Room,Opening} from './project';
export type WallPanel={wall:Opening['wall'];u:number;y:number;width:number;height:number};
/** Rectangular subdivision gives actual empty openings, even with several windows. */
export function wallPanels(room:Room):WallPanel[]{
  const result:WallPanel[]=[];
  for(const wall of ['back','left','right','front'] as const){
    const length=wall==='back'||wall==='front'?room.width:room.depth,os=(room.openings||[]).filter(o=>o.wall===wall);
    const xs=[...new Set([0,length,...os.flatMap(o=>[o.offset,o.offset+o.width])])].sort((a,b)=>a-b);
    const ys=[...new Set([0,room.height,...os.flatMap(o=>[o.sill,o.sill+o.height])])].sort((a,b)=>a-b);
    for(let x=1;x<xs.length;x++)for(let y=1;y<ys.length;y++){
      const u=(xs[x-1]+xs[x])/2,v=(ys[y-1]+ys[y])/2;
      if(!os.some(o=>u>o.offset&&u<o.offset+o.width&&v>o.sill&&v<o.sill+o.height))result.push({wall,u,y:v,width:xs[x]-xs[x-1],height:ys[y]-ys[y-1]});
    }
  }
  return result;
}
/** All coordinates in mm. Numerical tolerance is not an installation allowance. */
export const GEOMETRY_EPS = 1e-7;
export type Point2 = {x:number;z:number};
export function trig(degrees:number){
  const a=degrees*Math.PI/180;
  const clean=(n:number)=>Math.abs(n)<1e-14?0:Math.abs(Math.abs(n)-1)<1e-14?Math.sign(n):n;
  return {c:clean(Math.cos(a)),s:clean(Math.sin(a))};
}
/** Origin uses the lower corner of the rotated nominal bounding box, as in v3. */
export function transform(x:number,z:number,w:number,d:number,degrees:number,u:number,v:number):Point2{
  const {c,s}=trig(degrees),minX=Math.min(0,w*c)+Math.min(0,d*s),minZ=Math.min(0,-w*s)+Math.min(0,d*c);
  return {x:x-minX+u*c+v*s,z:z-minZ-u*s+v*c};
}
export function inverseTransform(x:number,z:number,w:number,d:number,degrees:number,px:number,pz:number):Point2{
  const origin=transform(x,z,w,d,degrees,0,0),{c,s}=trig(degrees),dx=px-origin.x,dz=pz-origin.z;
  return {x:dx*c-dz*s,z:dx*s+dz*c};
}
export function polygonBounds(points:Point2[]){const xs=points.map(p=>p.x),zs=points.map(p=>p.z);return{x:Math.min(...xs),z:Math.min(...zs),w:Math.max(...xs)-Math.min(...xs),d:Math.max(...zs)-Math.min(...zs)};}
export function convexOverlap(a:Point2[],b:Point2[],tolerance=.1){
  for(const poly of [a,b])for(let i=0;i<poly.length;i++){
    const p=poly[i],q=poly[(i+1)%poly.length],dx=q.x-p.x,dz=q.z-p.z,l=Math.hypot(dx,dz);if(l<GEOMETRY_EPS)continue;
    const projection=(r:Point2)=>(-dz*r.x+dx*r.z)/l,aa=a.map(projection),bb=b.map(projection);
    if(Math.max(...aa)<=Math.min(...bb)+tolerance||Math.max(...bb)<=Math.min(...aa)+tolerance)return false;
  }return true;
}
