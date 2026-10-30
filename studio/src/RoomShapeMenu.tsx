// Меню правой кнопки у угла и стены на плане и окно ввода числа (задача Макса 30.10.2026: «как в Базисе — правой кнопкой скос,
// скругление, дуга, длина стены; набрал число — Enter»). Меню — как меню зазора в App (gap-menu), окно — как поле размера
// (dimension-editor): один вид для всей студии, без window.prompt. Работает и в пустой комнате (EmptyRoomView), где App нет.
import {useState} from 'react';
import './room-shape.css';
export type ShapeMenuItem={label:string;run:()=>void;disabled?:boolean;title?:string};
export function ShapeMenu({title,x,y,items,onClose}:{title:string;x:number;y:number;items:ShapeMenuItem[];onClose:()=>void}){
  return <div className="gap-menu-backdrop" onPointerDown={onClose} onContextMenu={e=>{e.preventDefault();onClose();}}>
    <div className="gap-menu room-shape-menu" role="menu" aria-modal="true" aria-label={title} style={{left:Math.max(8,Math.min(x-20,window.innerWidth-296)),top:Math.max(8,Math.min(y+14,window.innerHeight-220))}} onPointerDown={e=>e.stopPropagation()} onKeyDown={e=>{if(e.key==='Escape'){e.preventDefault();e.stopPropagation();onClose();}}}>
      <div className="gap-menu-title">{title}</div>
      {items.map((it,k)=><button key={it.label} role="menuitem" autoFocus={k===0} disabled={it.disabled} title={it.title} onClick={()=>{onClose();it.run();}}>{it.label}</button>)}
    </div></div>;
}
/** Окно ввода: arc — ещё «стрела/радиус» и «наружу/внутрь». apply возвращает причину отказа (окно остаётся) или null. */
export type ShapeAskSpec={title:string;label:string;value:string;hint?:string;arc?:{mode:'sagitta'|'radius';dir:'out'|'in'}};
export function ShapeAsk({spec,apply,onClose}:{spec:ShapeAskSpec;apply:(value:string,arc?:{mode:'sagitta'|'radius';dir:'out'|'in'})=>string|null;onClose:()=>void}){
  const [value,setValue]=useState(spec.value),[arc,setArc]=useState(spec.arc),[error,setError]=useState('');
  const seg=(k:'mode'|'dir',opts:[string,string][])=><div className="room-shape-seg" role="radiogroup" aria-label={k==='mode'?'Задать дугу':'Куда выгнута'}>{opts.map(([v,l])=><button type="button" key={v} role="radio" aria-checked={arc?.[k]===v} onClick={()=>setArc(a=>a&&{...a,[k]:v})}>{l}</button>)}</div>;
  return <div className="dimension-editor" role="dialog" aria-modal="true" aria-label={spec.title} onPointerDown={e=>{if(e.target===e.currentTarget)onClose();}}>
    <form onSubmit={e=>{e.preventDefault();const p=apply(value,arc);if(p)setError(p);else onClose();}} onKeyDown={e=>{if(e.key==='Escape'){e.preventDefault();e.stopPropagation();onClose();}}}>
      <strong className="room-shape-ask-title">{spec.title}</strong>
      {arc&&<>{seg('mode',[['sagitta','Стрела'],['radius','Радиус']])}{seg('dir',[['out','Наружу'],['in','Внутрь']])}</>}
      <label>{arc?(arc.mode==='radius'?'Радиус дуги':'Стрела дуги'):spec.label}, мм<input autoFocus inputMode="decimal" aria-label={spec.title} value={value} onFocus={e=>e.currentTarget.select()} onChange={e=>{setValue(e.target.value);setError('');}}/></label>
      {spec.hint&&<p className="field-note">{spec.hint}</p>}
      {error&&<p role="alert" className="dimension-error">{error}</p>}
      <button type="submit" className="primary">Применить</button><button type="button" onClick={onClose}>Отмена</button>
    </form></div>;
}
