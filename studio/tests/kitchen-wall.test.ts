import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync,readFileSync} from 'node:fs';
import {validate,parts,initialModule,facadeBottom,parseModule,grooveBox} from '../src/model';
import {kitchenWall,kitchenBase} from '../src/kitchen';
import {holes} from '../src/drilling';
import {compareModule,type RefModule} from '../scripts/kitchen/compare';
import {moduleFromEtalon} from '../scripts/kitchen/fromEtalon';
import {refCategory,confirmatName} from '../scripts/kitchen/refHardware';
import {estimate} from '../src/pricing';
import {newProject} from '../src/project';
import {parseRaw} from '../src/rawModule';
import {section} from '../src/model';
import {rearNotchFromContour,topCornerNotchFromContour} from '../scripts/kitchen/sideNotch';
import {partCollisions} from '../src/collisions';

// Эталоны Базиса лежат вне репозитория (Кухни\etalon) — на чужой машине тесты по эталонам пропускаются.
const ETALON='C:/Users/My PC/Desktop/Claude Project/Кухни/etalon';
const load=(k:string,key:string)=>(JSON.parse(readFileSync(`${ETALON}/${k}.json`,'utf8')).modules as RefModule[]).find(m=>m.key===key)!;
const plinthLike=(m:ReturnType<typeof initialModule>)=>parts(m).filter(p=>/цоколь/i.test(p.name)||p.id==='plinth');

test('навесной с поднятым корпусом (k30 m06): фасады до низа модуля, цоколя нет — как в Базисе',{skip:!existsSync(`${ETALON}/k30.json`)},()=>{
  const ref=load('k30','m06'),{module:m}=moduleFromEtalon(ref);
  assert.deepEqual(validate(m),[]);
  assert.equal(m.raisedSides,true);
  assert.deepEqual(m.kitchen?.raise,{doorsToFloor:true});
  assert.equal(facadeBottom(m),0,'фасад от низа модуля');
  assert.deepEqual(plinthLike(m).map(p=>p.name),[],'студия не добавляет цоколь, которого нет в Базисе');
  const c=compareModule(ref,m);
  assert.deepEqual([c.missing.length,c.extra.length,c.pairs.filter(p=>p.delta>0.5).length],[0,0,0]);
});

test('навесной с поднятым дном и фронтальной ЛДСП под дном (k14 m03): панель под дном вместо цоколя, фасад с зазором 1,5',{skip:!existsSync(`${ETALON}/k14.json`)},()=>{
  const ref=load('k14','m03'),{module:m}=moduleFromEtalon(ref);
  assert.equal(m.plinthHeight,255);
  assert.deepEqual(m.kitchen?.raise,{front:0});
  const pl=plinthLike(m);
  assert.equal(pl.length,1);
  assert.equal(pl[0].name,'Фронтальная под дном');
  assert.deepEqual(pl[0].size,[m.width-32,255,16]);
  assert.equal(pl[0].position[2],m.depth-8,'заподлицо с лицом боковин');
  assert.equal(facadeBottom(m),1.5);
});

test('навесной с поднятым дном без панели под дном (k01 m09): ни цоколя, ни панели',{skip:!existsSync(`${ETALON}/k01.json`)},()=>{
  const {module:m}=moduleFromEtalon(load('k01','m09'));
  assert.equal(m.plinthHeight,135);
  assert.deepEqual(m.kitchen?.raise,{});
  assert.deepEqual(plinthLike(m),[]);
  assert.ok(!validate(m).some(e=>/цокол|Подъём/.test(e)),validate(m).join('; '));
});

test('подъём дна — только у кухни: шкаф с цоколем 80 по-прежнему с цоколем и списком высот',()=>{
  const w={...initialModule(),plinthHeight:80};
  assert.equal(plinthLike(w).length,1);
  assert.ok(validate({...w,plinthHeight:13}).includes('Выберите высоту цоколя из списка.'));
  const k=kitchenWall(initialModule(),600);
  const r={...k,plinthHeight:13,raisedSides:true,kitchen:{...k.kitchen!,raise:{doorsToFloor:true}}};
  assert.deepEqual(validate(r),[]);
  assert.deepEqual(plinthLike(r),[]);
  assert.deepEqual(parseModule(JSON.parse(JSON.stringify(r))).kitchen?.raise,{doorsToFloor:true},'raise переживает сохранение');
  assert.ok(validate({...r,kitchen:{...r.kitchen,raise:{front:-5}}}).some(e=>/Подъём дна/.test(e)));
});
test('навесные: крепёж стыков по Базису (jointZ), паз в торце дна, дно короче спереди — k10 m09 и k24 m10 сходятся с Базисом',{skip:!existsSync(`${ETALON}/k10.json`)},()=>{
  for(const [k,key] of [['k10','m09'],['k24','m10'],['k10','m10']] as const){
    const ref=load(k,key),{module:m,unsupported}=moduleFromEtalon(ref);
    assert.deepEqual(unsupported,[]);assert.deepEqual(validate(m),[]);
    const c=compareModule(ref,m);
    if(key!=='m10'||k!=='k10')assert.ok(c.pass,k+' '+key+' '+JSON.stringify({hw:c.hardware.filter(h=>h.ref!==h.studio||(h.maxPosDelta??0)>2),edges:c.edges?.bad.slice(0,3)}));
  }
  const {module:m9}=moduleFromEtalon(load('k10','m09'));
  assert.deepEqual(m9.kitchen?.jointZ?.['bottom:left'],[56.8,56.8],'дно: свои отступы конфирматов от кромок дна');
  assert.equal(m9.kitchen?.bottomFront,24.5);
  const g=m9.grooves?.find(x=>x.end);assert.ok(g,'паз в переднем торце дна');assert.equal(g!.end,'+');assert.deepEqual(g!.across,[7.8,10.3]);assert.equal(g!.depth,10);
  const {module:m10}=moduleFromEtalon(load('k10','m10'));
  assert.deepEqual(m10.kitchen?.jointZ?.['bottom:left'],[53,28.5],'дно короче спереди, крепёж как у полного дна');
});
test('навесной k04 m05: нижняя задняя планка на дне — нижняя стяжка, без ошибки «одно место»',{skip:!existsSync(`${ETALON}/k04.json`)},()=>{
  const {module:m}=moduleFromEtalon(load('k04','m05'));
  assert.deepEqual(m.rails?.map(r=>r.place).sort(),['rear-bottom','rear-top']);
  assert.ok(!validate(m).some(e=>/Стяжка/.test(e)),validate(m).join('; '));
});
test('паз в торце детали (end) и отступы крепежа стыка: геометрия и сохранение',()=>{
  const m={...kitchenWall(initialModule(),600),kitchen:{role:'wall' as const,bottomFront:24.5,jointZ:{'bottom:left':[56.8,56.7] as [number,number]}},grooves:[{host:'bottom',face:'+' as const,end:'+' as const,along:[0,0] as [number,number],across:[7.8,10.3] as [number,number],depth:10,name:'паз'}]};
  assert.deepEqual(validate(m),[]);
  const p=parts(m),bot=p.find(x=>x.id==='bottom')!;
  assert.equal(bot.size[2],m.depth-24.5);
  const b=grooveBox(bot,m.grooves[0])!;
  assert.deepEqual([b[1],b[4],b[5]-b[2]].map(v=>Math.round(v*10)/10),[7.8,10.3,10]);
  assert.equal(Math.round(b[5]*10)/10,m.depth-24.5,'паз у переднего торца дна');
  const zs=p.filter(x=>x.id.startsWith('fast:bottom:left:')).map(x=>Math.round(x.position[2]*10)/10).sort((a,c)=>a-c);
  assert.deepEqual(zs,[56.8,m.depth-24.5-56.7].map(v=>Math.round(v*10)/10));
  const back=parseModule(JSON.parse(JSON.stringify(m)));
  assert.deepEqual(back.kitchen?.jointZ,m.kitchen.jointZ);assert.equal(back.kitchen?.bottomFront,24.5);assert.equal(back.grooves?.[0].end,'+');
  assert.ok(validate({...m,kitchen:{...m.kitchen,jointZ:{'top:left':[1,2] as [number,number]}}}).some(e=>/Крепёж стыка/.test(e)));
});
test('навесные: кромка съёмных полок по Базису — своя толщина (k10 m10: 0,5 при корпусе 0,4) и свои торцы (k22 m11: только перед)',{skip:!existsSync(`${ETALON}/k22.json`)},()=>{
  const a=moduleFromEtalon(load('k10','m10')).module,b=moduleFromEtalon(load('k22','m11')).module;
  assert.equal(a.edgeScheme?.shelfT,0.5);assert.equal(a.edgeScheme?.shelfSides,undefined);
  assert.deepEqual(b.edgeScheme?.shelfSides,['+z']);
  for(const [k,key] of [['k10','m10'],['k22','m11'],['k10','m08']] as const){const ref=load(k,key),{module:m}=moduleFromEtalon(ref),c=compareModule(ref,m);assert.ok(c.pass,k+' '+key+' '+JSON.stringify(c.edges?.bad.slice(0,3)));}
  assert.deepEqual(parseModule(JSON.parse(JSON.stringify(b))).edgeScheme?.shelfSides,['+z'],'схема полок переживает сохранение');
});
test('навесной k30 m06: дно под боковинами на эксцентриках со шкантами — крепёж, отверстия и сверка как в Базисе, без пересечений',{skip:!existsSync(`${ETALON}/k30.json`)},()=>{
  const ref=load('k30','m06'),{module:m}=moduleFromEtalon(ref);
  assert.equal(m.jointFastening?.['bottom:left'],'eccentric');
  assert.deepEqual(m.dowels,{offset:32});
  assert.deepEqual(m.kitchen?.jointZ?.['bottom:left'],[74,54]);
  const ps=parts(m),ecc=ps.filter(p=>p.id.startsWith('ecc:bottom-under:')&&!p.id.endsWith(':pin'));
  assert.equal(ecc.length,4);assert.equal(ps.filter(p=>p.id.startsWith('dowel:bottom-under:')).length,4);
  assert.equal(ps.filter(p=>p.id.startsWith('fast:bottom:')).length,0,'конфирматов в дне нет — как в Базисе');
  const c=compareModule(ref,m);
  assert.ok(c.pass,JSON.stringify({hw:c.hardware.filter(h=>h.ref!==h.studio||(h.maxPosDelta??0)>2),holes:c.holes&&[c.holes.matched,c.holes.ref]}));
  assert.deepEqual(partCollisions(ps,m).map(x=>x.names.join(' × ')),[]);
});
test('навесной: складной подъёмник ФриФолд в два ряда (k07 m10) — не выдаётся за два ряда распашных',{skip:!existsSync(`${ETALON}/k07.json`)},()=>{
  const {module:m,unsupported}=moduleFromEtalon(load('k07','m10'));
  assert.equal(m.sections[0].doorSplit,undefined);
  assert.ok(unsupported.some(u=>/2 ряда/.test(u)));
});
test('навесной: составной корпус (k26 m01, боковины от 602, дно на 767) — честно не поддержан, цоколя не выдумываем',{skip:!existsSync(`${ETALON}/k26.json`)},()=>{
  const {module:m,unsupported}=moduleFromEtalon(load('k26','m01'));
  assert.ok(unsupported.some(u=>/боковины начинаются/.test(u)));
  assert.deepEqual(plinthLike(m),[]);
});
test('навесной k32 m14: в Базисе нет крепежа и кромка дна/крыши по кругу — студия крепёж не добавляет, кромит как Базис',{skip:!existsSync(`${ETALON}/k32.json`)},()=>{
  const ref=load('k32','m14'),{module:m}=moduleFromEtalon(ref);
  assert.equal(m.kitchen?.noFasteners,true);
  assert.deepEqual(m.edgeScheme?.ends?.bottom?.slice().sort(),['+x','+z','-x','-z']);
  const ps=parts(m);
  assert.deepEqual(ps.filter(p=>/^(fast|ecc|dowel):/.test(p.id)).map(p=>p.id),[],'ни конфирматов, ни эксцентриков');
  // правая боковина k32 m14 — фигурная (вырез 100×20 в заднем верхнем углу), левая — прямоугольник: у студии так же
  assert.deepEqual(m.kitchen?.sideNotch,{right:{height:100,depth:20}});
  assert.deepEqual(ps.find(p=>p.id==='right')?.rearNotch,{height:100,depth:20});assert.equal(ps.find(p=>p.id==='left')?.rearNotch,undefined);
  const c=compareModule(ref,m);
  assert.ok(c.pass,String(c.contours));assert.deepEqual(c.contours,[]);
  // без выреза у студии сверка это видит (прежний нечестный PASS)
  const plain={...m,kitchen:{...m.kitchen!,sideNotch:undefined}};
  const cp=compareModule(ref,plain);
  assert.equal(cp.pass,false);assert.ok(cp.contours?.some(x=>/фигурный контур Базиса \(6 точек, вырез 2000 мм²\)/.test(x)),String(cp.contours));
  // вырез не той боковины или не того размера — тоже FAIL
  assert.equal(compareModule(ref,{...m,kitchen:{...m.kitchen!,sideNotch:{left:{height:100,depth:20}}}}).pass,false);
  assert.equal(compareModule(ref,{...m,kitchen:{...m.kitchen!,sideNotch:{right:{height:100,depth:30}}}}).pass,false);
  const back=parseModule(JSON.parse(JSON.stringify(m)));
  assert.equal(back.kitchen?.noFasteners,true);assert.deepEqual(back.edgeScheme?.ends,m.edgeScheme?.ends);
  assert.deepEqual(back.kitchen?.sideNotch,m.kitchen?.sideNotch,'вырез переживает сохранение');
  // пересечения — по телу боковины без выреза
  assert.deepEqual(partCollisions(parts(m),m).map(x=>x.names.join(' × ')),[]);
});
test('навесной k33 m03: крыша перед ХДФ (короче сзади на 20), ХДФ за крышей до верха минус 1 с вырезами 25×45 в верхних углах — сверка PASS',{skip:!existsSync(`${ETALON}/k33.json`)},()=>{
  const ref=load('k33','m03'),{module:m,unsupported}=moduleFromEtalon(ref);
  assert.deepEqual([m.kitchen?.topBack,m.kitchen?.backTopGap,m.kitchen?.backNotch],[20,1,{width:25,height:45}]);
  assert.deepEqual(validate(m),[]);assert.deepEqual(unsupported,[]);
  const ps=parts(m),top=ps.find(p=>p.id==='top')!,back=ps.find(p=>p.id==='back')!;
  assert.deepEqual([top.position[2]-top.size[2]/2,top.size[2]],[20,295]);
  assert.equal(back.position[1]+back.size[1]/2,m.height-1);assert.deepEqual(back.topNotches,{width:25,height:45});
  const c=compareModule(ref,m);assert.ok(c.pass,String(c.contours));
  assert.deepEqual(partCollisions(ps,m).map(x=>x.names.join(' × ')),[]);
  // без вырезов ХДФ — FAIL по контуру; без укороченной крыши — FAIL по крыше
  assert.ok(compareModule(ref,{...m,kitchen:{...m.kitchen!,backNotch:undefined}}).contours?.some(x=>/Задняя стенка: фигурный контур/.test(x)));
  assert.equal(compareModule(ref,{...m,kitchen:{...m.kitchen!,topBack:undefined}}).pass,false);
  const sv=parseModule(JSON.parse(JSON.stringify(m)));
  assert.deepEqual([sv.kitchen?.topBack,sv.kitchen?.backTopGap,sv.kitchen?.backNotch],[20,1,{width:25,height:45}]);
  assert.deepEqual(topCornerNotchFromContour({figure:true,contourPlane:'xy',contour:[[10,10],[440,10],[440,624],[415,624],[415,669],[35,669],[35,624],[10,624]]}),{width:25,height:45});
  assert.equal(topCornerNotchFromContour({figure:true,contourPlane:'xy',contour:[[10,10],[440,10],[440,669],[10,669]]}),null);
  // у обычного навесного студии ничего этого нет
  const w=parts(kitchenWall(initialModule(),600));assert.ok(!w.some(p=>p.topNotches||p.rearNotch));
});
test('навесной k34 m02 на «Стяжке Макмарт Ø15»: присадка эксцентрика и шканта по проекту, бочонок дна снизу — сверка PASS',{skip:!existsSync(`${ETALON}/k34.json`)},()=>{
  const ref=load('k34','m02'),{module:m,unsupported}=moduleFromEtalon(ref);
  assert.deepEqual(m.kitchen?.ecc,{barrel:13,stem:[7,28],side:9,dowelSide:11,bottomOut:true});
  assert.deepEqual(validate(m),[]);assert.deepEqual(unsupported,[]);
  const hs=holes(m),bot=parts(m).find(p=>p.id==='bottom')!;
  assert.ok(hs.filter(h=>h.d===15&&h.part==='bottom').every(h=>h.at[1]===bot.position[1]-bot.size[1]/2&&h.dir[1]===1),'бочонок дна — с нижней пласти');
  assert.ok(hs.some(h=>h.d===7&&h.depth===28)&&!hs.some(h=>h.d===8&&h.depth===34),'шток D7×28');
  const c=compareModule(ref,m);assert.ok(c.pass);assert.deepEqual([c.holes?.matched,c.holes?.ref],[48,48]);
  assert.deepEqual(parseModule(JSON.parse(JSON.stringify(m))).kitchen?.ecc,m.kitchen?.ecc);
  // k30 m06 (эксцентрики под боковинами) — типовая присадка, без ecc
  assert.equal(moduleFromEtalon(load('k30','m06')).module.kitchen?.ecc,undefined);
});
test('нижний k32 m09: кромка боковин, дна и царг по кругу — как в проекте Базиса (edgeScheme.parts), сверка PASS',{skip:!existsSync(`${ETALON}/k32.json`)},()=>{
  const ref=load('k32','m09'),{module:m,unsupported}=moduleFromEtalon(ref);
  // слияние n3: «по кругу» задаёт edgeScheme.all (n3-base, k11/k32) или переопределение деталей edgeScheme.parts (n3-wall)
  assert.ok(m.edgeScheme?.all||(m.edgeScheme?.parts?.left?.includes('-y')&&m.edgeScheme.parts.left.includes('-z')),JSON.stringify(m.edgeScheme));
  assert.ok(parts(m).find(p=>p.id==='left')!.edge.every(e=>e>0),'боковина кромится по кругу');
  assert.deepEqual(validate(m),[]);assert.deepEqual(unsupported,[]);
  const c=compareModule(ref,m);assert.ok(c.pass,JSON.stringify(c.edges?.bad));
  assert.deepEqual(parseModule(JSON.parse(JSON.stringify(m))).edgeScheme,m.edgeScheme);
  // без переопределения — правило студии, сверка видит разницу
  assert.equal(compareModule(ref,{...m,edgeScheme:{...m.edgeScheme!,parts:undefined,all:undefined}}).pass,false);
  // k32 m06: набивной ХДФ с отступами 2 снизу и 4 сверху (сбоку 1,5) — по проекту
  const r6=load('k32','m06'),m6=moduleFromEtalon(r6).module;
  assert.deepEqual([m6.backGap,m6.kitchen?.backGapY],[1.5,[2,4]]);
  const b6=parts(m6).find(p=>p.id==='back')!;assert.deepEqual([b6.position[1]-b6.size[1]/2,b6.position[1]+b6.size[1]/2],[2,m6.height-4]);
  assert.ok(compareModule(r6,m6).pass);assert.deepEqual(parseModule(JSON.parse(JSON.stringify(m6))).kitchen?.backGapY,[2,4]);
  // у модулей, где кромка студии и так как в Базисе (k30 m06), переопределений нет
  assert.equal(moduleFromEtalon(load('k30','m06')).module.edgeScheme?.parts,undefined);
});
test('вырез в заднем верхнем углу боковины по контуру Базиса: только ровно такой контур',()=>{
  const C=(c:number[][])=>({figure:true,contourPlane:'yz',contour:c});
  assert.deepEqual(rearNotchFromContour(C([[0,0],[0,330],[1080,330],[1080,20],[980,20],[980,0]])),{height:100,depth:20});
  assert.equal(rearNotchFromContour(C([[0,0],[0,330],[1080,330],[1080,0]])),null,'прямоугольник');
  assert.equal(rearNotchFromContour(C([[0,0],[0,310],[100,310],[100,330],[1080,330],[1080,0]])),null,'вырез спереди внизу — не задний верхний');
  assert.equal(rearNotchFromContour({...C([[0,0],[0,330],[1080,330],[1080,20],[980,20],[980,0]]),contourPlane:'xz'}),null,'не боковина');
});
test('антресоль k31 m20: задняя вертикаль под поднятым корпусом не теряется молча — «не распознано»',{skip:!existsSync(`${ETALON}/k31.json`)},()=>{
  const {unsupported}=moduleFromEtalon(load('k31','m20'));
  assert.ok(unsupported.some(u=>/1 панелей не распознано/.test(u)),unsupported.join('; '));
});
test('«Евровинт 6х50» из «прочего» эталона — конфирмат: k33 m03 и k34 m04 крепёж не снимается',{skip:!existsSync(`${ETALON}/k33.json`)||!existsSync(`${ETALON}/k34.json`)},()=>{
  assert.equal(refCategory({name:'Евровинт 6х50',category:'прочее'}),'конфирмат');
  assert.equal(refCategory({name:'Винт прямого крепления с потайной головкой, ø6,3х14 мм',category:'прочее'}),'прочее');
  assert.equal(refCategory({name:'Полкодержатель D5 никель',category:'полкодержатель'}),'полкодержатель');
  // «Мебельная ручка рейлинг 128» — ручка, а не ящик-система: студия ручку не снимает (раньше noHandles)
  assert.equal(refCategory({name:'Мебельная ручка рейлинг 128',category:'ящик-система'}),'ручка');
  assert.equal(refCategory({name:'Axis PRO Держ. фасада',category:'ящик-система'}),'ящик-система');
  if(existsSync(`${ETALON}/k09.json`)){
    const r9=load('k09','m02'),m9=moduleFromEtalon(r9).module;
    assert.notEqual(m9.noHandles,true);
    const h9=compareModule(r9,m9).hardware.find(h=>h.category==='ручка')!;assert.deepEqual([h9.ref,h9.studio],[1,1]);
  }
  for(const [k,key,n] of [['k33','m03',8],['k34','m03',8],['k34','m04',4],['k33','m01',8]] as const){
    const ref=load(k,key),{module:m}=moduleFromEtalon(ref);
    assert.notEqual(m.kitchen?.noFasteners,true,`${k} ${key}: крепёж в Базисе есть`);
    assert.ok(parts(m).filter(p=>p.id.startsWith('fast:')).length>=n,`${k} ${key}: конфирматы студии`);
    const c=compareModule(ref,m),row=c.hardware.find(h=>h.category==='конфирмат')!;
    assert.equal(row.ref,n,`${k} ${key}: евровинты Базиса посчитаны конфирматами`);
    assert.ok(!c.hardware.some(h=>h.category==='прочее'&&h.ref>0),'в «прочем» евровинтов не осталось');
    assert.ok((c.holes?.matched??0)>0,`${k} ${key}: присадка крепежа совпадает хотя бы частично`);
  }
  // присадка евровинта по проекту (D5×36, у Базиса не 35) и полкодержателя (D5×9, не 12)
  const r3=load('k33','m03'),m3=moduleFromEtalon(r3).module;
  assert.deepEqual(m3.kitchen?.drill,{confirmat:36,pin:9});
  const hs=holes(m3);
  assert.ok(hs.some(h=>h.d===5&&h.depth===36)&&!hs.some(h=>h.d===5&&h.depth===35),'D5 евровинта — 36');
  assert.ok(hs.some(h=>h.d===5&&h.depth===9)&&!hs.some(h=>h.d===5&&h.depth===12),'D5 полкодержателя — 9');
  assert.deepEqual(parseModule(JSON.parse(JSON.stringify(kitchenWall(initialModule(),600)))).kitchen?.drill,undefined,'у обычного навесного — типовая');
  // мойка k33 m01: опор в Базисе нет — студия их не требует и не добавляет; сверка деталь в деталь
  const r1=load('k33','m01'),k1=moduleFromEtalon(r1);
  assert.equal(k1.module.kitchen?.noLegs,true);assert.deepEqual(validate(k1.module),[]);assert.deepEqual(k1.unsupported,[]);
  assert.ok(!parts(k1.module).some(p=>p.id.startsWith('leg:')||/опор/i.test(p.name)));
  const c1=compareModule(r1,k1.module);assert.ok(c1.pass);assert.deepEqual([c1.holes?.matched,c1.holes?.ref],[16,16]);
  const sv=parseModule(JSON.parse(JSON.stringify(k1.module)));assert.equal(sv.kitchen?.noLegs,true);assert.deepEqual(sv.kitchen?.drill,{confirmat:36});
  // крепёж под именем Базиса — «Евровинт 6х50», в деталях и смете (не «Конфирмат 7×50»)
  assert.equal(k1.module.kitchen?.confirmatName,'Евровинт 6х50');
  assert.ok(parts(k1.module).filter(p=>p.id.startsWith('fast:')).every(p=>p.name==='Евровинт 6х50'));
  const lines=estimate(newProject(k1.module)).lines;
  assert.ok(lines.some(l=>l.label==='Евровинт 6х50 (по проекту Базиса)'&&l.quantity===8));assert.ok(!lines.some(l=>l.id==='confirmat-7x50'));
  assert.equal(sv.kitchen?.confirmatName,'Евровинт 6х50');
  assert.equal(confirmatName(load('k30','m06').hardware),undefined,'типовой «Конфирмат 7х50» — без имени');
  // сырой модуль: та же строка сметы
  const raw={...initialModule(),sections:[section()],raw:{panels:[],hardware:[],counts:{confirmats:4},confirmatName:'Евровинт 6х50'}};
  assert.equal(parseRaw(JSON.parse(JSON.stringify(raw.raw)))?.confirmatName,'Евровинт 6х50');
  assert.ok(estimate(newProject(raw)).lines.some(l=>l.label==='Евровинт 6х50 (по проекту Базиса)'&&l.quantity===4));
  // обычный нижний без опор — по-прежнему ошибка (правило студии)
  const b=kitchenBase(initialModule(),600);delete b.feet;assert.ok(validate(b).some(e=>/на опоры/.test(e)));
  // сушка k34 m04 без дна: единственная горизонталь — «Крышка» наверху; дна студия не выдумывает, ХДФ не теряется
  const r4=load('k34','m04'),m4=moduleFromEtalon(r4).module,c4=compareModule(r4,m4);
  assert.equal(m4.bottomType,'none');
  assert.deepEqual([c4.missing.map(x=>x.name),c4.extra.map(x=>x.name)],[[],[]]);
  // без дна ХДФ — от низа модуля + 1 и до верха − 2, как в Базисе: сверка PASS
  assert.deepEqual([m4.kitchen?.backBottomGap,m4.kitchen?.backTopGap],[1,2]);
  const b4=parts(m4).find(p=>p.id==='back')!;assert.deepEqual([b4.position[1]-b4.size[1]/2,b4.position[1]+b4.size[1]/2],[1,718]);
  assert.ok(c4.pass,String(c4.contours));assert.deepEqual(validate(m4),[]);
  assert.equal(parseModule(JSON.parse(JSON.stringify(m4))).kitchen?.backBottomGap,1);
  // в k32 крепежа нет вовсе — правило «без крепежа» по-прежнему срабатывает
  assert.equal(moduleFromEtalon(load('k32','m14')).module.kitchen?.noFasteners,true);
});
test('сушка навесного k21 m05: набор SU01/03 с сеткой Базиса — в точках и с поворотами проекта; без сетки (k06 m07) — только заметка',{skip:!existsSync(`${ETALON}/k21.json`)},()=>{
  const ref=load('k21','m05'),{module:m}=moduleFromEtalon(ref);
  assert.equal(m.kitchen?.dryer?.length,8);
  const ps=parts(m).filter(p=>p.id.startsWith('kitchen-dryer:'));
  assert.equal(ps.length,8);
  assert.ok(ps.every(p=>p.model?.native&&/^hardware\/bazis\/[0-9a-f]{12}\.glb$/.test(p.model.file)));
  const row=compareModule(ref,m).hardware.find(h=>h.category==='сушка')!;
  assert.deepEqual([row.ref,row.studio],[8,8]);assert.ok((row.maxPosDelta??0)<=1,'точки сушки как в Базисе');
  // кватернионы Базиса округлены до 0,01 (|q|² = 1,0082) — у студии единичные, сетка не растянута
  assert.ok(ref.hardware.some(h=>h.category==='сушка'&&h.quat&&Math.abs(Math.hypot(...h.quat)-1)>1e-3),'в эталоне есть неединичные');
  assert.ok(ps.every(p=>Math.abs(Math.hypot(...p.model!.quat!)-1)<1e-9),'у студии единичные');
  assert.equal(row.note,undefined,'повороты сушки совпадают');
  // жёсткая полка над сушкой (724) в Базисе без крепежа — студия конфирматов в неё не ставит
  const fixedShelf=`${m.sections[0].id}:shelf:${m.sections[0].fixed![0]}`;
  assert.deepEqual(m.kitchen?.jointNone?.filter(j=>j.startsWith(fixedShelf)).sort(),[`${fixedShelf}:left`,`${fixedShelf}:right`]);
  assert.deepEqual(parts(m).filter(p=>/^(fast|ecc):/.test(p.id)&&p.id.includes(':shelf:')).map(p=>p.id),[]);
  const cf=compareModule(ref,m).hardware.find(h=>h.category==='конфирмат')!;assert.deepEqual([cf.ref,cf.studio],[8,8]);
  // k21 m05 сам по себе не проходит проверку (алюминиевый фасад) — сохранение стыков полки без крепежа проверяем на обычном навесном
  const w=kitchenWall(initialModule(),600),sid=w.sections[0].id;
  w.sections[0].shelves=[0.5];w.sections[0].fixed=[0];
  assert.ok(parts(w).some(p=>p.id.startsWith('fast:')&&p.id.includes(':shelf:')),'без правила полка на конфирматах');
  w.kitchen={...w.kitchen!,jointNone:[`${sid}:shelf:0:left`,`${sid}:shelf:0:right`]};
  const saved=parseModule(JSON.parse(JSON.stringify(w)));
  assert.deepEqual(saved.kitchen?.jointNone,w.kitchen.jointNone,'стыки полки без крепежа переживают сохранение');
  assert.deepEqual(parts(saved).filter(p=>/^(fast|ecc):/.test(p.id)&&p.id.includes(':shelf:')).map(p=>p.id),[]);
  // сверщик видит поворот сушки: элемент без поворота Базиса (на 90° вокруг Y от проекта) — расхождение
  const turned={...m,kitchen:{...m.kitchen!,dryer:m.kitchen!.dryer!.map((d,i)=>i?d:{...d,quat:[1,0,0,0] as [number,number,number,number]})}};
  assert.match(compareModule(ref,turned).hardware.find(h=>h.category==='сушка')!.note??'',/поворот ≠ ×1/);
  assert.deepEqual(parseModule(JSON.parse(JSON.stringify({...kitchenWall(initialModule(),600),kitchen:{role:'wall',dryer:m.kitchen?.dryer}}))).kitchen?.dryer,m.kitchen?.dryer,'сушка переживает сохранение');
  const k6=moduleFromEtalon(load('k06','m07'));
  // n4-wall: сушка без сетки — точка проекта без тела (как в Базисе), геометрия не выдумывается
  assert.deepEqual(k6.module.kitchen?.dryer?.map(d=>d.mesh),[undefined]);assert.ok(k6.notes.some(n=>/без сетки/.test(n)));
  assert.ok(parts(k6.module).filter(p=>p.id.startsWith('kitchen-dryer:')).every(p=>!p.model));
});
test('навесной под вытяжку k08 m10: дно короче сзади (перед ХДФ) и без крепежа, как в Базисе — сверка PASS',{skip:!existsSync(`${ETALON}/k08.json`)},()=>{
  const ref=load('k08','m10'),{module:m}=moduleFromEtalon(ref);
  assert.equal(m.kitchen?.bottomBack,20);
  assert.deepEqual(m.kitchen?.jointNone,['bottom:left','bottom:right']);
  const ps=parts(m);
  assert.equal(ps.filter(p=>p.id.startsWith('fast:bottom:')).length,0);
  const b=ps.find(p=>p.id==='bottom')!;assert.equal(b.position[2]-b.size[2]/2,20);
  assert.ok(compareModule(ref,m).pass);
  assert.deepEqual(partCollisions(ps,m).map(x=>x.names.join(' × ')),[]);
  assert.deepEqual(parseModule(JSON.parse(JSON.stringify(m))).kitchen?.jointNone,['bottom:left','bottom:right']);
});
test('навесной с сушкой k05 m10: жёсткая полка над сушкой — свои отступы конфирматов и кромка перед/зад, как в Базисе',{skip:!existsSync(`${ETALON}/k05.json`)},()=>{
  const ref=load('k05','m10'),{module:m}=moduleFromEtalon(ref);
  const id=`${m.sections[0].id}:shelf:${m.sections[0].fixed![0]}`;
  assert.deepEqual(m.kitchen?.jointZ?.[`${id}:left`],[53,52]);
  assert.deepEqual(m.edgeScheme?.fixedSides,['+z','-z']);
  assert.ok(compareModule(ref,m).pass);
});
test('угловой навесной с диагональным фасадом (k03 m10) — честно сырой, причина первой; прямоугольный навесной причины не получает',{skip:!existsSync(`${ETALON}/k03.json`)},()=>{
  const {unsupported}=moduleFromEtalon(load('k03','m10'));
  assert.match(unsupported[0],/диагональным фасадом/);
  assert.ok(!moduleFromEtalon(load('k10','m09')).unsupported.some(u=>/диагональ/.test(u)));
});
test('навесной с поднятым дном и фасадами выше низа (k13 m05): низ фасадов из проекта главнее правила raise — петель как в Базисе, не больше',{skip:!existsSync(`${ETALON}/k13.json`)},()=>{
  const ref=load('k13','m05'),{module:m}=moduleFromEtalon(ref);
  assert.ok(m.kitchen?.raise);
  assert.equal(m.kitchen?.faceBottom,361.5);
  assert.equal(facadeBottom(m),361.5);
  const h=compareModule(ref,m).hardware.find(x=>x.category==='петля')!;
  assert.equal(h.studio,h.ref);
});
