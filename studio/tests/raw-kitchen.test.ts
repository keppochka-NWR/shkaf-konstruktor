// Сырые модули кухонь (импорт Базиса): смета по фурнитуре Базиса, фасадный материал, кромка, столешница по контуру,
// дробная толщина, пересечения — блокеры критика кухонь k25/k12/k04 (09.10.2026).
import test from 'node:test';
import assert from 'node:assert/strict';
import {initialModule,section,id,parts,type Module} from '../src/model';
import {kitchenWall} from '../src/kitchen';
import {newProject,type Project} from '../src/project';
import {estimate} from '../src/pricing';
import {nest} from '../src/exports';
import {rawCounts,rawParts,rawThickness,rawPanelDims,parseRaw,rawHangerSeats,RAW_HANGER_DROP,type RawSpec} from '../src/rawModule';
import {collisionWarnings,roomWarnings,bazisHostNotes} from '../src/roomWarnings';
import {rowRects,panelExtras,rowFront,plinthName,rowPanelsOf,worktopGroupRole,rowPanelName,rowTitle,isWorktop} from '../scripts/kitchen/rowWorktop';

function rawModule(raw:RawSpec,w=600,h=720,d=560):Module{return {...initialModule(),name:'Сырой',width:w,height:h,depth:d,decor:'Белый',facadeDecor:'Слэйт',sections:[section()],doors:false,backType:'none',plinthHeight:0,raw};}
function project(...ms:Module[]):Project{const p=newProject({...initialModule(),sections:[section()]});p.modules=ms.map((m,i)=>({id:id(),x:i*1000,y:0,z:0,rotation:0,module:m}));return p;}

test('k25: фигурная столешница по контуру Базиса — прямоугольники, без выступа перед нижними модулями',()=>{
  const contour=[[4470,0],[0,0],[0,1250],[363,1250],[363,600],[3870,600],[3870,910],[4470,910]];
  const rs=rowRects({name:'Горизонтальная',box:[0,862,0,4470,900,1250],figure:true,contourPlane:'xz',contour});
  assert.equal(rs.length,3);
  // площадь = площадь контура (363×1250 + 3507×600 + 600×910), ни один прямоугольник в полосе 363..3870 не глубже 600
  const area=rs.reduce((s,b)=>s+(b[3]-b[0])*(b[5]-b[2]),0);
  assert.equal(area,363*1250+3507*600+600*910);
  for(const b of rs){assert.equal(b[1],862);assert.equal(b[4],900);if(b[0]>=363&&b[3]<=3870)assert.ok(b[5]<=600,JSON.stringify(b));}
  // прямоугольная (без контура) — габарит как есть
  assert.deepEqual(rowRects({name:'x',box:[0,0,0,10,10,10]}),[[0,0,0,10,10,10]]);
});

test('счётчики Базиса: петли только «Петля …», ФриФолд — комплект подъёмника, Axis PRO — ящик по паре держателей фасада',()=>{
  const hw=[...Array(4)].map(()=>({name:'Петля накладная',category:'петля'})).concat(
    [{name:'Петля под фальшпанель',category:'петля'},{name:'Средняя петля 3D ФриФолд, Kesseboehmer',category:'петля'},{name:'Механизм ФриФолд Шорт',category:'петля'},{name:'Механизм ФриФолд Шорт',category:'петля'},
     {name:'Подъемник ФриФолд Шорт,  рычаг L',category:'петля'},{name:'Axis PRO Держ. фасада AB',category:'ящик-система'},{name:'Axis PRO Держ. фасада AB',category:'ящик-система'},
     {name:'Axis PRO Держ. фасада CD',category:'ящик-система'},{name:'Axis PRO Держ. фасада CD',category:'ящик-система'},{name:'Опора кухонная',category:'опора'},{name:'Клипса',category:'клипса'},
     {name:'Конфирмат',category:'конфирмат'},{name:'Шкант 8х30 мм',category:'шкант'},{name:'Навес левый',category:'навес'},{name:'Эксцентрик',category:'эксцентрик'},{name:'Полкодержатель',category:'полкодержатель'}]);
  assert.deepEqual(rawCounts(hw),{hinges:5,lifts:1,drawers:2,legs:1,clips:1,confirmats:1,dowels:1,hangers:1,eccentrics:1,shelfHolders:1});
});

test('смета сырого модуля: фурнитура по Базису, без фантомных петель на фасадах ящиков и планках',()=>{
  // три «фасада» спереди (фасад ящика, фальшпанель, планка 40 мм) — в Базисе 0 петель
  const raw:RawSpec={panels:[{name:'Бок',kind:'ldsp',box:[0,0,0,16,720,560],edges:[[1,720]]},{name:'Фасад ящика',kind:'other',box:[0,0,560,600,140,579],facade:true,fm:true},
    {name:'Фальшпанель',kind:'other',box:[0,140,560,600,720,579],facade:true,fm:true},{name:'Планка',kind:'ldsp',box:[0,700,540,40,720,560],facade:true}],hardware:[],
    counts:{legs:4,clips:2,confirmats:12,eccentrics:2,shelfHolders:4,dowels:6,drawers:1,lifts:1}};
  const e=estimate(project(rawModule(raw)));
  const q=(id:string)=>e.lines.find(l=>l.id===id)?.quantity??0;
  assert.equal(e.lines.filter(l=>l.id.startsWith('hinge')).length,0,'петель в Базисе нет — в смете тоже');
  assert.equal(e.lines.find(l=>l.id==='kit'),undefined,'«мелочёвки корпуса» в Базисе нет — сырому модулю её не добавляем');
  assert.equal(q('kitchen-leg'),4);assert.equal(q('kitchen-clip'),2);assert.equal(q('confirmat-7x50'),12);assert.equal(q('eccentric'),2);
  assert.equal(q('shelf-holder'),4);assert.equal(q('dowel'),6);assert.equal(q('axis-pro:raw'),1);assert.equal(q('lift-mechanism'),1);
  // фасадный материал — фасады поставщика (м²), не лист ЛДСП «Белый»; кромка по длинам Базиса
  assert.equal(q('facade-external'),0.6*0.14+0.6*0.58);
  assert.equal(q('edge1'),0.72);
  const plan=nest(project(rawModule(raw)));
  assert.ok(!plan.some(s=>s.items.some(it=>/Фасад ящика|Фальшпанель/.test(JSON.stringify(it)))),'фасадный материал не в раскрое ЛДСП');
  assert.equal(rawParts(rawModule(raw)).find(p=>p.name==='Фальшпанель')!.decor,'Слэйт');
  // ЛДСП корпуса спереди (планка) — декор корпуса, не лист «Слэйт»
  assert.equal(rawParts(rawModule(raw)).find(p=>p.name==='Планка')!.decor,'Белый');
  assert.ok(!plan.some(s=>s.decor==='Слэйт'),'нет листа ЛДСП в декоре фасадов');
  // стекло Базиса (полка ВМКП 495×4×298) — строка стеклянной полки, м²
  const eg=estimate(project(rawModule({panels:[{name:'вторая стяжка в навесную',kind:'glass',box:[0,300,0,495,304,298]}],hardware:[]})));
  assert.equal(eg.lines.find(l=>l.id==='glass-shelf')?.quantity,Math.round(0.495*0.298*1000)/1000);
  // с петлями Базиса — ровно их число
  const e2=estimate(project(rawModule({...raw,counts:{hinges:3}})));
  assert.equal(e2.lines.find(l=>l.id==='hinge')?.quantity,3);
  // слияние n3: у сырого модуля кухни Базиса «мелочёвки корпуса» нет ни с крепежом, ни без (k32) — правило «ничего сверх Базиса»
  // (n3-additions, n3-kitchens2, n3-runners, n3-wardrobes2); n3-base оставлял её при крепеже в проекте — решение за Максом
  assert.equal(e.lines.find(l=>l.id==='kit'),undefined);
  assert.equal(e2.lines.find(l=>l.id==='kit'),undefined);
  // сырой шкаф (импорт корпуса, счётчиков Базиса нет) — мелочёвка как была
  const {counts:_c,...noCounts}=raw;void _c;
  assert.equal(estimate(project(rawModule(noCounts))).lines.find(l=>l.id==='kit')?.quantity,1);
});

test('«Ряд»: столешница 38 мм — строка worktop (пог.м), не корпус и не раскрой',()=>{
  const raw:RawSpec={row:true,panels:[{name:'Столешница (часть 1/2)',kind:'other',box:[0,862,0,2000,900,600]},{name:'Столешница (часть 2/2)',kind:'other',box:[2000,862,0,2600,900,910]}],hardware:[]};
  const p=project(rawModule(raw,2600,900,910));
  const e=estimate(p);
  assert.equal(e.lines.find(l=>l.id==='worktop:raw:38')?.quantity,2+0.91);
  assert.equal(e.lines.find(l=>l.id==='kit'),undefined,'ряд — не корпус');
  assert.equal(nest(p).length,0);
  assert.equal(e.lines.find(l=>l.id==='worktop-cut:sink'),undefined,'нет мойки — нет выреза');
  // k25: НММойка и НМВарка — в столешнице Базиса вырезов нет; студия их не придумывает по именам модулей (как в Базисе)
  const sink={...rawModule({panels:[{name:'Бок',kind:'ldsp',box:[0,0,0,16,720,560]}],hardware:[]}),name:'НММойка'},hob={...rawModule({panels:[{name:'Бок',kind:'ldsp',box:[0,0,0,16,720,560]}],hardware:[]}),name:'НМВарка'};
  const e2=estimate(project(rawModule(raw,2600,900,910),sink,hob));
  assert.equal(e2.lines.find(l=>l.id==='worktop-cut:sink'),undefined);
  assert.equal(e2.lines.find(l=>l.id==='worktop-cut:hob'),undefined);
  // Критик р.2 (правило 1): вырезов под мойку/варку в Базисе нет — по названиям модулей «Мойка»/«Варка» строки не добавляются
  assert.equal(e2.lines.find(l=>l.id.startsWith('worktop-cut')),undefined,'вырезов нет в Базисе — нет и в смете');
});

test('кухня из Базиса: в смете нет того, чего нет в Базисе — заглушек конфирмата, подсветки по пазу; шкафы как раньше',()=>{
  const kr:RawSpec={source:'bazis-kitchen',panels:[{name:'Бок',kind:'ldsp',box:[0,0,0,16,720,560]}],hardware:[],counts:{confirmats:12}};
  const ek=estimate(project(rawModule(kr)));
  assert.equal(ek.lines.find(l=>l.id==='confirmat-7x50')?.quantity,12);
  assert.equal(ek.lines.find(l=>l.id==='confirmat-cap'),undefined,'в Базисе заглушек конфирмата нет');
  // сырой шкаф из корпуса Базиса — заглушки как раньше
  const wr:RawSpec={source:'bazis-corpus',panels:[{name:'Бок',kind:'ldsp',box:[0,0,0,16,720,560]}],hardware:[],counts:{confirmats:12}};
  assert.equal(estimate(project(rawModule(wr))).lines.find(l=>l.id==='confirmat-cap')?.quantity,12);
  // параметрический кухонный корпус — без заглушек; обычный шкаф — с заглушками
  const k=kitchenWall(initialModule(),800);
  assert.equal(estimate(project(k)).lines.find(l=>l.id==='confirmat-cap'),undefined);
  assert.ok((estimate(newProject()).lines.find(l=>l.id==='confirmat-cap')?.quantity??0)>0);
  // паз под подсветку Базиса в кухонном корпусе — без строки «Подсветка врезная»
  const kg={...k,grooves:[{host:'left',face:'+' as const,along:[16,16] as [number,number],across:[100,117] as [number,number],depth:8,name:'паз под подсветку'}]};
  assert.ok(parts(kg).some(p=>p.role==='light'),'паз есть в деталях');
  assert.equal(estimate(project(kg)).lines.find(l=>l.id==='light-stand'),undefined);
});

test('повёрнутая панель Базиса (угловая дверь под 45°): толщина и размеры свои, не «столешница 275 мм»',()=>{
  // эталон: Дверь ЛДСП 16, lw 765×372, габарит 765×276×275
  const ex=panelExtras({name:'Дверь',mat:'ЛДСП Lamarty Белый (16мм)',box:[0,100,300,276,865,575],thick:16,lw:[765,372]});
  assert.deepEqual(ex,{t:16,lw:[765,372]});
  assert.deepEqual(panelExtras({name:'Бок',mat:'ЛДСП',box:[0,0,0,16,720,560],thick:16,lw:[720,560]}),{},'панель по осям — без t/lw');
  const raw:RawSpec={source:'bazis-kitchen',panels:[{name:'Дверь',kind:'ldsp',box:[0,100,300,276,865,575],facade:true,...ex}],hardware:[]};
  const d=rawParts(rawModule(raw))[0];
  assert.equal(d.thickness,16);assert.equal(d.length,765);assert.equal(d.width,372);assert.ok(!d.external,'ЛДСП-дверь — в раскрой');
  const e=estimate(project(rawModule(raw)));
  assert.ok(!e.lines.some(l=>l.id.startsWith('worktop')),'не столешница');
  // фасадный материал под 45° — площадь по своим размерам
  const fm:RawSpec={source:'bazis-kitchen',panels:[{name:'Дверь',kind:'other',fm:true,facade:true,box:[0,100,300,261,1047,561],t:16,lw:[947,369]}],hardware:[]};
  assert.ok(Math.abs((estimate(project(rawModule(fm))).lines.find(l=>l.id==='facade-external')?.quantity??0)-0.947*0.369)<0.001);
});

test('столешница сырого модуля — только названная так в Базисе; толщина и наклон не признак (критик 09.10.2026)',()=>{
  // наклонная обувная полка ЛДСП 16 (повёрнута на 30°): габарит в модуле 158 мм, по своим осям 16 — в раскрой ЛДСП, не «столешница 158 мм»
  const shoe:RawSpec={panels:[{name:'Полка обувная',kind:'ldsp',mat:'ЛДСП Lamarty Белый (16мм)',box:[0,0,0,800,158,270],obb:{size:[800,16,300],ry:0,rz:0}},
    // боковина ЛДСП 32 мм (так в Базисе) — в раскрой листом 32 мм, не столешница
    {name:'Вертикальная',kind:'ldsp',mat:'ЛДСП Lamarty Орех Лугано (16мм)',box:[0,0,0,32,2500,560]},
    // «ПФ» из материала «Столешница» — настоящая столешница Базиса
    {name:'ПФ',kind:'other',mat:'Столешница',box:[0,900,0,1200,938,600]},
    // стена помещения в модели Базиса — не мебель: ни раскроя, ни строки сметы
    {name:'Стена',kind:'other',mat:'Стена',box:[0,0,600,3000,2700,700]}],hardware:[]};
  const p=project(rawModule(shoe,3000,2700,700)),e=estimate(p),plan=nest(p);
  const wt=e.lines.filter(l=>l.id.startsWith('worktop:'));
  assert.deepEqual(wt.map(l=>[l.id,l.quantity]),[['worktop:raw:38',1.2]]);
  const cut=plan.flatMap(s=>s.items.map(it=>JSON.stringify(it)));
  assert.ok(cut.some(s=>s.includes('Полка обувная')),'наклонная полка — в раскрое ЛДСП');
  assert.ok(cut.some(s=>s.includes('Вертикальная')),'ЛДСП 32 мм — в раскрое');
  assert.ok(plan.some(s=>s.thickness===32),'лист 32 мм — как в Базисе');
  assert.ok(!cut.some(s=>s.includes('Стена')||s.includes('"ПФ"')),'стена и столешница — не раскрой ЛДСП');
  const ps=rawParts(rawModule(shoe,3000,2700,700));
  assert.equal(ps.find(q=>q.name==='Полка обувная')!.thickness,16);
  assert.ok(ps.find(q=>q.name.startsWith('Стена'))!.external); // имя «Стена · помещение (не мебель)» (n3-base)
  // стеновая панель 26 мм (в Базисе «Cтеновая панель 26мм», первая C латинская) и пластик — не столешница и не лист ЛДСП: строка по материалу Базиса
  const wall=project(rawModule({row:true,panels:[{name:'стеновая 26',kind:'other',mat:'Cтеновая панель 26мм',box:[0,900,0,2000,1500,26]},{name:'горизонтальная',kind:'other',mat:'Пластик ___________',box:[0,0,0,500,10,300]}],hardware:[]},2000,1500,300));
  const ew=estimate(wall);
  assert.equal(ew.lines.find(l=>l.id.startsWith('worktop')),undefined);
  assert.equal(ew.lines.find(l=>l.id==='mat:Cтеновая панель 26мм')?.quantity,1.2);
  assert.equal(ew.lines.find(l=>l.id==='mat:Пластик ___________')?.quantity,0.15);
  assert.equal(nest(wall).length,0,'не раскрой ЛДСП');
  // деталь больше листа (136: ХДФ задника 2198×2588, 010: ЛДСП 1820×2565) — раскрой не падает, в смете строка «больше листа» без цены
  const big=project(rawModule({panels:[{name:'Задняя стенка',kind:'hdf',box:[0,0,0,2198,2588,3]},{name:'Фронтальная',kind:'ldsp',box:[0,0,10,1820,2565,26]},{name:'Полка',kind:'ldsp',box:[0,500,30,800,516,530]}],hardware:[]},2200,2600,600));
  const eb=estimate(big);
  assert.equal(eb.lines.filter(l=>l.id.startsWith('unplaced-raw:')).length,2);
  assert.ok(nest(big).some(s=>s.items.some(it=>JSON.stringify(it).includes('Полка'))),'остальное — в раскрое');
  // старый проект без материала: деталь 38 мм без «столешн» в имени — не столешница
  const old=estimate(project(rawModule({panels:[{name:'Горизонтальная',kind:'other',box:[0,0,0,1200,38,600]}],hardware:[]})));
  assert.equal(old.lines.find(l=>l.id.startsWith('worktop:')),undefined);
});

test('дробная толщина Базиса (16.0999999) — целые мм, без отдельного листа 16.1',()=>{
  assert.equal(rawThickness(16.0999999),16);assert.equal(rawThickness(16.07),16);assert.equal(rawThickness(3),3);assert.equal(rawThickness(4.5),4.5);
  const raw:RawSpec={panels:[{name:'Планка карниза',kind:'ldsp',box:[0,2430,0,1990,2446.1,60]},{name:'Полка',kind:'ldsp',box:[0,0,0,564,16,500]}],hardware:[]};
  const plan=nest(project(rawModule(raw,2000,2500,560)));
  assert.deepEqual([...new Set(plan.map(s=>s.thickness))],[16]);
  // ЛДСП 19 мм — отдельная строка с настоящей толщиной, не «Lamarty 16 мм»
  const p19=project(rawModule({panels:[{name:'Полка 19',kind:'ldsp',box:[0,0,0,564,19,500]},{name:'Полка',kind:'ldsp',box:[0,100,0,564,116,500]}],hardware:[]},600,720,560));
  const sheets=estimate(p19).lines.filter(l=>l.id.startsWith('sheet:'));
  assert.deepEqual(sheets.map(l=>l.id).sort(),['sheet:Белый','sheet:Белый:19']);
  assert.ok(sheets.find(l=>l.id==='sheet:Белый:19')!.label.includes('19 мм'));
});

test('пересечения: сырой модуль (геометрия Базиса) не даёт ложных предупреждений «сдвиньте полку или петлю»',()=>{
  const raw:RawSpec={panels:[{name:'Бок',kind:'ldsp',box:[0,0,0,16,720,560]},{name:'ХДФ в пазу',kind:'hdf',box:[10,0,10,590,720,13]},{name:'Бок правый',kind:'ldsp',box:[584,0,0,600,720,560]}],hardware:[]};
  assert.equal(collisionWarnings(project(rawModule(raw))).length,0);
});

test('«Ряд»: нет предупреждения «корпус не во все лифты»; ПМ фасадного материала — фасад; шканты кухни в смете',()=>{
  const row=rawModule({row:true,panels:[{name:'Цоколь',kind:'other',box:[0,0,0,4470,100,19],fm:true}],hardware:[]},4470,100,19);
  assert.ok(!roomWarnings(project(row)).some(w=>w.kind==='logistics'));
  assert.equal(rowFront({name:'ПМ',mat:'Фасадный мат-л 1',box:[0,100,580,446,816,599]}),true);
  assert.equal(rowFront({name:'Торцевая',mat:'Фасадный мат-л 1',box:[0,100,0,19,862,342]}),false);
  assert.equal(rowFront({name:'Цоколь',mat:'ЛДСП',box:[0,100,580,446,816,599]}),false);
  const k=kitchenWall(initialModule(),800),dowels=parts(k).filter(p=>p.id.startsWith('dowel:')).length;
  assert.equal(estimate(project(k)).lines.find(l=>l.id==='dowel')?.quantity??0,dowels);
});

test('импорт: фасадный материал и кромка Базиса переносятся в сырой модуль',()=>{
  assert.deepEqual(panelExtras({name:'Цоколь',mat:'Фасадный мат-л 1',box:[0,0,0,1,1,1],edges:[{thick:1,len:597.5},{thick:0.4,len:0}]}),{fm:true,edges:[[1,597.5]]});
  assert.deepEqual(panelExtras({name:'Бок',mat:'ЛДСП Lamarty Белый (16мм)',box:[0,0,0,1,1,1]}),{});
  // слияние n3: материал Базиса (mat) переносится у не плитных деталей и МДФ — по нему узнаются столешница, стена, пластик (n3-wardrobes2)
  assert.deepEqual(panelExtras({name:'ПФ',kind:'other',mat:'Столешница',box:[0,0,0,1,1,1]}),{mat:'Столешница'});
});

test('цоколь Базиса под любым именем («Фронтальная», «Вертикальная») — «Цоколь · …», своё имя «Цоколь…» не трогаем',()=>{
  assert.equal(plinthName('Фронтальная'),'Цоколь · Фронтальная');
  assert.equal(plinthName('Вертикальная'),'Цоколь · Вертикальная');
  assert.equal(plinthName('Цоколь Видимый'),'Цоколь Видимый');
  assert.equal(plinthName('цоколь ЛДСП Графит'),'цоколь ЛДСП Графит');
  assert.equal(plinthName(''),'Цоколь');
});

test('цоколь ряда кухни: ЛДСП — в раскрое цоколем, фасадный материал — строкой цоколя; клипсы — по Базису у модулей',()=>{
  // ряд (k06): цоколь ЛДСП 16 — лицевой 1877 и торцевой 446 (составной угловой), высота 95 у пола
  const row:RawSpec={row:true,hardware:[],panels:[{name:plinthName('Фронтальная'),kind:'ldsp',box:[0,0,500,1877,95,516],edges:[[0.5,1877]]},{name:plinthName('Вертикальная'),kind:'ldsp',box:[1861,0,54,1877,95,500]}]};
  const ps=rawParts(rawModule(row,1877,95,516));
  assert.equal(ps.filter(p=>/^Цоколь/.test(p.name)&&p.material==='board'&&!p.external).length,2,'оба куска цоколя — плита в раскрой');
  const plan=nest(project(rawModule(row,1877,95,516)));
  const names=plan.flatMap(s=>s.items.map(it=>JSON.stringify(it)));
  assert.ok(names.some(n=>/Цоколь · Фронтальная/.test(n))&&names.some(n=>/Цоколь · Вертикальная/.test(n)),'в картах раскроя деталь подписана «Цоколь»');
  // клипс в ряду нет (в Базисе они у опор модулей) — ряд их не добавляет
  const e=estimate(project(rawModule(row,1877,95,516)));
  assert.equal(e.lines.find(l=>l.id==='kitchen-clip')?.quantity??0,0);
  // клипсы модулей — ровно счётчик Базиса
  const mod:RawSpec={panels:[{name:'Бок',kind:'ldsp',box:[0,100,0,16,820,560]}],hardware:[],counts:{legs:4,clips:2}};
  assert.equal(estimate(project(rawModule(mod),rawModule(row,1877,95,516))).lines.find(l=>l.id==='kitchen-clip')?.quantity,2);
  // цоколь из фасадного материала (k10, k25) — своей строкой «Цоколь», не «Фасады»; площадь как в Базисе
  const fm:RawSpec={row:true,hardware:[],panels:[{name:plinthName('Фронтальная'),kind:'other',fm:true,box:[0,0,500,2469,95,519]}]};
  const ef=estimate(project(rawModule(fm,2469,95,19)));
  assert.ok(Math.abs((ef.lines.find(l=>l.id==='plinth-external')?.quantity??0)-2.469*0.095)<0.001);
  assert.equal(ef.lines.find(l=>l.id==='facade-external'),undefined);
  // вне ряда кухни (сырой шкаф) — как раньше: фасадный материал в «Фасады»
  const wr:RawSpec={hardware:[],panels:[{name:'Цоколь',kind:'other',fm:true,box:[0,0,500,1000,95,519]}]};
  assert.equal(estimate(project(rawModule(wr,1000,95,19))).lines.find(l=>l.id==='plinth-external'),undefined);
});

// «Ряд» кухни так, как его собирает import.ts: детали rowPanelsOf в осях объекта + panelExtras
function rowModule(row:Record<string,unknown>):Module{
  const ps=rowPanelsOf(row),o=[0,1,2].map(i=>Math.min(...ps.map(p=>p.box[i]))),M=[3,4,5].map(i=>Math.max(...ps.map(p=>p.box[i])));
  return rawModule({row:true,source:'bazis-kitchen',hardware:[],panels:ps.map(p=>({name:p.name,kind:p.kind??'ldsp',box:p.box.map((v,i)=>v-o[i%3]) as RawSpec['panels'][number]['box'],...panelExtras(p),...(p.front?{facade:true}:{}),...(p.wall?{wall:true}:{})}))},M[0]-o[0],M[1]-o[1],M[2]-o[2]);
}

test('стеновая панель Базиса (фартук 6/26 мм) — изделие поставщика, м²: не лист Lamarty 6 мм и не «столешница 26 мм»',()=>{
  // у Базиса материал «Cтеновая панель» (латинская C), детали «Фронтальная/Вертикальная»; ХДФ в группе стеновых — как есть
  const row={wallPanels:[
    {name:'Фронтальная',mat:'Cтеновая панель',kind:'other',thick:6,box:[0,900,594,1292,1462,600]},
    {name:'стеновая 26',mat:'Cтеновая панель 26мм',kind:'other',thick:26,box:[1300,900,0,2264,1500,26]},
    {name:'Задняя',mat:'ХДФ Белый (3мм)',kind:'hdf',thick:3,box:[2270,900,0,2470,1500,3]}]};
  const rp=rowPanelsOf(row);
  assert.deepEqual(rp.map(p=>[p.name,!!p.wall]),[['Стеновая панель · Фронтальная',true],['стеновая 26',true],['Задняя',false]]);
  const m=rowModule(row),ps=rawParts(m);
  assert.ok(ps.filter(p=>/стенов/i.test(p.name)).every(p=>p.external),'стеновые — вне раскроя ЛДСП');
  const e=estimate(project(m)),ids=e.lines.map(l=>l.id);
  assert.ok(!ids.some(id=>/^sheet:Белый:6$/.test(id)),'нет листа Lamarty 6 мм');
  assert.ok(!ids.some(id=>id.startsWith('worktop')),'стеновая 26 мм — не столешница');
  assert.ok(Math.abs((e.lines.find(l=>l.id==='wallpanel:raw:6')?.quantity??0)-1.292*0.562)<0.001);
  assert.ok(Math.abs((e.lines.find(l=>l.id==='wallpanel:raw:26')?.quantity??0)-0.964*0.6)<0.001);
  // вне ряда кухни (сырой шкаф) флаг не действует — как раньше
  const wr=rawParts(rawModule({hardware:[],panels:[{name:'Панель',kind:'other',wall:true,box:[0,0,0,600,562,6]}]}));
  assert.ok(!wr[0].external);
});

test('деталь ряда нулевой толщины без материала (k33: «З/С AQ LineBox») — не лист «0 мм», кромка Базиса остаётся',()=>{
  const z={name:'З/С AQ LineBox',mat:'',kind:'other',thick:0,lw:[681,260],box:[0,400,18,681,660,18],edges:[{thick:0.5,len:681},{thick:0.5,len:260},{thick:0.5,len:681},{thick:0.5,len:260}]};
  const shelf={name:'Полка',mat:'ЛДСП Lamarty Белый (16мм)',kind:'ldsp',thick:16,box:[0,0,0,600,16,300]};
  const m=rowModule({other:[z,shelf]}),ps=rawParts(m);
  assert.ok(ps[0].external&&!ps[1].external);
  const e=estimate(project(m));
  assert.deepEqual(e.lines.filter(l=>l.id.startsWith('sheet:')).map(l=>l.id),['sheet:Белый'],'нет листа «Белый 0»');
  assert.ok(Math.abs((e.lines.find(l=>l.id==='edge05')?.quantity??0)-1.882)<1e-9,'кромка Базиса 1,882 м');
  // вне ряда (сырой шкаф) — как раньше
  assert.ok(!rawParts(rawModule({hardware:[],panels:[{name:'Плоская',kind:'other',box:[0,0,0,600,300,0]}]}))[0].external);
});

test('k09: чуть повёрнутый цоколь ЛДСП 16 (габарит 16,64) — толщина Базиса 16, без отдельного листа «16.7»',()=>{
  const side={name:'Цоколь',mat:'ЛДСП Lamarty Дуб Вотан (16мм)',kind:'ldsp',thick:16,lw:[98.5,783.99],box:[499.4,0,-684,516.04,98.5,100]};
  assert.deepEqual(panelExtras(side),{t:16,lw:[98.5,784]});
  // дробный хвост бокса (16.1) — не поворот: толщину по-прежнему округляет rawThickness
  assert.deepEqual(panelExtras({name:'Бок',mat:'ЛДСП',box:[0,0,0,16.1,720,560],thick:16,lw:[720,560]}),{});
  const front={name:'Цоколь\\',mat:'ЛДСП Lamarty Дуб Вотан (16мм)',kind:'ldsp',thick:16,lw:[1800,98.5],box:[371,0,-700,2171,98.5,-684]};
  const m=rowModule({plinths:[side,front]});
  const ps=rawParts(m).filter(p=>p.material==='board');
  assert.deepEqual(ps.map(p=>[p.length,p.width,p.thickness]),[[784,98.5,16],[1800,98.5,16]]);
  const sheets=estimate(project(m)).lines.filter(l=>l.id.startsWith('sheet:')).map(l=>l.id);
  assert.deepEqual(sheets,['sheet:Белый'],'оба куска цоколя — на листе 16, лишнего листа нет');
});

test('группа «столешницы» эталона: столешница — только настоящая; ЛДСП «Пенала на столешку» — в раскрой; макет «Хром» — не изделие',()=>{
  const wt={name:'Горизонтальная',mat:'Столешница',kind:'other',thick:38,box:[0,820,0,2700,858,600]};
  const shelf={name:'Горизонтальная',mat:'ЛДСП Kronospan Слоновая Кость (16мм)',kind:'ldsp',thick:16,lw:[466,330],box:[3000,1190,0,3330,1206,466],role:'worktop'};
  const bottom={name:'Дно ящика',mat:'ЛДСП Kronospan Слоновая Кость (16мм)',kind:'ldsp',thick:16,lw:[408,300],box:[3015,1222,20,3315,1238,428],role:'worktop'};
  const chrome={name:'горизонтальная',mat:'Хром',kind:'other',thick:6,lw:[330,410],box:[105,858,100,435,864,510],role:'worktop'};
  assert.equal(worktopGroupRole(wt),'worktop');
  assert.equal(worktopGroupRole({name:'Столешница большая',mat:'Столешница СКИФ 38мм',kind:'other',box:[0,0,0,1,1,1]}),'worktop');
  assert.equal(worktopGroupRole(shelf),'panel');
  assert.equal(worktopGroupRole(chrome),'mock');
  // толстая деталь без имени «Столешница» и не плита — столешница по геометрии
  assert.equal(worktopGroupRole({name:'Горизонтальная',mat:'',kind:'other',thick:28,box:[0,0,0,1000,28,600]}),'worktop');
  const row={worktops:[wt,shelf,bottom,chrome]};
  assert.deepEqual(rowPanelsOf(row).map(p=>p.name),['Столешница','Горизонтальная','Дно ящика']);
  const m=rowModule(row),ps=rawParts(m);
  assert.equal(ps.filter(p=>p.material==='board'&&!p.external).length,2,'полка и дно ЛДСП — в раскрое');
  const e=estimate(project(m)),wl=e.lines.filter(l=>l.id.startsWith('worktop'));
  assert.deepEqual(wl.map(l=>[l.id,l.quantity]),[['worktop:raw:38',2.7]],'в смете только столешница 38 мм Базиса');
  assert.ok(e.lines.some(l=>l.id==='sheet:Белый'));
  // стены «Бетон» и макеты «Пластик» (роль appliance) — тоже не изделие
  assert.equal(rowPanelsOf({other:[{name:'Фронтальная',mat:'Бетон',kind:'other',box:[0,0,0,4250,2410,80],role:'appliance'}]}).length,0);
});

test('столешница — только по Базису: угловая дверь под 45° (габарит 261×917×261, 18 мм), «Бетон» помещения и полки ЛДСП из группы worktops — не столешница',()=>{
  // k07 m09: дверь МДФ 18 мм под углом — в смете не «столешница 261 мм»; ширина по габариту и толщине — 351
  const door:RawSpec={panels:[{name:'Дверь',kind:'mdf',box:[0,0,0,261,917,261],facade:true,thick:18}],hardware:[]};
  const d=rawPanelDims(door.panels[0]);
  assert.equal(d.worktop,false);assert.equal(d.angled,true);assert.equal(d.thick,18);
  assert.ok(Math.abs(d.width-(261*Math.SQRT2-18))<0.2,String(d.width));assert.equal(d.length,917);
  const pd=rawParts(rawModule(door,261,917,261))[0];
  assert.equal(pd.thickness,18);assert.ok(!pd.external,'обычная деталь 18 мм, не стороннее изделие');
  assert.ok(!estimate(project(rawModule(door,261,917,261))).lines.some(l=>l.id.startsWith('worktop')),'нет фантомной столешницы');
  // k08, k19: стены и колонны «Бетон» — помещение, не мебель: ни столешницы, ни раскроя
  const wall:RawSpec={row:true,panels:[{name:'Фронтальная',kind:'other',box:[0,0,0,1200,2000,80],room:true}],hardware:[]};
  assert.ok(!estimate(project(rawModule(wall,1200,2000,80))).lines.some(l=>l.id.startsWith('worktop')));
  assert.ok(rawParts(rawModule(wall,1200,2000,80))[0].external);
  // настоящая столешница: по имени или по толщине Базиса ≥ 26 — как раньше
  assert.equal(rawPanelDims({name:'Столешница',kind:'other',box:[0,0,0,2000,20,600]}).worktop,true);
  assert.equal(rawPanelDims({name:'Горизонтальная',kind:'other',box:[0,0,0,2000,38,600]}).worktop,true);
  // стеновая панель 26 мм — своя строка, не «столешница»
  // (слияние n3: стеновая «Ряда» помечена wall при импорте — rowPanelsOf, n3-plinth; строка м² изделия поставщика)
  const wp=estimate(project(rawModule({row:true,panels:[{name:'стеновая',kind:'other',wall:true,box:[0,0,0,2364,600,26]}],hardware:[]},2364,600,26)));
  assert.equal(wp.lines.find(l=>l.id==='wallpanel:raw:26')?.quantity,1.418);
  assert.ok(!wp.lines.some(l=>l.id.startsWith('worktop')));
  // импорт: толщина Базиса — если габарит её не показывает; «Бетон» — помещение
  assert.deepEqual(panelExtras({name:'Дверь',mat:'Плита 18мм',thick:18,box:[0,0,0,261,917,261]}),{thick:18});
  assert.deepEqual(panelExtras({name:'Бок',mat:'ЛДСП',thick:16,box:[0,0,0,16,720,560]}),{});
  assert.deepEqual(panelExtras({name:'Фронтальная',mat:'Бетон',thick:80,box:[0,0,0,4250,2410,80]}),{room:true});
  // «Столешница» в ряду — только из материала столешницы (k07: полки ЛДСП 16 и k09: «Хром» 6 мм в группе worktops эталона — имена Базиса)
  assert.equal(rowPanelName({name:'Горизонтальная',mat:'Столешница 600',box:[0,0,0,1,1,1]}),'Столешница');
  assert.equal(rowPanelName({name:'Горизонтальная',mat:'ЛДСП Kronospan Слоновая Кость (16мм)',box:[0,0,0,1,1,1]}),'Горизонтальная');
  assert.equal(rowPanelName({name:'горизонтальная',mat:'Хром',box:[0,0,0,1,1,1]}),'горизонтальная');
  // название ряда — по тому, что в нём есть: кухня без столешницы в Базисе (k06) — «Ряд: цоколь»
  assert.equal(rowTitle([{name:'Цоколь',mat:'ЛДСП',box:[0,0,0,1,1,1],group:'plinths'}]),'Ряд: цоколь');
  assert.equal(rowTitle([{name:'Горизонтальная',mat:'Столешница',box:[0,0,0,1,1,1],group:'worktops'},{name:'Цоколь',mat:'ЛДСП',box:[0,0,0,1,1,1],group:'plinths'}]),'Ряд: столешница, цоколь');
  // проект сохраняется с толщиной и помещением
  const back=parseRaw(JSON.parse(JSON.stringify({panels:[door.panels[0],wall.panels[0]],hardware:[]})))!;
  assert.equal(back.panels[0].thick,18);assert.equal(back.panels[1].room,true);
});

test('«Ряд»: столешницей называется только столешница Базиса; столешницу могли не закладывать — в имени ряда её нет',()=>{
  // k07: полки ЛДСП и «Дно ящика» над столешницей и хром k09 лежат в группе столешниц эталона — имя Базиса остаётся
  assert.equal(isWorktop({name:'Горизонтальная',mat:'Столешница 38 мм',box:[0,824,0,2070,862,600]}),true);
  assert.equal(isWorktop({name:'столешница мал',mat:'СКИФ',box:[0,820,0,540,858,880]}),true);
  assert.equal(isWorktop({name:'Горизонтальная',mat:'ЛДСП Kronospan',box:[0,1190,0,330,1206,466]}),false);
  assert.equal(isWorktop({name:'горизонтальная',mat:'Хром',box:[0,896,0,330,902,410]}),false);
  const wt={name:'Горизонтальная',mat:'Столешница',box:[0,820,0,2000,858,600]},pl={name:'Фронтальная',mat:'Фасадный мат-л 1',box:[0,0,0,1700,95,19]},sh={name:'Горизонтальная',mat:'ЛДСП',box:[0,1190,0,330,1206,466]};
  assert.equal(rowTitle({worktops:[wt],plinths:[pl]}),'Ряд: столешница, цоколь');
  assert.equal(rowTitle({plinths:[pl]}),'Ряд: цоколь','no worktop in Bazis (k10, k16, k23, k31) — none in the name');
  assert.equal(rowTitle({worktops:[wt,sh]}),'Ряд: столешница, прочее');
  assert.equal(rowTitle({}),'Ряд: детали вне модулей');
});

test('«Ряд»: полка ЛДСП из группы столешниц — в раскрой ЛДСП (не столешница); хром — стороннее изделие; у сырых шкафов без изменений',()=>{
  const row:RawSpec={panels:[{name:'Горизонтальная',kind:'ldsp',box:[0,1190,0,330,1206,466]},{name:'горизонтальная',kind:'other',box:[400,896,0,730,902,410]}],hardware:[],counts:{},row:true};
  const ps=rawParts(rawModule(row,800,1300,500));
  assert.equal(ps[0].external,undefined,'LDSP shelf goes to the LDSP cutting');
  assert.equal(ps[1].external,true,'chrome is not an LDSP board');
  // сырой шкаф Базиса (source 'bazis-corpus'; без source и со счётчиками — старый файл кухни, rawKitchen n3-additions)
  const cab:RawSpec={panels:[{name:'Профиль',kind:'other',box:[0,0,0,600,6,40]}],hardware:[],counts:{},source:'bazis-corpus'};
  assert.equal(rawParts(rawModule(cab)).at(0)!.external,undefined,'raw wardrobe/module: unchanged');
});

test('навесы кухни Базиса над своей боковиной (комплект со старыми координатами, +985 мм) — на боковину, 15 мм ниже верха; шкафы и навесы на месте не трогаем',()=>{
  const side=(x0:number,x1:number)=>({name:'Боковина',kind:'ldsp',box:[x0,0,0,x1,400,369] as [number,number,number,number,number,number]});
  const hw=(name:string,category:string,pos:[number,number,number])=>({name,category,mesh:'abc',pos,quat:[0.71,0,0.71,0] as [number,number,number,number]});
  const spec=(source:string):RawSpec=>({panels:[side(0,16),side(584,600),{name:'Крыша',kind:'ldsp',box:[16,384,0,584,400,369]}],source,
    hardware:[hw('Навес мебельный регулируемый ABS левый','навес',[16,1385,20]),hw('Заглушка для мебельного навеса ABS левая','заглушка',[16,1385,20]),hw('Навес мебельный регулируемый ABS правый','навес',[584,385,20])]});
  const k=spec('bazis-kitchen'),seats=rawHangerSeats(k);
  assert.deepEqual([...seats],[[0,-1000],[1,-1000]]); // навес над боковиной и его заглушка; навес на боковине — как в Базисе
  const m:Module={...initialModule(),name:'А 1',width:600,height:400,depth:369,sections:[section()],doors:false,raw:k};
  const ps=rawParts(m),y=(i:number)=>ps.find(p=>p.id===`raw:h${i}`)?.model?.origin?.[1];
  assert.equal(y(0),400-RAW_HANGER_DROP);assert.equal(y(1),400-RAW_HANGER_DROP);assert.equal(y(2),385);
  assert.equal(k.hardware[0].pos[1],1385); // данные Базиса не меняются — только положение в сцене
  const p=newProject({...initialModule(),sections:[section()]});p.modules=[{id:'a',x:0,y:1700,z:0,rotation:0,module:m}];
  assert.ok(bazisHostNotes(p).some(w=>/навесы \(1\).*1000 мм/.test(w.message)));
  // шкаф из корпуса Базиса — единого отступа навеса нет, не трогаем
  assert.equal(rawHangerSeats(spec('bazis-corpus')).size,0);
});
