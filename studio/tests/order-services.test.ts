import test from 'node:test';import assert from 'node:assert/strict';
import {newProject,parseProject} from '../src/project';import {estimate} from '../src/pricing';import {clientView} from '../src/clientPrices';import {serviceRows,validateServices} from '../src/orderServices';
test('services charge installation on frames/facades, one lift tariff, and keep customer sum',()=>{
 const p=newProject(),base=estimate(p);p.services={installation:true,delivery:1500,lift:'floors',floors:4,extras:[{id:'x',label:'Замер',quantity:1,price:700}]};
 const e=estimate(p),install=e.lines.find(x=>x.id==='service:installation')!;
 assert.equal(install.unitPrice,base.ldspSheets*base.sheetPrice*.15);
 assert.equal(e.bySheet-base.bySheet,install.unitPrice!+1500+600+700);
 assert.equal(clientView(e).knownCost,e.bySheet);
 assert.deepEqual(parseProject(JSON.parse(JSON.stringify(p))).services,p.services);
 p.services.lift='fixed';assert.equal(estimate(p).bySheet-e.bySheet,200);
});
test('missing service rates and invalid inputs cannot silently become free services',()=>{
 const p=newProject();p.services={delivery:null};const e=estimate(p);
 assert.equal(e.retail,null);assert.ok(e.missingExtrasLines.some(x=>x.id==='service:delivery'));
 assert.ok(validateServices({extras:[{id:'x',label:'Замер',quantity:0,price:20}]}));
 assert.ok(validateServices({delivery:-1}));assert.equal(serviceRows({lift:'floors',floors:0},0)[0].quantity,0);
});
