import {useMemo} from 'react';
import type {Project} from './project';
import {estimate} from './pricing';
import {saveFile} from './exports';
export function salesCSV(project:Project){const e=estimate(project);return '\ufeffПоказатель;Значение\r\nИтоговая стоимость;'+(e.retail??'Требует уточнения')+'\r\nУсловия;Без доставки и монтажа\r\n';}
export function SalesSummary({project}:{project:Project}){
 const e=useMemo(()=>estimate(project),[project]);
 return <section className="sales-summary"><h2>Итоговая стоимость проекта</h2><p className="sales-total">{e.retail===null?'Требует уточнения':e.retail.toLocaleString('ru-RU')+' ₽'}</p><p>Предварительная стоимость без доставки и монтажа.</p>{e.missing.length>0&&<div role="status"><p>Требуется уточнить стоимость следующих позиций:</p><ul>{e.missing.map(line=><li key={line.id}>{line.label} · {line.quantity} {line.unit}</li>)}</ul></div>}<button className="outline" onClick={()=>saveFile('Стоимость проекта.csv',salesCSV(project),'text/csv;charset=utf-8')}>Скачать итоговую стоимость</button></section>;
}
