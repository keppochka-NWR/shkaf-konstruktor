import {openingZone,roomWarnings} from './roomWarnings';
import {useRef,useState} from 'react';
import {projectErrors,bounds,localToRoom,snapPlacement,type Project,type Opening} from './project';
type Props={snapping:boolean;project:Project;active:string;onSelect:(id:string)=>void;onRoom:()=>void;selectedOpening?:string;onOpeningSelect:(id:string)=>void;update:(p:Project)=>boolean};
type Drag={kind:'module'|'opening';id:string;start:{x:number;y:number};origin:{x:number;z:number};pointerId:number};
export function RoomPlan({snapping,project,active,onSelect,onRoom,selectedOpening,onOpeningSelect,update}:Props){
  const svg=useRef<SVGSVGElement>(null),drag=useRef<Drag|null>(null),[preview,setPreview]=useState<Project|null>(null);
  const p=preview||project,r=p.room,margin=Math.max(r.width,r.depth)*0.1;
  const warnings=roomWarnings(p);
  const problem=preview?projectErrors(preview)[0]:undefined;
  function point(e:React.PointerEvent){const pt=new DOMPoint(e.clientX,e.clientY),matrix=svg.current?.getScreenCTM();return matrix?pt.matrixTransform(matrix.inverse()):pt;}
  function start(e:React.PointerEvent,kind:Drag['kind'],id:string){if(e.button!==0)return;(e.currentTarget as SVGGElement).focus();e.stopPropagation();const a=project.modules.find(a=>a.id===id),o=project.room.openings?.find(o=>o.id===id);const pt=point(e);drag.current={kind,id,start:pt,origin:kind==='module'?{x:a!.x,z:a!.z}:{x:o!.offset,z:0},pointerId:e.pointerId};svg.current?.setPointerCapture(e.pointerId);if(kind==='module')onSelect(id);else {onRoom();onOpeningSelect(id);}}
  function move(e:React.PointerEvent){const d=drag.current;if(!d)return;const pt=point(e),n=structuredClone(project);
    if(d.kind==='module'){const a=n.modules.find(a=>a.id===d.id)!;const raw={x:d.origin.x+pt.x-d.start.x,z:d.origin.z+pt.y-d.start.y,y:a.y??0};Object.assign(a,!snapping||e.altKey?{x:Math.round(raw.x),y:raw.y,z:Math.round(raw.z)}:snapPlacement(project,d.id,raw));}
    else{const o=n.room.openings!.find(o=>o.id===d.id)!,horizontal=o.wall==='back'||o.wall==='front',length=horizontal?r.width:r.depth;o.offset=Math.max(0,Math.min(length-o.width,Math.round((d.origin.x+(horizontal?pt.x-d.start.x:pt.y-d.start.y))/10)*10));}
    setPreview(n);
  }
  function finish(e:React.PointerEvent){const d=drag.current;if(!d)return;if(preview)update(preview);drag.current=null;setPreview(null);if(svg.current?.hasPointerCapture(e.pointerId))svg.current.releasePointerCapture(e.pointerId);}
  function cancel(){drag.current=null;setPreview(null);}
  function keyboard(e:React.KeyboardEvent,kind:Drag['kind'],id:string){
    if(e.ctrlKey||e.metaKey||e.altKey||drag.current)return;
    const select=()=>{if(kind==='module')onSelect(id);else {onRoom();onOpeningSelect(id);}};
    if(e.key==='Enter'||e.key===' '){e.preventDefault();select();return;}
    if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key))return;
    e.preventDefault();e.stopPropagation();select();const step=e.shiftKey?100:10,n=structuredClone(project);
    if(kind==='module'){const a=n.modules.find(a=>a.id===id)!;if(e.key==='ArrowLeft')a.x-=step;if(e.key==='ArrowRight')a.x+=step;if(e.key==='ArrowUp')a.z-=step;if(e.key==='ArrowDown')a.z+=step;}
    else {const o=n.room.openings!.find(o=>o.id===id)!,horizontal=o.wall==='back'||o.wall==='front';if(horizontal&&(e.key==='ArrowUp'||e.key==='ArrowDown')||!horizontal&&(e.key==='ArrowLeft'||e.key==='ArrowRight'))return;o.offset+=(e.key==='ArrowLeft'||e.key==='ArrowUp'?-1:1)*step;}
    update(n);
  }
  function opening(o:Opening,index:number){const horizontal=o.wall==='back'||o.wall==='front',x=horizontal?o.offset:o.wall==='left'?0:r.width,z=horizontal?o.wall==='back'?0:r.depth:o.offset;return <g key={o.id} tabIndex={0} role="button" aria-label={'На плане: '+(o.type==='window'?'Окно':'Дверь')+' '+(index+1)+', ширина '+Math.round(o.width)+' мм'} aria-pressed={selectedOpening===o.id} onPointerDown={e=>start(e,'opening',o.id)} onKeyDown={e=>keyboard(e,'opening',o.id)} style={{cursor:horizontal?'ew-resize':'ns-resize'}}><line x1={x} y1={z} x2={x+(horizontal?o.width:0)} y2={z+(horizontal?0:o.width)} stroke="#fafaf8" strokeWidth={90}/><line x1={x} y1={z} x2={x+(horizontal?o.width:0)} y2={z+(horizontal?0:o.width)} stroke={selectedOpening===o.id?'#325bee':o.type==='window'?'#78a9bd':'#b29a7b'} strokeWidth={selectedOpening===o.id?65:45}/><text x={x+(horizontal?o.width/2:-110)} y={z+(horizontal?-85:o.width/2)} fontSize={70} textAnchor="middle" fill="#607180">{o.type==='window'?'Окно':'Дверь'} {index+1} · {o.width}</text></g>;}
  return <div className="room-plan"><svg ref={svg} role="group" aria-label="План комнаты. Перетаскивайте корпуса, окна и двери." viewBox={`${-margin} ${-margin} ${r.width+margin*2} ${r.depth+margin*2}`} onPointerMove={move} onPointerUp={finish} onPointerCancel={cancel} onKeyDown={e=>{if(e.key==='Escape')cancel();}}>
    <defs><pattern id="room-plan-grid" width="100" height="100" patternUnits="userSpaceOnUse"><path d="M100 0H0V100" fill="none" stroke="#e1e3e2" strokeWidth="3"/></pattern></defs>
    <rect width={r.width} height={r.depth} fill="url(#room-plan-grid)" stroke="#717b84" strokeWidth={55}/>
    <text x={r.width/2} y={-margin*.55} fontSize={90} textAnchor="middle" fill="#5b6570">{r.width} мм</text><text x={-margin*.55} y={r.depth/2} transform={`rotate(-90 ${-margin*.55} ${r.depth/2})`} fontSize={90} textAnchor="middle" fill="#5b6570">{r.depth} мм</text>
    {r.openings?.map(o=>{const z=openingZone(r,o),hit=warnings.some(w=>w.openingId===o.id);return <rect key={'zone-'+o.id} x={z.x} y={z.z} width={z.w} height={z.d} fill={hit?'#edac43':'#b8cbd6'} fillOpacity={.18} stroke={hit?'#b77514':'#93a8b5'} strokeWidth={5} strokeDasharray="20 14" pointerEvents="none"><title>{o.type==='door'?'Условная зона подхода к двери: 900 мм':'Зона у окна: 100 мм'}</title></rect>;})}
    {r.openings?.map(opening)}
    {p.modules.map((a,i)=>{const b=bounds(a),front1=localToRoom(a,0,a.module.depth),front2=localToRoom(a,a.module.width,a.module.depth);return <g key={a.id} role="button" tabIndex={0} aria-label={'На плане: '+a.module.name} onPointerDown={e=>start(e,'module',a.id)} onKeyDown={e=>keyboard(e,'module',a.id)} style={{cursor:'grab'}}><rect x={b.x} y={b.z} width={b.w} height={b.d} rx={12} fill={a.id===active?'#dce5ff':(a.y??0)>0?'#e4dfd4':'#e6e9e7'} fillOpacity={(a.y??0)>0?.65:1} stroke={problem&&a.id===drag.current?.id?'#c63838':warnings.some(w=>w.moduleId===a.id)?'#b77514':a.id===active?'#325bee':'#87958e'} strokeWidth={a.id===active?14:8} strokeDasharray={(a.y??0)>0?'35 20':undefined}/><line x1={front1.x} y1={front1.z} x2={front2.x} y2={front2.z} stroke={a.id===active?'#325bee':'#6b8072'} strokeWidth={28}/><text x={b.x+b.w/2} y={b.z+b.d/2-25} fontSize={75} textAnchor="middle" fill="#283747" pointerEvents="none">{i+1}</text><text x={b.x+b.w/2} y={b.z+b.d/2+65} fontSize={48} textAnchor="middle" fill="#586776" pointerEvents="none">{a.module.width} × {a.module.depth}</text></g>;})}
  </svg><div className={"plan-help"+(problem?" invalid":"")} role={problem?"alert":undefined}>{problem||warnings[0]?.message||(snapping?"Alt — без привязки · Толстая линия — фасад · Пунктир — верхний модуль":"Привязки отключены · Толстая линия — фасад · Пунктир — верхний модуль")}</div><p className="field-note plan-keyboard-help">Выберите корпус или проём: стрелки — 10 мм, Shift + стрелки — 100 мм. Проёмы двигаются вдоль своей стены. Клавиши работают без привязок.</p></div>;
}

