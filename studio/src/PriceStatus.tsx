import {useEffect, useState} from 'react';
import {estimate} from './pricing';
import type {Project} from './project';

/** Defer sheet packing until editing settles; never display an older project's price. */
export function PriceStatus({project,open}:{project:Project;open:()=>void}) {
  const [result,setResult]=useState<{project:Project;value:ReturnType<typeof estimate>} | null>(null);
  useEffect(()=>{const timer=setTimeout(()=>setResult({project,value:estimate(project)}),350);return()=>clearTimeout(timer);},[project]);
  const value=result?.project===project?result.value:null;
  const label=!value?'Смета · расчёт…':value.missing.length?`Смета · нет цен: ${value.missing.length}`:`Предварительно ${value.retail!.toLocaleString('ru-RU')} ₽`;
  return <button className="price-status" onClick={open} title="Открыть смету. Расчёт предварительный: крепёж, доставка и монтаж учитываются отдельно." aria-label={label+' — открыть смету'}>{label}</button>;
}
