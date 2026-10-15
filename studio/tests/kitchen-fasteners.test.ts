import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync,readFileSync} from 'node:fs';
import {validate,parts,initialModule,parseModule,fastenerCounts} from '../src/model';
import {kitchenWall,kitchenBase} from '../src/kitchen';
import {holes} from '../src/drilling';
import {partCollisions} from '../src/collisions';
import {compareModule,honestPass,type RefModule} from '../scripts/kitchen/compare';
import {moduleFromEtalon,underEccFromEtalon} from '../scripts/kitchen/fromEtalon';
import {railEccY} from '../scripts/kitchen/recognize-common';
import {pinSides,pinRowsOf} from '../scripts/kitchen/recognize-base';
import {wallJointZ} from '../scripts/kitchen/wallJoints';

// Пакет 3 (крепёж по Базису): стяжка на ребре на эксцентриках в боковины — rails[].eccY. Эталоны лежат вне репозитория — без них тесты по ним пропускаются.
const ETALON='C:/Users/My PC/Desktop/Claude Project/Кухни/etalon';
const has=(k:string)=>existsSync(`${ETALON}/${k}.json`);
const load=(k:string,key:string)=>(JSON.parse(readFileSync(`${ETALON}/${k}.json`,'utf8')).modules as RefModule[]).find(m=>m.key===key)!;

const wallWithRail=(w=600)=>{const m=kitchenWall(initialModule(),w);m.height=720;m.kitchen!.hangers=false;m.rails=[{place:'rear-bottom',height:100,eccY:[50]}];return m;};

test('стяжка на ребре на эксцентриках в боковины (rails[].eccY): бочонок с внутренней пласти в 34 от боковины, шток в торец, D5 в боковину; конфирматов нет',()=>{
  const m=wallWithRail();
  assert.deepEqual(validate(m),[]);
  const ps=parts(m),rail=ps.find(p=>p.id==='rail:rear-bottom')!;
  assert.ok(rail,'стяжка построена');
  const barrels=ps.filter(p=>/^ecc:rail:rear-bottom:(left|right):0$/.test(p.id)),pins=ps.filter(p=>/^ecc:rail:rear-bottom:(left|right):0:pin$/.test(p.id));
  assert.equal(barrels.length,2);assert.equal(pins.length,2);
  assert.ok(!ps.some(p=>p.id.startsWith('fast:rail:rear-bottom')),'конфирматов в стяжку нет');
  const y=rail.position[1]-rail.size[1]/2+50,zf=rail.position[2]+rail.size[2]/2; // задняя стяжка: внутренняя пласть — передняя (+z)
  const L=barrels.find(p=>p.id.includes(':left:'))!;
  assert.equal(Math.round(L.position[0]*10)/10,16+34);assert.equal(Math.round(L.position[1]*10)/10,Math.round(y*10)/10);
  assert.deepEqual(L.anchor?.map(v=>Math.round(v*10)/10),[16,Math.round(y*10)/10,Math.round(zf*10)/10]);
  // присадка: D15×12 с пласти стяжки внутрь (−z), D8×34 в торец стяжки (+x), D5×12 в боковину (−x) — все по одной высоте
  const hs=holes(m,ps).filter(h=>h.src.startsWith('ecc:rail:rear-bottom:left:0'));
  const at=(id:string)=>hs.find(h=>h.src===id)!;
  assert.deepEqual([at('ecc:rail:rear-bottom:left:0').d,at('ecc:rail:rear-bottom:left:0').depth,at('ecc:rail:rear-bottom:left:0').dir],[15,12,[0,0,-1]]);
  assert.deepEqual(at('ecc:rail:rear-bottom:left:0').at.map(v=>Math.round(v*10)/10),[50,Math.round(y*10)/10,Math.round(zf*10)/10]);
  assert.deepEqual([at('ecc:rail:rear-bottom:left:0:pin').d,at('ecc:rail:rear-bottom:left:0:pin').depth,at('ecc:rail:rear-bottom:left:0:pin').dir],[8,34,[1,0,0]]);
  assert.deepEqual([at('ecc:rail:rear-bottom:left:0:side').d,at('ecc:rail:rear-bottom:left:0:side').depth,at('ecc:rail:rear-bottom:left:0:side').dir],[5,12,[-1,0,0]]);
  assert.equal(Math.round(at('ecc:rail:rear-bottom:left:0:pin').at[2]*10)/10,Math.round((zf-rail.size[2]/2)*10)/10,'шток — по середине толщины стяжки');
  assert.ok(!partCollisions(ps,m).some(c=>/ecc:rail/.test(c.a)||/ecc:rail/.test(c.b)),'эксцентрики стяжки ничего не пересекают');
});

test('eccY — правило «от низа стяжки»: при смене ширины эксцентрики остаются у боковин, при смене высоты — на стяжке; сохраняется в проекте',()=>{
  const m=wallWithRail(600),w=wallWithRail(700);
  const R=(x:ReturnType<typeof parts>)=>x.find(p=>p.id==='ecc:rail:rear-bottom:right:0')!;
  assert.equal(Math.round((R(parts(w)).position[0]-R(parts(m)).position[0])*10)/10,100);
  assert.equal(Math.round(parts(m).find(p=>p.id==='ecc:rail:rear-bottom:left:0')!.position[0]*10)/10,Math.round(parts(w).find(p=>p.id==='ecc:rail:rear-bottom:left:0')!.position[0]*10)/10);
  const h=wallWithRail();h.height=820;
  const rail=parts(h).find(p=>p.id==='rail:rear-bottom')!,e=parts(h).find(p=>p.id==='ecc:rail:rear-bottom:left:0')!;
  assert.equal(Math.round((e.position[1]-(rail.position[1]-rail.size[1]/2))*10)/10,50);
  assert.deepEqual(validate(h),[]);
  const back=parseModule(JSON.parse(JSON.stringify(m)));
  assert.deepEqual(back.rails?.[0]?.eccY,[50],'eccY переживает сохранение');
  assert.ok(!(initialModule().rails??[]).some(r=>r.eccY),'шкаф студии — без eccY');
});

test('validate: эксцентрики стяжки только у стяжки на ребре и в 8 мм от её кромок',()=>{
  const a=wallWithRail();a.rails=[{place:'rear-bottom',height:100,eccY:[4]}];
  assert.ok(validate(a).some(e=>/Эксцентрики стяжки/.test(e)));
  const b=wallWithRail();b.rails=[{place:'rear-bottom',height:100,eccY:[96]}];
  assert.ok(validate(b).some(e=>/Эксцентрики стяжки/.test(e)));
  const c=wallWithRail();c.rails=[{place:'rear-top',height:100,lay:'flat',eccY:[50]}];
  assert.ok(validate(c).some(e=>/Эксцентрики стяжки/.test(e)));
});

test('railEccY: эксцентрики на внутренней пласти боковин внутри полосы стяжки, одинаково слева и справа; иначе undefined',()=>{
  const b={x0:16,y0:16,z0:0,x1:384,y1:116,z1:16};
  const hw=(pts:number[][])=>pts.map(([x,y,z])=>({name:'Эксцентрик',category:'эксцентрик',pos:[x,y,z]}));
  assert.deepEqual(railEccY(b,hw([[16,66,8],[384,66,8]]),16,384),[50]);
  assert.deepEqual(railEccY(b,hw([[16,50,8],[16,82,8],[384,50,8],[384,82,8]]),16,384),[34,66]);
  assert.equal(railEccY(b,hw([[16,66,8]]),16,384),undefined,'только слева — правило студии');
  assert.equal(railEccY(b,hw([[16,16,8],[384,16,8]]),16,384),undefined,'на кромке стяжки — это крепёж дна (railUnder), не стяжки');
  assert.equal(railEccY(b,hw([[0,66,8],[400,66,8]]),16,384),undefined,'на наружной пласти — не стык стяжки');
});

// m_HDF_FIX: ХДФ на саморезах 3,5×12 по той же раскладке, что гвозди (nailRows): имя крепежа из проекта в kitchen.nails.name
test('ХДФ на саморезах 3,5×12 (k09 m04): раскладка nailRows, имя крепежа из проекта, сверка «прочее» 18/18 — PASS',{skip:!has('k09')},()=>{
  const ref=load('k09','m04'),{module:m,unsupported}=moduleFromEtalon(ref);
  assert.equal(m.kitchen?.nails?.name,'Саморез 3,5х12 мм, Zn');
  const ns=parts(m).filter(p=>p.id.startsWith('nail:'));
  assert.equal(ns.length,18);assert.ok(ns.every(p=>p.name==='Саморез 3,5х12 мм, Zn'),'деталь названа как в проекте, не «Гвоздь»');
  const err=validate(m),c=compareModule(ref,m),row=c.hardware.find(h=>h.category==='прочее')!;
  assert.deepEqual([row.ref,row.studio],[18,18]);assert.ok((row.maxPosDelta??0)<=1);
  assert.equal(honestPass(c,err,unsupported),true,JSON.stringify({err,unsupported}));
  assert.deepEqual(parseModule(JSON.parse(JSON.stringify(m))).kitchen?.nails,m.kitchen?.nails,'имя крепежа переживает сохранение');
  assert.deepEqual(partCollisions(parts(m),m),[]);
});

test('гвозди Базиса без имени в поле (как раньше): деталь «Гвоздь»; смешанные имена крепежа ХДФ — не распознаём',()=>{
  const m=kitchenWall(initialModule(),600);m.height=720;m.kitchen!.hangers=false;m.backType='nailed';
  const q:[number,number,number,number]=[1,0,0,0];m.kitchen!.nails={q:{bottom:q,top:q,left:q,right:q}};
  const ns=parts(m).filter(p=>p.id.startsWith('nail:'));
  assert.ok(ns.length>0);assert.ok(ns.every(p=>p.name==='Гвоздь'));
  m.kitchen!.nails={name:'Саморез 3,5х12 мм, Zn',q:{bottom:q,top:q,left:q,right:q}};
  assert.ok(parts(m).filter(p=>p.id.startsWith('nail:')).every(p=>p.name==='Саморез 3,5х12 мм, Zn'));
  assert.equal(parseModule(JSON.parse(JSON.stringify(m))).kitchen?.nails?.name,'Саморез 3,5х12 мм, Zn');
});

// m_HANDLE: ручка Базиса на фасадах ящиков Базиса — по тому же правилу kitchen.handle, что у дверей (k09 m05: рейлинг 128, 31,5 от верха, по центру)
test('ручки Базиса на фасадах ящиков (k09 m05): по одной на фасад, 31,5 от верха, по центру; сверка «ручка» 3/3 — PASS',{skip:!has('k09')},()=>{
  const ref=load('k09','m05'),{module:m,unsupported}=moduleFromEtalon(ref);
  assert.deepEqual([m.kitchen?.handle?.dy,m.kitchen?.handle?.from,m.kitchen?.handle?.horizontal],[31.5,'top',true]);
  const ps=parts(m),hs=ps.filter(p=>p.role==='handle');
  assert.equal(hs.length,3);
  assert.ok(hs.every(p=>/^kd:\d+:drawer:handle$/.test(p.id)&&p.name==='Ручка фасада · Мебельная ручка рейлинг 128'));
  for(const h of hs){const f=ps.find(p=>p.id===h.id.replace(':drawer:handle',':facade'))!;assert.ok(f,'фасад ящика');
    assert.equal(Math.round((f.position[1]+f.size[1]/2-h.position[1])*10)/10,31.5);assert.equal(h.position[0],f.position[0]);}
  const err=validate(m),c=compareModule(ref,m),row=c.hardware.find(h=>h.category==='ручка')!;
  assert.deepEqual([row.ref,row.studio,row.maxPosDelta],[3,3,0]);
  assert.deepEqual(err,[],'ручка на фасаде ящика не считается длиннее фасада');
  assert.equal(honestPass(c,err,unsupported),true,JSON.stringify({err,unsupported}));
  assert.deepEqual(partCollisions(ps,m),[]);
});

test('ручки на фасадах ящиков — только у кухни Базиса с kitchen.handle; без него и при noHandles ручек нет',()=>{
  const base=parseModule(JSON.parse(JSON.stringify(initialModule())));
  assert.ok(!parts(base).some(p=>/^kd:\d+:drawer:handle$/.test(p.id)));
});

test('k04 m05 (навесной 400×1000): нижняя задняя стяжка на эксцентриках в боковины по проекту — PASS',{skip:!has('k04')},()=>{
  const ref=load('k04','m05'),{module:m,unsupported}=moduleFromEtalon(ref);
  const r=m.rails?.find(x=>x.place==='rear-bottom');
  assert.deepEqual(r?.eccY,[50]);assert.notEqual(r?.fasten,false);
  const err=validate(m),c=compareModule(ref,m);
  assert.equal(honestPass(c,err,unsupported),true,JSON.stringify({err,unsupported,hw:c.hardware.filter(h=>h.ref!==h.studio||(h.maxPosDelta??0)>2)}));
  assert.equal(c.holes?.matched,c.holes?.ref);
});

// m_FAST: третий эксцентрик «боковина на дне» у задней кромки дна без шканта (kitchen.underEcc.extra) — по базе 8 от задней кромки
// у обеих боковин (k27 m04, k27 m05, k28 m08) и у левой (k28 m12); пара стяжки — эксцентрики со своим шкантом
const wallUnder=(depth=336)=>{const m=kitchenWall(initialModule(),500);m.height=750;m.depth=depth;m.kitchen!.hangers=false;m.bottomUnder=true;
  m.jointFastening={'bottom:left':'eccentric','bottom:right':'eccentric'};m.dowels={offset:32};m.kitchen!.underEcc={back:82.5,front:61.5,extra:{left:[8],right:[8]}};return m;};

test('underEcc.extra: эксцентрик без шканта в 8 от задней кромки дна у обеих боковин — D8×34 в торец боковины, D15×12 в пласть, D5×12 в дно',()=>{
  const m=wallUnder(),ps=parts(m);
  assert.deepEqual(validate(m),[]);
  const bottom=ps.find(p=>p.id==='bottom')!,z0=bottom.position[2]-bottom.size[2]/2;
  for(const s of ['left','right']){
    const b=ps.find(p=>p.id===`ecc:under:${s}:x0`)!;assert.ok(b,'бочонок '+s);
    assert.ok(ps.some(p=>p.id===`ecc:under:${s}:x0:pin`),'шток '+s);
    assert.equal(Math.round((b.anchor![2]-z0)*10)/10,8);
    assert.ok(!ps.some(p=>p.id===`dowel:under:${s}:x0`),'шканта у третьего нет');
    const hs=holes(m,ps).filter(h=>h.src.startsWith(`ecc:under:${s}:x0`));
    assert.deepEqual(hs.map(h=>[h.d,h.depth]).sort(),[[15,12],[5,12],[8,34]].sort());
  }
  assert.equal(ps.filter(p=>/^ecc:under:/.test(p.id)&&!p.id.endsWith(':pin')).length,6,'по 2 стяжки + 1 у каждой боковины');
  assert.equal(ps.filter(p=>/^dowel:under:/.test(p.id)).length,4,'шканты только у пары');
});

test('underEcc.extra — правило «от задней кромки дна»: при смене глубины остаётся в 8 от неё; переживает сохранение; validate — в пределах дна',()=>{
  const a=parts(wallUnder(336)),b=parts(wallUnder(400));
  const off=(ps:ReturnType<typeof parts>)=>{const bt=ps.find(p=>p.id==='bottom')!;return Math.round((ps.find(p=>p.id==='ecc:under:left:x0')!.anchor![2]-(bt.position[2]-bt.size[2]/2))*10)/10;};
  assert.equal(off(a),8);assert.equal(off(b),8);
  assert.deepEqual(parseModule(JSON.parse(JSON.stringify(wallUnder()))).kitchen?.underEcc,{back:82.5,front:61.5,extra:{left:[8],right:[8]}});
  const bad=wallUnder();bad.kitchen!.underEcc!.extra={left:[3]};
  assert.ok(validate(bad).some(e=>/Эксцентрики дна у задней кромки/.test(e)));
  const one=wallUnder();one.kitchen!.underEcc!.extra={left:[8]};
  assert.ok(parts(one).some(p=>p.id==='ecc:under:left:x0')&&!parts(one).some(p=>p.id==='ecc:under:right:x0'),'только у левой');
});

test('underEccFromEtalon: пара — эксцентрики со шкантом, остальные — extra по сторонам; без шкантов при трёх — не берём',()=>{
  const bottom={x0:0,y0:0,z0:0,x1:500,y1:16,z1:336},left={x0:0,y0:16,z0:0,x1:16,y1:750,z1:336},right={x0:484,y0:16,z0:0,x1:500,y1:750,z1:336};
  const e=(x:number,z:number)=>({name:'Стяжка эксц. (компл.)',category:'эксцентрик',pos:[x,16,z]}),d=(x:number,z:number)=>({name:'Шкант 8х30 мм',category:'шкант',pos:[x,0,z]});
  const hw=[e(0,274.5),e(0,82.5),e(0,8),e(500,274.5),e(500,82.5),e(500,8),d(8,114.5),d(8,242.5),d(492,114.5),d(492,242.5)];
  assert.deepEqual(underEccFromEtalon(hw as never,bottom,left,right),{at:{back:82.5,front:61.5,extra:{left:[8],right:[8]}},sides:['left','right'],dowel:32});
  const noDowels=hw.filter(h=>h.category!=='шкант');
  assert.equal(underEccFromEtalon(noDowels as never,bottom,left,right),null);
  const two=[e(0,274.5),e(0,82.5),e(500,274.5),e(500,82.5),d(8,114.5)];
  assert.deepEqual(underEccFromEtalon(two as never,bottom,left,right)?.at,{back:82.5,front:61.5},'две стяжки — без extra, как раньше');
});

for(const [k,key] of [['k27','m05'],['k28','m12']] as const)
  test(`${k} ${key}: эксцентрик у задней кромки дна по проекту — PASS`,{skip:!has(k)},()=>{
    const ref=load(k,key),{module:m,unsupported}=moduleFromEtalon(ref);
    assert.ok(m.kitchen?.underEcc?.extra?.left?.includes(8));
    const err=validate(m),c=compareModule(ref,m);
    assert.equal(honestPass(c,err,unsupported),true,JSON.stringify({err,unsupported,hw:c.hardware.filter(h=>h.ref!==h.studio||(h.maxPosDelta??0)>2)}));
    assert.equal(c.holes?.matched,c.holes?.ref);
  });
// m_PINS: полкодержатели у левой и правой стойки на разных местах по глубине — kitchen.pinSide (k16 m03: левая 64,5/64,5)
const baseShelves=()=>{const m=kitchenBase(initialModule(),575);m.sections[0].shelves=[0.4];m.shelfPinInset=43.5;m.shelfPinInsetFront=53.5;return m;};
const pinZ=(m:ReturnType<typeof baseShelves>)=>{const ps=parts(m),sh=ps.find(p=>p.role==='shelf')!,z0=sh.position[2]-sh.size[2]/2,z1=sh.position[2]+sh.size[2]/2;
  const at=(k:number)=>ps.find(p=>p.id===`shp:${sh.id}:${k}`)!.position[2];return {lr:Math.round((at(0)-z0)*10)/10,rr:Math.round((at(1)-z0)*10)/10,lf:Math.round((z1-at(2))*10)/10,rf:Math.round((z1-at(3))*10)/10};};

test('pinSide: у левой стойки свои места полкодержателей, у правой — общее правило; от торцов полки при смене глубины',()=>{
  const m=baseShelves();m.kitchen!.pinSide={left:[64.5,64.5]};
  assert.deepEqual(validate(m),[]);
  assert.deepEqual(pinZ(m),{lr:64.5,rr:43.5,lf:64.5,rf:53.5});
  const d=baseShelves();d.kitchen!.pinSide={left:[64.5,64.5]};d.depth+=60;
  assert.deepEqual(pinZ(d),{lr:64.5,rr:43.5,lf:64.5,rf:53.5},'отступы — от торцов полки');
  assert.deepEqual(parseModule(JSON.parse(JSON.stringify(m))).kitchen?.pinSide,{left:[64.5,64.5]});
  const no=baseShelves();assert.deepEqual(pinZ(no),{lr:43.5,rr:43.5,lf:53.5,rf:53.5},'без поля — как раньше');
  const bad=baseShelves();bad.kitchen!.pinSide={right:[5,50]};
  assert.ok(validate(bad).some(e=>/Полкодержатели стойки/.test(e)));
});

test('pinSides: сторона берётся, только если на всех полках одинаково и отличается от правила больше 0,5; не пара на стойку — нет',()=>{
  const sh=(y:number)=>({i:0,name:'Полка',mat:'',thick:16,kind:'ldsp',box:[17,y,4,558,y+16,549],axis:'y'});
  const pin=(x:number,y:number,z:number)=>({i:0,name:'Полкодержатель',category:'полкодержатель',pos:[x,y,z]});
  const ref=(pins:ReturnType<typeof pin>[])=>({key:'m',name:'',archetype:'base-doors',size:[575,840,566],panels:[sh(341),sh(582)],hardware:pins} as unknown as RefModule);
  const lvl=(y:number)=>[pin(559,y,47.5),pin(559,y,495.5),pin(16,y,68.5),pin(16,y,484.5)];
  assert.deepEqual(pinSides(ref([...lvl(341),...lvl(582)]),43.5,53.5),{left:[64.5,64.5]});
  assert.equal(pinSides(ref([...lvl(341),pin(559,582,47.5),pin(559,582,495.5),pin(16,582,47.5),pin(16,582,495.5)]),43.5,53.5),undefined,'на разных полках по-разному — правила нет');
  assert.equal(pinSides(ref([pin(559,341,47.5),pin(559,341,495.5),pin(16,341,47.8),pin(16,341,495.3)]),43.5,53.5),undefined,'≤ 0,5 — округление Базиса');
  assert.equal(pinSides(ref([pin(559,341,47.5),pin(559,341,200),pin(559,341,495.5),pin(16,341,47.5),pin(16,341,495.5)]),43.5,53.5),undefined,'три держателя у стойки — не пара');
});

test('k16 m03: полкодержатели левой стойки 64,5/64,5 по проекту — PASS',{skip:!has('k16')},()=>{
  const ref=load('k16','m03'),{module:m,unsupported}=moduleFromEtalon(ref);
  assert.deepEqual(m.kitchen?.pinSide,{left:[64.5,64.5]});
  const err=validate(m),c=compareModule(ref,m),row=c.hardware.find(h=>h.category==='полкодержатель')!;
  assert.deepEqual([row.ref,row.studio,row.maxPosDelta],[8,8,0]);
  assert.equal(honestPass(c,err,unsupported),true,JSON.stringify({err,unsupported}));
  assert.equal(c.holes?.matched,c.holes?.ref);
});

// m_PINS: перфорация Базиса — ряды полкодержателей без полки (kitchen.pinRows), k26 m02/m03: −100, −50, 50, 100 от низа полки
const wallRows=()=>{const m=kitchenWall(initialModule(),584);m.height=960;m.kitchen!.hangers=false;m.sections[0].shelves=[0.33,0.66];m.kitchen!.pinRows=[-100,-50,50,100];return m;};

test('pinRows: у каждой съёмной полки ряды по 4 держателя на −100/−50/50/100 от её низа, места по глубине — как у полки; совпавшие и вне корпуса — нет',()=>{
  const m=wallRows(),ps=parts(m);
  assert.deepEqual(validate(m),[]);
  const sh=ps.filter(p=>p.role==='shelf'&&/:shelf:\d+$/.test(p.id));
  assert.equal(sh.length,2);
  const rows=ps.filter(p=>/^shp:.*:r\d+:\d$/.test(p.id));
  assert.equal(rows.length,32,'2 полки × 4 ряда × 4');
  const s0=sh[0],yb=s0.position[1]-s0.size[1]/2;
  const r0=ps.filter(p=>p.id.startsWith(`shp:${s0.id}:r0:`));
  assert.ok(r0.every(p=>Math.round((p.position[1]+3-yb)*10)/10===-100));
  const own=ps.filter(p=>new RegExp(`^shp:${s0.id}:[0-3]$`).test(p.id)).map(p=>p.position[2]).sort();
  assert.deepEqual(r0.map(p=>p.position[2]).sort(),own,'по глубине — как у полки');
  assert.equal(fastenerCounts(m).shelfHolders,40,'смета: 8 у полок + 32 в рядах');
  assert.equal(holes(m,ps).filter(h=>/^shp:.*:r\d+:\d$/.test(h.src)).length,32);
  const near=wallRows();near.kitchen!.pinRows=[-50,50,320];
  assert.ok(parts(near).filter(p=>/^shp:.*:r2:\d$/.test(p.id)).length<8,'ряд на месте другой полки/за крышей — не ставится');
  assert.deepEqual(parseModule(JSON.parse(JSON.stringify(m))).kitchen?.pinRows,[-100,-50,50,100]);
  const bad=wallRows();bad.kitchen!.pinRows=[10];
  assert.ok(validate(bad).some(e=>/Ряды полкодержателей/.test(e)));
  assert.ok(!parts(initialModule()).some(p=>/^shp:.*:r\d+:\d$/.test(p.id)),'шкаф студии — без рядов');
});

test('pinRowsOf: ряды Базиса ровно по правилу у каждой полки — смещения; иначе undefined',()=>{
  const hz=(y:number,i:number)=>({i,name:'Горизонтальная',mat:'',thick:16,kind:'ldsp',box:[16,y,0,568,y+16,330],axis:'y'});
  const pin=(x:number,y:number,z:number)=>({i:0,name:'Полкодержатель',category:'полкодержатель',pos:[x,y,z]});
  const lvl=(y:number)=>[pin(16,y,79),pin(16,y,271),pin(568,y,79),pin(568,y,271)];
  const ref=(pins:ReturnType<typeof pin>[])=>({key:'m',name:'',archetype:'wall',size:[584,960,346],panels:[hz(0,0),hz(314,1),hz(628,2),hz(944,3)],hardware:pins} as unknown as RefModule);
  const all=[314,628].flatMap(s=>[s,s-100,s-50,s+50,s+100].flatMap(lvl));
  assert.deepEqual(pinRowsOf(ref(all)),[-100,-50,50,100]);
  assert.equal(pinRowsOf(ref([314,628,214,264].flatMap(lvl))),undefined,'ряды только у одной полки — правила нет');
  assert.equal(pinRowsOf(ref([314,628].flatMap(lvl))),undefined,'без рядов — поля нет');
});

test('wallJointZ: дно короче спереди — передний крепёж по правилу от лица боковин; от кромки дна (k26 m02: 53/53) — свои отступы',()=>{
  const b=(x0:number,x1:number,z1:number)=>({b:{x0,y0:0,z0:0,x1,y1:16,z1}});
  const hw=(zs:number[])=>zs.flatMap(z=>[{name:'Конфирмат',category:'конфирмат',pos:[0,8,z]},{name:'Конфирмат',category:'конфирмат',pos:[584,8,z]}]);
  const L=b(0,16,330),R=b(568,584,330),bottom=b(16,568,310);
  assert.deepEqual(wallJointZ(hw([53,257]) as never,[['bottom',bottom as never]],L as never,R as never,53,{bottom:20}),{'bottom:left':[53,53],'bottom:right':[53,53]});
  assert.deepEqual(wallJointZ(hw([53,277]) as never,[['bottom',bottom as never]],L as never,R as never,53,{bottom:20}),{},'от лица боковин — правило студии');
});

test('k26 m02: перфорация полкодержателей и крепёж дна от его кромок по проекту — PASS',{skip:!has('k26')},()=>{
  const ref=load('k26','m02'),{module:m,unsupported}=moduleFromEtalon(ref);
  assert.deepEqual(m.kitchen?.pinRows,[-100,-50,50,100]);
  assert.deepEqual(m.kitchen?.jointZ?.['bottom:left'],[53,53]);
  const err=validate(m),c=compareModule(ref,m),row=c.hardware.find(h=>h.category==='полкодержатель')!;
  assert.deepEqual([row.ref,row.studio,row.maxPosDelta],[40,40,0]);
  assert.equal(honestPass(c,err,unsupported),true,JSON.stringify({err,unsupported}));
  assert.equal(c.holes?.matched,c.holes?.ref);
});

test('k14 m03: щит под дном на конфирматах по проекту — PASS',{skip:!has('k14')},()=>{
  const ref=load('k14','m03'),{module:m,unsupported}=moduleFromEtalon(ref);
  assert.deepEqual(m.kitchen?.raise?.conf,{side:[71.5,199.5],top:{kind:'conf',xs:[60],xr:[60]}});
  const err=validate(m),c=compareModule(ref,m),row=c.hardware.find(h=>h.category==='конфирмат')!;
  assert.deepEqual([row.ref,row.studio,row.maxPosDelta],[16,16,0]);
  assert.equal(honestPass(c,err,unsupported),true,JSON.stringify({err,unsupported}));
  assert.equal(c.holes?.matched,c.holes?.ref);
});
