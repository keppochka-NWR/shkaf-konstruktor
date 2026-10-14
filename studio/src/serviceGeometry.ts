import * as THREE from 'three';
export function tapModel():THREE.Group{
 const g=new THREE.Group(),mat=new THREE.MeshStandardMaterial({color:0xb2b9bf,metalness:.9,roughness:.2});
 const points=[new THREE.Vector3(0,-150,-95),new THREE.Vector3(0,70,-95),new THREE.Vector3(0,140,-50),new THREE.Vector3(0,140,60),new THREE.Vector3(0,100,95)];
 const mesh=new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points),36,10,12,false),mat);g.add(mesh);
 const base=new THREE.Mesh(new THREE.CylinderGeometry(25,25,20,24),mat);base.position.set(0,-150,-95);g.add(base);
 const handle=new THREE.Mesh(new THREE.BoxGeometry(10,50,10),mat);handle.position.set(18,-70,-95);g.add(handle);return g;
}
export function servicePipeModel(size:readonly number[],water:boolean,hot=false):THREE.Group{
 const g=new THREE.Group(),mat=new THREE.MeshStandardMaterial({color:water?(hot?0xb85242:0x3879ae):0xd2d6d4,roughness:.5});
 const add=(a:THREE.Vector3,b:THREE.Vector3,r:number)=>{const v=b.clone().sub(a),mesh=new THREE.Mesh(new THREE.CylinderGeometry(r,r,v.length(),16),mat);mesh.position.copy(a.clone().add(b).multiplyScalar(.5));mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),v.normalize());g.add(mesh);};
 if(water){const x=hot?30:-30;add(new THREE.Vector3(-x,size[1]/2,size[2]/2),new THREE.Vector3(x,-size[1]/2,size[2]/2),6);add(new THREE.Vector3(x,-size[1]/2,size[2]/2),new THREE.Vector3(x,-size[1]/2,-size[2]/2),6);}
 else add(new THREE.Vector3(0,0,-size[2]/2),new THREE.Vector3(0,0,size[2]/2),20);
 return g;
}
