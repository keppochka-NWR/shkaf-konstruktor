import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync,readFileSync} from 'node:fs';
import {moduleFromEtalon} from '../scripts/kitchen/fromEtalon';
import type {RefModule} from '../scripts/kitchen/compare';

// Эталоны Базиса лежат вне репозитория (Кухни\etalon) — на другой машине тест пропускается.
const ET='C:/Users/My PC/Desktop/Claude Project/Кухни/etalon/k22.json';
test('Firmax recognizer: a drawer without its own Bazis runner points gets its own runnerY (bottom of its facade), not the lower drawer one (k22/m03)',{skip:!existsSync(ET)},()=>{
  const ref=(JSON.parse(readFileSync(ET,'utf8')).modules as RefModule[]).find(m=>m.key==='m03')!;
  const ks=moduleFromEtalon(ref).module.kdrawers!;assert.equal(ks.length,2);
  const [a,b]=ks;assert.ok(a.system==='firmax-ldsp'&&b.system==='firmax-ldsp');
  assert.equal(a.runnerY,116);assert.equal(a.box.runs!.length,4,'all 4 Bazis points on drawer 1');
  assert.deepEqual(b.box.runs,[]);assert.equal(b.runnerY,b.y0);assert.ok(b.runnerY>=b.y0,'runner point not below its facade');
});
