import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync,readFileSync} from 'node:fs';
import {initialModule,parts,facadeTop,parseModule,type Module} from '../src/model';
import {kitchenBase} from '../src/kitchen';
import {newProject,parseProject} from '../src/project';
import {estimate} from '../src/pricing';
import {labelData} from '../src/exports';
import {golaSideGeometry} from '../src/boardGeometry';
import {golaFromContour,moduleFromEtalon} from '../scripts/kitchen/fromEtalon';
import {compareModule,type RefModule} from '../scripts/kitchen/compare';
import {partCollisions} from '../src/collisions';

// k06/m03 Базиса: боковина 704×557, вырезы 27 мм — средний y 417,5–490,5 (R5), верхний y 762,5–820 (R6,5) при верхе 820.
const K06_CUTS=[{top0:0,top1:57.5,depth:27,r:6.5},{top0:329.5,top1:402.5,depth:27,r:5}];
const gola=(cuts=K06_CUTS)=>{const m=kitchenBase(initialModule(),600,'doors');m.edgeScheme={t:0.5};m.gola={cuts:cuts.map(c=>({...c}))};return m;};
const side=(m:Module)=>parts(m).find(p=>p.id==='left')!;

test('Gola k06/m03: cutouts in both sides, edge by contour segments as in Bazis (front = height − cuts, top = depth − open cut)',()=>{
  const m=gola(),l=side(m),r=parts(m).find(p=>p.id==='right')!;
  assert.equal(l.golaCuts?.length,2);assert.equal(r.golaCuts?.length,2);
  assert.equal(l.edgeLen!['+z'],Math.round((l.size[1]-57.5-73)*10)/10);
  assert.equal(l.edgeLen!['+y'],l.size[2]-27);
});

test('Gola: estimate counts edge by contour, labels show contour lengths; cutting stays by bounding box',()=>{
  const plain=kitchenBase(initialModule(),600,'doors');plain.edgeScheme={t:0.5};
  const m=gola();
  const e0=estimate(newProject(plain)).lines.find(x=>x.id==='edge05')!,e1=estimate(newProject(m)).lines.find(x=>x.id==='edge05')!;
  assert.ok(Math.abs((e0.quantity-e1.quantity)-2*(57.5+73+27)/1000)<0.002,`кромка 0,5 меньше на вырезы: ${e0.quantity} → ${e1.quantity}`);
  const lab=labelData(newProject(m)).find(x=>x.name==='Боковина левая')!;
  assert.ok(lab.edgeLens,'на бирке длины кромки по контуру');
  assert.equal(lab.length,Math.round(side(m).length),'раскрой — по габариту');
});

test('Gola: side geometry keeps the bounding box of the part and has the cutouts',()=>{
  const l=side(gola()),g=golaSideGeometry(l);g.computeBoundingBox();
  const b=g.boundingBox!,sz=[b.max.x-b.min.x,b.max.y-b.min.y,b.max.z-b.min.z];
  sz.forEach((v,i)=>assert.ok(Math.abs(v-l.size[i])<0.01,`ось ${i}: ${v} vs ${l.size[i]}`));
  // в вершинах есть точки на дне выреза (z = перед − 27)
  const pos=g.getAttribute('position');let inCut=false;
  for(let i=0;i<pos.count;i++)if(Math.abs(pos.getZ(i)-(l.size[2]/2-27))<0.01)inCut=true;
  assert.ok(inCut);
});

test('Gola: facades drop below the top by faceTop; wardrobes and wall units ignore gola',()=>{
  const m=gola();m.gola!.faceTop=30;
  assert.equal(facadeTop(m),m.height-30);
  const w={...initialModule(),gola:{cuts:K06_CUTS}} as Module;
  assert.ok(!parts(w).some(p=>p.golaCuts),'шкаф студии без вырезов');
});

test('Gola recognizer: cuts from the Bazis side contour (k06/m03)',()=>{
  const arc=(y0:number,z0:number,r:number,up:boolean)=>Array.from({length:9},(_,k)=>{const a=Math.PI/2*k/8;return [up?y0+r-r*Math.cos(a):y0-r+r*Math.sin(a), z0+r-r*Math.sin(a)] as [number,number];});
  const c:[number,number][]=[[116,3],[116,560],[417.5,560],[417.5,538],...arc(417.5,533,5,true).slice(1),[485.5,533],[490.5,538],[490.5,560],[762.5,560],[762.5,539.5],[769,533],[820,533],[820,3]];
  const g=golaFromContour({contour:c,contourPlane:'yz'},820,560);
  assert.equal(g.length,2);
  assert.deepEqual(g.map(x=>[x.top0,x.top1,x.depth,x.r]),[[0,57.5,27,6.5],[329.5,402.5,27,5]]);
});

test('Gola profiles: L on top, C in the middle, aluminium outside the cut list, estimate in metres without price, no collisions',()=>{
  const m=gola(),ps=parts(m),prof=ps.filter(p=>p.id.startsWith('gola:'));
  assert.deepEqual(prof.map(p=>p.id).sort(),['gola:C:1','gola:L:0']);
  assert.ok(prof.every(p=>p.material==='alu'&&p.external&&p.size[0]===m.width));
  const e=estimate(newProject(m)).lines.filter(l=>l.id.startsWith('gola-'));
  assert.equal(e.length,2);assert.ok(e.every(l=>l.unit==='м'&&l.unitPrice===null&&Math.abs(l.quantity-m.width/1000)<1e-9));
  assert.ok(!labelData(newProject(m)).some(l=>/Gola/.test(l.name)),'профиль не идёт в бирки');
  // боковины — телом без вырезов (collide): профиль в вырезе их не задевает; фасады и петли — тоже (царги и полки у модулей Базиса стоят за вырезом)
  const c=partCollisions(ps,m).filter(x=>[x.a,x.b].some(id=>id.startsWith('gola:'))&&[x.a,x.b].some(id=>id==='left'||id==='right'||/door|facade|hinge/.test(id)));
  assert.deepEqual(c,[],JSON.stringify(c));
});
test('Gola: открытие проекта в приложении (parseProject) сохраняет gola — детали, фасады и смета те же, что до сохранения',()=>{
  const m=gola();m.gola!.faceTop=28.5;m.gola!.cuts[0].edged=true;
  const p=newProject(m),q=parseProject(JSON.parse(JSON.stringify(p))),n=q.modules[0].module;
  assert.deepEqual(n.gola,m.gola,'gola в модуле после открытия');
  assert.equal(facadeTop(n),facadeTop(m),'верх фасадов под профилем L');
  assert.deepEqual(parts(n),parts(m),'детали (фасады, петли, вырезы, профили) те же');
  assert.deepEqual(estimate(q).lines,estimate(p).lines,'смета та же (профиль Gola, фасады, кромка)');
  assert.equal(parseModule(JSON.parse(JSON.stringify({...m,gola:undefined}))).gola,undefined,'без Gola — без поля');
});

// k30/m11, k06/m03, k27/m15 — модули Базиса с Gola: сверка с Базисом и до, и после открытия проекта
const ETD='C:/Users/My PC/Desktop/Claude Project/Кухни/etalon/';
for(const [k,key] of [['k30','m11'],['k06','m03'],['k27','m15']] as const)
  test(`Gola ${k}/${key}: после parseProject модуль сходится с Базисом (фасад, петли)`,{skip:!existsSync(ETD+k+'.json')},()=>{
    const ref=(JSON.parse(readFileSync(ETD+k+'.json','utf8')).modules as RefModule[]).find(x=>x.key===key)!;
    const m=moduleFromEtalon(ref).module;assert.ok(m.gola,'распознан Gola');
    assert.ok(compareModule(ref,m).pass,'модуль распознавателя сходится');
    const n=parseProject(JSON.parse(JSON.stringify(newProject(m)))).modules[0].module;
    const c=compareModule(ref,n);assert.ok(c.pass,'после открытия в приложении: '+JSON.stringify(c).slice(0,300));
  });
