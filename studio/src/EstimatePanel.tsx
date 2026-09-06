import {useMemo,useState} from 'react';
import type {Project} from './project';
import {estimate} from './pricing';
export function EstimatePanel({project,update}:{project:Project;update:(p:Project)=>boolean}){
  const [missingOnly,setMissingOnly]=useState(false);
  const e=useMemo(()=>estimate(project),[project]),settings=project.calculation||{markup:2.2,overrides:{}};const rub=(n:number)=>n.toLocaleString('ru-RU')+' ₽';
  const lines=missingOnly?e.missing:e.lines;
  function resetPrice(id:string){const overrides={...settings.overrides};delete overrides[id];update({...project,calculation:{...settings,overrides}});}
  return <div className="estimate-panel"><h2>Смета проекта</h2><p className="field-note">Листы берутся из карт раскроя. Закупка, кромка, фурнитура и работа умножаются на коэффициент. Доставка, монтаж и неописанный крепёж в расчёт не включены.</p>
    <label className="hardware-field">Коэффициент к себестоимости<input type="number" aria-label="Коэффициент сметы" min={1} max={10} step={0.1} key={settings.markup} defaultValue={settings.markup} onKeyDown={ev=>{if(ev.key==='Enter')ev.currentTarget.blur();}} onBlur={ev=>{if(!update({...project,calculation:{...settings,markup:Number(ev.target.value)}}))ev.target.value=String(settings.markup);}}/></label>
    <div className="estimate-filter"><label><input type="checkbox" checked={missingOnly} onChange={ev=>setMissingOnly(ev.target.checked)}/> Только без цены ({e.missing.length})</label><span>{missingOnly?lines.length+' из ':''}{e.lines.length} позиций</span></div>
    {missingOnly&&!lines.length&&<p className="estimate-ready" role="status">Все цены заполнены. Снимите фильтр, чтобы просмотреть смету целиком.</p>}
    <table><thead><tr><th>Позиция</th><th>Кол-во</th><th>Цена, ₽</th><th>Сумма</th></tr></thead><tbody>{lines.map(l=><tr key={l.id} className={l.unitPrice===null?'price-missing':undefined}><td>{l.label}<small>{l.source}</small></td><td>{l.quantity} {l.unit}</td><td><input aria-label={'Цена: '+l.label} key={String(l.unitPrice)} type="number" min={0} placeholder="Уточнить" defaultValue={l.unitPrice??''} onKeyDown={ev=>{if(ev.key==='Enter')ev.currentTarget.blur();}} onBlur={ev=>{if(ev.target.value===''){ev.target.value=String(l.unitPrice??'');return;}const n=Number(ev.target.value);if(n===l.unitPrice)return;if(!update({...project,calculation:{...settings,overrides:{...settings.overrides,[l.id]:n}}}))ev.target.value=String(l.unitPrice??'');}}/>{Object.hasOwn(settings.overrides,l.id)&&<button className="price-reset" aria-label={'Убрать ручную цену: '+l.label} onClick={()=>resetPrice(l.id)}>Вернуть цену базы</button>}</td><td>{l.unitPrice===null?'—':rub(Math.round(l.quantity*l.unitPrice))}</td></tr>)}</tbody></table>
    <p className="field-note">Ручные цены действуют только в этом проекте. «Вернуть цену базы» убирает ручную правку; если исходной цены нет, позиция снова потребует уточнения. Итог всегда включает все позиции, независимо от фильтра.</p>
    <div className="estimate-total"><span>{e.missing.length?'Учтённая себестоимость':'Себестоимость'} <b>{rub(e.knownCost)}</b></span><strong>{e.retail===null?'Незаполненных цен: '+e.missing.length:'Расчётная цена '+rub(e.retail)}</strong></div>
    <button className="primary" disabled={e.retail===null} onClick={()=>update({...project,offer:{customer:project.offer?.customer||'',notes:project.offer?.notes||'',price:String(e.retail)}})}>Перенести цену в КП</button><p className="field-note">Сохранённая цена КП меняется только по этой кнопке. Перед предложением клиенту проверьте закупочные цены и условия заказа.</p>
  </div>;
}

