import {useState} from 'react';
import './legato.css';
import type {Module,Section} from './model';
import {INCLINED,legatoBlock,legatoByArticle,legatoLayout,legatoShelves,nextLegato,LEGATO_SOURCE,type ShoeShelf} from './legato';

export function LegatoPanel({m,s,modify}:{m:Module;s:Section;modify:(fn:(s:Section)=>void)=>unknown}){
  const [article,setArticle]=useState('180097'),block=legatoBlock(m);
  const update=(id:string,fn:(q:ShoeShelf)=>void)=>modify(n=>{const q=n.shoeShelves?.find(q=>q.id===id);if(q)fn(q);});
  const options=legatoShelves().sort((a,b)=>a.depth-b.depth||a.color.localeCompare(b.color));
  return <div data-testid="legato-panel">
    {block?<p className="field-note">{block}</p>:<>
    <label>Сетка для добавления<select aria-label="Сетка Premial для добавления" value={article} onChange={e=>setArticle(e.target.value)}>{options.map(p=><option key={p.article} value={p.article}>{p.depth} мм · {color(p.color)} · {p.price.toLocaleString('ru-RU')} ₽ / 3 м</option>)}</select></label>
    <button type="button" onClick={()=>modify(n=>{(n.shoeShelves??=[]).push(nextLegato(m,n,article));})}>Добавить сетку для обуви</button>
    {(s.shoeShelves??[]).map((q,i)=>{const a=legatoLayout(m,s,q),p=legatoByArticle(q.article)!;return <fieldset key={q.id}><legend>Сетка {i+1}</legend>
      <label>Глубина и цвет<select aria-label={`Сетка ${i+1}: изделие`} value={q.article} onChange={e=>update(q.id,n=>{n.article=e.target.value;if(!INCLINED[legatoByArticle(n.article)!.depth])n.mount='horizontal';})}>{options.map(p=><option key={p.article} value={p.article}>{p.depth} мм · {color(p.color)} · {p.article}</option>)}</select></label>
      <label>Установка<select aria-label={`Сетка ${i+1}: установка`} value={q.mount} onChange={e=>update(q.id,n=>{n.mount=e.target.value as ShoeShelf['mount'];})}><option value="horizontal">Горизонтально</option><option value="inclined" disabled={!INCLINED[p.depth]}>Под наклоном{!INCLINED[p.depth]?' — нет монтажной схемы':''}</option></select></label>
      <label>Низ сетки от низа корпуса, мм<input aria-label={`Сетка ${i+1}: высота`} type="number" key={q.y} defaultValue={q.y} min={0} max={m.height} step={1} onBlur={e=>{const v=e.currentTarget.valueAsNumber;if(Number.isFinite(v)&&v!==q.y)update(q.id,n=>{n.y=v;});else e.currentTarget.value=String(q.y);}} onKeyDown={e=>{if(e.key==='Enter')e.currentTarget.blur();}}/></label>
      {a&&<p className="field-note">Отрезок {a.w} × {p.depth} мм. Занимает по высоте {a.h} мм.</p>}
      <button type="button" onClick={()=>modify(n=>{n.shoeShelves=n.shoeShelves?.filter(v=>v.id!==q.id);if(!n.shoeShelves?.length)delete n.shoeShelves;})}>Убрать сетку {i+1}</button>
    </fieldset>;})}
    <p className="field-note">Задние клипсы и кронштейны крепятся к несущей панели или стене. ХДФ не является опорой. Крепление к стене подбирается по её материалу.</p>
    <p className="field-note">В смете — целые заготовки 3 м с совместным раскроем сеток одного артикула, карманы или кронштейны, клипсы и наконечники. Розничные цены для Нижегородской области от 05.11.2026.</p>
    <a href={LEGATO_SOURCE} target="_blank" rel="noreferrer">Каталог и монтаж Premial</a>
    </>}
  </div>;
}
function color(v:string){return ({white:'белая',black:'чёрный муар',chrome:'хром'} as Record<string,string>)[v]??v;}
