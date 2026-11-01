// Верхняя полоса сцены (Макс 31.10: «"Двигать корпуса" и прочее в одну линию с видами»; долг 30.10 — без прозрачной подложки).
// Макс 01.11: «иконки мне всё же не нравятся, они непонятные, давай вернём текстовое описание» — виды и режимы подписями (клавиша — в подсказке).
// Не влезает в строку — переносится, а не прячет подписи: высота полосы уходит в --toolbar-h, сцена и плашки встают под неё.
import {useLayoutEffect,useRef,type ReactNode} from 'react';

export type ToolbarView='iso'|'front'|'left'|'side'|'top'|'plan';
export const VIEW_BUTTONS:{id:ToolbarView;label:string;title:string;key:string}[]=[
 {id:'iso',label:'3D',title:'Объёмный вид (3D)',key:'E'},
 {id:'front',label:'Спереди',title:'Вид спереди',key:'S'},
 {id:'left',label:'Слева',title:'Вид слева',key:'A'},
 {id:'side',label:'Справа',title:'Вид справа',key:'D'},
 {id:'top',label:'Сверху',title:'Вид сверху',key:'W'},
 {id:'plan',label:'План',title:'План комнаты',key:'P'},
];

/** Кнопки видов. active — текущий вид (plan — открыт план); hidden — скрытые виды (показ клиенту без плана). */
export function ViewButtons({active,onView,hidden=[]}:{active:ToolbarView;onView:(v:ToolbarView)=>void;hidden?:ToolbarView[]}){
 return <div className="view-tabs" data-tour="views" role="group" aria-label="Вид">{VIEW_BUTTONS.filter(v=>!hidden.includes(v.id)).map(v=><button key={v.id} type="button" className="view-button" aria-label={v.label} title={`${v.title} · клавиша ${v.key}`} aria-pressed={active===v.id} onClick={e=>{e.currentTarget.blur();onView(v.id);}}>{v.label}</button>)}</div>;
}

/** Полоса над сценой: виды, затем режимы/переключатели. Сплошной фон, сцена начинается под полосой. */
export function SceneToolbar({views,children,end}:{views:ReactNode;children?:ReactNode;end?:ReactNode}){
 const ref=useRef<HTMLDivElement>(null);
 useLayoutEffect(()=>{const bar=ref.current,host=bar?.parentElement;if(!bar||!host)return;
  const sync=()=>host.style.setProperty('--toolbar-h',bar.offsetHeight+'px');sync();
  if(typeof ResizeObserver==='undefined')return;const o=new ResizeObserver(sync);o.observe(bar);return()=>o.disconnect();},[]);
 return <div ref={ref} className="scene-toolbar" role="toolbar" aria-label="Вид и режим сцены">{views}{children&&<span className="toolbar-sep" aria-hidden="true"/>}{children}{end&&<span className="toolbar-end">{end}</span>}</div>;
}
