import type {Project} from './project';
import {estimate} from './pricing';
export function EstimatePanel({project,update}:{project:Project;update:(p:Project)=>boolean}){
  const e=estimate(project),settings=project.calculation||{markup:2.2,overrides:{}};const rub=(n:number)=>n.toLocaleString('ru-RU')+' ₽';
  return <div className="estimate-panel"><h2>Смета проекта</h2><p className="field-note">Листы берутся из карт раскроя. Закупка, кромка, фурнитура и работа умножаются на коэффициент. Доставка, монтаж и неописанный крепёж в расчёт не включены.</p>
    <label className="hardware-field">Коэффициент к себестоимости<input type="number" aria-label="Коэффициент сметы" min={1} max={10} step={0.1} defaultValue={settings.markup} onBlur={ev=>{if(!update({...project,calculation:{...settings,markup:Number(ev.target.value)}}))ev.target.value=String(settings.markup);}}/></label>
    <table><thead><tr><th>Позиция</th><th>Кол-во</th><th>Цена, ₽</th><th>Сумма</th></tr></thead><tbody>{e.lines.map(l=><tr key={l.id}><td>{l.label}<small>{l.source}</small></td><td>{l.quantity} {l.unit}</td><td><input aria-label={'Цена: '+l.label} key={String(l.unitPrice)} type="number" min={0} placeholder="Уточнить" defaultValue={l.unitPrice??''} onBlur={ev=>{if(ev.target.value==='')return;const n=Number(ev.target.value);if(n===l.unitPrice)return;if(!update({...project,calculation:{...settings,overrides:{...settings.overrides,[l.id]:n}}}))ev.target.value=String(l.unitPrice??'');}}/></td><td>{l.unitPrice===null?'—':rub(Math.round(l.quantity*l.unitPrice))}</td></tr>)}</tbody></table>
    <div className="estimate-total"><span>{e.missing.length?'Учтённая себестоимость':'Себестоимость'} <b>{rub(e.knownCost)}</b></span><strong>{e.retail===null?'Нужны цены по '+e.missing.length+' позициям':'Расчётная цена '+rub(e.retail)}</strong></div>
    <button className="primary" disabled={e.retail===null} onClick={()=>update({...project,offer:{customer:project.offer?.customer||'',notes:project.offer?.notes||'',price:String(e.retail)}})}>Перенести цену в КП</button><p className="field-note">Сохранённая цена КП меняется только по этой кнопке. Перед предложением клиенту проверьте закупочные цены и условия заказа.</p>
  </div>;
}

