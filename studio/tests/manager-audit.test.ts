import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createModule} from '../src/ModulePalette';
import {initialModule,validate,boxes,drawerStackHeight} from '../src/model';
import {managerReviewFiles} from '../src/reviewPackage';
import {newProject,applyAutoFillers,projectErrors,bounds} from '../src/project';
import {kitchenTemplate,placeKitchenModule,rebuildKitchen} from '../src/kitchenProject';
import {setWallDistance,insertItem} from '../src/operations';
import {setKitchenDrawerCount,setKitchenGola,resizeKitchenDrawerFront} from '../src/kitchenEditing';
import {axisFits} from '../src/kitchenDrawers';
import {estimate} from '../src/pricing';
test('custom kitchen depth refits shelves, worktop height is its thickness',()=>{
 for(const [kind,setback] of [['kitchen-base',2.5],['kitchen-wall',22]] as const){const m=createModule(kind,600,720,450,initialModule());assert.equal(m.sections[0].shelfDepth,450-setback);assert.deepEqual(validate(m),[]);}
 const top=createModule('worktop',600,50,600,initialModule());assert.equal(top.height,50);assert.equal(top.worktop!.thickness,50);assert.deepEqual(validate(top),[]);
});
test('filled rear kitchen row still allows a tall unit in free floor space',()=>{
 const p=newProject(kitchenTemplate('base-doors',600,initialModule()));p.room={...p.room,width:1300,depth:3000,height:2700};p.modules[0].x=21;
 let next=placeKitchenModule(p,kitchenTemplate('base-doors',600,initialModule())).project;
 next=placeKitchenModule(next,kitchenTemplate('tall',600,initialModule())).project;
 assert.equal(next.modules.length,3);assert.ok(bounds(next.modules[2]).z>=550);assert.deepEqual(projectErrors(applyAutoFillers(next)),[]);
});
test('changing kitchen purpose preserves custom dimensions and leg height',()=>{
 const m=createModule('kitchen-base',600,900,600,initialModule());m.feet={height:120};
 for(const kind of ['base-drawers','sink','oven'] as const){const n=rebuildKitchen(m,kind);assert.equal(n.height,900);assert.equal(n.depth,600);assert.equal(n.feet?.height,120);assert.deepEqual(validate(n),[]);}
});
test('worktops never acquire cabinet corner fillers during placement',()=>{
 const p=newProject(createModule('kitchen-base',600,862,557,initialModule()));p.modules.push({id:'top',x:0,y:862,z:0,rotation:90,module:createModule('worktop',674,38,400,initialModule())});
 p.modules[1].module.cornerFiller='left';const n=applyAutoFillers(p);assert.equal(n.modules[1].module.cornerFiller,undefined);assert.equal(n.modules[1].module.wallFiller,undefined);
});
test('drawer insertion does not build a continuous internal filler through shelves',()=>{
 const m=createModule('shelves',1200,2400,600,initialModule());m.doors=true;const p=newProject(m),a=p.modules[0],s=m.sections[0];
 const n=insertItem(p,'drawer',a.id,s.id,100);const ss=n.modules[0].module.sections[0],b=boxes(n.modules[0].module)[0];
 assert.ok(ss.shelves.every(f=>f*(b.top-b.bottom)>=drawerStackHeight(ss)+16));
 assert.throws(()=>insertItem(n,'drawer',a.id,s.id,600),/недостаточно/);
});
test('Gola uses boxes that fit; an oversized bottom front is rejected instead of colliding',()=>{
 const m=kitchenTemplate('base-doors',600,initialModule());setKitchenDrawerCount(m,3);setKitchenGola(m,true);
 assert.ok(m.kdrawers!.every(d=>axisFits(m,d)));assert.throws(()=>resizeKitchenDrawerFront(structuredClone(m),0,320),/Gola/);
});
test('manager archive exports retail only, keeps geometry and does not change project',()=>{
 const p=newProject(),before=JSON.stringify(p),files=managerReviewFiles(p,new Date('2026-10-14T00:00:00Z'));
 assert.equal(JSON.stringify(p),before);assert.ok(files['04-Размерные виды.html']);assert.ok(files['06-Деталировка.csv']);assert.ok(files['08-Стоимость.csv'].includes(String(estimate(p).retail)));
 assert.equal(files['01-Проект.project.json'],undefined);assert.equal(files['08-Смета.csv'],undefined);
 assert.doesNotMatch(Object.values(files).join('\n'),/Себестоимость|Наценка|Закупка|vernissageMarkup|"markup"/i);
});

test('kupe track channels allow factory seating but not shifted leaves or foreign boards',async()=>{
 const {createKupeModule}=await import('../src/ModulePalette');const {kupeParts}=await import('../src/kupe');const {partCollisions}=await import('../src/collisions');
 const m=createKupeModule(2400,2400,initialModule());m.kupe!.doors=3;
 const ps=kupeParts(m);assert.deepEqual(partCollisions(ps,m),[]);
 const side=ps.find(p=>p.id==='kupe:0:side:l')!;side.position[1]+=10;
 assert.ok(partCollisions(ps,m).some(c=>c.a==='kupe:track:top'&&c.b===side.id));
 const board={...ps[0],id:'foreign-board',material:'board' as const};assert.ok(partCollisions([...ps,board],m).some(c=>c.a==='foreign-board'||c.b==='foreign-board'));
});

test('explicit hinge repair removes drawer/divider collisions, round trips, leaves legacy untouched',async()=>{
 const {repairHinges}=await import('../src/hingeRepair');const {parts,parseModule}=await import('../src/model');const {partCollisions,hingeCollisions}=await import('../src/collisions');
 const m=createModule('shelves',1200,2400,600,initialModule());m.doors=true;
 m.sections=[{id:'left',weight:576,shelves:[.45673,.59353,.7299,.8667],drawers:2,rod:false,drawerConfigs:[{slide:'ball',height:140,length:500,y:0,facadeH:300},{slide:'ball',height:140,length:500,y:303}]},{id:'right',weight:576,shelves:[.83],drawers:0,rod:true,rodAt:.7867}];
 const before=JSON.stringify(m);assert.ok(hingeCollisions(partCollisions(parts(m),m)).length);const next=repairHinges(m);assert.equal(JSON.stringify(m),before);assert.deepEqual(hingeCollisions(partCollisions(parts(next),next)),[]);
 const reopened=parseModule(JSON.parse(JSON.stringify(next)));assert.equal(reopened.hingeFit,true);assert.deepEqual(hingeCollisions(partCollisions(parts(reopened),reopened)),[]);
 assert.throws(()=>repairHinges(kitchenTemplate('base-doors',600,initialModule())),/прямых/);
});
