import * as THREE from 'three';
import type {Part} from './model';

export function planContourGeometry(part:Part):THREE.BufferGeometry{
 const [w,t,d]=part.size,shape=new THREE.Shape();
 part.planContour!.forEach(([x,z],i)=>{if(i===0)shape.moveTo(x-w/2,z-d/2);else shape.lineTo(x-w/2,z-d/2);});
 shape.closePath();const g=new THREE.ExtrudeGeometry(shape,{depth:t,bevelEnabled:false});
 g.translate(0,0,-t/2);g.rotateX(Math.PI/2);
 const pos=g.getAttribute('position'),normal=g.getAttribute('normal'),uv=g.getAttribute('uv');
 for(let i=0;i<pos.count;i++)if(Math.abs(normal.getY(i))>.99)uv.setXY(i,pos.getZ(i)/d+.5,pos.getX(i)/w+.5);
 uv.needsUpdate=true;return g;
}

/** Рамка алюминиевого фасада: контур фасада с прямоугольным вырезом под вставку, выдавленный на толщину рамки. */
export function aluFrameGeometry(part:Part,face:number):THREE.BufferGeometry{
 const [w,h,t]=part.size,f=Math.min(face,w/2-1,h/2-1);
 const shape=new THREE.Shape();shape.moveTo(-w/2,-h/2);shape.lineTo(w/2,-h/2);shape.lineTo(w/2,h/2);shape.lineTo(-w/2,h/2);shape.closePath();
 const hole=new THREE.Path();hole.moveTo(-w/2+f,-h/2+f);hole.lineTo(w/2-f,-h/2+f);hole.lineTo(w/2-f,h/2-f);hole.lineTo(-w/2+f,h/2-f);hole.closePath();shape.holes.push(hole);
 const geometry=new THREE.ExtrudeGeometry(shape,{depth:t,bevelEnabled:false});geometry.translate(0,0,-t/2);return geometry;
}
/** Трапеция (фасад или задник под скосом): низ ровный, верх по высотам taper[0] слева и taper[1] справа; выдавлена на толщину. */
export function taperGeometry(part:Part):THREE.BufferGeometry{
 const [w,h,t]=part.size,[hL,hR]=part.taper!;
 const shape=new THREE.Shape();shape.moveTo(-w/2,-h/2);shape.lineTo(w/2,-h/2);shape.lineTo(w/2,-h/2+hR);shape.lineTo(-w/2,-h/2+hL);shape.closePath();
 const g=new THREE.ExtrudeGeometry(shape,{depth:t,bevelEnabled:false});g.translate(0,0,-t/2);return g;
}
/** Трапеция в плане (дно, крыша, полка при скосе фронта): задняя грань прямая, передняя — от глубины taperZ[0] слева до taperZ[1] справа. */
export function planTaperGeometry(part:Part):THREE.BufferGeometry{
 const [w,t,dmax]=part.size,[dL,dR]=part.taperZ!,rear=-dmax/2;
 const shape=new THREE.Shape();shape.moveTo(-w/2,rear);shape.lineTo(w/2,rear);shape.lineTo(w/2,rear+dR);shape.lineTo(-w/2,rear+dL);shape.closePath();
 const g=new THREE.ExtrudeGeometry(shape,{depth:t,bevelEnabled:false});g.translate(0,0,-t/2);g.rotateX(Math.PI/2);return g;
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
