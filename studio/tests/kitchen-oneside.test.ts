import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync,readFileSync} from 'node:fs';
import {compareModule,type RefModule} from '../scripts/kitchen/compare';
import {moduleFromEtalon} from '../scripts/kitchen/fromEtalon';

// Пакет 4 (backlog m_ONESIDE): дно под одной боковиной, вторая опущена до низа дна — правило было только у нижних и пеналов (bottomUnder +
// kitchen.sideDown); по базе то же у навесных (k06 m08, k16 m12 — правая, k19 m02 угловой — левая). У навесных с поднятыми боковинами
// (raisedSides, k17 m06/m08) низ решает подъём — правило не применяется. Эталоны вне репозитория — тест пропускается.
const ETALON='C:/Users/My PC/Desktop/Claude Project/Кухни/etalon';
const has=(k:string)=>existsSync(`${ETALON}/${k}.json`);
const load=(k:string,key:string)=>(JSON.parse(readFileSync(`${ETALON}/${k}.json`,'utf8')).modules as RefModule[]).find(m=>m.key===key)!;

test('m_ONESIDE: навесные — дно под одной боковиной, вторая до низа дна, детали корпуса как в Базисе',{skip:!has('k06')||!has('k16')||!has('k19')||!has('k17')},()=>{
  for(const [k,key,side] of [['k06','m08','right'],['k16','m12','right'],['k19','m02','left']] as const){
    const ref=load(k,key),r=moduleFromEtalon(ref),c=compareModule(ref,r.module);
    assert.equal(r.module.bottomUnder,true,`${k} ${key}`);assert.deepEqual(r.module.kitchen!.sideDown,{side,y0:0},`${k} ${key}`);
    assert.deepEqual([c.missing.length,c.extra.length],[0,0],`${k} ${key}: детали как в Базисе`);
  }
  const s=moduleFromEtalon(load('k17','m06'));assert.equal(s.module.raisedSides,true);assert.equal(s.module.kitchen!.sideDown,undefined,'поднятые боковины — не это правило');
});
