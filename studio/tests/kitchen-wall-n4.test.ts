import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync,readFileSync} from 'node:fs';
import {validate,parts,parseModule} from '../src/model';
import {holes} from '../src/drilling';
import {partCollisions} from '../src/collisions';
import {compareModule,honestPass,type RefModule} from '../scripts/kitchen/compare';
import {moduleFromEtalon} from '../scripts/kitchen/fromEtalon';
import {handlePlace} from '../scripts/kitchen/recognize-handle';

// Навесные кухни (n4-wall). Эталоны Базиса лежат вне репозитория — на чужой машине тесты по эталонам пропускаются.
const ETALON='C:/Users/My PC/Desktop/Claude Project/Кухни/etalon';
const has=(k:string)=>existsSync(`${ETALON}/${k}.json`);
const load=(k:string,key:string)=>(JSON.parse(readFileSync(`${ETALON}/${k}.json`,'utf8')).modules as RefModule[]).find(m=>m.key===key)!;
const pass=(k:string,key:string)=>{const ref=load(k,key),{module:m,unsupported}=moduleFromEtalon(ref);const err=validate(m),c=compareModule(ref,m);return {m,err,c,ok:honestPass(c,err,unsupported)};};

test('горизонтальный фасад кухни шире 700 (k23 m05: 796,5×454, два ряда) — не ошибка, как в Базисе',{skip:!has('k23')},()=>{
  const {err,ok}=pass('k23','m05');
  assert.deepEqual(err,[]);
  assert.equal(ok,true);
});

test('вертикальный фасад кухни шире 700 — по-прежнему ошибка (в базе Базиса таких нет)',{skip:!has('k09')},()=>{
  const {m}=pass('k09','m02'); // одна дверь 370×765
  const wide={...m,width:760};
  const d=parts(wide).find(p=>p.role==='door')!;
  assert.ok(d.width>700&&d.width<d.length);
  assert.ok(validate(wide).some(e=>/Фасад шире 700/.test(e)));
});

test('ручка-рейлинг на месте Базиса: k09 m02 — горизонтально по центру в 30 от низа фасада, без отверстий',{skip:!has('k09')},()=>{
  const {m,c,ok}=pass('k09','m02');
  assert.deepEqual(m.kitchen?.handle,{dy:30,from:'bottom',horizontal:true});
  assert.equal(c.hardware.find(h=>h.category==='ручка')?.maxPosDelta,0);
  assert.equal(ok,true);
  assert.equal(holes(m).filter(h=>h.src.includes(':handle:')).length,0);
});

test('ручка k07 m07 на подъёмном фасаде: место и 2 × D5×18 насквозь с межосевым 160, как в Базисе',{skip:!has('k07')},()=>{
  const {m,c,ok}=pass('k07','m07');
  assert.deepEqual(m.kitchen?.handle,{dy:40,from:'bottom',horizontal:true,holes:{d:5,depth:18,gap:160}});
  const hh=holes(m).filter(h=>h.src.includes(':handle:'));
  assert.equal(hh.length,2);
  assert.ok(hh.every(h=>h.d===5&&h.depth===18&&h.dir[2]===-1));
  assert.equal(Math.abs(hh[0].at[0]-hh[1].at[0]),160);
  assert.equal(c.holes?.matched,c.holes?.ref);
  assert.equal(ok,true);
});

test('место ручки сохраняется в проекте (parseModule)',{skip:!has('k07')},()=>{
  const {m}=pass('k07','m07');
  const back=parseModule(JSON.parse(JSON.stringify(m)));
  assert.deepEqual(back.kitchen?.handle,m.kitchen?.handle);
});

test('handlePlace: ручки в разных местах — правила нет, остаётся правило студии',()=>{
  const ref={key:'x',name:'x',archetype:'wall',size:[800,900,350],panels:[],holes:[],hardware:[
    {i:0,name:'ручка',category:'ручка',pos:[200,30,346],quat:[1,0,0,0],host:0},
    {i:1,name:'ручка',category:'ручка',pos:[600,60,346],quat:[1,0,0,0],host:1},
  ]} as unknown as RefModule;
  assert.equal(handlePlace(ref,[[0,0,330,400,900,346],[400,0,330,800,900,346]]),undefined);
  assert.deepEqual(handlePlace({...ref,hardware:ref.hardware.map(h=>({...h,pos:[h.pos[0],30,346]}))},[[0,0,330,400,900,346],[400,0,330,800,900,346]]),{dy:30,from:'bottom',horizontal:true});
});

test('шкаф студии: место ручки по-прежнему по правилу студии (kitchen.handle только у кухни)',()=>{
  const {m}=has('k09')?pass('k09','m02'):{m:undefined};
  if(!m)return;
  const plain={...m,kitchen:undefined};
  const h=parts(plain).find(p=>p.role==='handle');
  assert.ok(h);
  assert.equal(h!.anchor,undefined);
});

test('сушка Базиса без сетки (k02 m03 «Сушка тарелки/чашки»): точка проекта без тела, сверка 2/2, пересечений нет',{skip:!has('k02')},()=>{
  const {m,c,ok}=pass('k02','m03');
  const d=parts(m).filter(p=>p.id.startsWith('kitchen-dryer:'));
  assert.deepEqual(d.map(p=>p.name),['Сушка тарелки','Сушка чашки']);
  assert.ok(d.every(p=>!p.model),'геометрию не выдумываем');
  assert.deepEqual(partCollisions(parts(m),m),[]);
  const row=c.hardware.find(h=>h.category==='сушка')!;
  assert.deepEqual([row.ref,row.studio,row.maxPosDelta,row.note],[2,2,0,undefined]);
  assert.equal(ok,true);
  const back=parseModule(JSON.parse(JSON.stringify(m)));
  assert.equal(back.kitchen?.dryer?.length,2,'сушка без сетки сохраняется в проекте');
});
