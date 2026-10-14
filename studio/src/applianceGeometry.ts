import * as THREE from 'three';
import type {RoomObstacle} from './project';
/** Adjustable layout assets. No brand, factory mounting holes or invented article numbers. */
export function applianceModel(o:RoomObstacle,open=false):THREE.Group|undefined {
 if(!['fridge','dishwasher','hood','hob'].includes(o.type))return;
 const g=new THREE.Group(),w=o.width,h=o.height,d=o.depth;
 const steel=new THREE.MeshStandardMaterial({color:0xa6aaad,metalness:.65,roughness:.32});
 const white=new THREE.MeshStandardMaterial({color:0xe7e7e0,roughness:.4});
 const black=new THREE.MeshStandardMaterial({color:0x202427,metalness:.2,roughness:.2});
 const box=(a:number,b:number,c:number,x:number,y:number,z:number,mat:THREE.Material)=>{const mesh=new THREE.Mesh(new THREE.BoxGeometry(a,b,c),mat);mesh.position.set(x,y,z);mesh.userData.obstacleId=o.id;mesh.castShadow=true;mesh.receiveShadow=true;g.add(mesh);return mesh;};
 if(o.type==='fridge'){
  box(w,h,d-30,0,0,-15,white);
  const doors=new THREE.Group();doors.position.set(w/2,0,d/2-30);g.add(doors);
  const leaf=(a:THREE.Mesh)=>{g.remove(a);a.position.sub(doors.position);doors.add(a);};
  leaf(box(w-4,h*.32-4,12,0,-h*.34,d/2-24,white));leaf(box(w-4,h*.68-4,12,0,h*.16,d/2-24,white));
  for(const y of [-h*.2,h*.15])leaf(box(10,Math.min(280,h*.2),18,-w*.4,y,d/2-9,steel));
  if(open)doors.rotation.y=Math.PI/2;
 }else if(o.type==='dishwasher'){
  box(w-4,h-10,d-22,0,0,-11,steel);const before=g.children.length;
  box(w-4,h-55,20,0,-22,d/2-10,white);
  box(w-4,45,20,0,h/2-24,d/2-10,steel);box(w*.4,16,8,0,h/2-76,d/2-4,black);
  box(55,15,2,w*.22,h/2-24,d/2-1,black);
  if(open){const leaf=new THREE.Group();leaf.position.set(0,-h/2+10,d/2-20);const moving=g.children.slice(before);for(const a of moving){g.remove(a);a.position.sub(leaf.position);leaf.add(a);}leaf.rotation.x=Math.PI/2;g.add(leaf);}
 }else if(o.type==='hood'){
  box(w,55,d,0,-h/2+27.5,0,steel);box(w*.46,h-55,d*.55,0,27.5,-d*.225,steel);
  box(w*.7,3,d*.68,0,-h/2+1.5,0,black);
 }else{
  box(w,h,d,0,0,0,black);
  for(const x of [-w*.25,w*.25])for(const z of [-d*.25,d*.25]){const mesh=new THREE.Mesh(new THREE.TorusGeometry(Math.min(w,d)*.15,1.5,8,40),steel);mesh.rotation.x=Math.PI/2;mesh.position.set(x,h/2-1.5,z);mesh.userData.obstacleId=o.id;g.add(mesh);}
 }
 return g;
}
