import {useState,useEffect} from 'react';
import {nicheMinimum,parseReadings,type Niche,type MeasureAxis} from './measurement';
const axes=[['width','Ширина'],['height','Высота'],['depth','Глубина']] as const;
export function NicheReadings({niche,onApply}:{niche:Niche;onApply:(n:Niche)=>boolean}){
 const [draft,setDraft]=useState<Record<MeasureAxis,string>>(()=>Object.fromEntries(axes.map(([axis])=>[axis,niche.readings?.[axis]?.join('; ')??''])) as Record<MeasureAxis,string>);
 const [error,setError]=useState('');
 const [status,setStatus]=useState('');
 const storedReadings=JSON.stringify(niche.readings??{});
 useEffect(()=>{const readings=JSON.parse(storedReadings);setDraft(Object.fromEntries(axes.map(([axis])=>[axis,readings[axis]?.join('; ')??''])) as Record<MeasureAxis,string>);},[storedReadings]);
 return <details className="niche-readings"><summary>Замеры в нескольких точках</summary>
  <p>Запишите размеры по одной и той же оси. Расчёт возьмёт минимальный. Разброс размеров не заменяет отклонение стены по уровню.</p>
  <form onSubmit={e=>{e.preventDefault();try{const next:Niche={...niche,readings:{}};for(const [axis] of axes){const values=parseReadings(draft[axis]);if(values.length)next.readings![axis]=values;else next[axis]=nicheMinimum(niche,axis);}if(onApply(next)){setError('');setStatus('Замеры сохранены. Минимумы учтены в расчёте ниши.');}}catch(e){setStatus('');setError((e as Error).message);}}}>
   {axes.map(([axis,label])=>{let preview='';try{const v=parseReadings(draft[axis]);if(v.length)preview=`Минимум ${Math.min(...v)} мм · разброс ${Math.round((Math.max(...v)-Math.min(...v))*10)/10} мм`;}catch{}return <label key={axis}>{label}, мм<input aria-label={label+' в нескольких точках'} value={draft[axis]} placeholder="2399; 2403; 2398" onChange={e=>{setDraft({...draft,[axis]:e.target.value});setError('');setStatus('');}}/><small>{preview||'Через пробел или точку с запятой'}</small></label>;})}
   {error&&<p role="alert">{error}</p>}<button className="outline" type="submit">Учесть замеры</button><p role="status">{status}</p>
  </form>
 </details>;
}
