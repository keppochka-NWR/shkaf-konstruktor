import {useMemo,useState} from 'react';
import type {Project} from './project';
import {estimate,estimateCSV,engineNote} from './pricing';
import {saveFile,quoteBreakdown,splitRows} from './exports';
import {pendingTotalLabel} from './pendingPrices';
import {PUBLIC_BUILD} from './buildMode';
import {CLIENT_SOURCE_IN_SHEET} from './clientPrices';
import {estimateXLSX,ESTIMATE_XLSX_NAME} from './estimateXlsx';
import {saveBinary} from './xlsx';
export function EstimatePanel({project,update}:{project:Project;update:(p:Project)=>boolean}){
  const [missingOnly,setMissingOnly]=useState(false);
  const e=useMemo(()=>estimate(project),[project]),settings=project.calculation||{markup:2.2,overrides:{}};const rub=(n:number)=>n.toLocaleString('ru-RU')+' ₽';
  const lines=missingOnly?e.missing:e.lines;
  // разбивка «Материалы / Фурнитура / Двери купе» (сумма граф = итогу) и позиции после финального расчёта конструктором (решения 16.10.2026)
  const split=e.retail===null?null:quoteBreakdown(String(e.retail),e);
  const breakdown=<>{split&&<table className="estimate-split" aria-label="Разбивка стоимости"><tbody>{splitRows(split).map(([k,v])=><tr key={k}><td>{k}</td><td>{rub(v)}</td></tr>)}<tr><td>Итого</td><td>{rub(e.retail!)}</td></tr></tbody></table>}{e.pending.length>0&&<p className="estimate-pending" role="note">{pendingTotalLabel(e.pending.length)} — в итог не входят.</p>}</>;
  // публичная сборка: клиентские цены без себестоимости, коэффициентов и ручных правок (buildMode.ts)
  if(PUBLIC_BUILD)return <div className="estimate-panel"><h2>Смета проекта</h2><p className="field-note">Предварительный расчёт. Доставка и монтаж не включены.</p>
    <table><thead><tr><th>Позиция</th><th>Кол-во</th><th>Цена, ₽</th><th>Сумма</th></tr></thead><tbody>{e.lines.map(l=>{const inSheet=l.source===CLIENT_SOURCE_IN_SHEET;return <tr key={l.id} className={l.pending?'price-pending':l.unitPrice===null&&!inSheet?'price-missing':undefined}><td>{l.label}{l.unitPrice===null&&<small>{l.source}</small>}</td><td>{l.quantity} {l.unit}</td><td>{l.unitPrice===null?(inSheet?'входит':'—'):rub(l.unitPrice)}</td><td>{l.unitPrice===null?(inSheet?'входит':'—'):rub(Math.round(l.quantity*l.unitPrice))}</td></tr>;})}</tbody></table>
    <div className="estimate-total"><strong>{e.retail===null?'Стоимость уточнит менеджер':'Стоимость '+rub(e.retail)}</strong></div>
    {e.notice&&<p className="estimate-pending" role="note">{e.notice}.</p>}
    {e.needSheetPrice&&<label className="hardware-field">Цена за лист ЛДСП, ₽<input type="number" aria-label="Цена за лист" min={5000} max={100000} step={500} placeholder="Уточните у менеджера" onKeyDown={ev=>{if(ev.key==='Enter')ev.currentTarget.blur();}} onBlur={ev=>{if(ev.target.value==='')return;if(!update({...project,calculation:{...settings,sheetPrice:Number(ev.target.value)}}))ev.target.value='';}}/></label>}
    {breakdown}
  </div>;
  function resetPrice(id:string){const overrides={...settings.overrides};delete overrides[id];update({...project,calculation:{...settings,overrides}});}
  // цена — только по листам (решение Макса 30.10.2026): выбора модели и цены «по коэффициенту» нет
  return <div className="estimate-panel"><h2>Смета проекта</h2><p className="field-note">Цена — по листам: листы ЛДСП из карт раскроя × цена листа (плита, кромка, фурнитура и работа внутри) + позиции вне листа. Доставка, монтаж и неописанный крепёж в расчёт не включены.</p>
    <div className="estimate-models"><span>{rub(e.sheetPrice)}/лист × {e.ldspSheets}{e.retailExtras?<> + розница {rub(e.retailExtras)}</>:null}{e.offSheet?<> + вне листа (стекло, зеркало, столешница…) {rub(e.offSheet)}</>:null}{e.vernissageOnTop?<> + фасады Вернисаж {rub(e.vernissageOnTop)}</>:null}: <b>{rub(e.bySheet)}</b></span></div>
    <label className="hardware-field">Цена за лист ЛДСП, ₽<input type="number" aria-label="Цена за лист" min={5000} max={100000} step={500} key={e.sheetPrice} defaultValue={e.sheetPrice} onKeyDown={ev=>{if(ev.key==='Enter')ev.currentTarget.blur();}} onBlur={ev=>{if(!update({...project,calculation:{...settings,sheetPrice:Number(ev.target.value)}}))ev.target.value=String(e.sheetPrice);}}/></label>
    {e.vernissageCost>0&&<label className="hardware-field">Коэффициент на фасады Вернисаж<input type="number" aria-label="Коэффициент фасадов Вернисаж" min={1} max={10} step={0.1} key={e.vernissageMarkup} defaultValue={e.vernissageMarkup} onKeyDown={ev=>{if(ev.key==='Enter')ev.currentTarget.blur();}} onBlur={ev=>{if(!update({...project,calculation:{...settings,vernissageMarkup:Number(ev.target.value)}}))ev.target.value=String(e.vernissageMarkup);}}/></label>}
    <label className="hardware-field">Коэффициент к закупке вне листа (стекло, зеркало, столешница)<input type="number" aria-label="Коэффициент сметы" min={1} max={10} step={0.1} key={settings.markup} defaultValue={settings.markup} onKeyDown={ev=>{if(ev.key==='Enter')ev.currentTarget.blur();}} onBlur={ev=>{if(!update({...project,calculation:{...settings,markup:Number(ev.target.value)}}))ev.target.value=String(settings.markup);}}/></label>
    {e.vernissageCost>0&&<p className="field-note">Фасады Вернисаж: закупка по прайсу {rub(Math.round(e.vernissageCost))} × {String(e.vernissageMarkup).replace('.',',')} = {rub(e.vernissageOnTop)} клиенту, сверху листов.</p>}
    <p className="field-note">Цена по листам: лист ЛДСП по раскрою × цена листа (закупка, кромка, фурнитура и работа внутри) + розница (подсветка, двери купе, фурнитура по цене клиента) + сетка и ручки Лемана по выбору клиента + вне листа: стекло, зеркало, столешница, фасады поставщика (закупка × коэффициент; без цены — итог требует уточнения) + фасады Вернисаж (покупное изделие: закупка × {String(e.vernissageMarkup).replace('.',',')}). Подставляется в КП по кнопке ниже.</p>
    <div className="estimate-filter"><label><input type="checkbox" checked={missingOnly} onChange={ev=>setMissingOnly(ev.target.checked)}/> Только без цены ({e.missing.length})</label><span>{missingOnly?lines.length+' из ':''}{e.lines.length} позиций</span></div>
    {missingOnly&&!lines.length&&<p className="estimate-ready" role="status">Все цены заполнены. Снимите фильтр, чтобы просмотреть смету целиком.</p>}
    <table><thead><tr><th>Позиция</th><th>Кол-во</th><th>Цена, ₽</th><th>Сумма</th></tr></thead><tbody>{lines.map(l=><tr key={l.id} className={l.pending?'price-pending':l.unitPrice===null?'price-missing':undefined}><td>{l.label}<small>{l.source}</small></td><td>{l.quantity} {l.unit}</td><td><input aria-label={'Цена: '+l.label} key={String(l.unitPrice)} type="number" min={0} placeholder="Уточнить" defaultValue={l.unitPrice??''} onKeyDown={ev=>{if(ev.key==='Enter')ev.currentTarget.blur();}} onBlur={ev=>{if(ev.target.value===''){ev.target.value=String(l.unitPrice??'');return;}const n=Number(ev.target.value);if(n===l.unitPrice)return;if(!update({...project,calculation:{...settings,overrides:{...settings.overrides,[l.id]:n}}}))ev.target.value=String(l.unitPrice??'');}}/>{Object.hasOwn(settings.overrides,l.id)&&<button className="price-reset" aria-label={'Убрать ручную цену: '+l.label} onClick={()=>resetPrice(l.id)}>Вернуть цену базы</button>}</td><td>{l.unitPrice===null?'—':rub(Math.round(l.quantity*l.unitPrice))}</td></tr>)}</tbody></table>
    <p className="field-note">Ручные цены действуют только в этом проекте. «Вернуть цену базы» убирает ручную правку; если исходной цены нет, позиция снова потребует уточнения. Итог всегда включает все позиции, независимо от фильтра.</p>
    <button className="outline" onClick={()=>saveFile('Смета проекта.csv',estimateCSV(project,e),'text/csv;charset=utf-8')}>Скачать смету CSV</button> <button className="outline" onClick={()=>{void estimateXLSX(project,e).then(d=>saveBinary(ESTIMATE_XLSX_NAME,d));}}>Скачать Excel</button>
    <div className="estimate-total"><span>{e.missing.length?'Учтённая себестоимость':'Себестоимость'} <b>{rub(e.knownCost)}</b></span><strong>{e.retail===null?(e.unplaced?'Смета не завершена: не помещается в лист — '+e.unplaced:e.notice??'Без цены позиций вне листа: '+e.missingExtras):'Расчётная цена '+rub(e.retail)}</strong></div>
    {breakdown}
    <p className="field-note">{engineNote(e)}</p>
    <button className="primary" disabled={e.retail===null} onClick={()=>update({...project,offer:{customer:project.offer?.customer||'',notes:project.offer?.notes||'',price:String(e.retail)}})}>Перенести цену в КП</button><p className="field-note">Сохранённая цена КП меняется только по этой кнопке. Перед предложением клиенту проверьте закупочные цены и условия заказа.</p>
  </div>;
}

