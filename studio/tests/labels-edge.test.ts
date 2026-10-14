// Бирки и деталировка (аудит 11.10.2026, A3): материал — как в смете (Lamarty / Плита, ЛХДФ без декора корпуса); кромка сырых
// деталей Базиса (raw.panels[].edges) — на торцах детали, сумма по биркам = кромке Базиса в смете (k04: было 35,1 м против 87,8 м).
import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync,readFileSync} from 'node:fs';
import {initialModule,section,id,parts,type Module,type Part} from '../src/model';
import {newProject,parseProject,type Project} from '../src/project';
import {estimate} from '../src/pricing';
import {labelData,labelMaterial,detailCSV,type LabelData} from '../src/exports';
import {rawEdgeSlots,rawParts,type RawSpec} from '../src/rawModule';
import {edgeLength} from '../src/edges';

const LP='public/local-projects';
const has=(f:string)=>existsSync(`${LP}/${f}.json`);
const load=(f:string)=>parseProject(JSON.parse(readFileSync(`${LP}/${f}.json`,'utf8')));
function rawModule(raw:RawSpec,w=600,h=720,d=560):Module{return {...initialModule(),name:'Сырой',width:w,height:h,depth:d,decor:'Белый',facadeDecor:'Белый',sections:[section()],doors:false,backType:'none',plinthHeight:0,raw};}
function project(...ms:Module[]):Project{const p=newProject({...initialModule(),sections:[section()]});p.modules=ms.map((m,i)=>({id:id(),x:i*1000,y:0,z:0,rotation:0,module:m}));return p;}
/** Сумма кромки по биркам, м: толщина > 0 — длина торца (edgeLens у фигурной детали, иначе сторона). */
function labelEdgeSum(ls:LabelData[]):number{let s=0;for(const d of ls)for(const k of ['W1','W2','L1','L2'] as const)if(d.edges[k]>0)s+=(d.edgeLens?d.edgeLens[k]:k.startsWith('W')?d.width:d.length)/1000;return Math.round(s*1000)/1000;}
const estimateEdge=(p:Project)=>Math.round(estimate(p).lines.filter(l=>/^edge/.test(l.id)).reduce((s,l)=>s+l.quantity,0)*1000)/1000;

test('материал бирки — как в смете: ЛДСП (Lamarty) по каталогу, иначе «Плита», ЛХДФ без декора корпуса',()=>{
  assert.equal(labelMaterial({material:'board',decor:'Дуб Вотан',thickness:16}),'ЛДСП Дуб Вотан 16 мм (Lamarty)');
  assert.equal(labelMaterial({material:'board',decor:'Ясень Бронхольм',thickness:18}),'Плита Ясень Бронхольм 18 мм');
  assert.equal(labelMaterial({material:'hdf',decor:'Дуб Вотан',thickness:3}),'ЛХДФ 3 мм');
  const ls=labelData(newProject());
  assert.ok(ls.some(l=>l.material.startsWith('ЛДСП ')&&l.material.endsWith('(Lamarty)')));
  assert.ok(ls.filter(l=>l.material.startsWith('ЛХДФ')).every(l=>l.material==='ЛХДФ 3 мм'));
});

test('rawEdgeSlots: отрезки Базиса по торцам — по кругу, две длинные стороны, фигурный контур с edgeLen',()=>{
  const part=():Pick<Part,'size'|'length'|'width'|'edge'|'edgeLen'>=>({size:[600,16,557],length:600,width:557,edge:[0,0,0,0]});
  const a=part();rawEdgeSlots(a,[[0.5,600],[0.5,557],[0.5,557],[0.5,600]]);
  assert.deepEqual(a.edge,[0.5,0.5,0.5,0.5]);assert.equal(a.edgeLen,undefined);
  const b=part();rawEdgeSlots(b,[[2,600],[0.5,600]]);
  assert.deepEqual(b.edge,[0,0,2,0.5]);
  const c=part();rawEdgeSlots(c,[[0.5,744]]);
  assert.deepEqual(c.edge,[0,0,0.5,0]);assert.deepEqual(c.edgeLen,{'+z':744}); // торец 2 — по ширине (+W), длина кромки — длина отрезка
  // фигурная полка k04 ВМ2: 568 + 185 + 183 + 160 + 200 + 160 — сумма по торцам равна сумме Базиса
  const f:Pick<Part,'size'|'length'|'width'|'edge'|'edgeLen'>={size:[568,16,310],length:568,width:310,edge:[0,0,0,0]};
  rawEdgeSlots(f,[[0.5,568],[0.5,185],[0.5,183],[0.5,160],[0.5,200],[0.5,160]]);
  const sum=[0,1,2,3].reduce((s,k)=>s+(f.edge[k]>0?edgeLength(f,k):0),0);
  assert.equal(sum,568+185+183+160+200+160);assert.ok(f.edge.every(e=>e===0.5));
});

test('сырой модуль кухни: кромка Базиса на торцах деталей, в бирках и CSV; ХДФ кухни — тоже; фасадный материал и столешница — нет',()=>{
  const raw:RawSpec={source:'bazis-kitchen',counts:{},hardware:[],panels:[
    {name:'Горизонтальная',kind:'ldsp',box:[0,100,0,600,116,557],edges:[[0.5,600],[0.5,557],[0.5,557],[0.5,600]]},
    {name:'Вертикальная',kind:'ldsp',box:[0,116,0,16,860,557],edges:[[0.5,744],[0.5,557],[0.5,744]]},
    {name:'Фасад',kind:'other',fm:true,box:[0,0,560,596,716,576],edges:[[1,596],[1,716],[1,596],[1,716]]},
    {name:'Столешница',kind:'ldsp',mat:'Столешница 38 мм',box:[0,860,0,600,898,600],edges:[[2,600]]},
    {name:'Задняя стенка',kind:'hdf',box:[0,0,-3,600,860,0],edges:[[1,600],[1,860]]}]};
  const m=rawModule(raw),ps=rawParts(m);
  assert.deepEqual(ps[0].edge,[0.5,0.5,0.5,0.5]);assert.deepEqual(ps[1].edge,[0.5,0,0.5,0.5]);
  assert.deepEqual(ps[2].edge,[0,0,0,0],'фасадный материал — кромка у поставщика');assert.deepEqual(ps[3].edge,[0,0,0,0],'столешница — изделие поставщика');
  assert.deepEqual(ps[4].edge,[1,0,1,0],'ХДФ кухни Базиса с кромкой — как в смете (600 — торец по ширине, 860 — по длине)');
  const p=project(m),ls=labelData(p);
  assert.equal(labelEdgeSum(ls),estimateEdge(p),'сумма кромки по биркам = смете');
  assert.equal(estimateEdge(p),Math.round((600+557+557+600+744+557+744+600+860)/1000*1000)/1000);
  const csv=detailCSV(p);assert.match(csv,/"0.5";"0.5";"0.5";"0.5"/);
  // сырой шкаф из корпуса Базиса: ХДФ без кромки в смете — и на бирке её нет; ЛДСП — есть
  const w=rawModule({source:'bazis-corpus',hardware:[],panels:[{name:'Полка',kind:'ldsp',box:[0,500,0,600,516,560],edges:[[0.5,600]]},{name:'Задняя стенка',kind:'hdf',box:[0,0,-3,600,860,0],edges:[[1,600]]}]});
  const wp=rawParts(w);assert.deepEqual(wp[0].edge,[0,0,0.5,0]);assert.deepEqual(wp[1].edge,[0,0,0,0]);
  assert.equal(labelEdgeSum(labelData(project(w))),estimateEdge(project(w)));
});

test('k04: Σ кромки по биркам = кромке в смете (87,808 м), сырых деталей без кромки при кромке Базиса нет',{skip:!has('kitchen-k04')},()=>{
  const p=load('kitchen-k04'),ls=labelData(p),est=estimateEdge(p);
  assert.ok(Math.abs(labelEdgeSum(ls)-est)<=0.01,`бирки ${labelEdgeSum(ls)} м против сметы ${est} м`);
  assert.ok(Math.abs(est-87.808)<=0.01,'кромка k04 в смете: '+est);
  for(const a of p.modules){const r=a.module.raw;if(!r)continue;const ps=parts(a.module);
    r.panels.forEach((q,i)=>{if(q.edges?.length&&!ps[i].external)assert.ok(ps[i].edge.some(e=>e>0),`${a.module.name}: ${q.name}`);});}
});

test('k25, k30: Σ кромки по биркам = смете ± 0,03 м (сырые и параметрические вместе; бирка — целые мм, у Базиса бывают 567,5)',{skip:!has('kitchen-k25')||!has('kitchen-k30')},()=>{
  for(const k of ['kitchen-k25','kitchen-k30']){const p=load(k),a=labelEdgeSum(labelData(p)),b=estimateEdge(p);assert.ok(Math.abs(a-b)<=0.03,`${k}: бирки ${a} м, смета ${b} м`);}
});
