import test from 'node:test';
import assert from 'node:assert/strict';
import {initialModule,parts,validate,parseModule} from '../src/model';
import {kitchenBase,kitchenWall,mirrorKitchen} from '../src/kitchen';
import {holes} from '../src/drilling';
import {newProject} from '../src/project';
import {estimate} from '../src/pricing';
import {applyFacadeStyle} from '../src/applyFacadeStyle';
const span=(p:ReturnType<typeof parts>[number],axis:number)=>[p.position[axis]-p.size[axis]/2,p.position[axis]+p.size[axis]/2];
for(const sides of [{left:true},{right:true},{left:true,right:true}])test('facade sides replace structural panels, bottom joints and front plinth '+JSON.stringify(sides),()=>{
 const m=kitchenBase(initialModule(),600);m.facadeDecor='Графит';m.kitchen!.facadeSides=sides;
 assert.deepEqual(validate(m),[]);const ps=parts(m),get=(id:string)=>ps.find(p=>p.id===id)!;
 for(const side of ['left','right'] as const){
  const selected=!!sides[side];const p=get(side);
  assert.equal(ps.filter(p=>p.id===side).length,1);assert.equal(p.role,'body');assert.equal(p.decor,selected?'Графит':m.decor);
  assert.equal(span(p,1)[0],selected?0:116);assert.equal(span(p,1)[1],820);
  const joint=get('fast:bottom:'+side+':0');assert.ok(joint);
  assert.equal(holes(m).filter(h=>h.src===joint.id).length,2,'both panels drilled at bottom joint');
 }
 const endpoints=[sides.left?16:0,sides.right?584:600];
 assert.deepEqual(span(get('bottom'),0),endpoints);assert.deepEqual(span(get('kitchen-plinth'),0),endpoints);
 assert.equal(get('kitchen-plinth').length,endpoints[1]-endpoints[0]);
 assert.equal(get('left').thickness,16);assert.equal(get('right').thickness,16);
});
test('sides persist, mirror, follow resize/material and can stop at carcass; walls do not drop',()=>{
 let m=kitchenBase(initialModule(),600);m.kitchen!.facadeSides={left:true};m=parseModule(JSON.parse(JSON.stringify(m)));
 assert.equal(m.kitchen!.facadeSides?.left,true);mirrorKitchen(m);assert.equal(m.kitchen!.facadeSides?.right,true);assert.equal(m.kitchen!.facadeSides?.left,false);
 m.height=900;m.facadeDecor='Белый';assert.equal(parts(m).find(p=>p.id==='right')!.length,900);
 m.kitchen!.facadeSides!.toFloor=false;assert.equal(span(parts(m).find(p=>p.id==='right')!,1)[0],116);
 const wall=kitchenWall(initialModule(),600);wall.kitchen!.facadeSides={left:true};assert.deepEqual(validate(wall),[]);
 assert.equal(span(parts(wall).find(p=>p.id==='left')!,1)[0],0);assert.equal(parts(wall).find(p=>p.id==='left')!.length,wall.height);
});
test('external side is purchased by true face area, not by its 16mm edge; no LDSP duplicate',()=>{
 const m=kitchenBase(initialModule(),600);m.doors=false;m.facadeMaterial='external';m.kitchen!.facadeSides={left:true};
 const left=parts(m).find(p=>p.id==='left')!;assert.equal(left.external,true);assert.equal(left.facadeSide,true);
 const q=estimate(newProject(m));const row=q.lines.find(l=>l.id==='facade-external')!;assert.ok(row);assert.equal(row.quantity,0.457);
});
test('unsupported structural material is rejected instead of cutting MDF as 16mm LDSP',()=>{
 const m=kitchenBase(initialModule(),600);m.kitchen!.facadeSides={right:true};m.facadeT=19;assert.ok(validate(m).some(e=>e.includes('16 мм')));
});
test('all-module shortcut preserves removed leaves and rejects open shelf source atomically',()=>{
 const m=initialModule();m.doors=true;const p=newProject(m);const target=structuredClone(p.modules[0]);target.id='two';target.module.sections[0].removedDoors=[0];p.modules.push(target);
 const q=applyFacadeStyle(p,p.modules[0].id);assert.deepEqual(q.modules[1].module.sections[0].removedDoors,[0]);
 p.modules[0].module.doors=false;p.modules[0].module.sections.forEach(s=>s.drawers=0);const before=JSON.stringify(p);
 assert.throws(()=>applyFacadeStyle(p,p.modules[0].id));assert.equal(JSON.stringify(p),before);
});

test('tall end side reaches floor and disabling the option restores original cut list',()=>{
 const m=kitchenBase(initialModule(),600);m.kitchen!.role='tall';m.height=2100;
 const before=parts(m);m.kitchen!.facadeSides={right:true};const after=parts(m),right=after.find(p=>p.id==='right')!;
 assert.deepEqual(span(right,1),[0,2100]);assert.equal(right.length,2100);assert.equal(right.width,m.depth);
 m.kitchen!.facadeSides={right:false};assert.deepEqual(parts(m),before);
});
