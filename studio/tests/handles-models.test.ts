import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {HANDLES,handleById,handleSpec,handleFinish,handleShape,HANDLE_FINISHES,LONG_HANDLE} from '../src/handles';
import {handleGeometries,handleModel} from '../src/handleModels';
import {initialModule,parts,validate,parseModule,RULES,doorHandleCenter,doorHandleFloorInfo,setDoorHandleFloor} from '../src/model';
import {mirrorModule} from '../src/operations';
import {newProject} from '../src/project';

const box=(gs:THREE.BufferGeometry[])=>{const b=new THREE.Box3();for(const g of gs){g.computeBoundingBox();b.union(g.boundingBox!);}return b;};

test('каждая ручка каталога получает процедурную модель с межосевым из каталога и металлом по покрытию',()=>{
 for(const h of HANDLES){
  const s=handleSpec(h);assert.equal(s.cc,h.len,h.label);assert.ok(s.total>=Math.min(s.cc,s.total)&&s.projection>0,h.label);
  const b=box(handleGeometries(s));
  assert.ok(Math.abs(b.max.z-s.projection)<0.6,h.label+' вынос '+b.max.z);
  if(s.shape!=='knob')assert.ok(Math.abs((b.max.x-b.min.x)-s.total)<0.6,h.label+' длина '+(b.max.x-b.min.x));
  const model=handleModel(h);let meshes=0;model.traverse(o=>{if(o instanceof THREE.Mesh){meshes++;assert.ok(o.material instanceof THREE.MeshStandardMaterial);}});assert.ok(meshes>0);
 }
});

test('скоба и рейлинг стоят на двух ножках с реальным межосевым, торцевая охватывает край фасада',()=>{
 for(const id of ['uz819-128','lm86923511','lm89433451']){
  const h=handleById(id),s=handleSpec(h),[bar,...legs]=handleGeometries(s);void bar;
  const centres=legs.map(g=>{g.computeBoundingBox();const c=new THREE.Vector3();g.boundingBox!.getCenter(c);return c;}).filter(c=>Math.abs(c.x)>1);
  const xs=[...new Set(centres.map(c=>Math.round(c.x)))].sort((a,b)=>a-b);
  assert.deepEqual(xs,[-h.len/2,h.len/2],h.label);
  for(const g of legs){g.computeBoundingBox();assert.ok(g.boundingBox!.min.z>=-0.01,'ножка от лица фасада');}
 }
 const edge=handleById('fp527-160');assert.equal(handleShape(edge),'edge');
 const b=box(handleGeometries(handleSpec(edge),18));assert.ok(b.min.z<=-18+0.01,'полка на торце на толщину фасада');assert.ok(b.min.y<-2,'за кромкой');assert.ok(b.max.y>10,'губка над лицом');
 assert.equal(handleShape(handleById('hexa1200b')),'edge');assert.equal(handleSpec(handleById('hexa1200b')).total,1200);
 assert.equal(handleSpec(handleById('hexa160b')).facets,6,'HEXA — шестигранная');
});

test('покрытие → PBR: хром блестит, сатин матовее, чёрный не металл-зеркало, золото',()=>{
 assert.equal(handleFinish({label:'Ritiro · 128 · хром'}),'chrome');
 assert.equal(handleFinish({label:'Trodos 2063 · 192 · хром мат'}),'satin');
 assert.equal(handleFinish({label:'RS006SN · 160 · матовый никель'}),'satin');
 assert.equal(handleFinish({label:'Скоба C-29 · 128 · матовый чёрный'}),'black');
 assert.equal(handleFinish({label:'Ritiro · 96 · матовое золото'}),'gold');
 assert.equal(handleFinish({label:'HEXA · 256 · алюминий'}),'aluminium');
 assert.ok(HANDLE_FINISHES.chrome.roughness<HANDLE_FINISHES.satin.roughness);
 assert.equal(HANDLE_FINISHES.chrome.metalness,1);assert.equal(HANDLE_FINISHES.wood.metalness,0);
});

const tall=()=>{const m=initialModule();m.height=2000;m.doors=true;m.sections=[m.sections[0]];m.width=500;return m;};
const doorAndHandle=(m:ReturnType<typeof initialModule>)=>{const p=parts(m),d=p.find(x=>x.role==='door')!,h=p.find(x=>x.id===d.id.replace(':door:',':handle:'))!;return {d,h,y0:d.position[1]-d.size[1]/2,y1:d.position[1]+d.size[1]/2};};

test('обычная ручка без поля — по центру фасада, как раньше; с полем — центр на высоте от пола',()=>{
 const m=tall(),{d,h,y0,y1}=doorAndHandle(m);
 assert.equal(h.position[1],d.position[1]);assert.ok(handleById(m.handleId).len<LONG_HANDLE);
 setDoorHandleFloor(m,d.id,1000);assert.deepEqual(validate(m),[]);
 assert.equal(doorAndHandle(m).h.position[1],1000);
 setDoorHandleFloor(m,d.id,20);const hl=handleById(m.handleId).len;
 assert.equal(doorAndHandle(m).h.position[1],y0+RULES.handleEdge+hl/2,'ниже двери — прижата к низу с отступом 50');
 setDoorHandleFloor(m,d.id,5000);assert.equal(doorAndHandle(m).h.position[1],y1-RULES.handleEdge-hl/2);
 setDoorHandleFloor(m,d.id,null);assert.equal(m.sections[0].handleFloor,undefined);assert.equal(doorAndHandle(m).h.position[1],d.position[1]);
});

test('ручка 1200 ставится от пола: низ на 100 мм, не ниже низа двери + 50; поле задаёт низ',()=>{
 const m=tall();m.handleId='hexa1200b';m.sections[0].hingeSide='left';
 const {h,y0}=doorAndHandle(m);
 assert.equal(h.position[1]-1200/2,Math.max(RULES.longHandleFloor,y0+RULES.handleEdge));
 const info=doorHandleFloorInfo(m,m.sections[0].id+':door:0')!;assert.equal(info.long,true);assert.equal(info.set,false);assert.equal(info.value,Math.round(h.position[1]-600));
 setDoorHandleFloor(m,m.sections[0].id+':door:0',400);assert.equal(doorAndHandle(m).h.position[1]-600,400);
 setDoorHandleFloor(m,m.sections[0].id+':door:0',1500);const r=doorAndHandle(m);assert.equal(r.h.position[1]+600,r.y1-RULES.handleEdge,'не помещается — прижата к верху с отступом 50');
 // рейлинг 1200 Лемана — то же правило
 const n=tall();n.handleId='lm89433451';const q=doorAndHandle(n);assert.equal(q.h.position[1]-600,Math.max(RULES.longHandleFloor,q.y0+RULES.handleEdge));
 // дверь короче ручки с отступами — по центру
 assert.equal(doorHandleCenter({},0,100,1200,1200),650);
});

test('высота ручки от пола сохраняется и загружается, неверное значение — ошибка проверки, зеркало меняет створки',()=>{
 const m=tall();m.width=1000;m.sections[0].doorLeaves=2;setDoorHandleFloor(m,m.sections[0].id+':door:1',900);
 const back=parseModule(JSON.parse(JSON.stringify(m)));assert.deepEqual(back.sections[0].handleFloor,[null,900,null,null]);assert.deepEqual(parts(back),parts(m));
 const bad=structuredClone(m);bad.sections[0].handleFloor=[-5 as number];assert.ok(validate(bad).some(e=>e.includes('высота ручки')));
 const old=tall();assert.equal(JSON.stringify(old).includes('handleFloor'),false,'старый проект без поля не получает его');
 const proj=newProject(structuredClone(m)),mid=proj.modules[0].id;
 const mir=mirrorModule(proj,mid).modules[0].module;assert.deepEqual(mir.sections[0].handleFloor,[900,null,null,null]);
});
