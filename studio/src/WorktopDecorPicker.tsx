import {textureContentStyle} from './textureContent';
import {useState} from 'react';
import type {Module} from './model';
import {worktopDecors} from './worktopCatalog';

export function WorktopDecorPicker({module,apply}:{module:Module;apply:(name:string)=>void}){
 const [query,setQuery]=useState('');
 const decors=worktopDecors(module.worktop!.material);
 return <>
  <p>Декор столешницы «{module.name}». Материалы корпусов не меняются.</p>
  <label className="search"><input autoFocus aria-label="Найти декор столешницы" placeholder="Название, артикул или бренд" value={query} onChange={e=>setQuery(e.target.value)}/></label>
  {!decors.length&&<p role="status">Каталог этого материала ещё не подключён. Существующий декор сохранён.</p>}
  <div className="decor-grid">{decors.filter(d=>`${d.n} ${d.brand}`.toLowerCase().includes(query.toLowerCase())).map(d=><button key={d.n} aria-pressed={module.decor===d.n} disabled={'withdrawal' in d&&d.withdrawal===true} onClick={()=>apply(d.n)}>
   <span style={{backgroundImage:d.tex?`url("${d.tex}")`:undefined,backgroundColor:'#e6e2d9',...(d.tex?textureContentStyle(d.tex):{})}}/>{d.n}<small>{d.brand}{!d.tex?' · фото уточняется':''}{'withdrawal' in d&&d.withdrawal?' · выводится':''}</small>
  </button>)}</div>
 </>;
}
