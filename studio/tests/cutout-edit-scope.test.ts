import test from 'node:test';
import assert from 'node:assert/strict';
import {initialModule} from '../src/model';
import {newProject} from '../src/project';
import {kitchenWorktop} from '../src/kitchen';
import {onlyCutoutOrRailEdit} from '../src/cutoutEditScope';
test('cutout deletion bypasses placement changes, moving cabinet does not',()=>{
 const p=newProject(kitchenWorktop(initialModule(),3000));
 p.modules[0].module.worktop!.cutouts=[{kind:'sink',x:50,z:120,width:560,depth:360}];
 const q=structuredClone(p);q.modules[0].module.worktop!.cutouts=[];
 assert.equal(onlyCutoutOrRailEdit(p,q),true);
 q.modules[0].x+=10;assert.equal(onlyCutoutOrRailEdit(p,q),false);
});
