import {bounds,localToRoom,projectErrors,type Project} from './project';
import {roomWarnings} from './roomWarnings';
const esc=(v:unknown)=>String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
const mm=(v:number)=>Math.round(v*10)/10;
const walls={back:'Задняя',front:'Передняя',left:'Левая',right:'Правая'};
export function placementSVG(p:Project){
 const error=projectErrors(p)[0];if(error)throw Error(error);
 const r=p.room,scale=Math.min(740/r.width,440/r.depth),ox=(900-r.width*scale)/2,oy=80;
 const x=(v:number)=>ox+v*scale,y=(v:number)=>oy+v*scale;
 const text=(a:number,b:number,t:unknown,size=12)=>`<text x="${a}" y="${b}" text-anchor="middle" font-size="${size}" fill="#263747">${esc(t)}</text>`;
 return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 900 600" role="img" aria-label="План расстановки, вид сверху" style="width:100%;font-family:Arial,sans-serif;background:white">
 <rect x="${ox}" y="${oy}" width="${r.width*scale}" height="${r.depth*scale}" fill="#fafbfc" stroke="#566673" stroke-width="4"/>
 ${text(450,35,`Ширина помещения ${r.width} мм`)}${text(450,55,'Задняя стена')}
 <text x="28" y="300" transform="rotate(-90 28 300)" text-anchor="middle" font-size="12">Глубина ${r.depth} мм</text>
 ${p.modules.map((a,i)=>{const b=bounds(a),f1=localToRoom(a,0,a.module.depth),f2=localToRoom(a,a.module.width,a.module.depth),stack=p.modules.map((other,j)=>({b:bounds(other),j})).filter(other=>['x','z','w','d'].every(key=>Math.abs(other.b[key as 'x']-b[key as 'x'])<.1)),label=stack.at(-1)!.j===i?stack.map(a=>a.j+1).join(' / '):'';return `<g data-module="${esc(a.id)}"><rect x="${x(b.x)}" y="${y(b.z)}" width="${b.w*scale}" height="${b.d*scale}" fill="${(a.y??0)>0?'#dce5f1':'#e5e9e6'}" fill-opacity="${(a.y??0)>0?.45:.85}" stroke="#536c7c" stroke-width="1.2" ${(a.y??0)>0?'stroke-dasharray="5 3"':''}/><line x1="${x(f1.x)}" y1="${y(f1.z)}" x2="${x(f2.x)}" y2="${y(f2.z)}" stroke="#1a566f" stroke-width="3"/>${text(x(b.x+b.w/2),y(b.z+b.d/2)+4,label)}</g>`;}).join('')}
 ${(r.openings||[]).map((o,i)=>{const horizontal=o.wall==='back'||o.wall==='front',u=horizontal?o.offset:o.wall==='left'?0:r.width,v=horizontal?o.wall==='back'?0:r.depth:o.offset;return `<g data-opening="${esc(o.id)}"><line x1="${x(u)}" y1="${y(v)}" x2="${x(u+(horizontal?o.width:0))}" y2="${y(v+(horizontal?0:o.width))}" stroke="white" stroke-width="7"/><line x1="${x(u)}" y1="${y(v)}" x2="${x(u+(horizontal?o.width:0))}" y2="${y(v+(horizontal?0:o.width))}" stroke="${o.type==='window'?'#6196ac':'#a08259'}" stroke-width="3"/>${text(x(u+(horizontal?o.width/2:0)),y(v+(horizontal?0:o.width/2))+(o.wall==='back'?-9:15),(o.type==='window'?'О':'Д')+(i+1),10)}</g>`;}).join('')}
 ${text(450,555,'Толстая линия — фасад. Пунктир — корпус, поднятый над полом.')}${text(450,578,'Номера через «/» — корпуса друг над другом. Размеры и отступы — в миллиметрах.',11)}</svg>`;
}
export function placementHTML(p:Project){
 const svg=placementSVG(p),warnings=roomWarnings(p);
 return `<!doctype html><html lang="ru"><meta charset="utf-8"><title>План расстановки</title><style>body{font:13px Arial,sans-serif;color:#263747;margin:24px}h1{font-size:24px;margin-bottom:6px}h2{font-size:17px;margin-top:24px}p{line-height:1.5}table{border-collapse:collapse;width:100%;font-size:11px}th,td{border:1px solid #ccd4dc;padding:7px;text-align:left}th{background:#eef2f5}tr{break-inside:avoid}thead{display:table-header-group}.plan{max-width:960px;margin:auto}.note{color:#536673}button{padding:10px 16px}@media print{@page{size:A4 landscape;margin:12mm}body{margin:0}button{display:none}.plan{break-after:page}.plan svg{height:145mm;width:100%}h2{break-after:avoid}}</style><button onclick="window.print()">Печать / Сохранить PDF</button>
 <h1>План расстановки</h1><p>${esc(p.offer?.customer||'Проект мебели')} · Помещение ${p.room.width} × ${p.room.depth} мм · потолок ${p.room.height} мм</p>
 <div class="plan">${svg}</div><h2>Корпуса</h2><table><thead><tr><th>№</th><th>Название</th><th>Ш × В × Г</th><th>От левой стены</th><th>От задней стены</th><th>От пола</th><th>Поворот</th></tr></thead><tbody>${p.modules.map((a,i)=>{const b=bounds(a);return `<tr><td>${i+1}</td><td>${esc(a.module.name)}</td><td>${a.module.width} × ${a.module.height} × ${a.module.depth}</td><td>${mm(b.x)}</td><td>${mm(b.z)}</td><td>${mm(a.y??0)}</td><td>${a.rotation??0}°</td></tr>`;}).join('')}</tbody></table>
 <p class="note">Отступы указаны по монтажному габариту с учётом поворота, задника и места под фасады. Контуры схематичные, ручки на плане не показаны. Наложение верхнего корпуса на нижний в виде сверху допустимо; высоты указаны в таблице.</p>
 ${(p.room.openings||[]).length?`<h2>Проёмы</h2><table><thead><tr><th>Метка</th><th>Стена</th><th>От начала стены</th><th>Ширина × высота</th><th>От пола</th></tr></thead><tbody>${p.room.openings!.map((o,i)=>`<tr><td>${o.type==='window'?'Окно О':'Дверь Д'}${i+1}</td><td>${walls[o.wall]}</td><td>${o.offset}</td><td>${o.width} × ${o.height}</td><td>${o.sill}</td></tr>`).join('')}</tbody></table><p class="note">На задней и передней стенах отступ считается слева направо; на боковых — от задней стены.</p>`:''}
 ${p.measurement?`<h2>Замер ${esc(p.measurement.number)}</h2><p>${esc(p.measurement.date)}</p><p style="white-space:pre-wrap">${esc(p.measurement.notes)}</p>`:''}
 ${warnings.length?`<h2>Проверить перед согласованием</h2><ul>${warnings.map(w=>`<li>${esc(w.message)}</li>`).join('')}</ul>`:''}
 <p class="note">Для согласования расстановки. Направления открывания, радиаторы и коммуникации требуют отдельной проверки по замеру.</p></html>`;
}
