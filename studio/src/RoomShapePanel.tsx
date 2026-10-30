// Панель «Форма комнаты» (задача Макса 30.10.2026: «не все помещения ровные — 5-угольные, со скосом, со скруглениями»):
// заготовки с маленькими значками, таблица стен (длина, угол, дуга — Enter), «Сделать прямоугольной», переход к правке на плане.
// Общая для редактора (App) и пустой комнаты (EmptyRoomView). Правка — через roomShape.shapeEdit: отказ с причиной, одна отмена.
import {useState} from 'react';
import {roomOutline,outlinePreset,rectOutline,flatten,normalizeOutline,setWallLength,setCornerAngle,setBulge,moveEdgeMap,sameEdges,edgeFrame,PRESET_NAMES,type OutlinePreset,type RoomOutline,type EdgeMap} from './roomOutline';
import {shapeEdit,wallRows,wallName} from './roomShape';
import type {Project} from './project';
import './room-shape.css';

const PRESETS=Object.keys(PRESET_NAMES) as OutlinePreset[];
/** Значок заготовки: контур 4000 × 3000 в 28 × 21. */
function PresetIcon({kind}:{kind:OutlinePreset}){
  const n=normalizeOutline(outlinePreset(kind,4000,3000)),o=n.outline??rectOutline(n.width,n.depth),k=Math.min(26/n.width,19/n.depth);
  return <svg width="28" height="21" viewBox="0 0 28 21" aria-hidden="true"><polygon points={flatten(o,200).pts.map(q=>(1+q.x*k).toFixed(1)+','+(1+q.z*k).toFixed(1)).join(' ')} fill="#e9eef2" stroke="#4d5b66" strokeWidth="1.4" strokeLinejoin="round"/></svg>;
}
export function RoomShapePanel({project,commit,onPlan}:{project:Project;commit:(p:Project)=>boolean;onPlan?:()=>void}){
  const [note,setNote]=useState('');
  const room=project.room,o=roomOutline(room),rows=wallRows(o);
  function apply(raw:RoomOutline,map?:EdgeMap):boolean{
    const r=shapeEdit(project,raw,map);
    if(r.problem){setNote(r.problem);return false;}
    const ok=commit(r.project);setNote(ok?'':'Форма не применена — см. сообщение выше');return ok;
  }
  /** Поле таблицы: Enter или уход из поля — правка; отказ — прежнее значение и причина. */
  const cell=(label:string,value:number,run:(v:number)=>boolean,step?:number)=><input type="number" step={step} aria-label={label} key={label+':'+value} defaultValue={value} onKeyDown={e=>{if(e.key==='Enter')e.currentTarget.blur();if(e.key==='Escape'){e.currentTarget.value=String(value);e.currentTarget.blur();}}} onBlur={e=>{const t=e.target.value.trim(),v=t?Number(t):NaN;if(v===value)return;if(!Number.isFinite(v)||!run(v))e.target.value=String(value);}}/>;
  return <div className="room-shape-panel" data-testid="room-shape-panel">
    <h3>Форма комнаты</h3>
    <div className="room-shape-presets" role="group" aria-label="Заготовки формы комнаты">{PRESETS.map(k=><button key={k} type="button" aria-pressed={k==='rect'&&!room.outline} title={PRESET_NAMES[k]+' — по габариту '+room.width+' × '+room.depth+' мм'} onClick={()=>{if(apply(outlinePreset(k,room.width,room.depth)))onPlan?.();}}><PresetIcon kind={k}/><span>{PRESET_NAMES[k]}</span></button>)}</div>
    <table className="room-shape-walls"><thead><tr><th>№</th><th>Стена</th><th>Длина, мм</th><th title="Угол в начале стены, между ней и предыдущей">Угол, °</th><th title="Стрела дуги: > 0 — наружу, < 0 — внутрь, 0 — прямая">Дуга, мм</th></tr></thead>
      <tbody>{rows.map(w=><tr key={w.i}><td>{w.i+1}</td><td>{wallName(o,w.i)}</td>
        <td>{cell(`Длина стены ${w.i+1}`,w.length,v=>v>=50?apply(setWallLength(o,w.i,v),moveEdgeMap(o.length,(w.i+1)%o.length)):(setNote('Стена от 50 мм'),false))}</td>
        <td>{cell(`Угол ${w.i+1}`,w.angle,v=>v>0&&v<360?apply(setCornerAngle(o,w.i,v),sameEdges(o.length)):(setNote('Угол от 1 до 359°'),false),0.1)}</td>
        <td>{cell(`Дуга стены ${w.i+1}`,w.bulge,v=>{const ch=edgeFrame(o,w.i).chord;if(Math.abs(v)>ch/2)return setNote(`Стрела не больше половины стены (${Math.floor(ch/2)} мм)`),false;return apply(setBulge(o,w.i,v),sameEdges(o.length));})}</td></tr>)}</tbody></table>
    {note&&<p role="alert" className="field-note room-shape-note">{note}</p>}
    <div className="room-shape-actions">{onPlan&&<button type="button" className="outline" onClick={onPlan}>Править на плане</button>}{room.outline&&<button type="button" className="text-action" onClick={()=>apply(rectOutline(room.width,room.depth))}>Сделать прямоугольной</button>}</div>
    <p className="field-note">Длина стены переносит следующую стену параллельно (углы на месте). Угол поворачивает стену вокруг её начала. На плане: тяните углы и середины стен, правая кнопка — скос, скругление, дуга.</p>
  </div>;
}
