import * as THREE from 'three';
import type {Part} from './model';

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
