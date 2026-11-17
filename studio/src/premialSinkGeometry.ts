import * as THREE from 'three';
/** Dimensions from official 6045 drawing. Minor radii and drain fitting are schematic. */
export function premialSinkModel(size:[number,number,number]=[600,223,450],bowlSize:[number,number,number]=[556,220,356],offset=25,color=0x4b4c4a):THREE.Group {
 const [w,total,d]=size,[bw0,h,bd0]=bowlSize,bw=bw0-6,bd=bd0-6,t=3,top=total/2;
 const g=new THREE.Group(),steel=new THREE.MeshStandardMaterial({color,metalness:.65,roughness:.3});
 const add=(geo:THREE.BufferGeometry,x:number,y:number,z:number)=>{const m=new THREE.Mesh(geo,steel);m.position.set(x,y,z);m.castShadow=true;m.receiveShadow=true;g.add(m);};
 const shape=new THREE.Shape();shape.moveTo(-w/2,-d/2);shape.lineTo(w/2,-d/2);shape.lineTo(w/2,d/2);shape.lineTo(-w/2,d/2);shape.closePath();
 const hole=new THREE.Path();hole.moveTo(-bw/2,offset-bd/2);hole.lineTo(-bw/2,offset+bd/2);hole.lineTo(bw/2,offset+bd/2);hole.lineTo(bw/2,offset-bd/2);hole.closePath();shape.holes.push(hole);
 const rim=new THREE.ExtrudeGeometry(shape,{depth:t,bevelEnabled:false});rim.rotateX(Math.PI/2);add(rim,0,top,0);
 for(const x of [-bw/2-t/2,bw/2+t/2])add(new THREE.BoxGeometry(t,h,bd+2*t),x,top-t-h/2,offset);
 for(const z of [offset-bd/2-t/2,offset+bd/2+t/2])add(new THREE.BoxGeometry(bw,h,t),0,top-t-h/2,z);
 add(new THREE.BoxGeometry(bw,1.5,bd),0,top-t-h+0.75,offset);
 const drain=new THREE.Mesh(new THREE.CylinderGeometry(44,44,2,32),new THREE.MeshStandardMaterial({color:0x333333,metalness:.8,roughness:.2}));drain.position.set(0,top-t-h+2,offset);g.add(drain);
 return g;
}
export function layoutDrainModel(height:number):THREE.Group{
 const g=new THREE.Group(),mat=new THREE.MeshStandardMaterial({color:0xe7e9e5,roughness:.55});
 const add=(r:number,h:number,y:number)=>{const m=new THREE.Mesh(new THREE.CylinderGeometry(r,r,h,24),mat);m.position.y=y;g.add(m);};
 add(20,height-70,35);add(45,70,-height/2+35);add(26,12,-height/2+76);
 return g;
}
