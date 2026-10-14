import test from 'node:test';
import assert from 'node:assert/strict';
import {createKitchenRow} from '../src/ModulePalette';
import {initialModule,validate} from '../src/model';
import {newProject,appendModuleGroup,projectErrors,applyAutoFillers} from '../src/project';
import {applyFacadeStyle} from '../src/applyFacadeStyle';
import {STAGES,nextStage,normalizeStage} from '../src/stages';
test('three-step workflow preserves room services and maps legacy stages',()=>{
 assert.deepEqual(STAGES.map(s=>s.id),['room','bodies','docs']);assert.equal(normalizeStage('fixtures'),'room');assert.equal(normalizeStage('facades'),'bodies');assert.equal(nextStage('filling'),'docs');
});
test('straight kitchen applies all three entered dimensions and has clean worktops',()=>{
 const row=createKitchenRow(2400,initialModule(),900,600),base=row.filter(a=>a.module.kitchen?.role==='base');
 assert.equal(base.reduce((n,a)=>n+a.module.width,0),2400);assert.ok(base.every(a=>a.module.height===900&&a.module.depth===600));
 for(const a of row){assert.deepEqual(validate(a.module),[]);if(a.module.worktop){assert.equal(a.y,900);assert.equal(a.module.depth,643);assert.ok(a.module.sections.every(s=>!s.drawers&&!s.shelves.length&&!s.rod));}}
 assert.ok(row.filter(a=>a.module.kitchen?.role==='wall').every(a=>a.y===900+38+600));
});
test('row fits empty rooms and existing furniture without post-commit filler collisions',()=>{
 for(const length of [2000,3000])for(const empty of [false,true]){const p=newProject();p.room={width:length+600,depth:4000,height:3000};if(empty)p.modules=[];
 const before=JSON.stringify(p),result=appendModuleGroup(p,createKitchenRow(length,initialModule()));
 assert.equal(JSON.stringify(p),before);assert.deepEqual(projectErrors(result.project),[]);assert.deepEqual(projectErrors(applyAutoFillers(result.project)),[]);
 }
});
test('whole-row rejection preserves source and explains side-clearance requirement',()=>{
 const p=newProject();p.modules=[];p.room={width:2000,depth:2000,height:3000};const before=JSON.stringify(p);
 assert.throws(()=>appendModuleGroup(p,createKitchenRow(2000,initialModule())),/боковых фальшей/);assert.equal(JSON.stringify(p),before);
});
test('facade style applies to eligible bodies atomically and preserves layout and per-front handles',()=>{
 const p=newProject(),source=p.modules[0];source.module.doors=true;source.module.facadeDecor='Графит';
 const target=structuredClone(source);target.id='target';target.x=1600;target.module.facadeDecor='Белый';target.module.doors=false;target.module.sections[0].doorHandles=['uz819-128'];
 const imported=structuredClone(target);imported.id='raw';imported.module.bazis=true;
 p.modules.push(target,imported);const before=JSON.stringify(p),q=applyFacadeStyle(p,source.id);
 assert.equal(JSON.stringify(p),before);assert.equal(q.modules[1].module.facadeDecor,'Графит');assert.equal(q.modules[1].module.doors,true);assert.deepEqual(q.modules[1].module.sections[0].doorHandles,['uz819-128']);assert.equal(q.modules[1].x,1600);assert.equal(q.modules[2].module.facadeDecor,'Белый');
});
