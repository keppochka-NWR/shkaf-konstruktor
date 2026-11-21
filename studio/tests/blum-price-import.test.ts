import test from 'node:test';import assert from 'node:assert/strict';
import {blumPriceCatalog,blumPriceSource} from '../src/blumPriceCatalog';import {blumKitQuote,tandemKitQuote} from '../src/blumPricing';
import {slidePrice} from '../src/pricing';
test('Blum supplied price: max duplicate, client markup once, no stock summing',()=>{
 const p=blumPriceCatalog.find(p=>p.article==='760H4000S')!;assert.equal(p.clientPrice,5992);assert.equal(p.stockSnapshot,7);assert.equal(p.priceConflict,true);assert.equal(blumPriceSource.currency,'RUB');assert.equal(blumPriceSource.includesVat,true);
 const quote=blumKitQuote([{article:'760H5000S',quantity:1,unit:'компл'},{article:'T51.7601/R',quantity:1,unit:'шт'},{article:'T51.7601KUPPL100OR',quantity:1,unit:'шт'}]);assert.equal(quote.price,6761.6);assert.equal(quote.retail,true);
});
test('TANDEM uses a pair plus both locks, one markup, and leaves unconfirmed sales units pending',()=>{
 const q=tandemKitQuote(500,'soft-close');
 assert.equal(q.price,6222.4);
 assert.deepEqual(q.components.map(x=>x.article),['560H5000B','T51.1700.04 L','T51.1700.04 R']);
 assert.equal(slidePrice({slide:'gtv0fpo',brand:'blum',operation:'soft-close',length:500}).price,6222.4);
 assert.equal(tandemKitQuote(400,'push').price,6211.2);
 for(const length of [250,270,450,600]) assert.equal(tandemKitQuote(length,'soft-close').price,null);
 assert.equal(tandemKitQuote(500,'push').price,null);
 assert.equal(tandemKitQuote(550,'push').price,null,'disputed 560H5500T alias is not an approved quote');
});
test('missing or ambiguous units never become a complete zero-priced kit',()=>{
 assert.equal(blumKitQuote([{article:'unknown',quantity:1,unit:'компл'}]).price,null);
 const ambiguous=blumPriceCatalog.find(p=>p.unit===null)!;assert.equal(blumKitQuote([{article:ambiguous.article,quantity:1,unit:'компл'}]).price,null);
 assert.throws(()=>blumKitQuote([{article:'760H4000S',quantity:0,unit:'компл'}]));
});
