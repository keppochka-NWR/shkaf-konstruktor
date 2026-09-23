import test from 'node:test';
import assert from 'node:assert/strict';
import {initialModule,section,parts,parseModule,validate,RULES,rearClear} from '../src/model';
import {newProject,projectErrors,parseProject} from '../src/project';
import {createModule} from '../src/ModulePalette';
import {addFillingBatch} from '../src/FillingComposer';
import {captureSectionFilling,pasteSectionFilling,insertItem} from '../src/operations';
import {specificationHTML} from '../src/exports';
import {nicheSize,nicheMinimum,parseReadings} from '../src/measurement';

test('multiple survey readings use minimum without mistaking spread for wall deviation',()=>{
  const p=newProject();p.measurement={number:'6806622',date:'',notes:'',niche:{width:2400,height:2700,depth:650,deviation:0,readings:{width:parseReadings('2399; 2403; 2398; 2403; 2400')}}};
  const restored=parseProject(JSON.parse(JSON.stringify(p)));
  assert.equal(nicheMinimum(restored.measurement!.niche!,'width'),2398);
  assert.equal(nicheSize(restored.measurement!.niche!).width,2388);
  assert.equal(restored.measurement!.niche!.deviation,0);
  assert.ok(specificationHTML(restored).includes('2388 × 2670 × 645'));
  for(const readings of [null,'',0,false,{width:[NaN]},{width:[0]},{height:[]},{depth:'500'},{width:Array(21).fill(900)}]){
    const raw=JSON.parse(JSON.stringify(p));raw.measurement.niche.readings=readings;
    assert.throws(()=>parseProject(raw));
  }
  assert.deepEqual(parseReadings('2399,5 2400'),[2399.5,2400]);
  assert.throws(()=>parseReadings('2399 mm'));
});

test('niche specification uses the same ceiling allowance as the room calculation',()=>{
  const p=newProject();p.measurement={number:'TEST',date:'',notes:'',niche:{width:2000,height:2700,depth:650,deviation:5}};
  for(const ceiling of ['stationary','stretch'] as const){
    p.room.ceiling=ceiling;
    const fit=nicheSize(p.measurement.niche!,ceiling);
    assert.ok(specificationHTML(p).includes(`${fit.width} × ${fit.height} × ${fit.depth}`));
    assert.equal(fit.height,ceiling==='stretch'?2680:2670);
  }
});

test('all furniture palette choices produce valid editable independent modules',()=>{
  const source=initialModule();
  for(const kind of ['empty','shelves','wardrobe','drawers','desk'] as const){
    const m=createModule(kind,600,kind==='desk'?750:kind==='drawers'?850:2000,550,source);
    assert.deepEqual(validate(m),[],kind);
    assert.notEqual(m.sections[0].id,source.sections[0].id);
    assert.equal(m.decor,source.decor);
    assert.deepEqual(parseModule(JSON.parse(JSON.stringify(m))),JSON.parse(JSON.stringify(m)));
  }
});
test('batch addition preserves existing contents and rejects partial failure atomically',()=>{
  const p=newProject({...initialModule(),doors:false,sections:[section()]});
  const {id:mid,module:m}=p.modules[0],sid=m.sections[0].id;
  const p2=addFillingBatch(p,mid,sid,'drawer',2);
  assert.equal(p2.modules[0].module.sections[0].drawers,2);
  assert.equal(p.modules[0].module.sections[0].drawers,0);
  const p3=addFillingBatch(p2,mid,sid,'shelf',3);
  assert.equal(p3.modules[0].module.sections[0].shelves.length,3);
  assert.equal(p3.modules[0].module.sections[0].drawers,2);
  assert.deepEqual(projectErrors(p3),[]);
  const before=JSON.stringify(p3);
  assert.throws(()=>addFillingBatch(p3,mid,sid,'drawer',5));
  assert.equal(JSON.stringify(p3),before);
});
test('shallow shelf depth affects geometry and cutting dimensions but not drawer cap',()=>{
  const m=initialModule(),s=m.sections[0];s.shelfDepth=300;
  const geometry=parts(m),shelf=geometry.find(p=>p.id===s.id+':shelf:0')!,cap=geometry.find(p=>p.id===s.id+':drawer-cap')!;
  assert.equal(shelf.size[2],300);assert.equal(shelf.width,300);
  assert.equal(cap.width,m.depth-rearClear(m)-RULES.shelfDepthMinus);
  assert.equal(parseProject(JSON.parse(JSON.stringify(newProject(m)))).modules[0].module.sections[0].shelfDepth,300);
  assert.deepEqual(validate(m),[]);
  m.depth=250;assert.ok(validate(m).some(e=>e.includes('глубина полок')));
});
test('invalid imported shelf depths cannot escape geometry validation',()=>{
  for(const depth of [-1,0,99,900,NaN]){
    const m=initialModule();m.sections[0].shelfDepth=depth;
    assert.ok(validate(m).length);
  }
});
test('production 6877735 and 7110535 shelf depths are constructible without a forced 25mm setback',()=>{
  // Source: production B3D, 6877735 В РАБОТУ: 06~Полка 923×397,
  // sides 397 deep. 7110535 В РАБОТУ: 06~Полка 433×340, sides 350 deep.
  for(const [width,depth,shelfDepth,length] of [[957,397,397,923],[467,350,340,433]]){
    const m:ReturnType<typeof initialModule>={...initialModule(),width,depth,doors:false,sections:[{...section(),shelves:[.5],shelfDepth}]};
    assert.deepEqual(validate(m),[]);
    const p=parts(m).find(p=>p.id.endsWith(':shelf:0'))!;
    assert.equal(p.length,length);assert.equal(p.width,shelfDepth);
    m.doors=true;m.doorMount='inset';
    if(shelfDepth>depth-18)assert.ok(validate(m).some(e=>e.includes('глубина полок')));
  }
});
test('copying filling retains depth and shelf fastenings; inserting below fixed shelf preserves its identity',()=>{
  const p=newProject({...initialModule(),doors:false,sections:[{...section(),shelves:[.7],fixed:[0],shelfDepth:300}]});
  const a=p.modules[0],sid=a.module.sections[0].id;
  const next=insertItem(p,'shelf',a.id,sid,400);
  assert.deepEqual(next.modules[0].module.sections[0].fixed,[1]);
  const copy=captureSectionFilling(next,a.id,sid);
  const dest=newProject({...initialModule(),doors:false,sections:[section()]});
  const result=pasteSectionFilling(dest,dest.modules[0].id,dest.modules[0].module.sections[0].id,copy);
  assert.equal(result.modules[0].module.sections[0].shelfDepth,300);
  assert.deepEqual(result.modules[0].module.sections[0].fixed,[1]);
});

// Manager testing feedback, 22 September: domain regressions, not UI snapshots.
import {fitMeshItem,removePart} from '../src/operations';
import {addFittedDrawers} from '../src/FillingComposer';
import {boxes,doorCount} from '../src/model';
import {DEFAULT_MESH,meshById} from '../src/mesh';
import {DEFAULT_HANDLE} from '../src/handles';

test('mesh resize and insertion are atomic and validate the complete project',()=>{
 const p=newProject(),a=p.modules[0],m=a.module;m.depth=650;m.sections=[section()];
 const original=JSON.stringify(p),sid=m.sections[0].id;
 const next=fitMeshItem(p,a.id,sid,DEFAULT_MESH,boxes(m)[0].bottom);
 assert.equal(JSON.stringify(p),original);assert.deepEqual(projectErrors(next),[]);
 assert.equal(next.modules[0].module.sections[0].drawers,1);
 assert.notEqual(next.modules[0].module.width,m.width);
 const small=structuredClone(p);small.room.width=300;
 assert.throws(()=>fitMeshItem(small,a.id,sid,DEFAULT_MESH,boxes(m)[0].bottom));
 assert.equal(JSON.stringify(p),original);
});

test('door and drawer handle dimensions remain independent after save and load',()=>{
 const m=initialModule();m.sections=[section()];m.sections[0].drawers=1;
 m.handleId='hexa1200b';m.drawerHandleId=DEFAULT_HANDLE;
 assert.deepEqual(validate(m),[]);
 const restored=parseModule(JSON.parse(JSON.stringify(m)));
 assert.equal(restored.drawerHandleId,DEFAULT_HANDLE);
 const geometry=parts(restored);
 assert.equal(geometry.find(p=>p.role==='handle'&&p.id.includes(':drawer:'))!.length,128);
 assert.equal(geometry.find(p=>p.role==='handle'&&!p.id.includes(':drawer:'))!.length,1200);
 m.drawerHandleId='hexa1200b';assert.ok(validate(m).some(e=>e.includes('Ручка')));
});

test('deleting one leaf removes its handle only; restoring source restores both leaves',()=>{
 const p=newProject(),a=p.modules[0],m=a.module;m.sections=[section()];const s=m.sections[0];s.doorLeaves=2;s.doorGap=6;
 const original=JSON.stringify(p),doors=parts(m).filter(d=>d.role==='door'&&d.id.includes(':door:'));
 assert.equal(doors.length,2);
 assert.ok(Math.abs(doors[1].position[0]-doors[1].size[0]/2-doors[0].position[0]-doors[0].size[0]/2-6)<0.001);
 const n=removePart(p,a.id,s.id,doors[0].id),nm=parseProject(JSON.parse(JSON.stringify(n))).modules[0].module;
 assert.deepEqual(validate(nm),[]);
 assert.equal(parts(nm).filter(d=>d.role==='door'&&d.id.includes(':door:')).length,1);
 assert.equal(parts(nm).filter(d=>d.role==='handle').length,1);
 assert.equal(JSON.stringify(p),original);
 assert.equal(parts(m).filter(d=>d.role==='door'&&d.id.includes(':door:')).length,2);
});

test('section hinge side drives the actual leaf and too wide forced single leaf is rejected',()=>{
 const m=initialModule();m.sections=[section()];m.sections[0].hingeSide='right';
 assert.equal(parts(m).find(p=>p.role==='door')!.hinge,'right');
 m.width=900;m.sections[0].doorLeaves=1;
 assert.ok(validate(m).length>0);
});

test('short body can fit two shorter drawers while keeping cap and source intact',()=>{
 const p=newProject(),a=p.modules[0],m=a.module;m.height=500;m.doors=false;m.sections=[section()];
 const original=JSON.stringify(p),sid=m.sections[0].id;
 const n=addFittedDrawers(p,a.id,sid,2,{height:180,length:450,slide:'ball'});
 assert.deepEqual(projectErrors(n),[]);
 assert.equal(n.modules[0].module.sections[0].drawers,2);
 assert.ok(n.modules[0].module.sections[0].drawerConfigs!.every(c=>c.height>=68&&c.height<180));
 assert.ok(parts(n.modules[0].module).some(d=>d.id.endsWith(':drawer-cap')));
 assert.equal(JSON.stringify(p),original);
 const tiny=structuredClone(p);tiny.modules[0].module.height=250;
 assert.throws(()=>addFittedDrawers(tiny,a.id,sid,5,{height:180,length:450,slide:'ball'}));
});

import {mirrorModule} from '../src/operations';
import {estimate} from '../src/pricing';
test('independent handle prices follow actual parts and survive undo-style snapshots',()=>{
 const p=newProject(),m=p.modules[0].module;m.sections=[section()];m.sections[0].drawers=1;m.handleId='hexa1200b';m.drawerHandleId=DEFAULT_HANDLE;
 const quote=estimate(p);assert.ok(JSON.stringify(quote).includes('handle:hexa1200b'));assert.ok(JSON.stringify(quote).includes('handle:'+DEFAULT_HANDLE));
});
test('mirroring preserves leaf omission and independent section handing geometrically',()=>{
 const p=newProject(),m=p.modules[0].module;m.sections=[section()];m.sections[0].doorLeaves=2;m.sections[0].removedDoors=[0];m.sections[0].hingeSide='right';
 const n=mirrorModule(p,p.modules[0].id),s=n.modules[0].module.sections[0];
 assert.deepEqual(s.removedDoors,[1]);assert.equal(s.hingeSide,'left');
 assert.deepEqual(mirrorModule(n,n.modules[0].id).modules[0].module.sections,m.sections);
});
test('malformed leaf settings are rejected on import',()=>{
 for(const change of [{doorLeaves:3},{doorGap:1},{doorGap:NaN},{removedDoors:'0'},{hingeSide:'top'},{removedDoors:[3]}]){
  const m=initialModule();Object.assign(m.sections[0],change);assert.throws(()=>parseModule(m));
 }
});

import {facadeHandleId,setFacadeHandle} from '../src/model';
import {addUpperModule,duplicatePart} from '../src/operations';
test('1200 door handle never blocks adding an upper cabinet or changes the lower handle',()=>{
 const p=newProject(),a=p.modules[0];a.module.sections=[section()];a.module.handleId='hexa1200b';
 const before=JSON.stringify(p),n=addUpperModule(p,a.id);
 assert.deepEqual(projectErrors(n),[]);assert.equal(JSON.stringify(p),before);
 assert.equal(n.modules[0].module.handleId,'hexa1200b');
 assert.ok(parts(n.modules[1].module).filter(p=>p.role==='handle').every(p=>p.length===128));
});
test('every door leaf and drawer front has an independent persisted priced handle',()=>{
 const p=newProject(),m=p.modules[0].module;m.sections=[section()];const s=m.sections[0];s.doorLeaves=2;s.drawers=2;
 setFacadeHandle(m,s.id+':door:0','hexa1200b');setFacadeHandle(m,s.id+':door:1','hexa256a');
 setFacadeHandle(m,s.id+':drawer:0:facade','fp527-160');setFacadeHandle(m,s.id+':drawer:1:facade',DEFAULT_HANDLE);
 assert.deepEqual(projectErrors(p),[]);
 const n=parseProject(JSON.parse(JSON.stringify(p))),nm=n.modules[0].module;
 for(const [pid,id] of [[s.id+':door:0','hexa1200b'],[s.id+':door:1','hexa256a'],[s.id+':drawer:0:facade','fp527-160'],[s.id+':drawer:1:facade',DEFAULT_HANDLE]])assert.equal(facadeHandleId(nm,pid),id);
 const quote=estimate(n);for(const id of ['hexa1200b','hexa256a','fp527-160',DEFAULT_HANDLE])assert.ok(quote.lines.some(l=>l.id==='handle:'+id&&l.quantity===1));
 const afterRemove=removePart(n,n.modules[0].id,s.id,s.id+':drawer:0:facade');
 assert.equal(facadeHandleId(afterRemove.modules[0].module,s.id+':drawer:0:facade'),DEFAULT_HANDLE);
 const mirrored=mirrorModule(n,n.modules[0].id);
 assert.equal(facadeHandleId(mirrored.modules[0].module,s.id+':door:1'),'hexa1200b');
});
test('invalid individual hardware is rejected instead of silently becoming a default',()=>{
 for(const assignment of ['door','drawer']){
 const m=initialModule();m.sections=[section()];const s=m.sections[0];
 if(assignment==='door')s.doorHandles=['unknown'];else{s.drawers=1;s.drawerConfigs=[{slide:'ball',height:140,length:450,handleId:'unknown'}];}
 assert.throws(()=>parseModule(m));
 }
});
