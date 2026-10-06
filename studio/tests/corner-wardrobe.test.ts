import test from 'node:test';
import assert from 'node:assert/strict';
import {CORNER_DEFAULT,cornerProject,parseCorner,parametersFromCornerProject} from '../src/cornerWardrobe';
import {parts,validate} from '../src/model';
import {parseProject,projectErrors} from '../src/project';
import {area,cutting,inset,sheetPolygon,verifyCutting} from '../src/cornerCutting';
import {planContourGeometry} from '../src/boardGeometry';

test('corner dimensions, split and five sided geometry agree with the sketch',()=>{
 const p=cornerProject(CORNER_DEFAULT);assert.deepEqual(projectErrors(p),[]);
 assert.deepEqual(p.modules.map(a=>[a.y,a.module.height]),[[0,2007],[2007,439]]);
 const all=p.modules.flatMap(m=>parts(m.module)),main=parts(p.modules[0].module);
 assert.equal(all.filter(d=>d.role==='door').length,4);
 assert.equal(all.filter(d=>d.planContour?.length===5).length,4);
 assert.equal(all.filter(d=>d.id.includes(':drawer:')&&d.id.endsWith(':facade')).length,6);
 const top=main.find(d=>d.id==='middle-shelf')!;
 const polygon=top.planContour!;assert.ok(Math.abs(Math.hypot(polygon[2][0]-polygon[3][0],polygon[2][1]-polygon[3][1])-826)<.2);
 assert.equal(top.position[1]-8-96,1569);
 assert.equal(main.find(d=>d.id==='side-left')!.position[1]-main.find(d=>d.id==='side-left')!.size[1]/2,0);
 const g=planContourGeometry(top);g.computeBoundingBox();assert.equal(g.boundingBox!.max.x-g.boundingBox!.min.x,1034);assert.equal(g.boundingBox!.max.z-g.boundingBox!.min.z,1034);assert.equal(g.boundingBox!.max.y-g.boundingBox!.min.y,16);g.dispose();
});
test('drawer boxes face perpendicular directions, bottoms LDSP and mandatory shelves',()=>{
 const m=cornerProject(CORNER_DEFAULT).modules[0].module,a=parts(m);
 assert.equal(a.find(p=>p.id==='left:drawer:0:facade')!.rotY,90);assert.equal(a.find(p=>p.id==='right:drawer:0:facade')!.rotY,0);
 for(const side of ['left','right']){assert.ok(a.find(p=>p.id===side+':drawer-cap'));for(let i=0;i<3;i++){const b=a.find(p=>p.id===`${side}:drawer:${i}:bottom`)!;assert.equal(b.material,'board');assert.equal(b.thickness,16);}}
 const hidden=parts(cornerProject({...CORNER_DEFAULT,slide:'gtv0fpo'}).modules[0].module);
 assert.notEqual(hidden.find(p=>p.id==='left:drawer:0:front')!.length,a.find(p=>p.id==='left:drawer:0:front')!.length);
});
test('project file retains complete editable geometry through normal parser',()=>{
 const p=cornerProject(CORNER_DEFAULT),loaded=parseProject(JSON.parse(JSON.stringify(p)));
 assert.deepEqual(parametersFromCornerProject(loaded),CORNER_DEFAULT);
 assert.deepEqual(loaded.modules.flatMap(a=>parts(a.module)),p.modules.flatMap(a=>parts(a.module)));
 assert.throws(()=>parametersFromCornerProject({...p,modules:[...p.modules,{...p.modules[0],id:'another-cabinet'}]}),/другие модули|два|двух/i);
});
test('edge deductions and convex contour offsets retain physical dimensions',()=>{
 assert.deepEqual(inset([[0,0],[100,0],[100,60],[0,60]],[2,2,2,2]),[[0,0],[96,0],[96,56],[0,56]]);
 const cut=cutting(cornerProject(CORNER_DEFAULT));
 const door=cut.pieces.find(p=>p.part.role==='door')!;assert.equal(door.length,door.part.length-4);assert.equal(door.width,door.part.width-4);
 const polygon=cut.pieces.find(p=>p.part.planContour?.length===5)!;assert.ok(polygon.area<area(polygon.part.planContour!));assert.ok(polygon.area<polygon.length*polygon.width);
 for(const s of cut.sheets)for(const a of s.items){for(const [x,y] of sheetPolygon(a)){assert.ok(x>=a.x-.01&&x<=a.x+a.w+.01);assert.ok(y>=a.y-.01&&y<=a.y+a.h+.01);}}
});
test('all parts fit three LDSP and two HDF sheets without duplicate parts or overlap',()=>{
 const cut=cutting(cornerProject(CORNER_DEFAULT));verifyCutting(cut);
 assert.equal(cut.pieces.length,63);assert.equal(cut.sheets.filter(s=>s.material==='ЛДСП').length,3);assert.equal(cut.sheets.filter(s=>s.material==='ХДФ').length,2);
 assert.ok(cut.pieces.filter(p=>p.part.material==='board').reduce((sum,p)=>sum+p.length*p.width,0)>2*2750*1830);
 const different=cutting(cornerProject({...CORNER_DEFAULT,facadeDecor:'Дуб Вотан'}));
 assert.ok(different.sheets.every(s=>s.items.every(a=>a.piece.part.material==='hdf'||a.piece.part.decor===s.decor)));
 assert.ok(different.pieces.filter(p=>p.part.decor==='Дуб Вотан').every(p=>!p.rotate));
});
test('reject depth, drawer and lower carcass limit violations',()=>{
 assert.throws(()=>parseCorner({...CORNER_DEFAULT,slideLength:400}),/запас/);
 assert.throws(()=>parseCorner({...CORNER_DEFAULT,height:2800}),/2200/);
 const m=cornerProject(CORNER_DEFAULT).modules[0].module;m.corner!.bayDepth=450;assert.ok(validate(m).length);
 assert.throws(()=>cutting(cornerProject({...CORNER_DEFAULT,bayWidth:400,arm:950})),/проём/);
});
