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
 // старый шаблон (петля по правилу 100 мм) — пересечения, и проверка внизу панели их показывает, а не «Габариты проверены»
 const old=structuredClone(p);delete old.modules[0].module.sections[0].hingeY;delete old.modules[0].module.sections[0].hingeYFor;
 const hits=collisionWarnings(old);assert.equal(hits.length,1);
 const c=buildCheck(old,a.id);assert.equal(c.ok,false);assert.notEqual(c.title,'Габариты проверены');
 assert.match(c.detail,/Фальш-панель левая × Петля/);
});
