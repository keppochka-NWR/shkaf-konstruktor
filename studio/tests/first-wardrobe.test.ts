import test from 'node:test';
import assert from 'node:assert/strict';
import {parts,parseModule,validate} from '../src/model';
import {newProject,firstWardrobe} from '../src/project';
import {partCollisions} from '../src/collisions';
import {collisionWarnings} from '../src/roomWarnings';
import {buildCheck} from '../src/buildCheck';

// Аудит магазина Б5: первый шкаф сразу с пересечениями, а внизу панели — «Габариты проверены».
test('шаблон «Добавить первый шкаф»: без пересечений, проверка «Габариты» видит пересечения так же, как панель справа',()=>{
 const p=newProject(),a=p.modules[0];
 assert.equal(a.module.name,'Шкаф в прихожую');
 assert.deepEqual(validate(a.module),[]);
 assert.deepEqual(partCollisions(parts(a.module),a.module),[],'фальш-панель × петля и фасад ящика × петля ушли');
 assert.deepEqual(collisionWarnings(p),[]);
 assert.equal(buildCheck(p,a.id).ok,true);
 assert.equal(buildCheck(p,a.id).title,'Габариты проверены');
 // переживает сохранение и смену высоты
 const back=parseModule(JSON.parse(JSON.stringify(a.module)));assert.deepEqual(partCollisions(parts(back),back),[]);
 for(const h of [1800,2200,2400]){const m=firstWardrobe();m.height=h;assert.deepEqual(partCollisions(parts(m),m),[],`высота ${h}`);}
});

// Решение Макса 16.10.2026: «Петля снизу обязательно должна быть, её максимум — 200 мм от края фасада». Шаблон не поднимает
// петли над ящиками: нижняя — по правилу (100 мм), фальш у неё склеен в 32 мм с разрывом 100 мм, ящики сужены — 0 пересечений.
test('шаблон «Добавить первый шкаф»: нижняя петля ≤ 200 мм от низа двери, фальш 32 мм с разрывом, с «зазором 30 мм» тоже 0 пересечений',()=>{
 for(const h of [1800,2000,2200,2400])for(const grip of [false,true]){
  const m=firstWardrobe();m.height=h;if(grip)m.sections[0].drawerGrip=true;
  assert.equal(m.sections[0].hingeY,undefined,'высоты петель шаблона — по правилу, не вручную');
  const ps=parts(m),door=ps.find(d=>d.role==='door'&&d.id.includes(':door:'))!,b=door.position[1]-door.size[1]/2,t=door.position[1]+door.size[1]/2;
  const ys=ps.filter(d=>d.id.includes(':hingecup:')).map(d=>d.position[1]).sort((x,y)=>x-y);
  assert.ok(ys[0]-b<=200&&ys[0]-b>=40,`${h}: нижняя петля ${ys[0]-b} от низа двери`);
  assert.ok(t-ys.at(-1)!<=200,`${h}: верхняя петля ${t-ys.at(-1)!} от верха двери`);
  assert.ok(ps.some(d=>/склейка 32 мм/.test(d.name)),`${h}: составной фальш 32 мм`);
  assert.deepEqual(partCollisions(ps,m),[],`${h}${grip?' зазор 30':''}: 0 пересечений`);
  assert.deepEqual(validate(m),[]);
 }
 const p=newProject();assert.equal(collisionWarnings(p).length,0);assert.equal(buildCheck(p,p.modules[0].id).ok,true);
});

test('проверка «Габариты» внизу панели показывает пересечения, как панель справа',()=>{
 const p=newProject(),m=p.modules[0].module;
 m.sections[0].shelves=[...m.sections[0].shelves,...m.sections[0].shelves.map(v=>v+0.001)]; // две полки друг в друге
 const hits=collisionWarnings(p);
 const c=buildCheck(p,p.modules[0].id);
 if(hits.length){assert.equal(c.ok,false);assert.notEqual(c.title,'Габариты проверены');}
 else assert.equal(c.ok,true);
});
