import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync,readFileSync} from 'node:fs';
import {validate,parts,initialModule,facadeBottom,parseModule,grooveBox} from '../src/model';
import {kitchenWall} from '../src/kitchen';
import {compareModule,type RefModule} from '../scripts/kitchen/compare';
import {moduleFromEtalon} from '../scripts/kitchen/fromEtalon';
import {refCategory} from '../scripts/kitchen/refHardware';
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
  // боковины k32 — фигурные (вырез 100×20 в заднем верхнем углу): студия даёт прямоугольник, сверка это видит — PASS нечестный
  const c=compareModule(ref,m);
  assert.equal(c.pass,false);
  assert.ok(c.contours?.some(x=>/фигурный контур Базиса \(6 точек, вырез 2000 мм²\)/.test(x)),String(c.contours));
  assert.deepEqual([c.missing.length,c.extra.length,c.pairs.filter(p=>p.delta>0.5).length],[0,0,0],'остальное совпадает');
  const back=parseModule(JSON.parse(JSON.stringify(m)));
  assert.equal(back.kitchen?.noFasteners,true);assert.deepEqual(back.edgeScheme?.ends,m.edgeScheme?.ends);
});
test('«Евровинт 6х50» из «прочего» эталона — конфирмат: k33 m03 и k34 m04 крепёж не снимается',{skip:!existsSync(`${ETALON}/k33.json`)||!existsSync(`${ETALON}/k34.json`)},()=>{
  assert.equal(refCategory({name:'Евровинт 6х50',category:'прочее'}),'конфирмат');
  assert.equal(refCategory({name:'Винт прямого крепления с потайной головкой, ø6,3х14 мм',category:'прочее'}),'прочее');
  assert.equal(refCategory({name:'Полкодержатель D5 никель',category:'полкодержатель'}),'полкодержатель');
  for(const [k,key,n] of [['k33','m03',8],['k34','m03',8],['k34','m04',4],['k33','m01',8]] as const){
    const ref=load(k,key),{module:m}=moduleFromEtalon(ref);
    assert.notEqual(m.kitchen?.noFasteners,true,`${k} ${key}: крепёж в Базисе есть`);
    assert.ok(parts(m).filter(p=>p.id.startsWith('fast:')).length>=n,`${k} ${key}: конфирматы студии`);
    const c=compareModule(ref,m),row=c.hardware.find(h=>h.category==='конфирмат')!;
    assert.equal(row.ref,n,`${k} ${key}: евровинты Базиса посчитаны конфирматами`);
    assert.ok(!c.hardware.some(h=>h.category==='прочее'&&h.ref>0),'в «прочем» евровинтов не осталось');
    assert.ok((c.holes?.matched??0)>0,`${k} ${key}: присадка крепежа совпадает хотя бы частично`);
  }
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
  assert.deepEqual(parseModule(JSON.parse(JSON.stringify({...kitchenWall(initialModule(),600),kitchen:{role:'wall',dryer:m.kitchen?.dryer}}))).kitchen?.dryer,m.kitchen?.dryer,'сушка переживает сохранение');
  const k6=moduleFromEtalon(load('k06','m07'));
  assert.equal(k6.module.kitchen?.dryer,undefined);assert.ok(k6.notes.some(n=>/без сетки/.test(n)));
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
