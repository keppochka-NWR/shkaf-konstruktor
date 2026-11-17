import {useState} from 'react';
import {premialCatalog} from './premialCatalog';
import {premialClientPrice} from './premialPricing';
import type {Project} from './project';

export function PremialCatalogPicker({project,commit}:{project:Project;commit:(p:Project)=>boolean}){
 const [query,setQuery]=useState('');
 const matches=premialCatalog.filter(d=>`${d.article} ${d.name}`.toLowerCase().includes(query.toLowerCase()));
 const change=(article:string,quantity:number)=>{
  if(!Number.isInteger(quantity)||quantity<0||quantity>10000)return;
  const extras=(project.premialExtras??[]).filter(d=>d.article!==article);
  if(quantity)extras.push({article,quantity});
  commit({...project,premialExtras:extras});
 };
 return <details style={{padding:'12px 16px'}}><summary>Каталог Premial · дополнительная фурнитура ({premialCatalog.length})</summary>
  <p>Дополнительные позиции к заказу. Уже учтённую в модели фурнитуру повторно добавлять не нужно. Добавление в смету не меняет конструкцию и 3D.</p>
  <p>Цена клиенту — цена сайта ×1,3. Количество задаётся в единицах продажи сайта: состав комплекта и упаковку смотрите в карточке.</p>
  <input aria-label="Найти фурнитуру Premial" placeholder="Артикул или название" value={query} onChange={e=>setQuery(e.target.value)}/>
  <div style={{maxHeight:320,overflow:'auto'}}>{matches.slice(0,100).map(d=><div key={d.article} style={{padding:8,borderBottom:'1px solid #ddd'}}>
   <a href={d.url} target="_blank" rel="noreferrer">{d.article} · {d.name}</a>
   <div style={{color:d.inStock===true?'#237342':d.inStock===false?'#a53d25':'#846013'}}>{d.availability}{d.refreshError?' · проверка не удалась':''}</div>
   <div>{premialClientPrice(d.sitePrice)?.toLocaleString('ru-RU')??'Цена уточняется'} ₽ / ед. сайта · {d.checkedAt}</div>
   <label>Дополнительно в заказ <input type="number" min={0} max={10000} step={1} value={project.premialExtras?.find(x=>x.article===d.article)?.quantity??0} onChange={e=>change(d.article,Number(e.target.value))}/></label>
  </div>)}{matches.length>100&&<p>Показаны первые 100 позиций. Уточните поиск.</p>}</div>
 </details>;
}
