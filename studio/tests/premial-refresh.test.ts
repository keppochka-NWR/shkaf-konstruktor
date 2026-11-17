import test from 'node:test';
import assert from 'node:assert/strict';
import {applyPremialSnapshot} from '../src/premialRefresh';
import {premialCatalog} from '../src/premialCatalog';
import {premialArticleQuote} from '../src/premialPricing';
test('daily snapshot changes quote and keeps unavailable articles in the catalog',()=>{
 const original={...premialCatalog[0]};
 try{
  applyPremialSnapshot({items:[{...original,sitePrice:100,inStock:false,availability:'Нет в наличии',checkedAt:new Date().toISOString()}]});
  assert.equal(premialArticleQuote(original.article).price,130);
  assert.equal(premialCatalog[0].inStock,false);
  applyPremialSnapshot({items:[{...original,checkedAt:'2020-01-01'}]});
  assert.equal(premialCatalog[0].inStock,null);
 }finally{Object.assign(premialCatalog[0],original);}
});
test('invalid snapshot is rejected before any data is modified',()=>{
 const original={...premialCatalog[0]};
 assert.throws(()=>applyPremialSnapshot({items:[{...original,sitePrice:100},{...premialCatalog[1],sitePrice:-1}]}));
 assert.deepEqual(premialCatalog[0],original);
});
