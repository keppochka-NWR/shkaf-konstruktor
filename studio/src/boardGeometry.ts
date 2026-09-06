import * as THREE from 'three';
import type {Part} from './model';

/** Рамка алюминиевого фасада: контур фасада с прямоугольным вырезом под вставку, выдавленный на толщину рамки. */
export function aluFrameGeometry(part:Part,face:number):THREE.BufferGeometry{
 const [w,h,t]=part.size,f=Math.min(face,w/2-1,h/2-1);
 const shape=new THREE.Shape();shape.moveTo(-w/2,-h/2);shape.lineTo(w/2,-h/2);shape.lineTo(w/2,h/2);shape.lineTo(-w/2,h/2);shape.closePath();
 const hole=new THREE.Path();hole.moveTo(-w/2+f,-h/2+f);hole.lineTo(w/2-f,-h/2+f);hole.lineTo(w/2-f,h/2-f);hole.lineTo(-w/2+f,h/2-f);hole.closePath();shape.holes.push(hole);
 const geometry=new THREE.ExtrudeGeometry(shape,{depth:t,bevelEnabled:false});geometry.translate(0,0,-t/2);return geometry;
}
/** Keep the image's vertical grain aligned with the cut-list length on board faces. */
export function boardGeometry(part:Part):THREE.BoxGeometry{
 const geometry=new THREE.BoxGeometry(...part.size);
 if(part.material!=='board')return geometry;
 const lengthAxis=part.grainAxis,thicknessAxis=part.size.findIndex((v,i)=>i!==lengthAxis&&Math.abs(v-part.thickness)<1e-6);
 if(thicknessAxis<0)return geometry;
 const widthAxis=[0,1,2].find(i=>i!==lengthAxis&&i!==thicknessAxis)!;
 const position=geometry.getAttribute('position'),normal=geometry.getAttribute('normal'),uv=geometry.getAttribute('uv');
 for(let i=0;i<position.count;i++){
  if(Math.abs(normal.getComponent(i,thicknessAxis))<.99)continue;
  uv.setXY(i,position.getComponent(i,widthAxis)/part.size[widthAxis]+.5,position.getComponent(i,lengthAxis)/part.size[lengthAxis]+.5);
 }
 uv.needsUpdate=true;return geometry;
}
