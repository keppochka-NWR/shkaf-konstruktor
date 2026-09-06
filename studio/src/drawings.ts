import {parts,boxes,type Module,type Part} from './model';
import {projectErrors,type Project} from './project';
const esc=(s:unknown)=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
const mm=(v:number)=>Math.round(v*10)/10;
export function drawingLevels(m:Module){return parts(m).filter(d=>d.role==='shelf'||d.role==='rod'||d.id.endsWith(':facade')).map((d,index)=>{
  const section=m.sections.findIndex(s=>s.id===d.sectionId),base=boxes(m)[section]?.bottom??0;
  return {mark:index+1,id:d.id,name:d.name,section:section+1,bottom:mm(d.position[1]-d.size[1]/2),top:mm(d.position[1]+d.size[1]/2),center:mm(d.position[1]),fromOpening:mm(d.position[1]-base)};
});}
export function moduleDrawingSVG(m:Module){
  const all=parts(m),levels=drawingLevels(m),scale=Math.min(440/m.height,280/m.width,220/m.depth),base=530,front=95,side=575;
  const txt=(x:number,y:number,value:unknown,anchor='middle')=>`<text x="${x}" y="${y}" text-anchor="${anchor}" font-size="13" fill="#23323c">${esc(value)}</text>`;
  const line=(x1:number,y1:number,x2:number,y2:number)=>`<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="#667d88" stroke-width="1"/>`;
  function horizontal(x:number,y:number,length:number,label:string){return line(x,y,x+length*scale,y)+line(x,y-5,x,y+5)+line(x+length*scale,y-5,x+length*scale,y+5)+txt(x+length*scale/2,y-8,label);}
  function shape(d:Part,profile:boolean){const axis=profile?2:0,x=(profile?side:front)+(d.position[axis]-d.size[axis]/2)*scale,y=base-(d.position[1]+d.size[1]/2)*scale;
    const fill=profile?'none':d.role==='body'?'#e5ebef':d.id.endsWith(':facade')?'#f2f5f7':d.role==='shelf'?'#dbe5eb':'none';
    return `<rect data-part="${esc(d.id)}" x="${x}" y="${y}" width="${d.size[axis]*scale}" height="${d.size[1]*scale}" fill="${fill}" stroke="#4c6574" stroke-width="${profile?.7:1}" opacity="${profile?.6:1}"><title>${esc(d.name)}</title></rect>`;
  }
  const visible=all.filter(d=>d.role!=='door'&&d.id!=='back'&&d.role!=='hinge'&&d.role!=='handle');
  return `<svg xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Размерные виды корпуса ${esc(m.name)}" viewBox="0 0 920 630" style="width:100%;height:auto;background:white;font-family:Arial,sans-serif">
  ${txt(front+m.width*scale/2,35,'Спереди · фасады скрыты')}${txt(side+m.depth*scale/2,35,'Сбоку · прозрачная схема')}
  ${visible.slice().sort((a,b)=>a.position[2]-b.position[2]).map(d=>shape(d,false)).join('')}
  <rect x="${side}" y="${base-m.height*scale}" width="${m.depth*scale}" height="${m.height*scale}" fill="none" stroke="#23323c" stroke-width="1.6"/>
  ${visible.filter(d=>!['left','right'].includes(d.id)).map(d=>shape(d,true)).join('')}
  ${horizontal(front,base+30,m.width,String(m.width))}${horizontal(side,base+30,m.depth,String(m.depth))}
  ${line(front-35,base,front-35,base-m.height*scale)}${line(front-40,base,front-30,base)}${line(front-40,base-m.height*scale,front-30,base-m.height*scale)}
  <text transform="translate(${front-44} ${base-m.height*scale/2}) rotate(-90)" text-anchor="middle" font-size="13">${m.height}</text>
  ${boxes(m).map((b,i)=>horizontal(front+b.x*scale,base-m.height*scale-25,b.width,`С${i+1}: ${mm(b.width)}`)).join('')}
  ${levels.map(l=>{const d=all.find(p=>p.id===l.id)!,x=front+d.position[0]*scale,y=base-d.position[1]*scale;return `<circle cx="${x}" cy="${y}" r="9" fill="white" stroke="#294b63"/>${txt(x,y+4,l.mark)}`;}).join('')}
  ${txt(30,595,'0 — низ корпуса. Габариты корпуса без выступающих фасадов и ручек.','start')}
  ${txt(30,616,'Номера элементов соответствуют таблице высот. Размеры в мм; масштаб при печати произвольный.','start')}</svg>`;
}
export function drawingTable(m:Module){return `<table><thead><tr><th>№</th><th>Элемент</th><th>Секция</th><th>Низ от 0</th><th>Верх от 0</th><th>Ось от 0</th><th>Ось от дна проёма</th></tr></thead><tbody>${drawingLevels(m).map(d=>`<tr><td>${d.mark}</td><td>${esc(d.name)}</td><td>${d.section}</td><td>${d.bottom}</td><td>${d.top}</td><td>${d.center}</td><td>${d.fromOpening}</td></tr>`).join('')}</tbody></table>`;}
export function drawingsHTML(p:Project){const errors=projectErrors(p);if(errors.length)throw Error(errors[0]);return `<!doctype html><html lang="ru"><meta charset="utf-8"><title>Размерные виды модулей</title><style>body{font:13px Arial;color:#23323c;margin:24px auto;max-width:1050px;padding:20px}table{width:100%;border-collapse:collapse;margin-top:14px;font-size:12px}th,td{border:1px solid #bbc8cf;padding:7px;text-align:left}thead{display:table-header-group}tr{break-inside:avoid}h1{font-size:22px}h2{font-size:19px}section{break-before:page}section:first-of-type{break-before:auto}.note{color:#5c6c77;line-height:1.5}@page{size:A4 landscape;margin:12mm}@media print{body{margin:0;padding:0;max-width:none}svg{max-height:155mm}h2{margin:8px 0}}</style><h1>Размерные виды модулей · для согласования</h1><p class="note">Это схема конструкции, без присадки и управляющих программ. Перед производством технолог проверяет соединения, кромление, зазоры и монтаж. Замер: ${esc(p.measurement?.number||'—')}.</p>${p.modules.map((a,i)=>`<section><h2>${i+1}. ${esc(a.module.name)} · ${a.module.width} × ${a.module.height} × ${a.module.depth}</h2><p>${esc(a.module.decor)} · положение X ${a.x}, Z ${a.z}, от пола ${a.y??0} мм; поворот ${a.rotation??0}°.</p>${moduleDrawingSVG(a.module)}${drawingTable(a.module)}</section>`).join('')}</html>`;}
