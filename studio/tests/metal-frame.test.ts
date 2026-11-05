import test from 'node:test';
import assert from 'node:assert/strict';
import { initialModule, parts, parseModule, validate } from '../src/model';
import { metalFrameModule, changeFrameKind, metalFrameLength, metalFramePriceKey } from '../src/metalFrame';
import { applyAutoFillers, newProject, projectErrors, parseProject, modulesOverlap } from '../src/project';
import { createModule } from '../src/paletteBuild';
import { estimate } from '../src/pricing';
import { nest } from '../src/exports';
import { kitchenWorktop } from '../src/kitchen';
import { partCollisions } from '../src/collisions';

for (const kind of ['u', 'closed', 'table'] as const) test(`metal frame ${kind}: exact bounds, no boards or self intersections, roundtrip`, () => {
  const m=metalFrameModule(initialModule()); changeFrameKind(m,kind);
  assert.deepEqual(validate(m),[]); const ps=parts(m);
  assert.equal(ps.length,kind==='u'?3:kind==='closed'?4:9);
  assert.ok(ps.every(p=>p.material==='metal'&&p.external&&p.size.every(v=>v>0)));
  for (const [axis,dim] of [m.width,m.height,m.depth].entries()) {
    assert.equal(Math.min(...ps.map(p=>p.position[axis]-p.size[axis]/2)),0);
    assert.equal(Math.max(...ps.map(p=>p.position[axis]+p.size[axis]/2)),dim);
  }
  assert.deepEqual(partCollisions(ps,m),[]);
  assert.deepEqual(parts(parseModule(JSON.parse(JSON.stringify(m)))),ps);
  const p=newProject();p.modules=[{id:'frame',x:0,z:0,y:0,rotation:0,module:m}];
  assert.deepEqual(projectErrors(p),[]);assert.deepEqual(nest(p),[]);
  assert.deepEqual(applyAutoFillers(p),p);assert.deepEqual(parseProject(p).modules[0].module.metalFrame,m.metalFrame);
});
test('metal frame price is separate, unknown until provided, no cabinet hardware added',()=>{
  const p=newProject(),m=metalFrameModule(initialModule());p.modules=[{id:'frame',x:0,z:0,module:m}];
  let e=estimate(p);assert.equal(e.retail,null);assert.equal(e.lines.length,1);assert.equal(e.lines[0].retail,true);
  p.calculation={markup:2.2,overrides:{[metalFramePriceKey(m)]:7500}};
  e=estimate(p);assert.equal(e.retail,7500);assert.equal(e.lines[0].quantity,1);
  m.width+=100;assert.equal(estimate(p).retail,null,'old quotation must not follow resized frame');
});
test('frame price stays outside sheet allowance and duplicates aggregate once each',()=>{
  const p=newProject(),base=estimate(p).retail!,m=metalFrameModule(initialModule());
  p.modules.push({id:'frame1',x:1500,z:0,module:m},{id:'frame2',x:2200,z:0,module:structuredClone(m)});
  p.calculation={markup:2.2,overrides:{[metalFramePriceKey(m)]:7500}};
  assert.equal(estimate(p).retail,base+15000);
});
test('tabletop rests on frame, interior volume remains empty but steel collides',()=>{
  const m=metalFrameModule(initialModule(),1200,870,600),a={id:'frame',x:0,y:0,z:0,module:m};
  const top=kitchenWorktop(initialModule(),1200);top.depth=600;
  const b={id:'top',x:0,z:0,y:870,module:top};
  assert.equal(modulesOverlap(a,b),false);b.y=869;assert.equal(modulesOverlap(a,b),true);
  const inside={id:'box',x:100,z:100,y:0,module:{...initialModule(),width:400,height:600,depth:350}};
  assert.equal(modulesOverlap(a,inside),false);inside.x=0;inside.z=0;assert.equal(modulesOverlap(a,inside),true);
});
test('invalid profiles, incompatible filling and malformed saved data rejected',()=>{
  const m=metalFrameModule(initialModule());m.metalFrame!.tubeWidth=NaN;assert.ok(validate(m).length);
  assert.throws(()=>parseModule({...metalFrameModule(initialModule()),metalFrame:null}));
  const bad=metalFrameModule(initialModule());bad.doors=true;assert.ok(validate(bad).length);
  const narrow=metalFrameModule(initialModule(),100);assert.ok(validate(narrow).length);
});
test('palette frame supports narrow depth and profile length reflects geometry',()=>{
  const m=createModule('metal-frame',600,870,30,initialModule());
  assert.deepEqual(validate(m),[]);assert.equal(metalFrameLength(m),2.22);
});
