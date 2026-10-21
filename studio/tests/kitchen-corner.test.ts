import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {initialModule,parts,validate,parseModule,type Module} from '../src/model';
import {kitchenBaseCorner,cornerOf,reshapeCorner,cornerDoorDefault} from '../src/kitchenCorner';
import {kitchenTemplate,kitchenItemOf,placeKitchenModule,kitchenProject} from '../src/kitchenProject';
import {pendingPrice} from '../src/pendingPrices';
import {compareModule,honestPass,type RefModule} from '../scripts/kitchen/compare';
import {moduleFromEtalon} from '../scripts/kitchen/fromEtalon';
import {partCollisions} from '../src/collisions';
import {holes} from '../src/drilling';
import {estimate} from '../src/pricing';

// Нижний угловой (прямой, с фальшпанелью) — генератор студии против эталона Базиса. Фикстуры — модули эталонов без данных проекта
// (tests/fixtures/kitchen-ref/kNN-mNN.json: панели, фурнитура, отверстия).
const ref=(name:string)=>JSON.parse(readFileSync(new URL(`./fixtures/kitchen-ref/${name}.json`,import.meta.url),'utf8')) as RefModule;
const why=(c:ReturnType<typeof compareModule>)=>JSON.stringify({missing:c.missing.map(x=>x.name),extra:c.extra.map(x=>x.name),bad:c.pairs.filter(p=>p.delta>0.5).map(p=>p.ref.name+' '+p.delta),hw:c.hardware.filter(h=>h.ref!==h.studio||(h.maxPosDelta??0)>2||h.note),holes:c.holes&&{m:c.holes.missing.slice(0,4),x:c.holes.extra.slice(0,4)},edges:c.edges?.bad.slice(0,3),contours:c.contours});

/** Материалы кухни k02 (фасад — плита 18 стороннего материала, кромка фасада 1, корпус 0,5, конфирматы в 54 от кромок) — источник для генератора,
 *  как декоры палитры; опоры шаблона «НКПМ» и цоколь ряда (в модуле цоколя нет) — так стоят в проекте Базиса. */
function k02Corner(): Module {
  const m=kitchenBaseCorner(initialModule(),{width:800,height:762,depth:460,side:'right',door:400,hingeY:[100,548]});
  Object.assign(m,{facadeMaterial:'external',facadeT:18,facadeEdge:1,edgeScheme:{t:0.5},confirmatInset:54,noHandles:true});
  m.kitchen!.legs={back:70,front:89,pts:[[65,371],[70,70]],ptsR:[[75,371],[70,70]]};
  m.kitchen!.plinth={height:95,off:true};
  return m;
}

test('нижний угловой k02 m01 (НКПМ 800×762×460): генератор студии = эталон Базиса — PASS, пересечений нет',()=>{
  const m=k02Corner(),err=validate(m),c=compareModule(ref('k02-m01'),m);
  assert.deepEqual(err,[]);
  assert.ok(honestPass(c,err,[]),why(c));
  assert.equal(c.holes?.matched,60);
  assert.deepEqual(partCollisions(parts(m),m).map(x=>x.a+' × '+x.b),[]);
  const ps=parts(m);
  assert.equal(ps.filter(p=>p.id.includes(':hingeplate:')).length,2,'петли — только у кромки двери у фальша');
  assert.ok(ps.filter(p=>p.id.includes(':hingeplate:')).every(p=>p.name.startsWith('Петля под фальшпанель')));
  assert.equal(holes(m).filter(h=>h.d===35).length,2);
});

test('распознавание проекта Базиса: k02 m01 — фальш из фасада справа с крепежом по проекту (раньше — «не поддержано»)',()=>{
  const r=moduleFromEtalon(ref('k02-m01'));
  assert.deepEqual(r.unsupported,[]);
  const c=compareModule(ref('k02-m01'),r.module);
  assert.ok(honestPass(c,validate(r.module),r.unsupported),why(c));
  assert.equal(r.module.kitchen?.faceFiller?.side,'right');
  assert.equal(r.module.kitchen?.faceFiller?.confDepth,33);
  assert.equal(r.module.kitchen?.drill?.confirmat,undefined,'D5 корпуса — 35, глубина фальша отдельно');
});

test('генератор: сторона, ширина двери по умолчанию, перестройка из меню, roundtrip',()=>{
  assert.equal(cornerDoorDefault(800),400);
  assert.equal(cornerDoorDefault(1090),578);
  const m=kitchenBaseCorner(initialModule(),{width:900});
  assert.deepEqual(validate(m),[]);
  assert.deepEqual(cornerOf(m),{side:'right',door:450,filler:448.5,inset:1.5});
  const l=reshapeCorner(m,{side:'left'});
  assert.equal(l.kitchen!.faceFiller!.side,'left');
  assert.equal(l.sections[0].hingeSide,'left');
  const fp=parts(l).find(p=>p.id==='face-filler:fp:facade')!;
  assert.ok(fp.position[0]<450,'фальш слева');
  const plates=parts(l).filter(p=>p.id.includes(':hingeplate:'));
  assert.ok(plates.length>=2&&plates.every(p=>Math.abs(p.model!.origin![0]-(450+1.5))<0.6),'петли — у кромки двери со стороны фальша');
  const w=reshapeCorner(m,{door:500});
  assert.deepEqual(cornerOf(w),{side:'right',door:500,filler:398.5,inset:1.5});
  assert.equal(reshapeCorner(m,{filler:300}).kitchen!.faceFiller!.width,300);
  for(const x of [m,l,w]){
    assert.deepEqual(partCollisions(parts(x),x).map(c=>c.a+' × '+c.b),[]);
    const back=parseModule(JSON.parse(JSON.stringify(x)));
    assert.deepEqual(back.kitchen?.faceFiller,x.kitchen?.faceFiller,'faceFiller переживает сохранение');
  }
});

test('палитра: «Нижний угловой» — шаблон с фальшем из фасадного материала; смета — петли под фальшпанель и фальш в фасадах',()=>{
  const m=kitchenTemplate('base-corner',1000,initialModule(),{side:'left'});
  assert.equal(m.kitchen?.faceFiller?.facadeMat,true);
  assert.equal(m.kitchen?.faceFiller?.side,'left');
  assert.equal(kitchenItemOf(m),'base-corner');
  assert.deepEqual(validate(m),[]);
  const r=placeKitchenModule(kitchenProject(),m),e=estimate(r.project);
  const rows=JSON.stringify(e);
  assert.ok(rows.includes('hinge-false-panel'),'петли под фальшпанель — своей строкой');
  assert.ok(pendingPrice('hinge-false-panel'),'цена — после финального расчёта конструктором');
  // фальш — из фасадного материала: деталь с декором фасадов, в раскрое фасадов (или в м² стороннего фасада)
  const fp=parts(m).find(p=>p.id==='face-filler:fp:facade')!;
  assert.equal(fp.decor,m.facadeDecor);
  const ext={...m,facadeMaterial:'external' as const};
  assert.ok(parts(ext).find(p=>p.id==='face-filler:fp:facade')!.external,'при фасадах стороннего материала фальш — тоже сторонний');
});
