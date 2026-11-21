import {blumPriceCatalog,blumPriceSource} from './blumPriceCatalog';
export type BlumKitLine={article:string;quantity:number;unit:'шт'|'компл'};
/** Confirmed pair packs only. Supplier rows labelled 'шт' for left/right
 * runners remain unpriced until the sales unit is clarified. */
const tandemPairs:Record<string,Record<number,string>>={
 'soft-close':{300:'560H3000B',350:'560H3500B',400:'560H4000B',500:'560H5000B',550:'560H5500B'},
 push:{250:'560H2500T',400:'560H4000T'},
};
export function tandemKitQuote(length:number,motion:string){
 const article=tandemPairs[motion]?.[length];
 if(!article)return {price:null,retail:true as const,components:[],missing:['TANDEM '+length+' мм: не подтверждён полный комплект или единица продажи'],source:'Прайс Blum: комплект TANDEM '+length+' мм '+motion+' требует уточнения; фиксированная цена не применяется'};
 // Blum catalogue 2024/2025 pp.434,512: runners L/R + locking devices L/R.
 const quote=blumKitQuote([{article,quantity:1,unit:'компл'},{article:'T51.1700.04 L',quantity:1,unit:'шт'},{article:'T51.1700.04 R',quantity:1,unit:'шт'}]);
 return {...quote,source:quote.source+' Комплект: '+article+' (пара направляющих) + T51.1700.04 L + T51.1700.04 R. Синхронизация TIP-ON — отдельная опция.'};
}
/** The catalog already contains client prices. Never multiply a second time. */
export function blumKitQuote(lines:readonly BlumKitLine[]){
 const missing:string[]=[];let total=0;
 const components=lines.map(line=>{
  if(!Number.isFinite(line.quantity)||line.quantity<=0)throw Error('Количество комплектующих Blum должно быть положительным');
  const item=blumPriceCatalog.find(p=>p.article===line.article);
  if(!item){missing.push(line.article+': нет в прайсе');return {...line,clientPrice:null};}
  if(item.unit!==line.unit){missing.push(line.article+': уточнить единицу продажи ('+item.unitVariants.join(' / ')+')');return {...line,clientPrice:null};}
  total+=Math.round(item.clientPrice*100)*line.quantity;
  return {...line,clientPrice:item.clientPrice};
 });
 return {price:missing.length?null:Math.round(total)/100,retail:true as const,components,missing,source:`Прайс Blum ${blumPriceSource.date}; цена клиенту ×1,6; при дублях взята большая цена. Остатки на дату прайса.`};
}
