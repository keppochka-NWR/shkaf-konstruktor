import test from 'node:test';
import assert from 'node:assert/strict';
import {initialModule,validate,parts} from '../src/model';
import {KITCHEN,kitchenBase,kitchenWall,kitchenWorktop,kitchenRowWidths} from '../src/kitchen';
import {createKitchenRow} from '../src/ModulePalette';
import {newProject,appendModuleGroup,projectErrors,parseProject} from '../src/project';
import {estimate} from '../src/pricing';
import {details} from '../src/exports';

test('kitchen base: on legs with a removable plinth set back from the fronts, rails instead of a top under the worktop',()=>{
  const m=kitchenBase(initialModule(),600);
  assert.deepEqual(validate(m),[]);
  const ps=parts(m);
  assert.equal(ps.filter(p=>p.id.startsWith('leg:')).length,4);
  const pl=ps.find(p=>p.id==='kitchen-plinth')!;
  assert.ok(Math.abs(pl.position[2]+pl.size[2]/2-(m.depth-KITCHEN.plinthSetback))<1e-6,'plinth 50 behind the front line');
  assert.ok(!ps.some(p=>p.id==='top'),'no top panel');
  assert.ok(ps.some(p=>p.id==='rail:front-top')&&ps.some(p=>p.id==='rail:rear-top'));
});

test('kitchen wall cabinet hangs on two adjustable hangers priced as hardware',()=>{
  const m=kitchenWall(initialModule(),600);
  assert.deepEqual(validate(m),[]);
  assert.equal(parts(m).filter(p=>p.id.startsWith('kitchen-hanger:')).length,2);
  const e=estimate(newProject(m));
  assert.ok(e.lines.some(l=>l.id==='kitchen-hanger'&&l.quantity===2));
});

test('worktop is a separate object priced per running metre and kept out of LDSP cutting',()=>{
  const m=kitchenWorktop(initialModule(),2400);
  assert.deepEqual(validate(m),[]);
  const p=newProject(m),e=estimate(p);
  assert.ok(e.lines.some(l=>l.id==='worktop:postforming:38'&&l.quantity===2.4&&l.unit==='пог.м'));
  assert.equal(e.ldspSheets,0);
  assert.equal(details(p).length,0,'nothing from the postforming worktop in cutting');
});

test('row widths fill the wall exactly with drawers, sink and doors; no carcass wider than 1200',()=>{
  for(const L of [900,1600,2400,3000,3170,4200,5150]){
    const ws=kitchenRowWidths(L);
    assert.equal(ws.reduce((s,w)=>s+w.width,0),L,'covers '+L);
    assert.ok(ws.every(w=>w.width>=150&&w.width<=KITCHEN.maxWidth),L+': '+ws.map(w=>w.width).join('+'));
  }
  assert.deepEqual(kitchenRowWidths(3000).map(w=>w.kind).slice(0,2),['drawers','sink']);
});

test('straight kitchen row fits a room: bases, worktop on top, wall cabinets at the regulation gap',()=>{
  const base=newProject();base.room={...base.room,width:3600,depth:3000,height:2700};
  const group=createKitchenRow(3000,initialModule());
  const r=appendModuleGroup(base,group);
  assert.deepEqual(projectErrors(r.project),[]);
  const placed=r.project.modules.filter(a=>r.ids.includes(a.id));
  const top=placed.find(a=>a.module.worktop)!;assert.equal(top.y,KITCHEN.baseHeight);
  const walls=placed.filter(a=>a.module.kitchen?.role==='wall');
  assert.ok(walls.every(a=>a.y===KITCHEN.baseHeight+KITCHEN.worktopThickness+KITCHEN.wallGap));
  assert.ok(walls.every(a=>(a.y??0)+a.module.height<=2700));
  assert.equal(parseProject(JSON.parse(JSON.stringify(r.project))).modules.filter(a=>a.module.kitchen||a.module.worktop).length,placed.length,'kitchen fields survive save/load');
});
