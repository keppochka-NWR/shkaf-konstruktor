// Радиусный стеллаж — пределы ширины и глубины (Макс 31.10 «радиусная секция — добавить ограничения по ширине»): 250–600 × 250–600,
// радиус 50…min(W, D) − 16; старый файл шире 600 (пределы до 31.10: 1000 × 700) открывается и правится, новая ширина — только в пределах.
import test from 'node:test';
import assert from 'node:assert/strict';
import {initialModule,validate} from '../src/model';
import {radiusShelving} from '../src/paletteBuild';
import {RADIUS,radiusLimitErrors,radiusEditErrors,radiusMax} from '../src/shapes';

test('радиусный: ширина и глубина в пределах 250–600, радиус не больше четверти круга', () => {
  assert.deepEqual([RADIUS.minW,RADIUS.maxW,RADIUS.minD,RADIUS.maxD,RADIUS.min],[250,600,250,600,50]);
  const ok=radiusShelving(600,2000,400,initialModule());assert.deepEqual(radiusLimitErrors(ok),[]);assert.deepEqual(validate(ok),[]);
  assert.equal(radiusMax(ok),384,'четверть круга — по глубине 400 − 16');
  assert.match(radiusLimitErrors({...ok,width:601})[0],/ширина от 250 до 600/);
  assert.match(radiusLimitErrors({...ok,width:240})[0],/ширина от 250 до 600/);
  assert.match(radiusLimitErrors({...ok,depth:650})[0],/глубина от 250 до 600/);
  assert.ok(validate({...ok,radius:{side:'right',r:500}}).some(e=>/радиус от 50 до 384/.test(e)));
});

test('радиусный: старый файл шире 600 открывается, правка ширины — только в пределах', () => {
  const old={...radiusShelving(600,2000,400,initialModule()),width:800};
  assert.deepEqual(validate(old).filter(e=>/ширина/.test(e)),[],'открывается (пределы до 31.10)');
  const taller={...old,height:1800};assert.deepEqual(radiusEditErrors(old,taller),[],'другая правка не мешает');
  assert.match(radiusEditErrors(old,{...old,width:900})[0],/до 600/);
  assert.deepEqual(radiusEditErrors(old,{...old,width:600}),[]);
  assert.match(radiusEditErrors(undefined,old)[0],/до 600/,'новый (палитра, копия) — по новым пределам');
});
