import {useState} from 'react';
import {Box,Rows3,Shirt,Archive,PanelTop} from 'lucide-react';
import {initialModule,section,deskModule,distribute,validate,type Module} from './model';
import {createCornerModule} from './cornerWardrobe';
export type ModuleKind='empty'|'shelves'|'wardrobe'|'drawers'|'desk'|'corner';
const choices=[{id:'empty',label:'Пустой шкаф',icon:Box},{id:'shelves',label:'Стеллаж',icon:Rows3},{id:'wardrobe',label:'Для одежды',icon:Shirt},{id:'drawers',label:'Комод',icon:Archive},{id:'corner',label:'Угловой шкаф',icon:Box},{id:'desk',label:'Стол',icon:PanelTop}] as const;
export function createModule(kind:ModuleKind,width:number,height:number,depth:number,source:Module):Module {
  if(kind==='corner')return createCornerModule(width,height,depth,source);
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
    <div className="module-kinds">{choices.map(c=><button key={c.id} type="button" aria-pressed={kind===c.id} onClick={()=>{setKind(c.id);if(c.id==='corner'){setWidth(1050);setDepth(450);}else if(kind==='corner'){setWidth(600);setDepth(550);}setHeight(c.id==='desk'?750:c.id==='drawers'?850:2000);setError('');}}><c.icon size={23}/><span>{c.label}</span></button>)}</div>
    <div className="module-sizes">{[{label:kind==='corner'?'Сторона угла':'Ширина',value:width,set:setWidth},{label:'Высота',value:height,set:setHeight},{label:kind==='corner'?'Глубина боковины':'Глубина',value:depth,set:setDepth}].map(f=><label key={f.label}>{f.label}<input aria-label={`${f.label} новой мебели`} type="number" value={f.value} onChange={e=>f.set(Number(e.target.value))}/></label>)}</div>
    <small>{kind==='corner'?'Пятиугольный корпус с диагональными дверями и двумя боковыми блоками. Стороны угла одинаковые. Антресоль добавляется отдельно.':'Размеры в мм. Создаётся отдельный корпус.'}</small>
    {error&&<p role="alert">{error}</p>}
    <button className="primary full" onClick={()=>{try{if(onAdd(createModule(kind,width,height,depth,source)))setError('');}catch(e){setError((e as Error).message);}}}>Добавить в комнату</button>
  </details>;
}
