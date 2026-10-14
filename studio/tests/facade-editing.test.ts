import test from 'node:test';
import assert from 'node:assert/strict';
import {initialModule,parts,validate} from '../src/model';
import {setDoorHinge} from '../src/facadeEditing';

test('rehanging one door moves its hinges and handle, preserving other leaves',()=>{
 const m=initialModule();m.width=1000;m.doors=true;m.sections[0].doorLeaves=2;
 const doors=parts(m).filter(p=>p.role==='door'),left=doors[0],right=doors[1];
 const before=parts(m),rightBefore=before.filter(p=>p.id.includes(':door:1')||/:handle:1|:hingecup:1|:hingearm:1|:hingeplate:1/.test(p.id));
 setDoorHinge(m,left.id,'right');assert.deepEqual(validate(m),[]);
 const after=parts(m);assert.equal(after.find(p=>p.id===left.id)?.hinge,'right');assert.equal(after.find(p=>p.id===right.id)?.hinge,'right');
 assert.deepEqual(after.filter(p=>rightBefore.some(b=>b.id===p.id)),rightBefore);
 const hinges=after.filter(p=>p.id.includes(':hingecup:0:'));assert.ok(hinges.length>0);assert.ok(hinges.every(p=>p.position[0]>left.position[0]));
 const handles=after.filter(p=>p.id.includes(':handle:0'));assert.ok(handles.length>0);assert.ok(handles.every(p=>p.position[0]<left.position[0]));
 setDoorHinge(m,left.id,'left');assert.deepEqual(parts(m),before);
});

test('invalid door rehang is atomic and keeps unrelated leaf overrides',()=>{
 const m=initialModule();m.doors=true;m.sections[0].doorHinges=['left',null,'right',null];const before=JSON.stringify(m);
 assert.throws(()=>setDoorHinge(m,'missing:door:0','right'),/Выберите/);assert.equal(JSON.stringify(m),before);
 const door=parts(m).find(p=>p.role==='door')!;setDoorHinge(m,door.id,'right');assert.equal(m.sections[0].doorHinges[2],'right');
});
