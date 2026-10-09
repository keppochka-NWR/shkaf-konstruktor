import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync,readFileSync} from 'node:fs';
import {validate,parts,initialModule,parseModule} from '../src/model';
import {compareModule,honestPass,type RefModule} from '../scripts/kitchen/compare';
import {moduleFromEtalon} from '../scripts/kitchen/fromEtalon';
import {faceGapsTB} from '../scripts/kitchen/recognize-base';
import {holes} from '../src/drilling';
import {partCollisions} from '../src/collisions';
import {railFastened} from '../scripts/kitchen/recognize-common';

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

test('мойка 1480 с фальшем и планкой во всю высоту (k28 m17): два ряда опор, свои отступы конфирматов дна справа — сверка PASS',{skip:!has('k28')},()=>{
  const r=pass('k28','m17');
  assert.ok(r.ok,r.info);
  assert.deepEqual(r.m.kitchen?.legs?.xs,[70,1410]);
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

test('фальш мойки только у кухни из Базиса с kitchen.faceFiller: шкаф студии и кухня палитры без флага — без фальша и петель под фальшпанель',()=>{
  const m=initialModule();
  assert.ok(!parts(m).some(p=>p.id.startsWith('face-filler')||p.name.startsWith('Петля под фальшпанель')||p.falsePanelHinge||p.model?.node));
});

test('стяжка «без крепежа» — только если крепежа нет в её полосе вовсе: стенка короба ящика с конфирматами в его боковинах — с крепежом',()=>{
  const band={x0:16,y0:120,z0:20,x1:584,y1:220,z1:36};
  const conf=(x:number)=>({name:'Конфирмат 7х50 мм',category:'конфирмат',pos:[x,170,28]});
  assert.equal(railFastened(band,[conf(29),conf(571)],0,600),true,'конфирматы в боковинах короба (x=29/571) — крепёж есть');
  assert.equal(railFastened(band,[conf(0),conf(600)],0,600),true);
  assert.equal(railFastened(band,[{...conf(0),pos:[0,500,28]}],0,600),false,'крепёж вне полосы — без крепежа');
  if(has('k01')){const m=moduleFromEtalon(load('k01','m04')).module;assert.ok(!(m.rails??[]).some(r=>r.fasten===false),'k01 m04: у стенок ящика крепёж есть');}
  if(has('k21')){const m=moduleFromEtalon(load('k21','m02')).module;assert.ok((m.rails??[]).some(r=>r.fasten===false),'k21 m02: передняя стяжка без крепежа — как в Базисе');}
});
