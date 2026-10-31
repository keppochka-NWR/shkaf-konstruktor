import {useEffect,useRef,useState,type CSSProperties,type ReactNode} from 'react';

const KEY='yo-constructor-panel-widths-v1';
type Widths={left:number;right:number};
// Макс 31.10 «универсальный размер на всех мониторах»: пока ширину не тянули мышью, колонки — по токенам --left-col/--right-col
// (clamp от ширины экрана, ui-layout.css); потянули — ширина в px запоминается, двойной щелчок по разделителю — снова по экрану.
function stored():Widths|null {
 try {const value=JSON.parse(localStorage.getItem(KEY)||'null');if(value&&Number.isFinite(value.left)&&Number.isFinite(value.right))return {left:Math.max(180,Math.min(460,value.left)),right:Math.max(240,Math.min(560,value.right))};}catch{}
 return null;
}
function fit(value:Widths,width:number):Widths {
 const left=Math.max(180,Math.min(460,value.left,width-560));
 const right=Math.max(240,Math.min(560,value.right,width-left-320));
 return {left,right};
}

/** Application preference, independent of the project and its undo history.
 *  collapsedLeft — левая колонка свёрнута в полосу значков; collapsedRight — правой колонки нет (этап «Помещение»: всё слева). */
export function WorkspacePanels({children,collapsedLeft=false,collapsedRight=false}:{children:ReactNode;collapsedLeft?:boolean;collapsedRight?:boolean}) {
 const host=useRef<HTMLElement>(null),[widths,setWidths]=useState(stored),[dragging,setDragging]=useState(false);
 const drag=useRef<{side:keyof Widths;x:number;widths:Widths}|null>(null);
 const live=useRef(widths);live.current=widths;
 /** Текущие ширины в px: заданные мышью или измеренные (по токенам). */
 const measured=():Widths=>{
  if(live.current)return live.current;
  // свёрнутая сторона (полоса значков / нет колонки) не запоминается своей шириной — берём токен по экрану
  const el=host.current,l=el?.querySelector<HTMLElement>(':scope>.library'),r=el?.querySelector<HTMLElement>(':scope>.properties');
  const token=(name:string,fallback:number)=>{const probe=document.createElement('div');probe.style.width=`var(${name})`;el?.appendChild(probe);const w=probe.offsetWidth;probe.remove();return w||fallback;};
  return {left:collapsedLeft?token('--left-col',250):l?.offsetWidth||250,right:collapsedRight?token('--right-col',300):r?.offsetWidth||300};
 };
 useEffect(()=>{
  const element=host.current!;
  const observer=new ResizeObserver(()=>{if(element.clientWidth>=901)setWidths(w=>w&&fit(w,element.clientWidth));});
  observer.observe(element);return()=>observer.disconnect();
 },[]);
 const save=()=>{try{if(live.current)localStorage.setItem(KEY,JSON.stringify(live.current));else localStorage.removeItem(KEY);}catch{}};
 const change=(side:keyof Widths,value:number)=>{
  const available=host.current!.clientWidth,other=side==='left'?'right':'left',base=measured();
  const next={...base,[side]:Math.max(side==='left'?180:240,Math.min(side==='left'?460:560,available-base[other]-320,value))};
  live.current=next;setWidths(next);
 };
 const reset=()=>{live.current=null;setWidths(null);save();};
 const now=widths??{left:host.current?.querySelector<HTMLElement>(':scope>.library')?.offsetWidth||250,right:host.current?.querySelector<HTMLElement>(':scope>.properties')?.offsetWidth||300};
 const style={'--left-panel-width':collapsedLeft?'var(--rail-w)':widths?`${widths.left}px`:'var(--left-col)','--right-panel-width':collapsedRight?'0px':widths?`${widths.right}px`:'var(--right-col)'} as CSSProperties;
 return <main ref={host} className={'workspace resizable-workspace'+(dragging?' resizing-panels':'')+(collapsedLeft?' left-collapsed':'')+(collapsedRight?' right-collapsed':'')} style={style}>
  {children}
  {(['left','right'] as const).map(side=><div key={side} className={`panel-resizer panel-resizer-${side}`} role="separator" aria-label={side==='left'?'Ширина левой панели':'Ширина правой панели'} aria-orientation="vertical" aria-valuemin={side==='left'?180:240} aria-valuemax={Math.min(side==='left'?460:560,(host.current?.clientWidth||1600)-now[side==='left'?'right':'left']-320)} aria-valuenow={Math.round(now[side])} tabIndex={0} title="Потяните для изменения ширины. Двойной щелчок — по размеру экрана."
   onPointerDown={e=>{if(e.button!==0)return;e.preventDefault();drag.current={side,x:e.clientX,widths:{...measured()}};e.currentTarget.setPointerCapture(e.pointerId);setDragging(true);}}
   onPointerMove={e=>{const d=drag.current;if(!d||d.side!==side)return;change(side,d.widths[side]+(e.clientX-d.x)*(side==='left'?1:-1));}}
   onPointerUp={e=>{if(!drag.current)return;drag.current=null;setDragging(false);save();e.currentTarget.releasePointerCapture(e.pointerId);}}
   onLostPointerCapture={()=>{if(!drag.current)return;drag.current=null;setDragging(false);save();}}
   onDoubleClick={reset}
   onKeyDown={e=>{if(e.key!=='ArrowLeft'&&e.key!=='ArrowRight')return;e.preventDefault();change(side,measured()[side]+(e.key==='ArrowRight'?1:-1)*(side==='left'?1:-1)*(e.shiftKey?40:10));save();}}
  />)}
 </main>;
}
