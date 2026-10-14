// Пакет 0: координаты Базиса в полях модуля → правила «от кромки детали + сторона», чтобы модуль переживал смену ширины/высоты.
// Каждое правило — отдельный тест на исходном и изменённом размере + сохранение; общий прогон — все PASS-модули базы ±100.
import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync} from 'node:fs';
import {initialModule,parseModule,parts,validate,type Module} from '../src/model';
import {kitchenBase,kitchenWall,kitchenLegs,grooveHoleAt,grooveHoleOf,parseGrooveHole} from '../src/kitchen';
import {partCollisions} from '../src/collisions';
import {relayoutKDrawers,isFirmax,parseKDrawers} from '../src/kitchenDrawers';
import {ETALON_DIR,resizeSweep,RESIZE_CHANGES} from '../scripts/kitchen/resize-sweep';

const at=(ps:ReturnType<typeof parts>,id:string)=>{const p=ps.find(q=>q.id===id);assert.ok(p,id);return (p.anchor??p.model?.origin??p.position) as [number,number,number];};
const rt=(m:Module)=>parseModule(JSON.parse(JSON.stringify(m)));

test('опоры: xs — от левого торца, xr — от правого; при смене ширины правые идут за правой боковиной (представление, не раскладка)',()=>{
  const m=kitchenBase(initialModule(),600);m.kitchen!.legs={back:70,front:70,xs:[80],xr:[90]};
  assert.deepEqual(kitchenLegs(m).map(l=>l.x),[80,80,510,510]);
  assert.deepEqual(kitchenLegs({...m,width:500}).map(l=>l.x),[80,80,410,410]);
  assert.deepEqual(validate(m).filter(e=>/Опоры/.test(e)),[]);
  assert.ok(validate({...m,kitchen:{...m.kitchen!,legs:{back:70,front:70,xr:[700]}}}).some(e=>/Опоры: позиции/.test(e)),'xr за дном — ошибка');
  const p=kitchenBase(initialModule(),600);p.kitchen!.legs={back:70,front:70,pts:[[70,70]],ptsR:[[60,90]]};
  assert.deepEqual(kitchenLegs(p).map(l=>[l.x,l.z]),[[70,70],[540,90]]);
  assert.deepEqual(kitchenLegs({...p,width:700}).map(l=>[l.x,l.z]),[[70,70],[640,90]]);
  assert.ok(validate({...p,kitchen:{...p.kitchen!,legs:{back:70,front:70,ptsR:[[-1,70]]}}}).some(e=>/Опоры: точки/.test(e)));
  assert.deepEqual(rt(m).kitchen!.legs,m.kitchen!.legs,'xr переживает сохранение');
  assert.deepEqual(rt(p).kitchen!.legs,p.kitchen!.legs,'ptsR переживает сохранение');
});

test('стяжка: topConfR — конфирматы через крышу от правого конца; atTop — стяжка не у кромки от верха модуля',()=>{
  const m=kitchenWall(initialModule(),600);m.height=720;m.rails=[{place:'rear-top',height:100,topConf:[60],topConfR:[60]}];
  const x=(mm:Module)=>parts(mm).filter(p=>p.id.startsWith('fast:rail:rear-top:top:')).map(p=>at(parts(mm),p.id)[0]).sort((a,b)=>a-b);
  assert.deepEqual(x(m),[76,524]);
  assert.deepEqual(x({...m,width:500}),[76,424],'правый конфирмат — в 60 от правого конца и после сужения');
  assert.deepEqual(x({...m,width:700}),[76,624]);
  const r=kitchenWall(initialModule(),600);r.height=720;r.rails=[{place:'rear-top',height:70,atTop:200}];
  const y=(mm:Module)=>{const p=parts(mm).find(q=>q.id==='rail:rear-top')!;return [p.position[1]-p.size[1]/2,mm.height-(p.position[1]+p.size[1]/2)];};
  assert.deepEqual(y(r),[450,200]);
  assert.deepEqual(y({...r,height:620}),[350,200],'при −100 стяжка остаётся в 200 от верха');
  assert.deepEqual(validate({...r,height:620}).filter(e=>/Стяжка/.test(e)),[]);
  const a=kitchenWall(initialModule(),600);a.height=720;a.rails=[{place:'rear-top',height:70,at:450}];
  assert.deepEqual(y({...a,height:620}),[450,100],'at — по-прежнему от пола (старые файлы)');
  assert.deepEqual(rt(m).rails,m.rails);assert.deepEqual(rt(r).rails,r.rails);
});

test('стяжка на дне: eccR/dowelR — эксцентрики и шканты правой половины от правого конца стяжки',()=>{
  const m=kitchenWall(initialModule(),600);m.height=720;m.rails=[{place:'rear-bottom',height:60}];
  m.kitchen!.railUnder={'rear-bottom':{ecc:[65],dowel:[97],eccR:[65],dowelR:[97],face:'front'}};
  const xs=(mm:Module,pre:string)=>parts(mm).filter(p=>p.id.startsWith(pre)).map(p=>p.anchor![0]).sort((a,b)=>a-b);
  assert.deepEqual(xs(m,'ecc:rail-under:'),[81,519]);assert.deepEqual(xs(m,'dowel:rail-under:'),[113,487]);
  assert.deepEqual(xs({...m,width:500},'ecc:rail-under:'),[81,419]);assert.deepEqual(xs({...m,width:500},'dowel:rail-under:'),[113,387]);
  assert.deepEqual(rt(m).kitchen!.railUnder,m.kitchen!.railUnder,'eccR/dowelR переживают сохранение');
});

test('grooveHoles: точка от ближней кромки (sx/sy) — пометка «как в Базисе» переживает смену ширины и высоты; старая тройка — абсолютная',()=>{
  const m={width:600,height:720};
  assert.deepEqual(grooveHoleOf([592,19,478],m),[8,19,478,-1,1]);
  assert.deepEqual(grooveHoleOf([8,704,478],m),[8,16,478,1,-1]);
  assert.deepEqual(grooveHoleAt([8,19,478,-1,1],{width:500,height:720}),[492,19,478]);
  assert.deepEqual(grooveHoleAt([8,16,478,1,-1],{width:600,height:620}),[8,604,478]);
  assert.deepEqual(grooveHoleAt([592,19,478],{width:500,height:720}),[592,19,478],'тройка без сторон — как было');
  assert.deepEqual(parseGrooveHole([8,19,478,-1,1]),[8,19,478,-1,1]);assert.deepEqual(parseGrooveHole([8,19,478]),[8,19,478]);
  const w=kitchenWall(initialModule(),600);w.bazis=true;w.kitchen!.grooveHoles=[[8,19,478,-1,1]];
  assert.deepEqual(rt(w).kitchen!.grooveHoles,w.kitchen!.grooveHoles,'стороны переживают сохранение');
  const w2=kitchenWall(initialModule(),600);w2.bazis=true;w2.kitchen!.grooveHoles=[[592,19,478]];
  assert.deepEqual(rt(w2).kitchen!.grooveHoles,[[592,19,478]]);
});

test('Firmax: точки направляющих и шурупы фальшпанели с маркером −1 — от правой боковины; знак x не признак (k19 m10: точки левее боковины)',()=>{
  const m=kitchenBase(initialModule(),600,'drawers');m.doors=false;m.sections[0].shelves=[];m.sections[0].drawers=0;
  m.kdrawers=relayoutKDrawers(m,2,undefined,'firmax-ldsp');
  const k=m.kdrawers![0];assert.ok(isFirmax(k));
  k.box.runs=[[10,k.runnerY,0],[-10,k.runnerY,0,-1],[-31,k.runnerY,0]];k.box.faceScrews=[[60,30],[-60,30,-1]];
  const sl=(mm:Module)=>{const ps=parts(mm);return [at(ps,'kd:0:slide:L')[0],at(ps,'kd:0:slide:R')[0],at(ps,'kd:0:slide:L2')[0]];};
  assert.deepEqual(sl(m),[26,574,-15],'от левой: 16+10; от правой: 584−10; без маркера отрицательный — левее левой боковины, как в Базисе');
  assert.deepEqual(sl({...m,width:500}),[26,474,-15]);
  const fs=(mm:Module)=>{const ps=parts(mm);return [at(ps,'kd:0:screw:fxf:0')[0],at(ps,'kd:0:screw:fxf:1')[0]];};
  const [a,b]=fs(m),[a2,b2]=fs({...m,width:500});
  assert.equal(a,a2,'левый шуруп — от левой боковины ящика');assert.equal(b-b2,100,'правый — от правой');
  const back=parseKDrawers(JSON.parse(JSON.stringify(m.kdrawers)))![0];assert.ok(isFirmax(back));
  assert.deepEqual(back.box.runs,k.box.runs);assert.deepEqual(back.box.faceScrews,k.box.faceScrews);
});

// Честный список исключений общего прогона: прогоны без ошибки validate, где после ±100 остаётся пересечение/потеря пометки.
// Не поля пакета 0: газлифт против полки (положение полки — правило шкафа), число точек стыка при ширине 292 (правило kitchenJointPoints).
const EXCEPTIONS=new Set(['k07/m07/height-100','k10/m10/width-100']);
test('все PASS-модули базы переживают ширину ±100 и высоту ±100: либо чисто, либо проверка говорит об этом (validate); тихих — только список исключений',{skip:!existsSync(ETALON_DIR)},()=>{
  const r=resizeSweep(RESIZE_CHANGES);
  assert.ok(r.modules>=173,`PASS-модулей ${r.modules}`);
  assert.deepEqual(r.skipped,[],'на исходном размере все PASS-модули без ошибок и пересечений');
  const silent=r.hits.filter(h=>!h.errors.length).map(h=>`${h.kitchen}/${h.key}/${h.change}`);
  assert.deepEqual(silent.filter(s=>!EXCEPTIONS.has(s)),[],'тихие поломки вне списка исключений');
  // ни одного крепежа/опоры за габаритом и фурнитуры в воздухе без ошибки validate
  assert.deepEqual(r.hits.filter(h=>!h.errors.length&&(h.outside.length||h.air.length)).map(h=>`${h.kitchen}/${h.key}/${h.change}`),[]);
  assert.ok(r.hits.length<=49,`прогонов с замечаниями ${r.hits.length} (было 84 до пакета 0, 49 после)`);
});

test('щит: partCollisions у модуля с относительными полями на исходном размере — пусто (сверка не меняется)',()=>{
  const m=kitchenWall(initialModule(),600);m.height=720;m.kitchen!.hangers=false;m.rails=[{place:'rear-top',height:100,confY:[34,66],topConf:[60],topConfR:[60]}];
  assert.deepEqual(partCollisions(parts(m),m).filter(c=>/rail:rear-top/.test(c.a+c.b)),[]);
  assert.deepEqual(partCollisions(parts({...m,width:500}),m).filter(c=>/rail:rear-top/.test(c.a+c.b)),[]);
});
