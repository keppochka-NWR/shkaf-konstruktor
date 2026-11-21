import {vernissageLayout,vernissageMilling} from '../src/facadesVernissage';
import {offsetContour,type Feature,type P} from '../src/vernissageGeometry';

/** SVG projection of the actual Studio layout. All coordinates remain in millimetres. */
export function drawing(id:string,w:number,h:number,t:number,open:'solid'|'glass'|'grille'='solid') {
 const milling=vernissageMilling(id);
 if(!milling||![w,h,t].every(n=>Number.isFinite(n)&&n>0))return null;
 const L=vernissageLayout({milling:id,cover:'film',thickness:t as 19,open},w,h,t);
 const n=(x:number)=>String(Math.round(x*10000)/10000);
 const path=(c:P[])=>c.length?'M'+c.map(([x,y])=>n(x+w/2)+','+n(h/2-y)).join('L')+'Z':'';
 const poly=(c:P[],attrs:string)=>`<path d="${path(c)}" ${attrs}/>`;
 const stroke='stroke="#3b342d" stroke-opacity=".35" stroke-width=".6" vector-effect="non-scaling-stroke"';
 let markup='';
 const profile=(f:Feature)=>{
  for(let i=1;i<f.path.length;i++){
   const outer=offsetContour(f.c,f.path[i-1][0]),inner=offsetContour(f.c,f.path[i][0]);
   const dz=f.path[i][1]-f.path[i-1][1];
   if(Math.abs(dz)>.001)markup+=`<path d="${path(outer)} ${path(inner)}" fill-rule="evenodd" fill="${dz<0?'#000':'#fff'}" opacity="${Math.min(.24,.08+Math.abs(dz)*.025)}"/>`;
  }
  const outer=offsetContour(f.c,f.path[0][0]),inner=offsetContour(f.c,f.path.at(-1)![0]);
  markup+=poly(outer,`fill="none" ${stroke}`);
  markup+=poly(inner,f.through?`fill="#cfe0e6" fill-opacity=".8" ${stroke}`:`fill="none" ${stroke}`);
  for(const child of f.kids??[])profile(child);
 };
 profile(L.root);
 if(L.rails)for(const [a,b] of L.rails.grooves){
  const c:P[]=L.rails.dir==='v'?[[a,-h/2],[b,-h/2],[b,h/2],[a,h/2]]:[[-w/2,a],[w/2,a],[w/2,b],[-w/2,b]];
  markup+=poly(c,`fill="#000" fill-opacity=".16" ${stroke}`);
 }
 if(L.handle)markup+=poly([[-w/2,L.handle.y0],[w/2,L.handle.y0],[w/2,L.handle.y1],[-w/2,L.handle.y1]],`fill="#000" fill-opacity=".18" ${stroke}`);
 for(const bar of L.bars)markup+=poly([[bar.x0,bar.y0],[bar.x1,bar.y0],[bar.x1,bar.y1],[bar.x0,bar.y1]],`fill="#fff" fill-opacity=".4" ${stroke}`);
 return {markup,notes:[milling.shapeNote,...L.notes],frame:L.frame,opening:L.opening,rails:L.rails,layout:L};
}
