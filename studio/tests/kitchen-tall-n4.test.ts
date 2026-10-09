import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync,readFileSync} from 'node:fs';
import {validate,parts,initialModule,parseModule} from '../src/model';
import {holes} from '../src/drilling';
import {partCollisions} from '../src/collisions';
import {edgeByDir} from '../src/edges';
import {compareModule,honestPass,type RefModule} from '../scripts/kitchen/compare';
import {moduleFromEtalon} from '../scripts/kitchen/fromEtalon';
import {shelfAtFromEtalon,topBackTall,doorsAboveDrawers} from '../scripts/kitchen/recognize-tall';

// Эталоны Базиса лежат вне репозитория (Кухни\etalon) — на чужой машине тест пропускается.
const ETALON='C:/Users/My PC/Desktop/Claude Project/Кухни/etalon';
const load=(k:string,key:string)=>(JSON.parse(readFileSync(`${ETALON}/${k}.json`,'utf8')).modules as RefModule[]).find(m=>m.key===key)!;

test('k23 m14: два конфирмата Базиса в одной точке — повторяем (dupParts), отверстие одно, пересечений нет; полка на всю глубину; двери ЛДСП без кромки — PASS',{skip:!existsSync(`${ETALON}/k23.json`)},()=>{
  const ref=load('k23','m14');
  const {module:m,unsupported}=moduleFromEtalon(ref);
  assert.deepEqual(unsupported,[]);
  assert.deepEqual(validate(m),[]);
  assert.equal(m.kitchen?.dupParts?.length,2);
  assert.ok(m.kitchen!.dupParts!.every(id=>id.startsWith('fast:')));
  const ps=parts(m);
  assert.equal(ps.filter(p=>p.id.startsWith('fast:')).length,14,'конфирматов 14, как в Базисе');
  // отверстия: дубль не сверлит второй раз
  const noDup={...m,kitchen:{...m.kitchen!,dupParts:undefined}};
  assert.equal(holes(m,ps).length,holes(noDup,parts(noDup)).length);
  assert.deepEqual(partCollisions(ps,m).filter(c=>c.names.some(n=>/конфирмат/i.test(n))),[]);
  // жёсткая полка — на всю глубину корпуса 577 от задника, съёмные — 575 с отступом 1
  assert.deepEqual(m.sections[0].shelfAt,{1:{rear:0,depth:577}});
  const sid=m.sections[0].id,fixed=ps.find(p=>p.id===`${sid}:shelf:1`)!;
  assert.equal(fixed.size[2],577);
  // кухня без кромки (k23): двери ЛДСП тоже без кромки
  for(const d of ps.filter(p=>p.role==='door'))assert.deepEqual(Object.values(edgeByDir(d)).filter(v=>v>0),[],d.name);
  const c=compareModule(ref,m);
  assert.ok(honestPass(c,validate(m),unsupported),JSON.stringify({hw:c.hardware.filter(h=>h.ref!==h.studio),edges:c.edges?.bad.slice(0,2),pairs:c.pairs.filter(p=>p.delta>0.5).map(p=>p.ref.name+' '+p.delta)}));
});

test('k23 m17 — тот же случай: PASS',{skip:!existsSync(`${ETALON}/k23.json`)},()=>{
  const ref=load('k23','m17');
  const {module:m,unsupported}=moduleFromEtalon(ref);
  const c=compareModule(ref,m);
  assert.ok(honestPass(c,validate(m),unsupported));
  assert.equal(c.hardware.find(h=>h.category==='конфирмат')!.ref,c.hardware.find(h=>h.category==='конфирмат')!.studio);
});

test('k16 m01: опор 10, как в Базисе (две — дубли в одной точке), пересечений опор нет; без дублей у модулей, где их нет в Базисе',{skip:!existsSync(`${ETALON}/k16.json`)},()=>{
  const {module:m}=moduleFromEtalon(load('k16','m01'));
  const ps=parts(m);
  assert.equal(ps.filter(p=>p.id.startsWith('leg:')).length,10);
  assert.ok(m.kitchen!.dupParts!.every(id=>id.startsWith('leg:')));
  assert.deepEqual(partCollisions(ps,m).filter(c=>c.names.some(n=>/Опора/.test(n))),[]);
  const {module:m12}=moduleFromEtalon(load('k12','m04'));
  assert.equal(m12.kitchen?.dupParts,undefined);
});

test('shelfAt: своя глубина полки — только у кухни и не глубже корпуса; парсер сохраняет shelfAt и dupParts',()=>{
  const w=initialModule();
  w.sections[0].shelfAt={0:{rear:0,depth:300}};
  assert.ok(validate(w).some(e=>e.includes('своя глубина')),'шкаф студии — нельзя');
  const k=initialModule();
  k.kitchen={role:'tall',dupParts:['leg:x']} as typeof k.kitchen;
  k.sections[0].shelfAt={0:{rear:0,depth:k.depth+50}};
  assert.ok(validate(k).some(e=>e.includes('своя глубина')),'глубже корпуса — ошибка');
  k.sections[0].shelfAt={0:{rear:0,depth:300}};
  const back=parseModule(JSON.parse(JSON.stringify(k)));
  assert.deepEqual(back.sections[0].shelfAt,{0:{rear:0,depth:300}});
  assert.deepEqual(back.kitchen?.dupParts,['leg:x']);
});

test('k23 m15/m16: крыша короче сзади на 40 (topBack у пенала), вырез под вентиляцию в дне (planContours), полка на конфирматах только справа (jointNone) — PASS',{skip:!existsSync(`${ETALON}/k23.json`)},()=>{
  for(const key of ['m15','m16']){
    const ref=load('k23',key);
    const {module:m,unsupported}=moduleFromEtalon(ref);
    assert.deepEqual(unsupported,[]);
    assert.deepEqual(validate(m),[]);
    assert.equal(m.kitchen?.topBack,40);
    assert.deepEqual(Object.keys(m.kitchen?.planContours??{}),['bottom']);
    const sid=m.sections[0].id;
    // m15 — крепёж только у правой стойки, m16 (зеркальный) — только у левой
    assert.deepEqual(m.kitchen?.jointNone,[`${sid}:shelf:1:${key==='m15'?'left':'right'}`]);
    const ps=parts(m),bottom=ps.find(p=>p.id==='bottom')!;
    assert.ok(bottom.planContour&&bottom.planContour.length===70,'дно с контуром Базиса');
    assert.equal(ps.filter(p=>p.id.startsWith(`fast:${sid}:shelf:1:`)).length,2,'полка: 2 конфирмата, только справа');
    // отверстия опор над вырезом дна — в пустоте, как в Базисе: в дно не сверлятся
    assert.equal(holes(m,ps).filter(h=>h.part==='bottom'&&h.d===4).length,14,'D4×3 в дне 14, как в Базисе (2 — над вырезом, в пустоте)');
    const c=compareModule(ref,m);
    assert.ok(honestPass(c,validate(m),unsupported),JSON.stringify({hw:c.hardware.filter(h=>h.ref!==h.studio),contours:c.contours,holes:c.holes?.extra.slice(0,4)}));
  }
});

test('контур в плане: не совпал с деталью после смены размера — прямоугольник; topBackTall — только пенал',()=>{
  const k=initialModule();
  k.kitchen={role:'tall',planContours:{bottom:[[0,0],[10,0],[10,10],[0,10]]}} as typeof k.kitchen;
  const b=parts(k).find(p=>p.id==='bottom');
  if(b)assert.equal(b.planContour,undefined,'габарит контура 10×10 ≠ дну — контур не ставим');
  const box=(z0:number)=>({b:{x0:16,y0:0,z0,x1:584,y1:16,z1:580}});
  assert.equal(topBackTall('tall',box(43),undefined,3),40);
  assert.equal(topBackTall('base',box(43),undefined,3),undefined);
  assert.equal(topBackTall('tall',box(3),undefined,3),undefined);
});

test('k25 m10 пенал под холодильник: дно и крыша перед ХДФ (bottomBack/topBack 50), ХДФ в пазу только от жёсткой полки до верха (backFromShelf), торец полки — только перед — PASS',{skip:!existsSync(`${ETALON}/k25.json`)},()=>{
  const ref=load('k25','m10');
  const {module:m,unsupported}=moduleFromEtalon(ref);
  assert.deepEqual(unsupported,[]);
  assert.deepEqual(validate(m),[]);
  assert.equal(m.kitchen?.bottomBack,50);
  assert.equal(m.kitchen?.topBack,50);
  assert.equal(m.kitchen?.backFromShelf,0);
  assert.deepEqual(m.edgeScheme?.fixedSides,['+z']);
  const ps=parts(m),back=ps.find(p=>p.id==='back')!,sh=ps.find(p=>p.id===`${m.sections[0].id}:shelf:0`)!;
  assert.ok(Math.abs(back.position[1]-back.size[1]/2-(sh.position[1]-sh.size[1]/2+(m.grooveClear??0)))<1e-6,'низ ХДФ — низ полки + зазор паза');
  assert.equal(back.length,back.size[1]);
  assert.deepEqual(partCollisions(ps,m),[]);
  const c=compareModule(ref,m);
  assert.ok(honestPass(c,validate(m),unsupported),JSON.stringify({hw:c.hardware.filter(h=>h.ref!==h.studio),edges:c.edges?.bad,missing:c.missing.map(x=>x.name),extra:c.extra.map(x=>x.name)}));
  // без жёсткой полки (убрали в студии) — ХДФ снова на всю высоту
  const m2=structuredClone(m);m2.sections[0].fixed=[];
  const b2=parts(m2).find(p=>p.id==='back')!;
  assert.ok(b2.size[1]>back.size[1]+1000);
});

test('k16 m13: ящик внизу, ниша, одна распашная дверь сверху (faceBottom по Базису) — без перекрытия фасада ящика, петли 3 справа, опор 7 (дубль) — PASS',{skip:!existsSync(`${ETALON}/k16.json`)},()=>{
  const ref=load('k16','m13');
  const {module:m,unsupported}=moduleFromEtalon(ref);
  assert.deepEqual(unsupported,[]);
  assert.deepEqual(validate(m),[]);
  assert.equal(m.sections[0].doorLeaves,1);
  assert.equal(m.sections[0].hingeSide,'right');
  const ps=parts(m),doors=ps.filter(p=>p.role==='door'&&p.id.includes(':door:'));
  assert.equal(doors.length,1);
  assert.ok(Math.abs(doors[0].position[1]-doors[0].size[1]/2-1509)<0.6,'низ двери 1509, как в Базисе');
  assert.deepEqual(partCollisions(ps,m),[]);
  assert.equal(ps.filter(p=>p.id.startsWith('leg:')).length,7);
  const c=compareModule(ref,m);
  assert.ok(honestPass(c,validate(m),unsupported),JSON.stringify({hw:c.hardware.filter(h=>h.ref!==h.studio||(h.maxPosDelta??0)>2),missing:c.missing.map(x=>x.name),extra:c.extra.map(x=>x.name)}));
});

test('k30 m03 пенал под духовку без задника: крыша короче сзади на 70, как в Базисе (topBack), крыша и её конфирматы совпали',{skip:!existsSync(`${ETALON}/k30.json`)},()=>{
  const ref=load('k30','m03');
  const {module:m}=moduleFromEtalon(ref);
  assert.equal(m.backType,'none');
  assert.equal(m.kitchen?.topBack,70);
  const c=compareModule(ref,m);
  assert.equal(c.missing.length+c.extra.length,0,JSON.stringify({missing:c.missing.map(x=>x.name),extra:c.extra.map(x=>x.name)}));
  const conf=c.hardware.find(h=>h.category==='конфирмат')!;
  assert.deepEqual([conf.ref,conf.studio,conf.maxPosDelta],[26,26,0]);
});

test('k17 m09: ящик, ниша, дверь и подъёмный фасад — честно «не поддержано», а не створки поверх ящика молча',{skip:!existsSync(`${ETALON}/k17.json`)},()=>{
  const {unsupported}=moduleFromEtalon(load('k17','m09'));
  assert.ok(unsupported.some(u=>u.includes('ящики и распашные')),unsupported.join('; '));
});

test('doorsAboveDrawers: распашные — только если все выше фасадов ящиков и в одном ряду',()=>{
  const q=(y0:number,y1:number)=>({b:{x0:0,y0,z0:0,x1:600,y1,z1:16}});
  const d=q(101,458),u=q(1509,2298),u2=q(800,1500);
  assert.deepEqual(doorsAboveDrawers([d,u],[d]),[u]);
  assert.equal(doorsAboveDrawers([d,u,u2],[d]),undefined,'два ряда — не этот случай');
  assert.equal(doorsAboveDrawers([q(101,458),q(300,2298)],[d]),undefined);
  assert.equal(doorsAboveDrawers([u],[]),undefined);
});

test('shelfAtFromEtalon: полки одной глубины — нет записи; другая глубина или отступ — запись по номеру полки',()=>{
  const b=(z0:number,z1:number)=>({x0:0,y0:0,z0,x1:1,y1:16,z1});
  assert.equal(shelfAtFromEtalon([b(4,579),b(4,579)],575,1,3),undefined);
  assert.deepEqual(shelfAtFromEtalon([b(4,579),b(3,580)],575,1,3),{1:{rear:0,depth:577}});
});

test('боковина до плоскости фасадов (k23 m04, k29 m02, k27 m13): двери перед мелкой боковиной находятся и сверяются как фасады; выступ — «не поддержано»',{skip:!existsSync(`${ETALON}/k29.json`)},()=>{
  for(const [k,key,n] of [['k23','m04',2],['k29','m02',3],['k27','m13',1]] as const){
    const ref=load(k,key);
    const {module:m,unsupported}=moduleFromEtalon(ref);
    assert.ok(unsupported.some(u=>/выступает до плоскости фасадов/.test(u)),`${k} ${key}: ${unsupported.join('; ')}`);
    const c=compareModule(ref,m);
    assert.equal(c.missing.filter(x=>/Дверь/.test(x.name)).length,0,`${k} ${key}: двери Базиса не потеряны`);
    assert.equal(parts(m).filter(p=>p.role==='door').length,n,`${k} ${key}: дверей ${n}`);
  }
});

test('узкий стык (до 120 мм) в корпусе глубже — одна точка крепежа посередине, как в Базисе (k27 m14: 6 конфирматов, k10 m07); мелкий корпус целиком (k08 m07) — по-прежнему две',{skip:!existsSync(`${ETALON}/k27.json`)},()=>{
  const n=(k:string,key:string)=>{const ref=load(k,key);const c=compareModule(ref,moduleFromEtalon(ref).module);return c.hardware.find(h=>h.category==='конфирмат')!;};
  const a=n('k27','m14');assert.equal(a.studio,a.ref,'k27 m14');assert.equal(a.ref,6);
  const b=n('k10','m07');assert.equal(b.studio,b.ref,'k10 m07');
  const c=n('k08','m07');assert.equal(c.studio,c.ref,'k08 m07');
  const ref=load('k27','m14'),ps=parts(moduleFromEtalon(ref).module);
  for(const p of ps.filter(p=>p.id.startsWith('fast:')))assert.equal(Math.round(p.model!.origin![2]),330,p.id);
});
test('k24 m04: дно без крепежа к стойкам в Базисе (у торца только опора с саморезами 3x3) — студия конфирматы не добавляет (bareJoints): 8, как в Базисе',{skip:!existsSync(`${ETALON}/k24.json`)},()=>{
  const ref=load('k24','m04'),{module:m}=moduleFromEtalon(ref);
  assert.ok(m.kitchen?.bareJoints?.includes('bottom'));
  const c=compareModule(ref,m).hardware.find(h=>h.category==='конфирмат')!;
  assert.equal(c.ref,8);assert.equal(c.studio,8);
});
test('рафикс повёрнут как в Базисе (у левой стойки [0,1,0,0], у правой [0,0,0,1]): k16 m01 — все 36 сверены, другого поворота нет',{skip:!existsSync(`${ETALON}/k16.json`)},()=>{
  const ref=load('k16','m01'),{module:m}=moduleFromEtalon(ref);
  const r=compareModule(ref,m).hardware.find(h=>h.category==='рафикс')!;
  assert.deepEqual(r.rot,{checked:36,bad:0,spin:0,noQuat:0});
  for(const p of parts(m).filter(p=>p.id.startsWith('rafix:')&&!p.id.endsWith(':pin')))assert.deepEqual(p.quat,p.id.includes(':left:')?[0,1,0,0]:[0,0,0,1],p.id);
});