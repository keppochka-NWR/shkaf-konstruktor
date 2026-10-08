import test from 'node:test';
import assert from 'node:assert/strict';
import {initialModule} from '../src/model';
import {kitchenBase,kitchenWall} from '../src/kitchen';
import {compareModule,refFromStudio} from '../scripts/kitchen/compare';

test('comparator self-check: a module against itself passes',()=>{
  for(const m of [kitchenBase(initialModule(),600),kitchenWall(initialModule(),800),kitchenBase(initialModule(),800,'sink')]){
    const c=compareModule(refFromStudio(m),m);
    assert.ok(c.pass,m.name+': '+JSON.stringify({missing:c.missing.map(x=>x.name),extra:c.extra.map(x=>x.name),worst:c.pairs.filter(p=>p.delta>0.5).map(p=>p.ref.name+' '+p.delta)}));
  }
});

test('comparator catches mutations: 1 mm shift, missing panel, extra hinge, moved leg, mirrored layout',()=>{
  const m=kitchenBase(initialModule(),600),ref=refFromStudio(m);
  const shifted=structuredClone(ref);shifted.panels[0].box=shifted.panels[0].box.map((v,i)=>i===0||i===3?v+1:v);
  assert.equal(compareModule(shifted,m).pass,false,'1 mm shift fails');
  assert.ok(compareModule(shifted,m).pairs.some(p=>p.delta===1));
  const missing=structuredClone(ref);missing.panels.splice(1,1);
  const cm=compareModule(missing,m);assert.equal(cm.pass,false);assert.equal(cm.extra.length,1,'studio has a panel Bazis does not');
  const hinge=structuredClone(ref);hinge.hardware.push({...hinge.hardware.find(h=>h.category==='петля')!,i:999});
  const ch=compareModule(hinge,m);assert.equal(ch.pass,false);assert.ok(ch.hardware.some(h=>h.category==='петля'&&h.ref===h.studio+1));
  const leg=structuredClone(ref);const l=leg.hardware.find(h=>h.category==='опора')!;l.pos=[l.pos[0]+5,l.pos[1],l.pos[2]];
  assert.equal(compareModule(leg,m).pass,false,'a leg 5 mm off fails');
  const mirror=structuredClone(ref);for(const p of mirror.panels)p.box=[600-p.box[3],p.box[1],p.box[2],600-p.box[0],p.box[4],p.box[5]];
  for(const h of mirror.hardware)h.pos=[600-h.pos[0],h.pos[1],h.pos[2]];
  assert.equal(compareModule(mirror,m).pass,false,'a mirrored layout (single door hinged on the other side) fails');
  const asym=kitchenBase(initialModule(),600);asym.sections[0].hingeSide='left';
  assert.equal(compareModule(refFromStudio(asym),{...asym,sections:[{...asym.sections[0],hingeSide:'right'}]}).pass,false,'hinges on the other side fail');
});
