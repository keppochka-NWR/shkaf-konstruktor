import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync,readFileSync} from 'node:fs';
import {validate,parts,initialModule,parseModule} from '../src/model';
import {holes} from '../src/drilling';
import {partCollisions} from '../src/collisions';
import {edgeByDir} from '../src/edges';
import {compareModule,honestPass,type RefModule} from '../scripts/kitchen/compare';
import {moduleFromEtalon} from '../scripts/kitchen/fromEtalon';
import {shelfAtFromEtalon} from '../scripts/kitchen/recognize-tall';

// Эталоны Базиса лежат вне репозитория (Кухни\etalon) — на чужой машине тест пропускается.
const ETALON='C:/Users/My PC/Desktop/Claude Project/Кухни/etalon';
const load=(k:string,key:string)=>(JSON.parse(readFileSync(`${ETALON}/${k}.json`,'utf8')).modules as RefModule[]).find(m=>m.key===key)!;

test('k23 m14: два конфирмата Базиса в одной точке — повторяем (dupParts), отверстие одно, пересечений нет; полка на всю глубину; двери ЛДСП без кромки — PASS',{skip:!existsSync(`${ETALON}/k23.json`)},()=>{
  const ref=load('k23','m14');
  const {module:m,unsupported}=moduleFromEtalon(ref);
  assert.deepEqual(unsupported,[]);
  assert.deepEqual(validate(m),[]);
  assert.equal(m.kitchen?.dupParts?.length,2);
  assert.ok(m.kitchen!.dupParts!.every(id=>id.startsWith('fast:')));
  const ps=parts(m);
  assert.equal(ps.filter(p=>p.id.startsWith('fast:')).length,14,'конфирматов 14, как в Базисе');
  // отверстия: дубль не сверлит второй раз
  const noDup={...m,kitchen:{...m.kitchen!,dupParts:undefined}};
  assert.equal(holes(m,ps).length,holes(noDup,parts(noDup)).length);
  assert.deepEqual(partCollisions(ps,m).filter(c=>c.names.some(n=>/конфирмат/i.test(n))),[]);
  // жёсткая полка — на всю глубину корпуса 577 от задника, съёмные — 575 с отступом 1
  assert.deepEqual(m.sections[0].shelfAt,{1:{rear:0,depth:577}});
  const sid=m.sections[0].id,fixed=ps.find(p=>p.id===`${sid}:shelf:1`)!;
  assert.equal(fixed.size[2],577);
  // кухня без кромки (k23): двери ЛДСП тоже без кромки
  for(const d of ps.filter(p=>p.role==='door'))assert.deepEqual(Object.values(edgeByDir(d)).filter(v=>v>0),[],d.name);
  const c=compareModule(ref,m);
  assert.ok(honestPass(c,validate(m),unsupported),JSON.stringify({hw:c.hardware.filter(h=>h.ref!==h.studio),edges:c.edges?.bad.slice(0,2),pairs:c.pairs.filter(p=>p.delta>0.5).map(p=>p.ref.name+' '+p.delta)}));
});

test('k23 m17 — тот же случай: PASS',{skip:!existsSync(`${ETALON}/k23.json`)},()=>{
  const ref=load('k23','m17');
  const {module:m,unsupported}=moduleFromEtalon(ref);
  const c=compareModule(ref,m);
  assert.ok(honestPass(c,validate(m),unsupported));
  assert.equal(c.hardware.find(h=>h.category==='конфирмат')!.ref,c.hardware.find(h=>h.category==='конфирмат')!.studio);
});

test('k16 m01: опор 10, как в Базисе (две — дубли в одной точке), пересечений опор нет; без дублей у модулей, где их нет в Базисе',{skip:!existsSync(`${ETALON}/k16.json`)},()=>{
  const {module:m}=moduleFromEtalon(load('k16','m01'));
  const ps=parts(m);
  assert.equal(ps.filter(p=>p.id.startsWith('leg:')).length,10);
  assert.ok(m.kitchen!.dupParts!.every(id=>id.startsWith('leg:')));
  assert.deepEqual(partCollisions(ps,m).filter(c=>c.names.some(n=>/Опора/.test(n))),[]);
  const {module:m12}=moduleFromEtalon(load('k12','m04'));
  assert.equal(m12.kitchen?.dupParts,undefined);
});

test('shelfAt: своя глубина полки — только у кухни и не глубже корпуса; парсер сохраняет shelfAt и dupParts',()=>{
  const w=initialModule();
  w.sections[0].shelfAt={0:{rear:0,depth:300}};
  assert.ok(validate(w).some(e=>e.includes('своя глубина')),'шкаф студии — нельзя');
  const k=initialModule();
  k.kitchen={role:'tall',dupParts:['leg:x']} as typeof k.kitchen;
  k.sections[0].shelfAt={0:{rear:0,depth:k.depth+50}};
  assert.ok(validate(k).some(e=>e.includes('своя глубина')),'глубже корпуса — ошибка');
  k.sections[0].shelfAt={0:{rear:0,depth:300}};
  const back=parseModule(JSON.parse(JSON.stringify(k)));
  assert.deepEqual(back.sections[0].shelfAt,{0:{rear:0,depth:300}});
  assert.deepEqual(back.kitchen?.dupParts,['leg:x']);
});

test('shelfAtFromEtalon: полки одной глубины — нет записи; другая глубина или отступ — запись по номеру полки',()=>{
  const b=(z0:number,z1:number)=>({x0:0,y0:0,z0,x1:1,y1:16,z1});
  assert.equal(shelfAtFromEtalon([b(4,579),b(4,579)],575,1,3),undefined);
  assert.deepEqual(shelfAtFromEtalon([b(4,579),b(3,580)],575,1,3),{1:{rear:0,depth:577}});
});
