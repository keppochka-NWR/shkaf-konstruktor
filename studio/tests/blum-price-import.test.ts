import test from 'node:test';import assert from 'node:assert/strict';
import {blumPriceCatalog,blumPriceSource} from '../src/blumPriceCatalog';import {blumKitQuote} from '../src/blumPricing';
test('Blum supplied price: max duplicate, client markup once, no stock summing',()=>{
 const p=blumPriceCatalog.find(p=>p.article==='760H4000S')!;assert.equal(p.clientPrice,5992);assert.equal(p.stockSnapshot,7);assert.equal(p.priceConflict,true);assert.equal(blumPriceSource.currency,'RUB');assert.equal(blumPriceSource.includesVat,true);
 const quote=blumKitQuote([{article:'760H5000S',quantity:1,unit:'компл'},{article:'T51.7601/R',quantity:1,unit:'шт'},{article:'T51.7601KUPPL100OR',quantity:1,unit:'шт'}]);assert.equal(quote.price,6761.6);assert.equal(quote.retail,true);
});
test('missing or ambiguous units never become a complete zero-priced kit',()=>{
 assert.equal(blumKitQuote([{article:'unknown',quantity:1,unit:'компл'}]).price,null);
 const ambiguous=blumPriceCatalog.find(p=>p.unit===null)!;assert.equal(blumKitQuote([{article:ambiguous.article,quantity:1,unit:'компл'}]).price,null);
 assert.throws(()=>blumKitQuote([{article:'760H4000S',quantity:0,unit:'компл'}]));
});
