import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync,readFileSync} from 'node:fs';
import {validate,parts,initialModule,parseModule,faceFillerEdge} from '../src/model';
import {compareModule,honestPass,type RefModule} from '../scripts/kitchen/compare';
import {moduleFromEtalon} from '../scripts/kitchen/fromEtalon';
import {faceGapsTB,strayDoors} from '../scripts/kitchen/recognize-base';
import {holes} from '../src/drilling';
import {partCollisions} from '../src/collisions';
import {railFastened} from '../scripts/kitchen/recognize-common';
import {cornerFillerSink,falsePanelHinges} from '../scripts/kitchen/recognize-sink';

// Нижние модули кухни «как в Базисе» (поток n4). Эталоны вне репозитория — на чужой машине тесты с эталонами пропускаются.
const ETALON='C:/Users/My PC/Desktop/Claude Project/Кухни/etalon';
const has=(k:string)=>existsSync(`${ETALON}/${k}.json`);
const load=(k:string,key:string)=>(JSON.parse(readFileSync(`${ETALON}/${k}.json`,'utf8')).modules as RefModule[]).find(m=>m.key===key)!;
const why=(c:ReturnType<typeof compareModule>)=>JSON.stringify({missing:c.missing.map(x=>x.name),extra:c.extra.map(x=>x.name),hw:c.hardware.filter(h=>h.ref!==h.studio),edges:c.edges?.bad.slice(0,3),holes:c.holes?.extra.slice(0,3)});
const pass=(k:string,key:string)=>{const ref=load(k,key);const r=moduleFromEtalon(ref);const err=validate(r.module);const c=compareModule(ref,r.module);return {ok:honestPass(c,err,r.unsupported),m:r.module,info:why(c)+JSON.stringify(err)+JSON.stringify(r.unsupported)};};

test('глухой фасад под нишей духовки (k03 m01, k06 m04): фасад без петель ниже верха корпуса на высоту ниши — сверка PASS',{skip:!has('k03')||!has('k06')},()=>{
  for(const [k,key] of [['k03','m01'],['k06','m04']] as const){
    const r=pass(k,key);
    assert.ok(r.ok,`${k} ${key}: ${r.info}`);
    assert.equal(r.m.kitchen?.hinges,false);
    assert.ok((r.m.kitchen?.faceTop??0)>500,'верх фасада — под нишей');
    assert.equal(parts(r.m).filter(p=>/:(hingecup|hingeplate):/.test(p.id)).length,0,'петель нет');
  }
});

test('ниша над фасадом — только у фасада без петель: с петлями большой отступ не зазор (k22 m06)',{skip:!has('k22')},()=>{
  const ref=load('k22','m06');
  assert.equal(faceGapsTB(ref,1.5),undefined);
  assert.equal(moduleFromEtalon(ref).module.kitchen?.faceTop,undefined);
});

test('минимум высоты распашного фасада 200 снят только у кухни без петель; шкафы и кухня с петлями — как было',()=>{
  const m=initialModule();
  assert.ok(!validate(m).some(e=>e.includes('ниже 200')));
  const k=moduleFromEtalon(has('k03')?load('k03','m01'):({} as RefModule));
  if(has('k03')){
    const withHinges={...k.module,kitchen:{...k.module.kitchen!,hinges:undefined}};
    assert.ok(validate(withHinges).some(e=>e.includes('ниже 200')),'с петлями фасад 117 мм — ошибка, как раньше');
  }
});

test('угловая мойка с плоским фальшем (k25 m02): фальш ЛДСП + планка из фасада + дверь на петлях под фальшпанель — сверка PASS',{skip:!has('k25')},()=>{
  const r=pass('k25','m02');
  assert.ok(r.ok,r.info);
  assert.deepEqual(r.m.kitchen?.faceFiller,{side:'left',width:273,strip:59});
  const ps=parts(r.m);
  assert.ok(ps.some(p=>p.id==='face-filler:panel:facade'&&!p.external),'фальш — ЛДСП корпуса, в раскрое');
  assert.ok(ps.some(p=>p.id==='face-filler:strip:facade'&&p.external),'планка — фасадный материал');
  const plates=ps.filter(p=>p.id.includes(':hingeplate:'));
  assert.equal(plates.length,3);
  assert.ok(plates.every(p=>p.name.startsWith('Петля под фальшпанель')&&Math.abs(p.model!.origin![0]-333.5)<0.01),'точка петли — кромка двери');
  const hs=holes(r.m);
  assert.equal(hs.filter(h=>h.d===35).length,3,'чашки Ø35');
  assert.equal(hs.filter(h=>h.d===3&&h.depth===3&&h.src.includes(':hingeplate:')).length,0,'наколок под планку нет');
  assert.equal(partCollisions(ps,r.m).filter(c=>/face-filler|hinge/.test(c.a+' '+c.b)).length,0,'фальш и петли ни с чем не пересекаются');
});

test('угловая мойка: Г-образный фальш (планки поперёк, k05 m05) — не плоский, честно не поддержано; дверь у k01 m03 — на стороне фальша',{skip:!has('k05')||!has('k01')},()=>{
  const r=moduleFromEtalon(load('k05','m05'));
  assert.equal(r.module.kitchen?.faceFiller,undefined);
  assert.ok(r.unsupported.some(u=>u.includes('угловая мойка')));
  const k01=moduleFromEtalon(load('k01','m03')).module;
  assert.deepEqual(k01.kitchen?.faceFiller,{side:'left',width:500});
  assert.equal(k01.sections[0].hingeSide,'left');
});

test('фальш мойки сохраняется в проекте (parseModule); планка по высоте фальша у k28 m17; кухня до 1650 мм шириной, шкаф — до 1300',{skip:!has('k25')||!has('k28')},()=>{
  const m=moduleFromEtalon(load('k25','m02')).module;
  const back=parseModule(JSON.parse(JSON.stringify(m)));
  assert.deepEqual(back.kitchen?.faceFiller,m.kitchen?.faceFiller);
  assert.deepEqual(parts(back).map(p=>p.id),parts(m).map(p=>p.id));
  const k28=moduleFromEtalon(load('k28','m17')).module;
  assert.equal(k28.kitchen?.faceFiller?.stripFull,true);
  assert.ok(!validate(k28).some(e=>e.startsWith('Ширина')),'мойка 1480 — без ошибки ширины');
  const w=initialModule();w.width=1480;
  assert.ok(validate(w).some(e=>e.startsWith('Ширина')),'шкаф 1480 — ошибка, как раньше');
});

test('поле «Ширина» во вкладке Кухня — тот же предел, что в проверке кухни (KITCHEN.maxModuleWidth), а не 1200: мойку 1480 можно править',()=>{
  const src=readFileSync(new URL('../src/KitchenPanel.tsx',import.meta.url),'utf8');
  const field=src.split('\n').find(l=>l.includes('label="Ширина"'))!;
  assert.ok(field.includes('max={KITCHEN.maxModuleWidth}'),field);
  const k=initialModule();k.kitchen={role:'base'} as never;k.width=1480;
  assert.ok(!validate(k).some(e=>e.startsWith('Ширина')),'кухонный модуль 1480 проходит проверку ширины');
});

test('мойка 1480 с фальшем и планкой во всю высоту (k28 m17): два ряда опор, свои отступы конфирматов дна справа — сверка PASS',{skip:!has('k28')},()=>{
  const r=pass('k28','m17');
  assert.ok(r.ok,r.info);
  assert.equal(r.m.kitchen?.legs?.xs,undefined);assert.equal(r.m.kitchen?.legs?.side,70);assert.equal(r.m.kitchen?.legs?.rows2,true);
  const legX=(m:typeof r.m)=>[...new Set(parts(m).filter(p=>p.id.startsWith('leg:')).map(p=>Math.round(p.model!.origin![0])))].sort((a,b)=>a-b);
  assert.deepEqual(legX(r.m),[70,1410],'два ряда опор, как в Базисе');
  // смена ширины: правые опоры идут за боковиной (70 от торца), третий ряд не появляется; проект сохраняет признак
  const w={...r.m,width:1400};assert.deepEqual(legX(w),[70,1330]);
  assert.equal(parseModule(JSON.parse(JSON.stringify(r.m))).kitchen?.legs?.rows2,true);
  // без признака у широкого кухонного модуля — третий ряд посередине, как было
  const no={...r.m,kitchen:{...r.m.kitchen!,legs:{...r.m.kitchen!.legs!,rows2:undefined}}};assert.deepEqual(legX(no),[70,740,1410]);
  assert.deepEqual(r.m.kitchen?.jointZ,{'bottom:right':[252,52]});
});

test('петля под фальшпанель — узел как в Базисе: точка и поворот [0,0,±1,0] у всех (k25 m02, k28 m17), без сетки ECHC; обычные петли — как были',{skip:!has('k25')||!has('k28')},()=>{
  const same=(a:number[],b:number[])=>Math.abs(a.reduce((s,v,i)=>s+v*b[i],0))/(Math.hypot(...a)*Math.hypot(...b))>0.999;
  for(const [k,key,nFf,nPlain] of [['k25','m02',3,0],['k28','m17',2,2]] as const){
    const ref=load(k,key),r=moduleFromEtalon(ref),ps=parts(r.module),c=compareModule(ref,r.module);
    const ffRef=ref.hardware.filter(h=>/под фальшпанель/.test(h.name)),nodes=ps.filter(p=>p.id.includes(':hingeplate:')&&p.falsePanelHinge);
    assert.equal(ffRef.length,nFf);assert.equal(nodes.length,nFf);
    // точки — сверка (Δ0 ниже); поворот каждого узла — как у петли Базиса (пары по высоте)
    const ry=[...ffRef].sort((a,b)=>a.pos[1]-b.pos[1]),sy=[...nodes].sort((a,b)=>a.model!.origin![1]-b.model!.origin![1]);
    ry.forEach((h,i)=>assert.ok(same(h.quat!,sy[i].model!.quat!),`${k} ${key}: поворот ${sy[i].model!.quat} ≠ Базис ${h.quat}`));
    assert.ok(nodes.every(p=>p.model!.node&&p.model!.file===''&&p.name==='Петля под фальшпанель · узел'),'узел без сетки');
    const cups=ps.filter(p=>p.id.includes(':hingecup:')&&p.falsePanelHinge);
    assert.equal(cups.length,nFf);assert.ok(cups.every(p=>p.name==='Петля под фальшпанель · чашка Ø35'),'чашка названа как петля');
    const plain=ps.filter(p=>p.id.includes(':hingeplate:')&&!p.falsePanelHinge);
    assert.equal(plain.length,nPlain);assert.ok(plain.every(p=>p.model!.file==='hardware/bazis/d7e1d3957ebe.glb'),'обычные петли — сетка ECHC, как было');
    const row=c.hardware.find(h=>h.category==='петля')!;
    assert.equal(row.ref,row.studio);assert.equal(row.maxPosDelta,0);
    assert.ok(!row.info&&!row.note&&!row.quatDiff,`${k} ${key}: поворот петель совпадает с Базисом (${row.info})`);
    // присадка: чашка Ø35×13 в 22 от кромки двери (точка узла), наколок нет
    const hs=holes(r.module).filter(h=>h.d===35);
    for(const n of nodes){const cupX=ps.find(p=>p.id===n.id.replace(':hingeplate:',':hingecup:'))!.model!.origin![0];
      assert.equal(Math.round(Math.abs(cupX-n.model!.origin![0])*10)/10,22);
      assert.ok(hs.some(h=>Math.abs(h.at[0]-cupX)<0.01&&Math.abs(h.at[1]-n.model!.origin![1])<0.01&&h.depth===13),'чашка в точке чашки');}
    assert.equal(partCollisions(ps,r.module).filter(x=>/hinge/.test(x.a+' '+x.b)).length,0,`${k} ${key}: петли ни с чем не пересекаются`);
  }
});

test('кромка фасадов у фальша — одно место (faceFillerEdge): размах двери и точка петли под фальшпанель совпадают; без фальша — нет',{skip:!has('k25')||!has('k28')},()=>{
  for(const [k,key,x] of [['k25','m02',333.5],['k28','m17',531]] as const){
    const m=moduleFromEtalon(load(k,key)).module,ps=parts(m),fx=faceFillerEdge(m)!;
    const nodes=ps.filter(p=>p.id.includes(':hingeplate:')&&p.falsePanelHinge);
    assert.ok(nodes.length>0&&nodes.every(p=>Math.abs(p.model!.origin![0]-fx)<0.01),`${k} ${key}: точка петли = кромка фасадов`);
    // в общей системе Базиса (минимум панелей) кромка — как у петли Базиса
    const x0=Math.min(...ps.filter(p=>p.material==='board'||p.material==='hdf').map(p=>p.position[0]-p.size[0]/2));
    assert.equal(Math.round((fx-x0)*10)/10,Math.round((x-Math.min(...load(k,key).panels.map(p=>p.box[0])))*10)/10);
  }
  assert.equal(faceFillerEdge(initialModule()),undefined);
});

test('петли под фальшпанель — один фильтр для признака угловой мойки и плоского фальша (falsePanelHinges)',()=>{
  const hw=[{i:0,name:'Петля под фальшпанель',category:'петля',pos:[502,201,560]},{i:1,name:'Петля накладная',category:'петля',pos:[934,201,560]}] as RefModule['hardware'];
  assert.deepEqual(falsePanelHinges({hardware:hw}).map(h=>h.i),[0]);
  assert.equal(cornerFillerSink({hardware:hw}),true);assert.equal(cornerFillerSink({hardware:[hw[1]]}),false);
});

test('фальш мойки только у кухни из Базиса с kitchen.faceFiller: шкаф студии и кухня палитры без флага — без фальша и петель под фальшпанель',()=>{
  const m=initialModule();
  assert.ok(!parts(m).some(p=>p.id.startsWith('face-filler')||p.name.startsWith('Петля под фальшпанель')||p.falsePanelHinge||p.model?.node));
});

test('стяжка с крепежом — только если в её полосе крепёж у наружных граней боковин: стенка короба ящика с конфирматами в боковинах короба — без крепежа к корпусу (студия не сверлит боковины корпуса там, где в Базисе отверстий нет)',()=>{
  const band={x0:16,y0:120,z0:20,x1:584,y1:220,z1:36};
  const conf=(x:number)=>({name:'Конфирмат 7х50 мм',category:'конфирмат',pos:[x,170,28]});
  assert.equal(railFastened(band,[conf(29),conf(571)],0,600),false,'конфирматы в боковинах короба (x=29/571) — не в боковинах корпуса');
  assert.equal(railFastened(band,[conf(0),conf(600)],0,600),true,'конфирматы через боковины корпуса — крепёж есть');
  assert.equal(railFastened(band,[{...conf(0),pos:[0,500,28]}],0,600),false,'крепёж вне полосы — без крепежа');
  if(has('k21')){const m=moduleFromEtalon(load('k21','m02')).module;assert.ok((m.rails??[]).some(r=>r.fasten===false),'k21 m02: передняя стяжка без крепежа — как в Базисе');}
});

test('лишние створки: нижний и мойка без своего фасада Базиса — распашных нет (угловые мойки k05 m05, k10 m13, k22 m06); распознанные — с дверьми (k25 m02, k14 m09)',{skip:!has('k05')||!has('k10')||!has('k22')||!has('k25')||!has('k14')},()=>{
  for(const [k,key] of [['k05','m05'],['k10','m13'],['k22','m06']] as const){
    const ref=load(k,key),m=moduleFromEtalon(ref).module,c=compareModule(ref,m);
    assert.equal(m.doors,false,`${k} ${key}: створок студии без фасада Базиса не ставим`);
    assert.ok(!c.extra.some(x=>/Фасад распашной/.test(x.name)),`${k} ${key}: лишних створок нет`);
    assert.equal(strayDoors(ref,m),0);
  }
  for(const [k,key] of [['k25','m02'],['k14','m09']] as const){const ref=load(k,key),m=moduleFromEtalon(ref).module;assert.equal(m.doors,true,`${k} ${key}`);assert.equal(strayDoors(ref,m),0);}
});

test('стенки коробов ящиков (k01 m05, k02 m04, k07 m02, k11 m03, k04 m02): студия не сверлит отверстий, которых нет в Базисе, сверх прежнего',{skip:!has('k01')||!has('k02')||!has('k07')||!has('k11')||!has('k04')},()=>{
  // до 9.10 (крепёж «при любом x») лишних отверстий было +24/+40/+72/+44/+22; по крепежу у наружных граней боковин — не больше прежних
  for(const [k,key,maxExtra] of [['k01','m05',16],['k02','m04',24],['k07','m02',44],['k11','m03',24],['k04','m02',14]] as const){
    const ref=load(k,key),m=moduleFromEtalon(ref).module,c=compareModule(ref,m);
    assert.ok((c.holes?.extra.length??0)<=maxExtra,`${k} ${key}: лишних отверстий ${c.holes?.extra.length} > ${maxExtra}`);
  }
});
