import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync,readFileSync} from 'node:fs';
import {initialModule,parts,validate,parseModule} from '../src/model';
import {kitchenBase} from '../src/kitchen';
import {holes} from '../src/drilling';
import {partCollisions} from '../src/collisions';
import {relayoutKDrawers,refitKDrawers,axisFits,type ModernDrawer} from '../src/kitchenDrawers';
import {moduleFromEtalon} from '../scripts/kitchen/fromEtalon';
import {compareModule,type RefModule} from '../scripts/kitchen/compare';

// MODERN SLIDE — короб ЛДСП, направляющая в Базисе без сетки (в студии процедурная), как k09/m05 (НМ 600, три ящика)
const ms=()=>{const m=kitchenBase(initialModule(),600,'drawers' as never);m.doors=false;m.sections[0].shelves=[];m.sections[0].drawers=0;
  m.kdrawers=relayoutKDrawers(m,3,undefined,'modern-slide');return m;};

test('MODERN SLIDE layout and box: 8.5 from the cabinet, bottom 13 above the sides, confirmats D5x35, procedural runner with an honest label',()=>{
  const m=ms(),ks=m.kdrawers!.filter((k):k is ModernDrawer=>k.system==='modern-slide');assert.equal(ks.length,3);assert.ok(ks.every(k=>axisFits(m,k)));
  const ps=parts(m),h=holes(m),L=ps.find(p=>p.id==='left')!,x0=L.position[0]+L.size[0]/2,k=ks[0];
  assert.equal(ps.find(p=>p.id==='kd:0:fx:side:L')!.position[0]-8,x0+8.5);assert.equal(ps.find(p=>p.id==='kd:0:fx:bottom')!.position[1]-8,k.box.y+13);
  const run=ps.find(p=>p.id==='kd:0:slide:L')!;assert.ok(!run.model&&/процедурная/.test(run.name));
  assert.ok(h.filter(x=>x.part==='kd:0:fx:back'&&x.d===5).every(x=>x.depth===35)&&h.some(x=>x.part==='kd:0:fx:back'&&x.d===5));
  assert.equal(h.filter(x=>x.part==='left'&&x.d===3&&x.depth===3).length,6,'3.5x16: 2 per drawer');
  assert.deepEqual(validate(m),[]);assert.deepEqual(partCollisions(parts(m),m),[]);
  const back=parseModule(JSON.parse(JSON.stringify(m)))!;assert.deepEqual(back.kdrawers,m.kdrawers);
  const n={...m,height:m.height-80};n.kdrawers=refitKDrawers(n,'height');assert.ok(n.kdrawers!.every(x=>x.system==='modern-slide'));assert.deepEqual(validate(n),[]);
});

const ET='C:/Users/My PC/Desktop/Claude Project/Кухни/etalon/k09.json';
test('MODERN SLIDE recognizer + compare k09/m05: panels, edges, holes, confirmats and Bazis runner points match',{skip:!existsSync(ET)},()=>{
  const ref=(JSON.parse(readFileSync(ET,'utf8')).modules as RefModule[]).find(x=>x.key==='m05')!;
  const {module:m}=moduleFromEtalon(ref);assert.ok(m.kdrawers!.length===3&&m.kdrawers!.every(k=>k.system==='modern-slide'));
  const c=compareModule(ref,m);
  assert.equal(c.missing.length,0);assert.equal(c.extra.length,0);assert.ok(c.pairs.every(p=>p.delta<=0.5));assert.deepEqual(c.edges?.bad??[],[]);
  assert.equal(c.holes!.missing.length,0);assert.equal(c.holes!.extra.length,0);
  const row=(cat:string)=>c.hardware.find(r=>r.category===cat)!;
  assert.equal(row('направляющая').studio,row('направляющая').ref);assert.equal(row('направляющая').maxPosDelta,0);
  assert.equal(row('конфирмат').studio,row('конфирмат').ref);
});
