import test from 'node:test';
import assert from 'node:assert/strict';
import {estimate,lineGroup,hardwareKind} from '../src/pricing';
import {newProject,projectErrors,applyAutoFillers} from '../src/project';
import {drawerConfig,section} from '../src/model';
import {hardwareChoice,setAllHandles,setAllSlides,setAllOpening,setAllFastening} from '../src/hardwareSwap';
import {HANDLES} from '../src/handles';

function withDrawers(){
  const p=newProject();const m=p.modules[0].module;
  m.sections=[{...section(),drawers:3},...m.sections.slice(1)];
  return p;
}

test('estimate splits retail into materials and hardware that sum to the markup price',()=>{
  const e=estimate(newProject());
  assert.ok(e.split.material>0&&e.split.hardware>0);
  assert.equal(e.byMarkup,e.split.material+e.split.hardware);
  assert.ok(Math.abs(e.split.materialCost+e.split.hardwareCost-e.knownCost)<=1,'parts are rounded separately');
  assert.equal(lineGroup('sheet:Белый'),'material');assert.equal(lineGroup('edge2'),'material');assert.equal(lineGroup('work'),'material');
  assert.equal(lineGroup('hinge'),'hardware');assert.equal(lineGroup('slide:ball:450'),'hardware');assert.equal(hardwareKind('slide:ball:450'),'slides');assert.equal(hardwareKind('handle:uz819-128'),'handles');
});

test('replacing handles project-wide changes only the hardware part of the price',()=>{
  const p=newProject(),before=estimate(p);
  const dear=HANDLES.reduce((a,b)=>b.len<=160&&b.price>a.price?b:a);
  const next=setAllHandles(p,dear.id),after=estimate(next);
  assert.deepEqual(projectErrors(next),[]);
  assert.deepEqual(hardwareChoice(next).handles,[dear.id]);
  assert.equal(after.split.material,before.split.material);
  assert.ok(after.split.hardware>before.split.hardware);
  assert.ok(p.modules[0].module.handleId!==dear.id||before.split.hardware===after.split.hardware,'source project is not mutated');
});

test('wall-tight niche keeps the body in place without wall fillers instead of pushing it through the wall',()=>{
  const p=newProject();const a=p.modules[0];
  p.room={...p.room,width:a.module.width+8};a.x=4;a.z=30;a.rotation=0;
  const n=applyAutoFillers(p),b=n.modules[0];
  assert.deepEqual(projectErrors(n),[]);
  assert.equal(b.x,4);assert.equal(b.module.wallFiller,undefined);
});

test('slides, opening and fastening swaps apply to every module and keep the project valid',()=>{
  const p=withDrawers();
  const hidden=setAllSlides(p,'gtv0fpo');assert.deepEqual(projectErrors(hidden),[]);
  const m=hidden.modules[0].module,s=m.sections[0];
  for(let j=0;j<s.drawers;j++)assert.equal(drawerConfig(m,s,j).slide,'gtv0fpo');
  assert.deepEqual(hardwareChoice(hidden).slides,['hidden-dtc-push']);
  assert.equal(drawerConfig(p.modules[0].module,p.modules[0].module.sections[0],0).slide,'ball');
  const push=setAllOpening(p,'push');assert.ok(push.modules.every(a=>a.module.doorOpen==='push'));
  const ep=estimate(push);assert.ok(ep.lines.some(l=>l.id.startsWith('push-latch')));
  const ecc=setAllFastening(p,'eccentric');assert.ok(ecc.modules.every(a=>a.module.fastening==='eccentric'));
  assert.ok(estimate(ecc).lines.some(l=>l.id==='eccentric'));
});
