import {partCollisions} from '../src/collisions';
import test from 'node:test';import assert from 'node:assert/strict';
import {initialModule,parts,validate} from '../src/model';import {kitchenBase} from '../src/kitchen';import {newProject,parseProject} from '../src/project';import {estimate} from '../src/pricing';import {basketErrors} from '../src/kitchenBasket';
function cabinet(){const m=kitchenBase(initialModule(),600);m.sections.forEach(s=>{s.shelves=[];s.drawers=0;s.rod=false;s.doorLeaves=1;});m.kitchen!.basket={article:'090535'};return m;}
test('FOCUS reload, hardware kit counted once at supplier x1.3, hinges restored on removal',()=>{
 const m=cabinet();assert.deepEqual(validate(m),[]);const p=parseProject(JSON.parse(JSON.stringify(newProject(m))));assert.equal(p.modules[0].module.kitchen?.basket?.article,'090535');
 assert.equal(parts(m).filter(x=>x.role==='hinge').length,0);assert.ok(parts(m).some(x=>x.id.startsWith('kitchen-basket:')));
 p.calculation={markup:5,overrides:{},sheetPrice:23000};const ls=estimate(p).lines.filter(x=>x.id.startsWith('kitchen-basket:'));assert.equal(ls.length,1);assert.equal(ls[0].unitPrice,7720.7);assert.equal(ls[0].quantity,1);assert.equal(ls[0].retail,true);
 delete m.kitchen!.basket;assert.ok(parts(m).some(x=>x.role==='hinge'));
});
test('FOCUS invalid size, occupied cabinet and unknown article are rejected',()=>{
 for(const update of [(m:ReturnType<typeof cabinet>)=>m.depth=400,(m:ReturnType<typeof cabinet>)=>m.width=700,(m:ReturnType<typeof cabinet>)=>m.sections[0].shelves=[300],(m:ReturnType<typeof cabinet>)=>m.kitchen!.basket={article:'unknown'}]){const m=cabinet();update(m);assert.ok(basketErrors(m).length);}
});

test('basket welded assembly has no internal false collisions',()=>{const m=cabinet(),ps=parts(m);assert.equal(partCollisions(ps,m).filter(c=>c.a.startsWith('kitchen-basket:')&&c.b.startsWith('kitchen-basket:')).length,0);});
