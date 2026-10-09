// Целые кухни из Базиса, n4-kitchens3: отверстия-крепёж «3x3» в смете, кромка на ХДФ — только если она есть в Базисе, Firmax штуками,
// цены типов петель не подставляются от накладной, опоры-дубли Базиса (k16), клипса на цоколе ряда (k23).
// Проекты собираются из эталонов Базиса тем же кодом, что импорт (buildKitchen); эталоны вне репозитория — без них тесты пропускаются.
import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync,readFileSync} from 'node:fs';
import {type Part} from '../src/model';
import {newProject,type Project} from '../src/project';
import {estimate} from '../src/pricing';
import {allowedContact} from '../src/collisions';
import {bazisHoleName,bazisHoles,bazisNames} from '../src/rawModule';
import {buildKitchen} from '../scripts/kitchen/buildKitchen';

const ET='C:/Users/My PC/Desktop/Claude Project/Кухни/etalon';
const has=(k:string)=>existsSync(`${ET}/${k}.json`);
const kitchen=(k:string)=>buildKitchen(JSON.parse(readFileSync(`${ET}/${k}.json`,'utf8'))).project;
const lines=(p:Project,re:RegExp)=>estimate(p).lines.filter(l=>re.test(l.id));
const qty=(p:Project,re:RegExp)=>Math.round(lines(p,re).reduce((s,l)=>s+l.quantity,0)*1000)/1000;
// Отверстия Базиса — не по правилу имени bazisHoles, а по признакам эталона: элемент FurnList с позицией без модели, помеченный service
// (любое имя: «3x3», «Отверстие 3х2», «Отверстие глухое_d2x10 мм.»), и безымянный размер в «прочем» ряда (там флага service нет: k19 «8x30»)
type EtHw={name?:string;pos?:unknown;mesh?:string|null;service?:boolean;box?:unknown};
const etalonHoles=(k:string)=>{const e=JSON.parse(readFileSync(`${ET}/${k}.json`,'utf8'));
  const hw:EtHw[]=[...e.modules.flatMap((m:{hardware:EtHw[]})=>m.hardware),...['profiles','other'].flatMap(g=>((e.row?.[g]??[]) as EtHw[]).filter(x=>!Array.isArray(x.box)))];
  return hw.filter(h=>Array.isArray(h.pos)&&!h.mesh&&(h.service===true||/^\s*\d[\d\s.,xх×*]*$/i.test(h.name??''))).length;};

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
});

test('Firmax — штуками, как в Базисе: k30 L-350 7 шт (не 3,5 пары), строки без дробей',{skip:!has('k30')},()=>{
  const p=kitchen('k30'),fx=lines(p,/^firmax/);
  assert.ok(fx.every(l=>l.unit==='шт'&&Number.isInteger(l.quantity)),'штуки, целые');
  assert.equal(qty(p,/^firmax:.*L - 350$/),7);assert.equal(qty(p,/^firmax:.*L - 450$/),4);assert.equal(qty(p,/^firmax:.*L - 500$/),28);
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
  const pen=p.modules.find(a=>a.module.name==='Пенал1')!;
  assert.deepEqual(pen.module.bazisNames?.legsDup,{'Опора кухонная регулируемая, H100-120мм, чёрная':2});
  // одна опора в точке — дублей нет
  assert.equal(bazisNames([{name:'Опора',category:'опора',pos:[0,0,0]},{name:'Опора',category:'опора',pos:[100,0,0]}]).legsDup,undefined);
});

test('k23: клипса и опора у цоколя ряда — разрешённый контакт до 3 мм (как в Базисе: сетка опоры Ø58 в z 493 доходит до 522, цоколь — с 520)',()=>{
  const box=(id:string,name:string):Part=>({id,name,size:[10,10,10],position:[0,0,0],length:10,width:10,thickness:10,role:'body',material:'board',decor:'',grain:'length',grainAxis:0,edge:[0,0,0,0]} as Part);
  const clip:Part={...box('kitchen-clip:1','Клипса для ПВХ цоколя, чёрная'),material:'metal',role:'fastener'},leg:Part={...box('leg:1','Опора'),material:'metal',role:'fastener'};
  const plinth=box('raw:p3','Цоколь · Фронтальная'),side=box('raw:p4','Боковина');
  assert.ok(allowedContact(clip,plinth,2));assert.ok(allowedContact(leg,plinth,2));
  assert.ok(!allowedContact(clip,plinth,5),'глубже 3 мм — ошибка');
  assert.ok(!allowedContact(clip,side,2),'клипса — только на цоколе и опоре');
});

test('шкаф студии: смета без строк отверстий и с Firmax студии парами (правило 3)',()=>{
  const p=newProject();
  assert.ok(p.modules.length>0&&!estimate(p).lines.some(l=>/^(bazis:|hinge-bazis:)/.test(l.id)),'у шкафа студии нет строк Базиса');
});
