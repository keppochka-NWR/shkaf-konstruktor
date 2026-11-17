import {premialCatalog} from './premialCatalog';
/** Max, 2026-11-16: current website retail × 1.3, once. */
export const PREMIAL_CLIENT_MULTIPLIER=1.3;
export function premialClientPrice(sitePrice:number|null):number|null {
 if(sitePrice===null)return null;
 if(!Number.isFinite(sitePrice)||sitePrice<0)throw new Error('Некорректная цена Premial');
 return Math.round((sitePrice*PREMIAL_CLIENT_MULTIPLIER+Number.EPSILON)*100)/100;
}

export function premialSlideQuote(length:number,motion:string){
 const start=motion==='soft-close'?33331:motion==='push'?33341:0;
 const article=String(start+(length-300)/50).padStart(6,'0');
 const item=start&&[300,350,400,450,500,550].includes(length)?premialCatalog.find(p=>p.article===article):undefined;
 return item?{price:premialClientPrice(item.sitePrice),label:item.name+' · арт. '+item.article,source:item.url+'; проверено '+item.checkedAt+'; комплект с фиксаторами; цена сайта ×1,3',retail:true}:{price:null,label:'Premial МОРЕНДО '+length+' мм',source:'Нет подтверждённой цены конкретного артикула',retail:true};
}

export function premialArticleQuote(article:string){
 const item=premialCatalog.find(p=>p.article===article);
 return {price:premialClientPrice(item?.sitePrice??null),label:item?item.name+' · арт. '+article:'Premial · арт. '+article,source:item?item.url+'; '+item.checkedAt+'; цена сайта ×1,3':'Артикул требует подтверждения цены',retail:true};
}
export function premialHingeQuote(inset:boolean,motion:'soft'|'free'|'simple',angle?:number){
 if(angle&&angle>110){if(!inset&&motion==='soft'&&angle>=155&&angle<=165)return premialArticleQuote('044414');return {price:null,label:'Premial: петля для угла '+angle,source:'Требуется подбор точного артикула',retail:true};}
 return premialArticleQuote(({soft:inset?'044410':'044408',free:inset?'044426':'044422',simple:inset?'044427':'044421'})[motion]);
}
export function premialAluHingeQuote(inset:boolean,motion:'soft'|'free'|'simple',black=false,angle?:number,falsePanel=false){
 if(falsePanel||(angle!==undefined&&angle!==90&&angle!==105))return {price:null,label:'Premial ПРЕСТО АЛЮМ — специальное открывание',source:'Требуется подбор алюминиевой петли под угол и монтаж; обычная петля не подставляется',retail:true};
 const article=motion==='soft'?(inset?(black?'250505':'250508'):(black?'250503':'250506')):motion==='free'?(inset?'250523':black?'250520':'250521'):(inset?'250256':'250254');
 const q=premialArticleQuote(article);
 return {...q,source:q.source+'; совместимость присадки конкретного рамочного профиля проверяется по схеме производителя'};
}
