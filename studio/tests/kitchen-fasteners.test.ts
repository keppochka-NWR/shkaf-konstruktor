import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync,readFileSync} from 'node:fs';
import {validate,parts,initialModule,parseModule} from '../src/model';
import {kitchenWall} from '../src/kitchen';
import {holes} from '../src/drilling';
import {partCollisions} from '../src/collisions';
import {compareModule,honestPass,type RefModule} from '../scripts/kitchen/compare';
import {moduleFromEtalon} from '../scripts/kitchen/fromEtalon';
import {railEccY} from '../scripts/kitchen/recognize-common';

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
