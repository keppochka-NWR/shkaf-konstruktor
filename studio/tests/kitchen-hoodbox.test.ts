// Короб вытяжки (pkg-hoodbox, 15.10.2026): правила статистикой по 15 навесным с коробом из базы Базиса (34 кухни).
// Фронт на эксцентриках (12 из 15: только k24 — конфирматы с лица), полки по сторонам короба (11 из 15), ХДФ двумя кусками (4 из 15),
// третий конфирмат стыка у задней кромки (k25 m16 крыша, k31 m08 дно). k10 m07 «ХДФ на 0,5 ниже паза» — особенность, не правило.
import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync,readFileSync} from 'node:fs';
import {validate,parts,parseModule} from '../src/model';
import {mirrorKitchen} from '../src/kitchen';
import {compareModule,honestPass,type RefModule} from '../scripts/kitchen/compare';
import {moduleFromEtalon,backClearY} from '../scripts/kitchen/fromEtalon';

const ETALON='C:/Users/My PC/Desktop/Claude Project/Кухни/etalon';
const load=(k:string,key:string)=>(JSON.parse(readFileSync(`${ETALON}/${k}.json`,'utf8')).modules as RefModule[]).find(m=>m.key===key)!;
const skip={skip:!existsSync(`${ETALON}/k31.json`)};

test('фронт короба на эксцентриках: нижний — от низа стенки, верхний — от верха, средний (стенка выше 600) — eccMid; по базе низ = верх у всех 11 модулей с парой',skip,()=>{
  const front=(k:string,key:string)=>moduleFromEtalon(load(k,key)).module.kitchen?.hoodBox?.front;
  // симметрично: от низа и от верха одно и то же расстояние
  for(const [k,key,v] of [['k06','m09',58.5],['k15','m08',54],['k16','m11',55.5],['k18','m12',54],['k25','m16',50],['k28','m01',60],['k31','m08',58.5]] as const){
    const f=front(k,key);assert.deepEqual([f?.ecc,f?.eccTop],[[v],[v]],`${k} ${key}`);
  }
  // стенка выше 600 — третий эксцентрик посередине (k05 654, k22 643)
  assert.equal(front('k05','m08')?.eccMid,true);assert.equal(front('k22','m10')?.eccMid,true);assert.equal(front('k31','m08')?.eccMid,undefined);
  // k05 — без шкантов, k18 — бочонок с внутренней пласти стенки, k24 — конфирматы с лица (эксцентриков нет)
  assert.equal(front('k05','m08')?.dowels,false);assert.equal(front('k18','m12')?.eccIn,true);assert.equal(front('k24','m09')?.ecc,undefined);
});

test('модули с коробом на эксцентриках сходятся с Базисом — PASS (k06 m09 вкладной фронт, k25 m16, k31 m08 полки по сторонам)',skip,()=>{
  for(const [k,key] of [['k06','m09'],['k25','m16'],['k31','m08'],['k24','m09']]){
    const ref=load(k,key),r=moduleFromEtalon(ref);
    assert.ok(honestPass(compareModule(ref,r.module),validate(r.module),r.unsupported),`${k} ${key} PASS`);
  }
});

test('эксцентрики фронта переживают смену высоты: от низа и от верха стенки, сверка присадки без пересечений',skip,()=>{
  const m=moduleFromEtalon(load('k31','m08')).module,ecc=(x:typeof m)=>parts(x).filter(p=>/^ecc:hood:left:front:\d+$/.test(p.id)).map(p=>p.anchor![1]);
  const a=ecc(m),m2=structuredClone(m);m2.height+=100;
  assert.deepEqual(validate(m2),[]);
  const b=ecc(m2);
  assert.equal(b.length,2);assert.equal(b[0],a[0],'нижний — от низа стенки');assert.equal(b[1],a[1]+100,'верхний — от верха стенки');
});

test('полки по сторонам короба: два куска, у стенки срез до лица фронта минус apex, полкодержатели в стенке короба (k31 m08)',skip,()=>{
  const m=moduleFromEtalon(load('k31','m08')).module,ps=parts(m),h=m.kitchen!.hoodBox!;
  const right=ps.filter(p=>/^hood:shelf:\d+:right$/.test(p.id));
  assert.equal(right.length,1);
  const left=ps.find(p=>p.id===right[0].id.replace(/^hood:shelf:(\d+):right$/,`${m.sections[0].id}:shelf:$1`))!;
  assert.ok(left?.planContour&&right[0].planContour,'трапеция в плане у обоих кусков');
  assert.equal(left.planContour!.length,4);assert.equal(right[0].planContour!.length,4);
  // кусок кончается у стенки с зазором gap
  const x0=m.width/2-h.w/2;assert.ok(Math.abs(left.position[0]+left.size[0]/2-(x0-h.shelves!.gap!))<0.01);
});

test('ХДФ двумя кусками по сторонам короба (k22 m10): до внутренней грани стенки минус 1, за коробом задника нет',skip,()=>{
  const ref=load('k22','m10'),m=moduleFromEtalon(ref).module,ps=parts(m);
  assert.equal(m.kitchen?.hoodBox?.hdfSplit,true);
  const b=ps.filter(p=>p.material==='hdf').sort((a,c)=>a.position[0]-c.position[0]);
  assert.equal(b.length,2);
  const hdf=ref.panels.filter(p=>p.kind==='hdf').sort((a,c)=>a.box[0]-c.box[0]);
  assert.ok(Math.abs(b[0].position[0]+b[0].size[0]/2-hdf[0].box[3])<=0.5,'левый кусок — как в Базисе ±0,5');
  assert.ok(Math.abs(b[1].position[0]-b[1].size[0]/2-hdf[1].box[0])<=0.5,'правый кусок — как в Базисе ±0,5');
  // поле переживает сохранение
  const k05=moduleFromEtalon(load('k05','m08')).module;
  assert.deepEqual(parseModule(JSON.parse(JSON.stringify(k05))).kitchen?.hoodBox,k05.kitchen?.hoodBox);
  const k18=moduleFromEtalon(load('k18','m12')).module;
  assert.deepEqual(parseModule(JSON.parse(JSON.stringify(k18))).kitchen?.hoodBox,k18.kitchen?.hoodBox);
});

test('третий конфирмат стыка у задней кромки (k25 m16 крыша, k31 m08 дно: 8 при паре 74/54); три эксцентрика (k10 m02) — не он',skip,()=>{
  const m=moduleFromEtalon(load('k25','m16')).module;
  assert.deepEqual(m.kitchen?.jointZ?.['top:left'],[74,54,8]);
  assert.equal(parts(m).filter(p=>/^fast:top:left:\d+$/.test(p.id)).length,3);
  assert.deepEqual(moduleFromEtalon(load('k31','m08')).module.kitchen?.jointZ?.['bottom:right'],[74,54,8]);
  assert.equal(moduleFromEtalon(load('k10','m02')).module.kitchen?.jointZ,undefined);
});

test('крепёж панели под поднятым дном (kitchen.raise.conf): 4 из 6 навесных с панелью — конфирматы через боковины и сверху через дно (k14) или эксцентрик+шкант (k15, k18, k22); без крепежа — k25, k32',skip,()=>{
  const raise=(k:string,key:string)=>moduleFromEtalon(load(k,key)).module.kitchen?.raise;
  assert.deepEqual(raise('k14','m03')?.conf,{side:[71.5,199.5],top:{kind:'conf',xs:[60],xr:[60]}});
  assert.deepEqual(raise('k15','m08')?.conf,{side:[51,147],top:{kind:'ecc',xs:[60],xr:[60]}});
  assert.deepEqual(raise('k18','m12')?.conf,{side:[67,227],top:{kind:'ecc',xs:[64],xr:[64],mid:true}});
  // k22 m10: D5 конфирматов в панель и в стенки короба 42 при 35 у корпуса — по проекту
  assert.deepEqual(raise('k22','m10')?.conf,{side:[45.5,109.5],top:{kind:'ecc',xs:[60],xr:[60]},depth:42});
  assert.equal(moduleFromEtalon(load('k22','m10')).module.kitchen?.hoodBox?.confDepth,42);
  assert.equal(raise('k25','m16')?.conf,undefined);assert.equal(raise('k32','m13')?.conf,undefined);
  // модули сходятся с Базисом
  for(const [k,key] of [['k14','m03'],['k22','m10']]){const ref=load(k,key),r=moduleFromEtalon(ref);assert.ok(honestPass(compareModule(ref,r.module),validate(r.module),r.unsupported),`${k} ${key} PASS`);}
  // поле переживает сохранение; зеркало — отступы от левого и правого конца меняются местами
  const m=moduleFromEtalon(load('k22','m10')).module;
  assert.deepEqual(parseModule(JSON.parse(JSON.stringify(m))).kitchen?.raise,m.kitchen?.raise);
  const w=structuredClone(m);w.kitchen!.raise!.conf!.top={kind:'ecc',xs:[50],xr:[70]};mirrorKitchen(w);assert.deepEqual(w.kitchen!.raise!.conf!.top,{kind:'ecc',xs:[70],xr:[50]});
  // ширина +100: крепёж по-прежнему у концов панели, без ошибок
  const m2=structuredClone(m);m2.width+=100;assert.deepEqual(validate(m2),[]);
  const ex=parts(m2).filter(p=>p.id.startsWith('ecc:raise-front:')).map(p=>p.anchor![0]);assert.deepEqual(ex,[16+60,m2.width-16-60]);
});

test('k10 m07: ХДФ на 0,5 ниже дна паза — особенность (1 из 175 ХДФ в пазу дна по базе, 128 — на 7 в дно), студия ставит ХДФ в паз по правилу',skip,()=>{
  // паз дна 8, зазор 1 → низ ХДФ на 7 ниже верха дна; у k10 m07 — на 8,5 (ХДФ входит в тело дна) — «как в проекте» не повторяем
  assert.equal(backClearY({x0:9,x1:591,y0:171.5,y1:483,z0:17,z1:20},{x0:16,x1:584,y0:164,y1:180,z0:0,z1:330},{x0:16,x1:584,y0:476,y1:492,z0:0,z1:330},8,1),undefined);
  const m=moduleFromEtalon(load('k10','m07')).module,back=parts(m).find(p=>p.id==='back')!;
  assert.equal(back.position[1]-back.size[1]/2,173);
});
