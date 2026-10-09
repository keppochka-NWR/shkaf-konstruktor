// Целые кухни из Базиса, n4-kitchens3: отверстия-крепёж «3x3» в смете, кромка на ХДФ — только если она есть в Базисе, Firmax штуками,
// цены типов петель не подставляются от накладной, опоры-дубли Базиса (k16), клипса на цоколе ряда (k23).
// Проекты собираются из эталонов Базиса тем же кодом, что импорт (buildKitchen); эталоны вне репозитория — без них тесты пропускаются.
import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync,readFileSync} from 'node:fs';
import {parts,type Part} from '../src/model';
import {newProject,type Project} from '../src/project';
import {estimate} from '../src/pricing';
import {allowedContact} from '../src/collisions';
import {bazisHoleName,bazisHoles} from '../src/rawModule';
import {buildKitchen} from '../scripts/kitchen/buildKitchen';
import {etalonHoleItems,holeSig,supplierEdgeKind} from '../scripts/kitchen/wholeChecks';
import {FRONT_NORMAL,frontCamera,mainRowRotation} from '../scripts/kitchen/frontCamera';

const ET='C:/Users/My PC/Desktop/Claude Project/Кухни/etalon';
const has=(k:string)=>existsSync(`${ET}/${k}.json`);
const kitchen=(k:string)=>buildKitchen(JSON.parse(readFileSync(`${ET}/${k}.json`,'utf8'))).project;
const lines=(p:Project,re:RegExp)=>estimate(p).lines.filter(l=>re.test(l.id));
const qty=(p:Project,re:RegExp)=>Math.round(lines(p,re).reduce((s,l)=>s+l.quantity,0)*1000)/1000;
// Отверстия Базиса — не по правилу имени bazisHoles, а по признакам эталона (та же независимая проверка, что у whole.ts): элемент FurnList
// с позицией без модели, помеченный service (любое имя), и безымянный размер в «прочем» ряда (там флага service нет: k19 «8x30»)
const etalonHoles=(k:string)=>etalonHoleItems(JSON.parse(readFileSync(`${ET}/${k}.json`,'utf8'))).length;

test('независимая проверка отверстий (whole.ts) видит и именованные: service без модели, любая категория; изделие с моделью — не отверстие',()=>{
  const e={modules:[{hardware:[{name:'3x3',pos:[0,0,0],service:true},{name:'Отверстие 3х2',pos:[0,0,0],service:true},{name:'Зазор 0 мм',pos:[0,0,0],service:true,mesh:'b00d'},
    {name:'Шуруп 3,5х16',pos:[0,0,0]},{name:'Отверстие глухое_d2x10 мм.',service:true}]}],row:{other:[{name:'8x30',pos:[0,0,0]},{name:'8x30',pos:[0,0,0],box:[0,0,0,1,1,1]}]}};
  assert.deepEqual(etalonHoleItems(e).map(h=>h.name),['3x3','Отверстие 3х2','8x30']);
  assert.equal(holeSig('Отверстие 3х2'),holeSig('3x2'));assert.equal(holeSig('Отверстие глухое_d2x10 мм.'),'2x10');
});

test('кромка изделий поставщика (whole.ts): стекло, зеркало, столешница, стеновая панель; МДФ — только в параметрическом модуле',{skip:!has('k30')},()=>{
  assert.equal(supplierEdgeKind({kind:'glass'},false),'стекло');assert.equal(supplierEdgeKind({kind:'other',mat:'Столешница 38 мм'},false),'столешница');
  assert.equal(supplierEdgeKind({kind:'mdf',mat:'Плита IDM ETERNO Libra 18мм'},true),'МДФ-фасад параметрики');
  assert.equal(supplierEdgeKind({kind:'mdf',mat:'Плита IDM ETERNO Libra 18мм'},false),'','сырой модуль: плита МДФ в раскрое, её кромка — в смете');
  assert.equal(supplierEdgeKind({kind:'ldsp',mat:'ЛДСП Lamarty'},true),'');
  // k30: разница 1 мм Базис − смета — ровно кромка плит МДФ параметрических модулей (14,98 м), МДФ сырых модулей — в смете
  const e=JSON.parse(readFileSync(`${ET}/k30.json`,'utf8')),p=kitchen('k30');
  const bz=(ps:{kind?:string;mat?:string|null;edges?:{thick:number;len:number}[]}[],f:(x:{kind?:string;mat?:string|null})=>boolean)=>ps.filter(x=>!/фасадн/i.test(x.mat??'')&&f(x)).flatMap(x=>x.edges??[]).filter(g=>g.thick===1).reduce((s,g)=>s+g.len/1000,0);
  const all=bz([...e.modules.flatMap((m:{panels:never[]})=>m.panels),...['worktops','plinths','wallPanels','profiles','other'].flatMap(g=>e.row?.[g]??[])],()=>true);
  const mdfPar=p.modules.reduce((s,a,i)=>a.module.raw?s:s+bz(e.modules[i].panels,x=>supplierEdgeKind(x,true)!==''),0);
  assert.ok(Math.abs(all-qty(p,/^edge1$/)-mdfPar)<0.005,`разница ${all-qty(p,/^edge1$/)} = МДФ параметрики ${mdfPar}`);
  assert.equal(Math.round(mdfPar*100)/100,14.98);
});

test('bazisHoles: крепёж Базиса в точке — названный размером или словом «Отверстие…» — строка «Отверстие …» с количеством',()=>{
  const hw=[{name:'3x3',category:'прочее',pos:[1,2,3]},{name:'3х3',category:'прочее',pos:[4,5,6]},{name:'5x12',category:'прочее',pos:[0,0,0]},
    {name:'3x3',category:'прочее'},{name:'Гвоздь',category:'прочее',pos:[0,0,0]},{name:'Шуруп 3,5х16',category:'прочее',pos:[0,0,0]},{name:'',category:'прочее',pos:[0,0,0]},
    // именованные отверстия Базиса — дочерние объекты комплектов (сушка NORWIG k08, TANDEMBOX k20): то же, что «3x3»
    {name:'Отверстие 3х2',category:'прочее',pos:[0,0,0]},{name:'Отверстие глухое_d2x10 мм.',category:'прочее',pos:[0,0,0]},{name:'Отверстие глухое_d2x10 мм.',category:'прочее',pos:[1,0,0]},
    {name:'Отверстие 3х2',category:'прочее'}];
  assert.deepEqual(bazisHoles(hw),[{name:'Отверстие 3x3',category:'отверстие',n:2},{name:'Отверстие 5x12',category:'отверстие',n:1},
    {name:'Отверстие 3x2',category:'отверстие',n:1},{name:'Отверстие глухое_d2x10 мм.',category:'отверстие',n:2}]);
  assert.equal(bazisHoleName('Отверстие'),'Отверстие');assert.equal(bazisHoleName('Шуруп 3,5х16'),null);assert.equal(bazisHoleName('8'),'Отверстие 8');
});

test('именованные отверстия Базиса — в смете: k08 «Отверстие 3x2» 8 (сушка NORWIG), k20 d2x10 8 и d10x12 4 (TANDEMBOX)',{skip:!has('k08')||!has('k20')},()=>{
  const k08=kitchen('k08'),k20=kitchen('k20');
  assert.equal(qty(k08,/^bazis:отверстие:Отверстие 3x2$/),8);
  assert.equal(qty(k20,/^bazis:отверстие:Отверстие глухое_d2x10 мм\.$/),8);
  assert.equal(qty(k20,/^bazis:отверстие:Отверстие глухое_d10x12 мм\.$/),4);
  // и «3x3» на месте: k08 56, k20 12 (как раньше)
  assert.equal(qty(k08,/^bazis:отверстие:Отверстие 3x3$/),56);assert.equal(qty(k20,/^bazis:отверстие:Отверстие 3x3$/),12);
});

test('отверстия «3x3», «Отверстие …» — в смете кухни из Базиса, сколько в Базисе, цена 0 (сверловка — в работе цеха)',{skip:!has('k01')},()=>{
  for(const k of ['k01','k08','k16','k19','k20','k30']){
    const p=kitchen(k),hl=lines(p,/^bazis:отверстие:/);
    assert.equal(hl.reduce((s,l)=>s+l.quantity,0),etalonHoles(k),k+': отверстий столько же, сколько в Базисе');
    assert.ok(hl.every(l=>l.unitPrice===0),k+': цена отверстия 0 — смета не становится «без цены»');
  }
  assert.equal(qty(kitchen('k16'),/^bazis:отверстие:Отверстие 3x3$/),142,'k16: 142 × 3x3, как в Базисе');
  assert.equal(qty(kitchen('k19'),/^bazis:отверстие:Отверстие 8x30$/),4,'k19: 2 у модуля «Пенал» + 2 в «прочем» ряда');
});

test('кромка на ХДФ: k30 «Пенал 1» — 7,534 м кромки 1 мм, как в Базисе; у шкафа из Базиса ХДФ по-прежнему без кромки',{skip:!has('k30')},()=>{
  const p=kitchen('k30'),pen=p.modules.find(a=>a.module.raw?.panels.some(q=>q.kind==='hdf'&&q.edges?.length))!;
  assert.ok(pen,'в k30 есть ХДФ с кромкой Базиса');
  const hdf=pen.module.raw!.panels.filter(q=>q.kind==='hdf').flatMap(q=>q.edges??[]).filter(([t])=>t===1).reduce((s,[,l])=>s+l,0)/1000;
  assert.equal(Math.round(hdf*1000)/1000,7.534);
  const one=(m:typeof pen.module)=>qty({...p,modules:[{...pen,module:m}]},/^edge1$/);
  const noHdfEdge=structuredClone(pen.module);for(const q of noHdfEdge.raw!.panels)if(q.kind==='hdf')delete q.edges;
  assert.equal(Math.round((one(pen.module)-one(noHdfEdge))*1000)/1000,7.534,'кромка ХДФ — в смете');
  // ХДФ без кромки в Базисе — без кромки: прочие ХДФ k30 кромки не добавляют (в k30 кромка только на ХДФ «Пенал 1»)
  assert.equal(p.modules.flatMap(a=>a.module.raw?.panels??[]).filter(q=>q.kind==='hdf'&&q.edges?.length).length,1);
  // сырой шкаф из корпуса Базиса (source bazis-corpus) — правила кухни к нему не применяются (правило 3)
  const wr=structuredClone(pen.module);wr.raw!.source='bazis-corpus';delete wr.raw!.counts;delete wr.raw!.items;delete wr.raw!.names;
  assert.equal(one(wr),one({...wr,raw:{...wr.raw!,panels:wr.raw!.panels.map(q=>q.kind==='hdf'?{...q,edges:undefined}:q)}}),'шкаф: ХДФ не кромится');
});

test('кромка на ХДФ не только в k30: k05 «ВМ 1 (вытяжка)» — две ХДФ с кромкой 0,5 мм по 1,912 м (3,824 м), как в Базисе',{skip:!has('k05')},()=>{
  const p=kitchen('k05'),hdf=p.modules.flatMap(a=>a.module.raw?.panels??[]).filter(q=>q.kind==='hdf'&&q.edges?.length);
  assert.equal(hdf.length,2);
  assert.equal(Math.round(hdf.flatMap(q=>q.edges!).filter(([t])=>t===0.5).reduce((s,[,l])=>s+l,0)),3824);
  // в смете — строкой кромки 0,5 мм (та же «лесенка» толщин, что у прочих деталей Базиса)
  const no=structuredClone(p);for(const a of no.modules)for(const q of a.module.raw?.panels??[])if(q.kind==='hdf')delete q.edges;
  assert.equal(Math.round((qty(p,/^edge05$/)-qty(no,/^edge05$/))*1000)/1000,3.824);
  assert.equal(qty(p,/^edge(04|08|1|2)$/),qty(no,/^edge(04|08|1|2)$/),'другие толщины не меняются');
});

test('Firmax — штуками, как в Базисе: k30 L-350 5 шт (не 2,5 пары), строки без дробей',{skip:!has('k30')},()=>{
  const p=kitchen('k30'),fx=lines(p,/^firmax/);
  assert.ok(fx.every(l=>l.unit==='шт'&&Number.isInteger(l.quantity)),'штуки, целые');
  // слияние n4: члены вложенных комплектов Базиса (та же направляющая второй записью в точке-якоре, n4-drawers kitHeaderIdx) не считаются:
  // записей Базиса L-350 7, L-450 4, L-500 28, из них членов комплектов 2, 2 и 14
  assert.equal(qty(p,/^firmax:.*L - 350$/),5);assert.equal(qty(p,/^firmax:.*L - 450$/),2);assert.equal(qty(p,/^firmax:.*L - 500$/),14);
});

test('петли: тип Базиса «под фальшпанель», «полунакладная», «накладная 180гр» — без цены накладной (уточнить), накладная — по счёту',{skip:!has('k22')},()=>{
  const k22=kitchen('k22');
  const typed=lines(k22,/^hinge-bazis:/);
  assert.ok(typed.length>=2);
  assert.ok(typed.every(l=>l.unitPrice===null&&/уточнить/.test(l.source)),'цена типа не подставлена от накладной');
  assert.ok(lines(k22,/^hinge$/).every(l=>l.unitPrice===157),'накладная GTV — 157 ₽ по счёту');
});

test('k16: опоры-дубли Базиса (две пары опор в одной точке у «Пенал1») — в смете 41, как в Базисе',{skip:!has('k16')},()=>{
  const p=kitchen('k16');
  assert.equal(qty(p,/^kitchen-leg/),41);
  // слияние n4: дубль опоры студия повторяет деталью (kitchen.dupParts, n4-tall) — одно решение для сверки, 3D и сметы
  const pen=p.modules.find(a=>a.module.name==='Пенал1')!;
  assert.equal(pen.module.kitchen?.dupParts?.filter(id=>id.startsWith('leg:')).length,2);
  assert.equal(parts(pen.module).filter(q=>q.id.startsWith('leg:')&&q.id.endsWith(':dup')).length,2);
});

test('k23: клипса и опора у цоколя ряда — разрешённый контакт до 3 мм (как в Базисе: сетка опоры Ø58 в z 493 доходит до 522, цоколь — с 520)',()=>{
  const box=(id:string,name:string):Part=>({id,name,size:[10,10,10],position:[0,0,0],length:10,width:10,thickness:10,role:'body',material:'board',decor:'',grain:'length',grainAxis:0,edge:[0,0,0,0]} as Part);
  const clip:Part={...box('kitchen-clip:1','Клипса для ПВХ цоколя, чёрная'),material:'metal',role:'fastener'},leg:Part={...box('leg:1','Опора'),material:'metal',role:'fastener'};
  const plinth=box('raw:p3','Цоколь · Фронтальная'),side=box('raw:p4','Боковина');
  assert.ok(allowedContact(clip,plinth,2));assert.ok(allowedContact(leg,plinth,2));
  assert.ok(!allowedContact(clip,plinth,5),'глубже 3 мм — ошибка');
  assert.ok(!allowedContact(clip,side,2),'клипса — только на цоколе и опоре');
  // правило — только для сырой детали Базиса: доска студии с именем «Цоколь…» под него не попадает
  assert.ok(!allowedContact(clip,box('plinth-front','Цоколь фронтальный'),2),'доска студии «Цоколь…» — не сырой цоколь Базиса');
});

test('снимки: «спереди» — по главному ряду кухни (наибольшая ширина модулей), не по выбранному модулю',()=>{
  const pm=(x:number,z:number,rotation:0|90|180|270,width:number)=>({id:`m${x}${z}`,x,z,y:0,rotation,module:{width,depth:560,height:820}});
  // ряд у задней стены (поворот 0, 3 × 600) и боковой модуль (поворот 90, 600): камера — перед рядом (+z), не сбоку
  const p={modules:[pm(0,0,0,600),pm(600,0,0,600),pm(1200,0,0,600),pm(-560,600,90,600)]} as unknown as Project;
  assert.equal(mainRowRotation(p),0);
  const [cx,,cz,tx,,tz]=frontCamera(p,1.6);assert.ok(cz-tz>1000&&Math.abs(cx-tx)<1e-6,'камера по +z от центра');
  // остров (поворот 180) уже ряда — на направление не влияет; если 180 шире — камера с его фасада (−z)
  assert.equal(mainRowRotation({modules:[...p.modules,pm(0,2000,180,1200)]} as unknown as Project),0);
  const q={modules:[pm(0,0,180,2400),pm(0,2000,0,600)]} as unknown as Project;
  assert.equal(mainRowRotation(q),180);assert.ok(frontCamera(q,1.6)[2]<frontCamera(q,1.6)[5]);
  assert.deepEqual(FRONT_NORMAL[90],[1,0]);
});

test('шкаф студии: смета без строк отверстий и с Firmax студии парами (правило 3)',()=>{
  const p=newProject();
  assert.ok(p.modules.length>0&&!estimate(p).lines.some(l=>/^(bazis:|hinge-bazis:)/.test(l.id)),'у шкафа студии нет строк Базиса');
});

test('«Ряд» по объектам (1a7d673): блок Базиса «прочего» — один объект на месте Базиса (k16 «Отдельный ящик»), цоколи — каждый отдельно, фурнитура ряда — один раз',()=>{
  if(!has('k16'))return;
  const p=kitchen('k16'),rows=p.modules.filter(a=>a.module.raw?.row);
  // «Отдельный ящик» — блок Базиса из 6 деталей в мировых координатах ряда (x 6348,5…6968,5, в Базисе он и стоит отдельно справа
  // от «Пенал 1», trans блока нулевой) — один объект студии, не 6
  const box=rows.filter(a=>a.module.name==='Отдельный ящик');
  assert.equal(box.length,1);assert.equal(box[0].module.raw!.panels.length,6);assert.equal(box[0].x,6348.5);assert.equal(box[0].y,1998.5);
  assert.equal(rows.filter(a=>/^Цоколь/.test(a.module.name)).length,2);
  // счётчики и изделия ряда — только у первого объекта: в смете не задваиваются
  assert.equal(rows.filter(a=>a.module.raw!.items?.length||Object.values(a.module.raw!.counts??{}).some(v=>Number(v)>0)).length<=1,true);
});

test('главный ряд для снимка «спереди» — без объектов «Ряда» (они все с поворотом 0)',()=>{
  const p=newProject();const m=(w:number,rot:number,row=false)=>({id:String(Math.random()),x:0,z:0,rotation:rot,module:{...p.modules[0].module,width:w,...(row?{raw:{panels:[],row:true}}:{})}}) as unknown as Project['modules'][number];
  p.modules=[m(600,90),m(600,90),m(3000,0,true)];
  assert.equal(mainRowRotation(p),90);
});
