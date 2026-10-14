import test from 'node:test';
import assert from 'node:assert/strict';
import {initialModule,validate,parts} from '../src/model';
import {kitchenBase,kitchenWorktop} from '../src/kitchen';
import {layoutKitchenDrawers,resizeKitchenDrawerFront,setKitchenDrawerCount,setKitchenGola} from '../src/kitchenEditing';
import {appendModule,newProject,projectErrors,parseProject} from '../src/project';
import {partCollisions} from '../src/collisions';
test('kitchen editing preserves carcass and produces valid drawer systems with Gola',()=>{
 for(const count of [1,2,3]){
 const m=kitchenBase(initialModule(),600);m.height=850;setKitchenDrawerCount(m,count);setKitchenGola(m,true);
 assert.equal(m.height,850);assert.equal(m.kdrawers?.length,count);assert.equal(m.gola?.cuts.length,count);assert.deepEqual(validate(m),[]);
 assert.ok(parts(m).some(p=>p.id.startsWith('gola:')));assert.deepEqual(projectErrors(newProject(m)),[]);
 assert.deepEqual(validate(parseProject(newProject(m)).modules[0].module),[]);
 const collisions=partCollisions(parts(m),m).filter(c=>[c.a,c.b].some(id=>id.startsWith('gola:')));assert.deepEqual(collisions,[]);
 setKitchenGola(m,false);assert.deepEqual(validate(m),[]);setKitchenDrawerCount(m,0);assert.equal(m.kdrawers,undefined);assert.equal(m.doors,true);
 }
});
test('worktop from ordinary palette is placed at cabinet height',()=>{
 const p=newProject(kitchenBase(initialModule(),600));const next=appendModule(p,kitchenWorktop(initialModule(),1800));
 assert.equal(next.modules[1].y,820);assert.deepEqual(projectErrors(next),[]);
});

test('Gola drawer changes preserve gaps and front sizes across relayout, system change and height change',()=>{
 const m=kitchenBase(initialModule(),600);setKitchenDrawerCount(m,3);setKitchenGola(m,true);
 const sizes=()=>m.kdrawers!.map(d=>d.y1-d.y0);const before=sizes();
 m.kdrawers=layoutKitchenDrawers(m,3);assert.deepEqual(sizes(),before);
 // верхний ящик H-86 уже минимальный под профилем L (820: царга 762,5 = низ профиля): рост нижнего фасада — честная ошибка,
 // а не царга в профиле (раньше проверка ящиков профилей не знала, пересечение было тихим); уменьшение — можно
 assert.throws(()=>resizeKitchenDrawerFront(m,0,320),/Не хватает высоты.*профиль Gola/);
 m.kdrawers=resizeKitchenDrawerFront(m,0,280);assert.equal(sizes()[0],280);assert.deepEqual(validate(m),[]);
 assert.deepEqual(partCollisions(parts(m),m).filter(c=>[c.a,c.b].some(id=>id.startsWith('gola:'))),[]);
 m.kdrawers=layoutKitchenDrawers(m,3,undefined,'firmax-ldsp');assert.equal(sizes()[0],280);assert.deepEqual(validate(m),[]);
 m.height=900;m.kdrawers=layoutKitchenDrawers(m,3);assert.deepEqual(validate(m),[]);
 assert.equal(m.kdrawers!.at(-1)!.y1,m.height-30);
 const collisions=partCollisions(parts(m),m).filter(c=>[c.a,c.b].some(id=>id.startsWith('gola:')));assert.deepEqual(collisions,[]);
});
