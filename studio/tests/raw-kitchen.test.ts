// Сырые модули кухонь (импорт Базиса): смета по фурнитуре Базиса, фасадный материал, кромка, столешница по контуру,
// дробная толщина, пересечения — блокеры критика кухонь k25/k12/k04 (09.10.2026).
import test from 'node:test';
import assert from 'node:assert/strict';
import {initialModule,section,id,parts,type Module} from '../src/model';
import {kitchenWall} from '../src/kitchen';
import {newProject,type Project} from '../src/project';
import {estimate} from '../src/pricing';
import {nest} from '../src/exports';
import {rawCounts,rawParts,rawThickness,rawPanelDims,parseRaw,type RawSpec} from '../src/rawModule';
import {collisionWarnings,roomWarnings} from '../src/roomWarnings';
import {rowRects,panelExtras,rowFront,rowPanelName,rowTitle} from '../scripts/kitchen/rowWorktop';

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
  // мелочёвка корпуса — только если в Базисе есть крепёж (k32: ни конфирматов, ни эксцентриков, ни шкантов, ни полкодержателей — строки нет)
  assert.equal(e.lines.find(l=>l.id==='kit')?.quantity,1);
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
  // k25: НММойка и НМВарка — вырезы под мойку и варку в столешнице ряда
  const sink={...rawModule({panels:[{name:'Бок',kind:'ldsp',box:[0,0,0,16,720,560]}],hardware:[]}),name:'НММойка'},hob={...rawModule({panels:[{name:'Бок',kind:'ldsp',box:[0,0,0,16,720,560]}],hardware:[]}),name:'НМВарка'};
  const e2=estimate(project(rawModule(raw,2600,900,910),sink,hob));
  assert.equal(e2.lines.find(l=>l.id==='worktop-cut:sink')?.quantity,1);
  assert.equal(e2.lines.find(l=>l.id==='worktop-cut:hob')?.quantity,1);
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
  const wp=estimate(project(rawModule({row:true,panels:[{name:'стеновая',kind:'other',box:[0,0,0,2364,600,26]}],hardware:[]},2364,600,26)));
  assert.equal(wp.lines.find(l=>l.id==='wall-panel:raw:26')?.quantity,2.364);
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