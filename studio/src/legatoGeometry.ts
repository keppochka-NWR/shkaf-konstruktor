import * as THREE from 'three';
import type {Part} from './model';
import {legatoByArticle} from './legato';

/** Wire shelf and schematic mounting hardware inside the documented assembly envelope, millimetres. */
export function legatoModel(p:Part):THREE.Group {
  const item=legatoByArticle(p.legato!.article)!;
  const [w,h,d]=p.size,tilt=p.legato!.mount==='inclined',g=new THREE.Group();
  const material=new THREE.MeshStandardMaterial({color:item.color==='white'?0xf5f4ef:item.color==='black'?0x292a2d:0xbfc3c8,metalness:item.color==='chrome'?.85:.25,roughness:item.color==='chrome'?.23:.6});
  function rod(a:THREE.Vector3,b:THREE.Vector3,r=1.15){const v=b.clone().sub(a),mesh=new THREE.Mesh(new THREE.CylinderGeometry(r,r,v.length(),6),material);mesh.position.copy(a).add(b).multiplyScalar(.5);mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),v.normalize());mesh.castShadow=true;mesh.receiveShadow=true;g.add(mesh);}
  const backY=tilt?h/2-3:-h/2+2,frontY=-h/2+2,backZ=-d/2+2,frontZ=d/2-3;
  const vec=(x:number,y:number,z:number)=>new THREE.Vector3(x,y,z);
  for(const [y,z] of [[backY,backZ],[frontY,frontZ],[frontY+35,frontZ],[frontY+3,frontZ-50]])rod(vec(-w/2+2,y,z),vec(w/2-2,y,z));
  for(let x=-w/2+12.5;x<w/2;x+=25){rod(vec(x,backY,backZ),vec(x,frontY,frontZ),.75);rod(vec(x,frontY,frontZ),vec(x,frontY+35,frontZ),.75);}
  if(tilt)for(const x of [-w/2+Math.min(70,w/4),w/2-Math.min(70,w/4)]){
    rod(vec(x,backY-5,backZ+2),vec(x,-h/2+5,backZ+2),3);
    rod(vec(x,-h/2+5,backZ+2),vec(x,frontY+10,frontZ-40),3);
  }
  else for(const x of [-w/2+5,w/2-5]){const pocket=new THREE.Mesh(new THREE.BoxGeometry(10,20,20),material);pocket.position.set(x,frontY+10,frontZ-10);g.add(pocket);}
  const n=Math.max(2,Math.ceil(w/(tilt?245:280))+1);
  for(let i=0;i<n;i++){const clip=new THREE.Mesh(new THREE.BoxGeometry(6,6,4),material);clip.position.set(-w/2+3+(w-6)*i/(n-1),Math.min(h/2-3,backY+2),-d/2+2);g.add(clip);}
  return g;
}
