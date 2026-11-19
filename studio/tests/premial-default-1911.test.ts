import test from 'node:test';import assert from 'node:assert/strict';
import {initialModule,drawerConfig,parseModule,validate} from '../src/model';
import {slideBrand,slideMotion} from '../src/hardware';
import {slidePrice} from '../src/pricing';
test('new ordinary drawers default to priced Premial soft-close, reload preserves; legacy stays unchanged',()=>{
 const m=initialModule(true),s=m.sections[0],c=drawerConfig(m,s,0);
 assert.equal(slideBrand(c),'premial');assert.equal(slideMotion(c),'soft-close');assert.equal(c.slide,'gtv0fpo');assert.ok(slidePrice(c).price!>0);assert.deepEqual(validate(m),[]);
 const copy=parseModule(JSON.parse(JSON.stringify(m)));assert.deepEqual(drawerConfig(copy,copy.sections[0],0),c);
 const old=structuredClone(m);delete old.defaultDrawerPremial;assert.equal(slideBrand(drawerConfig(old,old.sections[0],0)),'gtv');
 s.drawerConfigs=[{slide:'ball',brand:'gtv',operation:'simple',height:120,length:400}];assert.equal(slideBrand(drawerConfig(m,s,0)),'gtv');
});
