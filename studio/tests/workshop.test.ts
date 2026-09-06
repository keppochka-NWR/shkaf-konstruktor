import {shelfInsertionHeight} from '../src/model';
import {insertedPartId} from '../src/operations';
import {details} from '../src/exports';
import {reviewFiles,reviewArchive,reviewArchiveName} from '../src/reviewPackage';
import {unzipSync,strFromU8} from 'three/addons/libs/fflate.module.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import {initialModule,parts,validate,section,boxes,drawerStackHeight,parseModule,drawerConfig} from '../src/model';
import {closedModuleBounds,compositionBounds,snapComposition,newProject,projectErrors,parseProject,appendModule,snapPlacement,bounds,localToRoom,roomToLocal} from '../src/project';
import {captureSectionFilling,pasteSectionFilling,duplicatePart,moveComposition,compactDrawers,setCompositionDistance,applyDrawerSlide,clearSection,removeSection,addUpperModule,rotateModule,setWallDistance,mirrorModule,insertItem,moveModule,movePart,removePart,transferPart} from '../src/operations';
import {wallPanels} from '../src/roomGeometry';
import {estimate,estimateCSV,hingeCount} from '../src/pricing';
import {nest,specificationHTML} from '../src/exports';
test('900 × 2200 is a hard limit for every physical module',()=>{const m=initialModule();m.width=900;m.height=2200;assert.deepEqual(validate(m),[]);m.width=901;assert.throws(()=>parseModule(m));m.width=900;m.height=2201;assert.throws(()=>parseModule(m));});
test('every drawer has a board bottom, front and shelf above its group',()=>{const m=initialModule(),s=m.sections[0];s.drawerConfigs=[{slide:'ball',length:300,height:140},{slide:'gtv0fpo',length:300,height:140}];assert.deepEqual(validate(m),[]);const ps=parts(m),cap=ps.find(p=>p.id.endsWith(':drawer-cap'))!;assert.equal(cap.position[1]-8,boxes(m)[0].bottom+drawerStackHeight(s));for(let j=0;j<2;j++){const bottom=ps.find(p=>p.id===`${s.id}:drawer:${j}:bottom`)!;assert.equal(bottom.material,'board');assert.equal(bottom.thickness,16);assert.ok(ps.find(p=>p.id===`${s.id}:drawer:${j}:facade`));}assert.ok(ps.filter(p=>p.id.includes(':drawer:')).every(p=>p.position[2]+p.size[2]/2<m.depth+2),'internal handles clear the closed door');});
test('grooved backs reduce usable depth and never select a quarter rebate',()=>{const m=initialModule();m.backType='groove';m.grooveInset=16;m.grooveDepth=8;assert.deepEqual(validate(m),[]);assert.equal(drawerConfig(m,m.sections[0],0).length,500);const back=parts(m).find(p=>p.id==='back')!;assert.equal(back.size[0],583);assert.equal(back.position[2],17.5);assert.throws(()=>parseModule({...m,backType:'quarter'}));});
test('drawer movement creates no overlapping groups',()=>{const p=newProject(),a=p.modules[0],s=a.module.sections[0];const bad=movePart(p,a.id,s.id,`${s.id}:drawer:0:left`,100);assert.ok(projectErrors(bad).some(e=>e.includes('пересекаются')));const good=movePart(p,a.id,s.id,`${s.id}:drawer:1:left`,100);assert.deepEqual(projectErrors(good),[]);assert.equal(drawerStackHeight(good.modules[0].module.sections[0]),460);assert.equal(drawerStackHeight(s),360);});
test('drop inserts near requested height and leaves original unchanged',()=>{const p=newProject(),a=p.modules[0],s=a.module.sections[0];s.drawers=0;s.shelves=[];const n=insertItem(p,'shelf',a.id,s.id,900);assert.equal(n.modules[0].module.sections[0].shelves.length,1);assert.ok(Math.abs(parts(n.modules[0].module).find(p=>p.role==='shelf')!.position[1]-900)<=5);assert.equal(s.shelves.length,0);const d=insertItem(n,'drawer',a.id,s.id,160);assert.deepEqual(projectErrors(d),[]);assert.equal(d.modules[0].module.sections[0].drawers,1);});
test('module snap and upper placement respect contact without overlap',()=>{const p=newProject(),n=appendModule(p,p.modules[0].module),a=n.modules[1];const snap=snapPlacement(n,a.id,{x:670,y:0,z:30});assert.equal(snap.x,650);a.module.height=600;a.module.plinthHeight=0;a.module.sections=[section()];const upper=moveModule(n,a.id,{x:50,y:2000,z:30});assert.deepEqual(projectErrors(upper),[]);assert.ok(!parts(upper.modules[1].module).some(p=>p.id==='plinth'));upper.modules[1].y=1999;assert.ok(projectErrors(upper).some(e=>e.includes('пересекается')));});
test('legacy 1000 mm module migrates to two independent 500 mm bodies',()=>{const m=initialModule();m.width=1000;m.sections=[section(),section()];const raw={version:2,room:{width:4000,depth:3000,height:2700},modules:[{id:'old',x:50,z:30,module:m}]};const before=JSON.stringify(raw),p=parseProject(raw);assert.equal(p.modules.length,2);assert.deepEqual(p.modules.map(a=>a.module.width),[500,500]);assert.deepEqual(p.modules.map(a=>a.x),[50,550]);assert.equal(JSON.stringify(raw),before);assert.deepEqual(projectErrors(p),[]);});
test('room wall subdivision preserves exact area minus openings',()=>{const p=newProject();p.room.openings=[{id:'w',type:'window',wall:'back',offset:1200,width:1200,height:1400,sill:900},{id:'d',type:'door',wall:'left',offset:100,width:900,height:2100,sill:0}];assert.deepEqual(projectErrors(p),[]);const panels=wallPanels(p.room);assert.equal(panels.reduce((a,b)=>a+b.width*b.height,0),2*(4000+3000)*2700-1200*1400-900*2100);assert.deepEqual(parseProject(p),p);p.room.openings[0].width=5000;assert.ok(projectErrors(p).length);});
test('overlapping openings are rejected',()=>{const p=newProject();const o={id:'a',type:'window' as const,wall:'back' as const,offset:100,width:900,height:1000,sill:800};p.room.openings=[o,{...o,id:'b',offset:500}];assert.ok(projectErrors(p).some(e=>e.includes('не должны пересекаться')));});
test('pantograph and rod use mutually exclusive valid geometry',()=>{const m=initialModule();m.sections=[{...section(),pantograph:true}];assert.deepEqual(validate(m),[]);assert.ok(parts(m).some(p=>p.id.includes(':pantograph:')));m.sections[0].rod=true;assert.ok(validate(m).length);m.sections[0].pantograph=false;assert.deepEqual(validate(m),[]);assert.equal(parts(m).filter(p=>p.role==='flange').length,2);});
test('removing a drawer preserves the absolute height of remaining drawers',()=>{const p=newProject(),a=p.modules[0],s=a.module.sections[0];const before=parts(a.module).find(p=>p.id===s.id+':drawer:1:left')!;const n=removePart(p,a.id,s.id,s.id+':drawer:0:facade');assert.deepEqual(projectErrors(n),[]);assert.equal(n.modules[0].module.sections[0].drawers,1);assert.equal(parts(n.modules[0].module).find(p=>p.id===s.id+':drawer:0:left')!.position[1],before.position[1]);assert.equal(s.drawers,2);const empty=removePart(n,a.id,s.id,s.id+':drawer:0:facade');assert.ok(!parts(empty.modules[0].module).some(p=>p.id.includes(':drawer-cap')||p.id.includes(':filler:')));});
test('only filling can be removed and rod may be selected by its flange',()=>{const p=newProject(),a=p.modules[0],s=a.module.sections[0];s.drawers=0;s.shelves=[];s.rod=true;const n=removePart(p,a.id,s.id,s.id+':flange:0');assert.equal(n.modules[0].module.sections[0].rod,false);assert.throws(()=>removePart(p,a.id,s.id,'left'));const moved=movePart(p,a.id,s.id,s.id+':flange:0',-100);assert.equal(Math.round(parts(moved.modules[0].module).find(p=>p.role==='rod')!.position[1]),Math.round(parts(a.module).find(p=>p.role==='rod')!.position[1]-100));});
test('estimate uses actual sheets and never substitutes unknown hardware prices',()=>{const p=newProject();p.modules[0].module.sections[0].drawerConfigs=[{slide:'gtv0fpo',length:500,height:140},{slide:'gtv0fpo',length:500,height:140}];const e=estimate(p);assert.equal(e.lines.filter(l=>l.id.startsWith('sheet:')).reduce((s,l)=>s+l.quantity,0),nest(p).length);assert.equal(e.retail,null);assert.ok(e.missing.some(l=>l.id==='slide:gtv0fpo:500'));p.calculation={markup:2.2,overrides:{'slide:gtv0fpo:500':800}};const complete=estimate(p);assert.equal(complete.missing.length,0);assert.equal(complete.retail,Math.round(complete.knownCost*2.2/100)*100);assert.equal(complete.lines.find(l=>l.id==='slide:gtv0fpo:500')!.quantity,2);assert.deepEqual(parseProject(p),p);});
test('estimate rejects malformed rates and follows workshop hinge count',()=>{const p=newProject();p.calculation={markup:0,overrides:{}};assert.throws(()=>parseProject(p));p.calculation={markup:2.2,overrides:{a:-1}};assert.throws(()=>parseProject(p));assert.deepEqual([[600,300],[600,600],[2000,300],[2000,600]].map(([h,w])=>hingeCount(h,w)),[2,3,4,5]);});
test('moving a drawer to another body keeps its hardware and leaves one source copy',()=>{const p=appendModule(newProject(),initialModule()),a=p.modules[0],b=p.modules[1],s=a.module.sections[0];b.module.sections=[section()];s.drawerConfigs=[{slide:'gtv0fpo',length:450,height:180},{slide:'ball',length:500,height:140}];const n=transferPart(p,a.id,s.id,s.id+':drawer:0:facade',b.id,b.module.sections[0].id,120);assert.deepEqual(projectErrors(n),[]);assert.equal(n.modules[0].module.sections[0].drawers,1);const target=n.modules[1].module.sections[0];assert.equal(target.drawers,1);assert.equal(target.drawerConfigs![0].slide,'gtv0fpo');assert.equal(target.drawerConfigs![0].length,450);assert.equal(target.drawerConfigs![0].height,180);assert.equal(s.drawers,2);});
test('failed transfer never removes the source drawer',()=>{const p=appendModule(newProject(),initialModule()),a=p.modules[0],b=p.modules[1],s=a.module.sections[0];b.module.sections=[section()];b.module.depth=300;const before=JSON.stringify(p);assert.throws(()=>transferPart(p,a.id,s.id,s.id+':drawer:0:left',b.id,b.module.sections[0].id,120));assert.equal(JSON.stringify(p),before);});
test('quarter rotations invert points and exchange full occupied dimensions',()=>{const p=newProject(),a=p.modules[0];a.module.width=500;a.x=1000;a.z=1000;for(const r of [0,90,180,270] as const){a.rotation=r;const point=localToRoom(a,123,456);assert.deepEqual(roomToLocal(a,point.x,point.z),{x:123,z:456});const b=bounds(a);assert.equal(b.w,r%180===0?500:621);assert.equal(b.d,r%180===0?621:500);assert.deepEqual(parseProject(p),p);assert.deepEqual(projectErrors(p),[]);}});
test('rotated fronts and backs participate in room limits and snapping',()=>{const p=newProject(),a=p.modules[0];a.rotation=90;a.x=0;assert.ok(projectErrors(p).length);const pos=snapPlacement(p,a.id,{x:8,y:0,z:30});assert.equal(pos.x,3);Object.assign(a,pos);assert.deepEqual(projectErrors(p),[]);assert.throws(()=>parseProject({...p,modules:[{...a,rotation:45}]}));});


test('mirroring reverses unequal sections and door fillers without changing placement or drawer setup',()=>{
 const p=newProject(),a=p.modules[0],m=a.module;m.width=900;m.hingeSide='left';
 m.sections=[{...section(),weight:1,shelves:[.5],drawers:0},{...section(),weight:2,shelves:[.72],drawers:2,drawerConfigs:[{slide:'gtv0fpo',length:300,height:140},{slide:'ball',length:450,height:180}]}];
 assert.deepEqual(projectErrors(p),[]);const original=structuredClone(p);
 const n=mirrorModule(p,a.id),nm=n.modules[0].module;
 assert.deepEqual(p,original);assert.equal(nm.hingeSide,'right');
 assert.deepEqual(nm.sections,[m.sections[1],m.sections[0]]);
 assert.deepEqual(boxes(nm).map(b=>b.width),boxes(m).map(b=>b.width).reverse());
 for(const b of boxes(m)){const mirrored=boxes(nm).find(v=>v.id===b.id)!;assert.ok(Math.abs(mirrored.x-(m.width-b.x-b.width))<.001);}
 const oldFiller=parts(m).find(p=>p.name.startsWith('Фальш-панель'))!,newFiller=parts(nm).find(p=>p.name.startsWith('Фальш-панель'))!;
 assert.ok(Math.abs(newFiller.position[0]-(m.width-oldFiller.position[0]))<.001);
 assert.deepEqual(projectErrors(n),[]);assert.deepEqual(mirrorModule(n,a.id),p);
 assert.deepEqual({...n.modules[0],module:null},{...a,module:null});
});

test('wall distance controls measure the occupied envelope for every rotation and back type',()=>{
 for(const rotation of [0,90,180,270] as const)for(const backType of ['nailed','groove','board','none'] as const){
  const p=newProject(),a=p.modules[0];a.rotation=rotation;a.module.backType=backType;
  a.module.sections=[{...section(),drawers:0,shelves:[.5]}];a.x=500;a.z=500;
  const original=structuredClone(p);
  const n=setWallDistance(setWallDistance(p,a.id,'x',0),a.id,'z',0);
  assert.equal(bounds(n.modules[0]).x,0);assert.equal(bounds(n.modules[0]).z,0);assert.deepEqual(projectErrors(n),[]);
  const b=bounds(n.modules[0]);
  const far=setWallDistance(setWallDistance(n,a.id,'x',p.room.width-b.w),a.id,'z',p.room.depth-b.d);
  const fb=bounds(far.modules[0]);assert.equal(fb.x+fb.w,p.room.width);assert.equal(fb.z+fb.d,p.room.depth);
  assert.throws(()=>setWallDistance(far,a.id,'x',p.room.width-b.w+1));
  assert.throws(()=>setWallDistance(n,a.id,'z',-1));assert.deepEqual(p,original);
 }
});

test('rotation preserves occupied center, clamps to room walls and never pushes a neighbour',()=>{
 const p=newProject(),a=p.modules[0];a.module.width=400;a.x=800;a.z=900;
 const original=structuredClone(p),b=bounds(a);let n=p;
 for(const r of [90,180,270,0] as const){n=rotateModule(n,a.id,r);const q=bounds(n.modules[0]);assert.ok(Math.abs(q.x+q.w/2-b.x-b.w/2)<.001);assert.ok(Math.abs(q.z+q.d/2-b.z-b.d/2)<.001);assert.deepEqual(projectErrors(n),[]);}
 assert.deepEqual(p,original);
 const corner=setWallDistance(setWallDistance(p,a.id,'x',0),a.id,'z',0);const turned=rotateModule(corner,a.id,90),tb=bounds(turned.modules[0]);
 assert.equal(tb.x,0);assert.ok(tb.z>=0);assert.deepEqual(projectErrors(turned),[]);
 const paired=appendModule(p,a.module,p.modules[0]);assert.throws(()=>rotateModule(paired,a.id,90),/пересекается/);assert.deepEqual(paired.modules[0],a);
 const narrow=structuredClone(p);narrow.room.width=500;narrow.modules[0].x=50;assert.throws(()=>rotateModule(narrow,a.id,90),/не помещается/);
});

import {LIBRARY_KEY,recoverStoredLibrary,inspectStoredLibrary,libraryFile,parseLibraryFile} from '../src/moduleLibraryFile';
test('library transfer validates all modules and assigns independent template IDs',()=>{const m=initialModule(),entries=[{id:'a',name:'Шкаф',module:m}];const parsed=parseLibraryFile(JSON.parse(libraryFile(entries)));assert.deepEqual(parsed[0].module,m);assert.notEqual(parsed[0].id,'a');assert.notEqual(parseLibraryFile(JSON.parse(libraryFile(entries)))[0].id,parsed[0].id);assert.throws(()=>parseLibraryFile({format:'module-library',version:1,items:[{name:'Слишком широкий',module:{...m,width:901}}]}));assert.throws(()=>parseLibraryFile({format:'module-library',version:1,items:Array(31).fill(entries[0])}));assert.throws(()=>parseLibraryFile({version:3,modules:[]}));});

test('upper module inherits cabinet finishes and fits available height without copying filling',()=>{
 const p=newProject(),a=p.modules[0];a.module.height=2200;a.module.decor='Белый';a.module.facadeDecor='Графит';a.module.backType='groove';a.module.grooveInset=20;a.module.hingeSide='right';a.rotation=90;a.x=100;a.z=100;
 const original=structuredClone(p),n=addUpperModule(p,a.id),upper=n.modules[1];
 assert.equal(upper.y,2200);assert.equal(upper.module.height,470);assert.equal(upper.module.plinthHeight,0);assert.equal(upper.rotation,90);assert.equal(upper.x,a.x);assert.equal(upper.z,a.z);
 for(const k of ['width','depth','decor','facadeDecor','doors','backType','grooveInset','hingeSide'] as const)assert.equal(upper.module[k],a.module[k]);
 assert.equal(upper.module.sections[0].drawers,0);assert.notEqual(upper.module.sections[0].id,a.module.sections[0].id);assert.deepEqual(projectErrors(n),[]);assert.deepEqual(p,original);
 p.room.height=2600;assert.throws(()=>addUpperModule(p,a.id),/монтажного зазора/);p.room.height=2630;assert.equal(addUpperModule(p,a.id).modules[1].module.height,400);
});

test('section clear removes all filling settings and removal expands only the adjacent opening',()=>{
 const p=newProject(),a=p.modules[0],s=a.module.sections[0];s.pantograph=true;s.rodAt=.87;const cleared=clearSection(p,a.id,s.id).modules[0].module.sections[0];assert.deepEqual(cleared,{id:s.id,weight:s.weight,shelves:[],drawers:0,rod:false});assert.equal(s.drawers,2);
 a.module.width=900;a.module.sections=[section(),section(),section()];const bb=boxes(a.module);
 for(const i of [0,1,2]){const n=removeSection(p,a.id,a.module.sections[i].id),nb=boxes(n.modules[0].module),recipient=i===0?1:i-1;for(const b of nb){const j=bb.findIndex(v=>v.id===b.id);assert.ok(Math.abs(b.width-(bb[j].width+(j===recipient?bb[i].width+16:0)))<.001);}assert.deepEqual(projectErrors(n),[]);}
 assert.equal(a.module.sections.length,3);assert.throws(()=>removeSection(newProject(),'missing','missing'));
});

test('applying a runner profile to section drawers preserves individual heights and positions',()=>{const p=newProject(),a=p.modules[0],s=a.module.sections[0];s.drawerConfigs=[{slide:'gtv0fpo',length:300,height:140,y:0},{slide:'ball',length:450,height:180,y:240}];const n=applyDrawerSlide(p,a.id,s.id,0),cfg=n.modules[0].module.sections[0].drawerConfigs!;assert.deepEqual(cfg.map(c=>[c.slide,c.length,c.height,c.y]),[['gtv0fpo',300,140,0],['gtv0fpo',300,180,240]]);assert.equal(s.drawerConfigs[1].slide,'ball');assert.deepEqual(projectErrors(n),[]);assert.throws(()=>applyDrawerSlide(p,a.id,s.id,4));});

test('composition bounds include gaps, raised and rotated modules',()=>{const p=newProject(),a=p.modules[0];const n=appendModule(p,a.module,a),b=n.modules[1];b.rotation=90;b.x=1000;b.y=500;b.z=800;const out=compositionBounds(n),aa=closedModuleBounds(a),bb=closedModuleBounds(b);assert.equal(out.x,aa.x);assert.equal(out.y,0);assert.equal(out.z,aa.z);assert.equal(out.w,bb.x+bb.w-aa.x);assert.equal(out.h,2500);assert.equal(out.d,bb.z+bb.d-aa.z);assert.deepEqual(compositionBounds(newProject()),closedModuleBounds(newProject().modules[0]));});

test('closed dimensions include handles and do not reserve doors on empty open shelves',()=>{const p=newProject(),a=p.modules[0];assert.equal(closedModuleBounds(a).d,646.5);a.module.doors=false;assert.equal(closedModuleBounds(a).d,640);a.module.sections=[section()];assert.equal(closedModuleBounds(a).d,603);a.module.backType='none';assert.equal(closedModuleBounds(a).d,600);a.rotation=90;assert.equal(closedModuleBounds(a).w,600);});


test('moving the composition preserves contacts, rotations and raised modules atomically',()=>{
 const p=newProject(),a=p.modules[0];p.room.height=3500;
 const n=appendModule(p,a.module,a);n.modules[1].rotation=90;n.modules[1].x=1300;n.modules[1].z=800;
 n.modules.push({...structuredClone(a),id:'upper-check',y:2000,module:{...structuredClone(a.module),height:600,sections:[section()]}});
 const original=structuredClone(n);
 let moved=setCompositionDistance(n,'x',200);moved=setCompositionDistance(moved,'z',150);moved=setCompositionDistance(moved,'y',100);
 assert.deepEqual(projectErrors(moved),[]);
 for(let i=0;i<n.modules.length;i++){
  const before=n.modules[i],after=moved.modules[i];assert.equal(after.x-before.x,150);assert.equal(after.z-before.z,123);assert.equal((after.y??0)-(before.y??0),100);assert.equal(after.rotation,before.rotation);assert.deepEqual(after.module,before.module);
 }
 assert.deepEqual(n,original);
 assert.throws(()=>setCompositionDistance(n,'x',3900));assert.throws(()=>setCompositionDistance(n,'y',1000));assert.throws(()=>setCompositionDistance(n,'z',NaN));assert.throws(()=>setCompositionDistance(n,'x',-1));assert.deepEqual(n,original);
});


test('stored library reports malformed and duplicate records without silently replacing the source',()=>{
 const good={id:'a',name:'Рабочий',module:initialModule()};
 assert.deepEqual(inspectStoredLibrary(null),{items:[],problem:''});assert.equal(inspectStoredLibrary(JSON.stringify([good])).problem,'');
 const raw=JSON.stringify([good,{...good,id:'b',module:{...good.module,width:901}},good,null]);
 const result=inspectStoredLibrary(raw);assert.deepEqual(result.items,[good]);assert.match(result.problem,/3/);assert.equal(JSON.parse(raw).length,4);
 for(const text of ['broken','{}','null']){const result=inspectStoredLibrary(text);assert.equal(result.items.length,0);assert.ok(result.problem);}
 const many=Array.from({length:31},(_,i)=>({...good,id:String(i)}));assert.equal(inspectStoredLibrary(JSON.stringify(many)).items.length,30);assert.ok(inspectStoredLibrary(JSON.stringify(many)).problem);
});


test('library recovery backs up first and refuses stale or failed storage writes',()=>{
 const original='broken',data=new Map([[LIBRARY_KEY,original]]),writes:string[]=[];
 const storage={getItem:(key:string)=>data.get(key)??null,setItem:(key:string,value:string)=>{writes.push(key);data.set(key,value);}};
 const backup=recoverStoredLibrary(storage,original,[]);assert.equal(data.get(backup),original);assert.equal(data.get(LIBRARY_KEY),'[]');assert.deepEqual(writes,[backup,LIBRARY_KEY]);
 assert.throws(()=>recoverStoredLibrary(storage,original,[]),/другом окне/);assert.equal(writes.length,2);
 data.set(LIBRARY_KEY,original);
 assert.throws(()=>recoverStoredLibrary({...storage,setItem:()=>{throw Error('quota');}},original,[]));assert.equal(data.get(LIBRARY_KEY),original);
 assert.throws(()=>recoverStoredLibrary({...storage,setItem:(k,v)=>{if(k===LIBRARY_KEY)throw Error('quota');storage.setItem(k,v);}},original,[]));assert.equal(data.get(LIBRARY_KEY),original);
});


test('compacting drawers preserves physical order and each hardware setup while lowering the cap',()=>{
 const p=newProject(),m=p.modules[0].module,s=m.sections[0];s.shelves=[];s.drawers=3;
 s.drawerConfigs=[{slide:'ball',length:300,height:160,y:600},{slide:'gtv0fpo',length:450,height:120,y:50},{slide:'ball',length:350,height:140,y:300}];
 const before=structuredClone(p),cap=parts(m).find(a=>a.id===s.id+':drawer-cap')!;
 const out=compactDrawers(p,p.modules[0].id,s.id),next=out.modules[0].module.sections[0];
 assert.deepEqual(next.drawerConfigs?.map(c=>c.y),[340,0,160]);
 for(let i=0;i<3;i++)assert.deepEqual({...next.drawerConfigs![i],y:s.drawerConfigs[i].y},s.drawerConfigs[i]);
 assert.ok(parts(out.modules[0].module).find(a=>a.id===s.id+':drawer-cap')!.position[1]<cap.position[1]);assert.deepEqual(projectErrors(out),[]);assert.deepEqual(p,before);
 assert.deepEqual(compactDrawers(out,p.modules[0].id,s.id),out);
});


import {compatibleSlideLength} from '../src/hardware';
test('changing runner family retains a supported length and otherwise chooses a fitting shorter nominal',()=>{
 assert.equal(compatibleSlideLength('gtv0fpo',450,575),450);
 assert.equal(compatibleSlideLength('ball',550,575),500);
 assert.equal(compatibleSlideLength('ball',270,575),250);
 assert.equal(compatibleSlideLength('gtv0fpo',500,430),400);
 assert.equal(compatibleSlideLength('ball',200,575),250);
 assert.equal(compatibleSlideLength('gtv0fpo',450,240),undefined);
});


test('group drag translates every module and snaps the whole envelope to room walls',()=>{
 const p=newProject(),a=p.modules[0];p.room.height=3500;const n=appendModule(p,a.module,a),anchor=n.modules[1];
 n.modules.push({...structuredClone(a),id:'upper-drag',y:2000,module:{...structuredClone(a.module),height:600,sections:[section()]}});
 const before=structuredClone(n),moved=moveComposition(n,anchor.id,{x:anchor.x+100,y:50,z:300});
 for(let i=0;i<n.modules.length;i++){assert.equal(moved.modules[i].x-n.modules[i].x,100);assert.equal((moved.modules[i].y??0)-(n.modules[i].y??0),50);assert.equal(moved.modules[i].z-n.modules[i].z,270);assert.deepEqual(moved.modules[i].module,n.modules[i].module);}
 assert.deepEqual(projectErrors(moved),[]);assert.deepEqual(n,before);
 const left=snapComposition(n,anchor.id,{x:601,y:0,z:30});assert.equal(left.x,600);assert.equal(left.z,3);assert.equal(bounds(moveComposition(n,anchor.id,left).modules[0]).x,0);
 const right=snapComposition(n,anchor.id,{x:3390,y:0,z:30});assert.equal(right.x,3400);assert.deepEqual(projectErrors(moveComposition(n,anchor.id,right)),[]);
 assert.ok(projectErrors(moveComposition(n,anchor.id,{x:4000,y:0,z:30})).length);
});


test('numeric wall distances in group mode preserve offsets and reject moving other bodies outside',()=>{
 const p=newProject(),n=appendModule(p,p.modules[0].module,p.modules[0]),a=n.modules[1],before=structuredClone(n);
 const moved=setWallDistance(n,a.id,'x',1000,true);assert.equal(moved.modules[0].x,400);assert.equal(moved.modules[1].x,1000);assert.deepEqual(projectErrors(moved),[]);
 assert.throws(()=>setWallDistance(n,a.id,'x',100,true));assert.deepEqual(n,before);
 const individual=setWallDistance(n,a.id,'x',1000);assert.equal(individual.modules[0].x,50);
});


test('copy selected drawer preserves hardware, handle and source, and derives a new cap',()=>{
 const p=newProject(),a=p.modules[0],s=a.module.sections[0];s.shelves=[];s.rod=false;s.drawers=1;s.drawerConfigs=[{slide:'gtv0fpo',length:450,height:180,y:0,handle:true}];
 const before=JSON.stringify(p),result=duplicatePart(p,a.id,s.id,s.id+':drawer:0:left'),next=result.project.modules[0].module.sections[0];
 assert.deepEqual(projectErrors(result.project),[]);assert.equal(next.drawers,2);assert.equal(next.drawerConfigs![1].slide,'gtv0fpo');assert.equal(next.drawerConfigs![1].length,450);assert.equal(next.drawerConfigs![1].height,180);assert.equal(next.drawerConfigs![1].handle,true);assert.equal(next.drawerConfigs![1].y,220);assert.ok(parts(result.project.modules[0].module).some(p=>p.id===result.partId));assert.equal(drawerStackHeight(next),440);assert.equal(JSON.stringify(p),before);
});

test('copy shelf selects the inserted shelf and a full section cannot lose its source',()=>{
 const p=newProject(),a=p.modules[0],s=a.module.sections[0];s.drawers=0;s.drawerConfigs=[];s.rod=false;s.shelves=[.25,.75];
 const before=JSON.stringify(p),result=duplicatePart(p,a.id,s.id,s.id+':shelf:0'),next=result.project.modules[0].module.sections[0];
 assert.deepEqual(projectErrors(result.project),[]);assert.equal(next.shelves.length,3);assert.equal(result.partId,s.id+':shelf:1');assert.ok(next.shelves[1]>.25&&next.shelves[1]<.75);assert.equal(JSON.stringify(p),before);
 assert.throws(()=>duplicatePart(p,a.id,s.id,'left'));
 s.drawers=5;s.shelves=[];const full=JSON.stringify(p);assert.throws(()=>duplicatePart(p,a.id,s.id,s.id+':drawer:0:facade'));assert.equal(JSON.stringify(p),full);
});


test('round rod mounting screws enter estimate and specification without affecting pantographs',()=>{
 const p=newProject(),m=p.modules[0].module;m.sections=[section()];m.sections[0].rod=true;
 const two=appendModule(p,m),pantograph=structuredClone(m);pantograph.sections[0].rod=false;pantograph.sections[0].pantograph=true;
 const n=appendModule(two,pantograph),e=estimate(n),line=e.lines.find(l=>l.id==='screw35x16-rod')!;
 assert.deepEqual(projectErrors(n),[]);assert.equal(line.quantity,12);assert.equal(line.unitPrice,null);assert.equal(e.lines.find(l=>l.id==='flange25')!.quantity,4);assert.ok(e.missing.includes(line));
 n.calculation={markup:2.2,overrides:{'screw35x16-rod':3}};assert.equal(estimate(n).lines.find(l=>l.id===line.id)!.unitPrice,3);
 assert.equal((specificationHTML(n).match(/саморезы 3,5×16 — 6 шт/g)||[]).length,2);
});


test('estimate CSV preserves unknown prices, quantities, totals and safe customer text',()=>{
 const p=newProject();p.modules[0].module.sections=[section()];p.modules[0].module.sections[0].rod=true;p.offer={customer:'=1+1',price:'',notes:''};
 const csv=estimateCSV(p),e=estimate(p);assert.ok(csv.startsWith('\uFEFF'));assert.ok(csv.includes('"\'=1+1"'));assert.ok(csv.includes('"Саморез 3,5×16 · крепление штанги D25";"6";"шт";"";"";'));assert.ok(csv.includes('"Смета не завершена"'));assert.ok(csv.includes('"'+e.knownCost+'"'));
 p.calculation={markup:2.2,overrides:{'screw35x16-rod':3}};const full=estimateCSV(p);assert.ok(full.includes('"6";"шт";"3";"18";"Цена в этом проекте";"Учтено"'));assert.ok(!full.includes('"Смета не завершена"'));assert.ok(full.includes('"2,2"'));
});


test('section filling copies physical heights and hardware into a different body without copying its material',()=>{
 const p=newProject(),a=p.modules[0],s=a.module.sections[0];s.drawerConfigs=[{slide:'gtv0fpo',length:450,height:140,handle:true,y:0},{slide:'ball',length:500,height:180,y:180}];
 const copy=captureSectionFilling(p,a.id,s.id),n=appendModule(p,a.module),target=n.modules[1];target.module.height=2200;target.module.plinthHeight=0;target.module.width=700;target.module.decor='Белый';const before=JSON.stringify(n),sid=target.module.sections[0].id;
 const pasted=pasteSectionFilling(n,target.id,sid,copy),m=pasted.modules[1].module,box=boxes(m)[0],fill=m.sections[0];assert.deepEqual(projectErrors(pasted),[]);assert.equal(m.decor,'Белый');assert.equal(m.width,700);assert.equal(fill.id,sid);assert.deepEqual(fill.drawerConfigs,copy.drawers);assert.ok(Math.abs(fill.shelves[0]*(box.top-box.bottom)-copy.shelves[0])<1e-6);assert.equal(JSON.stringify(n),before);
 target.module.depth=300;const shallow=JSON.stringify(n);assert.throws(()=>pasteSectionFilling(n,target.id,sid,copy),/не подходит/);assert.equal(JSON.stringify(n),shallow);
});

test('section clipboard resolves an automatic rod height and is independent of later source edits',()=>{
 const p=newProject(),a=p.modules[0];a.module.sections=[section()];const s=a.module.sections[0];s.rod=true;s.shelves=[.8];const copy=captureSectionFilling(p,a.id,s.id),saved=JSON.stringify(copy);s.shelves[0]=.9;
 const n=appendModule(p,a.module),b=n.modules[1];b.module.height=2200;const pasted=pasteSectionFilling(n,b.id,b.module.sections[0].id,copy),m=pasted.modules[1].module,box=boxes(m)[0],rod=parts(m).find(a=>a.role==='rod')!;
 assert.ok(Math.abs(rod.position[1]-box.bottom-copy.hangerHeight!)<1e-6);assert.equal(JSON.stringify(copy),saved);assert.equal(m.sections[0].drawers,0);assert.equal(m.sections[0].pantograph,false);
});

test('review package contains consistent details and internal review warnings',()=>{
  const p=newProject();p.offer={customer:'Заказ / <тест>',price:'',notes:''};
  p.modules[0].module.sections[0].drawerConfigs=[{slide:'gtv0fpo',length:500,height:140},{slide:'gtv0fpo',length:500,height:140}];
  const before=JSON.stringify(p),files=reviewFiles(p,new Date('2026-09-06T05:00:00Z'));
  assert.equal(Object.keys(files).length,9);
  assert.deepEqual(JSON.parse(files['01-Проект.project.json']),p);
  assert.ok(files['00-Прочитайте.txt'].includes('GTV 0FPO'));
  assert.ok(files['00-Прочитайте.txt'].includes('2026-09-06T05:00:00.000Z'));
  assert.ok(files['00-Прочитайте.txt'].includes('управляющие программы не включены'));
  for(const d of details(p)){assert.ok(files['06-Деталировка.csv'].includes(d.code));assert.ok(files['07-Бирки.html'].includes(d.code));}
  assert.ok(files['08-Смета.csv'].startsWith('\ufeff'));
  assert.ok(!/[<>:"/\\|?*]/.test(reviewArchiveName(p)));
  assert.equal(JSON.stringify(p),before);
});
test('review ZIP preserves Unicode filenames and captures the project before asynchronous loading',async()=>{
  const p=newProject(),before=structuredClone(p),pending=reviewArchive(p);
  p.modules[0].module.name='Позднее изменение';
  const archive=unzipSync(await pending),names=Object.keys(archive);
  assert.equal(names.length,9);
  assert.ok(names.includes('01-Проект.project.json'));
  assert.deepEqual(JSON.parse(strFromU8(archive['01-Проект.project.json'])),before);
  assert.ok(strFromU8(archive['02-Ведомость.html']).includes(before.modules[0].module.name));
  assert.ok(names.every(name=>!name.includes('/')&&!name.includes('\\')));
});
test('review package refuses invalid furniture instead of exporting partial documents',()=>{
  const p=newProject();p.modules[0].module.width=901;
  assert.throws(()=>reviewFiles(p));
});

test('specification follows actual door handing, filler sides and drawer cap heights',()=>{
 const p=newProject(),m=p.modules[0].module;
 m.hingeSide='right';let html=specificationHTML(p);
 assert.ok(html.includes('петли справа'));
 assert.ok(html.includes('Фальши в зоне ящиков: справа —'));
 const cap=parts(m).find(d=>d.id.endsWith(':drawer-cap'))!;
 const bottom=boxes(m)[0].bottom,lower=Math.round((cap.position[1]-cap.size[1]/2-bottom)*10)/10;
 assert.ok(html.includes('Полка над ящиками: низ от дна проёма '+lower));
 m.width=900;html=specificationHTML(p);
 assert.ok(html.includes('петли слева'));assert.ok(html.includes('петли справа'));
 assert.ok(html.includes('Фальши в зоне ящиков: слева —'));assert.ok(html.includes('; справа —'));
 m.doors=false;html=specificationHTML(p);assert.ok(!html.includes('Фальши в зоне ящиков:'));assert.ok(html.includes('Створки: нет'));
});
test('specification reports rod and pantograph heights from geometry without inventing drilling',()=>{
 const p=newProject(),m=p.modules[0].module,s=m.sections[0];s.drawers=0;s.drawerConfigs=[];s.shelves=[];s.rod=true;s.rodAt=0.7;
 const rod=parts(m).find(d=>d.role==='rod')!,bottom=boxes(m)[0].bottom;
 let html=specificationHTML(p);assert.ok(html.includes('Штанга D25: ось от дна проёма '+Math.round((rod.position[1]-bottom)*10)/10));
 assert.ok(html.includes('не координаты присадки'));
 s.rod=false;s.pantograph=true;html=specificationHTML(p);assert.ok(html.includes('Штанга пантографа: ось от дна проёма'));
 assert.ok(!html.includes('Крепление штанги D25:'));
});

test('transferring a hanging rail never replaces an existing rail or pantograph',()=>{
 const p=appendModule(newProject(),initialModule()),a=p.modules[0],b=p.modules[1];
 for(const body of [a,b]){body.module.sections=[section()];body.module.sections[0].rod=true;}
 const source=a.module.sections[0],target=b.module.sections[0];
 for(const pantograph of [false,true]){
  target.rod=!pantograph;target.pantograph=pantograph;
  const before=JSON.stringify(p);
  assert.throws(()=>transferPart(p,a.id,source.id,source.id+':rod',b.id,target.id,1500),/уже есть штанга или пантограф/);
  assert.equal(JSON.stringify(p),before);
 }
 target.rod=false;target.pantograph=false;
 const moved=transferPart(p,a.id,source.id,source.id+':rod',b.id,target.id,1500);
 assert.equal(moved.modules[0].module.sections[0].rod,false);assert.equal(moved.modules[1].module.sections[0].rod,true);
});
test('full section insertion explains the item limit without mutating the project',()=>{
 const p=newProject(),a=p.modules[0],s=a.module.sections[0];s.drawers=0;s.shelves=Array.from({length:10},(_,i)=>(i+1)/12);
 assert.throws(()=>insertItem(p,'shelf',a.id,s.id,1000),/уже 10 полок/);
 s.shelves=[];s.drawers=5;
 assert.throws(()=>insertItem(p,'drawer',a.id,s.id,1000),/уже 5 ящиков/);
 assert.equal(s.drawers,5);
 assert.throws(()=>insertItem(p,'shelf',a.id,'missing',1000),/Выберите секцию/);
});

test('new filling selection follows a sorted shelf and appended drawer',()=>{
 const p=newProject(),a=p.modules[0],s=a.module.sections[0];
 const shelf=insertItem(p,'shelf',a.id,s.id,900),pid=insertedPartId(p,shelf,a.id,s.id,'shelf');
 assert.equal(pid,s.id+':shelf:0');
 assert.ok(parts(shelf.modules[0].module).some(d=>d.id===pid));
 const drawer=insertItem(p,'drawer',a.id,s.id,500),drawerId=insertedPartId(p,drawer,a.id,s.id,'drawer');
 assert.equal(drawerId,s.id+':drawer:2:facade');
 assert.ok(parts(drawer.modules[0].module).some(d=>d.id===drawerId));
 assert.equal(insertedPartId(p,p,a.id,s.id,'shelf'),undefined);
});
test('selection after a transfer belongs to the receiving module and section',()=>{
 const p=appendModule(newProject(),initialModule()),a=p.modules[0],b=p.modules[1],s=a.module.sections[0],target=b.module.sections[0];
 const n=transferPart(p,a.id,s.id,s.id+':drawer:0:facade',b.id,target.id,500),pid=insertedPartId(p,n,b.id,target.id,'drawer');
 assert.equal(pid,target.id+':drawer:2:facade');
 assert.ok(parts(n.modules[1].module).some(d=>d.id===pid));
 assert.equal(n.modules[0].module.sections[0].drawers,1);
});

test('shelf button divides the largest clear gap while preserving existing shelf heights',()=>{
 const p=newProject(),a=p.modules[0],s=a.module.sections[0];s.drawers=0;s.shelves=[0.2,0.7];
 const before=[...s.shelves],n=insertItem(p,'shelf',a.id,s.id,shelfInsertionHeight(a.module,s.id)),after=n.modules[0].module.sections[0].shelves;
 assert.ok(before.every(height=>after.includes(height)));
 const inserted=after.find(height=>!before.includes(height))!;
 assert.ok(Math.abs(inserted-0.45)<0.003);
 assert.deepEqual(projectErrors(n),[]);
});
test('shelf insertion suggestion excludes the mandatory drawer cap',()=>{
 const p=newProject(),a=p.modules[0],s=a.module.sections[0];s.shelves=[];
 const cap=parts(a.module).find(d=>d.id.endsWith(':drawer-cap'))!,height=shelfInsertionHeight(a.module,s.id);
 assert.ok(height>cap.position[1]+cap.size[1]/2+80);
 const n=insertItem(p,'shelf',a.id,s.id,height);assert.deepEqual(projectErrors(n),[]);
 assert.equal(n.modules[0].module.sections[0].drawers,s.drawers);
});

test('selected group moves together while unselected bodies retain their position',()=>{
 const p=appendModule(appendModule(newProject(),initialModule()),initialModule()),ids=p.modules.slice(0,2).map(a=>a.id),a=p.modules[0],before=JSON.stringify(p);
 const n=moveComposition(p,a.id,{x:a.x,y:0,z:a.z+200},ids);
 for(let i=0;i<2;i++){assert.equal(n.modules[i].z,p.modules[i].z+200);assert.equal(n.modules[i].x,p.modules[i].x);}
 assert.deepEqual(n.modules[2],p.modules[2]);assert.equal(JSON.stringify(p),before);assert.deepEqual(projectErrors(n),[]);
 const single=moveComposition(p,p.modules[2].id,{x:p.modules[2].x,y:0,z:300},ids);
 assert.deepEqual(single.modules[0],p.modules[0]);assert.deepEqual(single.modules[1],p.modules[1]);assert.equal(single.modules[2].z,300);
});
test('group wall distances preserve upper modules and leave other modules unchanged',()=>{
 const p=appendModule(newProject(),initialModule()),upper=addUpperModule(p,p.modules[0].id),base=upper.modules[0],top=upper.modules.at(-1)!,ids=[base.id,top.id];
 const n=setWallDistance(upper,base.id,'z',200,false,ids),delta=n.modules[0].z-base.z;
 assert.equal(n.modules.at(-1)!.z,top.z+delta);assert.equal(n.modules.at(-1)!.y,top.y);assert.deepEqual(n.modules[1],upper.modules[1]);
 assert.deepEqual(projectErrors(n),[]);
});
test('group snapping uses its own bounds and unselected neighbour edges',()=>{
 const p=appendModule(appendModule(newProject(),initialModule()),initialModule()),a=p.modules[0],ids=p.modules.slice(0,2).map(a=>a.id);p.modules[2].x=2200;
 assert.equal(snapComposition(p,a.id,{x:8,y:0,z:30},35,ids).x,0);
 assert.equal(snapComposition(p,a.id,{x:990,y:0,z:30},35,ids).x,1000);
 const collision=moveComposition(p,a.id,{x:1600,y:0,z:30},ids);assert.ok(projectErrors(collision).length>0);
});
