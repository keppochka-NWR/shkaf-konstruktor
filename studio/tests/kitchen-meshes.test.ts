import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync,readFileSync} from 'node:fs';
import {initialModule,parts,parseModule} from '../src/model';
import {kitchenBase} from '../src/kitchen';
import {moduleFromEtalon} from '../scripts/kitchen/fromEtalon';
import {compareModule,type RefModule} from '../scripts/kitchen/compare';

// Модели фурнитуры как в Базисе: левые опоры и клипсы — своя сетка и поворот (критик n3-runners, minor 1–2).
const ETD='C:/Users/My PC/Desktop/Claude Project/Кухни/etalon/';
const ref=(k:string,key:string)=>(JSON.parse(readFileSync(ETD+k+'.json','utf8')).modules as RefModule[]).find(x=>x.key===key)!;
const mesh=(f?:string)=>f?.split('/').pop()?.replace('.glb','');

test('kitchen legs: left half — Bazis left leg cb84c30b57a5 / clip 7ebcad9fda10 turned 180° about the vertical, right — ac675db9fc57 / 0d12888fb9df; same flag keeps one model',()=>{
  const m=kitchenBase(initialModule(),600,'drawers' as never),ps=parts(m),legs=ps.filter(p=>p.id.startsWith('leg:'));
  assert.equal(legs.length,4);
  for(const l of legs){const left=l.model!.origin![0]<300;assert.equal(mesh(l.model!.file),left?'cb84c30b57a5':'ac675db9fc57');assert.deepEqual(l.model!.quat,left?[0.5,0.5,0.5,-0.5]:[0.5,0.5,-0.5,0.5]);}
  for(const c of ps.filter(p=>p.id.startsWith('kitchen-clip:'))){const left=c.model!.origin![0]<300;assert.equal(mesh(c.model!.file),left?'7ebcad9fda10':'0d12888fb9df');}
  const legsSize=legs.map(l=>l.size.join());assert.ok(legsSize.every(s=>s===legsSize[0]),'same envelope for collisions');
  const s={...m,kitchen:{...m.kitchen!,legs:{back:70,front:70,same:true as const}}};
  assert.ok(parts(s).filter(p=>p.id.startsWith('leg:')).every(p=>mesh(p.model!.file)==='ac675db9fc57'));
  assert.equal(parseModule(JSON.parse(JSON.stringify(s)))!.kitchen!.legs!.same,true);
});

test('compare reports model/rotation differences for reference (k04 m01 none; k27 m01 left legs like the right ones in Bazis — none; k16 m05 mirrored Indigo — mirrored meshes as in Bazis, PASS unchanged)',{skip:!existsSync(ETD+'k04.json')},()=>{
  for(const [k,key] of [['k04','m01'],['k27','m01'],['k14','m10']] as const){
    const r=ref(k,key),{module:m}=moduleFromEtalon(r),c=compareModule(r,m);assert.ok(c.pass,k+key);
    assert.deepEqual(c.hardware.filter(h=>h.meshDiff||h.quatDiff).map(h=>h.category),[],k+key);
  }
  assert.equal(moduleFromEtalon(ref('k27','m01')).module.kitchen!.legs!.same,true);
  const r=ref('k16','m05'),{module:m}=moduleFromEtalon(r),c=compareModule(r,m);
  // зеркальный модуль Indigo: сетки зеркального набора Базиса (n4-drawers) — расхождений сетки больше нет
  assert.ok(c.pass);assert.deepEqual(c.hardware.filter(h=>(h.category==='направляющая'||h.category==='ящик-система')&&h.meshDiff).map(h=>h.category),[]);
});
