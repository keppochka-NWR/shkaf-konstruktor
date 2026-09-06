import test from 'node:test';
import assert from 'node:assert/strict';
import {initialModule,parts,validate,section,boxes,drawerStackHeight,parseModule,drawerConfig} from '../src/model';
import {newProject,projectErrors,parseProject,appendModule,snapPlacement,bounds,localToRoom,roomToLocal} from '../src/project';
import {rotateModule,setWallDistance,mirrorModule,insertItem,moveModule,movePart,removePart,transferPart} from '../src/operations';
import {wallPanels} from '../src/roomGeometry';
import {estimate,hingeCount} from '../src/pricing';
import {nest} from '../src/exports';
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
