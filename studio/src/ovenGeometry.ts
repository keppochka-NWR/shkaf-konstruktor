import * as THREE from 'three';
/** Generic oven: body, steel fascia, black glazed door, two knobs, screen and bar handle. */
export function ovenModel(open=false):THREE.Group {
 const g=new THREE.Group(),door=new THREE.Group();door.position.set(0,-297.5,237.5);g.add(door);
 const steel=new THREE.MeshStandardMaterial({color:0xa4a8ac,metalness:.75,roughness:.32});
 const black=new THREE.MeshStandardMaterial({color:0x141719,metalness:.25,roughness:.22});
 const glass=new THREE.MeshStandardMaterial({color:0x243035,metalness:.5,roughness:.12});
 const box=(w:number,h:number,d:number,x:number,y:number,z:number,mat:THREE.Material)=>{const a=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),mat);a.position.set(x,y,z);a.castShadow=true;a.receiveShadow=true;g.add(a);return a;};
 const leaf=(a:THREE.Object3D)=>{g.remove(a);a.position.sub(door.position);door.add(a);};
 box(550,570,530,0,-12.5,-27.5,steel);
 leaf(box(594,480,20,0,-57.5,247.5,black));
 box(594,112,20,0,241.5,247.5,steel);
 leaf(box(470,320,2,0,-57.5,258.5,glass));
 box(130,48,2,0,241.5,258.5,black);
 for(const x of [-170,170]){const a=new THREE.Mesh(new THREE.CylinderGeometry(20,20,14,32),steel);a.rotation.x=Math.PI/2;a.position.set(x,236,264.5);g.add(a);}
 for(const x of [-235,235])leaf(box(14,18,24,x,150,269.5,steel));
 leaf(box(484,18,14,0,150,285.5,steel));
 for(let i=0;i<5;i++)leaf(box(420,2,1,0,100-i*48,260,steel));
 if(open)door.rotation.x=Math.PI/2;
 return g;
}
