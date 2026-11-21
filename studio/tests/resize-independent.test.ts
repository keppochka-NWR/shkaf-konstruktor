import test from 'node:test';import assert from 'node:assert/strict';import {newProject} from '../src/project';import {resizeInRow,planStretch} from '../src/rowResize';
test('numeric shrink and mouse stretch preserve adjacent module dimensions and positions',()=>{
 const p=newProject(),a=p.modules[0];a.x=100;a.z=100;a.module.width=600;a.module.doors=false;
 const b={...structuredClone(a),id:'neighbor',x:700};p.modules.push(b);
 const q=resizeInRow(p,a.id,550);assert.equal(q.modules[0].module.width,550);assert.deepEqual(q.modules[1],b);
 const drag=planStretch(p,a.id,'right',-50,false);assert.equal(drag.mode,'free');assert.ok(drag.project);assert.deepEqual(drag.project.modules[1],b);
 const grow=planStretch(p,a.id,'right',100,false);assert.equal(grow.delta,0);assert.equal(grow.neighbor,undefined);
 assert.throws(()=>resizeInRow(p,a.id,650));assert.deepEqual(p.modules[1],b);
});
import {applyAutoFillers,localToRoom,parseProject} from '../src/project';
import {initialModule} from '../src/model';import {kitchenTemplate} from '../src/kitchenProject';
test('all quarter rotations: independent sizing leaves lower and upper neighbors unchanged through normalization and reopen',()=>{
 for(const rotation of [0,90,180,270] as const){
  const p=newProject(),a=p.modules[0];p.room.width=6000;p.room.depth=6000;a.x=2000;a.z=2000;a.rotation=rotation;a.module=kitchenTemplate('base-doors',600,initialModule());
  const dx=localToRoom(a,600,0),origin=localToRoom(a,0,0);const b={...structuredClone(a),id:'b',x:a.x+dx.x-origin.x,z:a.z+dx.z-origin.z};const upper={...structuredClone(a),id:'upper',y:1500,module:kitchenTemplate('wall',600,initialModule())};p.modules.push(b,upper);
  const q=applyAutoFillers(resizeInRow(p,a.id,500));assert.equal(q.modules[0].module.width,500);assert.deepEqual(q.modules.slice(1),p.modules.slice(1));
  const r=planStretch(p,a.id,'right',-100,false).project!;assert.ok(r);assert.deepEqual(r.modules.slice(1),p.modules.slice(1));assert.deepEqual(parseProject(JSON.parse(JSON.stringify(q))).modules.slice(1),parseProject(JSON.parse(JSON.stringify(p))).modules.slice(1));
 }
});
