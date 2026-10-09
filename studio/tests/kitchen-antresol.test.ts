import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync,readFileSync} from 'node:fs';
import {initialModule,parts,validate,parseModule,facadeBottom,type Module} from '../src/model';
import {kitchenWall} from '../src/kitchen';
import {holes} from '../src/drilling';
import {partCollisions} from '../src/collisions';
import {hangersFromEtalon,fastenersAbsent,endsEdged,moduleFromEtalon} from '../scripts/kitchen/fromEtalon';
import {compareModule,type RefModule,type RefPanel} from '../scripts/kitchen/compare';

// Антресоль 600×400×350 (как Базис k12 «А 1»): дно и крыша между боковинами, ХДФ в паз, навесы ABS.
const antresol=():Module=>{const m=kitchenWall(initialModule(),600);m.height=400;m.depth=350;m.kitchen={...m.kitchen!,role:'antresol'};return m;};
const hw=(name:string,category:string,pos:number[])=>({name,category,pos});

test('hangers recognizer: Bazis rule 15/20/0 gives no override, absent hangers give null',()=>{
  const std=[hw('Навес мебельный регулируемый ABS левый','навес',[16,385,20]),hw('Навес мебельный регулируемый ABS правый','навес',[584,385,20]),
    hw('Заглушка для мебельного навеса ABS левая','заглушка',[16,385,20]),hw('Заглушка для мебельного навеса ABS правая','заглушка',[584,385,20])];
  assert.deepEqual(hangersFromEtalon(std,16,584,400,0),{});
  assert.equal(hangersFromEtalon([],16,584,400,0),null);
});

test('hangers recognizer: hangers above the body (k12: +285 over the top) and on a plank 100 mm from the side (k18) are kept as in Bazis',()=>{
  const up=hangersFromEtalon([hw('Навес мебельный регулируемый ABS левый','навес',[16,685,20]),hw('Навес мебельный регулируемый ABS правый','навес',[584,685,20])],16,584,400,0)!;
  assert.deepEqual(up.hangerAt,{left:[-285,20,0],right:[-285,20,0]});
  assert.match(up.note!,/выше корпуса на 300/);
  // k18 m14: навес в 99,2 мм от внутренней грани, на 25 ниже верха; заглушка — на боковине по правилу
  const k18=hangersFromEtalon([hw('Навес мебельный регулируемый ABS левый','навес',[115.2,485,20]),hw('Навес мебельный регулируемый ABS правый','навес',[464.2,485,20]),
    hw('Заглушка для мебельного навеса ABS левая','заглушка',[16,495,20]),hw('Заглушка для мебельного навеса ABS правая','заглушка',[565,495,20])],16,565,510,0)!;
  assert.deepEqual(k18.hangerAt,{left:[25,20,99.2],right:[25,20,100.8],caps:{left:[15,20,0],right:[15,20,0]}});
});

test('studio places hangers and caps from kitchen.hangerAt; a hanger off the side panel drills nothing, like Bazis',()=>{
  const m=antresol();m.kitchen!.hangerAt={left:[-285,20,0],right:[-285,20,0]};
  const ps=parts(m),h=ps.find(p=>p.id==='kitchen-hanger:left')!,c=ps.find(p=>p.id==='kitchen-hanger-cap:right')!;
  assert.deepEqual(h.model!.origin,[16,685,20]);assert.deepEqual(c.model!.origin,[584,685,20]);
  assert.equal(holes(m,ps).filter(x=>x.src.startsWith('kitchen-hanger')).length,0,'no hanger holes outside the sides');
  const std=antresol(),sh=holes(std).filter(x=>x.src.startsWith('kitchen-hanger'));
  assert.equal(sh.length,4,'rule position: 2 × D3×3 per side');
  const k18=antresol();k18.kitchen!.hangerAt={left:[25,20,100],right:[25,20,100],caps:{left:[15,20,0],right:[15,20,0]}};
  const p2=parts(k18);
  assert.deepEqual(p2.find(p=>p.id==='kitchen-hanger:right')!.model!.origin,[484,375,20]);
  assert.deepEqual(p2.find(p=>p.id==='kitchen-hanger-cap:right')!.model!.origin,[584,385,20]);
  assert.deepEqual(partCollisions(p2,k18),[]);
  // сохранение проекта
  const back=parseModule(JSON.parse(JSON.stringify(k18)));
  assert.deepEqual(back.kitchen!.hangerAt,k18.kitchen!.hangerAt);
});

test('no fasteners in Bazis (k32): studio adds no confirmats, eccentrics or dowels',()=>{
  assert.equal(fastenersAbsent({key:'x',name:'x',archetype:'antresol',size:[600,690,560],panels:[],hardware:[],holes:[]}),true);
  assert.equal(fastenersAbsent({key:'x',name:'x',archetype:'antresol',size:[600,690,560],panels:[],hardware:[{i:0,name:'Конфирмат 7х50 мм, Zn',category:'конфирмат',pos:[0,8,63]}]}),false);
  const m=antresol();m.kitchen!.noFasteners=true;
  const ps=parts(m);
  assert.equal(ps.filter(p=>/^(fast|ecc|dowel):/.test(p.id)).length,0);
  assert.equal(antresol().kitchen!.noFasteners,undefined);
  assert.ok(parts(antresol()).some(p=>p.id.startsWith('fast:')),'default antresol keeps its confirmats');
  assert.equal(parseModule(JSON.parse(JSON.stringify(m))).kitchen!.noFasteners,true);
});

test('raised hanging body (bottom 14 above the module bottom): no plinth panel, facade down to the module bottom, no plinth-list error',()=>{
  const m=antresol();m.plinthHeight=14;
  const ps=parts(m);
  assert.ok(!ps.some(p=>p.id==='plinth'),'hanging cabinets have no plinth');
  assert.equal(facadeBottom(m),0);
  assert.ok(!validate(m).some(e=>/цоколя/.test(e)));
  const w=initialModule();w.plinthHeight=14;assert.ok(validate(w).some(e=>/цоколя/.test(e)),'wardrobe rule unchanged');
});

test('edge ends: top/bottom between sides edged at the ends only when Bazis edges them (k32)',()=>{
  const p=(edges:[string,number][]):RefPanel=>({i:0,name:'Дно',mat:'',thick:16,kind:'ldsp',box:[16,0,0,584,16,560],axis:'y',edges:edges.map(([side,thick])=>({side,thick}))} as unknown as RefPanel);
  assert.equal(endsEdged([p([['+z',1],['+x',1],['-z',1],['-x',1]])]),true);
  assert.equal(endsEdged([p([['+z',1],['-z',1]])]),false);
  const m=antresol();m.edgeScheme={t:1,ends:true};
  const top=parts(m).find(q=>q.id==='top')!;
  assert.deepEqual(top.edge.filter(x=>x>0).length,4,'all four ends edged');
});

// Сверка с эталонами Базиса (вне репозитория — на другой машине пропуск).
const ET='C:/Users/My PC/Desktop/Claude Project/Кухни/etalon/';
for(const [k,key] of [['k12','m05'],['k18','m14'],['k32','m16']] as const)
  test(`etalon ${k}/${key}: antresol recognized and matches Bazis`,{skip:!existsSync(ET+k+'.json')},()=>{
    const ref=(JSON.parse(readFileSync(ET+k+'.json','utf8')).modules as RefModule[]).find(m=>m.key===key)!;
    const {module:m}=moduleFromEtalon(ref);
    assert.deepEqual(validate(m),[]);
    assert.equal(compareModule(ref,m).pass,true);
  });
