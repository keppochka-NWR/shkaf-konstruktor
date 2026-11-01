// Подробная стоимость (просьба Макса 31.10.2026: «сделать более подробно расписанную стоимость»). Только ЦЕНЫ КЛИЕНТУ: строки берутся из
// клиентского вида сметы (clientView — тот же, что отдаёт публичная сборка), поэтому и у менеджера, и на сайте здесь нет закупки,
// коэффициентов и источников. Итог НЕ пересчитывается: группы — разложение того же estimate(); разница округлений (Вернисаж к сотне,
// копейки строк) — явной строкой «Округление», сумма групп + округление = итог сметы до рубля (тест estimate-breakdown).
import {estimate,hardwareKind,HARDWARE_KINDS,type PriceLine,type HardwareKind} from './pricing';
import {nest,type Sheet} from './exports';
import {clientView,CLIENT_SOURCE_IN_SHEET,SHEETS_LINE_ID} from './clientPrices';
import {PUBLIC_BUILD} from './buildMode';
import {decorLabel} from './clientLabels';
import {moduleQuote,PENDING_ITEM_PRICE} from './itemPrices';
import type {Project} from './project';

export type RowStatus='priced'|'in-sheet'|'pending'|'missing';
export type BreakdownRow={id:string;label:string;qty:number;unit:string;/** цена клиенту за единицу */price:number|null;/** сумма клиенту, до рубля */amount:number|null;status:RowStatus;sub?:string};
export type GroupId='sheets'|'facades'|'kupe'|'hardware'|'light'|'worktop';
export type BreakdownGroup={id:GroupId;title:string;rows:BreakdownRow[];total:number;inSheet:number;pending:number;missing:number};
export type Breakdown={groups:BreakdownGroup[];sheetPrice:number;ldspSheets:number;hdfSheets:number;sum:number;rounding:number;total:number|null;pending:number;missing:number};

export const GROUP_TITLES:Record<GroupId,string>={sheets:'Листы ЛДСП, кромка и работа',facades:'Фасады, стекло и зеркало',kupe:'Двери купе',hardware:'Фурнитура',light:'Подсветка',worktop:'Столешница, мойка и панели'};
export const STATUS_TEXT:Record<Exclude<RowStatus,'priced'>,string>={'in-sheet':'в цене листов',pending:'после финального расчёта',missing:'нет цены'};
const ORDER:GroupId[]=['sheets','facades','kupe','worktop','hardware','light'];
const HW_ORDER:HardwareKind[]=['hinges','slides','handles','legs','rods','fasteners','other','kupe'];

/** Группа строки по id сметы (pricing.ts). Всё, что не плита/фасад/купе/столешница/подсветка, — фурнитура (по видам hardwareKind). */
export function groupOf(id:string):GroupId{
 if(/^(sheet:|work$|work-hdf$|edge|small$|cut-work|unplaced|falsh-glue$|seat-glue$|glue32$)/.test(id))return 'sheets';
 if(/^(vernissage|alu-|glass-|facade-external|plinth-external)/.test(id))return 'facades';
 if(id.startsWith('kupe-'))return 'kupe';
 if(/^(worktop|premial-sink:|wallpanel:|mat:)/.test(id))return 'worktop';
 if(id.startsWith('light-'))return 'light';
 return 'hardware';
}
const rub=(v:number)=>Math.round(v);
function rowOf(l:PriceLine,src:PriceLine|undefined):BreakdownRow{
 const pending=!!(src?.pending??l.pending),unplaced=l.id.startsWith('unplaced');
 const status:RowStatus=pending?'pending':unplaced?'missing':l.unitPrice!==null?'priced':l.source===CLIENT_SOURCE_IN_SHEET?'in-sheet':'missing';
 return {id:l.id,label:l.label,qty:l.quantity,unit:l.unit,price:status==='priced'?l.unitPrice:null,amount:status==='priced'?rub(l.quantity*(l.unitPrice??0)):null,status};
}

/** Разложение цены проекта по группам. Строки — клиентские (clientView), листы ЛДСП — по декорам раскроя × цена листа. */
export function estimateBreakdown(p:Project,plan:Sheet[]=nest(p),e:ReturnType<typeof estimate>=estimate(p,plan)):Breakdown{
 // публичная сборка: estimate уже вернул клиентский вид; менеджер — тот же вид здесь (без закупки в интерфейсе «Стоимости»)
 const client=PUBLIC_BUILD?e:clientView(e),byId=new Map(e.lines.map(l=>[l.id,l]));
 const groups=new Map<GroupId,BreakdownRow[]>(ORDER.map(g=>[g,[]]));
 // листы ЛДСП по декорам (и толщине) раскроя: «Белый 16 мм · 3 листа × 23 000»
 const ldsp=plan.filter(s=>s.material!=='hdf'),hdfSheets=plan.length-ldsp.length,sheetPrice=client.sheetPrice;
 const decors=new Map<string,{decor:string;t:number;n:number}>();
 for(const s of ldsp){const t=s.thickness??16,k=s.decor+'|'+t,d=decors.get(k);if(d)d.n++;else decors.set(k,{decor:s.decor,t,n:1});}
 const sheetRows:BreakdownRow[]=e.ldspSheets?[...decors.values()].map(d=>({id:'sheets:'+d.decor+':'+d.t,label:`Лист ЛДСП ${decorLabel(d.decor)} ${d.t} мм (2750 × 1830)`,qty:d.n,unit:'лист',price:sheetPrice,amount:d.n*sheetPrice,status:'priced' as const})):[];
 // раскрой и смета считают листы одинаково (estimate(p,plan)); если вдруг разошлись — одна строка по смете, чтобы итог сошёлся
 if(sheetRows.reduce((s,r)=>s+r.qty,0)!==e.ldspSheets&&e.ldspSheets)sheetRows.splice(0,sheetRows.length,{id:SHEETS_LINE_ID,label:'Листы ЛДСП с кромкой, фурнитурой и работой',qty:e.ldspSheets,unit:'лист',price:sheetPrice,amount:e.ldspSheets*sheetPrice,status:'priced'});
 groups.get('sheets')!.push(...sheetRows);
 for(const l of client.lines){if(l.id===SHEETS_LINE_ID)continue;const r=rowOf(l,byId.get(l.id)),g=groupOf(l.id);
  if(g==='hardware')r.sub=HARDWARE_KINDS[hardwareKind(l.id)];groups.get(g)!.push(r);}
 // фурнитура — по видам (петли, направляющие комплектами, ручки, опоры, штанги, крепёж), внутри вида — с ценой выше
 const hw=groups.get('hardware')!,kindOf=(r:BreakdownRow)=>HW_ORDER.indexOf(hardwareKind(r.id));
 hw.sort((a,b)=>kindOf(a)-kindOf(b)||Number(b.status==='priced')-Number(a.status==='priced'));
 const out:BreakdownGroup[]=ORDER.map(id=>{const rows=groups.get(id)!;return {id,title:GROUP_TITLES[id],rows,total:rows.reduce((s,r)=>s+(r.amount??0),0),
  inSheet:rows.filter(r=>r.status==='in-sheet').length,pending:rows.filter(r=>r.status==='pending').length,missing:rows.filter(r=>r.status==='missing').length};}).filter(g=>g.rows.length>0);
 const sum=out.reduce((s,g)=>s+g.total,0),total=e.retail;
 return {groups:out,sheetPrice,ldspSheets:e.ldspSheets,hdfSheets,sum,rounding:total===null?0:total-sum,total,pending:out.reduce((s,g)=>s+g.pending,0),missing:out.reduce((s,g)=>s+g.missing,0)};
}

/** Цена по изделиям — доля итога (itemPrices.moduleQuote: сумма = итог). null — не делится (нет итога, у изделия нет цены). */
export function itemShares(p:Project,total:number|null):{name:string;price:number|null;pending:boolean}[]|null{
 const q=moduleQuote(p,total);if(!q)return null;
 return p.modules.map((a,i)=>({name:a.module.name,price:q.pending[i]&&!q.prices[i]?null:q.prices[i],pending:q.pending[i]}));
}

/** Группа, в которой ни у одной строки нет цены: вместо суммы «0 ₽» — значок (ревью 31.10): все в цене листов — «в цене листов»,
 *  есть позиции после финального расчёта — «после финального расчёта», иначе «нет цены». null — у группы есть сумма. */
export function groupBadge(g:BreakdownGroup):Exclude<RowStatus,'priced'>|null{
 if(g.rows.some(r=>r.status==='priced'))return null;
 return g.inSheet===g.rows.length?'in-sheet':g.pending?'pending':'missing';
}
const fmt=(v:number)=>v.toLocaleString('ru-RU');
const groupSum=(g:BreakdownGroup)=>{const s=groupBadge(g);return s?STATUS_TEXT[s]:fmt(g.total)+' ₽';};
const qtyText=(r:BreakdownRow)=>`${String(Math.round(r.qty*1000)/1000).replace('.',',')} ${r.unit}`;
const amountText=(r:BreakdownRow)=>r.status==='priced'?fmt(r.amount!)+' ₽':STATUS_TEXT[r.status];
/** Текст для буфера обмена (мессенджер, письмо): группы, строки, итог. */
export function breakdownText(b:Breakdown,title='Стоимость проекта'):string{
 const out=[title];
 for(const g of b.groups){out.push('',`${g.title}: ${groupSum(g)}`);for(const r of g.rows)out.push(`  ${r.label} — ${qtyText(r)}${r.price!==null&&r.status==='priced'?' × '+fmt(r.price)+' ₽':''} = ${amountText(r)}`);}
 out.push('');if(b.total!==null&&b.rounding)out.push(`Округление до итога: ${b.rounding>0?'+':''}${fmt(b.rounding)} ₽`);
 out.push(b.total===null?'Итого: требует уточнения (учтено '+fmt(b.sum)+' ₽)':'Итого: '+fmt(b.total)+' ₽','Предварительно, без доставки и монтажа.');
 return out.join('\n');
}
const esc=(s:string)=>s.replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]!));
/** Печатная «Стоимость проекта» (A4): те же группы и строки. */
export function breakdownHTML(b:Breakdown,title='Стоимость проекта',items?:{name:string;price:number|null;pending:boolean}[]|null):string{
 const rows=b.groups.map(g=>`<tr class="g"><th colspan="3">${esc(g.title)}</th><th>${esc(groupSum(g))}</th></tr>`+g.rows.map(r=>`<tr${r.status==='priced'?'':' class="s"'}><td>${esc(r.label)}</td><td>${esc(qtyText(r))}</td><td>${r.status==='priced'&&r.price!==null?fmt(r.price)+' ₽':''}</td><td>${esc(amountText(r))}</td></tr>`).join('')).join('');
 const tail=(b.total!==null&&b.rounding?`<tr><td colspan="3">Округление до итога</td><td>${fmt(b.rounding)} ₽</td></tr>`:'')+`<tr class="t"><th colspan="3">Итого</th><th>${b.total===null?'требует уточнения':fmt(b.total)+' ₽'}</th></tr>`;
 const it=items?.length?`<h2>По изделиям</h2><table><tbody>${items.map(i=>`<tr><td>${esc(i.name)}</td><td>${i.price===null?PENDING_ITEM_PRICE:fmt(i.price)+' ₽'}</td></tr>`).join('')}</tbody></table>`:'';
 return `<!doctype html><html lang="ru"><head><meta charset="utf-8"><title>${esc(title)}</title><style>@page{size:A4;margin:14mm}body{font:12px/1.4 Arial,sans-serif;color:#222}h1{font-size:18px}h2{font-size:14px;margin-top:18px}table{width:100%;border-collapse:collapse}td,th{padding:3px 6px;border-bottom:1px solid #ddd;text-align:left}td:nth-child(n+2),th:last-child{text-align:right;white-space:nowrap}tr.g th{background:#f2f4f7;padding-top:8px}tr.s td{color:#777}tr.t th{font-size:14px;border-top:2px solid #222}</style></head><body><h1>${esc(title)}</h1><table><thead><tr><th>Позиция</th><th>Кол-во</th><th>Цена</th><th>Сумма</th></tr></thead><tbody>${rows}${tail}</tbody></table>${it}<p>Предварительная стоимость без доставки и монтажа. «В цене листов» — входит в цену листа ЛДСП (плита, кромка, фурнитура корпуса и работа цеха).</p></body></html>`;
}
