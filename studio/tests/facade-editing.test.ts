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

import {createModule} from '../src/ModulePalette';
import {parseProject,newProject} from '../src/project';
import {estimate} from '../src/pricing';
function flap(){const m=createModule('empty',600,500,400,initialModule());m.doors=true;m.plinthHeight=0;m.sections[0].doorLeaves=1;return m;}
test('bottom flap hinges are on bottom and its handle is on the free top edge',()=>{
 const m=flap(),id=parts(m).find(p=>p.role==='door')!.id;setDoorHinge(m,id,'bottom');
 assert.deepEqual(validate(m),[]);const ps=parts(m),d=ps.find(p=>p.id===id)!;
 assert.equal(d.hinge,'bottom');const cups=ps.filter(p=>p.id.includes(':hingecup:'));assert.ok(cups.length>=2);
 assert.ok(cups.every(p=>Math.abs(p.position[1]-(d.position[1]-d.size[1]/2+22))<.01));
 assert.ok(ps.filter(p=>p.role==='handle').every(p=>p.position[1]>d.position[1]));
});
test('Premial lift choice survives serialization, enters the quote and is removed on lateral rehang',()=>{
 const m=flap(),id=parts(m).find(p=>p.role==='door')!.id;
 for(const lift of ['adagio','sempre'] as const){setDoorHinge(m,id,'top',lift);assert.deepEqual(validate(m),[]);
 const project=newProject(m),round= parseProject(JSON.parse(JSON.stringify(project)));assert.equal(round.modules[0].module.sections[0].doorLifts?.[0],lift);
 const quote=JSON.stringify(estimate(project));assert.ok(quote.includes('lift-mechanism:premial-'+lift));
 }
 setDoorHinge(m,id,'right');assert.equal(m.sections[0].doorLifts,undefined);
});
test('impossible bottom hinge and unsupported Sempre size do not partially mutate the module',()=>{
 const m=flap();m.bottomType='none';const id=parts(m).find(p=>p.role==='door')!.id,before=JSON.stringify(m);
 assert.throws(()=>setDoorHinge(m,id,'bottom'),/горизонталь/);assert.equal(JSON.stringify(m),before);
 const tall=flap();tall.height=1200;const tallId=parts(tall).find(p=>p.role==='door')!.id,tallBefore=JSON.stringify(tall);
 assert.throws(()=>setDoorHinge(tall,tallId,'top','sempre'),/СЕМПРЕ/);assert.equal(JSON.stringify(tall),tallBefore);
});

test('Sempre bounds remain enforced after subsequent cabinet resizing',()=>{
 const m=flap(),id=parts(m).find(p=>p.role==='door')!.id;setDoorHinge(m,id,'top','sempre');
 m.height=700;assert.ok(validate(m).some(e=>e.includes('СЕМПРЕ')));
 m.height=500;m.depth=160;assert.ok(validate(m).length>0);
});

import {holes} from '../src/drilling';
test('bottom hinge plates drill down into the mounting bottom',()=>{const m=flap(),id=parts(m).find(p=>p.role==='door')!.id;setDoorHinge(m,id,'bottom');const drills=holes(m).filter(h=>h.src.includes(':hingeplate:'));assert.ok(drills.length>=4);assert.ok(drills.every(h=>h.dir[1]===-1));});

import {mirrorModule} from '../src/operations';
test('mirroring preserves each door lift and double mirror restores its settings',()=>{
 const m=flap();m.width=1000;m.sections[0].doorLeaves=2;
 setDoorHinge(m,parts(m).find(p=>p.role==='door')!.id,'top','sempre');
 const p=newProject(m),r=mirrorModule(p,p.modules[0].id);assert.equal(r.modules[0].module.sections[0].doorLifts?.[1],'sempre');
 const rr=mirrorModule(r,r.modules[0].id);assert.deepEqual(rr.modules[0].module.sections[0].doorLifts,m.sections[0].doorLifts);
});
