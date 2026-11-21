import {useEffect,useState} from 'react';
import type {Project} from './project';
import {EXTRA_SERVICES,type OrderServices} from './orderServices';
function ServiceNumber({label,value,min=0,max=1e9,integer=false,nullable=false,onCommit}:{label:string;value:number|null;min?:number;max?:number;integer?:boolean;nullable?:boolean;onCommit:(v:number|null)=>void}){
 const [draft,setDraft]=useState(value===null?'':String(value)),[error,setError]=useState('');
 useEffect(()=>{setDraft(value===null?'':String(value));setError('');},[value]);
 const apply=()=>{if(!draft.trim()&&nullable){setError('');onCommit(null);return;}const n=Number(draft.replace(',','.'));if(!draft.trim()||!Number.isFinite(n)||n<min||n>max||(integer&&!Number.isInteger(n))){setError(`Введите ${integer?'целое ':''}число от ${min} до ${max}`);return;}setError('');if(n!==value)onCommit(n);};
 return <label className="service-number">{label}<input aria-label={label} type="number" min={min} max={max} step={integer?1:'any'} value={draft} placeholder={nullable?'Уточнить цену':undefined} onChange={e=>setDraft(e.target.value)} onBlur={apply} onKeyDown={e=>{if(e.key==='Enter')e.currentTarget.blur();if(e.key==='Escape'){e.preventDefault();e.stopPropagation();setDraft(value===null?'':String(value));setError('');}}}/>{error&&<small role="alert">{error}</small>}</label>;
}
export function OrderServicesEditor({project,update}:{project:Project;update:(p:Project)=>void}){
 const s=project.services??{};
 const set=(patch:Partial<OrderServices>)=>update({...project,services:{...s,...patch},offer:project.offer?{...project.offer,pendingIncluded:false}:undefined});
 return <details className="order-services"><summary>Доставка, подъём, монтаж и дополнительные услуги</summary>
 <label><input type="checkbox" checked={!!s.installation} onChange={e=>set({installation:e.target.checked})}/> Монтаж — 15% стоимости каркасов и фасадов</label>
 <p>Фурнитура, столешницы и услуги в базу монтажа не входят.</p>
 <label><input type="checkbox" checked={s.delivery!==undefined} onChange={e=>set({delivery:e.target.checked?null:undefined})}/> Доставка</label>
 {s.delivery!==undefined&&<ServiceNumber label="Стоимость доставки" value={s.delivery} nullable onCommit={delivery=>set({delivery})}/>}
 <label>Подъём <select aria-label="Тариф подъёма" value={s.lift??'none'} onChange={e=>set({lift:e.target.value as OrderServices['lift']})}><option value="none">Не включён</option><option value="fixed">800 ₽ фиксированно</option><option value="floors">150 ₽ за этаж</option></select></label>
 {s.lift==='floors'&&<ServiceNumber label="Количество оплачиваемых этажей" value={s.floors??1} max={200} integer onCommit={v=>set({floors:v!})}/>}
 <p>Цены в рублях. Ввод — Enter или выход из поля. Пустая цена означает «уточнить», а не бесплатную услугу. Не добавляйте повторно уже посчитанные в смете вырезы и обработки.</p>
 {EXTRA_SERVICES.map((label,i)=>{const id=String(i),row=s.extras?.find(x=>x.id===id);return <div className="service-extra" key={id}><label><input type="checkbox" checked={!!row} onChange={e=>set({extras:e.target.checked?[...(s.extras??[]),{id,label,quantity:1,price:null}]:(s.extras??[]).filter(x=>x.id!==id)})}/> {label}</label>{row&&<><ServiceNumber label={'Количество: '+label} value={row.quantity} min={0.001} max={10000} onCommit={v=>set({extras:s.extras?.map(x=>x.id===id?{...x,quantity:v!}:x)})}/><ServiceNumber label={'Цена: '+label} value={row.price} nullable onCommit={price=>set({extras:s.extras?.map(x=>x.id===id?{...x,price}:x)})}/></>}</div>})}
 </details>;
}
