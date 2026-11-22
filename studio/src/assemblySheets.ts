import {parts,type Module} from './model';
import {hardwareRows} from './kitchen';
import {projectErrors,type Project} from './project';

export type AssemblyView='axonometric'|'front'|'side';
const esc=(s:unknown)=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));

/** Assembly elevations use the finished panel envelopes. Labels are sorted along each margin. */
export function assemblySheet(m:Module,index:number,view:AssemblyView){
  const all=parts(m), panels=all.filter(d=>d.material!=='metal');
  const project=(x:number,y:number,z:number):[number,number]=>view==='front'?[x,-y]:view==='side'?[z,-y]:[.866*(x-z),.38*(x+z)-y];
  const geometry=panels.map((d,i)=>{
    const [w,h,z]=d.size,[cx,cy,cz]=d.position;
    const ay=(d.rotY??0)*Math.PI/180,az=(d.rotZ??0)*Math.PI/180;
    const points=Array.from({length:8},(_,k)=>{
      const x=((k & 1) ? 0.5 : -0.5)*w,y=((k & 2) ? 0.5 : -0.5)*h,depth=((k & 4) ? 0.5 : -0.5)*z;
      const rx=x*Math.cos(az)-y*Math.sin(az),ry=x*Math.sin(az)+y*Math.cos(az);
      return project(cx+rx*Math.cos(ay)+depth*Math.sin(ay),cy+ry,cz-rx*Math.sin(ay)+depth*Math.cos(ay));
    });
    return {d,no:i+1,points,center:project(cx,cy,cz),depth:view==='front'?cz:view==='side'?cx:cx+cz+cy*.75};
  });
  const allPoints=geometry.flatMap(item=>item.points);
  const minX=Math.min(0,...allPoints.map(p=>p[0])),maxX=Math.max(1,...allPoints.map(p=>p[0]));
  const minY=Math.min(0,...allPoints.map(p=>p[1])),maxY=Math.max(1,...allPoints.map(p=>p[1]));
  const drawingHeight=Math.max(340,panels.length*15+45),scale=Math.min(465/(maxX-minX),(drawingHeight-50)/(maxY-minY));
  const px=(x:number)=>310+(x-(minX+maxX)/2)*scale;
  const py=(y:number)=>drawingHeight/2+(y-(minY+maxY)/2)*scale;
  const items=geometry.map(item=>({...item,x:px(item.center[0]),y:py(item.center[1])}));
  const faces=[[0,1,3,2],[4,5,7,6],[0,4,6,2],[1,5,7,3],[0,1,5,4],[2,3,7,6]];
  const shapes=items.slice().sort((a,b)=>a.depth-b.depth).map(({d,points})=>{
    const outlines=faces.map((face,i)=>{
      const polygon=face.map(k=>px(points[k][0]).toFixed(2)+','+py(points[k][1]).toFixed(2)).join(' ');
      return `<polygon points="${polygon}" fill="${i===5?'#c9dce2':'#e3ecee'}" fill-opacity=".24" stroke="#526b76" stroke-width=".7"/>`;
    });
    return `<g><title>${esc(d.name)}</title>${outlines.join('')}</g>`;
  });
  const marks:string[]=[];
  for(const left of [true,false]){
    const side=items.filter(i=>(i.x<=310)===left).sort((a,b)=>a.y-b.y||a.no-b.no);
    const labelX=left?22:598;
    side.forEach((item,i)=>{
      const y=(i+1)*drawingHeight/(side.length+1), x=(item.x+(left?Math.min:Math.max)(...item.points.map(p=>px(p[0]))))/2;
      marks.push(`<path d="M${x} ${item.y} L${left?57:563} ${y} H${labelX}" stroke="#467381" fill="none"/><circle cx="${x}" cy="${item.y}" r="2" fill="#315863"/><circle cx="${labelX}" cy="${y}" r="9" fill="white" stroke="#315863"/><text x="${labelX}" y="${y+3.5}" text-anchor="middle" font-size="10">${item.no}</text>`);
    });
  }
  const hardware=hardwareRows(all);
  return `<section class="assembly"><h2>${index+1}. ${esc(m.name)}</h2><p>${m.width} × ${m.height} × ${m.depth} мм · 1 шт. · ${view==='front'?'Вид спереди':view==='side'?'Вид сбоку':'Аксонометрия'}</p><div class="assembly-columns"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 620 ${drawingHeight}" aria-label="Сборочная схема с номерами деталей">${shapes.join('')}${marks.join('')}</svg><div><table><thead><tr><th>Поз.</th><th>Деталь и материал</th><th>Размер, мм</th></tr></thead><tbody>${items.map(({d,no})=>`<tr><td>${no}</td><td>${esc(d.name)}<br><small>${esc(d.decor||d.material)}</small></td><td>${[d.length,d.width,d.thickness].map(n=>Math.round(n*10)/10).join(' × ')}</td></tr>`).join('')}</tbody></table>${hardware.length?`<h3>Фурнитура модели</h3><table><tbody>${hardware.map(([name,n])=>`<tr><td>${esc(name)}</td><td>${n} шт.</td></tr>`).join('')}</tbody></table>`:''}</div></div></section>`;
}
export const assemblyStyle='.assembly-columns{display:grid;grid-template-columns:minmax(0,1.2fr) minmax(0,1fr);gap:14px;align-items:start}.assembly svg{width:100%;height:auto}.assembly table{border-collapse:collapse;width:100%;font-size:12px}.assembly td,.assembly th{border:1px solid #c2ced3;padding:4px;text-align:left}.assembly th{background:#ecf3f5}.assembly small{color:#425660}';
export function assemblyHTML(p:Project,views:Record<string,AssemblyView>){
 const errors=projectErrors(p);if(errors.length)throw Error(errors[0]);
 return `<!doctype html><html lang="ru"><meta charset="utf-8"><title>Сборочные листы</title><style>body{font:14px Arial;color:#23323c}${assemblyStyle}@page{size:A4 landscape;margin:10mm}.assembly+.assembly{break-before:page}tr{break-inside:avoid}thead{display:table-header-group}@media print{.assembly table{font-size:9px}.assembly td,.assembly th{padding:2px}.assembly svg{max-height:165mm}}</style>${p.modules.map((a,i)=>assemblySheet(a.module,i,views[a.id]??'axonometric')).join('')}</html>`;
}
