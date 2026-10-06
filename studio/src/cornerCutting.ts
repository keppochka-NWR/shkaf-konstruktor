import {parts,type Part} from './model';
import {projectErrors,type Project} from './project';
import {packRectangles,type Packed} from './packing';
import {catalog} from './catalog';

export type Point=[number,number];
export type CutPiece={key:string;code:string;module:string;part:Part;length:number;width:number;contour?:Point[];area:number;edge04:number;edge2:number;rotate:boolean};
export type CutSheet={material:string;decor:string;thickness:number;width:number;height:number;items:(Packed&{piece:CutPiece;rotated:boolean})[]};
export type CutResult={pieces:CutPiece[];sheets:CutSheet[];margin:number;gap:number;netArea:number;blankArea:number;sheetArea:number;edge04:number;edge2:number};
const r=(n:number)=>Math.round(n*1000)/1000;
export const mm=(n:number)=>String(Math.round(n*10)/10).replace('.',',');
export const esc=(s:string)=>s.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
export function area(poly:Point[]):number{return Math.abs(poly.reduce((s,p,i)=>{const q=poly[(i+1)%poly.length];return s+p[0]*q[1]-q[0]*p[1];},0))/2;}
/** Convex CCW polygons only. Offset each edge inwards by its own edge-band thickness. */
export function inset(poly:Point[],bands:number[]):Point[]{
 if(poly.length<3||bands.length!==poly.length)throw Error('Некорректный контур кромления.');
 const lines=poly.map((a,i)=>{const b=poly[(i+1)%poly.length],dx=b[0]-a[0],dy=b[1]-a[1],len=Math.hypot(dx,dy);if(!len||bands[i]<0)throw Error('Некорректная грань.');return {a:[a[0]-dy/len*bands[i],a[1]+dx/len*bands[i]] as Point,d:[dx,dy] as Point};});
 const points=lines.map((q,i)=>{const p=lines[(i+lines.length-1)%lines.length],cross=p.d[0]*q.d[1]-p.d[1]*q.d[0];if(Math.abs(cross)<1e-9)throw Error('Вырожденный контур.');const dx=q.a[0]-p.a[0],dy=q.a[1]-p.a[1],t=(dx*q.d[1]-dy*q.d[0])/cross;return [p.a[0]+t*p.d[0],p.a[1]+t*p.d[1]] as Point;});
 const x0=Math.min(...points.map(p=>p[0])),z0=Math.min(...points.map(p=>p[1]));
 return points.map(([x,z])=>[r(x-x0),r(z-z0)]);
}
export function cutting(project:Project):CutResult{
 const errors=projectErrors(project);if(errors.length)throw Error(errors[0]);
 const margin=10,gap=10,pieces:CutPiece[]=[];
 project.modules.forEach((m,mi)=>{
  let index=0;
  for(const part of parts(m.module).filter(p=>p.material==='board'||p.material==='hdf')){
   index++;const contour=part.planContour?inset(part.planContour,part.contourEdges!):undefined;
   const length=contour?Math.max(...contour.map(p=>p[0])):r(part.length-part.edge[0]-part.edge[1]);
   const width=contour?Math.max(...contour.map(p=>p[1])):r(part.width-part.edge[2]-part.edge[3]);
   const edges=part.planContour?part.planContour.map((a,i)=>({len:Math.hypot(a[0]-part.planContour![(i+1)%part.planContour!.length][0],a[1]-part.planContour![(i+1)%part.planContour!.length][1]),band:part.contourEdges![i]})):[{len:part.width,band:part.edge[0]},{len:part.width,band:part.edge[1]},{len:part.length,band:part.edge[2]},{len:part.length,band:part.edge[3]}];
   if(length<=0||width<=0)throw Error('Кромка превышает размер детали.');
   // Unknown materials stay grain-locked. Only documented solid colours may rotate.
   const decor=catalog.find(d=>d.n===part.decor),rotate=part.material==='hdf'||decor?.cat==='Однотонные'||part.decor==='Белый';
   pieces.push({key:m.id+'/'+part.id,code:`${mi+1}.${index}`,module:m.module.name,part,length,width,contour,area:contour?area(contour):length*width,edge04:edges.filter(e=>e.band===.4).reduce((s,e)=>s+e.len,0)/1000,edge2:edges.filter(e=>e.band===2).reduce((s,e)=>s+e.len,0)/1000,rotate});
  }
 });
 const groups=new Map<string,CutPiece[]>();
 for(const p of pieces){const key=[p.part.material,p.part.material==='hdf'?'ХДФ белый':p.part.decor,p.part.thickness].join('|');groups.set(key,[...(groups.get(key)??[]),p]);}
 const sheets:CutSheet[]=[];
 for(const group of groups.values()){
  const p=group[0],hdf=p.part.material==='hdf',width=hdf?2070:1830,height=hdf?2800:2750;
  const rects=group.map(p=>({id:p.key,w:p.width,h:p.length,rot:p.rotate}));let best:Packed[][]|undefined;
  // Also test the initial orientation: two 1048 mm backs do not fit side by side,
  // but two 2005 x 1048 backs fit one above another after a permitted rotation.
  for(const turn of [false,true])for(const order of ['area','height','width'] as const)for(const fit of ['short','area'] as const){
   const input=rects.map(r=>turn&&r.rot?{...r,w:r.h,h:r.w}:r);
   const trial=packRectangles(input,width-2*margin,height-2*margin,gap,order,fit);
   const used=(a:Packed[][])=>a.at(-1)!.reduce((s,i)=>Math.max(s,i.y+i.h),0);
   if(!best||trial.length<best.length||(trial.length===best.length&&used(trial)<used(best)))best=trial;
  }
  for(const bin of best!)sheets.push({material:hdf?'ХДФ':'ЛДСП',decor:hdf?'ХДФ белый':p.part.decor,thickness:p.part.thickness,width,height,items:bin.map(item=>{const piece=group.find(q=>q.key===item.id)!;return {...item,x:item.x+margin,y:item.y+margin,piece,rotated:Math.abs(item.w-piece.width)>.01};})});
 }
 const result={pieces,sheets,margin,gap,netArea:pieces.reduce((s,p)=>s+p.area,0)/1e6,blankArea:pieces.reduce((s,p)=>s+p.length*p.width,0)/1e6,sheetArea:sheets.reduce((s,p)=>s+p.width*p.height,0)/1e6,edge04:pieces.reduce((s,p)=>s+p.edge04,0),edge2:pieces.reduce((s,p)=>s+p.edge2,0)};
 verifyCutting(result);return result;
}
export function verifyCutting(result:CutResult){
 const seen=new Set<string>();
 for(const s of result.sheets)for(const a of s.items){
  if(seen.has(a.id))throw Error('Деталь размещена дважды.');seen.add(a.id);
  if(a.x<result.margin-1e-4||a.y<result.margin-1e-4||a.x+a.w>s.width-result.margin+.01||a.y+a.h>s.height-result.margin+.01)throw Error('Деталь выходит за рабочее поле листа.');
  if(a.rotated&&!a.piece.rotate)throw Error('Нарушено направление текстуры.');
  for(const b of s.items)if(a!==b&&a.x<b.x+b.w+result.gap-.01&&a.x+a.w+result.gap-.01>b.x&&a.y<b.y+b.h+result.gap-.01&&a.y+a.h+result.gap-.01>b.y)throw Error('Нарушен промежуток между заготовками.');
 }
 if(seen.size!==result.pieces.length||result.pieces.some(p=>!seen.has(p.key)))throw Error('Не все детали размещены.');
}
export function sheetPolygon(item:CutSheet['items'][number]):Point[]{
 const p=item.piece,poly=p.contour??[[0,0],[p.length,0],[p.length,p.width],[0,p.width]];
 return poly.map(([x,z])=>item.rotated?[item.x+p.length-x,item.y+z]:[item.x+z,item.y+x]);
}
export const pieceColor=(p:CutPiece)=>p.part.material==='hdf'?'#d7dcd6':({body:'#e8dcc4',shelf:'#cdded5',drawer:'#ccdfef',door:'#ded1e3'} as Record<string,string>)[p.part.role]??'#e8dcc4';
export function sheetSVG(sheet:CutSheet,index:number){
 return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-20 -20 ${sheet.width+40} ${sheet.height+40}" role="img" aria-label="Лист ${index+1}"><rect width="${sheet.width}" height="${sheet.height}" fill="#fff" stroke="#56635c" stroke-width="4"/>${sheet.items.map(a=>{
  const poly=sheetPolygon(a),small=Math.min(a.w,a.h)<110,fs=small?26:42;
  return `<g><title>${esc(a.piece.code+' · '+a.piece.part.name+' · '+mm(a.piece.length)+' × '+mm(a.piece.width))}</title><rect x="${a.x}" y="${a.y}" width="${a.w}" height="${a.h}" fill="#f2f2f0" stroke="#b0b3b1" stroke-dasharray="10 8" stroke-width="2"/><polygon points="${poly.map(p=>p.join(',')).join(' ')}" fill="${pieceColor(a.piece)}" stroke="#394d46" stroke-width="2"/><text x="${a.x+a.w/2}" y="${a.y+a.h/2}" fill="#1d332b" text-anchor="middle" dominant-baseline="central" font-family="Arial,sans-serif" font-size="${fs}" ${small&&a.w<a.h?`transform="rotate(-90 ${a.x+a.w/2} ${a.y+a.h/2})"`:''}>${a.piece.code}</text></g>`;
 }).join('')}</svg>`;
}
export function cutCSV(result:CutResult){
 const q=(s:unknown)=>'"'+String(s).replace(/"/g,'""')+'"';
 return '\ufeff'+[['Код','Узел','Деталь','Материал','Толщина','Длина готовая','Ширина готовая','Длина заготовки','Ширина заготовки','Кромка 0,4 м','Кромка 2 м','Контур заготовки X,Z мм','Лист'],...result.pieces.map(p=>[p.code,p.module,p.part.name,p.part.material==='hdf'?'ХДФ белый':p.part.decor,p.part.thickness,p.part.length,p.part.width,mm(p.length),mm(p.width),mm(p.edge04),mm(p.edge2),p.contour?JSON.stringify(p.contour):'Прямоугольник',result.sheets.findIndex(s=>s.items.some(a=>a.id===p.key))+1])].map(row=>row.map(q).join(';')).join('\r\n');
}
export function cuttingHTML(result:CutResult,notes:string[],title='Угловой шкаф · раскрой'){
 return `<!doctype html><html lang="ru"><meta charset="utf-8"><title>${esc(title)}</title><style>body{font:14px Arial;color:#25372f;max-width:1050px;margin:30px auto}h1{font-size:28px}p,li{line-height:1.5}.sheet{page-break-before:always;break-inside:avoid}svg{width:340px;height:auto;float:left;margin-right:24px}table{border-collapse:collapse;width:100%;font-size:11px}th,td{border:1px solid #ccd3cf;padding:6px;text-align:left}.map-list{width:calc(100% - 370px)}.sheet:after{content:'';display:block;clear:both}small{color:#627168}@media print{body{margin:0}.sheet svg{width:46%}.map-list{width:50%}button{display:none}@page{size:A4;margin:12mm}}@media(max-width:650px){svg{float:none;width:100%}.map-list{width:100%}}</style><button onclick="print()">Печать / сохранить PDF</button><h1>${esc(title)}</h1><p>Предварительно · текущие размеры и наполнение. ${result.pieces.length} деталей, ${result.sheets.filter(s=>s.material==='ЛДСП').length} листа ЛДСП + ${result.sheets.filter(s=>s.material==='ХДФ').length} листа ХДФ.</p><p>Заготовки после вычета кромки. Поле ${result.margin} мм; промежуток ${result.gap} мм. Это карта размещения заготовок, не последовательность резов и не УП. Штриховая рамка — резерв под фигурную деталь. Кромка дана без запаса.</p><ol>${notes.map(n=>`<li>${esc(n)}</li>`).join('')}</ol>${result.sheets.map((s,i)=>`<section class="sheet"><h2>Лист ${i+1} · ${esc(s.material+' '+s.decor)} · ${s.thickness} мм</h2><p>${s.height} × ${s.width} мм · ${s.items.length} деталей</p>${sheetSVG(s,i)}<table class="map-list"><thead><tr><th>Код</th><th>Деталь</th><th>Заготовка, мм</th></tr></thead><tbody>${s.items.map(a=>`<tr><td>${a.piece.code}</td><td>${esc(a.piece.part.name)}</td><td>${mm(a.piece.length)} × ${mm(a.piece.width)}</td></tr>`).join('')}</tbody></table></section>`).join('')}<section class="sheet"><h2>Ведомость деталей</h2><table><thead><tr><th>Код</th><th>Деталь</th><th>Готовая деталь</th><th>Заготовка</th><th>Кромка 0,4 / 2, м</th></tr></thead><tbody>${result.pieces.map(p=>`<tr><td>${p.code}</td><td>${esc(p.part.name)}</td><td>${mm(p.part.length)} × ${mm(p.part.width)}</td><td>${mm(p.length)} × ${mm(p.width)}</td><td>${mm(p.edge04)} / ${mm(p.edge2)}</td></tr>`).join('')}</tbody></table></section></html>`;
}
