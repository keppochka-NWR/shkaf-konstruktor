import {useEffect,useRef,useState,type CSSProperties,type ReactNode} from 'react';

const KEY='yo-constructor-panel-widths-v1';
type Side='left'|'right';
/** null — сторона идёт по токену экрана (--left-col/--right-col), число — ширина, заданная мышью. */
type Widths={left:number|null;right:number|null};
const LIMIT={left:{min:180,max:460},right:{min:240,max:560}};
const BY_SCREEN:Widths={left:null,right:null};
/** Сцене всегда остаётся не меньше этого (критик 31.10: при 320 полоса видов и режимов не помещалась). */
export const MIN_SCENE=480;
const clampSide=(side:Side,value:number)=>Math.max(LIMIT[side].min,Math.min(LIMIT[side].max,value));
// Макс 31.10 «универсальный размер на всех мониторах»: пока ширину не тянули мышью, колонка — по токену (clamp от ширины экрана,
// ui-layout.css); потянули — ширина этой стороны в px запоминается; двойной щелчок по разделителю возвращает к экрану только её.
function stored():Widths {
 try {
  const value=JSON.parse(localStorage.getItem(KEY)||'null');
  if(value)return {left:Number.isFinite(value.left)?clampSide('left',value.left):null,right:Number.isFinite(value.right)?clampSide('right',value.right):null};
 }catch{}
 return BY_SCREEN;
}
/** Запомненные ширины на меньшем окне: сначала ужимается правая, затем левая, сцене остаётся MIN_SCENE. px — фактические ширины сторон. */
export function fitWidths(value:Widths,width:number,px:{left:number;right:number}):Widths {
 const left=value.left===null?null:Math.max(LIMIT.left.min,Math.min(value.left,width-MIN_SCENE-LIMIT.right.min));
 const leftPx=left??px.left;
 const right=value.right===null?null:Math.max(LIMIT.right.min,Math.min(value.right,width-leftPx-MIN_SCENE));
 return left===value.left&&right===value.right?value:{left,right};
}

/** Настройка приложения, не зависит от проекта и его истории отмены.
 *  collapsedLeft — левая колонка свёрнута в полосу значков; collapsedRight — правой колонки нет (этап «Помещение»: всё слева). */
export function WorkspacePanels({children,collapsedLeft=false,collapsedRight=false}:{children:ReactNode;collapsedLeft?:boolean;collapsedRight?:boolean}) {
 const host=useRef<HTMLElement>(null),[widths,setWidths]=useState(stored),[dragging,setDragging]=useState(false);
 const drag=useRef<{side:Side;x:number;start:number}|null>(null);
 const live=useRef(widths);live.current=widths;
 /** Ширина токена в px: свёрнутая сторона своей ширины не даёт. */
 const token=(side:Side)=>{const el=host.current,fallback=side==='left'?250:300;if(!el)return fallback;const probe=document.createElement('div');probe.style.cssText=`position:absolute;visibility:hidden;width:var(${side==='left'?'--left-col':'--right-col'})`;el.appendChild(probe);const w=probe.offsetWidth;probe.remove();return w||fallback;};
 /** Фактическая ширина стороны: заданная мышью или токен. */
 const px=(side:Side)=>live.current[side]??token(side);
 useEffect(()=>{
  const element=host.current!;
  const observer=new ResizeObserver(()=>{if(element.clientWidth>=901)setWidths(w=>fitWidths(w,element.clientWidth,{left:px('left'),right:px('right')}));});
  observer.observe(element);return()=>observer.disconnect();
 },[]);
 const save=()=>{try{if(live.current.left===null&&live.current.right===null)localStorage.removeItem(KEY);else localStorage.setItem(KEY,JSON.stringify(live.current));}catch{}};
 const change=(side:Side,value:number)=>{
  const available=host.current!.clientWidth,other:Side=side==='left'?'right':'left';
  const next={...live.current,[side]:clampSide(side,Math.min(available-px(other)-MIN_SCENE,value))};
  live.current=next;setWidths(next);
 };
 const reset=(side:Side)=>{const next={...live.current,[side]:null};live.current=next;setWidths(next);save();};
 const style={'--left-panel-width':collapsedLeft?'var(--rail-w)':widths.left!==null?`${widths.left}px`:'var(--left-col)','--right-panel-width':collapsedRight?'0px':widths.right!==null?`${widths.right}px`:'var(--right-col)'} as CSSProperties;
 const now=(side:Side)=>widths[side]??(host.current?token(side):LIMIT[side].min);
 return <main ref={host} className={'workspace resizable-workspace'+(dragging?' resizing-panels':'')+(collapsedLeft?' left-collapsed':'')+(collapsedRight?' right-collapsed':'')} style={style}>
  {children}
  {(['left','right'] as const).map(side=><div key={side} className={`panel-resizer panel-resizer-${side}`} role="separator" aria-label={side==='left'?'Ширина левой панели':'Ширина правой панели'} aria-orientation="vertical" aria-valuemin={LIMIT[side].min} aria-valuemax={Math.min(LIMIT[side].max,(host.current?.clientWidth||1600)-now(side==='left'?'right':'left')-MIN_SCENE)} aria-valuenow={Math.round(now(side))} tabIndex={0} title="Потяните для изменения ширины. Двойной щелчок — по размеру экрана."
   onPointerDown={e=>{if(e.button!==0)return;e.preventDefault();drag.current={side,x:e.clientX,start:px(side)};e.currentTarget.setPointerCapture(e.pointerId);setDragging(true);}}
   onPointerMove={e=>{const d=drag.current;if(!d||d.side!==side)return;change(side,d.start+(e.clientX-d.x)*(side==='left'?1:-1));}}
   onPointerUp={e=>{if(!drag.current)return;drag.current=null;setDragging(false);save();e.currentTarget.releasePointerCapture(e.pointerId);}}
   onLostPointerCapture={()=>{if(!drag.current)return;drag.current=null;setDragging(false);save();}}
   onDoubleClick={()=>reset(side)}
   onKeyDown={e=>{if(e.key!=='ArrowLeft'&&e.key!=='ArrowRight')return;e.preventDefault();change(side,px(side)+(e.key==='ArrowRight'?1:-1)*(side==='left'?1:-1)*(e.shiftKey?40:10));save();}}
  />)}
 </main>;
}

/** Пока тянут корпус в сцене (кнопка нажата и видна плашка размера), колонки приглушены; отпустили или окно потеряло фокус — снято.
 *  Отдельный признак на html: линия Q держит плашку без нажатой кнопки и не приглушает колонки (критик 31.10). */
export function useSceneDragFade(){
 useEffect(()=>{
  const root=document.documentElement;let down=false;
  const clear=()=>{down=false;delete root.dataset.sceneDrag;};
  const press=(e:PointerEvent)=>{if(e.button===0)down=true;};
  const move=()=>{if(!down)return;if(document.querySelector('.viewport .drag-badge:not([hidden])'))root.dataset.sceneDrag='1';else delete root.dataset.sceneDrag;};
  window.addEventListener('pointerdown',press,true);window.addEventListener('pointermove',move,true);window.addEventListener('pointerup',clear,true);window.addEventListener('pointercancel',clear,true);window.addEventListener('blur',clear);
  return()=>{clear();window.removeEventListener('pointerdown',press,true);window.removeEventListener('pointermove',move,true);window.removeEventListener('pointerup',clear,true);window.removeEventListener('pointercancel',clear,true);window.removeEventListener('blur',clear);};
 },[]);
}
