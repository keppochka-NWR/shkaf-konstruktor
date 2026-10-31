import {Fragment,useMemo,useState} from 'react';
import {estimateXLSX,ESTIMATE_XLSX_NAME} from './estimateXlsx';
import {saveBinary} from './xlsx';
import type {Project} from './project';
import {estimate} from './pricing';
import {nest} from './exports';
import {saveFile,quoteBreakdown,splitRows} from './exports';
import {pendingTotalLabel} from './pendingPrices';
import {estimateBreakdown,itemShares,breakdownText,breakdownHTML,groupBadge,STATUS_TEXT,type BreakdownRow} from './estimateBreakdown';
import {PENDING_ITEM_PRICE} from './itemPrices';
import {printDocument} from './printDocument';
// стили — в OutputPanel (estimate-breakdown.css): этот файл читают тесты и комплект на проверку (salesCSV), им CSS не нужен
/** Итог для клиента: «Материалы / Фурнитура / Двери купе / Итого» (сумма граф = итогу) и позиции после финального расчёта конструктором. */
export function salesCSV(project:Project){const e=estimate(project),split=e.retail===null?null:quoteBreakdown(String(e.retail),e);return '﻿Показатель;Значение\r\n'+(split?splitRows(split).map(([k,v])=>k+';'+v+'\r\n').join(''):'')+'Итоговая стоимость;'+(e.retail??'Требует уточнения')+'\r\n'+(e.pending.length?pendingTotalLabel(e.pending.length).replace(': ',';')+'\r\n':'')+'Условия;Без доставки и монтажа\r\n';}
const rub=(v:number)=>v.toLocaleString('ru-RU')+' ₽';
const qty=(r:BreakdownRow)=>String(Math.round(r.qty*1000)/1000).replace('.',',')+' '+r.unit;
export function SalesSummary({project}:{project:Project}){
 // Макс 31.10: подробная стоимость — листы по декорам, допы по группам, итог; те же plan/estimate, что у итога (цена не пересчитывается)
 const {e,b}=useMemo(()=>{const plan=nest(project),e=estimate(project,plan);return {e,b:estimateBreakdown(project,plan,e)};},[project]);
 const split=e.retail===null?null:quoteBreakdown(String(e.retail),e);
 const [xlsx,setXlsx]=useState('');
 const [open,setOpen]=useState<Record<string,boolean>>({});
 const [itemsOpen,setItemsOpen]=useState(false);
 // цены изделий — смета каждого изделия отдельно, это дорого: только когда раздел раскрыт
 const items=useMemo(()=>itemsOpen&&project.modules.length>1?itemShares(project,e.retail):null,[itemsOpen,project,e.retail]);
 const allOpen=b.groups.every(g=>open[g.id]);
 const toggleAll=()=>setOpen(allOpen?{}:Object.fromEntries(b.groups.map(g=>[g.id,true])));
 async function excel(){setXlsx('Готовим файл…');try{saveBinary(ESTIMATE_XLSX_NAME,await estimateXLSX(project,e));setXlsx('Файл «'+ESTIMATE_XLSX_NAME+'» передан браузеру: листы «Смета», «Детали», «Кратко для клиента».');}catch(err){setXlsx(err instanceof Error?err.message:'Не удалось подготовить Excel.');}}
 async function copy(){try{await navigator.clipboard.writeText(breakdownText(b));setXlsx('Стоимость скопирована — вставьте в письмо или мессенджер.');}catch{setXlsx('Браузер не дал скопировать. Используйте «Печать / PDF».');}}
 function print(){if(!printDocument(breakdownHTML(b,'Стоимость проекта',project.modules.length>1?itemShares(project,e.retail):null),'Стоимость проекта'))setXlsx('Браузер не открыл печать.');}
 return <section className="sales-summary"><h2>Итоговая стоимость проекта</h2><p className="sales-total">{e.retail===null?'Требует уточнения':e.retail.toLocaleString('ru-RU')+' ₽'}</p>{split&&<p className="sales-split">{splitRows(split).map(([k,v],i)=><span key={k}>{i?' · ':''}{i?k.toLowerCase():k}: <b>{v.toLocaleString('ru-RU')} ₽</b></span>)}</p>}<p>Предварительная стоимость без доставки и монтажа.</p>
  <div className="estimate-breakdown" data-testid="estimate-breakdown">
   <div className="eb-head"><h3>Из чего складывается цена</h3><button className="text-action" onClick={toggleAll}>{allOpen?'Свернуть всё':'Развернуть всё'}</button></div>
   <p className="field-note">Цена — листы ЛДСП в раскрое × {rub(b.sheetPrice)} (плита, кромка, фурнитура корпуса и работа) + позиции вне листа.{b.hdfSheets?` ЛХДФ (задники, дно ящиков) — ${b.hdfSheets} л., в цене листов.`:''}</p>
   {b.groups.map(g=><details key={g.id} className="eb-group" data-group={g.id} open={!!open[g.id]} onToggle={ev=>{const o=(ev.currentTarget as HTMLDetailsElement).open;if(o!==!!open[g.id])setOpen(s=>({...s,[g.id]:o}));}}>
    <summary><span className="eb-title">{g.title}</span><span className="eb-count">{g.rows.length} поз.{g.inSheet?` · ${g.inSheet} в цене листов`:''}{g.pending?` · ${g.pending} после расчёта`:''}{g.missing?<b className="eb-missing"> · {g.missing} без цены</b>:''}</span><b className="eb-sum">{(s=>s?<span className="eb-badge">{STATUS_TEXT[s]}</span>:rub(g.total))(groupBadge(g))}</b></summary>
    <table className="eb-table"><tbody>{g.rows.map((r,i)=><Fragment key={r.id}>{r.sub&&r.sub!==g.rows[i-1]?.sub&&<tr className="eb-sub"><th colSpan={4}>{r.sub}</th></tr>}<tr className={'eb-row '+r.status}><td>{r.label}</td><td className="n">{qty(r)}</td><td className="n">{r.status==='priced'&&r.price!==null?'× '+rub(r.price):''}</td><td className="n">{r.status==='priced'?rub(r.amount!):<span className="eb-badge">{STATUS_TEXT[r.status]}</span>}</td></tr></Fragment>)}</tbody></table>
   </details>)}
   {e.retail!==null&&b.rounding!==0&&<p className="eb-line"><span>Округление до итога</span><b>{b.rounding>0?'+':''}{rub(b.rounding)}</b></p>}
   <p className="eb-line eb-total"><span>Итого</span><b>{e.retail===null?'требует уточнения · учтено '+rub(b.sum):rub(e.retail)}</b></p>
   {project.modules.length>1&&<details className="eb-group eb-items" open={itemsOpen} onToggle={ev=>setItemsOpen((ev.currentTarget as HTMLDetailsElement).open)}><summary><span className="eb-title">По изделиям</span><span className="eb-count">доля итога на каждое изделие</span></summary>
    {itemsOpen&&(items?<table className="eb-table"><tbody>{items.map((it,i)=><tr key={i}><td>{it.name}</td><td className="n">{it.price===null?<span className="eb-badge">{PENDING_ITEM_PRICE}</span>:rub(it.price)}</td></tr>)}</tbody></table>:<p className="field-note">Не делится по изделиям: нет итога или у изделия нет цены.</p>)}</details>}
  </div>
  {e.pending.length>0&&<div role="note" className="sales-pending"><p>{pendingTotalLabel(e.pending.length)}. В итог не входят:</p><ul>{e.pending.map(line=><li key={line.id}>{line.label} · {line.quantity} {line.unit}</li>)}</ul></div>}{e.missingExtrasLines.length>0&&<div role="status"><p>Требуется уточнить стоимость следующих позиций:</p><ul>{e.missingExtrasLines.map(line=><li key={line.id}>{line.label} · {line.quantity} {line.unit}</li>)}</ul></div>}
  <div className="eb-actions"><button className="outline" onClick={copy}>Копировать</button> <button className="outline" onClick={print}>Печать / PDF</button> <button className="outline" onClick={()=>saveFile('Стоимость проекта.csv',salesCSV(project),'text/csv;charset=utf-8')}>Скачать итоговую стоимость</button> <button className="outline" onClick={excel}>Скачать Excel</button></div>{xlsx&&<p className="field-note" role="status">{xlsx}</p>}</section>;
}
