import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync,readFileSync} from 'node:fs';
import {validate,parts,initialModule,parseModule} from '../src/model';
import {kitchenBase} from '../src/kitchen';
import {edgeByDir} from '../src/edges';
import {compareModule,type RefModule} from '../scripts/kitchen/compare';
import {moduleFromEtalon} from '../scripts/kitchen/fromEtalon';

// Эталоны Базиса лежат вне репозитория (Кухни\etalon) — на чужой машине тест пропускается.
const ETALON='C:/Users/My PC/Desktop/Claude Project/Кухни/etalon';
const load=(k:string,key:string)=>(JSON.parse(readFileSync(`${ETALON}/${k}.json`,'utf8')).modules as RefModule[]).find(m=>m.key===key)!;

test('пенал k12 m04: два ряда распашных = doorSplit, фикс. полки на эксцентриках со шкантом, кромка фикс. полок перед+зад — сверка с Базисом PASS',{skip:!existsSync(`${ETALON}/k12.json`)},()=>{
  const ref=load('k12','m04');
  const {module:m,unsupported}=moduleFromEtalon(ref);
  assert.deepEqual(unsupported,[]);
  assert.deepEqual(validate(m),[]);
  assert.equal(m.sections[0].doorSplit,1198.5,'разрез: от низа нижнего фасада 101.5 до середины зазора 1298.5…1301.5');
  assert.equal(m.sections[0].doorLeaves,1);
  assert.equal(m.faceGapBetween,3,'зазор между рядами 3');
  const sid=m.sections[0].id;
  for(const j of m.sections[0].fixed??[])for(const side of ['left','right'])assert.equal(m.jointFastening?.[`${sid}:shelf:${j}:${side}`],'eccentric');
  const ps=parts(m);
  for(const j of m.sections[0].fixed??[]){const sh=ps.find(p=>p.id===`${sid}:shelf:${j}`)!;assert.ok(sh,'фикс. полка '+j);}
  const c=compareModule(ref,m);
  assert.ok(c.pass,JSON.stringify({missing:c.missing.map(x=>x.name),extra:c.extra.map(x=>x.name),hw:c.hardware.filter(h=>h.ref!==h.studio),edges:c.edges?.bad.slice(0,3)}));
});

test('пенал под духовку k23 m15: ниша 385 мм между фасадами не выдаётся за разрез фасадов — честно «не поддержано»',{skip:!existsSync(`${ETALON}/k23.json`)},()=>{
  const {module:m,unsupported}=moduleFromEtalon(load('k23','m15'));
  assert.equal(m.sections[0].doorSplit,undefined);
  assert.ok(unsupported.some(u=>u.startsWith('ниша под технику между фасадами 385.5')),unsupported.join('; '));
});

test('разрез фасадов (doorSplit) и «ниша под технику» распознаются только у пенала: антресоль/нижний — «не поддержано», пенал из двух корпусов — не разрез (критик n2)',{skip:!existsSync(`${ETALON}/k30.json`)},()=>{
  // k13 m02 — два ряда подъёмных фасадов, поддержано (n3, tests/kitchen-antresol.test.ts); два ряда распашных — нет
  for(const [k,key] of [['k27','m12'],['k10','m11']]){
    const {module:m,unsupported}=moduleFromEtalon(load(k,key));
    assert.equal(m.sections[0].doorSplit,undefined,k+key);
    assert.ok(unsupported.some(u=>u.startsWith('фасады в 2 ряда')),k+key+': '+unsupported.join('; '));
    assert.ok(!unsupported.some(u=>u.startsWith('ниша под технику')),k+key+': ниша — только у пенала');
  }
  const {module:p,unsupported:u30}=moduleFromEtalon(load('k30','m05'));
  assert.equal(p.sections[0].doorSplit,undefined,'боковины 850, фасады до 2469 — не разрез');
  assert.ok(u30.some(u=>u.startsWith('фасады пенала выше боковин')),u30.join('; '));
});

test('кромка фикс. полки «перед+зад» — только у полки на эксцентриках (k12 m04); фикс. полки k16 m01 (P8–P14) — по кругу, кромка сходится с Базисом (критик n2)',{skip:!existsSync(`${ETALON}/k16.json`)},()=>{
  const ref16=load('k16','m01'),{module:m16}=moduleFromEtalon(ref16);
  const c16=compareModule(ref16,m16);
  assert.deepEqual(c16.edges?.bad??[],[],'кромка k16 m01 совпадает с Базисом');
  const {module:m12}=moduleFromEtalon(load('k12','m04'));
  const s=m12.sections[0],ids=(s.fixed??[]).map(j=>`${s.id}:shelf:${j}`);
  assert.ok(ids.length>0);
  for(const id of ids)assert.deepEqual(Object.keys(edgeByDir(parts(m12).find(p=>p.id===id)!)).sort(),['+z','-z'],'эксцентрики: перед и зад');
  const conf={...m12,jointFastening:Object.fromEntries(Object.entries(m12.jointFastening??{}).map(([k])=>[k,'confirmat' as const]))};
  for(const id of ids)assert.deepEqual(Object.keys(edgeByDir(parts(conf).find(p=>p.id===id)!)).sort(),['+x','+z','-x','-z'],'не эксцентрики: по кругу');
});

test('пенал: hingeYUp — свои высоты петель у верхнего ряда (doorSplit), нижний ряд — по правилу; parseModule сохраняет поля',()=>{
  const m=kitchenBase(initialModule(),600);m.kitchen={...m.kitchen!,role:'tall'};m.height=2100;
  const s=m.sections[0];s.shelves=[];s.doorSplit=1000;
  const up=parts(m).find(p=>p.id===`${s.id}:door:2`)!;assert.ok(up,'верхний фасад');
  const dh=up.size[1];s.hingeYUp=[100,400,700,dh-100];s.hingeYUpFor=dh;
  assert.deepEqual(validate(m),[]);
  const ps=parts(m),cups=(k:number)=>ps.filter(p=>p.id.startsWith(`${s.id}:hingecup:${k}:`));
  const y0=up.position[1]-dh/2;
  assert.deepEqual(cups(2).map(p=>Math.round(p.position[1]-y0)).sort((a,b)=>a-b),[100,400,700,Math.round(dh-100)],'верхний ряд — по hingeYUp');
  assert.ok(cups(0).length>=2&&cups(0).length<=3,'нижний ряд — по правилу кухни');
  const back=parseModule(JSON.parse(JSON.stringify(m)));
  assert.deepEqual(back.sections[0].hingeYUp,s.hingeYUp);assert.equal(back.sections[0].hingeYUpFor,dh);
});
