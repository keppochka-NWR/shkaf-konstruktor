// Целая кухня из Базиса (критик целых кухонь р.2, BLOCKING 1–6): студия не добавляет того, чего нет в Базисе, и не теряет то, что в нём есть.
// Проекты собираются из эталонов Базиса тем же кодом, что импорт (buildKitchen); эталоны вне репозитория — без них тесты пропускаются.
import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync,readFileSync} from 'node:fs';
import {parts,parseModule,initialModule,section,type Module} from '../src/model';
import {applyAutoFillers,projectErrors,parseProject,isBazisModule,newProject,type Project} from '../src/project';
import {estimate} from '../src/pricing';
import {nest} from '../src/exports';
import {kitchenProject} from '../src/kitchenProject';
import {bazisItems,bazisNames} from '../src/rawModule';
import {buildKitchen,bazisDecor} from '../scripts/kitchen/buildKitchen';

const ET='C:/Users/My PC/Desktop/Claude Project/Кухни/etalon';
const has=(k:string)=>existsSync(`${ET}/${k}.json`);
const kitchen=(k:string)=>buildKitchen(JSON.parse(readFileSync(`${ET}/${k}.json`,'utf8'))).project;
const skip=!has('k06');
const line=(p:Project,re:RegExp)=>estimate(p).lines.filter(l=>re.test(l.id));
const qty=(p:Project,re:RegExp)=>Math.round(line(p,re).reduce((s,l)=>s+l.quantity,0)*1000)/1000;

test('B1: первая правка не двигает кухню из Базиса и не ставит фальши шкафов (k01, k02, k06, k07, k22, k30)',{skip},()=>{
  for(const k of ['k01','k02','k06','k07','k22','k30']){
    const p=kitchen(k),n=applyAutoFillers(p);
    assert.deepEqual(n,p,k+': applyAutoFillers не меняет ни одного объекта');
    assert.deepEqual(projectErrors(n),[],k+': правка применяется');
    // файлы, импортированные до признака bazis: кухонные модули в проекте с сырыми модулями Базиса — тоже из Базиса
    const old=structuredClone(p);for(const a of old.modules)delete a.module.bazis;
    assert.deepEqual(applyAutoFillers(old),old,k+': старый файл без признака');
    assert.ok(p.modules.every(a=>isBazisModule(p,a)),k+': все объекты — из Базиса');
  }
  // модуль из палитры, добавленный в кухню из Базиса (файл с признаком), — свой: правила студии к нему применяются
  const p=kitchen('k06'),own=kitchenProject().modules.find(a=>a.module.kitchen?.role==='base')!;
  assert.ok(!isBazisModule({modules:[...p.modules,own]},own));
});

test('B1: кухня из палитры студии (не Базис) по-прежнему получает фальшь к стене',()=>{
  const p=kitchenProject();
  assert.ok(!p.modules.some(a=>isBazisModule(p,a)),'палитра — не Базис');
  assert.ok(applyAutoFillers(p).modules.some(a=>a.module.wallFiller),'правило шкафов для своей кухни студии не изменилось');
});

test('B2: разбор файла проекта не теряет Gola и признаки Базиса (k06, k27, k30)',{skip},()=>{
  for(const k of ['k06','k27','k30']){
    const p=kitchen(k),back=parseProject(JSON.parse(JSON.stringify(p)));
    p.modules.forEach((a,i)=>{
      const b=back.modules[i].module;
      assert.deepEqual(Object.keys(a.module).filter(f=>!(f in b)),[],`${k} ${a.module.name}: поля после разбора`);
      const key=(m:Module)=>JSON.stringify(parts(m).map(q=>[q.id,q.size,q.position]));
      assert.equal(key(b),key(a.module),`${k} ${a.module.name}: детали после разбора`);
    });
  }
  // k30 НМ1: фасады под Gola — верх 850 по Базису, а не 878,5
  const nm1=kitchen('k30').modules.find(a=>a.module.gola&&a.module.name==='НМ1');
  if(nm1){const b=parseModule(JSON.parse(JSON.stringify(nm1.module)));assert.deepEqual(b.gola,nm1.module.gola);
    const top=(m:Module)=>Math.max(...parts(m).filter(q=>q.role==='door').map(q=>q.position[1]+q.size[1]/2));assert.equal(top(b),top(nm1.module));}
  const m:Module={...initialModule(),sections:[section()],gola:{cuts:[{top0:0,top1:60,depth:26,r:5,edged:true}],faceTop:28.5}};
  assert.deepEqual(parseModule(JSON.parse(JSON.stringify(m))).gola,m.gola);
});

test('B3: смета кухни из Базиса без мелочёвки, заглушек под конфирмат и вырезов по названиям модулей',{skip},()=>{
  for(const k of ['k05','k06','k14','k16','k22','k30']){
    if(!has(k))continue;const ids=estimate(kitchen(k)).lines.map(l=>l.id);
    assert.ok(!ids.includes('kit'),k+': мелочёвка корпуса');assert.ok(!ids.includes('confirmat-cap'),k+': заглушки под конфирмат');
    assert.ok(!ids.some(i=>i.startsWith('worktop-cut')),k+': вырезы под мойку/варку');
  }
  // Слияние n3 (правило Макса: правила Базиса — для кухонь m.kitchen, шкафы студии не меняются; n3-additions): своя кухня студии
  // (палитра) — тоже без «мелочёвки» и заглушек; у шкафа студии нормативы цеха остаются
  const own=estimate(kitchenProject()).lines.map(l=>l.id);assert.ok(!own.includes('kit')&&!own.includes('confirmat-cap'));
  const ward=estimate(newProject()).lines.map(l=>l.id);assert.ok(ward.includes('kit')&&ward.includes('confirmat-cap'));
});

test('B4: фурнитура Базиса у сырых модулей и в ряду — в смете (Firmax, Indigo, РАФИКС, сушка, штанга, профили)',{skip},()=>{
  const k22=kitchen('k22'),k30=kitchen('k30'),k16=kitchen('k16'),k06=kitchen('k06');
  assert.equal(qty(k22,/^firmax/),7,'k22: Firmax 14 шт = 7 пар');
  assert.equal(qty(k30,/^firmax/),19.5,'k30: Firmax 39 шт');
  // слияние n3: ящики Indigo, которые строит параметрика (n3-runners: k16 m04/m05), — комплект на ящик (2 направляющие, 2 царги)
  assert.equal(qty(k16,/^bazis:направляющая:Направляющая Indigo/)+2*qty(k16,/^indigo:/),14,'k16: Indigo 14 направляющих');
  assert.equal(qty(k16,/^bazis:ящик-система:Царга Indigo/)+2*qty(k16,/^indigo:/),14,'k16: 14 царг Indigo');
  assert.equal(qty(k16,/РАФИКС/),54);assert.equal(qty(k30,/РАФИКС/),40);
  assert.equal(qty(k06,/Сушка двухуровневая/),1);
  assert.equal(qty(k30,/^bazis:прочее:Фланец/),4);assert.ok(qty(k30,/^bazis:прочее:Труба Д25/)>1.5);
  assert.equal(qty(k30,/фасадный профиль узкий/),1);
  assert.ok(qty(k30,/KB 91 MODUS/)>0&&qty(k30,/KB 92 MODUS/)>0,'k30: профили ряда KB 91/92');
  assert.equal(qty(k06,/GOLA L-образный/),1.662,'k06: GOLA L ряда — длины Базиса');
  assert.equal(qty(k06,/Крепление для профиля Тип 3/),5);
  assert.ok(qty(k06,/Профиль врезной для верхних баз/)>0,'k06: «Профиль1» навесных');
  assert.equal(line(k06,/^gola-/).length,0,'Gola считается один раз — по ряду Базиса');
  // направляющие — штуками (length Базиса у них не погонаж); фурнитура объектов ряда без габарита (k07 «Пенал на столешку») — в смете
  if(has('k02')){const k02=kitchen('k02');assert.equal(qty(k02,/^bazis:направляющая:/),24);assert.ok(line(k02,/^bazis:направляющая:/).every(l=>l.unit==='шт'));}
  if(has('k07')){const row=kitchen('k07').modules.find(a=>a.module.raw?.row)!.module.raw!;assert.equal(row.counts?.hinges,3);assert.ok(row.items?.some(i=>/РАФИКС/.test(i.name)&&i.n===4));}
  // служебные объекты Базиса (отверстия «35x13», «3x3» — диаметр×глубина, тела, зазоры) — не фурнитура
  assert.deepEqual(bazisItems([{name:'3x3',category:'прочее'},{name:'Отверстие 3х2',category:'прочее'},{name:'Тело по траектории',category:'сушка'},{name:'Профиль',category:'профиль',mat:'Хром'},{name:'Гвоздь',category:'прочее'}]).map(i=>i.name),['Гвоздь']);
});

test('B5: артикулы — по Базису: тип петель, полкодержатели, длина направляющих Firmax',{skip},()=>{
  const k14=kitchen('k14'),k22=kitchen('k22'),k30=kitchen('k30');
  assert.equal(qty(k14,/^hinge-inset/),4,'k14 НМ: вкладные ×4');
  assert.equal(qty(k22,/^hinge-bazis:под фальшпанель/),4);assert.equal(qty(k22,/^hinge-bazis:полунакладная/),2);
  assert.equal(qty(k14,/^firmax:.*L - 500/),5,'k14: 5 пар L - 500, как в Базисе (не 6 пар «490»)');
  assert.ok(!estimate(k22).lines.some(l=>/Firmax (390|490) мм/.test(l.label)),'длина короба вместо артикула');
  assert.equal(qty(k30,/^shelf-holder:Полкодержатель для стеклянных полок MV05/),24);
  assert.ok(!estimate(k30).lines.some(l=>l.label==='Полкодержатель Boyard p521'));
  assert.deepEqual(bazisNames([{name:'Петля вкладная',category:'петля'},{name:'Петля вкладная',category:'петля'},{name:'Полкодержатель металлический',category:'полкодержатель'}]),{hinges:{'Петля вкладная':2},shelfHolders:{'Полкодержатель металлический':1}});
});

test('B6: материалы — из Базиса: ЛДСП «Черный»/«Белоснежный», «Альберо», МДФ IDM 18 мм',{skip},()=>{
  assert.equal(bazisDecor('Lamarty Белый ГЛАДКИЙ'),'Белый');assert.equal(bazisDecor('Lamarty Черный'),'Черный');assert.equal(bazisDecor('Lamarty АЛЬБЕРО'),'Альберо');assert.equal(bazisDecor('IDM ETERNO Libra'),'IDM ETERNO Libra');
  const d22=new Set(nest(kitchen('k22')).filter(s=>s.material!=='hdf').map(s=>s.decor));
  assert.deepEqual([...d22].sort(),['Белоснежный','Черный'],'k22: в раскрое — ЛДСП Базиса, без «Белый»');
  const k30=kitchen('k30'),d30=new Set(nest(k30).filter(s=>s.material!=='hdf').map(s=>s.decor+':'+(s.thickness??16)));
  assert.ok(d30.has('Альберо:16')&&d30.has('IDM ETERNO Libra:18'),[...d30].join(', '));
  assert.ok(!d30.has('Белый:18')&&!d30.has('Слэйт:18'),'МДФ не превращается в «Lamarty 18 мм · Белый/Слэйт»');
  assert.ok(estimate(k30).lines.some(l=>l.label==='Плита 18 мм · IDM ETERNO Libra'));
});

// Пересечения разных модулей (whole.ts → interModule.ts): опора и клипса нижнего модуля разрешены только у цоколя «Ряда» — правилом
// allowedContact, как внутри модуля, а не в любой доске; конфирмат стяжки (kitchen.outConf) — только сам, в доске соседа (критик n4-antresol).
test('whole kitchen: a leg may touch only the Row plinth (k23), the neighbour tie confirmat only a board (k15)',{skip:!has('k23')||!has('k15')},async()=>{
  const {interModule}=await import('../scripts/kitchen/interModule');
  const p=kitchen('k23');
  assert.deepEqual(interModule(p),[],'k23: legs and clips at the Row plinth, as in Bazis');
  const q=structuredClone(p);
  for(const a of q.modules)for(const x of a.module.raw?.panels??[])if(/цокол/i.test(x.name))x.name='Панель';
  assert.ok(interModule(q).length>0,'the same contact with a board that is not a plinth is reported');
  const k15=kitchen('k15'),n=interModule(k15).length;
  const r=structuredClone(k15);
  for(const a of r.modules)if(a.module.kitchen?.outConf)delete a.module.kitchen.outConf;
  assert.equal(interModule(r).length,n,'k15: the tie confirmats add nothing');
  assert.ok(k15.modules.some(a=>a.module.kitchen?.outConf?.length),'k15 has tie confirmats');
});
