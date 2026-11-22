import {useState} from 'react';
import type {Project} from './project';
import {moduleDrawingSVG,drawingTable,drawingsHTML} from './drawings';
import {assemblySheet,assemblyHTML,assemblyStyle,type AssemblyView} from './assemblySheets';
import {printDocument} from './printDocument';
import {saveProductionFile} from './exports';
/** order — номер заказа: без него выгрузка чертежей производства закрыта, как карты, бирки и ZIP (T3, 18.10.2026). */
export function DrawingsPanel({project,order}:{project:Project;order:string}){
 const [selected,setSelected]=useState(project.modules[0]?.id??''),a=project.modules.find(a=>a.id===selected)||project.modules[0];
 const [views,setViews]=useState<Record<string,AssemblyView>>({}),[error,setError]=useState('');
 if(!a)return <p>Добавьте корпус для сборочного листа.</p>;
 const view=views[a.id]??'axonometric';
 return <div className="drawings-panel"><p className="field-note">Размерные виды для согласования наполнения. Фасады скрыты, боковой вид прозрачен. Все отметки отсчитываются от низа отдельного корпуса; присадка и программы станка не включены.</p><div className="output-actions"><select aria-label="Корпус на чертеже" value={a.id} onChange={e=>setSelected(e.target.value)}>{project.modules.map((a,i)=><option key={a.id} value={a.id}>{i+1}. {a.module.name}</option>)}</select><button className="primary" disabled={!order} onClick={()=>saveProductionFile(project,'Размерные виды модулей.html',()=>drawingsHTML(project))}>Скачать все чертежи / PDF</button></div><h3>Сборочный лист</h3><style>{assemblyStyle}</style><div className="output-actions"><label>Вид корпуса <select value={view} onChange={e=>setViews({...views,[a.id]:e.target.value as AssemblyView})}><option value="axonometric">Аксонометрия</option><option value="front">Спереди</option><option value="side">Сбоку</option></select></label><button disabled={!order} onClick={()=>{try{setError(printDocument(assemblyHTML(project,views),'Сборочные листы')?'':'Печать недоступна. Скачайте сборочные листы.');}catch(e){setError((e as Error).message);}}}>Печать сборочных листов / PDF</button><button disabled={!order} onClick={()=>saveProductionFile(project,'Сборочные листы.html',()=>assemblyHTML(project,views))}>Скачать сборочные листы</button></div>{error&&<p role="alert">{error}</p>}<div dangerouslySetInnerHTML={{__html:assemblySheet(a.module,project.modules.indexOf(a),view)}}/><h3>Размерные виды</h3><div dangerouslySetInnerHTML={{__html:moduleDrawingSVG(a.module)}}/><div className="drawing-table" dangerouslySetInnerHTML={{__html:drawingTable(a.module)}}/></div>;
}
