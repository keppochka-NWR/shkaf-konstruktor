import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync,readFileSync} from 'node:fs';
import {validate,parts,parseModule} from '../src/model';
import {mirrorKitchen} from '../src/kitchen';
import {compareModule,type RefModule} from '../scripts/kitchen/compare';
import {moduleFromEtalon} from '../scripts/kitchen/fromEtalon';

// Пакет 6: фасад шире корпуса (backlog F_WIDE_FACADE) — свес фасада антресоли за правую боковину (k19 m03/m04: 12,5 мм).
const ETALON='C:/Users/My PC/Desktop/Claude Project/Кухни/etalon';
const has=(k:string)=>existsSync(`${ETALON}/${k}.json`);
const load=(k:string,key:string)=>(JSON.parse(readFileSync(`${ETALON}/${k}.json`,'utf8')).modules as RefModule[]).find(m=>m.key===key)!;

test('faceOver: корпус по боковинам, фасад k19 m03 со свесом 12,5 за правую боковину — все детали, петли и отверстия как в Базисе',{skip:!has('k19')},()=>{
  const ref=load('k19','m03'),r=moduleFromEtalon(ref),m=r.module;
  assert.equal(m.width,670);
  assert.deepEqual(m.kitchen?.faceOver,{right:12.5});
  assert.deepEqual(validate(m),[]);
  const c=compareModule(ref,m);
  assert.equal(c.missing.length,0);assert.equal(c.extra.length,0);
  assert.ok(c.pairs.every(p=>p.delta<=0.5),JSON.stringify(c.pairs.map(p=>p.delta)));
  // единственное расхождение — «Счетчик» Базиса (прочее, без сетки, внутри антресоли; один на всю базу) — не фурнитура корпуса
  assert.deepEqual(c.hardware.filter(h=>h.ref!==h.studio).map(h=>h.category),['прочее']);
  const door=parts(m).find(p=>p.role==='door')!;
  assert.equal(door.position[0]+door.size[0]/2,682.5);
});

test('faceOver: поле читается, зеркало переносит свес на другую сторону, без поля фасад как раньше',{skip:!has('k19')},()=>{
  const base=parseModule(JSON.parse(JSON.stringify(moduleFromEtalon(load('k19','m03')).module)));
  assert.deepEqual(base.kitchen?.faceOver,{right:12.5});
  const mir=parseModule(JSON.parse(JSON.stringify(base)));mirrorKitchen(mir);
  assert.deepEqual(mir.kitchen?.faceOver,{left:12.5});
  assert.equal(Math.min(...parts(mir).filter(p=>p.role==='door').map(p=>p.position[0]-p.size[0]/2)),-12.5);
  const plain=parseModule(JSON.parse(JSON.stringify(base)));delete plain.kitchen!.faceOver;
  assert.equal(Math.max(...parts(plain).filter(p=>p.role==='door').map(p=>p.position[0]+p.size[0]/2)),668.5);
});