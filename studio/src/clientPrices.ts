import type {PriceLine} from './pricing';
import {PENDING_CLIENT} from './pendingPrices';
/** Клиентский вид сметы для публичной сборки: в строках — розничная цена (база × коэффициент сметы, фасады Вернисаж —
 *  × свой коэффициент, розничные позиции — как есть), без источников закупки, себестоимости и коэффициентов.
 *  Итоговая цена клиента (retail, byMarkup, split.material/hardware, bySheet) не пересчитывается — та же, что у менеджера
 *  (тест tests/client-prices.test.ts).
 *  Модель «цена за лист»: плита, кромка, фурнитура и работа входят в цену листа — у этих строк цены нет («Входит в цену
 *  за лист»), отдельной строкой идут листы ЛДСП × цена листа; сверху — Вернисаж (× свой коэффициент), розница и позиции
 *  Лемана (как есть, pricing.ts: lemana), стекло и зеркало (× коэффициент сметы, isOffSheetLine). Так сумма строк сходится
 *  с итогом клиента (до округления Вернисажа к сотне). */
type EstimateLike={lines:PriceLine[];missing:PriceLine[];pending:PriceLine[];knownCost:number;split:{materialCost:number;hardwareCost:number;material:number;hardware:number};
  markup:number;vernissageMarkup:number;vernissageCost:number;vernissageOnTop:number;sheetPrice:number;perSheet:number|null;model:'markup'|'sheet';bySheet:number;byMarkupKnown:number;ldspSheets:number};
export const CLIENT_SOURCE='Цена салона';
export const CLIENT_SOURCE_MISSING='Цену уточнит менеджер';
export const CLIENT_SOURCE_IN_SHEET='Входит в цену за лист';
export const SHEETS_LINE_ID='client:sheets';
/** позиции Лемана по выбору клиента — в «цене за лист» идут сверху листов как есть (то же условие, что lemana в pricing.ts estimate) */
const isLemana=(id:string)=>id.startsWith('mesh:')||id.startsWith('handle:lm');
/** Стекло и зеркало (glass-*: зеркало на фасаде, плёнка, полировка, наклейка, стеклянная крыша и полка) — вне листовой модели:
 *  в «цене за лист» сверху листов по закупке × коэффициент сметы (решение Макса 26.10.2026; pricing.ts estimate: offSheet). */
export const isOffSheetLine=(id:string)=>id.startsWith('glass-');
export function clientLine(l:PriceLine,markup:number,vernissageMarkup:number,model:'markup'|'sheet'='markup'):PriceLine{
  // позиция «после финального расчёта конструктором» (pendingPrices.ts) — без цены, с клиентской подписью; поставщик и ориентир — только менеджеру
  if(l.pending)return {...l,unitPrice:null,source:PENDING_CLIENT,retail:true};
  const vern=l.id.startsWith('vernissage'),off=isOffSheetLine(l.id);
  if(model==='sheet'&&!l.retail&&!vern&&!off&&!isLemana(l.id))return {...l,unitPrice:null,source:l.unitPrice===null?CLIENT_SOURCE_MISSING:CLIENT_SOURCE_IN_SHEET,retail:true};
  const k=l.retail?1:vern?vernissageMarkup:model==='sheet'&&!off?1:markup;
  // «цена за лист»: Леман — по рознице как есть (shelf, ревью R5), не по запечённой × коэффициент цене строки
  const {shelf,...rest}=l,base=model==='sheet'&&isLemana(l.id)&&shelf!==undefined?shelf:l.unitPrice;
  return {...rest,unitPrice:base===null?null:Math.round(base*k*100)/100,source:l.unitPrice===null?CLIENT_SOURCE_MISSING:CLIENT_SOURCE,retail:true};
}
export function clientView<T extends EstimateLike>(e:T):T{
  const lines=e.lines.map(l=>clientLine(l,e.markup,e.vernissageMarkup,e.model));
  // строки без цены у менеджера — те же «без цены» у клиента (в «цене за лист» пустые строки «входит в цену» не в счёт)
  const missing=lines.filter((_,i)=>e.lines[i].unitPrice===null&&!e.lines[i].pending),pending=lines.filter((_,i)=>e.lines[i].pending);
  if(e.model==='sheet'&&e.ldspSheets)lines.unshift({id:SHEETS_LINE_ID,label:'Листы ЛДСП с кромкой, фурнитурой и работой',quantity:e.ldspSheets,unit:'лист',unitPrice:e.sheetPrice,source:CLIENT_SOURCE,retail:true});
  const client=lines.reduce((s,l)=>s+l.quantity*(l.unitPrice??0),0);
  return {...e,lines,missing,pending,knownCost:Math.round(client),
    split:{...e.split,materialCost:e.split.material,hardwareCost:e.split.hardware},
    markup:1,vernissageMarkup:1,vernissageCost:e.vernissageOnTop,sheetPrice:e.model==='sheet'?e.sheetPrice:0,perSheet:null,
    // «цена за лист» видна, только если она и есть цена проекта; иначе по ней восстанавливается цена листа
    bySheet:e.model==='sheet'?e.bySheet:e.byMarkupKnown};
}
