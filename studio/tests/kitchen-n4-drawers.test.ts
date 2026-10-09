import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync,readFileSync} from 'node:fs';
import {validate,parts,parseModule,initialModule} from '../src/model';
import {holes} from '../src/drilling';
import {compareModule,honestPass,type RefModule} from '../scripts/kitchen/compare';
import {moduleFromEtalon} from '../scripts/kitchen/fromEtalon';
import {kitHeaderIdx,normalizeRefHardware} from '../scripts/kitchen/refHardware';
import {axisRearScrews,isAxis,isFirmax,parseKDrawers,relayoutKDrawers,refitKDrawers,type AxisDrawer,type FirmaxDrawer} from '../src/kitchenDrawers';
import {kitchenBase} from '../src/kitchen';
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

// конфирматы снизу через дно списком: x — от внутренней грани левой боковины ящика (центры по дну), берём из 3D
const underXs=(ps:ReturnType<typeof parts>,j:number)=>{const bot=ps.find(p=>p.id===`kd:${j}:fx:bottom`)!,x0=bot.position[0]-bot.size[0]/2;
  return {iw:bot.size[0],xs:ps.filter(p=>p.id.startsWith(`fast:kd:${j}:fx:under:back:`)).map(p=>Math.round((p.position[0]-x0)*10)/10).sort((a,b)=>a-b)};};
const fxKitchen=(w:number)=>{const m=kitchenBase(initialModule(),w,'drawers' as never);m.doors=false;m.sections[0].shelves=[];m.sections[0].drawers=0;
  m.kdrawers=relayoutKDrawers(m,2,undefined,'firmax-ldsp');return m;};

test('Firmax: конфирматы снизу через дно списком держатся за свои боковины при смене ширины (отступ / середина / отступ от правой), за дном — ошибка проверки',()=>{
  const m=fxKitchen(720),iw0=underXs(parts({...m,kdrawers:m.kdrawers!.map(k=>({...k,box:{...(k as FirmaxDrawer).box,confUnder:[1]}}))} as typeof m),0).iw;
  m.kdrawers=m.kdrawers!.map(k=>({...(k as FirmaxDrawer),box:{...(k as FirmaxDrawer).box,confUnder:[63.5,iw0/2,iw0-63.5],confUnderW:iw0}}));
  for(const w of [720,600,450,900]){
    const n={...m,width:w};
    for(const j of [0,1]){const {iw,xs}=underXs(parts(n),j);assert.deepEqual(xs,[63.5,iw/2,iw-63.5],`ширина ${w}`);}
    assert.ok(!validate(n).some(e=>/снизу через дно/.test(e)),`ширина ${w}: `+validate(n).join('; '));
    // присадка идёт за конфирматами: D8×16 в дне — в тех же точках
    const bot=parts(n).find(p=>p.id==='kd:0:fx:bottom')!,x0=bot.position[0]-bot.size[0]/2;
    const d8=holes(n).filter(h=>h.part==='kd:0:fx:bottom'&&h.d===8).map(h=>Math.round((h.at[0]-x0)*10)/10);
    assert.ok(d8.length>0&&d8.every(x=>x>3.5&&x<bot.size[0]-3.5),`ширина ${w}: D8 в дне ${d8}`);
  }
  // узкий корпус: точки от боковин сходятся — проверка пишет, а не молчит
  assert.ok(validate({...m,width:200}).some(e=>/снизу через дно/.test(e)),validate({...m,width:200}).join('; '));
  // старый проект без ширины точек: точка за дном — ошибка проверки
  const old={...m,width:600,kdrawers:m.kdrawers!.map(k=>({...(k as FirmaxDrawer),box:{...(k as FirmaxDrawer).box,confUnder:[63.5,iw0/2,iw0-63.5],confUnderW:undefined}}))};
  assert.ok(validate(old).some(e=>/снизу через дно/.test(e)));
  // сохранение и загрузка, смена высоты корпуса — ширина точек не теряется
  assert.equal((roundTrip(m).kdrawers![0] as FirmaxDrawer).box.confUnderW,iw0);
  const h={...m,height:m.height-60};h.kdrawers=refitKDrawers(h,'height');assert.equal((h.kdrawers![0] as FirmaxDrawer).box.confUnderW,iw0);
});

test('Firmax k31 m15: при смене ширины модуля (720 → 600, 450) конфирматы снизу через дно — 63,5 от боковин и посередине, в дне',{skip:!has('k31')},()=>{
  const {m}=pass('k31','m15'),k=m.kdrawers![0] as FirmaxDrawer;
  assert.equal(k.box.confUnderW,639);
  for(const w of [600,450]){
    const n={...m,width:w};
    for(const j of [0,1]){const {iw,xs}=underXs(parts(n),j);assert.deepEqual(xs,[63.5,iw/2,iw-63.5],`ширина ${w}`);}
    assert.ok(!validate(n).some(e=>/снизу через дно/.test(e)));
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

test('релинг Axis PRO (k05 m04/m06, k08 m05): сетки Базиса, саморезы и присадка в заднюю стенку и фасад, строка сметы — PASS, без пересечений',{skip:!has('k05')||!has('k08')},()=>{
  for(const [k,key,n] of [['k05','m04',1],['k05','m06',2],['k08','m05',1]] as const){
    const {m,ok,c}=pass(k,key);
    assert.ok(ok,k+key+' '+JSON.stringify(c.hardware.filter(h=>h.ref!==h.studio)));
    assert.equal(m.kdrawers!.filter(d=>isAxis(d)&&(d as AxisDrawer).rail).length,n);
    assert.equal(parts(m).filter(p=>/:sys:rail:/.test(p.id)).length,2*n);
    assert.deepEqual(partCollisions(parts(m),m),[]);
    const hs=holes(m).filter(h=>/:rail[FB]/.test(h.src));assert.equal(hs.filter(h=>h.d===3.5).length,2*n);assert.equal(hs.filter(h=>h.d===5).length,4*n);
    const lines=estimate(newProject(m)).lines.filter(l=>l.id.startsWith('axis-rail:'));assert.equal(lines.reduce((s,l)=>s+l.quantity,0),n);
    assert.equal((roundTrip(m).kdrawers!.find(d=>isAxis(d)&&(d as AxisDrawer).rail) as AxisDrawer|undefined)?.rail,true);
  }
  // без релинга в проекте (k04 m01) — его нет ни в 3D, ни в смете
  const {m}=pass('k04','m01');assert.ok(!parts(m).some(p=>/:sys:rail:/.test(p.id)));assert.ok(!estimate(newProject(m)).lines.some(l=>l.id.startsWith('axis-rail:')));
});

test('узкая жёсткая полка у задника (глубина 100, k27 m02, k31 m16): один конфирмат посередине на сторону — как в Базисе',{skip:!has('k27')||!has('k31')},()=>{
  for(const [k,key] of [['k27','m02'],['k31','m16']] as const){
    const {m,c}=pass(k,key);
    const hw=c.hardware.find(h=>h.category==='конфирмат')!;assert.equal(hw.studio,hw.ref,k+key);
    const sh=parts(m).filter(p=>/^fast:S:shelf:\d+:left/.test(p.id)||/^fast:.*:shelf:\d+:left/.test(p.id));
    assert.equal(sh.length,1,k+key+' '+sh.map(p=>p.id).join());
  }
});

test('кухня: узкая жёсткая полка-планка 70 у задника (k18 m06) допустима, у шкафа студии — по-прежнему от 100',{skip:!has('k18')},()=>{
  const {m,ok}=pass('k18','m06');assert.ok(ok);assert.equal(m.sections[0].shelfDepth,70);
  const w=initialModule();w.sections[0].shelfDepth=70;assert.ok(validate(w).some(e=>/глубина полок должна быть от 100/.test(e)));
});

test('Indigo k16 m05 (зеркальный модуль Базиса): сетки зеркального набора, как в Базисе, без пересечений; k16 m04 - обычный набор',{skip:!has('k16')},()=>{
  const ref=load('k16','m05'),{m,ok}=pass('k16','m05');assert.ok(ok);
  assert.ok(m.kdrawers!.every(k=>(k as {mirror?:true}).mirror===true));
  const ps=parts(m),meshes=new Set(ps.filter(p=>/Indigo/.test(p.name)&&p.model).map(p=>/([0-9a-f]{12})\.glb/.exec(p.model!.file)?.[1]));
  for(const h of ref.hardware.filter(h=>/Indigo/.test(h.name)&&h.mesh)) assert.ok(meshes.has(h.mesh!),`сетка Базиса ${h.mesh} (${h.name})`);
  assert.equal(partCollisions(ps,m).length,0);
  assert.ok(roundTrip(m).kdrawers!.every(k=>(k as {mirror?:true}).mirror===true),'зеркальность не теряется при сохранении');
  const r4=pass('k16','m04');assert.ok(r4.ok);assert.ok(r4.m.kdrawers!.every(k=>!(k as {mirror?:true}).mirror));
});

test('Axis PRO внутренний ящик (k21 m03, k25 m05, k29 m03): без своего фасада, утоплен на 9, держатели передней панели и стабилизатор - как в Базисе',{skip:!has('k21')||!has('k25')||!has('k29')},()=>{
  for(const [k,key] of [['k21','m03'],['k25','m05'],['k29','m03']] as const){
    const ref=load(k,key),r=moduleFromEtalon(ref),m=r.module,c=compareModule(ref,m);
    const inn=m.kdrawers!.filter(d=>isAxis(d)&&(d as AxisDrawer).inner) as AxisDrawer[];
    assert.equal(inn.length,1,`${k} ${key}`);assert.equal(inn[0].front,9);
    const ps=parts(m),j=m.kdrawers!.indexOf(inn[0]);
    assert.ok(!ps.some(p=>p.id===`kd:${j}:facade`),`${k} ${key}: у внутреннего ящика нет своего фасада`);
    assert.equal(ps.filter(p=>p.id.startsWith(`kd:${j}:sys:pp:`)).length,2);assert.ok(ps.some(p=>p.id===`kd:${j}:sys:stab`));
    // передняя панель - позиция Базиса без модели: точка-метка в студии, строка сметы «внутренний ящик» одна на ящик
    assert.ok(ps.some(p=>p.id===`kd:${j}:sys:ppanel`),'метка передней панели');
    if(k!=='k25'){const hs=c.hardware.find(h=>h.category==='ящик-система')!;assert.equal(hs.studio,hs.ref,`${k} ${key}: ящик-система`);assert.ok((hs.maxPosDelta??0)<0.5);}
    if(k!=='k21'){const lines=estimate(newProject(m)).lines.filter(l=>l.id.startsWith('axis-pro:inner:'));assert.equal(lines.reduce((s,l)=>s+l.quantity,0),1);}
    assert.equal(c.holes!.matched,c.holes!.ref,`${k} ${key}: отверстия ${c.holes!.matched}/${c.holes!.ref}`);
    assert.ok(!validate(m).some(e=>/фасад пересекается/.test(e)),validate(m).join('; '));
    const rt=parseKDrawers(JSON.parse(JSON.stringify(m.kdrawers)))![j] as AxisDrawer;assert.ok(rt.inner&&rt.front===9,'внутренний ящик не теряется при сохранении');
  }
  // k25 m05: задняя стенка внутреннего ящика в 6 мм от края боковин - в Базисе так, проверка не ругается;
  // нижний ящик со своим фасадом утоплен на 1,5 (как в Базисе), присадка держателя фасада - в фасад, как в Базисе
  const k25=moduleFromEtalon(load('k25','m05')).module;
  assert.deepEqual(validate(k25).filter(e=>/глубину/.test(e)),[]);
  assert.equal((k25.kdrawers![0] as AxisDrawer).front,1.5);assert.ok(!(k25.kdrawers![0] as AxisDrawer).inner);
  // «Logo» на царге - как в проекте (все 3 ящика k25 m05), модуль проходит сверку целиком
  assert.ok(k25.kdrawers!.every(k=>(k as AxisDrawer).logo));assert.ok(pass('k25','m05').ok,'k25 m05 PASS');
  assert.ok(!moduleFromEtalon(load('k29','m03')).module.kdrawers!.some(k=>(k as AxisDrawer).logo),'без Logo в Базисе - студия его не ставит');
  // k21 m03: ящики 500 в корпусе 447 - ошибка проекта Базиса (короба выходят за задник), проверка её показывает
  assert.ok(validate(moduleFromEtalon(load('k21','m03')).module).some(e=>/не входит в глубину корпуса 447/.test(e)));
});

test('Firmax вместе с внутренним Axis PRO (k30 m12/m13): короба и внутренний ящик распознаны, конфирматы снизу через дно D5x35 как в Базисе',{skip:!has('k30')},()=>{
  for(const key of ['m12','m13']){
    const ref=load('k30',key),r=moduleFromEtalon(ref),m=r.module,c=compareModule(ref,m);
    assert.deepEqual(m.kdrawers!.map(k=>k.system),['firmax-ldsp','firmax-ldsp','axis-pro'],key);
    assert.ok((m.kdrawers![2] as AxisDrawer).inner);
    assert.equal(c.missing.length,0,key);assert.equal(c.extra.length,0,key);
    assert.ok(c.holes!.matched>=c.holes!.ref-2,`${key}: отверстия ${c.holes!.matched}/${c.holes!.ref}`);
    const d5=holes(m).filter(h=>h.part.startsWith('kd:0:fx:back')&&h.d===5&&Math.abs(h.dir?.[1]??0)>0.5);
    assert.ok(d5.length>0&&d5.every(h=>h.depth===35),`${key}: D5 снизу ${d5.map(h=>h.depth)}`);
    assert.ok(!validate(m).length,validate(m).join('; '));
  }
});
