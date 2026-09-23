import {useState} from 'react';
import {Box,Rows3,Shirt,Archive,PanelTop} from 'lucide-react';
import {initialModule,section,deskModule,distribute,validate,type Module} from './model';
export type ModuleKind='empty'|'shelves'|'wardrobe'|'drawers'|'desk';
const choices=[{id:'empty',label:'Пустой шкаф',icon:Box},{id:'shelves',label:'Стеллаж',icon:Rows3},{id:'wardrobe',label:'Для одежды',icon:Shirt},{id:'drawers',label:'Комод',icon:Archive},{id:'desk',label:'Стол',icon:PanelTop}] as const;
export function createModule(kind:ModuleKind,width:number,height:number,depth:number,source:Module):Module {
  let m:Module={...initialModule(),name:choices.find(c=>c.id===kind)!.label,width,height,depth,decor:source.decor,facadeDecor:source.facadeDecor,sections:[section()]};
  if(kind==='desk')m={...deskModule(m),width,height,depth};
  else {
    const s=m.sections[0];
    if(kind==='shelves'){m.doors=false;s.shelves=distribute(m,s,4);}
    if(kind==='wardrobe'){s.rod=true;s.shelves=distribute(m,s,1);}
    if(kind==='drawers'){m.doors=false;s.drawers=3;}
  }
  const error=validate(m)[0];if(error)throw Error(error);
  return m;
}
export function ModulePalette({source,onAdd}:{source:Module;onAdd:(module:Module)=>boolean}) {
  const [kind,setKind]=useState<ModuleKind>('empty'),[width,setWidth]=useState(600),[height,setHeight]=useState(2000),[depth,setDepth]=useState(550),[error,setError]=useState('');
  return <details className="module-palette" open><summary>Добавить мебель</summary>
    <div className="module-kinds">{choices.map(c=><button key={c.id} type="button" aria-pressed={kind===c.id} onClick={()=>{setKind(c.id);setHeight(c.id==='desk'?750:c.id==='drawers'?850:2000);setError('');}}><c.icon size={23}/><span>{c.label}</span></button>)}</div>
    <div className="module-sizes">{[{label:'Ширина',value:width,set:setWidth},{label:'Высота',value:height,set:setHeight},{label:'Глубина',value:depth,set:setDepth}].map(f=><label key={f.label}>{f.label}<input aria-label={`${f.label} новой мебели`} type="number" value={f.value} onChange={e=>f.set(Number(e.target.value))}/></label>)}</div>
    <small>Размеры в мм. Создаётся отдельный корпус.</small>
    {error&&<p role="alert">{error}</p>}
    <button className="primary full" onClick={()=>{try{if(onAdd(createModule(kind,width,height,depth,source)))setError('');}catch(e){setError((e as Error).message);}}}>Добавить в комнату</button>
  </details>;
}
