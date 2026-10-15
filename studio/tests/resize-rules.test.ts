// Пакет 0: координаты Базиса в полях модуля → правила «от кромки детали + сторона», чтобы модуль переживал смену ширины/высоты.
// Каждое правило — отдельный тест на исходном и изменённом размере + сохранение; общий прогон — все PASS-модули базы ±100.
import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync} from 'node:fs';
import {initialModule,parseModule,parts,validate,railAt,type Module} from '../src/model';
import {kitchenBase,kitchenWall,kitchenLegs,grooveHoleAt,grooveHoleOf,parseGrooveHole,nearRight,splitSides,sideDists,mirrorKitchen} from '../src/kitchen';
import {mirrorModule} from '../src/operations';
import {partCollisions} from '../src/collisions';
import {relayoutKDrawers,isFirmax,parseKDrawers,axisCeiling} from '../src/kitchenDrawers';
import {ETALON_DIR,resizeSweep,RESIZE_CHANGES} from '../scripts/kitchen/resize-sweep';
import {kitchenProject,setLegHeight,legsByRule,legsFromBazis,legsBazisNote} from '../src/kitchenProject';
import type {PlacedModule} from '../src/project';

const at=(ps:ReturnType<typeof parts>,id:string)=>{const p=ps.find(q=>q.id===id);assert.ok(p,id);return (p.anchor??p.model?.origin??p.position) as [number,number,number];};
const rt=(m:Module)=>parseModule(JSON.parse(JSON.stringify(m)));

test('опоры: xs — от левого торца, xr — от правого; при смене ширины правые идут за правой боковиной (представление, не раскладка)',()=>{
  const m=kitchenBase(initialModule(),600);m.kitchen!.legs={back:70,front:70,xs:[80],xr:[90]};
  assert.deepEqual(kitchenLegs(m).map(l=>l.x),[80,80,510,510]);
  assert.deepEqual(kitchenLegs({...m,width:500}).map(l=>l.x),[80,80,410,410]);
  assert.deepEqual(validate(m).filter(e=>/Опоры/.test(e)),[]);
  assert.ok(validate({...m,kitchen:{...m.kitchen!,legs:{back:70,front:70,xr:[700]}}}).some(e=>/Опоры: позиции/.test(e)),'xr за дном — ошибка');
  const p=kitchenBase(initialModule(),600);p.kitchen!.legs={back:70,front:70,pts:[[70,70]],ptsR:[[60,90]]};
  assert.deepEqual(kitchenLegs(p).map(l=>[l.x,l.z]),[[70,70],[540,90]]);
  assert.deepEqual(kitchenLegs({...p,width:700}).map(l=>[l.x,l.z]),[[70,70],[640,90]]);
  assert.ok(validate({...p,kitchen:{...p.kitchen!,legs:{back:70,front:70,ptsR:[[-1,70]]}}}).some(e=>/Опоры: точки/.test(e)));
  assert.deepEqual(rt(m).kitchen!.legs,m.kitchen!.legs,'xr переживает сохранение');
  assert.deepEqual(rt(p).kitchen!.legs,p.kitchen!.legs,'ptsR переживает сохранение');
});

test('стяжка: topConfR — конфирматы через крышу от правого конца; atTop — стяжка не у кромки от верха модуля',()=>{
  const m=kitchenWall(initialModule(),600);m.height=720;m.rails=[{place:'rear-top',height:100,topConf:[60],topConfR:[60]}];
  const x=(mm:Module)=>parts(mm).filter(p=>p.id.startsWith('fast:rail:rear-top:top:')).map(p=>at(parts(mm),p.id)[0]).sort((a,b)=>a-b);
  assert.deepEqual(x(m),[76,524]);
  assert.deepEqual(x({...m,width:500}),[76,424],'правый конфирмат — в 60 от правого конца и после сужения');
  assert.deepEqual(x({...m,width:700}),[76,624]);
  const r=kitchenWall(initialModule(),600);r.height=720;r.rails=[{place:'rear-top',height:70,atTop:200}];
  const y=(mm:Module)=>{const p=parts(mm).find(q=>q.id==='rail:rear-top')!;return [p.position[1]-p.size[1]/2,mm.height-(p.position[1]+p.size[1]/2)];};
  assert.deepEqual(y(r),[450,200]);
  assert.deepEqual(y({...r,height:620}),[350,200],'при −100 стяжка остаётся в 200 от верха');
  assert.deepEqual(validate({...r,height:620}).filter(e=>/Стяжка/.test(e)),[]);
  const a=kitchenWall(initialModule(),600);a.height=720;a.rails=[{place:'rear-top',height:70,at:450}];
  assert.deepEqual(y({...a,height:620}),[450,100],'at — по-прежнему от пола (старые файлы)');
  assert.deepEqual(rt(m).rails,m.rails);assert.deepEqual(rt(r).rails,r.rails);
});

test('стяжка с atTop: validate считает низ той же формулой, что parts (railAt) — выход за боковины ловится честной ошибкой; axisCeiling — низ стяжки, а не её высота',()=>{
  const r=kitchenWall(initialModule(),600);r.height=720;r.rails=[{place:'rear-top',height:70,atTop:200}];
  assert.equal(railAt(r,r.rails[0]),450);assert.deepEqual(validate(r).filter(e=>/Стяжка/.test(e)),[]);
  const low={...r,rails:[{place:'rear-top' as const,height:70,atTop:700}]};
  assert.equal(railAt(low,low.rails[0]),-50);
  assert.ok(validate(low).some(e=>/Стяжка на заданной высоте выходит за боковины/.test(e)),'atTop ниже дна — ошибка, как и at');
  assert.ok(validate({...r,rails:[{place:'rear-top',height:70,at:-50}]}).some(e=>/выходит за боковины/.test(e)));
  const b=kitchenBase(initialModule(),600,'drawers');b.rails=[{place:'rear-top',height:70,atTop:100}];
  assert.equal(axisCeiling(b),b.height-170,'потолок ящиков — под низом стяжки (100 от верха + 70)');
  b.rails=[{place:'rear-top',height:70}];assert.equal(axisCeiling(b),b.height-70,'стяжка у кромки — как было');
  b.rails=[{place:'rear-top',height:70,at:300}];assert.equal(axisCeiling(b),b.height-(b.topType==='none'?0:16),'at от пола — не верхняя, как было');
});

test('стяжка на дне: eccR/dowelR — эксцентрики и шканты правой половины от правого конца стяжки',()=>{
  const m=kitchenWall(initialModule(),600);m.height=720;m.rails=[{place:'rear-bottom',height:60}];
  m.kitchen!.railUnder={'rear-bottom':{ecc:[65],dowel:[97],eccR:[65],dowelR:[97],face:'front'}};
  const xs=(mm:Module,pre:string)=>parts(mm).filter(p=>p.id.startsWith(pre)).map(p=>p.anchor![0]).sort((a,b)=>a-b);
  assert.deepEqual(xs(m,'ecc:rail-under:'),[81,519]);assert.deepEqual(xs(m,'dowel:rail-under:'),[113,487]);
  assert.deepEqual(xs({...m,width:500},'ecc:rail-under:'),[81,419]);assert.deepEqual(xs({...m,width:500},'dowel:rail-under:'),[113,387]);
  assert.deepEqual(rt(m).kitchen!.railUnder,m.kitchen!.railUnder,'eccR/dowelR переживают сохранение');
});

test('grooveHoles: точка от ближней кромки (sx/sy) — пометка «как в Базисе» переживает смену ширины и высоты; старая тройка — абсолютная',()=>{
  const m={width:600,height:720};
  assert.deepEqual(grooveHoleOf([592,19,478],m),[8,19,478,-1,1]);
  assert.deepEqual(grooveHoleOf([8,704,478],m),[8,16,478,1,-1]);
  assert.deepEqual(grooveHoleAt([8,19,478,-1,1],{width:500,height:720}),[492,19,478]);
  assert.deepEqual(grooveHoleAt([8,16,478,1,-1],{width:600,height:620}),[8,604,478]);
  assert.deepEqual(grooveHoleAt([592,19,478],{width:500,height:720}),[592,19,478],'тройка без сторон — как было');
  assert.deepEqual(parseGrooveHole([8,19,478,-1,1]),[8,19,478,-1,1]);assert.deepEqual(parseGrooveHole([8,19,478]),[8,19,478]);
  const w=kitchenWall(initialModule(),600);w.bazis=true;w.kitchen!.grooveHoles=[[8,19,478,-1,1]];
  assert.deepEqual(rt(w).kitchen!.grooveHoles,w.kitchen!.grooveHoles,'стороны переживают сохранение');
  const w2=kitchenWall(initialModule(),600);w2.bazis=true;w2.kitchen!.grooveHoles=[[592,19,478]];
  assert.deepEqual(rt(w2).kitchen!.grooveHoles,[[592,19,478]]);
});

test('Firmax: точки направляющих и шурупы фальшпанели с маркером −1 — от правой боковины; знак x не признак (k19 m10: точки левее боковины)',()=>{
  const m=kitchenBase(initialModule(),600,'drawers');m.doors=false;m.sections[0].shelves=[];m.sections[0].drawers=0;
  m.kdrawers=relayoutKDrawers(m,2,undefined,'firmax-ldsp');
  const k=m.kdrawers![0];assert.ok(isFirmax(k));
  k.box.runs=[[10,k.runnerY,0],[-10,k.runnerY,0,-1],[-31,k.runnerY,0]];k.box.faceScrews=[[60,30],[-60,30,-1]];
  const sl=(mm:Module)=>{const ps=parts(mm);return [at(ps,'kd:0:slide:L')[0],at(ps,'kd:0:slide:R')[0],at(ps,'kd:0:slide:L2')[0]];};
  assert.deepEqual(sl(m),[26,574,-15],'от левой: 16+10; от правой: 584−10; без маркера отрицательный — левее левой боковины, как в Базисе');
  assert.deepEqual(sl({...m,width:500}),[26,474,-15]);
  const fs=(mm:Module)=>{const ps=parts(mm);return [at(ps,'kd:0:screw:fxf:0')[0],at(ps,'kd:0:screw:fxf:1')[0]];};
  const [a,b]=fs(m),[a2,b2]=fs({...m,width:500});
  assert.equal(a,a2,'левый шуруп — от левой боковины ящика');assert.equal(b-b2,100,'правый — от правой');
  const back=parseKDrawers(JSON.parse(JSON.stringify(m.kdrawers)))![0];assert.ok(isFirmax(back));
  assert.deepEqual(back.box.runs,k.box.runs);assert.deepEqual(back.box.faceScrews,k.box.faceScrews);
});

test('высота опор (панель «Высота опор»): точки направляющих Firmax поднимаются по y, маркер −1 «от правой боковины» остаётся — правые направляющие не уезжают на левую боковину',()=>{
  const m=kitchenBase(initialModule(),600,'drawers');m.doors=false;m.sections[0].shelves=[];m.sections[0].drawers=0;
  m.kdrawers=relayoutKDrawers(m,2,undefined,'firmax-ldsp');
  const k=m.kdrawers![0];assert.ok(isFirmax(k));
  k.box.runs=[[8.5,k.runnerY,-500],[-8.5,k.runnerY,-500,-1],[16.5,k.runnerY,-500],[-16.5,k.runnerY,-500,-1]];
  const placed:PlacedModule={id:'a',x:0,y:0,z:0,rotation:0,module:m};
  const p={...kitchenProject(),modules:[placed]};
  const n=setLegHeight(p,['a'],m.feet!.height+20);
  const nk=n.modules[0].module.kdrawers![0];assert.ok(isFirmax(nk));
  assert.deepEqual(nk.box.runs,k.box.runs.map(r=>r.length>3?[r[0],r[1]+20,r[2],r[3]]:[r[0],r[1]+20,r[2]]),'y +20, маркер на месте');
  const sx=(mm:Module)=>{const ps=parts(mm);return ps.filter(q=>q.id.startsWith('kd:0:slide:')).map(q=>(q.anchor??q.model?.origin??q.position)[0]).sort((a,b)=>a-b);};
  assert.deepEqual(sx(n.modules[0].module),sx(m),'x направляющих — как до смены высоты опор');
  assert.deepEqual(validate(n.modules[0].module),[]);
});

test('«Вернуть по правилу»: снимает xs, xr, pts и ptsR вместе — раскладка по правилу, а не одни правые опоры; подпись перечисляет и правые',()=>{
  const m=kitchenBase(initialModule(),1200);
  const rule=kitchenLegs(m).map(l=>[l.x,l.z]);
  m.kitchen!.legs={back:70,front:70,xs:[70,390],xr:[70,390]};
  assert.equal(kitchenLegs(m).length,8);assert.ok(legsFromBazis(m.kitchen!.legs));
  assert.match(legsBazisNote(m.kitchen!.legs),/70, 390 мм от левого края; 70, 390 мм от правого края/);
  const back=legsByRule(m.kitchen!.legs);assert.deepEqual(back,{back:70,front:70});
  assert.deepEqual(kitchenLegs({...m,kitchen:{...m.kitchen!,legs:back}}).map(l=>[l.x,l.z]),rule,'после кнопки — ровно раскладка по правилу');
  const onlyR={back:70,front:70,xr:[70,390]};assert.ok(legsFromBazis(onlyR),'только xr — тоже раскладка Базиса, поле «Опоры от торцов» не показываем');
  assert.equal(kitchenLegs({...m,kitchen:{...m.kitchen!,legs:legsByRule(onlyR)}}).length,4);
  const pts={back:70,front:70,pts:[[70,70]] as [number,number][],ptsR:[[60,90]] as [number,number][]};
  assert.ok(legsFromBazis(pts));assert.match(legsBazisNote(pts),/2 точек как в Базисе/);
  assert.deepEqual(kitchenLegs({...m,kitchen:{...m.kitchen!,legs:legsByRule(pts)}}).map(l=>[l.x,l.z]),rule);
  assert.ok(!legsFromBazis({back:70,front:70,side:100}));
});

test('короб вытяжки (пакет 1 на правилах пакета 0): ширина по стенкам и центр — от центра модуля, низ — от полки, верх — от крыши; при ±100 нет тихих пересечений с навесами и полкой; зеркало — знак dx и свес',()=>{
  const m=kitchenWall(initialModule(),450);m.height=1040;m.depth=400;m.sections[0].shelves=[0.3];m.sections[0].fixed=[0];
  m.kitchen!.hoodBox={w:212,on:0,gapBelow:0,gapAbove:0,z0:21,z1:253.5,front:{mount:'overlay'}};
  const box=(mm:Module)=>{const ps=parts(mm);const l=ps.find(p=>p.id==='hood:wall:left')!,r=ps.find(p=>p.id==='hood:wall:right')!,sh=ps.find(p=>p.id.endsWith(':shelf:0'))!,top=ps.find(p=>p.id==='top')!;
    return {x:[l.position[0]-8,r.position[0]+8],y0:l.position[1]-l.size[1]/2,y1:l.position[1]+l.size[1]/2,shelfTop:sh.position[1]+sh.size[1]/2,topBottom:top.position[1]-top.size[1]/2};};
  const near=(a:number,b:number,msg?:string)=>assert.ok(Math.abs(a-b)<0.011,`${msg??''} ${a} ≠ ${b}`);
  const b=box(m);assert.deepEqual(b.x,[119,331]);near(b.y0,b.shelfTop);near(b.y1,b.topBottom);
  const w=box({...m,width:350});assert.deepEqual(w.x,[69,281],'ширина короба 212 — ширина вытяжки, по центру и после сужения');
  const h=box({...m,height:1140});near(h.y0,h.shelfTop,'низ идёт за полкой');near(h.y1,h.topBottom,'верх — за крышей');
  for(const mm of [m,{...m,width:350},{...m,width:550},{...m,height:940},{...m,height:1140}]){assert.deepEqual(validate(mm),[]);assert.deepEqual(partCollisions(parts(mm),mm).filter(c=>!c.bazis).map(c=>c.a+'×'+c.b),[]);}
  // не помещается — честная ошибка, не молча пропавший короб
  assert.ok(validate({...m,width:240}).some(e=>/Короб вытяжки/.test(e)));
  const z=structuredClone(m);z.kitchen!.hoodBox!.dx=-10;z.kitchen!.hoodBox!.front.over=[2,0];mirrorKitchen(z);
  assert.equal(z.kitchen!.hoodBox!.dx,10);assert.deepEqual(z.kitchen!.hoodBox!.front.over,[0,2]);mirrorKitchen(z);assert.deepEqual(z.kitchen!.hoodBox,{...m.kitchen!.hoodBox,dx:-10,front:{mount:'overlay',over:[2,0]}});
  assert.deepEqual(rt(m).kitchen!.hoodBox,m.kitchen!.hoodBox,'поле переживает сохранение');
});

// Честный список исключений общего прогона: прогоны без ошибки validate, где после ±100 остаётся пересечение/потеря пометки.
// Не поля пакета 0: газлифт против полки (положение полки — правило шкафа), число точек стыка при ширине 292 (правило kitchenJointPoints).
const EXCEPTIONS=new Set(['k07/m07/height-100','k10/m10/width-100']);
test('все PASS-модули базы переживают ширину ±100 и высоту ±100: либо чисто, либо проверка говорит об этом (validate); тихих — только список исключений',{skip:!existsSync(ETALON_DIR)},()=>{
  const r=resizeSweep(RESIZE_CHANGES);
  assert.ok(r.modules>=173,`PASS-модулей ${r.modules}`);
  assert.deepEqual(r.skipped,[],'на исходном размере все PASS-модули без ошибок и пересечений');
  const silent=r.hits.filter(h=>!h.errors.length).map(h=>`${h.kitchen}/${h.key}/${h.change}`);
  assert.deepEqual(silent.filter(s=>!EXCEPTIONS.has(s)),[],'тихие поломки вне списка исключений');
  // ни одного крепежа/опоры за габаритом и фурнитуры в воздухе без ошибки validate
  assert.deepEqual(r.hits.filter(h=>!h.errors.length&&(h.outside.length||h.air.length)).map(h=>`${h.kitchen}/${h.key}/${h.change}`),[]);
  assert.ok(r.hits.length<=49,`прогонов с замечаниями ${r.hits.length} (было 84 до пакета 0, 49 после)`);
});

test('щит: partCollisions у модуля с относительными полями на исходном размере — пусто (сверка не меняется)',()=>{
  const m=kitchenWall(initialModule(),600);m.height=720;m.kitchen!.hangers=false;m.rails=[{place:'rear-top',height:100,confY:[34,66],topConf:[60],topConfR:[60]}];
  assert.deepEqual(partCollisions(parts(m),m).filter(c=>/rail:rear-top/.test(c.a+c.b)),[]);
  assert.deepEqual(partCollisions(parts({...m,width:500}),m).filter(c=>/rail:rear-top/.test(c.a+c.b)),[]);
});

test('зеркало (mirrorModule): поля кухни со стороной отражаются — xs↔xr, pts↔ptsR, topConf↔topConfR, ecc↔eccR, маркер −1 у runs/faceScrews, grooveHoles, sideDown; дважды — исходное',()=>{
  const p=kitchenProject(),a=p.modules.find(q=>q.module.kitchen?.role==='base'&&!!q.module.feet)!;
  const m=kitchenBase(initialModule(),a.module.width,'drawers');m.doors=false;m.sections[0].shelves=[];m.sections[0].drawers=0;
  m.kitchen!.legs={back:70,front:70,xs:[70],xr:[120]};
  m.rails=[{place:'rear-top',height:100,lay:'flat',topConf:[60],topConfR:[90]}];
  m.kitchen!.railUnder={'rear-bottom':{ecc:[50],dowel:[150],face:'back'}};
  m.kitchen!.grooveHoles=[[20,100,20],[30,200,20,-1,1]];
  m.kitchen!.sideDown={side:'left',y0:0};
  m.kdrawers=relayoutKDrawers(m,2,undefined,'firmax-ldsp');
  const k=m.kdrawers![0];assert.ok(isFirmax(k));
  k.box.runs=[[8.5,k.runnerY,-500],[-8.5,k.runnerY,-500,-1]];k.box.faceScrews=[[30,20],[-30,20,-1]];
  const legs0=kitchenLegs(m).map(l=>[l.x,l.z]);
  const n=structuredClone(m);mirrorKitchen(n);
  assert.deepEqual(n.kitchen!.legs,{back:70,front:70,xs:[120],xr:[70]});
  assert.deepEqual(kitchenLegs(n).map(l=>[m.width-l.x,l.z]).sort(),legs0.sort(),'опоры — зеркально по ширине');
  assert.deepEqual(n.rails,[{place:'rear-top',height:100,lay:'flat',topConf:[90],topConfR:[60]}]);
  assert.deepEqual(n.kitchen!.railUnder,{'rear-bottom':{ecc:[],dowel:[],eccR:[50],dowelR:[150],face:'back'}});
  assert.deepEqual(n.kitchen!.grooveHoles,[[m.width-20,100,20],[30,200,20,1,1]]);
  assert.equal(n.kitchen!.sideDown!.side,'right');
  const nk=n.kdrawers![0];assert.ok(isFirmax(nk));
  // x точки = грань боковины + v (слева v > 0, справа v < 0): зеркало меняет знак v и маркер вместе
  assert.deepEqual(nk.box.runs,[[-8.5,k.runnerY,-500,-1],[8.5,k.runnerY,-500]]);assert.deepEqual(nk.box.faceScrews,[[-30,20,-1],[30,20]]);
  // точки направляющих в деталях: левая «8,5 внутрь от левой боковины» стала «8,5 внутрь от правой» — x зеркально
  const sx=(mm:Module)=>parts(mm).filter(q=>q.id.startsWith('kd:0:slide:')).map(q=>(q.anchor??q.model?.origin??q.position)[0]).sort((a,b)=>a-b);
  assert.deepEqual(sx(n).map(x=>Math.round((m.width-x)*10)/10).sort((a,b)=>a-b),sx(m).map(x=>Math.round(x*10)/10));
  const back=structuredClone(n);mirrorKitchen(back);
  assert.deepEqual(back,m,'второе отражение возвращает исходное');
  // через операцию проекта (на месте нижнего из ряда по умолчанию): кухня отражается вместе с секциями, валидна
  a.module=structuredClone(m);
  const pm=mirrorModule(p,a.id).modules.find(q=>q.id===a.id)!.module;
  assert.deepEqual(pm.kitchen!.legs,{back:70,front:70,xs:[120],xr:[70]});assert.deepEqual(validate(pm),[]);
});

// Одно правило «половина → от ближней кромки» вместо восьми рукописных: середина — к левой стороне, как было в каждом месте.
test('пакет 0: nearRight/splitSides/sideDists — одно правило стороны для xs/xr, pts/ptsR, topConf/topConfR, ecc/eccR, runs, grooveHoles',()=>{
  assert.equal(nearRight(300,0,600),false);assert.equal(nearRight(300.1,0,600),true);assert.equal(nearRight(1016,1000,1032),false);assert.equal(nearRight(1017,1000,1032),true);
  // k03: конфирматы на 60 и 508 у стяжки 568 → topConf [60], topConfR [60]; порядок — по возрастанию расстояний
  assert.deepEqual(sideDists([508,60],0,568),{left:[60],right:[60]});
  assert.deepEqual(sideDists([1032+508,1032+60,1032+284],1032,1600),{left:[60,284],right:[60]});
  // опоры k16/m01: 70, 390, 810, 1130 при ширине 1200 → xs [70, 390], xr [70, 390]
  assert.deepEqual(sideDists([70,390,810,1130],0,1200),{left:[70,390],right:[70,390]});
  // точки опор: элементы сохраняются как есть, порядок исходный
  const pts:[number,number][]=[[640,94],[70,71],[70,425],[640,425]];
  assert.deepEqual(splitSides(pts,([x])=>x,0,710),{left:[[70,71],[70,425]],right:[[640,94],[640,425]]});
  assert.deepEqual(sideDists([],0,600),{left:[],right:[]});
  // grooveHoleOf — через то же правило: середина ширины остаётся «от левого», середина высоты — «от низа»
  assert.deepEqual(grooveHoleOf([300,360,20],{width:600,height:720}),[300,360,20,1,1]);
  assert.deepEqual(grooveHoleOf([301,361,20],{width:600,height:720}),[299,359,20,-1,-1]);
});
