// Смета (аудит 11.10.2026, направление A3): группы строк, цены из справочника (шкант, Versalite, крепёж Базиса), честность сырых
// модулей (строка без цены вместо цены одних листов), один ключ конфирмата, одно округление, заглушка навеса одной строкой.
// Проекты local-projects вне git — без папки эти проверки пропускаются (номера проектов, без названий папок клиентов).
import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync,readFileSync} from 'node:fs';
import {initialModule,section,id,type Module} from '../src/model';
import {newProject,parseProject,type Project} from '../src/project';
import {estimate,estimateCSV,lineGroup,purchasedOnTop,guideKitPrice,bazisPriced,engineNote,DOWEL,type PriceLine} from '../src/pricing';
import {axisSpecs} from '../src/guideKits';
import {kitchenProject} from '../src/kitchenProject';
import type {RawSpec} from '../src/rawModule';

const LP='public/local-projects';
const has=(f:string)=>existsSync(`${LP}/${f}.json`);
const load=(f:string)=>parseProject(JSON.parse(readFileSync(`${LP}/${f}.json`,'utf8')));
function rawModule(raw:RawSpec,w=600,h=720,d=560):Module{return {...initialModule(),name:'Сырой',width:w,height:h,depth:d,decor:'Белый',facadeDecor:'Белый',sections:[section()],doors:false,backType:'none',plinthHeight:0,raw};}
function project(...ms:Module[]):Project{const p=newProject({...initialModule(),sections:[section()]});p.modules=ms.map((m,i)=>({id:id(),x:i*1000,y:0,z:0,rotation:0,module:m}));return p;}
const q=(p:Project,id:string)=>estimate(p).lines.find(l=>l.id===id);
const panel=(name:string,box:[number,number,number,number,number,number],extra:Record<string,unknown>={})=>({name,kind:'ldsp',box,...extra});

test('группы: покупные материалы и детали вне листа — «Материалы», не «Фурнитура»',()=>{
  for(const id of ['facade-external','plinth-external','worktop:raw:38','worktop:postforming:38','wallpanel:raw:6','unplaced-raw:m1:0','unplaced:1.2','mat:Пластик'])assert.equal(lineGroup(id),'material',id);
  for(const id of ['hinge','kitchen-leg','axis-pro:raw','bazis:сушка:x','dowel','screw4x30','flange25'])assert.equal(lineGroup(id),'hardware',id);
});

test('purchasedOnTop: закупка покупных материалов × коэффициент, к сотне; не вызывается из estimate (ярус B)',()=>{
  const lines:PriceLine[]=[{id:'facade-external',label:'',quantity:2,unit:'м²',unitPrice:5000,source:''},{id:'worktop:raw:38',label:'',quantity:1.5,unit:'пог.м',unitPrice:3000,source:''},{id:'sheet:Белый',label:'',quantity:3,unit:'лист',unitPrice:2150,source:''},{id:'hinge',label:'',quantity:4,unit:'шт',unitPrice:157,source:''}];
  assert.equal(purchasedOnTop(lines,1.6),Math.round((10000+4500)*1.6/100)*100);
  assert.equal(purchasedOnTop([],1.6),0);
  const e=estimate(newProject());assert.ok(!('purchased' in e),'в итоге сметы покупных сверху пока нет');
});

test('Versalite H45: цена ФАМ при точной длине 350–500, 550 и прочие направляющие — без цены',()=>{
  assert.equal(guideKitPrice('versalite-h45:500').price,695);assert.equal(guideKitPrice('versalite-h45:450').price,650);
  assert.equal(guideKitPrice('versalite-h45:350').price,550);assert.match(guideKitPrice('versalite-h45:400').source,/ФАМ/);
  assert.equal(guideKitPrice('versalite-h45:550').price,null);assert.match(guideKitPrice('versalite-h45:550').source,/уточнить/);
  assert.equal(guideKitPrice('versalite-h45:300').price,null,'300 — вне диапазона кухонь');
  assert.equal(guideKitPrice('guides:Направляющие шариковые PK-L-H45, 400').price,600);
  assert.equal(guideKitPrice('guides:Направляющие Quadro V6, 500').price,null);
  assert.equal(guideKitPrice('firmax:Firmax L - 500').price,null);
});

test('крепёж Базиса с ценой цеха: шуруп 3,5×16, саморез 4×30, фланец D25, труба D25 (по длине) — строки Базиса с ценой; остальное — без цены',()=>{
  assert.equal(bazisPriced('Шуруп 3,5х16')?.price,0.3);assert.equal(bazisPriced('Саморез 4х30')?.price,0.45);assert.equal(bazisPriced('Саморез 4x30')?.price,0.45);
  assert.equal(bazisPriced('Фланец д25')?.price,40);assert.equal(bazisPriced('Фланец Д25')?.price,40);
  assert.equal(bazisPriced('Труба Д25',1500)?.price,300);
  assert.equal(bazisPriced('Труба Д25'),null,'труба без длины — как в Базисе, без цены');
  assert.equal(bazisPriced('Гвоздь'),null);assert.equal(bazisPriced('Шуруп 4х40'),null);
  // в смете сырого модуля кухни: те же строки Базиса (id bazis:…, количество как в Базисе), но с ценой; «Гвоздь» — без цены
  const m=rawModule({source:'bazis-kitchen',counts:{},panels:[panel('Горизонтальная',[0,0,0,600,16,560])],hardware:[],items:[{name:'Шуруп 3,5х16',category:'прочее',n:12},{name:'Фланец д25',category:'штангодержатель',n:2},{name:'Труба Д25',category:'прочее',n:1,len:1500},{name:'Гвоздь',category:'прочее',n:40}]});
  const p=project(m),e=estimate(p);
  assert.equal(q(p,'bazis:прочее:Шуруп 3,5х16')?.quantity,12);assert.equal(q(p,'bazis:прочее:Шуруп 3,5х16')?.unitPrice,0.3);
  assert.equal(q(p,'bazis:штангодержатель:Фланец д25')?.quantity,2);assert.equal(q(p,'bazis:штангодержатель:Фланец д25')?.unitPrice,40);
  assert.equal(q(p,'bazis:прочее:Труба Д25:m')?.quantity,1.5);assert.equal(q(p,'bazis:прочее:Труба Д25:m')?.unitPrice,300);
  assert.equal(q(p,'bazis:прочее:Гвоздь')?.unitPrice,null);
  assert.ok(!e.lines.some(l=>/^(screw35x16-rod|flange25|rod25)$/.test(l.id)),'строки цеха для шкафов не появляются в кухне Базиса (сверщики bazis-only/whole)');
});

test('шкант 8×30 — 0,7 ₽ (ФАМ) в сыром и параметрическом модуле кухни',()=>{
  const raw=project(rawModule({source:'bazis-kitchen',counts:{dowels:6},panels:[panel('Горизонтальная',[0,0,0,600,16,560])],hardware:[]}));
  assert.deepEqual([q(raw,'dowel')?.quantity,q(raw,'dowel')?.unitPrice,q(raw,'dowel')?.source],[6,DOWEL.price,DOWEL.source]);
  const own=estimate(kitchenProject()),d=own.lines.find(l=>l.id==='dowel');
  if(d)assert.equal(d.unitPrice,0.7);
});

test('заглушка навеса — одна строка kitchen-hanger-cap: параметрика + «… ABS правая/левая» Базиса',()=>{
  const p=project(rawModule({source:'bazis-kitchen',counts:{hangers:2},panels:[panel('Вертикальная',[0,0,0,16,720,300])],hardware:[],items:[{name:'Заглушка для мебельного навеса ABS правая',category:'заглушка',n:1},{name:'Заглушка для мебельного навеса ABS левая',category:'заглушка',n:1}]}));
  const e=estimate(p);
  assert.equal(q(p,'kitchen-hanger-cap')?.quantity,2);assert.ok(!e.lines.some(l=>l.id.startsWith('bazis:заглушка:')));
  // 2 навеса Базиса = 1 комплект ABS (левый + правый с заглушками) 120 ₽; заглушки — в комплекте, цена 0 (Макс 27.10.2026)
  assert.equal(q(p,'kitchen-hanger')?.quantity,1);assert.equal(q(p,'kitchen-hanger')?.unit,'компл');assert.equal(q(p,'kitchen-hanger-cap')?.unitPrice,0);
  // нечётное число навесов модуля — остаток тоже комплектом
  assert.equal(q(project(rawModule({source:'bazis-kitchen',counts:{hangers:3},panels:[panel('Вертикальная',[0,0,0,16,720,300])],hardware:[]})),'kitchen-hanger')?.quantity,2);
});

test('сырой шкаф из корпуса Базиса без счётчиков: строка «Фурнитура Базиса не импортирована» без цены → «по коэффициенту» нет',()=>{
  const corpus=project(rawModule({source:'bazis-corpus',panels:[panel('Боковина',[0,0,0,16,2000,560]),panel('Полка',[16,500,0,584,516,560])],hardware:[{name:'Петля накладная',category:'петля',pos:[0,0,0],quat:[1,0,0,0]}]}));
  const e=estimate(corpus),l=e.lines.find(l=>l.id==='bazis-hardware:raw')!;
  assert.ok(l&&l.unitPrice===null);assert.match(l.label,/не импортирована/);
  assert.equal(e.byMarkup,null);assert.equal(e.retail,null);assert.ok(e.byMarkupKnown>0);
  // со счётчиками (кухня Базиса) строки нет
  const kitchen=project(rawModule({source:'bazis-kitchen',counts:{hinges:2},panels:[panel('Боковина',[0,0,0,16,720,560])],hardware:[]}));
  assert.ok(!estimate(kitchen).lines.some(l=>l.id==='bazis-hardware:raw'));
  // шкаф студии — без изменений
  assert.ok(!estimate(newProject()).lines.some(l=>l.id==='bazis-hardware:raw'));
});

test('wardrobe-012: «по коэффициенту» — честно нет, с объяснением (было 51 500 из трёх строк; с 20.10 работа цеха 3500 ₽/лист — 62 500)',{skip:!has('wardrobe-012')},()=>{
  const e=estimate(load('wardrobe-012'));
  assert.equal(e.byMarkup,null);assert.ok(e.lines.some(l=>l.id==='bazis-hardware:raw'&&l.unitPrice===null));
  assert.ok(e.byMarkupKnown>=62500-100&&e.byMarkupKnown<=62500+100,'нижняя оценка — цена листов и работы: '+e.byMarkupKnown);
});

test('деталь больше листа у сырого модуля: смета не завершена (retail=null), строка в «Материалах»',()=>{
  const p=project(rawModule({source:'bazis-kitchen',counts:{},panels:[panel('Фронтальная',[0,0,10,3000,2565,26]),panel('Полка',[0,500,30,800,516,530])],hardware:[]},3000,2600,600));
  const e=estimate(p),u=e.lines.filter(l=>l.id.startsWith('unplaced-raw:'));
  assert.equal(u.length,1);assert.equal(lineGroup(u[0].id),'material');
  assert.equal(e.unplaced,1);assert.equal(e.retail,null);
  const csv=estimateCSV(p,e);assert.match(csv,/Смета не завершена/);
  // обычный проект — завершён
  const ok=estimate(newProject());assert.equal(ok.unplaced,0);assert.ok(ok.retail!==null);
});

test('конфирмат с именем Базиса — один ключ confirmat:<имя> и для confirmatName, и для screw euro-6x50',()=>{
  const base=kitchenProject().modules.filter(a=>a.module.kitchen?.role==='base');
  assert.ok(base.length>=2);
  const p=kitchenProject();
  const a=p.modules.find(a=>a.module.kitchen?.role==='base')!,b=p.modules.filter(a=>a.module.kitchen?.role==='base')[1];
  a.module={...a.module,kitchen:{...a.module.kitchen!,confirmatName:'Евровинт 6х50'}};
  b.module={...b.module,kitchen:{...b.module.kitchen!,screw:'euro-6x50'}};
  const e=estimate(p),ids=e.lines.map(l=>l.id);
  assert.ok(ids.includes('confirmat:Евровинт 6х50'));assert.ok(!ids.includes('confirmat-euro-6x50'));
  assert.equal(ids.filter(i=>i.startsWith('confirmat:')).length,1,'один артикул — одна строка');
});

test('округление до 100 ₽ один раз по итогу: части — до рубля, фурнитура 44 ₽ не обнуляется',()=>{
  const e=estimate(newProject());
  assert.equal((e.byMarkup!-e.retailExtras)%100,0);
  assert.ok(Math.abs(e.byMarkup!-(e.split.material+e.split.hardware))<100);
  assert.equal(e.byMarkup!-e.retailExtras,Math.round((e.split.materialCost+e.split.hardwareCost)*e.markup/100)*100);
  // кухня студии: маленькая фурнитура (шурупы, шканты) даёт ненулевую часть «фурнитура»
  const k=estimate(kitchenProject());
  assert.ok(k.split.hardwareCost>0&&k.split.hardware>0,'фурнитура не обнуляется округлением');
  // + розница фурнитуры поверх коэффициента (навесы ABS комплектами по 120 ₽, Макс 27.10.2026)
  const retailHw=Math.round(k.lines.filter(l=>l.retail&&lineGroup(l.id)==='hardware').reduce((s,l)=>s+l.quantity*(l.unitPrice??0),0));
  assert.ok(retailHw>0);assert.equal(k.split.hardware,Math.round(k.split.hardwareCost*k.markup)+retailHw);
  // решение 16.10.2026: позиции кухни без счёта — «после финального расчёта конструктором», итог — по известным позициям
  assert.equal(k.missing.length,0);assert.ok(k.pending.length>0);assert.equal(k.byMarkup,k.byMarkupKnown);assert.equal(k.byMarkupKnown%100,0);assert.ok(k.byMarkupKnown>0);
  assert.match(estimateCSV(kitchenProject(),k),/Позиции после финального расчёта конструктором: \d+/);
});

test('строка-сведение «движок раскроя» в итоге сметы и CSV',()=>{
  const p=newProject(),e=estimate(p);
  assert.equal(e.engine,'classic');assert.equal(engineNote(e),'Движок раскроя: classic');
  const g={...p,calculation:{markup:2.2,overrides:{},cuttingEngine:'guillotine' as const}},eg=estimate(g);
  assert.equal(eg.engine,'guillotine');assert.match(engineNote(eg),/guillotine/);
  assert.match(estimateCSV(g,eg),/Движок раскроя: guillotine/);
});

test('ящики Axis PRO сырого модуля: высота и длина из записей Базиса → строка параметрического ящика',()=>{
  const hw=(name:string,category:string)=>({name,category,pos:[0,0,0] as [number,number,number],quat:[1,0,0,0] as [number,number,number,number]});
  const h=[hw('Axis PRO Направляющая, 300','направляющая'),hw('Axis PRO Направляющая, 300','направляющая'),hw('Axis PRO Царга H-120 Белый, 300','ящик-система'),hw('Axis PRO Царга H-120 Белый, 300','ящик-система'),hw('Axis PRO Держ. фасада AB','ящик-система'),hw('Axis PRO Держ. фасада AB','ящик-система')];
  assert.deepEqual(axisSpecs(h),[{h:120,len:300,color:'white',n:2}]);
  assert.deepEqual(axisSpecs([hw('Axis PRO Направляющая, 500','направляющая')]),[{h:null,len:500,color:'white',n:1}]);
  assert.deepEqual(axisSpecs([hw('Петля накладная','петля')]),[]);
  const p=project(rawModule({source:'bazis-kitchen',counts:{drawers:1},panels:[panel('Дно ящика',[50,100,50,550,116,350]),panel('Задняя панель ящика',[50,116,340,550,200,356])],hardware:h}));
  const e=estimate(p);
  assert.equal(q(p,'axis-pro:120:300:white')?.quantity,1);assert.ok(!e.lines.some(l=>l.id==='axis-pro:raw'));
  // без записей царг и направляющих — прежняя строка «по проекту Базиса»
  const p0=project(rawModule({source:'bazis-kitchen',counts:{drawers:1},panels:[panel('Дно ящика',[50,100,50,550,116,350])],hardware:[hw('Axis PRO Держ. фасада AB','ящик-система'),hw('Axis PRO Держ. фасада AB','ящик-система')]}));
  assert.equal(q(p0,'axis-pro:raw')?.quantity,1);
});

test('k25 построчно: конфирматы 175, опоры 46, клипсы 23, навесы 14 (7 комплектов), заглушки 14, шканты 30 по 0,7; Axis PRO 3 × 300 + 4 × 500',{skip:!has('kitchen-k25')},()=>{
  const p=load('kitchen-k25'),e=estimate(p);
  const qty=(id:string)=>e.lines.filter(l=>l.id===id).reduce((s,l)=>s+l.quantity,0);
  assert.equal(qty('confirmat-7x50'),175);assert.equal(qty('kitchen-leg'),46);assert.equal(qty('kitchen-clip'),23);
  assert.equal(qty('kitchen-hanger'),7);assert.equal(qty('kitchen-hanger-cap'),14);assert.ok(!e.lines.some(l=>l.id.startsWith('bazis:заглушка:')));
  assert.equal(qty('dowel'),30);assert.equal(q(p,'dowel')?.unitPrice,0.7);
  const axis=e.lines.filter(l=>/^axis-pro:(\d+|raw):/.test(l.id)&&!l.id.startsWith('axis-pro:inner'));
  const byLen=(L:number)=>axis.filter(l=>l.id.split(':').includes(String(L))).reduce((s,l)=>s+l.quantity,0);
  assert.equal(byLen(300),3);assert.equal(byLen(500),4);assert.ok(!e.lines.some(l=>l.id==='axis-pro:raw'));
  assert.ok(e.lines.filter(l=>!l.retail&&['facade-external','plinth-external'].includes(l.id)||l.id.startsWith('worktop:')).every(l=>lineGroup(l.id)==='material'));
  assert.equal(e.byMarkup,null);assert.ok(e.byMarkupKnown>0);
});
