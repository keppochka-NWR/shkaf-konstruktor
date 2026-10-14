import {dishwasherRoutes,dishwasherServiceWarnings} from '../src/dishwasherServices';
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as THREE from 'three';
import {parseProject,projectErrors,newProject} from '../src/project';
import {roomWarnings,collisionWarnings} from '../src/roomWarnings';
import {parts,validate} from '../src/model';
import {installSink} from '../src/installSink';
import {kitchenTemplate} from '../src/kitchenProject';
import {configureOven,ovenSupportTop,ovenLayoutWarnings} from '../src/kitchenOven';
import {refitKDrawers} from '../src/kitchenDrawers';
import {ovenModel} from '../src/ovenGeometry';
import {applianceModel} from '../src/applianceGeometry';
import {sinkChecks} from '../src/sinkChecks';
const saved=()=>parseProject(JSON.parse(readFileSync(new URL('../reports/k08-manual-ui.project.json',import.meta.url),'utf8')));
test('actual UI kitchen survives parse/save with furniture, appliances, fixtures and two holes',()=>{
 const p=saved();assert.equal(p.modules.length,10);assert.equal(p.room.obstacles?.length,4);assert.equal(p.room.fixtures?.length,10);
 assert.deepEqual(projectErrors(p),[]);assert.deepEqual(roomWarnings(p),[]);const oven=p.modules.find(a=>a.module.kitchen?.oven)!;
 assert.equal(ovenLayoutWarnings(oven.module).length,1);assert.ok(collisionWarnings(p).some(w=>w.moduleId===oven.id&&w.message.includes('Фасад ящика')));
 configureOven(oven.module);assert.deepEqual(collisionWarnings(p),[]);
 const top=p.modules.find(a=>a.module.worktop)!;assert.equal(top.module.worktop!.cutouts.length,2);
 assert.deepEqual(parseProject(JSON.parse(JSON.stringify(p))),p);
});
test('one-click sink is repeatable and preserves a separate hob opening',()=>{
 const p=saved(),base=p.modules.find(a=>a.module.kitchen?.appliance==='sink')!;
 const a=installSink(p,base.id),b=installSink(a,base.id);assert.deepEqual(b,a);assert.equal(b.modules.length,10);
 const cuts=b.modules.find(a=>a.module.worktop)!.module.worktop!.cutouts;assert.equal(cuts.filter(c=>c.kind==='sink').length,1);assert.equal(cuts.filter(c=>c.kind==='hob').length,1);
});
test('sink can create its own worktop at 0, 90 and 180 degrees without mutating source',()=>{
 for(const rotation of [0,90,180] as const){const m=kitchenTemplate('sink',600,{decor:'Белый',facadeDecor:'Белый'}),p=newProject(m);p.modules[0].rotation=rotation;p.modules[0].x=500;p.modules[0].z=500;
 const q=installSink(p,p.modules[0].id);assert.equal(p.modules.length,1);assert.equal(q.modules.length,2);assert.deepEqual(validate(q.modules[1].module),[]);assert.equal(q.modules[1].rotation,rotation);}
});
test('oven drawer remains below support after resize, and invalid oven widths are rejected',()=>{
 const m=kitchenTemplate('oven',600,{decor:'Белый',facadeDecor:'Белый'});m.height=872;m.kdrawers=refitKDrawers(m);
 assert.deepEqual(validate(m),[]);assert.equal(ovenSupportTop(m),272);assert.ok(m.kdrawers![0].y1<=272);
 configureOven(m,{drawer:false});assert.equal(m.kdrawers,undefined);const restored=structuredClone(m);configureOven(restored,{drawer:true});assert.equal(restored.kdrawers?.length,1);
 m.width=550;assert.ok(validate(m).some(e=>e.includes('духовка')));
});
test('actual connections are accepted, a foreign pipe and shelf are still detected',()=>{
 const p=saved();assert.deepEqual(sinkChecks(p),[]);
 const f=p.room.fixtures![0];f.offset=1330;f.fromFloor=700;f.height=80;f.depth=400;
 assert.ok(sinkChecks(p).some(w=>w.message.includes('пересекает')));
 const q=saved(),base=q.modules.find(a=>a.module.kitchen?.appliance==='sink')!;base.module.sections[0].shelves=[.75];assert.ok(sinkChecks(q).some(w=>w.message.includes('пересекает')));
});
test('appliances have finite outward meshes inside their closed declared bounds; opening projects forward',()=>{
 const p=saved();for(const o of p.room.obstacles!){const mesh=applianceModel(o)!,size=new THREE.Box3().setFromObject(mesh).getSize(new THREE.Vector3());
 assert.ok(size.x<=o.width+.01&&size.y<=o.height+.01&&size.z<=o.depth+.01,o.type+size.toArray());
 mesh.traverse(a=>{if(a instanceof THREE.Mesh){assert.equal((a.material as THREE.Material).side,THREE.FrontSide);for(const v of a.geometry.getAttribute('position').array)assert.ok(Number.isFinite(v));}});
 if(['fridge','dishwasher'].includes(o.type)){const opened=new THREE.Box3().setFromObject(applianceModel(o,true)!);assert.ok(opened.max.z>o.depth/2+200);assert.ok(opened.min.y>=-o.height/2-20);}
 }
 assert.deepEqual(new THREE.Box3().setFromObject(ovenModel()).getSize(new THREE.Vector3()).toArray(),[594,595,618]);
 assert.ok(new THREE.Box3().setFromObject(ovenModel(true)).max.z>600);
});

test('UI dishwasher connection persists and detects blocked service void and missing sink',()=>{
 const p=saved(),o=p.room.obstacles!.find(o=>o.type==='dishwasher')!;assert.ok(o.sinkModuleId);assert.equal(dishwasherRoutes(o,p.modules).length,2);assert.deepEqual(dishwasherServiceWarnings(p),[]);
 const routes=dishwasherRoutes(o,p.modules),waste=routes.find(r=>r.kind==='waste')!;assert.equal(Math.max(...waste.points.map(p=>p[1])),780);
 const base=p.modules.find(a=>a.module.kitchen?.appliance==='sink')!;base.z=0;assert.ok(dishwasherServiceWarnings(p).length);
 o.sinkModuleId='missing';assert.ok(dishwasherServiceWarnings(p).some(w=>w.message.includes('недоступно')));
});
