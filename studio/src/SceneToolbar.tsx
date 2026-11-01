// Верхняя полоса сцены как в Базисе (Макс 31.10: «виды упростить — иконки как в Базисе, "Двигать корпуса" и прочее в одну линию с видами»;
// долг 30.10 — без прозрачной подложки). Одна строка: иконки видов · разделитель · режимы и переключатели (children).
// Подписи видов — в aria-label (сценарии ищут кнопки по имени «3D», «Спереди», «Сбоку», «Сверху», «План»), клавиша — в подсказке.
import type {ReactNode} from 'react';

export type ToolbarView='iso'|'front'|'left'|'side'|'top'|'plan';
export const VIEW_BUTTONS:{id:ToolbarView;label:string;title:string;key:string}[]=[
 {id:'iso',label:'3D',title:'Объёмный вид (3D)',key:'E'},
 {id:'front',label:'Спереди',title:'Вид спереди',key:'S'},
 {id:'left',label:'Слева',title:'Вид слева',key:'A'},
 {id:'side',label:'Сбоку',title:'Вид справа (сбоку)',key:'D'},
 {id:'top',label:'Сверху',title:'Вид сверху',key:'W'},
 {id:'plan',label:'План',title:'План комнаты',key:'P'},
];

/** Значок вида как в Базисе: куб, у которого залита грань, на которую смотрим (3D — все грани светлые, план — стены сверху). */
export function ViewIcon({view,size=20}:{view:ToolbarView;size?:number}){
 const s={fill:'none',stroke:'currentColor',strokeWidth:1.5,strokeLinejoin:'round' as const};
 const face=(points:string,on:boolean)=><polygon points={points} {...s} fill={on?'currentColor':'none'} fillOpacity={on?.78:0}/>;
 let body:ReactNode;
 if(view==='iso')body=<><polygon points="12,3 21,7.5 12,12 3,7.5" {...s} fill="currentColor" fillOpacity={.35}/><polygon points="3,7.5 12,12 12,21 3,16.5" {...s} fill="currentColor" fillOpacity={.14}/><polygon points="12,12 21,7.5 21,16.5 12,21" {...s} fill="currentColor" fillOpacity={.6}/></>;
 else if(view==='left')body=<>{face('8,8 21,8 21,21 8,21',false)}{face('3,3 16,3 21,8 8,8',false)}{face('3,3 8,8 8,21 3,16',true)}</>;
 else if(view==='plan')body=<><path d="M3 3h18v18h-8M9 21H3V3" {...s} strokeWidth={2.2}/><path d="M9 21a4 4 0 0 1 4-4" {...s}/><rect x="5.5" y="5.5" width="7" height="4" rx=".5" {...s} fill="currentColor" fillOpacity={.35}/></>;
 else body=<>{face('3,8 16,8 16,21 3,21',view==='front')}{face('3,8 8,3 21,3 16,8',view==='top')}{face('16,8 21,3 21,16 16,21',view==='side')}</>;
 return <svg className="view-icon" width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" focusable="false">{body}</svg>;
}

/** Иконки видов. active — текущий вид (plan — открыт план); hidden — скрытые виды (показ клиенту без плана). */
export function ViewButtons({active,onView,hidden=[]}:{active:ToolbarView;onView:(v:ToolbarView)=>void;hidden?:ToolbarView[]}){
 return <div className="view-tabs" data-tour="views" role="group" aria-label="Вид">{VIEW_BUTTONS.filter(v=>!hidden.includes(v.id)).map(v=><button key={v.id} type="button" className="view-button" aria-label={v.label} title={`${v.title} · клавиша ${v.key}`} aria-pressed={active===v.id} onClick={e=>{e.currentTarget.blur();onView(v.id);}}><ViewIcon view={v.id}/><span className="sr-only">{v.label}</span></button>)}</div>;
}

/** Одна строка над сценой: виды, затем режимы/переключатели. Сплошной фон, сцена начинается под полосой. */
export function SceneToolbar({views,children,end}:{views:ReactNode;children?:ReactNode;end?:ReactNode}){
 return <div className="scene-toolbar" role="toolbar" aria-label="Вид и режим сцены">{views}{children&&<span className="toolbar-sep" aria-hidden="true"/>}{children}{end&&<span className="toolbar-end">{end}</span>}</div>;
}
