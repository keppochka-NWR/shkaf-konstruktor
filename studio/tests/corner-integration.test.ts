import test from 'node:test';
import assert from 'node:assert/strict';
import {createCornerModule,cornerBoxes,cornerProject,CORNER_DEFAULT,cornerOffsets} from '../src/cornerWardrobe';
import {createModule} from '../src/ModulePalette';
import {parts,initialModule,validate} from '../src/model';
import {newProject,appendModule,appendModuleGroup,copyModuleGroup,parseProject,projectErrors,modulesOverlap,snapPlacement,applyAutoFillers} from '../src/project';
import {addUpperModule,moveModule,rotateModule,insertItem,movePart,removePart,clearSection,transferPart} from '../src/operations';
import {details,nest,detailCSV,nestingHTML,sheetSVG} from '../src/exports';
import {templateGroup,libraryFile,parseLibraryFile} from '../src/moduleLibraryFile';
import {moduleDrawingSVG,drawingLevels} from '../src/drawings';
import {placementSVG} from '../src/placementPlan';

test('palette creates an independent corner with a roof and unique editable sections',()=>{
 const a=createModule('corner',1050,2000,450,initialModule()),b=createCornerModule();
 assert.deepEqual(validate(a),[]);assert.equal(a.corner?.sharedTop,false);assert.ok(parts(a).some(p=>p.id==='top'));
 assert.ok(a.sections.every(s=>!b.sections.some(t=>t.id===s.id)));
 assert.ok(parts(a).every(p=>a.sections.some(s=>s.id===p.sectionId)));
 assert.equal(a.sections[0].drawers,3);assert.equal(a.sections[1].shelves.length,2);assert.equal(a.sections[2].rod,true);
});
test('corner and ordinary cabinets insert, copy, rotate, snap and save in the same project',()=>{
 let p=newProject(createCornerModule());p.room.width=6500;p.room.depth=5000;
 p=appendModule(p,initialModule());assert.equal(p.modules.length,2);assert.deepEqual(projectErrors(p),[]);
 const copy=copyModuleGroup(p,[p.modules[0].id]);p=copy.project;assert.equal(p.modules.length,3);
 assert.ok(p.modules[2].module.sections.every(s=>!p.modules[0].module.sections.some(t=>t.id===s.id)));
 p=rotateModule(p,copy.ids[0],90);assert.deepEqual(projectErrors(p),[]);
 const original=p.modules[0];const snapped=snapPlacement(p,original.id,{x:8,y:0,z:8});assert.equal(snapped.x,3);assert.equal(snapped.z,3);
 p=moveModule(p,original.id,snapped);p=applyAutoFillers(p);assert.equal(p.modules[0].x,3);assert.equal(p.modules[0].module.cornerFiller,undefined);
 const roundtrip=parseProject(JSON.parse(JSON.stringify(p)));assert.deepEqual(roundtrip,p);assert.deepEqual(projectErrors(p),[]);
});
test('two independent corner modules can be stored as an ordinary library group',()=>{
 const p=cornerProject(CORNER_DEFAULT),group=templateGroup(p.modules);
 const text=libraryFile([{id:'test-corner',name:'Угол с антресолью',module:group[0].module,group}]);
 const loaded=parseLibraryFile(JSON.parse(text));assert.equal(loaded[0].group?.length,2);
 const target=newProject();target.room.width=6000;target.room.depth=5000;
 const result=appendModuleGroup(target,loaded[0].group!);assert.equal(result.project.modules.length,3);assert.deepEqual(projectErrors(result.project),[]);
});
test('drawers, shelves and rods are not baked into the corner template',()=>{
 let p=newProject(createCornerModule()),m=p.modules[0].module,mid=p.modules[0].id,sid=m.sections[0].id;
 const before=parts(m).length;
 p=removePart(p,mid,sid,sid+':drawer:1:bottom');m=p.modules[0].module;
 assert.equal(m.sections[0].drawers,2);assert.ok(parts(m).length<before);assert.ok(parts(m).some(p=>p.id===sid+':drawer-cap'));
 p=movePart(p,mid,sid,sid+':shelf:0',20);assert.deepEqual(projectErrors(p),[]);
 p=clearSection(p,mid,sid);assert.equal(parts(p.modules[0].module).filter(p=>p.id.startsWith(sid+':drawer:')).length,0);
 p=insertItem(p,'drawer',mid,sid,cornerBoxes(p.modules[0].module)[0].bottom);
 assert.equal(p.modules[0].module.sections[0].drawers,1);assert.deepEqual(projectErrors(p),[]);
 p=insertItem(p,'shelf',mid,sid,1000);assert.equal(p.modules[0].module.sections[0].shelves.length,1);
 const other=p.modules[0].module.sections[1].id;
 p=clearSection(p,mid,other);p=transferPart(p,mid,sid,sid+':drawer:0:bottom',mid,other,96);
 assert.equal(p.modules[0].module.sections[0].drawers,0);assert.equal(p.modules[0].module.sections[1].drawers,1);assert.deepEqual(projectErrors(p),[]);
});
test('custom drawer hardware affects its own boards, rejects overlap and impossible guides',()=>{
 const m=createCornerModule(),s=m.sections[0],pid=s.id+':drawer:0:front';
 const old=parts(m).find(p=>p.id===pid)!.length;
 s.drawerConfigs![0].slide='gtv0fpo';assert.notEqual(parts(m).find(p=>p.id===pid)!.length,old);assert.deepEqual(validate(m),[]);
 s.drawerConfigs![1].y=20;assert.match(validate(m).join(' '),/пересекаются/);delete s.drawerConfigs![1].y;
 s.drawerConfigs![0].length=400;assert.match(validate(m).join(' '),/30 мм/);
 assert.equal(cornerOffsets(m,s)[1],230);
});
test('upper corner is created as a separate editable carcass at the correct height',()=>{
 let p=newProject(createCornerModule()),mid=p.modules[0].id;p=addUpperModule(p,mid);
 const top=p.modules.at(-1)!;assert.equal(top.y,2000);assert.equal(top.module.corner?.level,'upper');assert.deepEqual(projectErrors(p),[]);
 p=insertItem(p,'shelf',top.id,top.module.sections[0].id,300);
 assert.equal(parts(p.modules.at(-1)!.module).filter(p=>p.role==='shelf').length,1);
 assert.ok(parts(p.modules.at(-1)!.module).find(p=>p.role==='shelf')!.planContour);
});
test('polygon collision permits space in front of the diagonal but rejects real intersections',()=>{
 const a={id:'corner',x:20,z:20,y:0,module:createCornerModule()};
 const m={...initialModule(),width:300,depth:300,doors:false,sections:[{id:'plain',weight:1,shelves:[],drawers:0,rod:false}]};
 const free={id:'free',x:820,z:820,y:0,module:m};assert.equal(modulesOverlap(a,free),false);
 const colliding={...free,x:600,z:600};assert.equal(modulesOverlap(a,colliding),true);
 assert.equal(modulesOverlap(a,{...colliding,y:2000}),false);
});
test('mixed project output includes every part once, edge deductions and actual contours',()=>{
 let p=newProject(createCornerModule());p=appendModule(p,initialModule());
 const sheets=nest(p),all=details(p),placed=sheets.flatMap(s=>s.items);
 assert.equal(placed.length,all.length);assert.equal(new Set(placed.map(i=>i.detail.code)).size,all.length);
 assert.ok(placed.some(i=>i.detail.planContour?.length===5&&i.cutContour?.length===5));
 const door=placed.find(i=>i.detail.role==='door')!;assert.ok(Math.abs(door.w*door.h-(door.detail.length-4)*(door.detail.width-4))<.1);
 assert.match(sheetSVG(sheets.find(s=>s.items.some(i=>i.detail.planContour))!),/<polygon/);
 assert.match(detailCSV(p),/Контур заготовки/);assert.match(nestingHTML(p),/ГардерЁб · раскрой проекта/);
});
test('corner drawings retain shaped shelves, filling elevations and the five-sided footprint',()=>{
 const m=createCornerModule(),p=newProject(m),svg=moduleDrawingSVG(m),plan=placementSVG(p);
 assert.doesNotMatch(svg+plan,/NaN|Infinity|undefined/);
 assert.match(svg,/По диагонали/);assert.match(svg,/План сверху/);
 const contour=svg.match(/<polygon data-part="bottom" points="([^"]+)"/);
 assert.ok(contour);assert.equal(contour[1].split(' ').length,4); // front projection of a pentagonal horizontal panel
 const planContour=Array.from(svg.matchAll(/<polygon data-part="bottom" points="([^"]+)"/g)).at(-1)!;
 assert.equal(planContour[1].split(' ').length,5);
 assert.equal(plan.match(/<g data-module="[^"]+"><polygon points="([^"]+)"/)![1].split(' ').length,5);
 const shelf=drawingLevels(m).find(d=>d.id===m.sections[0].id+':shelf:0')!;
 const part=parts(m).find(d=>d.id===shelf.id)!;assert.equal(shelf.bottom,Math.round((part.position[1]-8)*10)/10);
});
