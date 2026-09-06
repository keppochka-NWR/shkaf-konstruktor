import {useState} from 'react';
import type {Project} from './project';
import {moduleDrawingSVG,drawingTable,drawingsHTML} from './drawings';
import {saveFile} from './exports';
export function DrawingsPanel({project}:{project:Project}){
 const [selected,setSelected]=useState(project.modules[0].id),a=project.modules.find(a=>a.id===selected)||project.modules[0];
 return <div className="drawings-panel"><p className="field-note">Размерные виды для согласования наполнения. Фасады скрыты, боковой вид прозрачен. Все отметки отсчитываются от низа отдельного корпуса; присадка и программы станка не включены.</p><div className="output-actions"><select aria-label="Корпус на чертеже" value={a.id} onChange={e=>setSelected(e.target.value)}>{project.modules.map((a,i)=><option key={a.id} value={a.id}>{i+1}. {a.module.name}</option>)}</select><button className="primary" onClick={()=>saveFile('Размерные виды модулей.html',drawingsHTML(project))}>Скачать все чертежи / PDF</button></div><div dangerouslySetInnerHTML={{__html:moduleDrawingSVG(a.module)}}/><div className="drawing-table" dangerouslySetInnerHTML={{__html:drawingTable(a.module)}}/></div>;
}
