import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {kitchenTemplate} from '../src/kitchenProject';
import {ovenErrors,ovenParts,configureOven,ovenLayoutWarnings,ovenSupportTop} from '../src/kitchenOven';
import {OVEN} from '../src/ovenDimensions';
import {ovenModel} from '../src/ovenGeometry';
import {APPLIANCES} from '../src/kitchen';
import {parseModule} from '../src/model';
const base=()=>kitchenTemplate('oven',600,{decor:'Белый',facadeDecor:'Белый'});
test('Bosch base niche uses under-worktop diagram, not tall-unit range',()=>{
 for(const h of [600,604]){const m=base();configureOven(m,{nicheHeight:h,drawer:false});assert.deepEqual(ovenErrors(m),[]);}
 for(const h of [575,597,599,605,NaN]){const m=base();m.kitchen!.oven!.nicheHeight=h;assert.ok(ovenErrors(m).some(e=>e.includes('Высота ниши')));}
 for(const [w,valid] of [[592,true],[600,true],[591,false],[608,false]] as const){const m=base();m.width=w;assert.equal(ovenErrors(m).some(e=>e.includes('ширина ниши')),!valid);}
 assert.deepEqual(APPLIANCES.oven.niche,[560,600,550]);
});
test('oven render, part and collision bodies share insertion plane and declared envelope',()=>{
 const m=base(),p=ovenParts(m).find(p=>p.id==='layout-oven')!;
 const mesh=ovenModel();mesh.position.set(...p.position);const box=new THREE.Box3().setFromObject(mesh);
 assert.deepEqual(box.getSize(new THREE.Vector3()).toArray(),p.size);
 assert.equal(box.min.z,m.depth-548);assert.equal(box.max.z,m.depth+20+50);
 assert.equal(box.min.y,ovenSupportTop(m)-8);
 for(const c of p.collide!){for(let a=0;a<3;a++){assert.ok(c.position[a]-c.size[a]/2>=box.min.getComponent(a)-.01);assert.ok(c.position[a]+c.size[a]/2<=box.max.getComponent(a)+.01);}}
});
test('old front heights stay loadable and visibly flagged; explicit refit clears overlap',()=>{
 const m=base();m.kdrawers![0].y1=ovenSupportTop(m)-1.5;
 const p=parseModule(JSON.parse(JSON.stringify(m)));assert.equal(p.kdrawers![0].y1,m.kdrawers![0].y1);
 assert.equal(ovenLayoutWarnings(p).length,1);configureOven(p);assert.deepEqual(ovenLayoutWarnings(p),[]);
 assert.ok(p.kdrawers![0].y1<=ovenSupportTop(p)-OVEN.frontBelowSupport);
});
