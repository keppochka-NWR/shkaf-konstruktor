import test from 'node:test';import assert from 'node:assert/strict';
import {initialModule,parts} from '../src/model';
import {newProject,applyAutoFillers,projectErrors,localToRoom} from '../src/project';
import {connectedModuleIds} from '../src/selectionHierarchy';
import {createKitchenCornerRow} from '../src/kitchenCornerRow';
test('Tab parent includes a transitive contact chain, not remote or vertically separated modules',()=>{
 const p=newProject();const m={...initialModule(),width:600,height:720};p.modules=[0,1,2,5].map((n)=>({id:String(n),x:100+n*600,z:500,y:0,module:structuredClone(m)}));p.modules.push({...structuredClone(p.modules[0]),id:'above',y:1000});
 assert.deepEqual(connectedModuleIds(p,['0']),['0','1','2']);assert.deepEqual(connectedModuleIds(p,['5']),['5']);assert.deepEqual(connectedModuleIds(p,['above']),['above']);
});
for(const wing of ['left','right'] as const)test('Upper corner without junction plank: '+wing,()=>{
 const p=newProject();p.room={...p.room,width:4000,depth:3000,height:2700};p.modules=createKitchenCornerRow(initialModule(),{back:3000,side:2400,wing,room:p.room});
 const next=applyAutoFillers(p);assert.deepEqual(projectErrors(next),[]);
 const wall=next.modules.filter(a=>a.module.kitchen?.role==='wall');assert.ok(wall.length>2);assert.ok(wall.some(a=>a.module.kitchen?.faceFiller));assert.ok(wall.every(a=>a.module.cornerKind!=='plank'));
 assert.ok(next.modules.some(a=>a.module.kitchen?.role==='base'&&a.module.cornerKind==='plank'));
 const first=wall.filter(a=>(a.rotation??0)!==0).sort((a,b)=>a.z-b.z)[0];assert.ok(first);
 // Restore a legacy 16mm junction plank, then verify one-time repair keeps the far edge and does not recur.
 const old=structuredClone(next),a=old.modules.find(x=>x.id===first.id)!;
 const side=localToRoom(a,0,0).z<localToRoom(a,a.module.width,0).z?'left':'right';
 const keep=localToRoom(a,side==='left'?a.module.width:0,0);a.module.width-=16;const moved=localToRoom(a,side==='left'?a.module.width:0,0);a.x+=keep.x-moved.x;a.z+=keep.z-moved.z;a.module.cornerFiller=side;a.module.cornerKind='plank';
 const repaired=applyAutoFillers(old),r=repaired.modules.find(x=>x.id===a.id)!;assert.equal(r.module.width,first.module.width);assert.equal(r.module.cornerKind,undefined);assert.deepEqual(projectErrors(repaired),[]);assert.deepEqual(applyAutoFillers(repaired),repaired);
});
test('Rotated cabinets with overlapping axis-aligned bounds but separated faces are not connected',()=>{
 const p=newProject(),m={...initialModule(),width:1200,height:720,depth:200};p.modules=[{id:'a',x:100,z:100,y:0,rotation:45,module:m},{id:'b',x:300,z:300,y:0,rotation:45,module:structuredClone(m)}];assert.deepEqual(connectedModuleIds(p,['a']),['a']);
});
