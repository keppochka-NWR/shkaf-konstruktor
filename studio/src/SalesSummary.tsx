import {useMemo} from 'react';
import type {Project} from './project';
import {estimate} from './pricing';
import {saveFile,quoteBreakdown} from './exports';
export function salesCSV(project:Project){const e=estimate(project),split=e.retail===null?null:quoteBreakdown(String(e.retail),e);return '\ufeffПоказатель;Значение\r\nИтоговая стоимость;'+(e.retail??'Требует уточнения')+'\r\n'+(split?'Материалы;'+split.material+'\r\nФурнитура;'+split.hardware+'\r\n':'')+'Условия;Без доставки и монтажа\r\n';}
export function SalesSummary({project}:{project:Project}){
 const e=useMemo(()=>estimate(project),[project]),split=e.retail===null?null:quoteBreakdown(String(e.retail),e);
 return <section className="sales-summary"><h2>Итоговая стоимость проекта</h2><p className="sales-total">{e.retail===null?'Требует уточнения':e.retail.toLocaleString('ru-RU')+' ₽'}</p>{split&&<p className="sales-split">Материалы: <b>{split.material.toLocaleString('ru-RU')} ₽</b> · фурнитура: <b>{split.hardware.toLocaleString('ru-RU')} ₽</b></p>}<p>Предварительная стоимость без доставки и монтажа.</p>{e.missing.length>0&&<div role="status"><p>Требуется уточнить стоимость следующих позиций:</p><ul>{e.missing.map(line=><li key={line.id}>{line.label} · {line.quantity} {line.unit}</li>)}</ul></div>}<button className="outline" onClick={()=>saveFile('Стоимость проекта.csv',salesCSV(project),'text/csv;charset=utf-8')}>Скачать итоговую стоимость</button></section>;
}
