import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync,readFileSync} from 'node:fs';
import {validate,parts,initialModule,parseModule,fastenerCounts,section,type Module} from '../src/model';
import {holes} from '../src/drilling';
import {partCollisions} from '../src/collisions';
import {kitchenJointPoints} from '../src/kitchen';
import {rafixZs,RAFIX} from '../src/kitchenRafix';
import {rawCounts} from '../src/rawModule';
import {compareModule,type RefModule} from '../scripts/kitchen/compare';
import {moduleFromEtalon,rafixFromEtalon,jointPointsFromEtalon} from '../scripts/kitchen/fromEtalon';

const ETALON='C:/Users/My PC/Desktop/Claude Project/Кухни/etalon';
const load=(k:string,key:string)=>(JSON.parse(readFileSync(`${ETALON}/${k}.json`,'utf8')).modules as RefModule[]).find(m=>m.key===key)!;

/** Пенал 600×2100×560 с двумя жёсткими полками. */
function tall(rafix?:Module['kitchen']):Module{
  const s=section();s.shelves=[0.3,0.6];s.fixed=[0,1];
  return {...initialModule(),width:600,height:2100,depth:560,sections:[s],kitchen:{role:'tall',...rafix}};
}

test('рафикс: сетка по глубине — крайние от торцов полки, равный шаг (k16: 57,5 и посередине)',()=>{
  assert.deepEqual(rafixZs({rear:57.5,front:57.5,n:3},3,630),[60.5,316.5,572.5]);
  assert.deepEqual(rafixZs({rear:20,front:60,n:2},0,560),[20,500]);
});

test('рафикс только у кухни: шкаф с жёсткими полками — конфирматы как раньше, рафиксов нет',()=>{
  const m=tall();delete m.kitchen;(m as Module&{kitchen?:unknown}).kitchen=undefined;
  const ps=parts(m);
  assert.equal(ps.filter(p=>p.id.startsWith('rafix:')).length,0);
  assert.ok(ps.some(p=>p.id.startsWith('fast:')&&p.id.includes(':shelf:')));
  assert.equal(fastenerCounts(m).rafix,undefined);
});

test('рафикс кухни: 2×2 на полку вместо конфирматов, присадка D20×13 в полку и D5×13 в стойку, без пересечений, в смете',()=>{
  const m=tall({role:'tall',rafix:{rear:52,front:52,n:2}});
  assert.deepEqual(validate(m),[]);
  const ps=parts(m),sid=m.sections[0].id;
  const body=ps.filter(p=>p.id.startsWith('rafix:')&&!p.id.endsWith(':pin'));
  assert.equal(body.length,8,'2 полки × 2 стороны × 2');
  assert.equal(ps.filter(p=>p.id.startsWith('fast:')&&p.id.includes(':shelf:')).length,0,'конфирматы полок не добавляются');
  const sh=ps.find(p=>p.id===`${sid}:shelf:0`)!,yb=sh.position[1]-sh.size[1]/2,z0=sh.position[2]-sh.size[2]/2;
  const r0=body.find(p=>p.id===`rafix:${sid}:shelf:0:left:0`)!;
  assert.deepEqual(r0.anchor,[16,yb,z0+52],'точка Базиса — торец полки × нижняя пласть');
  const hs=holes(m,ps).filter(h=>h.src.startsWith(`rafix:${sid}:shelf:0:left:0`));
  assert.deepEqual(hs.map(h=>[h.part,h.d,h.depth,h.at[0],h.dir.join(',')]),[[`${sid}:shelf:0`,RAFIX.bodyD,13,16+9.5,'0,1,0'],['left',RAFIX.pinD,13,16,'-1,0,0']]);
  assert.equal(hs[1].at[1],yb+8);
  assert.deepEqual(partCollisions(ps,m).filter(c=>/rafix:/.test(c.a+c.b)),[]);
  assert.equal(fastenerCounts(m).rafix,8);
  // своя сетка полки (per) и сохранение в проекте
  const m2=parseModule(JSON.parse(JSON.stringify(tall({role:'tall',rafix:{rear:52,front:52,n:2,per:{'1':{rear:57.5,front:57.5,n:3}}}}))));
  assert.deepEqual(m2.kitchen?.rafix,{rear:52,front:52,n:2,per:{'1':{rear:57.5,front:57.5,n:3}}});
  assert.equal(parts(m2).filter(p=>p.id.startsWith(`rafix:${m2.sections[0].id}:shelf:1:`)&&!p.id.endsWith(':pin')).length,6);
  // явный крепёж стыка (jointFastening) сильнее рафикса
  const m3=tall({role:'tall',rafix:{rear:52,front:52,n:2}});m3.jointFastening={[`${m3.sections[0].id}:shelf:0:left`]:'confirmat',[`${m3.sections[0].id}:shelf:0:right`]:'confirmat'};
  assert.equal(parts(m3).filter(p=>p.id.startsWith('rafix:')&&!p.id.endsWith(':pin')).length,4);
  assert.ok(validate(tall({role:'tall',rafix:{rear:5,front:52,n:2}})).some(e=>e.startsWith('Рафиксы')));
});

test('сырой модуль Базиса: рафиксы в счётчиках сметы',()=>{
  assert.equal(rawCounts([{name:'Полкодержатель стяжка РАФИКС',category:'рафикс'},{name:'Полкодержатель стяжка РАФИКС',category:'рафикс'}]).rafix,2);
});

test('стык дна/крыши кухни: 3 точки крепежа при глубине больше 600 (статистика Базиса), шкафы и до 600 — 2',()=>{
  const deep=tall();deep.depth=627;
  assert.equal(kitchenJointPoints(deep),3);
  assert.equal(kitchenJointPoints(tall()),2);
  const w={...tall(),depth:627};delete (w as Partial<Module>).kitchen;
  assert.equal(kitchenJointPoints(w as Module),2);
  const ps=parts(deep);
  assert.equal(ps.filter(p=>/^fast:(bottom|top):left:/.test(p.id)).length,6);
  const two={...deep,kitchen:{...deep.kitchen!,jointPoints:2 as const}};
  assert.equal(parts(two).filter(p=>/^fast:(bottom|top):left:/.test(p.id)).length,4);
});

test('пенал k16 m01: рафиксы 36 и крепёж стыков 3 точки — фурнитура и присадка как в Базисе, PASS',{skip:!existsSync(`${ETALON}/k16.json`)},()=>{
  const ref=load('k16','m01');
  const {module:m,unsupported}=moduleFromEtalon(ref);
  assert.deepEqual(unsupported,[]);
  assert.deepEqual(validate(m),[]);
  assert.deepEqual(m.kitchen?.rafix,{rear:57.5,front:57.5,n:3});
  const c=compareModule(ref,m);
  const row=(k:string)=>c.hardware.find(h=>h.category===k)!;
  assert.deepEqual([row('рафикс').ref,row('рафикс').studio],[36,36]);
  assert.deepEqual([row('конфирмат').ref,row('конфирмат').studio],[9,9]);
  assert.equal(row('опора').dups,2,'две опоры Базиса в одной точке — дубль');
  assert.ok(c.pass,JSON.stringify({hw:c.hardware.filter(h=>h.ref!==h.studio||(h.maxPosDelta??0)>2),holes:c.holes?.missing.slice(0,3)}));
});

test('своя сетка крепежа стыка (kitchen.joints): крыша 104,5/64,5 при общей 64,5 — как в Базисе k23 m14; присадка совпала',{skip:!existsSync(`${ETALON}/k23.json`)},()=>{
  const m=tall({role:'tall',joints:{top:{rear:104.5,front:64.5,n:2}}});m.confirmatInset=64.5;
  const ps=parts(m),z=(re:RegExp)=>ps.filter(p=>re.test(p.id)).map(p=>p.model!.origin![2]).sort((a,b)=>a-b);
  const top=ps.find(p=>p.id==='top')!,t0=top.position[2]-top.size[2]/2,t1=top.position[2]+top.size[2]/2;
  assert.deepEqual(z(/^fast:top:left:/),[t0+104.5,t1-64.5]);
  const b=ps.find(p=>p.id==='bottom')!,b0=b.position[2]-b.size[2]/2;
  assert.equal(z(/^fast:bottom:left:/)[0],b0+64.5,'дно — по общей сетке');
  assert.deepEqual(parseModule(JSON.parse(JSON.stringify(m))).kitchen?.joints,{top:{rear:104.5,front:64.5,n:2}});
  const ref=load('k23','m14'),{module:k}=moduleFromEtalon(ref);
  assert.deepEqual(k.kitchen?.joints?.top,{rear:104.5,front:64.5,n:2});
  const c=compareModule(ref,k);
  assert.deepEqual([c.holes?.matched,c.holes?.ref,c.holes?.extra.length],[40,40,0],'присадка Базиса 40 из 40');
});

test('распознавание: рафиксы k10 m01 — у полок разной глубины своя сетка, точки стыка k16 — 3',{skip:!existsSync(`${ETALON}/k10.json`)},()=>{
  const ref=load('k16','m01'),P=ref.panels;
  const b=(i:number)=>{const q=P[i].box;return {x0:q[0],y0:q[1],z0:q[2],x1:q[3],y1:q[4],z1:q[5]};};
  assert.equal(jointPointsFromEtalon(ref,[b(0),b(3)],b(1)),3);
  const r=rafixFromEtalon(ref,[8,9,10,11,13,14].map(b),[0,1,2,3,4,5]);
  assert.deepEqual(r.rafix,{rear:57.5,front:57.5,n:3});
  assert.deepEqual(r.confirmat,[]);
  const {module:m}=moduleFromEtalon(load('k10','m01'));
  assert.ok(m.kitchen?.rafix,'k10 m01: рафиксы распознаны');
});
