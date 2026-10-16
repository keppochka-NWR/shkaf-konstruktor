import type {PriceLine} from './pricing';
/** Клиентский вид сметы для публичной сборки: в строках — розничная цена (база × коэффициент сметы, фасады Вернисаж —
 *  × свой коэффициент, розничные позиции — как есть), без источников закупки, себестоимости и коэффициентов.
 *  Итоговая цена клиента (retail, byMarkup, split.material/hardware, bySheet) не пересчитывается — та же, что у менеджера
 *  (тест tests/client-prices.test.ts). */
type EstimateLike={lines:PriceLine[];missing:PriceLine[];knownCost:number;split:{materialCost:number;hardwareCost:number;material:number;hardware:number};
  markup:number;vernissageMarkup:number;vernissageCost:number;vernissageOnTop:number;sheetPrice:number;perSheet:number|null;model:'markup'|'sheet';bySheet:number;byMarkupKnown:number};
export const CLIENT_SOURCE='Цена салона';
export const CLIENT_SOURCE_MISSING='Цену уточнит менеджер';
export function clientLine(l:PriceLine,markup:number,vernissageMarkup:number):PriceLine{
  const k=l.retail?1:l.id.startsWith('vernissage')?vernissageMarkup:markup;
  return {...l,unitPrice:l.unitPrice===null?null:Math.round(l.unitPrice*k*100)/100,source:l.unitPrice===null?CLIENT_SOURCE_MISSING:CLIENT_SOURCE,retail:true};
}
export function clientView<T extends EstimateLike>(e:T):T{
  const lines=e.lines.map(l=>clientLine(l,e.markup,e.vernissageMarkup));
  const client=lines.reduce((s,l)=>s+l.quantity*(l.unitPrice??0),0);
  return {...e,lines,missing:lines.filter(l=>l.unitPrice===null),knownCost:Math.round(client),
    split:{...e.split,materialCost:e.split.material,hardwareCost:e.split.hardware},
    markup:1,vernissageMarkup:1,vernissageCost:e.vernissageOnTop,sheetPrice:0,perSheet:null,
    // «цена за лист» видна, только если она и есть цена проекта; иначе по ней восстанавливается цена листа
    bySheet:e.model==='sheet'?e.bySheet:e.byMarkupKnown};
}
