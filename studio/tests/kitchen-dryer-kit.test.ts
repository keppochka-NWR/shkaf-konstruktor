import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync,readFileSync} from 'node:fs';
import {validate,parts,parseModule} from '../src/model';
import {compareModule,honestPass,type RefModule} from '../scripts/kitchen/compare';
import {moduleFromEtalon} from '../scripts/kitchen/fromEtalon';
import {holes} from '../src/drilling';

// Пакет 6: элементы комплекта сушки, которые Базис пишет в «прочее» (backlog F_DRYER): «Вращение», «10x13» с отверстием D10×13.
const ETALON='C:/Users/My PC/Desktop/Claude Project/Кухни/etalon';
const has=(k:string)=>existsSync(`${ETALON}/${k}.json`);
const load=(k:string,key:string)=>(JSON.parse(readFileSync(`${ETALON}/${k}.json`,'utf8')).modules as RefModule[]).find(m=>m.key===key)!;

test('сушка с регуляцией k25 m14: 8 «10x13» + 8 «Вращение» в точках проекта, 8 отверстий D10×13 в боковины — PASS',{skip:!has('k25')},()=>{
  const ref=load('k25','m14'),r=moduleFromEtalon(ref),err=validate(r.module),c=compareModule(ref,r.module);
  assert.deepEqual(err,[]);assert.ok(honestPass(c,err,r.unsupported),JSON.stringify(c.hardware.filter(h=>h.ref!==h.studio)));
  const fix=(r.module.kitchen?.dryer??[]).filter(d=>d.fix);
  assert.equal(fix.length,16);
  assert.equal(fix.filter(d=>d.hole).length,8);assert.ok(fix.filter(d=>d.hole).every(d=>d.hole![0]===10&&d.hole![1]===13&&d.x===16));
  const hs=holes(r.module).filter(h=>h.src.startsWith('kitchen-dryer-fix:'));
  assert.equal(hs.length,8);
  assert.deepEqual(parts(r.module).filter(p=>p.id.startsWith('kitchen-dryer-fix:')).length,16);
  // поле читается; «10x13» остаётся у своей боковины после расширения
  const m2=parseModule(JSON.parse(JSON.stringify(r.module)));assert.deepEqual(m2.kitchen?.dryer,r.module.kitchen?.dryer);
  m2.width+=100;const R=parts(m2).find(p=>p.id==='right')!;
  assert.ok(holes(m2).filter(h=>h.src.startsWith('kitchen-dryer-fix:')&&h.at[0]>450).every(h=>h.at[0]===R.position[0]-R.size[0]/2));
});

test('сушка k06 m07: «Вращение» без отверстий (как в Базисе) — «прочее» сходится',{skip:!has('k06')},()=>{
  const ref=load('k06','m07'),r=moduleFromEtalon(ref),c=compareModule(ref,r.module);
  const fix=(r.module.kitchen?.dryer??[]).filter(d=>d.fix);
  assert.equal(fix.length,8);assert.ok(fix.every(d=>!d.hole));
  const pr=c.hardware.find(h=>h.category==='прочее')!;assert.equal(pr.ref,pr.studio);
});

// mirrorKitchen не трогает kitchen.dryer: по всей базе комплекты элементов «прочего» симметричны (каждому слева — такой же справа в
// тех же x от своей боковины, y, z), поэтому зеркало модуля даёт тот же набор. Если появится несимметричный комплект — тест упадёт,
// и зеркало придётся учить (сетки Базиса левые/правые, простой сменой стороны не обойтись)
test('сушка: элементы комплекта симметричны по сторонам во всех модулях базы с ними (k06 m07, k08 m08, k21 m05/m06, k25 m14) — зеркало без изменений верно',()=>{
  const mods=[['k06','m07'],['k08','m08'],['k21','m05'],['k21','m06'],['k25','m14']].filter(([k])=>has(k));
  for(const [k,key] of mods){
    const fix=(moduleFromEtalon(load(k,key)).module.kitchen?.dryer??[]).filter(d=>d.fix);
    const sig=(s:string)=>fix.filter(d=>d.side===s).map(d=>[d.name,d.x,d.y,d.z,d.hole?.join('x')??''].join('|')).sort();
    assert.ok(fix.length>0,`${k} ${key}`);
    assert.deepEqual(sig('left'),sig('right'),`${k} ${key}`);
  }
});
