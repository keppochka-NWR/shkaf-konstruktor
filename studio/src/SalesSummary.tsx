import {useMemo} from 'react';
import type {Project} from './project';
import {estimate} from './pricing';
import {saveFile,quoteBreakdown,splitRows} from './exports';
import {pendingTotalLabel} from './pendingPrices';
/** Итог для клиента: «Материалы / Фурнитура / Двери купе / Итого» (сумма граф = итогу) и позиции после финального расчёта конструктором. */
export function salesCSV(project:Project){const e=estimate(project),split=e.retail===null?null:quoteBreakdown(String(e.retail),e);return '\ufeffПоказатель;Значение\r\n'+(split?splitRows(split).map(([k,v])=>k+';'+v+'\r\n').join(''):'')+'Итоговая стоимость;'+(e.retail??'Требует уточнения')+'\r\n'+(e.pending.length?pendingTotalLabel(e.pending.length).replace(': ',';')+'\r\n':'')+'Условия;Без доставки и монтажа\r\n';}
export function SalesSummary({project}:{project:Project}){
 const e=useMemo(()=>estimate(project),[project]),split=e.retail===null?null:quoteBreakdown(String(e.retail),e);
 return <section className="sales-summary"><h2>Итоговая стоимость проекта</h2><p className="sales-total">{e.retail===null?'Требует уточнения':e.retail.toLocaleString('ru-RU')+' ₽'}</p>{split&&<p className="sales-split">{splitRows(split).map(([k,v],i)=><span key={k}>{i?' · ':''}{i?k.toLowerCase():k}: <b>{v.toLocaleString('ru-RU')} ₽</b></span>)}</p>}<p>Предварительная стоимость без доставки и монтажа.</p>{e.pending.length>0&&<div role="note" className="sales-pending"><p>{pendingTotalLabel(e.pending.length)}. В итог не входят:</p><ul>{e.pending.map(line=><li key={line.id}>{line.label} · {line.quantity} {line.unit}</li>)}</ul></div>}{e.missing.length>0&&<div role="status"><p>Требуется уточнить стоимость следующих позиций:</p><ul>{e.missing.map(line=><li key={line.id}>{line.label} · {line.quantity} {line.unit}</li>)}</ul></div>}<button className="outline" onClick={()=>saveFile('Стоимость проекта.csv',salesCSV(project),'text/csv;charset=utf-8')}>Скачать итоговую стоимость</button></section>;
}