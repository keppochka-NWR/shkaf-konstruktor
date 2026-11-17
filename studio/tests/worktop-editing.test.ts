import test from 'node:test';
import assert from 'node:assert/strict';
import {initialModule,parts} from '../src/model';
import {kitchenBase,kitchenWorktop,setWorktopMaterial} from '../src/kitchen';
import {newProject,parseProject} from '../src/project';
import {compactDecor,compactDecors,compactProducts,compactVariants} from '../src/compactCatalog';
import {relocateCutoutRails} from '../src/cutoutRails';
import {moveWorktopCutout,cutoutSnapPoints} from '../src/worktopCutoutPlacement';

function fixture(){
 const m=kitchenBase(initialModule(),600,'sink'),p=newProject(m),a=p.modules[0];a.x=100;a.z=100;
 const t=kitchenWorktop(m,1200);t.depth=600;t.worktop!.cutouts=[{kind:'sink',x:50,z:100,width:500,depth:400}];
 p.modules.push({id:'top',x:a.x,z:a.z,y:m.height,module:t});return p;
}
test('compact selects its own decor, fixed thickness and survives save/reload',()=>{
 const p=fixture(),m=p.modules[1].module;setWorktopMaterial(m,'compact');
 assert.ok(compactDecor(m.decor));assert.equal(m.height,12);assert.equal(m.worktop!.thickness,12);
 const q=parseProject(JSON.parse(JSON.stringify(p)));assert.equal(q.modules[1].module.decor,m.decor);
 setWorktopMaterial(m,'quartz');assert.equal(m.height,20);assert.ok(!compactDecor(m.decor));
});
test('cutout without drawer moves rear rail top exactly 200 mm below carcass top',()=>{
 const p=fixture(),before=JSON.stringify(p),q=relocateCutoutRails(p,'top'),m=q.modules[0].module;
 assert.equal(JSON.stringify(p),before);
 assert.equal(m.rails!.filter(r=>r.place.endsWith('top')).length,1);
 const r=parts(m).find(p=>p.id==='rail:rear-top')!;assert.equal(r.position[1]+r.size[1]/2,m.height-200);
});
test('moving cutout preserves its size, respects bounds and offers sink axis',()=>{
 const p=fixture(),top=p.modules[1];
 const snaps=cutoutSnapPoints(p,top,0,100);assert.ok(snaps.some(s=>s.x===50));
 const q=moveWorktopCutout(p,'top',0,{x:60,z:90});assert.equal(q.modules[1].module.worktop!.cutouts[0].width,500);
 assert.throws(()=>moveWorktopCutout(p,'top',0,{x:-1,z:90}),/вырез/);
});

 test('Premial picker has 26 unique decors while all 43 product variants are preserved',()=>{
 const decors=compactDecors.filter(d=>d.brand==='Premial');
 assert.equal(decors.length,26);
 assert.equal(new Set(decors.map(d=>d.n)).size,26);
 const variants=decors.flatMap(d=>compactVariants(d.n));
 assert.equal(variants.length,43);
 assert.deepEqual(new Set(variants.map(d=>d.code)),new Set(compactProducts.filter(d=>d.brand==='Premial').map(d=>d.code)));
 });
