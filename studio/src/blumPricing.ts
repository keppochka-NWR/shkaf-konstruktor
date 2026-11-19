import {blumPriceCatalog,blumPriceSource} from './blumPriceCatalog';
export type BlumKitLine={article:string;quantity:number;unit:'шт'|'компл'};
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
