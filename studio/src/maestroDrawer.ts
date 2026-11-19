import type {Module,Part} from './model';
import {axisLayout,axisFloor,axisCeiling,golaBand} from './kitchenDrawers';
export type MaestroDrawer={system:'maestro-7d';y0:number;y1:number;runnerY:number;hc:93|131|178;len:400|450|500;finish:'white'|'grey';color?:'white'|'anthracite';box?:undefined;h?:86|120|168|200;backH?:number;front?:number;faceScrews?:boolean};
export const isMaestro=(k:{system:string}):k is MaestroDrawer=>k.system==='maestro-7d';
export const maestroTop=(k:MaestroDrawer)=>k.runnerY+k.hc;
export function maestroFits(m:Module,k:MaestroDrawer){const [lo,hi]=golaBand(m,k.y0,k.y1);return k.len+3<=m.depth&&k.runnerY>=Math.max(axisFloor(m)+10,lo)&&maestroTop(k)<=Math.min(k.y1-14,axisCeiling(m)-5,hi);}
export function maestroLayout(m:Module,n:number,ratios?:number[],keep?:MaestroDrawer[]):MaestroDrawer[]{
 const len=([500,450,400] as const).find(l=>l+3<=m.depth)??400;
 return axisLayout(m,n,ratios).map((a,i)=>{
  const runnerY=Math.max(a.y0+37,axisFloor(m)+10,golaBand(m,a.y0,a.y1)[0]);
  const make=(hc:MaestroDrawer['hc']):MaestroDrawer=>({system:'maestro-7d',y0:a.y0,y1:a.y1,runnerY,hc,len,finish:keep?.[i]?.finish??keep?.[0]?.finish??'white'});
  return ([178,131,93] as const).map(make).find(k=>maestroFits(m,k))??make(93);
 });
}
/** Official sheet: bottom LW-17 x NL-10; back LW-38, 16mm board.
 * Metal is a dimension envelope, not a manufacturing mesh. */
export function maestroParts(m:Module,k:MaestroDrawer,j:number,x0:number,xr:number,F:number):Part[]{
 const id=`kd:${j}`,y=k.runnerY,out:Part[]=[];
 const part=(suffix:string,name:string,lo:number[],hi:number[],metal=false)=>{const size=hi.map((v,i)=>v-lo[i]) as [number,number,number];out.push({id:id+suffix,name,size,position:hi.map((v,i)=>(v+lo[i])/2) as [number,number,number],length:metal?Math.max(...size):size[0],width:metal?Math.min(size[1],size[2]):suffix===':bottom'?size[2]:size[1],thickness:metal?Math.min(...size):16,role:'drawer',material:metal?'metal':'board',decor:metal?'':m.decor,grain:'length',grainAxis:0,edge:[0,0,0,0]});};
 part(':bottom','Дно ящика МАЭСТРО 7D',[x0+8.5,y+3,F-k.len+10],[xr-8.5,y+19,F]);
 part(':back','Задняя стенка ящика МАЭСТРО 7D',[x0+19,y+19,F-k.len+10],[xr-19,y+k.hc,F-k.len+26]);
 for(const [side,x] of [['L',x0+8.5],['R',xr-19]] as const){
  part(':sys:side:'+side,`Боковина МАЭСТРО H${k.hc}`,[x,y,F-k.len+10],[x+10.5,y+k.hc,F],true);
  part(':slide:'+side,'Направляющая МАЭСТРО 7D',[x,y,F-k.len],[x+10.5,y+3,F-4],true);
 }
 return out;
}
