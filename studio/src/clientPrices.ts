import type {PriceLine} from './pricing';
/** Клиентский вид сметы для публичной сборки: в строках — розничная цена (база × коэффициент сметы, фасады Вернисаж —
 *  × свой коэффициент, розничные позиции — как есть), без источников закупки, себестоимости и коэффициентов.
 *  Итоговая цена клиента (retail, byMarkup, split.material/hardware, bySheet) не пересчитывается — та же, что у менеджера
 *  (тест tests/client-prices.test.ts).
 *  Модель «цена за лист»: плита, кромка, фурнитура и работа входят в цену листа — у этих строк цены нет («Входит в цену
 *  за лист»), отдельной строкой идут листы ЛДСП × цена листа; сверху — Вернисаж (× свой коэффициент), розница и позиции
 *  Лемана (как есть, pricing.ts: lemana). Так сумма строк сходится с итогом клиента (до округления Вернисажа к сотне). */
type EstimateLike={lines:PriceLine[];missing:PriceLine[];knownCost:number;split:{materialCost:number;hardwareCost:number;material:number;hardware:number};
  markup:number;vernissageMarkup:number;vernissageCost:number;vernissageOnTop:number;sheetPrice:number;perSheet:number|null;model:'markup'|'sheet';bySheet:number;byMarkupKnown:number;ldspSheets:number};
export const CLIENT_SOURCE='Цена салона';
export const CLIENT_SOURCE_MISSING='Цену уточнит менеджер';
export const CLIENT_SOURCE_IN_SHEET='Входит в цену за лист';
export const SHEETS_LINE_ID='client:sheets';
/** позиции Лемана по выбору клиента — в «цене за лист» идут сверху листов как есть (то же условие, что lemana в pricing.ts estimate) */
const isLemana=(id:string)=>id.startsWith('mesh:')||id.startsWith('handle:lm');
export function clientLine(l:PriceLine,markup:number,vernissageMarkup:number,model:'markup'|'sheet'='markup'):PriceLine{
  const vern=l.id.startsWith('vernissage');
  if(model==='sheet'&&!l.retail&&!vern&&!isLemana(l.id))return {...l,unitPrice:null,source:l.unitPrice===null?CLIENT_SOURCE_MISSING:CLIENT_SOURCE_IN_SHEET,retail:true};
  const k=l.retail?1:vern?vernissageMarkup:model==='sheet'?1:markup;
  return {...l,unitPrice:l.unitPrice===null?null:Math.round(l.unitPrice*k*100)/100,source:l.unitPrice===null?CLIENT_SOURCE_MISSING:CLIENT_SOURCE,retail:true};
}
export function clientView<T extends EstimateLike>(e:T):T{
  const lines=e.lines.map(l=>clientLine(l,e.markup,e.vernissageMarkup,e.model));
  // строки без цены у менеджера — те же «без цены» у клиента (в «цене за лист» пустые строки «входит в цену» не в счёт)
  const missing=lines.filter((_,i)=>e.lines[i].unitPrice===null);
  if(e.model==='sheet'&&e.ldspSheets)lines.unshift({id:SHEETS_LINE_ID,label:'Листы ЛДСП с кромкой, фурнитурой и работой',quantity:e.ldspSheets,unit:'лист',unitPrice:e.sheetPrice,source:CLIENT_SOURCE,retail:true});
  const client=lines.reduce((s,l)=>s+l.quantity*(l.unitPrice??0),0);
  return {...e,lines,missing,knownCost:Math.round(client),
    split:{...e.split,materialCost:e.split.material,hardwareCost:e.split.hardware},
    markup:1,vernissageMarkup:1,vernissageCost:e.vernissageOnTop,sheetPrice:e.model==='sheet'?e.sheetPrice:0,perSheet:null,
    // «цена за лист» видна, только если она и есть цена проекта; иначе по ней восстанавливается цена листа
    bySheet:e.model==='sheet'?e.bySheet:e.byMarkupKnown};
}
