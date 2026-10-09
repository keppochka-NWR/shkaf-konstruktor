import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync,readFileSync} from 'node:fs';
import {validate,parts,parseModule,initialModule,fastenerCounts} from '../src/model';
import {kitchenBase} from '../src/kitchen';
import {estimate} from '../src/pricing';
import {newProject} from '../src/project';
import {compareModule,type RefModule} from '../scripts/kitchen/compare';
import {moduleFromEtalon} from '../scripts/kitchen/fromEtalon';
import {edgesAllAround,edgesNone,sideTopBare,pinInsetFront,irregularLegs,sideDown,hingePlateHoles,frontEdge,faceGapsTB,backGapsTB,eccFromBelow,shelfEdges,plainFronts,sameFronts} from '../scripts/kitchen/recognize-base';
import {partCollisions} from '../src/collisions';
import {holes} from '../src/drilling';
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
  // ящик без направляющих (k20 m11, TANDEMBOX в «ящик-система») и подъёмный на газлифте (k11 m09) — не «фасад без петель»
  if(has('k20'))assert.equal(moduleFromEtalon(load('k20','m11')).module.kitchen?.hinges,undefined);
  if(has('k11'))assert.equal(moduleFromEtalon(load('k11','m09')).module.kitchen?.hinges,undefined);
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
  // «Евровинт 6х50» в разделе «прочее» (k33 m01) — это крепёж: флаг «без крепежа» не ставится
  if(has('k33'))assert.equal(moduleFromEtalon(load('k33','m01')).module.kitchen?.fasteners,undefined);
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

test('дно под боковинами глубже 600 — 3 конфирмата на сторону, третий посередине (k16 m06, k20 m01 PASS); ровно 600 (k30 m03) и мельче — два',{skip:!has('k16')||!has('k20')},()=>{
  for(const [k,key] of [['k16','m06'],['k20','m01']]){
    const ref=load(k,key),{module:m}=moduleFromEtalon(ref);
    const bot=parts(m).find(p=>p.id==='bottom')!;
    assert.ok(bot.size[2]>600,k+key);
    const zs=parts(m).filter(p=>p.id.startsWith('fast:bottom:left:')).map(p=>p.model!.origin![2]).sort((a,b)=>a-b);
    assert.equal(zs.length,3,k+key);
    assert.ok(Math.abs(zs[1]-bot.position[2])<0.01,'середина дна');
    const c=compareModule(ref,m);
    assert.ok(c.pass,k+key+' '+why(c));
  }
  const pal=kitchenBase(initialModule(),600);
  assert.equal(parts(pal).filter(p=>p.id.startsWith('fast:bottom:left:')).length,2,'палитра 557 — два');
  const deep={...pal,depth:650};
  assert.equal(parts(deep).filter(p=>p.id.startsWith('fast:bottom:left:')).length,3,'кухня глубиной 650 — три');
  const w={...initialModule(),depth:650,bottomUnder:true};
  assert.equal(parts(w).filter(p=>p.id.startsWith('fast:bottom:left:')).length,2,'не кухня — как было');
  // ровно 600 — два на сторону (Базис: 9 из 9 днищ 602–700 — по три, единственное ровно 600 — по два)
  assert.equal(parts({...pal,depth:600}).filter(p=>p.id.startsWith('fast:bottom:left:')).length,2,'кухня глубиной 600 — два');
  assert.equal(parts({...pal,depth:602}).filter(p=>p.id.startsWith('fast:bottom:left:')).length,3,'кухня глубиной 602 — три');
  if(has('k30')){
    const ref=load('k30','m03'),c=compareModule(ref,moduleFromEtalon(ref).module);
    const cf=c.hardware.find(h=>h.category==='конфирмат')!;
    assert.deepEqual([cf.ref,cf.studio],[26,26],'k30 m03: дно ровно 600 — лишних конфирматов нет');
  }
});

test('фасад без петель — только если студия строит те же фасады, что в Базисе: несколько рядов, ниша, стекло, ЛДСП корпуса — фасадов не добавляем',{skip:!has('k20')||!has('k32')||!has('k23')},()=>{
  const extraFacades=(k:string,key:string)=>{const ref=load(k,key),{module:m}=moduleFromEtalon(ref);return {m,n:compareModule(ref,m).extra.filter(x=>x.cls.startsWith('фасад|')).length};};
  // k20 m09: дверь 597×330 и два стекла «Наполнение» в 3 ряда — раньше студия ставила два распашных по 2398 и 12 пересечений с конфирматами
  for(const [k,key] of [['k20','m09'],['k32','m04'],['k23','m15'],['k23','m16'],['k20','m02']]){
    const {m,n}=extraFacades(k,key);
    assert.equal(n,0,`${k} ${key}: лишних фасадов нет`);
    // k23 m15/m16 (пенал с нишей под технику): распознаватель пенала (n3-tall) строит те же фасады, что в Базисе (два ряда, ниша,
    // фасады без петель) — тогда «без петель» законно; остальные — фасадов по-прежнему нет
    const same=k==='k23';
    if(same){assert.equal(m.doors,true,`${k} ${key}: фасады пенала как в Базисе`);assert.ok(m.sections[0].doorNiche!==undefined&&m.sections[0].hingeless?.length,`${k} ${key}: ниша и фасады без петель`);}
    else{assert.notEqual(m.kitchen?.hinges,false,`${k} ${key}: флаг «без петель» не ставится`);assert.equal(m.doors,false,`${k} ${key}: распашных нет`);}
    assert.equal(partCollisions(parts(m),m).filter(c=>c.names.some(n=>/Фасад распашной/.test(n))).length,0,`${k} ${key}: ${same?'пересечений с фасадами нет':'распашного фасада нет — и пересечений с ним нет'}`);
  }
  // k32 m04: ЛДСП корпуса «4-ФП» — не фасад, ошибки «Фасад шире 700» больше нет
  assert.ok(!validate(extraFacades('k32','m04').m).some(e=>/Фасад шире/.test(e)));
  assert.equal(plainFronts(load('k32','m04')),false,'ЛДСП корпуса');
  assert.equal(plainFronts(load('k20','m02')),false,'стекло «Наполнение»');
  // ящики без направляющих разной ширины (k29 m07: 296 и 44) — не две равные створки
  if(has('k29'))assert.equal(extraFacades('k29','m07').n,0);
  // а где студия повторяет фасады Базиса один в один — правило работает, как раньше (k13 m06, k29 m06, k23 m14: два ряда пенала)
  for(const [k,key] of [['k13','m06'],['k29','m06'],['k23','m14']]){
    if(!has(k))continue;
    const ref=load(k,key),{module:m}=moduleFromEtalon(ref);
    assert.equal(m.kitchen?.hinges,false,`${k} ${key}`);
    assert.equal(sameFronts(ref,m),true,`${k} ${key}`);
  }
});

test('узкий нижний (200, k05 m02): опоры в два ряда в 70 от торцов, как в Базисе (PASS); внахлёст (150, k16 m07: 70 и 80) — не повторяем, один ряд',{skip:!has('k05')||!has('k16')},()=>{
  const ref=load('k05','m02'),{module:m}=moduleFromEtalon(ref);
  assert.ok(m.width<250);
  assert.equal(parts(m).filter(p=>p.id.startsWith('leg:')).length,4);
  const c=compareModule(ref,m);
  assert.ok(c.pass,why(c));
  const {module:n}=moduleFromEtalon(load('k16','m07'));
  const legs=parts(n).filter(p=>p.id.startsWith('leg:'));
  assert.equal(legs.length,2,'один ряд по центру — без пересечения опор');
  const pal=kitchenBase(initialModule(),200);
  assert.equal(parts(pal).filter(p=>p.id.startsWith('leg:')).length,2,'палитра 200 — один ряд');
});

test('стяжка на ребре в 1 мм от задней кромки боковин (мойки k17 m04, k14 m09) — как в Базисе, PASS; у шкафа утопание стяжки на ребре не действует',{skip:!has('k17')||!has('k14')},()=>{
  for(const [k,key] of [['k17','m04'],['k14','m09']]){
    const ref=load(k,key),{module:m}=moduleFromEtalon(ref);
    const rr=m.rails!.find(r=>r.place==='rear-top'&&r.lay!=='flat');
    if(rr){assert.equal(rr.setback,1,k+key);const p=parts(m).find(x=>x.id==='rail:rear-top')!;assert.equal(p.position[2]-p.size[2]/2,1);}
    const c=compareModule(ref,m);
    assert.ok(c.pass,k+key+' '+why(c));
  }
  const w={...initialModule(),rails:[{place:'rear-top' as const,height:100,setback:5}]};
  const p=parts(w).find(x=>x.id==='rail:rear-top')!;
  assert.equal(p.position[2]-p.size[2]/2,0,'шкаф — как было');
});

test('опоры не сеткой (k15 m02: правая задняя на 23 глубже левой) — точки как в Базисе, клипсы на передних, PASS; сетка — как раньше',{skip:!has('k15')},()=>{
  const ref=load('k15','m02'),{module:m}=moduleFromEtalon(ref);
  assert.deepEqual(irregularLegs(ref),[[70,71],[70,425],[640,94],[640,425]]);
  assert.deepEqual(m.kitchen?.legs?.pts,[[70,71],[70,425],[640,94],[640,425]]);
  assert.equal(parts(m).filter(p=>p.id.startsWith('leg:')).length,4);
  assert.equal(parts(m).filter(p=>p.id.startsWith('kitchen-clip:')).length,2);
  const c=compareModule(ref,m);
  assert.ok(c.pass,why(c));
  if(has('k25'))assert.equal(irregularLegs(load('k25','m07')),undefined,'сетка — без точек');
  const back=parseModule(JSON.parse(JSON.stringify(m)));
  assert.deepEqual(back.kitchen?.legs?.pts,m.kitchen?.legs?.pts);
});

test('опущенная боковина (k22 m01: левая до низа дна, дно под правой; k06 m01: левая до пола) — детали корпуса совпали с Базисом',{skip:!has('k22')||!has('k06')},()=>{
  const ref=load('k22','m01');
  assert.deepEqual(sideDown(ref),{side:'left',y0:100});
  const {module:m}=moduleFromEtalon(ref);
  assert.deepEqual(m.kitchen?.sideDown,{side:'left',y0:100});
  const L=parts(m).find(p=>p.id==='left')!,B=parts(m).find(p=>p.id==='bottom')!;
  assert.equal(L.position[1]-L.size[1]/2,100);
  assert.equal(B.size[0],484);
  assert.ok(edgeByDir(L)['-y']>0,'нижний торец опущенной боковины кромится');
  const c=compareModule(ref,m);
  assert.deepEqual([c.missing.length,c.extra.length],[0,0],why(c));
  assert.ok(c.pairs.every(p=>p.delta<=0.5),JSON.stringify(c.pairs.filter(p=>p.delta>0.5).map(p=>p.ref.name)));
  assert.ok(parts(m).filter(p=>p.id.startsWith('fast:bottom:right:')).length===2,'под правой — конфирматы снизу');
  assert.deepEqual(sideDown(load('k06','m01')),{side:'left',y0:10});
  if(has('k25'))assert.equal(sideDown(load('k25','m07')),undefined,'обычный нижний — без опущенной боковины');
  const back=parseModule(JSON.parse(JSON.stringify(m)));
  assert.deepEqual(back.kitchen?.sideDown,{side:'left',y0:100});
});

test('петли без наколок под планку (k29 m04): у Базиса только чашка Ø35 — у студии тоже, лишних отверстий нет; обычная кухня — наколки есть',{skip:!has('k29')},()=>{
  const ref=load('k29','m04');
  assert.equal(hingePlateHoles(ref),false);
  const {module:m}=moduleFromEtalon(ref);
  assert.equal(m.kitchen?.plateHoles,false);
  const c=compareModule(ref,m);
  assert.deepEqual([c.holes?.missing.length,c.holes?.extra.length],[0,0],JSON.stringify(c.holes?.extra.slice(0,4)));
  if(has('k25'))assert.equal(hingePlateHoles(load('k25','m07')),true);
  // передние торцы корпуса кромлены 2 при остальных 0,5 (k29) — как в Базисе; розетка помещения — в реестре отступлений, сверка PASS
  assert.deepEqual(frontEdge(ref),{front:2,other:0.5});
  assert.deepEqual([m.edgeScheme?.t,m.edgeScheme?.front],[0.5,2]);
  const L=parts(m).find(p=>p.id==='left')!;
  assert.deepEqual([edgeByDir(L)['+z'],edgeByDir(L)['+y']],[2,0.5]);
  assert.ok(c.deviations?.includes('Розетка'));
  assert.ok(c.pass,why(c));
  const pal=kitchenBase(initialModule(),600);
  const d3=(x:typeof pal)=>holes(x,parts(x)).filter(h=>h.d===3).length;
  const plates=parts(pal).filter(p=>p.id.includes(':hingeplate:')).length;
  assert.ok(plates>0);
  assert.equal(d3(pal)-d3({...pal,kitchen:{...pal.kitchen!,plateHoles:false}}),2*plates,'палитра — по 2 наколки на петлю; без флага не трогаем');
});

test('зазор фасадов сверху/снизу не как сбоку (k18 m03: 3 и 1,5 при 2; k29 m06: 4 и 2) — как в Базисе, PASS; палитра — как была',{skip:!has('k18')||!has('k29')},()=>{
  for(const [k,key,top,bottom] of [['k18','m03',3,1.5],['k29','m06',4,undefined]] as const){
    const ref=load(k,key),{module:m}=moduleFromEtalon(ref);
    assert.equal(m.kitchen?.faceTop,top,k+key);
    assert.equal(m.kitchen?.faceBottom,bottom,k+key);
    const c=compareModule(ref,m);
    assert.ok(c.pass,k+key+' '+why(c));
  }
  assert.equal(faceGapsTB(load('k18','m03'),2)?.top,3);
  const pal=kitchenBase(initialModule(),600);
  assert.equal(pal.kitchen?.faceTop,undefined);
  const door=parts(pal).find(p=>p.role==='door')!;
  assert.equal(door.position[1]+door.size[1]/2,pal.height-pal.faceGap!,'палитра — верх фасада по faceGap');
});

test('накладной ХДФ с зазорами снизу/сверху не как сбоку (k32 m06: 2 и 4 при 1,5) — как в Базисе, PASS; палитра — как была',{skip:!has('k32')},()=>{
  const ref=load('k32','m06'),{module:m}=moduleFromEtalon(ref);
  assert.deepEqual(m.kitchen?.backGaps,{bottom:2,top:4});
  const b=parts(m).find(p=>p.id==='back')!;
  assert.deepEqual([b.position[1]-b.size[1]/2,b.position[1]+b.size[1]/2],[2,744]);
  const c=compareModule(ref,m);
  assert.ok(c.pass,why(c));
  assert.equal(backGapsTB(load('k32','m09'),1.5)?.top,2);
  const pal=kitchenBase(initialModule(),600);
  assert.equal(pal.kitchen?.backGaps,undefined);
  const pb=parts(pal).find(p=>p.id==='back')!;
  assert.equal(pb.position[1]+pb.size[1]/2,pal.height-pal.backGap!,'палитра — по backGap');
});

test('эксцентрик дна снизу (kitchen.eccBelow) — как в Базисе; под площадкой опоры (k22 m01) не повторяем — без пересечений; съёмные полки k22 — кромка только спереди',{skip:!has('k22')},()=>{
  const ref=load('k22','m01');
  assert.equal(eccFromBelow(ref),'legs');
  const {module:m}=moduleFromEtalon(ref);
  assert.equal(m.kitchen?.eccBelow,undefined);
  assert.deepEqual(m.edgeScheme?.shelf,['+z']);
  assert.deepEqual(shelfEdges(ref),['+z']);
  assert.ok(!partCollisions(parts(m),m).some(x=>x.names.some(n=>n.startsWith('Эксцентрик'))),'эксцентрик ни с чем не пересекается');
  // флаг сам по себе: бочонок у нижней пласти дна
  const pal=kitchenBase(initialModule(),600);
  const e={...pal,jointFastening:{'bottom:left':'eccentric' as const,'bottom:right':'eccentric' as const},bottomUnder:false,kitchen:{...pal.kitchen!,eccBelow:true as const}};
  const bot=parts(e).find(p=>p.id==='bottom')!,ecc=parts(e).find(p=>p.id.startsWith('ecc:bottom:')&&!p.id.endsWith(':pin'))!;
  assert.equal(ecc.anchor![1],bot.position[1]-bot.size[1]/2);
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

test('навесной с дном выше низа боковин (k30 m06: свес 18,5): цоколя в Базисе нет — студия его не добавляет и не требует «высоту цоколя из списка»; шкафы — как было',{skip:!has('k30')},()=>{
  for(const key of ['m06','m07','m08','m10']){
    const ref=load('k30',key),{module:m}=moduleFromEtalon(ref);
    assert.equal(m.kitchen?.plinth?.off,true,key);
    assert.ok(!parts(m).some(p=>p.id==='plinth'),key+': детали «Цоколь» нет');
    assert.ok(!validate(m).includes('Выберите высоту цоколя из списка.'),key);
    assert.ok(!compareModule(ref,m).extra.some(x=>x.name==='Цоколь'),key+': лишнего цоколя в сверке нет');
    // подъём дна остаётся: дно на высоте Базиса
    const b=parts(m).find(p=>p.id==='bottom')!;
    assert.equal(b.position[1]-b.size[1]/2,m.plinthHeight,key);
  }
  // шкаф на цоколе 18,5 — по-прежнему ошибка списка и деталь «Цоколь»; кухня без флага — тоже
  const w={...initialModule(),plinthHeight:18.5};
  assert.ok(validate(w).includes('Выберите высоту цоколя из списка.'));
  assert.ok(parts(w).some(p=>p.id==='plinth'));
  const kb=kitchenBase(initialModule(),600),nf={...kb,feet:undefined,plinthHeight:100,kitchen:{...kb.kitchen!,noLegs:true as const}};
  assert.ok(parts(nf).some(p=>p.id==='plinth'),'кухня без опор с цоколем — цоколь есть');
  // «дно» навесного — верхняя горизонталь (k14 m06: 658), а у пола только планка у задней стены — это не цоколь, студия цоколь 16×658 не ставит
  if(has('k14')){const ref=load('k14','m06'),{module:m}=moduleFromEtalon(ref);assert.ok(!parts(m).some(p=>p.id==='plinth'));assert.ok(!compareModule(ref,m).extra.some(x=>x.name==='Цоколь'));}
});

test('цоколь пенала без опор назван в Базисе «Фронтальная» (k20 m09) — студия ставит одну деталь на его месте (отступ 16), а не цоколь плюс «стяжку на высоте 0»',{skip:!has('k20')},()=>{
  const ref=load('k20','m09'),{module:m}=moduleFromEtalon(ref);
  assert.equal(m.kitchen?.plinth?.inset,16);
  const pl=parts(m).find(p=>p.id==='plinth')!;
  assert.deepEqual([pl.position[2]-pl.size[2]/2,pl.position[2]+pl.size[2]/2,pl.size[1]],[428,444,70]);
  assert.ok(!(m.rails??[]).some(r=>r.at===0&&r.place.startsWith('front')),'цоколь не стяжка спереди (задняя «Фронтальная» 0–70 у стены — стяжка сзади, как была)');
  const c=compareModule(ref,m);
  assert.ok(!c.extra.some(x=>x.name==='Цоколь'),why(c));
  assert.ok(c.pairs.some(p=>p.studio.name==='Цоколь'&&p.ref.name==='Фронтальная'&&p.delta===0),'цоколь студии — та же деталь Базиса');
  // сохранение проекта не теряет отступ
  const kb=kitchenBase(initialModule(),600);
  assert.equal(parseModule(JSON.parse(JSON.stringify({...kb,kitchen:{...kb.kitchen!,plinth:{height:95,inset:16}}}))).kitchen?.plinth?.inset,16);
  // шкаф — цоколь утоплен на RULES.plinthInset, как было
  const w={...initialModule(),plinthHeight:100},wp=parts(w).find(p=>p.id==='plinth')!;
  assert.equal(w.depth-(wp.position[2]+wp.size[2]/2),2);
});

test('флаги «без петель» / «без крепежа» видны во вкладке «Кухня» и снимаются: петли и полкодержатели возвращаются в 3D, присадку и смету',()=>{
  const m=kitchenBase(initialModule(),600);
  const off={...m,kitchen:{...m.kitchen!,hinges:false as const,fasteners:false as const}};
  assert.equal(hingeIds(off).length,0);
  assert.equal(fastenerCounts(off).shelfHolders,0);
  // кнопка «Поставить петли» / «Поставить крепёж» удаляет флаг — модуль снова как обычная кухня
  const {hinges:_h,fasteners:_f,...k}=off.kitchen; void _h; void _f;
  const on={...off,kitchen:k};
  assert.deepEqual(hingeIds(on).map(p=>p.id),hingeIds(m).map(p=>p.id));
  assert.deepEqual(fastenerCounts(on),fastenerCounts(m));
  assert.ok(priced(on).some(id=>id.startsWith('hinge')),'петли снова в смете');
  const src=readFileSync(new URL('../src/KitchenPanel.tsx',import.meta.url),'utf8');
  assert.match(src,/k\.hinges === false && <p[^>]*>Как в проекте Базиса[^]*?delete n\.kitchen!\.hinges[^]*?Поставить петли/);
  assert.match(src,/k\.fasteners === false && <p[^>]*>Как в проекте Базиса[^]*?delete n\.kitchen!\.fasteners[^]*?Поставить крепёж/);
});
