import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {HANDLES,handleById,handleSpec,handleShape,handleFormSource,handleKind,HANDLE_SHAPE_LABELS} from '../src/handles';
import {handleGeometries,handleModel} from '../src/handleModels';
import {initialModule,parts,handlePosIssue,setDoorHandlePos} from '../src/model';

const box=(gs:THREE.BufferGeometry[])=>{const b=new THREE.Box3();for(const g of gs){g.computeBoundingBox();b.union(g.boundingBox!);}return b;};

test('форма каждой ручки каталога (цех и Лемана) распознана по названию; нераспознанных нет',()=>{
 const unknown=HANDLES.filter(h=>handleFormSource(h)==='default').map(h=>h.label);
 const bySeries=HANDLES.filter(h=>handleFormSource(h)==='series').map(h=>h.label+' → '+HANDLE_SHAPE_LABELS[handleShape(h)]);
 console.log('Форма по серии (в названии нет слова-типа): '+bySeries.length+'\n  '+bySeries.join('\n  '));
 assert.deepEqual(unknown,[],'нераспознанные: '+unknown.join('; '));
 const lemana=HANDLES.filter(h=>h.vendor==='lemana'),count=(s:string)=>lemana.filter(h=>handleShape(h)===s).length;
 console.log('Лемана по формам: '+Object.keys(HANDLE_SHAPE_LABELS).map(s=>HANDLE_SHAPE_LABELS[s as keyof typeof HANDLE_SHAPE_LABELS]+' '+count(s)).join(', '));
 assert.ok(count('rail')>=10&&count('profile')>=8&&count('arch')>=3&&count('bracket')>=20);
});

test('габариты модели по данным: длина = межосевое + концы, вынос по типу, у скоб и рейлингов ножки на межосевом',()=>{
 for(const h of HANDLES){
  const s=handleSpec(h),b=box(handleGeometries(s,16)),L=b.max.x-b.min.x;
  assert.ok(Math.abs(L-s.total)<0.6,h.label+' длина модели '+L.toFixed(1)+' ≠ '+s.total);
  assert.ok(s.total-s.cc>=0&&s.total-s.cc<=80,h.label+' концы '+(s.total-s.cc));
  assert.ok(s.projection>=15&&s.projection<=40&&Math.abs(b.max.z-s.projection)<0.6,h.label+' вынос '+b.max.z.toFixed(1));
  assert.ok(b.min.x>=-s.total/2-0.6&&b.max.x<=s.total/2+0.6,h.label+' по центру межосевого');
 }
});

test('дуговая скоба (классическая бронза): дуга от розетки к розетке на межосевом, вершина на выносе',()=>{
 const arch=HANDLES.filter(h=>handleShape(h)==='arch');
 assert.deepEqual(arch.map(h=>h.id).sort(),['lm18238447','lm86924105','lm86924106'].sort(),'Эра Ницца, 6802 античная бронза 96 и 128');
 for(const h of arch){
  const s=handleSpec(h),[tube,...roses]=handleGeometries(s);
  const xs=roses.map(g=>{g.computeBoundingBox();return Math.round((g.boundingBox!.min.x+g.boundingBox!.max.x)/2);}).sort((a,b)=>a-b);
  assert.deepEqual(xs,[-h.len/2,h.len/2],h.label);
  tube.computeBoundingBox();assert.ok(tube.boundingBox!.min.z>-0.6,'дуга не уходит в фасад');assert.ok(Math.abs(tube.boundingBox!.max.z-s.projection)<0.6);
  assert.equal(handleKind(h),'bracket','место на фасаде — как у скобы');
 }
});

test('двухцветная «белая/хром», «чёрный/хром»: штанга своим цветом, ножки хром; остальные — одним материалом',()=>{
 for(const id of ['lm89443708','lm89445010']){
  const h=handleById(id),s=handleSpec(h);assert.equal(s.legFinish,'chrome',h.label);
  const mats=new Set<THREE.Material>();handleModel(h).traverse(o=>{if(o instanceof THREE.Mesh)mats.add(o.material as THREE.Material);});
  assert.equal(mats.size,2,h.label);
 }
 assert.equal(handleSpec(handleById('lm89443708')).finish,'white');assert.equal(handleSpec(handleById('lm89445010')).finish,'black');
 assert.equal(HANDLES.filter(h=>handleSpec(h).legFinish).length,2);
});

/** Прямоугольник модели ручки на плоскости фасада — тем же поворотом, что в Scene.tsx (X вдоль, +Y к центру фасада). */
function footprint(part:{position:number[];size:number[]},face:{position:number[];size:number[]},b:THREE.Box3){
 const vertical=part.size[1]>part.size[0],dx=face.position[0]-part.position[0],dy=face.position[1]-part.position[1];
 const a=vertical?(dx>0.5?-Math.PI/2:Math.PI/2):(dy<-0.5?Math.PI:0),c=Math.cos(a),s=Math.sin(a);
 let x0=Infinity,x1=-Infinity,y0=Infinity,y1=-Infinity;
 for(const x of [b.min.x,b.max.x])for(const y of [b.min.y,b.max.y]){const X=part.position[0]+x*c-y*s,Y=part.position[1]+x*s+y*c;x0=Math.min(x0,X);x1=Math.max(x1,X);y0=Math.min(y0,Y);y1=Math.max(y1,Y);}
 return {x0,x1,y0,y1};
}
const tall=(id:string)=>{const m=initialModule();m.height=2000;m.doors=true;m.sections=[m.sections[0]];m.width=500;m.handleId=id;m.sections[0].hingeSide='left';return m;};

test('каждая ручка на распашном фасаде (вертикально у кромки и горизонтально снизу, где помещается) не выходит за фасад',()=>{
 let checked=0;const skipped:string[]=[];
 for(const h of HANDLES){
  const m=tall(h.id),door=parts(m).find(p=>p.role==='door')!;
  const cases:[string,typeof m][]=[['вертикально',m]];
  if(!handlePosIssue(m,door.id,'bottomCenter')){const n=structuredClone(m);setDoorHandlePos(n,door.id,'bottomCenter');cases.push(['снизу по центру',n]);}else skipped.push(h.label);
  for(const [name,mm] of cases){
   const list=parts(mm),d=list.find(p=>p.id===door.id)!,hp=list.find(p=>p.id===door.id.replace(':door:',':handle:'))!;
   const f=footprint(hp,d,box(handleGeometries(handleSpec(h),d.size[2]))),tol=handleShape(h)==='edge'?4.6:0.6; // торцевая охватывает торец фасада
   const fx0=d.position[0]-d.size[0]/2,fx1=d.position[0]+d.size[0]/2,fy0=d.position[1]-d.size[1]/2,fy1=d.position[1]+d.size[1]/2;
   assert.ok(f.x0>=fx0-tol&&f.x1<=fx1+tol&&f.y0>=fy0-tol&&f.y1<=fy1+tol,`${h.label} (${name}): ручка ${JSON.stringify(f)} за фасадом ${JSON.stringify({fx0,fx1,fy0,fy1})}`);
   checked++;
  }
 }
 console.log('проверено положений: '+checked+'; горизонтально не помещаются на фасаде 496 мм: '+skipped.join(', '));
 assert.equal(checked,HANDLES.length*2-skipped.length);assert.ok(skipped.every(l=>handleById(HANDLES.find(h=>h.label===l)!.id).len+40>496),'горизонтально пропущены только длиннее фасада');
});
