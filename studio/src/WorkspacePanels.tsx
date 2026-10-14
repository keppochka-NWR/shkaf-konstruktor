import {useEffect,useRef,useState,type CSSProperties,type ReactNode} from 'react';

const KEY='yo-constructor-panel-widths-v1';
type Widths={left:number;right:number};
const defaults:Widths={left:250,right:300};
function stored():Widths {
 try {const value=JSON.parse(localStorage.getItem(KEY)||'null');if(value&&Number.isFinite(value.left)&&Number.isFinite(value.right))return {left:Math.max(180,Math.min(460,value.left)),right:Math.max(240,Math.min(560,value.right))};}catch{}
 return defaults;
}
function fit(value:Widths,width:number):Widths {
 const left=Math.max(180,Math.min(460,value.left,width-560));
 const right=Math.max(240,Math.min(560,value.right,width-left-320));
 return {left,right};
}

/** Application preference, independent of the project and its undo history. */
export function WorkspacePanels({children}:{children:ReactNode}) {
 const host=useRef<HTMLElement>(null),[widths,setWidths]=useState(stored),[dragging,setDragging]=useState(false);
 const drag=useRef<{side:keyof Widths;x:number;widths:Widths}|null>(null);
 const live=useRef(widths);live.current=widths;
 useEffect(()=>{
  const element=host.current!;
  const observer=new ResizeObserver(()=>{if(element.clientWidth>=901)setWidths(w=>fit(w,element.clientWidth));});
  observer.observe(element);return()=>observer.disconnect();
 },[]);
 const save=()=>{try{localStorage.setItem(KEY,JSON.stringify(live.current));}catch{}};
 const change=(side:keyof Widths,value:number)=>{
  const available=host.current!.clientWidth,other=side==='left'?'right':'left';
  const next={...live.current,[side]:Math.max(side==='left'?180:240,Math.min(side==='left'?460:560,available-live.current[other]-320,value))};
  live.current=next;setWidths(next);
 };
 return <main ref={host} className={'workspace resizable-workspace'+(dragging?' resizing-panels':'')} style={{'--left-panel-width':`${widths.left}px`,'--right-panel-width':`${widths.right}px`} as CSSProperties}>
  {children}
  {(['left','right'] as const).map(side=><div key={side} className={`panel-resizer panel-resizer-${side}`} role="separator" aria-label={side==='left'?'Ширина левой панели':'Ширина правой панели'} aria-orientation="vertical" aria-valuemin={side==='left'?180:240} aria-valuemax={Math.min(side==='left'?460:560,(host.current?.clientWidth||1600)-widths[side==='left'?'right':'left']-320)} aria-valuenow={Math.round(widths[side])} tabIndex={0} title="Потяните для изменения ширины. Двойной щелчок — сброс."
   onPointerDown={e=>{if(e.button!==0)return;e.preventDefault();drag.current={side,x:e.clientX,widths:{...live.current}};e.currentTarget.setPointerCapture(e.pointerId);setDragging(true);}}
   onPointerMove={e=>{const d=drag.current;if(!d||d.side!==side)return;change(side,d.widths[side]+(e.clientX-d.x)*(side==='left'?1:-1));}}
   onPointerUp={e=>{if(!drag.current)return;drag.current=null;setDragging(false);save();e.currentTarget.releasePointerCapture(e.pointerId);}}
   onLostPointerCapture={()=>{drag.current=null;setDragging(false);save();}}
   onDoubleClick={()=>{change(side,defaults[side]);save();}}
   onKeyDown={e=>{if(e.key!=='ArrowLeft'&&e.key!=='ArrowRight')return;e.preventDefault();change(side,live.current[side]+(e.key==='ArrowRight'?1:-1)*(side==='left'?1:-1)*(e.shiftKey?40:10));save();}}
  />)}
 </main>;
}
