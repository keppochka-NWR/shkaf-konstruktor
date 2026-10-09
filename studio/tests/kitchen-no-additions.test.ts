// Правило Макса 09.10.2026: в кухню из Базиса студия не добавляет ничего, чего нет в Базисе (детали, фурнитура, строки сметы).
// Аудит 34 кухонь — scripts/kitchen/audit-additions.ts. Шкафы студии — по-прежнему (регрессия правил шкафов).
import test from 'node:test';
import assert from 'node:assert/strict';
import {initialModule,section,id,parts,type Module} from '../src/model';
import {kitchenWall,kitchenBase} from '../src/kitchen';
import {newProject,parseProject,applyAutoFillers,fromBazis,type Project} from '../src/project';
import {estimate,lineGroup} from '../src/pricing';
import {nest} from '../src/exports';
import {existsSync,readFileSync} from 'node:fs';
import {rawKitchen,rawItems,type RawSpec} from '../src/rawModule';

const led=(m:Module):Module=>{m.grooves=['left','right'].map(h=>({host:h,face:(h==='left'?'+':'-') as '+'|'-',along:[16,16] as [number,number],across:[100,117] as [number,number],depth:8,name:'паз под подсветку'}));return m;};
const k25wall=()=>{const m=led(kitchenWall(initialModule(),630));m.height=930;return m;};
const rawBody=():Module=>({...initialModule(),name:'Сырой',width:600,height:720,depth:560,decor:'Белый',facadeDecor:'Слэйт',sections:[section()],doors:false,backType:'none',plinthHeight:0,
  raw:{panels:[{name:'Бок',kind:'ldsp',box:[0,0,0,16,720,560]},{name:'Бок',kind:'ldsp',box:[584,0,0,600,720,560]}],hardware:[],counts:{confirmats:8}} as RawSpec});
function project(...ms:Module[]):Project{const p=newProject({...initialModule(),sections:[section()]});p.modules=ms.map((m,i)=>({id:id(),x:200+i*1000,y:0,z:200,rotation:0,module:m}));return p;}
const ids=(p:Project)=>estimate(p).lines.map(l=>l.id);

test('кухня из Базиса (k25, навесной с пазом под подсветку): в смете нет подсветки, паз остаётся полосой в 3D',()=>{
  const p=project(k25wall());
  assert.ok(!ids(p).includes('light-stand'),'подсветки в Базисе нет — строки «Подсветка врезная в стойках» нет');
  assert.equal(estimate(p).retailExtras,0,'нет розничной надбавки за подсветку');
  const g=parts(p.modules[0].module).filter(d=>d.id.startsWith('groove:'));
  assert.equal(g.length,2,'пазы — тёмные полосы в 3D');
  assert.ok(g.every(d=>d.material==='metal'&&d.external),'полоса не в раскрое ЛДСП');
});

test('кухня из Базиса: в смете нет «Мелочёвки корпуса» и заглушек под конфирмат — у шкафа они остаются',()=>{
  const k=project(kitchenBase(initialModule(),600),k25wall()),e=ids(k);
  assert.ok(!e.includes('kit'),'норматив «Мелочёвка корпуса» — не из Базиса');
  assert.ok(!e.includes('confirmat-cap'),'заглушек под конфирмат в Базисе нет');
  assert.ok(e.includes('confirmat-7x50'),'конфирматы Базиса остаются');
  const w=newProject(),we=ids(w);
  assert.ok(we.includes('kit')&&we.includes('confirmat-cap')&&we.includes('confirmat'),'шкаф студии — как было');
});

test('сырой модуль кухни Базиса: в смете нет «Мелочёвки корпуса» и заглушек под конфирмат',()=>{
  assert.ok(rawKitchen(rawBody().raw));
  const e=estimate(project(rawBody()));
  assert.equal(e.lines.find(l=>l.id==='kit'),undefined);
  assert.equal(e.lines.find(l=>l.id==='confirmat-cap'),undefined);
  assert.equal(e.lines.find(l=>l.id==='confirmat-7x50')?.quantity,8,'конфирматы — по счётчику Базиса');
});

// Шкаф из корпуса Базиса (scripts/wardrobe/import.ts: source 'bazis-corpus', без счётчиков) — не кухня: правила шкафов как были.
const hdfBack=():RawSpec['panels'][number]=>({name:'Задняя стенка',kind:'hdf',box:[0,0,0,600,720,3]});
const rawWardrobe=():Module=>({...rawBody(),name:'Шкаф Базиса',raw:{panels:[...rawBody().raw!.panels,hdfBack()],hardware:[],source:'bazis-corpus'}});

test('сырой шкаф Базиса (wardrobe-NNN): «Мелочёвка корпуса» и работа цеха за все листы, включая ХДФ, — как было',()=>{
  const m=rawWardrobe();assert.ok(!rawKitchen(m.raw));
  const p=project(m),plan=nest(p),e=estimate(p,plan);
  assert.equal(e.lines.find(l=>l.id==='kit')?.quantity,1,'норматив шкафа на корпус остаётся');
  assert.ok(plan.some(s=>s.material==='hdf'),'в раскрое есть лист ХДФ');
  assert.equal(e.lines.find(l=>l.id==='work')!.quantity,plan.length,'работа — за все листы, как у шкафов');
  // тот же набор деталей в сыром модуле кухни: ХДФ работой не считается
  const k={...rawBody(),raw:{...rawBody().raw!,panels:[...rawBody().raw!.panels,hdfBack()]}},kp=project(k),kplan=nest(kp);
  assert.equal(estimate(kp,kplan).lines.find(l=>l.id==='work')!.quantity,kplan.filter(s=>s.material!=='hdf').length);
});

test('сырой шкаф Базиса — не «кухня из Базиса»: фальши по регламенту шкафов',()=>{
  const p=project(rawWardrobe());
  assert.equal(fromBazis(p),false);
  // «Ряд» кухни — сырой модуль кухни, даже без счётчиков фурнитуры
  assert.ok(rawKitchen({row:true,panels:[],hardware:[]}));
  assert.ok(!rawKitchen(undefined));
});

test('кухня Базиса: плита МДФ (k30 «Плита IDM ETERNO Libra 18мм») — не лист ЛДСП Lamarty: вне раскроя, в смете м² материала Базиса',()=>{
  const door:RawSpec['panels'][number]={name:'Дверь',kind:'mdf',box:[0,0,560,596,716,578],facade:true,mat:'Плита IDM ETERNO Libra 18мм',edges:[[1,2624]]};
  const k={...rawBody(),raw:{...rawBody().raw!,panels:[...rawBody().raw!.panels,door]}};
  const back=parseProject(JSON.parse(JSON.stringify(project(k)))),kk=back.modules[0].module;
  assert.equal(kk.raw!.panels[2].mat,'Плита IDM ETERNO Libra 18мм','материал Базиса сохраняется в файле проекта');
  const plan=nest(back),e=estimate(back,plan);
  assert.ok(!plan.some(s=>(s.thickness??16)===18),'МДФ 18 мм не попадает в листы ЛДСП');
  const l=e.lines.find(x=>x.id==='mat:Плита IDM ETERNO Libra 18мм')!;
  assert.ok(l&&l.unit==='м²'&&l.unitPrice===null&&l.quantity===0.427&&lineGroup(l.id)==='material',JSON.stringify(l));
  assert.equal(e.lines.find(x=>x.id==='edge1')?.quantity,2.624,'кромка Базиса на МДФ — как в Базисе');
  assert.ok(parts(kk).find(p=>p.name==='Дверь')!.external,'деталь в 3D есть, в раскрой ЛДСП не идёт');
  // сырой шкаф Базиса с МДФ — как было: деталь в раскрое, без строки МДФ
  const w=rawWardrobe();w.raw!.panels.push({...door});const wp=project(w),wplan=nest(wp);
  assert.ok(wplan.some(s=>(s.thickness??16)===18));assert.ok(!estimate(wp,wplan).lines.some(x=>x.id.startsWith('mat:')));
});

test('кухня Базиса: стеновая панель 6 мм в «Ряду» (kind other, не фасадный мат-л) — не лист Lamarty 6 мм',()=>{
  const row:RawSpec={row:true,hardware:[],panels:[{name:'Стеновая маленькая',kind:'other',box:[0,0,0,6,600,1480],mat:'Cтеновая панель 6мм'},{name:'Цоколь',kind:'other',box:[0,0,0,1200,100,16],fm:true}]};
  const p=project({...rawBody(),name:'Ряд',raw:row}),plan=nest(p),e=estimate(p,plan);
  assert.ok(!plan.some(s=>(s.thickness??16)===6),'нет листа Lamarty 6 мм');
  assert.equal(e.lines.find(x=>x.id==='mat:Cтеновая панель 6мм')?.quantity,0.888);
  assert.equal(e.lines.find(x=>x.id==='facade-external')?.quantity,0.12,'цоколь из фасадного материала — как было');
});

test('кухня студии: опция «Подсветка в стойках» по-прежнему в смете (пазы Базиса — нет)',()=>{
  const m=kitchenBase(initialModule(),600);m.standLight=true;
  assert.ok(parts(m).some(d=>d.role==='light'&&!d.id.startsWith('groove:')),'у модуля есть подсветка');
  assert.ok(ids(project(m)).includes('light-stand'));
});

test('кухня из Базиса (k25 НММойка/НМВарка): в смете нет вырезов в столешнице, которых нет в Базисе',()=>{
  const row:RawSpec={row:true,panels:[{name:'Горизонтальная',kind:'other',box:[0,862,0,2600,900,600]}],hardware:[]};
  const p=project({...rawBody(),name:'Ряд',raw:row},{...rawBody(),name:'НММойка'},{...rawBody(),name:'НМВарка'}),e=ids(p);
  assert.ok(e.includes('worktop:raw:38'),'столешница Базиса — в смете');
  assert.ok(!e.includes('worktop-cut:sink')&&!e.includes('worktop-cut:hob'),'вырезов у столешниц Базиса нет');
});

test('кухня из Базиса (k19 «А 3»): откидной фасад на петлях без газлифта — в смете нет «Подъёмного механизма»',()=>{
  const m=kitchenWall(initialModule(),600);m.height=360;m.sections[0].doorHinges=['top'];
  const d=parts(m).find(x=>x.role==='door')!;assert.equal(d.hinge,'top');
  assert.ok(!ids(project(m)).includes('lift-mechanism'),'у Базиса на таком фасаде только петли');
  // шкаф студии с откидным фасадом — механизм по-прежнему требует подбора
  const w=newProject(),s=w.modules[0].module;s.sections=[section()];s.height=600;s.width=500;s.sections[0].doorHinges=['top'];
  assert.ok(ids(w).includes('lift-mechanism'));
});

test('кухня: «Работа цеха» — за листы ЛДСП, лист ХДФ работой не считается; шкаф — как было',()=>{
  const k=project(kitchenBase(initialModule(),600),kitchenWall(initialModule(),600)),plan=nest(k),e=estimate(k,plan);
  assert.ok(plan.some(s=>s.material==='hdf'),'в раскрое есть лист ХДФ');
  assert.equal(e.lines.find(l=>l.id==='work')!.quantity,plan.filter(s=>s.material!=='hdf').length);
  const w=newProject(),wp=nest(w);
  assert.equal(estimate(w,wp).lines.find(l=>l.id==='work')!.quantity,wp.length,'шкаф: правило не менялось');
});

test('кухня из Базиса: автофальши и сдвиги студии не добавляются; кухня студии и шкафы — по регламенту цеха',()=>{
  // два кухонных корпуса под 90° у стены — у кухни студии появится угловая фальш и сдвиг
  const mk=()=>{const p=project(kitchenBase(initialModule(),600),kitchenBase(initialModule(),600));p.room={...p.room,width:3000,depth:3000};
    p.modules[0]={...p.modules[0],x:0,z:0,rotation:0};p.modules[1]={...p.modules[1],x:0,z:600,rotation:90};return p;};
  const studio=applyAutoFillers(mk());
  assert.ok(studio.modules.some(a=>a.module.cornerFiller||a.module.wallFiller),'кухня студии: регламент фальшей как был');
  const b0=mk();b0.source='bazis';const b=applyAutoFillers(b0);
  assert.ok(fromBazis(b0));
  b.modules.forEach((a,i)=>{assert.equal(a.module.cornerFiller,undefined);assert.equal(a.module.wallFiller,undefined);assert.equal(a.x,b0.modules[i].x);assert.equal(a.z,b0.modules[i].z);});
  // ранний импорт без пометки — узнаётся по сырому модулю Базиса
  const r=mk();r.modules.push({id:id(),x:2000,y:0,z:2000,rotation:0,module:rawBody()});
  assert.ok(fromBazis(r));
  assert.ok(applyAutoFillers(r).modules.every(a=>!a.module.cornerFiller&&!a.module.wallFiller));
});

test('пометка «кухня из Базиса» сохраняется в файле проекта',()=>{
  const p=project(kitchenBase(initialModule(),600));p.source='bazis';
  assert.equal(parseProject(JSON.parse(JSON.stringify(p))).source,'bazis');
  assert.equal(parseProject(JSON.parse(JSON.stringify(newProject()))).source,undefined);
});

test('прочая фурнитура Базиса (rawItems): рафиксы, заглушки навесов, ящики не Axis — шт по объектам модели, без двойного счёта',()=>{
  const at=(x:number)=>[x,0,0];
  const hw=[
    {name:'Навес мебельный регулируемый ABS левый',category:'навес',pos:at(1)},
    {name:'Заглушка для мебельного навеса ABS левая',category:'заглушка',kit:'Навесы мебельные (L+R) с заглушками',kitId:0,pos:at(1)},
    {name:'Полкодержатель стяжка РАФИКС',category:'рафикс',pos:at(2)},{name:'Полкодержатель стяжка РАФИКС',category:'рафикс',pos:at(3)},
    // вложенный комплект: тот же объект дважды (уровни комплекта) — один
    {name:'Направляющая Indigo, L=500, левая',category:'направляющая',kit:'Комплект ящика Indigo',kitId:1,pos:at(4)},
    {name:'Направляющая Indigo, L=500, левая',category:'направляющая',kit:'Направляющая Indigo',kitId:2,pos:at(4)},
    {name:'3x3',category:'прочее',service:true,pos:at(5)},{name:'Духовка',category:'прочее',pos:at(6)},
    {name:'Axis PRO Направляющая, 500',category:'направляющая',pos:at(7)},{name:'Механизм ФриФолд Шорт',category:'петля',pos:at(8)},{name:'Петля накладная',category:'петля',pos:at(9)},
    {name:'Тело по траектории',category:'сушка',kit:'Сушка L-900',kitId:3,pos:at(10)},{name:'Вращение',category:'сушка',kit:'Сушка L-900',kitId:3,pos:at(11)},
    {name:'Профиль1',category:'профиль',length:1324,pos:at(12)},
  ];
  assert.deepEqual(rawItems(hw),{'шт:Заглушка для мебельного навеса ABS левая':1,'шт:Полкодержатель стяжка РАФИКС':2,'шт:Направляющая Indigo, L=500, левая':1,'м:Профиль1':1.324,'компл:Сушка L-900':1});
  // смета: только у сырого модуля кухни; файл проекта сохраняет items
  const k={...rawBody(),raw:{...rawBody().raw!,items:rawItems(hw)}},p=parseProject(JSON.parse(JSON.stringify(project(k)))),e=estimate(p);
  assert.equal(e.lines.find(l=>l.id==='bazis:шт:Полкодержатель стяжка РАФИКС')?.quantity,2);
  assert.equal(e.lines.find(l=>l.id==='bazis:м:Профиль1')?.unit,'м');
  assert.equal(e.lines.find(l=>l.id==='bazis:компл:Сушка L-900')?.unit,'компл');
  assert.ok(e.lines.filter(l=>l.id.startsWith('bazis:')).every(l=>l.unitPrice===null),'цены нет — строка без суммы');
  const w=rawWardrobe();w.raw!.items={'шт:Полкодержатель стяжка РАФИКС':2};
  assert.ok(!estimate(project(w)).lines.some(l=>l.id.startsWith('bazis:')),'сырой шкаф Базиса — как было');
});

test('кухня: навес — с заглушкой, как в Базисе (у параметрических модулей 34 кухонь навесов 34 и заглушек 34)',()=>{
  const e=estimate(project(kitchenWall(initialModule(),600))),h=e.lines.find(l=>l.id==='kitchen-hanger')!;
  assert.ok(h.quantity>0);assert.equal(e.lines.find(l=>l.id==='kitchen-hanger-cap')?.quantity,h.quantity);
  assert.ok(!ids(newProject()).includes('kitchen-hanger-cap'),'шкаф студии — без изменений');
});

const K16='C:/Users/My PC/Desktop/Claude Project/Кухни/etalon/k16.json';
test('k16: рафиксы 54 и ящики Indigo (14 направляющих) — как в Базисе',{skip:!existsSync(K16)},()=>{
  // позиции фурнитуры в эталоне — в осях модуля: считаем по модулям и складываем
  const e=JSON.parse(readFileSync(K16,'utf8')),it:Record<string,number>={};
  for(const m of e.modules as {hardware:Parameters<typeof rawItems>[0]}[])for(const [k,n] of Object.entries(rawItems(m.hardware)))it[k]=(it[k]??0)+n;
  assert.equal(it['шт:Полкодержатель стяжка РАФИКС'],54);
  assert.equal((it['шт:Направляющая Indigo, L=500, левая']??0)+(it['шт:Направляющая Indigo, L=500, правая']??0),14);
  assert.equal((it['шт:Заглушка для мебельного навеса ABS левая']??0)+(it['шт:Заглушка для мебельного навеса ABS правая']??0),10);
});
