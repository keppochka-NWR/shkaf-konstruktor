import type {PriceLine} from './pricing';
export type OrderService={id:string;label:string;quantity:number;price:number|null};
export type OrderServices={installation?:boolean;delivery?:number|null;lift?:'none'|'fixed'|'floors';floors?:number;extras?:OrderService[]};
export const EXTRA_SERVICES=['Замер','Демонтаж мебели','Выпилы и отверстия','Обработка торцов и стыков','Установка мойки и смесителя','Установка и подключение техники','Вывоз упаковки'];
export function validateServices(s:OrderServices){
 const money=(n:unknown)=>n===null||(typeof n==='number'&&Number.isFinite(n)&&n>=0&&n<=1e9);
 if(!s||typeof s!=='object'||(s.installation!==undefined&&typeof s.installation!=='boolean')||(s.delivery!==undefined&&!money(s.delivery))||(s.lift!==undefined&&!['none','fixed','floors'].includes(s.lift))||(s.floors!==undefined&&(!Number.isInteger(s.floors)||s.floors<0||s.floors>200)))return 'Проверьте доставку, подъём и монтаж.';
 if(s.extras!==undefined&&(!Array.isArray(s.extras)||s.extras.length>50||s.extras.some(x=>!x||typeof x.id!=='string'||typeof x.label!=='string'||!x.label.trim()||x.label.length>150||!Number.isFinite(x.quantity)||x.quantity<=0||x.quantity>10000||!money(x.price))||new Set(s.extras.map(x=>x.id)).size!==s.extras.length))return 'Проверьте дополнительные услуги.';
 return null;
}
export function serviceRows(s:OrderServices|undefined,base:number|null){
 if(!s)return [];
 const error=validateServices(s);if(error)throw Error(error);
 const rows:OrderService[]=[];
 if(s.installation)rows.push({id:'installation',label:'Монтаж — 15% каркасов и фасадов',quantity:1,price:base===null?null:Math.round(base*15)/100});
 if(s.delivery!==undefined)rows.push({id:'delivery',label:'Доставка',quantity:1,price:s.delivery});
 if(s.lift==='fixed')rows.push({id:'lift',label:'Подъём — фиксированно',quantity:1,price:800});
 if(s.lift==='floors')rows.push({id:'lift',label:'Подъём по этажам',quantity:s.floors??1,price:150});
 return [...rows,...(s.extras??[]).map(x=>({...x,id:'extra:'+x.id}))];
}
export const serviceTerms=(s?:OrderServices)=>s?'Услуги учтены только отдельными строками сметы. Неуказанные услуги не включены.':'Без доставки, подъёма и монтажа.';

/** Customer value of frames and facades, without hinges, runners or worktops. */
export function installationValue(sheetBase:number,lines:readonly PriceLine[],markup:number,vernissageMarkup:number):number|null {
 const facade=lines.filter(l=>/^(vernissage|facade-panel:|facade-external$|alu-profile:|alu-insert:|alu-seal$|glass-mirror)/.test(l.id));
 if(facade.some(l=>l.unitPrice===null))return null;
 const vern=facade.filter(l=>l.id.startsWith('vernissage')&&!l.retail).reduce((s,l)=>s+l.quantity*l.unitPrice!,0);
 const other=facade.filter(l=>!l.id.startsWith('vernissage')||l.retail).reduce((s,l)=>s+l.quantity*l.unitPrice!*(l.retail?1:markup),0);
 return Math.round((sheetBase+Math.round(vern*vernissageMarkup/100)*100+other)*100)/100;
}
export const serviceTotal=(lines:readonly Pick<PriceLine,'id'|'unitPrice'|'quantity'>[])=>Math.round(lines.filter(l=>l.id.startsWith('service:')).reduce((s,l)=>s+(l.unitPrice??0)*l.quantity,0)*100)/100;
