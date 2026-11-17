import {premialCatalog,type PremialItem} from './premialCatalog';
export function applyPremialSnapshot(raw:unknown){
 const rows=(raw as {items?:unknown[]})?.items;
 if(!Array.isArray(rows)||!rows.length||rows.length>20000)throw Error('Invalid catalog');
 const seen=new Set<string>();
 for(const x of rows){
  const d=x as PremialItem;
  if(!d||typeof d.article!=='string'||seen.has(d.article)||typeof d.name!=='string'||typeof d.url!=='string'||!d.url.startsWith('https://allpremial.ru/catalog/')||typeof d.checkedAt!=='string'||typeof d.availability!=='string'||![true,false,null].includes(d.inStock)||(d.sitePrice!==null&&(!Number.isFinite(d.sitePrice)||d.sitePrice<0)))throw Error('Invalid catalog row');
  seen.add(d.article);
 }
 for(const row of rows as PremialItem[]){
  const d={...row};if(!Number.isFinite(Date.parse(d.checkedAt))||Date.now()-Date.parse(d.checkedAt)>36*3600000){d.inStock=null;d.availability='Наличие не подтверждено · данные устарели';}
  const old=premialCatalog.find(x=>x.article===d.article);if(old)Object.assign(old,d);else premialCatalog.push(d);
 }
}
export async function loadPremialSnapshot(){
 try{const r=await fetch('./catalogs/premial-latest.json',{cache:'no-store',signal:AbortSignal.timeout(5000)});if(!r.ok)throw Error('Catalog unavailable');applyPremialSnapshot(await r.json());}
 catch{for(const d of premialCatalog){d.inStock=null;d.availability='Наличие не подтверждено';}}
}
