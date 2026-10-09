import test from 'node:test';
import assert from 'node:assert/strict';
import {initialModule,parts,validate,parseModule} from '../src/model';
import {kitchenBase} from '../src/kitchen';
import {holes} from '../src/drilling';
import {partCollisions} from '../src/collisions';

// НМ 600 с тремя ящиками Axis PRO как в Базисе k06/m03 (2×H-86 + H-168, 500 мм)
const axis=()=>{const m=kitchenBase(initialModule(),600,'drawers' as never);m.doors=false;m.sections[0].shelves=[];m.sections[0].drawers=0;
  m.kdrawers=[{system:'axis-pro',y0:629.5,y1:787,runnerY:694,h:86,len:500},{system:'axis-pro',y0:469,y1:626.5,runnerY:543,h:86,len:500},{system:'axis-pro',y0:101.5,y1:439,runnerY:174,h:168,len:500}];return m;};

test('Axis PRO drawer: LDSP bottom and back follow the runner like Bazis (37.5 / 43.5 from the sides, 22 below the runner)',()=>{
  const m=axis(),ps=parts(m),b=ps.find(p=>p.id==='kd:0:bottom')!,k=ps.find(p=>p.id==='kd:0:back')!,F=ps.find(p=>p.id==='left')!;
  const front=F.position[2]+F.size[2]/2;
  assert.equal(b.size[0],600-32-75);assert.equal(b.size[2],476);assert.equal(b.position[1]-8,672);
  assert.equal(k.size[0],600-32-87);assert.equal(k.size[1],84);assert.equal(Math.round(k.position[2]+8),Math.round(front-476));
  assert.equal(ps.find(p=>p.id==='kd:2:back')!.size[1],167,'H-168 back 167');
  assert.deepEqual(validate(m),[]);
});

test('Axis PRO hardware: 6 system parts, 2 caps, 2 runners per drawer; Bazis meshes; no unallowed collisions',()=>{
  const m=axis(),ps=parts(m);
  for(const j of [0,1,2]){
    assert.equal(ps.filter(p=>p.id.startsWith(`kd:${j}:sys:`)).length,6);
    assert.equal(ps.filter(p=>p.id.startsWith(`kd:${j}:cap:`)).length,2);
    assert.equal(ps.filter(p=>p.id.startsWith(`kd:${j}:slide:`)).length,2);
  }
  assert.equal(ps.find(p=>p.id==='kd:0:slide:L')!.model!.file,'hardware/bazis/d50b3f8e4044.glb');
  assert.deepEqual(partCollisions(ps,m),[]);
});

test('Axis PRO drilling: runner D5x2.1 x4 + D3x3 x2 per side, rear holder D5x1+D3x3, facade D3.5x4.5 (AB 2, CD 4)',()=>{
  const m=axis(),h=holes(m);
  const side=h.filter(x=>x.part==='left'&&x.d===5&&x.depth===2.1);assert.equal(side.length,12);
  assert.equal(h.filter(x=>x.part==='kd:2:back'&&x.d===5&&x.depth===1).length,6,'H-168: 3 per holder');
  assert.equal(h.filter(x=>x.part==='kd:2:facade'&&x.d===3.5).length,8,'CD: 4 per side');
  assert.equal(h.filter(x=>x.part==='kd:0:facade'&&x.d===3.5).length,4,'AB: 2 per side');
});

test('kdrawers survive save/load and bad input is rejected',()=>{
  const m=axis(),back=parseModule(JSON.parse(JSON.stringify(m)))!;
  assert.deepEqual(back.kdrawers,m.kdrawers);
  const bad={...m,kdrawers:[{...m.kdrawers![0],h:99 as never},{...m.kdrawers![1],y1:700}]};
  const e=validate(bad);
  assert.ok(e.some(x=>/высота царги/.test(x)));assert.ok(e.some(x=>/пересекается/.test(x)));
});