import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync,readFileSync} from 'node:fs';
import {validate,parts,parseModule,initialModule} from '../src/model';
import {holes} from '../src/drilling';
import {compareModule,honestPass,type RefModule} from '../scripts/kitchen/compare';
import {moduleFromEtalon} from '../scripts/kitchen/fromEtalon';
import {kitHeaderIdx,normalizeRefHardware} from '../scripts/kitchen/refHardware';
import {axisRearScrews,isAxis,isFirmax,parseKDrawers,type AxisDrawer,type FirmaxDrawer} from '../src/kitchenDrawers';
import {partCollisions} from '../src/collisions';
import {estimate} from '../src/pricing';
import {newProject} from '../src/project';

// n4-drawers: ящики кухонь Базиса (base-drawers) — ручная посадка из проекта и вложенные комплекты направляющих.
// Эталоны лежат вне репозитория (Кухни\etalon) — на чужой машине тесты с эталонами пропускаются.
const ETALON='C:/Users/My PC/Desktop/Claude Project/Кухни/etalon';
const has=(k:string)=>existsSync(`${ETALON}/${k}.json`);
const load=(k:string,key:string)=>(JSON.parse(readFileSync(`${ETALON}/${k}.json`,'utf8')).modules as RefModule[]).find(m=>m.key===key)!;
const pass=(k:string,key:string)=>{const ref=load(k,key),r=moduleFromEtalon(ref),c=compareModule(ref,r.module);return {m:r.module,ok:honestPass(c,validate(r.module),r.unsupported),c};};
const roundTrip=(m:ReturnType<typeof initialModule>)=>parseModule(JSON.parse(JSON.stringify(m)));

test('Axis PRO k18 m02: саморезы держателя задней стенки только крайние, дно ящика с кромкой по кругу — как в Базисе, PASS',{skip:!has('k18')},()=>{
  const {m,ok,c}=pass('k18','m02');
  assert.ok(ok,JSON.stringify(c.hardware.filter(h=>h.ref!==h.studio)));
  const k=m.kdrawers![0] as AxisDrawer;
  assert.deepEqual(k.rearScrews,[19,147]);assert.deepEqual(axisRearScrews(k),[19,147]);
  assert.equal(k.edge?.bottom,true);
  const bottom=parts(m).find(p=>p.id==='kd:0:bottom')!;assert.ok(bottom.edge.every(e=>e>0),'дно ящика — кромка по кругу');
  // накол D5×1 держателя — во всех трёх точках правила, саморез D3×3 — только в двух
  const hs=holes(m).filter(h=>h.src.startsWith('kd:0:')&&/rearL/.test(h.src));
  assert.equal(hs.filter(h=>h.d===5).length,3);assert.equal(hs.filter(h=>h.d===3).length,2);
  // сохранение и загрузка проекта не теряют флаги
  const back=roundTrip(m).kdrawers![0] as AxisDrawer;assert.deepEqual(back.rearScrews,[19,147]);assert.equal(back.edge?.bottom,true);
});

test('Axis PRO: по умолчанию все саморезы держателя и дно без кромки (флаги только из проекта Базиса)',()=>{
  const k:AxisDrawer={system:'axis-pro',y0:0,y1:300,runnerY:150,h:200,len:500};
  assert.deepEqual(axisRearScrews(k),[19,83,147]);
  const parsed=parseKDrawers([{...k,rearScrews:[19,'147'],edge:{bottom:['-z','+q']}}])![0] as AxisDrawer;
  assert.deepEqual(parsed.rearScrews,[19,147]);assert.deepEqual(parsed.edge?.bottom,['-z']);
});

test('Axis PRO k05 m04: дно с кромкой только по заднему торцу — как в Базисе',{skip:!has('k05')},()=>{
  const {m,c}=pass('k05','m04');
  assert.ok(m.kdrawers!.filter(isAxis).every(k=>JSON.stringify((k as AxisDrawer).edge?.bottom)==='["-z"]'));
  assert.equal(c.edges?.bad.length??0,0);
});

test('царга лёжа без крепежа в Базисе (k19 m10): студия не ставит конфирмат — PASS',{skip:!has('k19')},()=>{
  const {m,ok}=pass('k19','m10');
  assert.ok(ok);
  assert.equal(m.rails?.find(r=>r.place==='front-top')?.fasten,false);
  assert.ok(!parts(m).some(p=>p.id.startsWith('fast:rail:front-top')));
  assert.ok(parts(m).some(p=>p.id.startsWith('fast:rail:rear-top')),'задняя царга на конфирматах, как в Базисе');
});

test('Firmax k31 m15/m17: конфирматы снизу через дно, саморезы направляющей и глубина D5×42 — как в Базисе, PASS',{skip:!has('k31')},()=>{
  for(const key of ['m15','m17']){
    const {m,ok,c}=pass('k31',key);
    assert.ok(ok,key+' '+JSON.stringify(c.hardware.filter(h=>h.ref!==h.studio)));
    const k=m.kdrawers![0] as FirmaxDrawer;
    assert.ok(Array.isArray(k.box.confUnder)&&k.box.confUnder.length===3,key+': три конфирмата снизу на панель');
    assert.deepEqual(k.box.screwDz,[20,244]);assert.equal(k.box.confDepth,42);
    assert.ok(holes(m).filter(h=>h.src.startsWith('fast:kd:')&&h.d===5).every(h=>h.depth===42));
    assert.deepEqual(partCollisions(parts(m),m),[]);
    const back=roundTrip(m).kdrawers![0] as FirmaxDrawer;assert.deepEqual(back.box.confUnder,k.box.confUnder);assert.deepEqual(back.box.screwDz,[20,244]);assert.equal(back.box.confDepth,42);
  }
});

test('Firmax без вложенной посадки (k19 m10, k14 m10): конфирматов снизу нет, саморезы и глубина — по правилу',{skip:!has('k19')||!has('k14')},()=>{
  for(const [k,key] of [['k19','m10'],['k14','m10']] as const){
    const {m}=pass(k,key);
    for(const d of m.kdrawers!.filter(isFirmax)){assert.equal(d.box.confUnder,undefined);assert.equal(d.box.screwDz,undefined);assert.equal(d.box.confDepth,undefined);}
    assert.ok(holes(m).filter(h=>h.src.startsWith('fast:kd:')&&h.d===5).every(h=>h.depth===37));
  }
});

test('вложенные комплекты направляющих: член комплекта в точке-якоре — та же направляющая, не вторая (k09, k30, k31); пары Firmax k14 и Versalite k10 не трогаем',
  {skip:!has('k09')||!has('k14')||!has('k10')||!has('k31')},()=>{
  const n=(k:string,key:string)=>kitHeaderIdx(load(k,key).hardware as never).size;
  assert.equal(n('k09','m05'),6);assert.equal(n('k31','m15'),4);assert.equal(n('k14','m10'),0);assert.equal(n('k10','m12'),0);
  // эталон: членов комплекта среди направляющих нет, индексы (src отверстий) сохраняются
  const hw=load('k09','m05').hardware,nh=normalizeRefHardware(hw);
  assert.equal(nh.length,hw.length);assert.equal(nh.filter(h=>h.category==='направляющая').length,6);
  // студия: по две направляющие на ящик MODERN SLIDE (было по четыре — две лишние в той же точке)
  const {m}=pass('k09','m05');
  for(const j of [0,1,2])assert.equal(parts(m).filter(p=>p.id.startsWith(`kd:${j}:slide:`)).length,2);
});

test('короб Firmax без направляющих в проекте Базиса (k22 m05): ящики распознаны, направляющих и их строки сметы нет — PASS',{skip:!has('k22')},()=>{
  const {m,ok}=pass('k22','m05');
  assert.ok(ok);
  assert.equal(m.kdrawers?.length,2);assert.ok(m.kdrawers!.every(k=>isFirmax(k)&&Array.isArray(k.box.runs)&&k.box.runs.length===0));
  assert.ok(!parts(m).some(p=>/Направляющая/.test(p.name)),'направляющих в Базисе нет — студия не добавляет');
  assert.ok(!parts(m).some(p=>p.role==='shelf'),'дно ящика — не полка');
  const lines=estimate(newProject({...m,bazis:true} as typeof m)).lines;
  assert.ok(!lines.some(l=>/^firmax/.test(l.id)),JSON.stringify(lines.map(l=>l.id)));
});
