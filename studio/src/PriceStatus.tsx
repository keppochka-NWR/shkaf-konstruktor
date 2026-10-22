import {useEffect, useState} from 'react';
import {estimate} from './pricing';
import type {Project} from './project';
import {pendingTotalLabel} from './pendingPrices';

/** Defer sheet packing until editing settles; never display an older project's price. */
export function PriceStatus({project,open}:{project:Project;open:()=>void}) {
  const [result,setResult]=useState<{project:Project;value:ReturnType<typeof estimate>} | null>(null);
  // ошибка раскроя/сметы — подпись, а не необработанное исключение таймера (БЛОКЕР 1 критика релиза 22.10)
  const [failed,setFailed]=useState<Project|null>(null);
  useEffect(()=>{const timer=setTimeout(()=>{try{setResult({project,value:estimate(project)});setFailed(null);}catch{setFailed(project);}},350);return()=>clearTimeout(timer);},[project]);
  const value=result?.project===project?result.value:null;
  const label=failed===project?'Смета · ошибка расчёта':!value?'Смета · расчёт…':value.missing.length||value.retail===null?`Смета · нет цен: ${value.missing.length||value.unplaced}`:`Предварительно ${value.retail.toLocaleString('ru-RU')} ₽`+(value.pending.length?` · ${pendingTotalLabel(value.pending.length)}`:'');
  return <button className="price-status" onClick={open} title="Открыть смету. Расчёт предварительный: крепёж, доставка и монтаж учитываются отдельно." aria-label={label+' — открыть смету'}>{label}</button>;
}
