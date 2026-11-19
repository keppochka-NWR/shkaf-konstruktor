import test from 'node:test';
import assert from 'node:assert/strict';
import {premialClientPrice,premialSlideQuote} from '../src/premialPricing';
import {premialCatalog} from '../src/premialCatalog';
import {newProject,parseProject,projectErrors} from '../src/project';
import {estimate} from '../src/pricing';

test('Premial client price applies 1.3 to website price, preserving unknown prices',()=>{
 assert.equal(premialClientPrice(1000),1300);
 assert.equal(premialClientPrice(1453),1888.9);
 assert.equal(premialClientPrice(null),null);
 assert.throws(()=>premialClientPrice(NaN));
});
test('Morendo exact articles replace estimates and unsupported lengths stay unpriced',()=>{
 const q=premialSlideQuote(400,'soft-close');
 assert.equal(q.price,1888.9);assert.match(q.label,/033333/);assert.equal(q.retail,true);
 assert.equal(premialSlideQuote(400,'push').price,1788.8);
 assert.equal(premialSlideQuote(325,'soft-close').price,null);
});
test('additional catalogue lines survive reload and do not receive the general markup',()=>{
 const item=premialCatalog.find(x=>x.sitePrice!==null)!;
 const p=newProject();p.premialExtras=[{article:item.article,quantity:2}];
 p.calculation={markup:5,overrides:{},sheetPrice:23000};
 const q=parseProject(JSON.parse(JSON.stringify(p)));
 assert.deepEqual(q.premialExtras,p.premialExtras);
 const line=estimate(q).lines.find(x=>x.id==='premial-extra:'+item.article)!;
 assert.equal(line.quantity,2);assert.equal(line.retail,true);assert.equal(line.unitPrice,premialClientPrice(item.sitePrice));
});
test('invalid quantity is rejected and missing articles remain explicitly unpriced',()=>{
 const p=newProject();p.premialExtras=[{article:'missing-art',quantity:1}];
 assert.ok(estimate(p).missing.some(x=>x.id==='premial-extra:missing-art'));
 p.premialExtras[0].quantity=-1;assert.ok(projectErrors(p).length);
 assert.throws(()=>parseProject(JSON.parse(JSON.stringify(p))));
});

import {premialKitchenLegQuote,premialMaestroArticle} from '../src/premialPricing';
import {kitchenBase} from '../src/kitchen';
import {initialModule} from '../src/model';
test('Maestro article table covers all 18 combinations without substituting Axis sizes',()=>{
 const arts=[93,131,178].flatMap(h=>[400,450,500].flatMap(l=>(['white','grey'] as const).map(c=>premialMaestroArticle(h,l,c))));
 assert.equal(new Set(arts).size,18);assert.ok(arts.every(Boolean));
 assert.equal(premialMaestroArticle(93,500,'grey'),'033500');assert.equal(premialMaestroArticle(93,400,'white'),'033515');
 assert.equal(premialMaestroArticle(120,500,'white'),undefined);
});
test('kitchen feet use compatible height ranges and client multiplier exactly once',()=>{
 assert.equal(premialKitchenLegQuote(100).article,'090020');assert.equal(premialKitchenLegQuote(150).article,'090017');assert.equal(premialKitchenLegQuote(140).price,null);
 const p=newProject();p.modules[0].module=kitchenBase(initialModule(),600);p.calculation={markup:5,overrides:{},sheetPrice:23000};
 const ls=estimate(p).lines,leg=ls.find(x=>x.id==='kitchen-leg')!;
 assert.ok(leg);assert.equal(leg.quantity,4);assert.equal(leg.retail,true);assert.equal(leg.unitPrice,premialClientPrice(premialCatalog.find(x=>x.article==='090020')!.sitePrice));
});

import {premialGolaQuote,premialArticleQuote} from '../src/premialPricing';
test('Gola converts a 6m bar to metres after the 1.3 multiplier once',()=>{
 for(const [kind,article] of [['L','240034'],['C','240025']] as const){const q=premialGolaQuote(kind);assert.equal(q.price,Math.round(premialArticleQuote(article).price!/6*100)/100);assert.equal(q.retail,true);}
});
