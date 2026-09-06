type V={x:number;y:number;z:number};
export function frameDistance(size:V,direction:V,aspect:number,fovDegrees:number,margin=1.1){
  const n=Math.hypot(direction.x,direction.y,direction.z),z={x:direction.x/n,y:direction.y/n,z:direction.z/n};
  const rn=Math.hypot(z.x,z.z),right=rn>1e-8?{x:z.z/rn,y:0,z:-z.x/rn}:{x:1,y:0,z:0};
  const up={x:z.y*right.z-z.z*right.y,y:z.z*right.x-z.x*right.z,z:z.x*right.y-z.y*right.x};
  const tanV=Math.tan(fovDegrees*Math.PI/360),tanH=tanV*aspect;
  let distance=0;
  for(const sx of [-1,1])for(const sy of [-1,1])for(const sz of [-1,1]){
    const p={x:sx*size.x/2,y:sy*size.y/2,z:sz*size.z/2};
    const dot=(v:V)=>p.x*v.x+p.y*v.y+p.z*v.z;
    distance=Math.max(distance,dot(z)+margin*Math.max(Math.abs(dot(right))/tanH,Math.abs(dot(up))/tanV));
  }
  return distance;
}

export function frameHeight(size:V,direction:V,aspect:number,margin=1.1){
  const n=Math.hypot(direction.x,direction.y,direction.z),z={x:direction.x/n,y:direction.y/n,z:direction.z/n};
  const rn=Math.hypot(z.x,z.z),right=rn>1e-8?{x:z.z/rn,y:0,z:-z.x/rn}:{x:1,y:0,z:0};
  const up={x:z.y*right.z,y:z.z*right.x-z.x*right.z,z:-z.y*right.x};
  const span=(v:V)=>Math.abs(v.x)*size.x+Math.abs(v.y)*size.y+Math.abs(v.z)*size.z;
  return margin*Math.max(span(up),span(right)/aspect);
}
