import * as THREE from 'three';
/** Dimensions from official 6045 drawing. Minor radii and drain fitting are schematic. */
export function premialSinkModel():THREE.Group {
 const g=new THREE.Group(),steel=new THREE.MeshStandardMaterial({color:0x4b4c4a,metalness:.65,roughness:.3});
 const add=(geo:THREE.BufferGeometry,x:number,y:number,z:number)=>{const m=new THREE.Mesh(geo,steel);m.position.set(x,y,z);m.castShadow=true;m.receiveShadow=true;g.add(m);return m;};
 const s=new THREE.Shape();s.moveTo(-300,-225);s.lineTo(300,-225);s.lineTo(300,225);s.lineTo(-300,225);s.closePath();
 const bowl=new THREE.Path();bowl.moveTo(-275,-150);bowl.lineTo(-275,200);bowl.lineTo(275,200);bowl.lineTo(275,-150);bowl.closePath();s.holes.push(bowl);
 for(const x of [0,245]){const h=new THREE.Path();h.absarc(x,-187.5,x===0?17.5:14,0,Math.PI*2,true);s.holes.push(h);}
 const rim=new THREE.ExtrudeGeometry(s,{depth:3,bevelEnabled:false});rim.rotateX(Math.PI/2);add(rim,0,111.5,0);
 // Closed individual sheets: visible inside, solid back-face culled outside.
 for(const x of [-276.5,276.5])add(new THREE.BoxGeometry(3,220,356),x,-1.5,25);
 for(const z of [-151.5,201.5])add(new THREE.BoxGeometry(550,220,3),0,-1.5,z);
 const bottom=new THREE.Shape();bottom.moveTo(-275,-150);bottom.lineTo(275,-150);bottom.lineTo(275,200);bottom.lineTo(-275,200);bottom.closePath();
 const drain=new THREE.Path();drain.absarc(0,25,45,0,Math.PI*2,true);bottom.holes.push(drain);
 const base=new THREE.ExtrudeGeometry(bottom,{depth:1.5,bevelEnabled:false});base.rotateX(Math.PI/2);add(base,0,-110,0);
 const strainer=new THREE.Mesh(new THREE.TorusGeometry(44,2,8,40),new THREE.MeshStandardMaterial({color:0xa3a3a3,metalness:.8,roughness:.2}));strainer.rotation.x=Math.PI/2;strainer.position.set(0,-108.5,25);g.add(strainer);
 return g;
}
export function layoutDrainModel(height:number):THREE.Group{
 const g=new THREE.Group(),mat=new THREE.MeshStandardMaterial({color:0xe7e9e5,roughness:.55});
 const add=(r:number,h:number,y:number)=>{const m=new THREE.Mesh(new THREE.CylinderGeometry(r,r,h,24),mat);m.position.y=y;g.add(m);};
 add(20,height-70,35);add(45,70,-height/2+35);add(26,12,-height/2+76);
 return g;
}
