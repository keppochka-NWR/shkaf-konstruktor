// Пакет 1 (pkg1): вырез по контуру горизонтали (П-вырез под воздуховод), кромка по отрезкам контура, планка под поднятым дном,
// Gola у пенала. Правила — статистикой по базе Базиса (34 кухни), см. комментарии в kitchen.ts / wallRaise.ts / sideNotch.ts.
import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync,readFileSync} from 'node:fs';
import {validate,parts,initialModule,parseModule} from '../src/model';
import {contourSegments,contourEdgeLens} from '../src/kitchen';
import {compareModule,wantEdges,type RefModule} from '../scripts/kitchen/compare';
import {contourEdgesFromEtalon} from '../scripts/kitchen/sideNotch';
import {moduleFromEtalon} from '../scripts/kitchen/fromEtalon';
import {holes} from '../src/drilling';

const ETALON='C:/Users/My PC/Desktop/Claude Project/Кухни/etalon';
const load=(k:string,key:string)=>(JSON.parse(readFileSync(`${ETALON}/${k}.json`,'utf8')).modules as RefModule[]).find(m=>m.key===key)!;
// дно 568×330 с П-вырезом 200×180 от задней кромки (k10 m07), точки [x, z] от заднего левого угла
const DUCT:[number,number][]=[[0,330],[568,330],[568,0],[384,0],[384,180],[184,180],[184,0],[0,0]];

test('contourSegments: наружная нормаль отрезков П-выреза — стенки выреза смотрят внутрь выреза, дно выреза назад',()=>{
  const s=contourSegments(DUCT);
  assert.deepEqual(s.map(q=>q.dir),['+z','+x','-z','-x','-z','+x','-z','-x']);
  assert.deepEqual(s.map(q=>q.len),[568,330,184,180,200,180,184,330]);
});

test('contourEdgesFromEtalon: записи кромки Базиса (сторона + длина) раскладываются по отрезкам контура, порядок элементов Базиса не нужен',()=>{
  // k10 m07: перед 0,4; зад 184 + 184 по 0,4; стенки выреза ±x 180 и дно выреза 200 — 0,5; наружные торцы у боковин (330) без кромки
  const edges=[{side:'+z',thick:0.4,len:568},{side:'-z',thick:0.4,len:184},{side:'-z',thick:0.4,len:184},{side:'+x',thick:0.5,len:180},{side:'-z',thick:0.5,len:200},{side:'-x',thick:0.5,len:180}];
  assert.deepEqual(contourEdgesFromEtalon(edges,DUCT),[0.4,0,0.4,0.5,0.5,0.5,0.4,0]);
  // без единой кромки — undefined (деталь без кромки остаётся по схеме)
  assert.equal(contourEdgesFromEtalon([],DUCT),undefined);
  // стенки выреза не кромлены (k06 m09: только зад 150 + 150) — на них 0
  assert.deepEqual(contourEdgesFromEtalon([{side:'+z',thick:0.5,len:568},{side:'-z',thick:0.5,len:184},{side:'-z',thick:0.5,len:184}],DUCT),[0.5,0,0.5,0,0,0,0.5,0]);
});

test('contourEdgeLens: кромка дна с П-вырезом по направлениям — толщина с наибольшей длиной, длины по контуру (edgeLen), бирка по отрезкам',()=>{
  const m=initialModule();
  m.width=600;m.height=492;m.depth=330;m.backType='groove';m.sections[0].shelves=[];m.sections[0].drawers=0;
  m.kitchen={role:'wall',planContours:{bottom:DUCT},contourEdges:{bottom:[0.4,0,0.4,0.5,0.5,0.5,0.4,0]}};
  m.edgeScheme={t:0.4};
  const ps=parts(m),b=ps.find(p=>p.id==='bottom')!;
  assert.ok(b.planContour,'контур применён к дну');
  // edge = [−L, +L, +W, −W]: длина дна по x (568), ширина по z (330)
  assert.deepEqual(b.edge,[0.5,0.5,0.4,0.4],'стенки выреза ±x 0,5; перед и зад 0,4');
  assert.deepEqual(b.edgeLen,{'-x':180,'+x':180,'+z':568,'-z':568},'±x — только стенки выреза (180), зад — 184 + 184 + дно выреза 200 = 568');
  assert.deepEqual(b.contourEdges,[0.4,0,0.4,0.5,0.5,0.5,0.4,0]);
  // контур с другим габаритом (после смены размера) — кромка остаётся по схеме, контур не применяется
  const m2=parseModule(JSON.parse(JSON.stringify(m)));m2.width=700;
  const b2=parts(m2).find(p=>p.id==='bottom')!;
  assert.equal(b2.planContour,undefined);assert.equal(b2.edgeLen,undefined);
  // parse сохраняет contourEdges
  assert.deepEqual(parseModule(JSON.parse(JSON.stringify(m))).kitchen?.contourEdges,{bottom:[0.4,0,0.4,0.5,0.5,0.5,0.4,0]});
  // contourEdgeLens без контура/кромки по контуру — ничего не трогает
  const m3=initialModule();const out=parts(m3);const before=JSON.stringify(out);contourEdgeLens(m3,out);assert.equal(JSON.stringify(out),before);
});

test('wantEdges (сверщик): на стороне с отрезками разной толщины — толщина с наибольшей суммарной длиной, пустые записи не считаются',()=>{
  assert.deepEqual(wantEdges([{side:'-z',thick:0.4,len:184},{side:'-z',thick:0.4,len:184},{side:'-z',thick:0.5,len:200},{side:'+x',thick:0.5,len:180}]),{'-z':0.4,'+x':0.5});
  assert.deepEqual(wantEdges([{side:'-z',thick:0.5,len:200},{side:'-z',thick:0.4,len:184},{side:'-z',thick:0.4,len:184}]),{'-z':0.4});
  assert.deepEqual(wantEdges([{side:null,thick:0.5,len:null},{side:'+z',thick:0,len:100}]),{});
  assert.deepEqual(wantEdges([{side:'+z',thick:1},{side:'+z',thick:0.5}]),{'+z':0.5},'без длин — последняя запись, как раньше');
});

test('k10 m07 (навесной под вытяжку без короба): П-вырез в дне, кромка по контуру и планка 50 под дном — как в Базисе',{skip:!existsSync(`${ETALON}/k10.json`)},()=>{
  const ref=load('k10','m07'),{module:m}=moduleFromEtalon(ref);
  assert.deepEqual(m.kitchen?.contourEdges,{bottom:[0.4,0,0.4,0.5,0.5,0.5,0.4,0]});
  assert.deepEqual(m.kitchen?.raise,{plank:{depth:50}});
  assert.deepEqual(m.sections[0].shelves,[],'планка под дном — не полка');
  assert.deepEqual(validate(m),[],'без ошибок студии (раньше: shelfRear −20, глубина полки 50, 80 мм между полками)');
  const ps=parts(m),pl=ps.find(p=>p.id==='raise-plank')!;
  assert.deepEqual([pl.size,pl.position],[[568,16,50],[300,8,25]]);
  assert.deepEqual(pl.edge,[0,0,0,0],'k10: планка без кромки (edgeScheme.parts)');
  // конфирматы в планку через боковины — одна точка посередине (правило узкой горизонтали), как в Базисе (y 8, z 25)
  const pc=holes(m).filter(h=>h.part==='raise-plank'||(h.d===5&&Math.abs(h.at[1]-8)<0.1));
  assert.ok(pc.length>=2,'конфирматы в планку');
  const c=compareModule(ref,m);
  assert.deepEqual(c.edges?.bad,[],'кромка совпала, включая стенки выреза 0,5 по 180');
  assert.deepEqual(c.contours,[]);
  assert.equal(c.missing.length+c.extra.length,0);
  assert.ok(c.holes&&c.holes.matched===c.holes.ref&&c.holes.extra.length===0,'отверстия 36/36');
  // остаётся честное расхождение: ХДФ Базиса на 0,5 ниже дна паза (171,5 при пазе до 172) — Δ1,5 у задней стенки, не воспроизводится
  assert.deepEqual(c.pairs.filter(p=>p.delta>0.5).map(p=>p.studio.name),['Задняя стенка · в паз']);
});

test('планка под дном (raise.plank): деталь только у поднятого дна без опор, кромка перед и зад по умолчанию, смена ширины тянет планку',()=>{
  const m=initialModule();m.width=600;m.height=492;m.depth=330;m.sections[0].shelves=[];m.sections[0].drawers=0;m.plinthHeight=164;
  m.kitchen={role:'wall',plinth:{height:95,off:true},raise:{plank:{depth:60}}};m.edgeScheme={t:0.5};
  const pl=parts(m).find(p=>p.id==='raise-plank')!;
  assert.deepEqual([pl.size,pl.position,pl.edge],[[568,16,60],[300,8,30],[0,0,0.5,0.5]]);
  m.width=800;assert.equal(parts(m).find(p=>p.id==='raise-plank')!.size[0],768);
  const m2=initialModule();m2.plinthHeight=0;m2.kitchen={role:'wall',raise:{plank:{depth:60}}};
  assert.equal(parts(m2).find(p=>p.id==='raise-plank'),undefined,'дно на полу — планки нет');
  assert.deepEqual(parseModule(JSON.parse(JSON.stringify(m))).kitchen?.raise,{plank:{depth:60}});
});

test('k14 m03: планка 50 под дном распознана, конфирматы планки по месту Базиса',{skip:!existsSync(`${ETALON}/k14.json`)},()=>{
  const ref=load('k14','m03'),{module:m}=moduleFromEtalon(ref),c=compareModule(ref,m);
  assert.deepEqual(m.kitchen?.raise?.plank,{depth:50});
  assert.ok(c.pairs.some(p=>p.studio.id==='raise-plank'&&p.delta===0),'планка на своём месте');
  assert.deepEqual(c.edges?.bad,[]);
});

test('Gola у пенала (k27 m08): средний вырез под профиль C в обеих боковинах — кромка боковин по контуру совпала',{skip:!existsSync(`${ETALON}/k27.json`)},()=>{
  const ref=load('k27','m08'),{module:m}=moduleFromEtalon(ref);
  assert.equal(m.kitchen?.role,'tall');
  assert.equal(m.gola?.cuts.length,1);
  assert.ok(m.gola!.cuts[0].top0>2000&&m.gola!.cuts[0].side===undefined,'вырез 2317–2383 от верха в обеих боковинах');
  const c=compareModule(ref,m);
  assert.deepEqual(c.edges?.bad,[]);
  assert.deepEqual(c.contours,[]);
  assert.ok(parts(m).some(p=>p.id.startsWith('gola:C:')),'профиль C');
});
