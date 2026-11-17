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
