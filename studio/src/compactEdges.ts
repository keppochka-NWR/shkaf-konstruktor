import type {BufferGeometry} from 'three';

/** Large faces use the decor; every other triangle, including cutout walls, uses the core. */
export function compactMaterialGroups(geometry:BufferGeometry,thicknessAxis:0|1|2){
 const normals=geometry.getAttribute('normal');
 const index=geometry.getIndex(),count=index?.count??normals.count;
 geometry.clearGroups();
 let start=0,last=-1;
 for(let i=0;i<count;i+=3){
  const component=(j:number)=>Math.abs(normals.getComponent(index?index.getX(j):j,thicknessAxis));
  const material=component(i)>.99&&component(i+1)>.99&&component(i+2)>.99?0:1;
  if(material!==last){if(last!==-1)geometry.addGroup(start,i-start,last);start=i;last=material;}
 }
 if(last!==-1)geometry.addGroup(start,count-start,last);
}
