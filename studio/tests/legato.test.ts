import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {initialModule,section,parts,boxes,validate,parseModule} from '../src/model';
import {newProject,parseProject} from '../src/project';
import {estimate} from '../src/pricing';
import {nest} from '../src/exports';
import {LEGATO_CATALOG} from '../src/legatoCatalog';
import {legatoShelves,legatoLayout,legatoErrors,legatoPriceLines,INCLINED} from '../src/legato';
import {legatoModel} from '../src/legatoGeometry';
import {fastenerCounts} from '../src/model';
import {movePart,removePart,clearSection} from '../src/operations';

test('shoe shelf moves, removes and clears independently without ordinary shelf holders',()=>{
 const p=newProject(),a=p.modules[0];a.module=cabinet();const s=a.module.sections[0],pid=`legato:${s.id}:shoe1`;
 const empty=structuredClone(a.module);delete empty.sections[0].shoeShelves;
 assert.deepEqual(fastenerCounts(a.module),fastenerCounts(empty));
 assert.equal(movePart(p,a.id,s.id,pid,50).modules[0].module.sections[0].shoeShelves![0].y,350);
 assert.equal(removePart(p,a.id,s.id,pid).modules[0].module.sections[0].shoeShelves,undefined);
 assert.equal(clearSection(p,a.id,s.id).modules[0].module.sections[0].shoeShelves,undefined);
 assert.equal(s.shoeShelves![0].y,300);
});

function cabinet(article='180097',mount:'horizontal'|'inclined'='horizontal'){
 const m=initialModule();m.width=800;m.depth=600;m.height=2000;m.doors=false;m.sections=[section()];
 m.sections[0].shelves=[];m.sections[0].drawers=0;m.sections[0].rod=false;
 m.sections[0].shoeShelves=[{id:'shoe1',article,y:300,mount}];return m;
}
test('catalogue: all 18 sizes/colours have verified articles, public prices and sources',()=>{
 assert.equal(legatoShelves().length,18);
 assert.deepEqual([...new Set(legatoShelves().map(p=>p.depth))].sort((a,b)=>a-b),[230,300,350,400,450,500]);
 assert.equal(new Set(LEGATO_CATALOG.map(p=>p.article)).size,LEGATO_CATALOG.length);
 assert.ok(LEGATO_CATALOG.every(p=>p.price>0&&p.source.startsWith('https://www.allpremial.ru/')&&p.checked==='2026-11-05'));
});
for(const p of legatoShelves())for(const mount of (INCLINED[p.depth]?['horizontal','inclined']:['horizontal']) as ('horizontal'|'inclined')[])test(`${p.article} ${mount}: fits, exact cut step, save/open, bounded visual`,()=>{
 const m=cabinet(p.article,mount),s=m.sections[0],q=s.shoeShelves![0],a=legatoLayout(m,s,q)!;
 assert.deepEqual(validate(m),[]);assert.equal(a.w%25,0);assert.ok(a.w<=a.b.width);
 if(mount==='horizontal'){assert.ok(a.w<=a.b.width-20);assert.ok(a.w>=a.b.width-60);}
 const ps=parts(m),wire=ps.find(p=>p.legato)!;
 assert.equal(wire.material,'metal');assert.equal(wire.external,true);
 assert.deepEqual(parseModule(JSON.parse(JSON.stringify(m))).sections[0].shoeShelves,s.shoeShelves);
 const project=newProject();project.modules[0].module=m;
 assert.deepEqual(parseProject(JSON.parse(JSON.stringify(project))).modules[0].module.sections[0].shoeShelves,s.shoeShelves);
 const bounds=new THREE.Box3().setFromObject(legatoModel(wire)),v=new THREE.Vector3();bounds.getSize(v);
 assert.ok(v.x<=wire.size[0]+.01&&v.y<=wire.size[1]+.01&&v.z<=wire.size[2]+.01,JSON.stringify({v,size:wire.size}));
});
test('resize follows section width, retains height, rejects depth and height violations',()=>{
 const m=cabinet(),s=m.sections[0],q=s.shoeShelves![0],before=legatoLayout(m,s,q)!.w;
 m.width=600;assert.ok(legatoLayout(m,s,q)!.w<before);assert.equal(q.y,300);
 m.depth=200;assert.ok(legatoErrors(m).some(e=>e.includes('глубины')));
 m.depth=600;q.y=1990;assert.ok(legatoErrors(m).some(e=>e.includes('высоту')));
});
test('obstructions and duplicate shelves are rejected; malformed saved fields do not silently disappear',()=>{
 const m=cabinet(),s=m.sections[0],b=boxes(m)[0];s.shelves=[(320-b.bottom)/(b.top-b.bottom)];
 assert.ok(validate(m).some(e=>e.includes('ЛЕГАТО: пересечение')));
 s.shelves=[];s.shoeShelves!.push({...s.shoeShelves![0],id:'shoe2'});
 assert.ok(validate(m).some(e=>e.includes('ЛЕГАТО: пересечение')));
 assert.throws(()=>parseModule({...m,sections:[{...s,shoeShelves:[{id:'x',article:'unknown',y:300,mount:'horizontal'}]}]}));
});
test('unsupported inclined sizes and shaped cabinets explain refusal',()=>{
 const m=cabinet('180101','inclined');assert.ok(legatoErrors(m).length);
 const n=cabinet();n.skew={side:'left',depth:400};assert.ok(legatoErrors(n).length);
});
test('price uses complete blanks shared across modules, matching mounting kit; no sheet or markup double charge',()=>{
 const m=cabinet(),p=newProject();p.modules[0].module=m;
 const empty=structuredClone(p);delete empty.modules[0].module.sections[0].shoeShelves;
 const lines=legatoPriceLines([m]);assert.equal(lines.find(l=>l.id==='legato:180097')?.quantity,1);
 const accessories=lines.filter(l=>l.id!=='legato:180097');assert.equal(accessories.length,3);
 const e=estimate(p),base=estimate(empty),sum=lines.reduce((a,l)=>a+l.price*l.quantity,0);
 assert.equal(e.retailExtras-base.retailExtras,Math.round(sum));
 assert.ok(e.lines.filter(l=>l.id.startsWith('legato:')).every(l=>l.retail));
 assert.deepEqual(nest(p),nest(empty));
 const four=legatoPriceLines([m,m,m,m]);assert.equal(four.find(l=>l.id==='legato:180097')?.quantity,1);
 const five=legatoPriceLines([m,m,m,m,m]);assert.equal(five.find(l=>l.id==='legato:180097')?.quantity,2);
});
test('legacy projects keep exact parts and estimate with absent or empty shoe array',()=>{
 const p=newProject(),before=parts(p.modules[0].module),price=estimate(p);p.modules[0].module.sections.forEach(s=>s.shoeShelves=[]);
 assert.deepEqual(parts(p.modules[0].module),before);assert.deepEqual(estimate(p),price);
});
