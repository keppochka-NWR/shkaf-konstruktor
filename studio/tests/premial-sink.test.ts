import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {initialModule,parts,validate} from '../src/model';
import {kitchenWorktop,kitchenBase} from '../src/kitchen';
import {applyAutoFillers,parseProject,newProject} from '../src/project';
import {worktopGeometry} from '../src/boardGeometry';
import {premialSinkModel} from '../src/premialSinkGeometry';
import {sinkChecks} from '../src/sinkChecks';
const top=()=>{const m=kitchenWorktop(initialModule(),1600);m.worktop!.cutouts=[{kind:'sink',x:120,z:150,width:560,depth:360,fixture:'210245',drainDrop:420}];return m;};
test('sink selection, displaced cutout and drain survive save/load; bad sizes and overlap rejected',()=>{
 const m=top();assert.deepEqual(validate(m),[]);
 assert.deepEqual(parseProject(JSON.parse(JSON.stringify(newProject(m)))).modules[0].module.worktop,m.worktop);
 for(const bad of [{width:NaN},{depth:-1},{fixture:'unknown'},{drainDrop:Infinity},{z:1},{width:500},{kind:'hob'}]){const n=structuredClone(m);Object.assign(n.worktop!.cutouts[0],bad);assert.ok(validate(n).length,JSON.stringify(bad));}
 const n=structuredClone(m);n.worktop!.cutouts.push({...n.worktop!.cutouts[0],x:500});assert.ok(validate(n).some(e=>e.includes('перемычку')));
});
test('off-centre cutout really pierces the slab while remaining material is solid',()=>{
 const m=top(),p=parts(m)[0],g=worktopGeometry(p),mesh=new THREE.Mesh(g,new THREE.MeshBasicMaterial({side:THREE.FrontSide}));mesh.updateMatrixWorld();
 const hit=(x:number,z:number)=>new THREE.Raycaster(new THREE.Vector3(x-m.width/2,100,z-m.depth/2),new THREE.Vector3(0,-1,0)).intersectObject(mesh).length;
 assert.equal(hit(400,330),0);assert.ok(hit(1200,330));assert.ok(hit(400,80));assert.ok(!parts(m).some(p=>p.id.startsWith('worktop-cut:')));
 g.computeBoundingBox();assert.deepEqual(g.boundingBox!.getSize(new THREE.Vector3()).toArray(),[1600,38,600]);
});
test('sink matches official 600x450 envelope and bowl depth, finite outward geometry',()=>{
 const model=premialSinkModel(),b=new THREE.Box3().setFromObject(model),v=b.getSize(new THREE.Vector3());
 assert.deepEqual(v.toArray(),[600,223,450]);
 model.traverse(o=>{if(!(o instanceof THREE.Mesh))return;assert.equal(o.material.side,THREE.FrontSide);const pos=o.geometry.getAttribute('position');for(const v of pos.array)assert.ok(Number.isFinite(v));});
});
test('sink check finds shelves and side panels, accepts an empty sink cabinet',()=>{
 const m=top(),base=kitchenBase(initialModule(),800,'sink');base.rails=[];
 const p=newProject(base);p.room.width=5000;p.room.depth=4000;p.modules=[{id:'b',module:base,x:0,z:0,y:0},{id:'t',module:m,x:0,z:0,y:820}];
 assert.ok(!sinkChecks(p).some(w=>w.message.includes('пересекает')));
 base.sections[0].shelves=[.75];assert.ok(sinkChecks(p).some(w=>w.message.includes('пересекает')));
 base.sections[0].shelves=[];m.worktop!.cutouts[0].x=550;assert.ok(sinkChecks(p).some(w=>w.message.includes('пересекает')));
});


test('manual filler setting survives load and preserves an exact 6 mm wall clearance',()=>{
 const m=kitchenBase(initialModule(),800,'sink');m.autoFillersOff=true;
 const p=newProject(m);p.modules[0].x=6;
 const q=applyAutoFillers(parseProject(JSON.parse(JSON.stringify(p))));
 assert.equal(q.modules[0].x,6);assert.equal(q.modules[0].module.wallFiller,undefined);
});
test('sink meshes have closed welded edges, including rim holes and bowl outlet',()=>{
 premialSinkModel().traverse(o=>{if(!(o instanceof THREE.Mesh))return;const g=o.geometry.toNonIndexed? (o.geometry.index?o.geometry.toNonIndexed():o.geometry):o.geometry,p=g.getAttribute('position'),edges=new Map<string,number>();
 const key=(i:number)=>[p.getX(i),p.getY(i),p.getZ(i)].map(v=>Math.round(v*1000)).join(',');
 for(let i=0;i<p.count;i+=3){const v=[key(i),key(i+1),key(i+2)];for(let j=0;j<3;j++){const e=[v[j],v[(j+1)%3]].sort().join('|');edges.set(e,(edges.get(e)??0)+1);}}
 assert.ok([...edges.values()].every(n=>n===2),o.geometry.type);
 });
});

test('rotated sink checks use room coordinates',()=>{
 const m=top(),base=kitchenBase(initialModule(),800,'sink');base.rails=[];
 const p=newProject(base);p.room.width=5000;p.room.depth=4000;p.modules=[{id:'b',module:base,x:0,z:800,y:0,rotation:90},{id:'t',module:m,x:0,z:0,y:820,rotation:90}];
 assert.ok(!sinkChecks(p).some(w=>w.message.includes('пересекает')));
 base.sections[0].shelves=[.75];assert.ok(sinkChecks(p).some(w=>w.message.includes('пересекает')));
});
