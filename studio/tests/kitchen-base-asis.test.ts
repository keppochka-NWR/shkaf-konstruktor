import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync,readFileSync} from 'node:fs';
import {validate,parts,parseModule,initialModule,fastenerCounts} from '../src/model';
import {kitchenBase} from '../src/kitchen';
import {estimate} from '../src/pricing';
import {newProject} from '../src/project';
import {compareModule,type RefModule} from '../scripts/kitchen/compare';
import {moduleFromEtalon} from '../scripts/kitchen/fromEtalon';
import {edgesAllAround,edgesNone,sideTopBare,pinInsetFront} from '../scripts/kitchen/recognize-base';
import {edgeByDir} from '../src/edges';

// Правило Макса: в кухню из Базиса студия не добавляет того, чего нет в Базисе (петли, опоры, крепёж, кромка, строки сметы).
// Эталоны лежат вне репозитория (Кухни\etalon) — на чужой машине тесты с эталонами пропускаются.
const ETALON='C:/Users/My PC/Desktop/Claude Project/Кухни/etalon';
const has=(k:string)=>existsSync(`${ETALON}/${k}.json`);
const load=(k:string,key:string)=>(JSON.parse(readFileSync(`${ETALON}/${k}.json`,'utf8')).modules as RefModule[]).find(m=>m.key===key)!;
const why=(c:ReturnType<typeof compareModule>)=>JSON.stringify({missing:c.missing.map(x=>x.name),extra:c.extra.map(x=>x.name),hw:c.hardware.filter(h=>h.ref!==h.studio),edges:c.edges?.bad.slice(0,3),holes:c.holes?.extra.slice(0,3)});
const hingeIds=(m:ReturnType<typeof initialModule>)=>parts(m).filter(p=>/:(hingecup|hingeplate|latch):/.test(p.id));
const priced=(m:ReturnType<typeof initialModule>)=>{const p=newProject(m);return estimate(p).lines.map(l=>l.id);};

test('фасад без петель (k13 m06): фасад есть, петель нет ни в 3D, ни в присадке, ни в смете — сверка PASS',{skip:!has('k13')},()=>{
  const ref=load('k13','m06');
  const {module:m}=moduleFromEtalon(ref);
  assert.equal(m.doors,true);
  assert.equal(m.kitchen?.hinges,false);
  assert.deepEqual(validate(m),[]);
  assert.equal(hingeIds(m).length,0);
  assert.ok(!priced(m).some(id=>id.startsWith('hinge')),'в смете нет петель');
  const c=compareModule(ref,m);
  assert.ok(c.pass,why(c));
});

test('без опор и без крепежа, кромка по кругу (k32 m09): нет ошибки «на опоры», нет конфирматов/полкодержателей и мелочёвки — сверка PASS',{skip:!has('k32')},()=>{
  const ref=load('k32','m09');
  const {module:m}=moduleFromEtalon(ref);
  assert.equal(m.kitchen?.noLegs,true);
  assert.equal(m.kitchen?.fasteners,false);
  assert.equal(m.edgeScheme?.all,true);
  assert.equal(edgesAllAround(ref),1);
  assert.deepEqual(validate(m),[]);
  assert.ok(!parts(m).some(p=>/^(fast|ecc|dowel|shp|leg):/.test(p.id)));
  assert.deepEqual(fastenerCounts(m),{confirmats:0,shelfHolders:0,eccentrics:0});
  const ids=priced(m);
  for(const id of ['confirmat-7x50','confirmat-cap','shelf-holder','kit','kitchen-leg'])assert.ok(!ids.includes(id),'в смете нет '+id);
  const c=compareModule(ref,m);
  assert.ok(c.pass,why(c));
});

test('без кромки (k23 m12): у Базиса на корпусе ни одной кромки — у студии тоже; фасад без петель — сверка PASS',{skip:!has('k23')},()=>{
  const ref=load('k23','m12');
  assert.equal(edgesNone(ref),true);
  const {module:m}=moduleFromEtalon(ref);
  assert.equal(m.edgeScheme?.t,0);
  for(const p of parts(m))if(p.material==='board'&&p.role!=='door')assert.deepEqual(p.edge,[0,0,0,0],p.id);
  const c=compareModule(ref,m);
  assert.ok(c.pass,why(c));
});

test('верх боковин без кромки (k20 m08, k03): у нижнего Базиса верхний торец боковин не кромлен — у студии тоже, сверка k20 m08 PASS',{skip:!has('k20')||!has('k03')},()=>{
  const ref=load('k20','m08');
  assert.equal(sideTopBare(ref),true);
  const {module:m}=moduleFromEtalon(ref);
  assert.equal(m.edgeScheme?.sideTop,false);
  for(const id of ['left','right']){const p=parts(m).find(x=>x.id===id)!;assert.equal(edgeByDir(p)['+y'],undefined,id);assert.ok(edgeByDir(p)['+z']>0,id);}
  const c=compareModule(ref,m);
  assert.ok(c.pass,why(c));
  assert.equal(moduleFromEtalon(load('k03','m02')).module.edgeScheme?.sideTop,false);
  // обычный нижний Базиса (k25 m07) — верх боковин кромится, как раньше
  if(has('k25'))assert.equal(moduleFromEtalon(load('k25','m07')).module.edgeScheme?.sideTop,undefined);
});

test('полкодержатели не симметричны по глубине (k18 m03: задние 50,5, передние 46,5) — как в Базисе; у шкафа поле не действует',{skip:!has('k18')},()=>{
  const ref=load('k18','m03');
  const {module:m}=moduleFromEtalon(ref);
  assert.equal(m.shelfPinInset,50.5);
  assert.equal(m.shelfPinInsetFront,46.5);
  assert.equal(pinInsetFront(ref,50.5),46.5);
  const row=compareModule(ref,m).hardware.find(h=>h.category==='полкодержатель')!;
  assert.equal(row.ref,row.studio);
  assert.ok((row.maxPosDelta??0)<=0.5,'Δ '+row.maxPosDelta);
  // шкаф: передний отступ без кухни игнорируется — держатели симметричны, как раньше
  const w={...initialModule(),shelfPinInset:50,shelfPinInsetFront:30};
  const zs=parts(w).filter(p=>p.id.startsWith('shp:')&&p.id.includes(':shelf:0:')).map(p=>p.position[2]);
  const sh=parts(w).find(p=>/:shelf:0$/.test(p.id))!;
  assert.ok(zs.length===4);
  assert.equal(Math.round((Math.min(...zs)-(sh.position[2]-sh.size[2]/2))*10)/10,Math.round(((sh.position[2]+sh.size[2]/2)-Math.max(...zs))*10)/10);
});

test('флаги «как в Базисе» не трогают обычную кухню палитры и шкафы: петли, опоры и крепёж на месте',()=>{
  const m=kitchenBase(initialModule(),600);
  assert.ok(hingeIds(m).length>0,'петли есть');
  assert.ok(parts(m).some(p=>p.id.startsWith('leg:')),'опоры есть');
  assert.ok(parts(m).some(p=>p.id.startsWith('fast:')),'конфирматы есть');
  assert.ok(priced(m).some(id=>id.startsWith('hinge')),'петли в смете');
  const w=initialModule();
  assert.equal(w.kitchen,undefined);
  assert.ok(parts(w).some(p=>p.id.startsWith('fast:')));
  // без кухни флаг ничего не делает; кухня без опор без флага — ошибка, как раньше
  assert.ok(validate({...m,feet:undefined}).includes('Нижний кухонный корпус ставится на опоры.'));
  assert.ok(!validate({...m,feet:undefined,kitchen:{...m.kitchen!,noLegs:true}}).includes('Нижний кухонный корпус ставится на опоры.'));
});

test('флаги «как в Базисе» переживают сохранение проекта (parseModule)',()=>{
  const m=kitchenBase(initialModule(),600);
  const x={...m,kitchen:{...m.kitchen!,hinges:false as const,noLegs:true as const,fasteners:false as const},edgeScheme:{t:1,all:true as const,sideTop:false as const}};
  const back=parseModule(JSON.parse(JSON.stringify(x)));
  assert.equal(back.kitchen?.hinges,false);
  assert.equal(back.kitchen?.noLegs,true);
  assert.equal(back.kitchen?.fasteners,false);
  assert.equal(back.edgeScheme?.all,true);
  assert.equal(back.edgeScheme?.sideTop,false);
  assert.equal(parseModule(JSON.parse(JSON.stringify({...m,edgeScheme:{t:0}}))).edgeScheme?.t,0);
});
