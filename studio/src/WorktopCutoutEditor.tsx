import {useState,useRef,useMemo} from 'react';
import {localToRoom,roomToLocal,type Project,type PlacedModule} from './project';
import {relocateCutoutRails} from './cutoutRails';
import {cutoutSnapPoints,moveWorktopCutout,type CutPoint} from './worktopCutoutPlacement';

export function WorktopCutoutEditor({project,top,index,commit}:{project:Project;top:PlacedModule;index:number;commit:(p:Project)=>boolean}){
 const c=top.module.worktop!.cutouts[index],W=top.module.width,D=top.module.depth;
 const [drag,setDrag]=useState<CutPoint|null>(null),[note,setNote]=useState('');
 const point=drag??{x:c.x,z:c.z??(D-c.depth)/2};
 const anchor=useRef<{x:number;z:number}|null>(null),latest=useRef<CutPoint|null>(null);
 const snaps=useMemo(()=>cutoutSnapPoints(project,top,index,point.z),[project,top,index,point.z]);
 const pad=W/12,font=W/30;
 const bases=project.modules.filter(a=>a.id!==top.id&&a.module.kitchen?.role==='base').map(a=>{const corners=[[0,0],[a.module.width,0],[0,a.module.depth],[a.module.width,a.module.depth]].map(([x,z])=>{const q=localToRoom(a,x,z);return roomToLocal(top,q.x,q.z);});const x=Math.min(...corners.map(p=>p.x)),z=Math.min(...corners.map(p=>p.z));return {a,x,z,w:Math.max(...corners.map(p=>p.x))-x,d:Math.max(...corners.map(p=>p.z))-z};}).filter(b=>b.x<W&&b.x+b.w>0&&b.z<D&&b.z+b.d>0);
 let railWarning='';try{relocateCutoutRails(project,top.id);}catch(e){railWarning=(e as Error).message;}
 const at=(e:React.PointerEvent<SVGElement>)=>{const svg=e.currentTarget.ownerSVGElement??e.currentTarget as SVGSVGElement;const matrix=svg.getScreenCTM();if(!matrix)return null;const p=svg.createSVGPoint();p.x=e.clientX;p.y=e.clientY;const q=p.matrixTransform(matrix.inverse());return {x:q.x,z:q.y};};
 const apply=(p:CutPoint)=>{try{if(commit(moveWorktopCutout(project,top.id,index,p)))setNote('Положение сохранено. Отмена — Ctrl+Z.');else setNote('Изменение не принято.');}catch(e){setNote((e as Error).message);}};
 return <div className="cutout-position-editor">
  <p className="field-note">Вид сверху: тяните синий вырез. Пунктир — корпуса под столешницей. Привязка к осям — до 30 мм; Alt отключает её. Пересечения показываются предупреждениями.</p>
  <svg viewBox={`${-pad} ${-pad} ${W+2*pad} ${D+2*pad}`} style={{width:'100%',minHeight:160,touchAction:'none',background:'#f5f7fa'}} aria-label={'Перемещение выреза '+(index+1)}>
   <rect width={W} height={D} fill="#e3d6bf" stroke="#556" strokeWidth={W/700}/>
   {bases.map(b=><g key={b.a.id} pointerEvents="none"><rect x={b.x} y={b.z} width={b.w} height={b.d} fill="none" stroke="#374151" strokeWidth={W/600} strokeDasharray="20 10"/><text x={b.x+b.w/2} y={D+font*1.8} fontSize={font*.6} textAnchor="middle">{b.a.module.name} · {b.a.module.width}</text></g>)}
   {top.module.worktop!.cutouts.map((other,i)=>i===index?null:<rect key={i} x={other.x} y={other.z??(D-other.depth)/2} width={other.width} height={other.depth} fill="#8b94a0"/>)}
   {snaps.map((s,i)=><line key={i} x1={s.x+c.width/2} x2={s.x+c.width/2} y1={0} y2={D} stroke="#7795d2" strokeWidth={W/1000} strokeDasharray={`${W/150} ${W/150}`}/>)}
   <g fontSize={font} fill="#243b73" textAnchor="middle">
    <line x1={0} y1={point.z+c.depth/2} x2={point.x} y2={point.z+c.depth/2} stroke="currentColor"/><text x={point.x/2} y={point.z+c.depth/2-font/3}>{Math.round(point.x)}</text>
    <line x1={point.x+c.width} y1={point.z+c.depth/2} x2={W} y2={point.z+c.depth/2} stroke="currentColor"/><text x={(point.x+c.width+W)/2} y={point.z+c.depth/2-font/3}>{Math.round(W-point.x-c.width)}</text>
    <text x={point.x+c.width/2} y={-font/3}>Сзади {Math.round(point.z)}</text><text x={point.x+c.width/2} y={D+font}>Спереди {Math.round(D-point.z-c.depth)}</text>
   </g>
   <rect x={point.x} y={point.z} width={c.width} height={c.depth} rx={10} fill="#344b72" stroke="#2558ff" strokeWidth={W/250} tabIndex={0} role="button" aria-label="Передвинуть вырез" style={{cursor:'move'}}
    onPointerDown={e=>{const p=at(e);if(!p)return;e.stopPropagation();e.currentTarget.setPointerCapture(e.pointerId);anchor.current={x:p.x-point.x,z:p.z-point.z};latest.current=point;setDrag(point);}}
    onPointerMove={e=>{if(!anchor.current)return;const p=at(e);if(!p)return;const q={x:Math.round(p.x-anchor.current.x),z:Math.round(p.z-anchor.current.z)};if(!e.altKey){const near=[...cutoutSnapPoints(project,top,index,q.z)].sort((a,b)=>Math.abs(a.x-q.x)-Math.abs(b.x-q.x))[0];if(near&&Math.abs(near.x-q.x)<=30){q.x=near.x;setNote('Привязка: '+near.label);}}latest.current=q;setDrag(q);}}
    onPointerUp={e=>{if(!anchor.current)return;e.stopPropagation();anchor.current=null;const q=latest.current;setDrag(null);if(q)apply(q);}}
    onPointerCancel={()=>{anchor.current=null;latest.current=null;setDrag(null);}}
    onKeyDown={e=>{const d=e.shiftKey?1:10;if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key))return;e.preventDefault();e.stopPropagation();apply({x:point.x+(e.key==='ArrowLeft'?-d:e.key==='ArrowRight'?d:0),z:point.z+(e.key==='ArrowUp'?-d:e.key==='ArrowDown'?d:0)});}}/>
  </svg>
  {snaps.length>0&&<label className="hardware-field">Привязать к модулю<select aria-label={'Привязка выреза '+(index+1)} value="" onChange={e=>{const s=snaps[Number(e.target.value)];if(s)apply(s);}}><option value="">Выберите ось…</option>{snaps.map((s,i)=><option key={i} value={i}>{s.label}</option>)}</select></label>}
  {!snaps.length&&<p className="field-note">Нет подходящей оси модуля. Можно переместить вручную или задать отступы ниже.</p>}
  <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8}}>{(['Слева','Справа','Сзади','Спереди'] as const).map((label,i)=>{const value=[point.x,W-point.x-c.width,point.z,D-point.z-c.depth][i];return <label key={label}>{label}, мм<input aria-label={'Вырез '+(index+1)+': '+label} type="number" key={value} defaultValue={Math.round(value)} onBlur={e=>{if(!e.currentTarget.value.trim())return;const n=Number(e.currentTarget.value);if(!Number.isFinite(n)||n===value)return;apply({x:i===0?n:i===1?W-c.width-n:point.x,z:i===2?n:i===3?D-c.depth-n:point.z});}} onKeyDown={e=>{e.stopPropagation();if(e.key==='Enter')e.currentTarget.blur();}}/></label>;})}</div>
  {railWarning&&<p role="alert" className="field-note">Положение можно редактировать. Автоперенос царг не выполнен: {railWarning}</p>}
  {note&&<p role="status" className="field-note">{note}</p>}
 </div>;
}
