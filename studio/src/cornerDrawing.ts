import {parts,type Module,type Part} from './model';
type P=[number,number];
const esc=(s:string)=>s.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
function hull(points:P[]):P[]{
 const p=points.sort((a,b)=>a[0]-b[0]||a[1]-b[1]),cross=(a:P,b:P,c:P)=>(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]);
 const half=(p:P[])=>{const h:P[]=[];for(const v of p){while(h.length>1&&cross(h[h.length-2],h[h.length-1],v)<=0)h.pop();h.push(v);}h.pop();return h;};
 return [...half(p),...half([...p].reverse())];
}
function vertices(p:Part):[number,number,number][]{
 const poly=p.planContour??[[0,0],[p.size[0],0],[p.size[0],p.size[2]],[0,p.size[2]]],a=(p.rotY??0)*Math.PI/180;
 return [-1,1].flatMap(sign=>poly.map(([u,v])=>{const x=u-p.size[0]/2,z=v-p.size[2]/2;return [p.position[0]+x*Math.cos(a)+z*Math.sin(a),p.position[1]+sign*p.size[1]/2,p.position[2]-x*Math.sin(a)+z*Math.cos(a)] as [number,number,number];}));
}
/** Orthographic projections of the same part vertices used in the editor, without rectangularizing shaped shelves. */
export function cornerDrawingSVG(m:Module){
 const c=m.corner!,all=parts(m).filter(p=>p.material!=='hdf'&&p.role!=='door'&&p.role!=='handle'&&p.role!=='fastener'),frontScale=Math.min(360/m.height,350/(m.width*Math.SQRT2)),planScale=290/m.width;
 const text=(x:number,y:number,s:string)=>`<text x="${x}" y="${y}" text-anchor="middle" font-size="13">${esc(s)}</text>`;
 const poly=(p:Part,plan=false)=>{
  const points=hull(vertices(p).map(([x,y,z])=>plan?[550+x*planScale,115+z*planScale]:[255+(x-z)/Math.SQRT2*frontScale,490-y*frontScale]));
  return `<polygon data-part="${esc(p.id)}" points="${points.map(p=>p.join(',')).join(' ')}" fill="${p.role==='drawer'?'#d4e4ee':p.role==='shelf'?'#d7e5d9':'#ece5d6'}" fill-opacity="${plan?.18:.35}" stroke="#526976" stroke-width=".8"><title>${esc(p.name)}</title></polygon>`;
 };
 const diagonal=Math.round(Math.SQRT2*(m.width-c.sideDepth)*10)/10;
 return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 920 630" role="img" aria-label="Угловой корпус: диагональный вид и план" style="width:100%;background:white;font-family:Arial;color:#253d48">
 ${text(255,42,'По диагонали · двери и задники скрыты')}${text(695,42,'План сверху · контуры деталей')}
 ${all.map(p=>poly(p)).join('')}${all.map(p=>poly(p,true)).join('')}
 <path d="M55 490H45V${490-m.height*frontScale}H55" fill="none" stroke="#526976"/>
 <text x="30" y="${490-m.height*frontScale/2}" transform="rotate(-90 30 ${490-m.height*frontScale/2})" text-anchor="middle" font-size="14">${m.height} мм</text>
 ${text(695,94,'Сторона А: '+m.width+' мм')}${text(695,450,'Сторона Б: '+m.depth+' мм')}${text(695,475,'Боковины: '+c.sideDepth+' мм')}${text(695,500,'Диагональ корпуса: '+diagonal+' мм')}
 ${text(460,550,'Высоты полок, ящиков и штанги — в таблице элементов под схемой.')}
 ${text(460,582,'Схема по геометрии редактора. Просветы и открывание уточнить по фурнитуре.')}
 ${text(460,607,'Размеры в мм. Присадки и управляющие программы не заданы.')}</svg>`;
}
