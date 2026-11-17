import test from 'node:test';
import assert from 'node:assert/strict';
import {initialModule,validate} from '../src/model';
import {kitchenBase} from '../src/kitchen';
import {newProject} from '../src/project';
import {applyKitchenGola} from '../src/applyKitchenGola';
import {setKitchenDrawerCount} from '../src/kitchenEditing';

function fixture(){
 const m=kitchenBase(initialModule(),600);m.height=850;setKitchenDrawerCount(m,3);
 const p=newProject(m),a=p.modules[0];
 p.room.width=6000;
 p.modules=Array.from({length:3},(_,i)=>({...structuredClone(a),id:'gola-'+i,x:100+i*800}));
 return p;
}
test('Shift group applies Gola to selected modules only, roundtrip and reversal preserve source',()=>{
 const p=fixture(),snapshot=JSON.stringify(p),r=applyKitchenGola(p,true,['gola-0','gola-2']);
 assert.equal(r.changed.length,2);assert.deepEqual(r.skipped,[]);assert.equal(JSON.stringify(p),snapshot);
 assert.equal(r.project.modules[1].module.gola,undefined);
 for(const a of r.project.modules){assert.deepEqual(validate(a.module),[]);assert.equal(a.module.width,600);assert.equal(a.module.kdrawers?.length,3);}
 const again=applyKitchenGola(r.project,true,['gola-0','gola-2']);assert.deepEqual(again.changed,[]);
 const off=applyKitchenGola(r.project,false,['gola-0']);assert.equal(off.project.modules[0].module.gola,undefined);assert.ok(off.project.modules[2].module.gola);
});
test('whole kitchen skips oven and non-kitchen modules with reasons',()=>{
 const p=fixture();p.modules[1].module.kitchen!.appliance='oven';p.modules[2].module=initialModule();
 const r=applyKitchenGola(p,true);assert.equal(r.changed.length,1);assert.equal(r.skipped.length,2);
 assert.deepEqual(r.project.modules[1],p.modules[1]);assert.deepEqual(r.project.modules[2],p.modules[2]);
});
