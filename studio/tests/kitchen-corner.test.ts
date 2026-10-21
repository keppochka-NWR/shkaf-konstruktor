import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {initialModule,parts,validate,parseModule,type Module} from '../src/model';
import {kitchenBaseCorner,cornerOf,reshapeCorner,cornerDoorDefault} from '../src/kitchenCorner';
import {kitchenTemplate,kitchenItemOf,placeKitchenModule,kitchenProject} from '../src/kitchenProject';
import {pendingPrice} from '../src/pendingPrices';
import {describeModule} from '../src/quoteDescribe';
import {k02Corner,k27Corner} from '../scripts/kitchen/cornerEtalons';
import {compareModule,honestPass,type RefModule} from '../scripts/kitchen/compare';
import {moduleFromEtalon} from '../scripts/kitchen/fromEtalon';
import {partCollisions} from '../src/collisions';
import {holes} from '../src/drilling';
import {estimate} from '../src/pricing';

// Нижний угловой (прямой, с фальшпанелью) — генератор студии против эталона Базиса. Фикстуры — модули эталонов без данных проекта
// (tests/fixtures/kitchen-ref/kNN-mNN.json: панели, фурнитура, отверстия).
const ref=(name:string)=>JSON.parse(readFileSync(new URL(`./fixtures/kitchen-ref/${name}.json`,import.meta.url),'utf8')) as RefModule;
const why=(c:ReturnType<typeof compareModule>)=>JSON.stringify({missing:c.missing.map(x=>x.name),extra:c.extra.map(x=>x.name),bad:c.pairs.filter(p=>p.delta>0.5).map(p=>p.ref.name+' '+p.delta),hw:c.hardware.filter(h=>h.ref!==h.studio||(h.maxPosDelta??0)>2||h.note),holes:c.holes&&{m:c.holes.missing.slice(0,4),x:c.holes.extra.slice(0,4)},edges:c.edges?.bad.slice(0,3),contours:c.contours});

test('нижний угловой k27 m09 (НМУ 1090×870×537): генератор студии = эталон Базиса — PASS, пересечений нет, переживает сохранение',()=>{
  const m=k27Corner(),err=validate(m),c=compareModule(ref('k27-m09'),m);
  assert.deepEqual(err,[]);
  assert.ok(honestPass(c,err,[]),why(c));
  assert.equal(c.holes?.matched,56);
  assert.deepEqual(partCollisions(parts(m),m).map(x=>x.a+' × '+x.b),[]);
  const ps=parts(m);
  assert.ok(ps.find(p=>p.id==='left')?.faceContour,'вырез боковины — в 3D контуром');
  assert.ok(ps.find(p=>p.id==='face-filler:fp:facade')?.faceContour,'вырез фальша — в 3D контуром');
  assert.ok(ps.find(p=>p.id==='bottom')?.planContour,'дно — с вырезом за мелкой боковиной');
  const back=parseModule(JSON.parse(JSON.stringify(m)));
  assert.ok(honestPass(compareModule(ref('k27-m09'),back),validate(back),[]),'после сохранения — тот же PASS');
  // смена ширины: фальш тот же (512, контур остаётся), растёт дверь; контур дна по габариту не совпал — прямоугольник; модуль собирается
  const w={...m,width:1190},pw=parts(w);
  assert.deepEqual(validate(w),[]);
  assert.ok(pw.find(p=>p.id==='face-filler:fp:facade')?.faceContour);
  assert.equal(pw.find(p=>p.id==='bottom')?.planContour,undefined);
  assert.deepEqual(partCollisions(pw,w).map(x=>x.a+' × '+x.b),[]);
});

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

test('стойка-упор (k27 m09): у углового шире 900 по умолчанию — за фальшем, от дна до передней царги; совпадает с панелью Базиса; крепёж и пересечения',()=>{
  const m=kitchenBaseCorner(initialModule(),{width:1090,height:870,depth:537,side:'right',door:578,inset:0});
  m.faceGap=2;m.edgeScheme={t:0.5};m.rails=[{place:'front-top',height:80,lay:'flat',setback:24.5},{place:'rear-top',height:80,lay:'flat'}];m.kitchen!.plinth={height:95,off:true}; // цоколь — у ряда, как в Базисе
  assert.deepEqual(validate(m),[]);
  const ps=parts(m),st=ps.find(p=>p.id==='kitchen-stop')!;
  assert.ok(st,'стойка есть');
  const c=compareModule(ref('k27-m09'),m),pair=c.pairs.find(p=>p.studio.id==='kitchen-stop');
  assert.ok(pair&&pair.delta<=0.5,'стойка = «Вертикальная» Базиса 649,5…665,5 × 116…854 × 435,5…537: '+JSON.stringify(pair));
  assert.ok(!c.edges?.bad.some(b=>b.startsWith('Вертикальная:')&&/Базис 0.5 \/ студия/.test(b)),'кромка стойки по кругу, как в Базисе: '+JSON.stringify(c.edges?.bad));
  const hs=holes(m).filter(h=>h.src.startsWith('fast:kitchen-stop:'));
  assert.equal(hs.length,4,'D8 через дно и царгу + D5 в торцы стойки');
  assert.deepEqual(partCollisions(ps,m).map(x=>x.a+' × '+x.b),[]);
  assert.deepEqual(parseModule(JSON.parse(JSON.stringify(m))).kitchen?.cornerStop,{x:71.5,depth:101.5});
  assert.equal(kitchenBaseCorner(initialModule(),{width:800}).kitchen?.cornerStop,undefined,'до 900 — без стойки (k02 m01)');
  const narrow=kitchenBaseCorner(initialModule(),{width:800,stop:true});
  assert.deepEqual(partCollisions(parts(narrow),narrow).map(x=>x.a+' × '+x.b),[],'стойка под царгой на ребре — до её низа');
});

test('ручка двери углового — по умолчанию кухни: в углу напротив верхней петли (у кромки открывания, сверху); КП — «нижний угловой»',()=>{
  for(const side of ['right','left'] as const){
    const m=kitchenBaseCorner(initialModule(),{width:800,side}),ps=parts(m);
    const door=ps.find(p=>p.role==='door')!,h=ps.find(p=>p.role==='handle')!;
    assert.ok(h,'ручка есть');
    const away=side==='right'?h.position[0]<door.position[0]:h.position[0]>door.position[0];
    assert.ok(away,`петли ${side} (у фальша) — ручка у противоположной кромки`);
    assert.ok(h.position[1]>door.position[1]+door.size[1]/4,'ручка в верхней части двери');
    assert.ok(h.size[1]>h.size[0],'вертикально');
    const d=describeModule(m);
    assert.equal(d.kind,'Кухонный нижний угловой модуль');
    assert.ok(d.filling.some(f=>f.includes(side==='left'?'слева':'справа')&&f.includes('фальшпанель')));
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
