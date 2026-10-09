import test from 'node:test';
import assert from 'node:assert/strict';
import {initialModule} from '../src/model';
import {kitchenBase,kitchenWall} from '../src/kitchen';
import {compareModule,refFromStudio,honestPass,sameTurn} from '../scripts/kitchen/compare';

test('comparator self-check: a module against itself passes',()=>{
  for(const m of [kitchenBase(initialModule(),600),kitchenWall(initialModule(),800),kitchenBase(initialModule(),800,'sink')]){
    const c=compareModule(refFromStudio(m),m);
    assert.ok(c.pass,m.name+': '+JSON.stringify({missing:c.missing.map(x=>x.name),extra:c.extra.map(x=>x.name),worst:c.pairs.filter(p=>p.delta>0.5).map(p=>p.ref.name+' '+p.delta)}));
  }
});

test('сверщик видит фигурную деталь Базиса: вырез в контуре при прямоугольнике студии — FAIL; прямоугольный контур и скругления — нет',()=>{
  const m=kitchenWall(initialModule(),600),ref=refFromStudio(m);
  assert.ok(compareModule(ref,m).pass);
  const side=ref.panels.find(p=>p.axis==='x')!,[,y0,z0,,y1,z1]=side.box,H=y1-y0,D=z1-z0;
  const cut=structuredClone(ref),cs=cut.panels.find(p=>p.i===side.i)!;
  // вырез 100×20 в заднем верхнем углу, как у боковин k32 (точки [y, z] в плоскости yz)
  Object.assign(cs,{figure:true,contourPlane:'yz',contour:[[0,0],[0,D],[H,D],[H,20],[H-100,20],[H-100,0]]});
  const c=compareModule(cut,m);
  assert.equal(c.pass,false);assert.equal(c.contours?.length,1);assert.match(c.contours![0],/вырез 2000 мм²/);
  const rect=structuredClone(ref);Object.assign(rect.panels.find(p=>p.i===side.i)!,{figure:true,contourPlane:'yz',contour:[[0,0],[0,D],[H,D],[H,0]]});
  assert.ok(compareModule(rect,m).pass,'прямоугольный контур — не вырез');
  const round=structuredClone(ref);Object.assign(round.panels.find(p=>p.i===side.i)!,{figure:true,contourPlane:'yz',contour:[[0,0],[0,D],[H-10,D],[H,D-10],[H,0]]});
  assert.ok(compareModule(round,m).pass,'срез угла 10×10 (50 мм²) — не вырез');
});

test('честный PASS: совпавшая сверка не делает модуль параметрическим, если у студии ошибки или распознаватель что-то не поддержал',()=>{
  assert.equal(honestPass({pass:true},[],[]),true);
  assert.equal(honestPass({pass:true},[],['1 панелей не распознано']),false);
  assert.equal(honestPass({pass:true},['Параметр faceGap: 0–5 мм.'],[]),false);
  assert.equal(honestPass({pass:false},[],[]),false);
});

test('comparator catches mutations: 1 mm shift, missing panel, extra hinge, moved leg, mirrored layout',()=>{
  const m=kitchenBase(initialModule(),600),ref=refFromStudio(m);
  const shifted=structuredClone(ref);shifted.panels[0].box=shifted.panels[0].box.map((v,i)=>i===0||i===3?v+1:v);
  assert.equal(compareModule(shifted,m).pass,false,'1 mm shift fails');
  assert.ok(compareModule(shifted,m).pairs.some(p=>p.delta===1));
  const missing=structuredClone(ref);missing.panels.splice(1,1);
  const cm=compareModule(missing,m);assert.equal(cm.pass,false);assert.equal(cm.extra.length,1,'studio has a panel Bazis does not');
  const hinge=structuredClone(ref);hinge.hardware.push({...hinge.hardware.find(h=>h.category==='петля')!,i:999});
  const ch=compareModule(hinge,m);assert.equal(ch.pass,false);assert.ok(ch.hardware.some(h=>h.category==='петля'&&h.ref===h.studio+1));
  const leg=structuredClone(ref);const l=leg.hardware.find(h=>h.category==='опора')!;l.pos=[l.pos[0]+5,l.pos[1],l.pos[2]];
  assert.equal(compareModule(leg,m).pass,false,'a leg 5 mm off fails');
  const mirror=structuredClone(ref);for(const p of mirror.panels)p.box=[600-p.box[3],p.box[1],p.box[2],600-p.box[0],p.box[4],p.box[5]];
  for(const h of mirror.hardware)h.pos=[600-h.pos[0],h.pos[1],h.pos[2]];
  assert.equal(compareModule(mirror,m).pass,false,'a mirrored layout (single door hinged on the other side) fails');
  const asym=kitchenBase(initialModule(),600);asym.sections[0].hingeSide='left';
  assert.equal(compareModule(refFromStudio(asym),{...asym,sections:[{...asym.sections[0],hingeSide:'right'}]}).pass,false,'hinges on the other side fail');
});

test('comparator checks gas lift rotation (quaternion), not only the point',()=>{
  const m=kitchenWall(initialModule(),600);m.height=300;m.depth=600;m.kitchen={...m.kitchen!,role:'antresol'};
  m.sections=[{...m.sections[0],shelves:[],doorLeaves:1,doorHinges:['top']}];m.kitchenLift={system:'pd-g-n02'};
  const ref=refFromStudio(m);
  assert.ok(ref.hardware.some(h=>h.category==='газлифт'&&h.quat),'lift quats in the self reference');
  assert.ok(compareModule(ref,m).pass,'self-check passes');
  const flipped={...ref,hardware:ref.hardware.map(h=>h.category==='газлифт'&&h.name.includes('Шток')?{...h,quat:[h.quat![0],h.quat![1],-h.quat![2],-h.quat![3]]}:h)};
  const c=compareModule(flipped,m);
  assert.equal(c.pass,false);
  assert.match(c.hardware.find(h=>h.category==='газлифт')!.note??'',/поворот ≠ ×2/);
  const neg={...ref,hardware:ref.hardware.map(h=>h.quat?{...h,quat:h.quat.map(v=>-v)}:h)};
  assert.ok(compareModule(neg,m).pass,'q and -q are the same rotation');
});

test('rotation check (info, not PASS): q and -q are one turn; a confirmat turned about its own axis (k13 m02 [0,-1,0,0] vs [1,0,0,0]) and a leg about its vertical axis are the same',()=>{
  assert.equal(sameTurn([1,0,0,0],[-1,0,0,0]),true);
  assert.equal(sameTurn([0,-1,0,0],[1,0,0,0]),false,'not symmetric: different');
  assert.equal(sameTurn([0,-1,0,0],[1,0,0,0],0),true,'confirmat: about local X');
  assert.equal(sameTurn([0.5,0.5,-0.5,0.5],[0.5,0.5,0.5,-0.5],2),true,'leg: about local Z');
  assert.equal(sameTurn([0.5,0.5,-0.5,0.5],[0.5,0.5,0.5,-0.5],0),false);
  // студийный модуль против самого себя — без сведений о повороте и сетке
  const m=kitchenWall(initialModule(),600),c=compareModule(refFromStudio(m),m);
  assert.ok(c.hardware.every(h=>!h.info),JSON.stringify(c.hardware.filter(h=>h.info)));
});