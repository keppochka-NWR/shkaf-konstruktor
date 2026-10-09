import test from 'node:test';
import assert from 'node:assert/strict';
import {initialModule,parts,validate,parseModule,type Module} from '../src/model';
import {kitchenWall} from '../src/kitchen';
import {holes} from '../src/drilling';
import {partCollisions} from '../src/collisions';

// Antresol 600x300x600 with a lift-up front, as in Bazis k10/m03 "A 2": 2 overlay hinges on the roof, gas lift PD-G-N02 on both sides.
const antresol=(lift=true):Module=>{
  const m=kitchenWall(initialModule(),600);m.height=300;m.depth=600;m.kitchen={...m.kitchen!,role:'antresol'};
  m.sections=[{...m.sections[0],shelves:[],doorLeaves:1,doorHinges:['top']}];
  if(lift)m.kitchenLift={system:'pd-g-n02'};
  return m;
};

test('lift-up kitchen front: hinges on the roof underside, 100 mm from the front edges, Bazis node quaternion',()=>{
  const m=antresol(),ps=parts(m),door=ps.find(p=>p.role==='door'&&p.hinge==='top')!,roof=ps.find(p=>p.id==='top')!;
  const plates=ps.filter(p=>p.id.includes(':hingeplate:')).sort((a,b)=>a.model!.origin![0]-b.model!.origin![0]);
  assert.equal(plates.length,2);
  const x0=door.position[0]-door.size[0]/2,x1=door.position[0]+door.size[0]/2,back=door.position[2]-door.size[2]/2;
  assert.deepEqual(plates.map(p=>Math.round((p.model!.origin![0])*10)/10),[Math.round((x0+100)*10)/10,Math.round((x1-100)*10)/10]);
  for(const p of plates){
    assert.equal(p.model!.origin![1],roof.position[1]-roof.size[1]/2,'plate on the roof underside');
    assert.equal(p.model!.origin![2],back);
    assert.deepEqual(p.model!.quat,[0,-Math.SQRT1_2,0,Math.SQRT1_2]);
  }
});

test('gas lift PD-G-N02: Bazis meshes on both sides, positions from the front top edge, holes, no unallowed collisions',()=>{
  const m=antresol(),ps=parts(m),door=ps.find(p=>p.role==='door'&&p.hinge==='top')!;
  const top=door.position[1]+door.size[1]/2,back=door.position[2]-door.size[2]/2;
  const lift=ps.filter(p=>p.id.startsWith('lift:'));
  assert.equal(lift.filter(p=>p.model?.native).length,8,'rod, block, 2 brackets per side');
  assert.equal(lift.filter(p=>p.id.includes(':screw:')).length,10,'2x3x4 + 3x3x3 per side');
  const fr=lift.find(p=>p.id==='lift:right:face')!,sr=lift.find(p=>p.id==='lift:right:side')!,R=ps.find(p=>p.id==='right')!;
  assert.equal(fr.model!.file,'hardware/bazis/6d1bb0395602.glb');
  assert.deepEqual(fr.model!.origin,[R.position[0]-R.size[0]/2-12,top-90.5,back]);
  assert.deepEqual(sr.model!.origin,[R.position[0]-R.size[0]/2,top-254.5,back-25]);
  const hs=holes(m,ps).filter(h=>h.src.startsWith('lift:'));
  assert.equal(hs.filter(h=>h.d===4&&h.depth===1.8).length,4);
  assert.equal(hs.filter(h=>h.d===3&&h.depth===4).length,4);
  assert.equal(hs.filter(h=>h.d===4&&h.depth===2).length,6);
  assert.equal(hs.filter(h=>h.d===3&&h.depth===3).length,6);
  const cup=holes(m,ps).filter(h=>h.d===35);
  assert.equal(cup.length,2);
  const hinge=ps.filter(p=>/^(lift:|.*:hinge(plate|cup):)/.test(p.id)).map(p=>p.id);
  const bad=partCollisions(ps,m).filter(c=>hinge.includes(c.a)||hinge.includes(c.b));
  assert.deepEqual(bad,[]);
  assert.deepEqual(validate(m),[]);
});

test('kitchenLift: parsed and validated; only for a kitchen lift-up front',()=>{
  const m=antresol();
  assert.deepEqual(parseModule(JSON.parse(JSON.stringify(m))).kitchenLift,{system:'pd-g-n02'});
  const bad={...antresol(),sections:[{...antresol().sections[0],doorHinges:['left' as const]}]};
  assert.ok(validate(bad).some(e=>e.includes('Газлифт')));
  assert.equal(parts(antresol(false)).filter(p=>p.id.startsWith('lift:')).length,0);
  assert.equal(parts(antresol(false)).filter(p=>p.id.includes(':hingeplate:')).length,2,'hinges without a lift too');
});
