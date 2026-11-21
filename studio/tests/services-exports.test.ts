import test from 'node:test';import assert from 'node:assert/strict';
import {installationValue,serviceTotal} from '../src/orderServices';import {estimate,type PriceLine} from '../src/pricing';import {newProject} from '../src/project';import {modulePrices} from '../src/itemPrices';import {clientSheet,xlsxGroup} from '../src/estimateXlsx';import {quoteHTML} from '../src/exports';
const line=(id:string,unitPrice:number|null,retail=false):PriceLine=>({id,label:id,quantity:1,unit:'шт',unitPrice,retail,source:'test'});
test('installation uses customer facade prices and excludes hardware/worktops/services',()=>{
 const lines=[line('vernissage',5751),line('facade-panel:agt',45000,true),line('alu-profile:x',100),line('alu-insert:x',200),line('alu-seal',50),line('glass-mirror',500),line('hinge:x',9999,true),line('worktop:x',99000,true),line('service:delivery',1500,true)];
 assert.equal(installationValue(23000,lines,2.2,2),23000+11500+45000+850*2.2);
 assert.equal(installationValue(23000,[...lines,line('facade-external',null)],2.2,2),null);
});
test('service totals match module allocation, quote and spreadsheet; overrides cannot change service rates',()=>{
 const p=newProject();p.modules.push({...structuredClone(p.modules[0]),id:'second',x:1400});p.services={installation:true,delivery:1500.55,lift:'fixed'};p.calculation={...p.calculation,markup:2.2,overrides:{'service:installation':1,'service:delivery':1}};
 const e=estimate(p),items=modulePrices(p,e.retail)!;assert.ok(items);
 assert.equal(e.lines.find(l=>l.id==='service:delivery')?.unitPrice,1500.55);
 assert.equal(e.lines.find(l=>l.id==='service:installation')?.unitPrice,e.installationBase!*.15);
 assert.equal(Math.round((items.reduce((a,b)=>a+b,0)+serviceTotal(e.lines))*100),e.retail!*100);
 const sheet=clientSheet(p,e),total=sheet.rows.find(r=>r.some(c=>c.t==='s'&&c.v==='Итого'))!;assert.equal(total[5].t,'f');
 const sum=sheet.rows.slice(4,sheet.rows.indexOf(total)).reduce((s,r)=>s+(r[5]?.t==='n'?r[5].v:0),0);assert.equal(Math.round(sum*100),e.retail!*100);
 const html=quoteHTML(p,'Клиент',String(e.retail),'',undefined,{cost:e,items});assert.ok(html.includes('Монтаж — 15%'));assert.ok(html.includes('Доставка'));assert.ok(!html.includes('без доставки и монтажа'));assert.ok(!html.includes('монтаж (сборка и установка)'));
 assert.equal(xlsxGroup(e.lines.find(l=>l.id==='service:delivery')!),'services');
 p.offer={customer:'',price:'',notes:'',itemPrices:false};const noItems=clientSheet(p,e);const delivery=noItems.rows.find(r=>r.some(c=>c.t==='s'&&c.v==='Доставка'))!;assert.deepEqual(delivery[4],{t:'n',v:1500.55,s:5});
});
import {findPurchaseNumbers} from '../scripts/price-guard';
test('public price guard distinguishes the approved lift tariff from purchase values',()=>{
 const prices=[{key:'price',value:150}];assert.deepEqual(findPurchaseNumbers('r.push({id:"lift",label:"Подъём по этажам",quantity:e.floors??1,price:150})',prices),[]);assert.equal(findPurchaseNumbers('kit={id:"kit",price:150}',prices).length,1);
});
