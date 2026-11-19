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

/** Official Maestro 7D drilling sheet, article table: H93/131/178, L400/450/500. */
export function premialMaestroArticle(height:number,length:number,color:'white'|'grey'){
 const li=[400,450,500].indexOf(length),hi=[93,131,178].indexOf(height);
 if(li<0||hi<0)return undefined;
 const rows=color==='white'?[[33515,33516,33517],[33509,33510,33511],[33512,33513,33514]]:[[33502,33501,33500],[33505,33504,33503],[33508,33507,33506]];
 return String(rows[hi][li]).padStart(6,'0');
}
export function premialKitchenLegQuote(height:number){
 const article=height>=90&&height<=130?'090020':height>=150&&height<=180?'090017':undefined;
 return article?{...premialArticleQuote(article),article}:{price:null,label:`Опора кухни H${height} — требуется подбор`,source:'Нет подтверждённой опоры Premial на эту высоту',retail:true,article:undefined};
}

export function premialGolaQuote(kind:'L'|'C'){
 const q=premialArticleQuote(kind==='L'?'240034':'240025');
 return {...q,price:q.price===null?null:Math.round(q.price/6*100)/100,label:q.label+' · за пог. м',source:q.source+'; хлыст 6000 мм, цена разделена на 6; по использованной длине'};
}
