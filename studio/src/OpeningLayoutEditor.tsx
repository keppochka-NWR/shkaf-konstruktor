import {useEffect,useState} from 'react';
import {boxes,id,type Module} from './model';
import {layoutSplits,splitOpening,setPartition} from './sectionLayout';
function Dimension({label,value,change}:{label:string;value:number;change:(v:number)=>boolean}){
  const [text,setText]=useState(String(value));useEffect(()=>setText(String(value)),[value]);
  return <label className="hardware-field">{label}<input aria-label={label} type="number" value={text} onChange={e=>setText(e.target.value)} onBlur={()=>{if(text===''||(Number(text)!==value&&!change(Number(text))))setText(String(value));}} onKeyDown={e=>{if(e.key==='Enter')e.currentTarget.blur();}}/></label>;
}
export default function OpeningLayoutEditor({module:m,sid,edit}:{module:Module;sid:string;edit:(f:(draft:Module)=>void)=>boolean}){
  const b=boxes(m).find(v=>v.id===sid)!;
  return <div className="property-section" data-stages="filling bodies">
    <h3>Разделение проёмов</h3>
    <p>Выбран проём {Math.round(b.width)} × {Math.round(b.top-b.bottom)} мм. Низ — {Math.round(b.bottom)} мм от пола корпуса.</p>
    <div className="quick-actions">
      <button className="outline" disabled={m.sections.length>=4||m.doors} onClick={()=>edit(n=>splitOpening(n,sid,'x',Math.round((b.width-16)/2),id()))}>Разделить по ширине</button>
      <button className="outline" disabled={m.sections.length>=4||m.doors} onClick={()=>edit(n=>splitOpening(n,sid,'y',Math.round((b.top-b.bottom-16)/2),id()))}>Разделить по высоте</button>
    </div>
    <p className="field-note">Перегородка появляется только внутри выбранного проёма. Горизонтальное разделение создаёт общую жёсткую полку. До четырёх проёмов в корпусе.</p>
    {m.sectionLayout&&layoutSplits(m.sectionLayout).map((n,i)=><Dimension key={n.id} label={`${i+1}. ${n.axis==='x'?'Левый проём':'Нижний проём'}, мм`} value={n.at} change={v=>edit(d=>setPartition(d,n.id,v))}/>)}
  </div>;
}
