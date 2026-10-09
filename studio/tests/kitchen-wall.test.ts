import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync,readFileSync} from 'node:fs';
import {validate,parts,initialModule,facadeBottom,parseModule} from '../src/model';
import {kitchenWall} from '../src/kitchen';
import {compareModule,type RefModule} from '../scripts/kitchen/compare';
import {moduleFromEtalon} from '../scripts/kitchen/fromEtalon';

// Эталоны Базиса лежат вне репозитория (Кухни\etalon) — на чужой машине тесты по эталонам пропускаются.
const ETALON='C:/Users/My PC/Desktop/Claude Project/Кухни/etalon';
const load=(k:string,key:string)=>(JSON.parse(readFileSync(`${ETALON}/${k}.json`,'utf8')).modules as RefModule[]).find(m=>m.key===key)!;
const plinthLike=(m:ReturnType<typeof initialModule>)=>parts(m).filter(p=>/цоколь/i.test(p.name)||p.id==='plinth');

test('навесной с поднятым корпусом (k30 m06): фасады до низа модуля, цоколя нет — как в Базисе',{skip:!existsSync(`${ETALON}/k30.json`)},()=>{
  const ref=load('k30','m06'),{module:m}=moduleFromEtalon(ref);
  assert.deepEqual(validate(m),[]);
  assert.equal(m.raisedSides,true);
  assert.deepEqual(m.kitchen?.raise,{doorsToFloor:true});
  assert.equal(facadeBottom(m),0,'фасад от низа модуля');
  assert.deepEqual(plinthLike(m).map(p=>p.name),[],'студия не добавляет цоколь, которого нет в Базисе');
  const c=compareModule(ref,m);
  assert.deepEqual([c.missing.length,c.extra.length,c.pairs.filter(p=>p.delta>0.5).length],[0,0,0]);
});

test('навесной с поднятым дном и фронтальной ЛДСП под дном (k14 m03): панель под дном вместо цоколя, фасад с зазором 1,5',{skip:!existsSync(`${ETALON}/k14.json`)},()=>{
  const ref=load('k14','m03'),{module:m}=moduleFromEtalon(ref);
  assert.equal(m.plinthHeight,255);
  assert.deepEqual(m.kitchen?.raise,{front:0});
  const pl=plinthLike(m);
  assert.equal(pl.length,1);
  assert.equal(pl[0].name,'Фронтальная под дном');
  assert.deepEqual(pl[0].size,[m.width-32,255,16]);
  assert.equal(pl[0].position[2],m.depth-8,'заподлицо с лицом боковин');
  assert.equal(facadeBottom(m),1.5);
});

test('навесной с поднятым дном без панели под дном (k01 m09): ни цоколя, ни панели',{skip:!existsSync(`${ETALON}/k01.json`)},()=>{
  const {module:m}=moduleFromEtalon(load('k01','m09'));
  assert.equal(m.plinthHeight,135);
  assert.deepEqual(m.kitchen?.raise,{});
  assert.deepEqual(plinthLike(m),[]);
  assert.ok(!validate(m).some(e=>/цокол|Подъём/.test(e)),validate(m).join('; '));
});

test('подъём дна — только у кухни: шкаф с цоколем 80 по-прежнему с цоколем и списком высот',()=>{
  const w={...initialModule(),plinthHeight:80};
  assert.equal(plinthLike(w).length,1);
  assert.ok(validate({...w,plinthHeight:13}).includes('Выберите высоту цоколя из списка.'));
  const k=kitchenWall(initialModule(),600);
  const r={...k,plinthHeight:13,raisedSides:true,kitchen:{...k.kitchen!,raise:{doorsToFloor:true}}};
  assert.deepEqual(validate(r),[]);
  assert.deepEqual(plinthLike(r),[]);
  assert.deepEqual(parseModule(JSON.parse(JSON.stringify(r))).kitchen?.raise,{doorsToFloor:true},'raise переживает сохранение');
  assert.ok(validate({...r,kitchen:{...r.kitchen,raise:{front:-5}}}).some(e=>/Подъём дна/.test(e)));
});
