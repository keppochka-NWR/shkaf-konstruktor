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

/** Боковина с вырезами Gola (kitchen.ts golaSides): контур в плоскости Z–Y со скруглениями внутренних углов, выдавлен на толщину по X;
 *  UV пласти — как у прямоугольной панели (длина по grainAxis), чтобы декор лёг так же. */
export function golaSideGeometry(part:Part):THREE.BufferGeometry{
 const [t,H,D]=part.size,zf=D/2,yt=H/2,s=new THREE.Shape();
 // в форме ось X = −Z детали (после поворота вокруг Y на +90° она станет +Z), ось Y = Y
 const P=(z:number,y:number):[number,number]=>[-z,y];
 const mv=(z:number,y:number)=>s.moveTo(...P(z,y)),ln=(z:number,y:number)=>s.lineTo(...P(z,y));
 const qc=(cz:number,cy:number,z:number,y:number)=>{const [a,b]=P(cz,cy),[c,d]=P(z,y);s.quadraticCurveTo(a,b,c,d);};
 const cuts=[...(part.golaCuts??[])].sort((a,b)=>b.top1-a.top1);
 mv(-zf,-yt);ln(zf,-yt);
 let openTop=false;
 for(const c of cuts){
  const ya=yt-c.top1,yb=yt-c.top0,zi=zf-c.depth,r=Math.max(0,Math.min(c.r,c.depth/2,(yb-ya)/2));
  ln(zf,ya);ln(zi+r,ya);if(r>0)qc(zi,ya,zi,ya+r);
  if(c.top0<=0.01){ln(zi,yt);openTop=true;break;}
  ln(zi,yb-r);if(r>0)qc(zi,yb,zi+r,yb);ln(zf,yb);
 }
 if(!openTop)ln(zf,yt);
 ln(-zf,yt);s.closePath();
 const g=new THREE.ExtrudeGeometry(s,{depth:t,bevelEnabled:false,curveSegments:6});
 g.translate(0,0,-t/2);g.rotateY(Math.PI/2);
 const pos=g.getAttribute('position'),normal=g.getAttribute('normal'),uv=g.getAttribute('uv');
 const L=part.grainAxis,W=L===1?2:1;
 for(let i=0;i<pos.count;i++)if(Math.abs(normal.getX(i))>.99)uv.setXY(i,pos.getComponent(i,W)/part.size[W]+.5,pos.getComponent(i,L)/part.size[L]+.5);
 uv.needsUpdate=true;g.computeBoundingBox();return g;
}

/** Фигурная вертикальная деталь по контуру Базиса: тонкая по Z — контур (x, y), тонкая по X — контур (y, z); выдавлена на толщину.
 *  Текстура на пластях — по габариту детали, как у прямоугольной панели. */
export function faceContourGeometry(part:Part):THREE.BufferGeometry{
 const [sx,sy,sz]=part.size,thinX=sx<=sz,shape=new THREE.Shape();
 const pt=([a,b]:[number,number]):[number,number]=>thinX?[-(b-sz/2),a-sy/2]:[a-sx/2,b-sy/2];
 part.faceContour!.forEach((p,i)=>{const [u,v]=pt(p);if(i===0)shape.moveTo(u,v);else shape.lineTo(u,v);});
 shape.closePath();const t=thinX?sx:sz,g=new THREE.ExtrudeGeometry(shape,{depth:t,bevelEnabled:false});
 g.translate(0,0,-t/2);if(thinX)g.rotateY(Math.PI/2);
 const pos=g.getAttribute('position'),normal=g.getAttribute('normal'),uv=g.getAttribute('uv'),ax=thinX?0:2,w=thinX?sz:sx,wa=thinX?2:0;
 for(let i=0;i<pos.count;i++){if(Math.abs(normal.getComponent(i,ax))>.99)uv.setXY(i,pos.getComponent(i,wa)/w+.5,pos.getY(i)/sy+.5);else uv.setXY(i,0,0);}
 uv.needsUpdate=true;return g;
}

/** Боковина с вырезом в заднем верхнем углу (kitchen.ts rearNotches, Базис k32): контур в плоскости Z–Y, выдавлен на толщину по X. */
export function rearNotchSideGeometry(part:Part):THREE.BufferGeometry{
 const [t,H,D]=part.size,zf=D/2,yt=H/2,n=part.rearNotch!,s=new THREE.Shape();
 const P=(z:number,y:number):[number,number]=>[-z,y]; // как в golaSideGeometry: ось X формы = −Z детали
 const pts:[number,number][]=[[-zf,-yt],[zf,-yt],[zf,yt],[-zf+n.depth,yt],[-zf+n.depth,yt-n.height],[-zf,yt-n.height]];
 pts.forEach(([z,y],i)=>i?s.lineTo(...P(z,y)):s.moveTo(...P(z,y)));s.closePath();
 const g=new THREE.ExtrudeGeometry(s,{depth:t,bevelEnabled:false});
 g.translate(0,0,-t/2);g.rotateY(Math.PI/2);
 const pos=g.getAttribute('position'),normal=g.getAttribute('normal'),uv=g.getAttribute('uv');
 const L=part.grainAxis,W=L===1?2:1;
 for(let i=0;i<pos.count;i++)if(Math.abs(normal.getX(i))>.99)uv.setXY(i,pos.getComponent(i,W)/part.size[W]+.5,pos.getComponent(i,L)/part.size[L]+.5);
 uv.needsUpdate=true;g.computeBoundingBox();return g;
}

/** Панель в плоскости XY с вырезами в обоих верхних углах (ХДФ кухонь Базиса k33/k34): контур выдавлен на толщину по Z. */
export function topNotchGeometry(part:Part):THREE.BufferGeometry{
 const [w,h,t]=part.size,n=part.topNotches!,s=new THREE.Shape(),X=w/2,Y=h/2;
 const pts:[number,number][]=[[-X,-Y],[X,-Y],[X,Y-n.height],[X-n.width,Y-n.height],[X-n.width,Y],[-X+n.width,Y],[-X+n.width,Y-n.height],[-X,Y-n.height]];
 pts.forEach(([x,y],i)=>i?s.lineTo(x,y):s.moveTo(x,y));s.closePath();
 const g=new THREE.ExtrudeGeometry(s,{depth:t,bevelEnabled:false});g.translate(0,0,-t/2);g.computeBoundingBox();return g;
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
