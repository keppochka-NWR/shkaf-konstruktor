// Правило Макса 10.10.2026: «Направляющие должны идти комплектами по 2 шт. Левая и правая». В смете — одна строка на систему и длину,
// N компл. (по 2 шт.: левая + правая), N — число ящиков; у сырых модулей Базиса ящики — по коробам (дно, задняя стенка, боковины
// ящика; нет коробов — по фасадам ящиков), а не по записям фурнитуры. Шкафы студии (slide:…) — как были: комплект на ящик.
import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync,readFileSync} from 'node:fs';
import {initialModule,section,id,type Module} from '../src/model';
import {kitchenBase} from '../src/kitchen';
import {newProject,type Project} from '../src/project';
import {estimate} from '../src/pricing';
import {createModule} from '../src/ModulePalette';
import {guideCore,guideKitId,guideKits,drawerBoxes,shareKits,GUIDE_KIT_LINE} from '../src/guideKits';
import {buildKitchen,rawFromRef} from '../scripts/kitchen/buildKitchen';
import type {RefModule} from '../scripts/kitchen/compare';

const ET='C:/Users/My PC/Desktop/Claude Project/Кухни/etalon';
const has=(k:string)=>existsSync(`${ET}/${k}.json`);
const etalon=(k:string)=>JSON.parse(readFileSync(`${ET}/${k}.json`,'utf8')) as {modules:RefModule[]};
const kits=(p:Project)=>estimate(p).lines.filter(l=>GUIDE_KIT_LINE.test(l.id));
const sum=(ls:{quantity:number}[])=>ls.reduce((s,l)=>s+l.quantity,0);
const rawProject=(ref:RefModule)=>{const m:Module={...initialModule(),name:ref.name,width:ref.size[0],height:ref.size[1],depth:ref.size[2],sections:[section()],doors:false,backType:'none',plinthHeight:0,bazis:true,raw:rawFromRef(ref)};
  const p=newProject({...initialModule(),sections:[section()]});p.source='bazis';p.modules=[{id:id(),x:0,y:0,z:0,rotation:0,module:m}];return p;};

test('правило: название без стороны, строка на систему и длину, ящики по коробам, доли по записям',()=>{
  assert.equal(guideCore('Направляющая Indigo, L=500, левая'),'Направляющие Indigo, L=500');
  assert.equal(guideCore('Шариковая направляющая Versalite с доводчиком H45 (PK-L-H45-450-A) Направляющая правая'),'Шариковая направляющая Versalite с доводчиком H45 (PK-L-H45-450-A)');
  assert.equal(guideKitId('Направляющая Quadro V6 30 для InnoTech Atira, NL520, левая'),guideKitId('Направляющая Quadro V6 30 для InnoTech Atira, NL520, правая'),'левая и правая — один комплект');
  assert.equal(guideKitId('Направ. шарик. Versalite Light H45, 550'),'versalite-h45:550','Versalite Базиса — общая строка с параметрикой');
  assert.equal(guideKitId('Направляющие MODERN SLIDE с 3D регулировкой полного выдвижения с доводчиком PB-3D0SHX18-500-H Направляющая левая'),'modern-slide:500');
  assert.match(guideKitId('Направляющие скрытого монтажа Firmax (полного выдвижения) L - 500'),/^firmax:.*L - 500$/);
  assert.deepEqual(drawerBoxes([{name:'Дно ящ.'},{name:'Ст. ящ. лев.'},{name:'Ст. ящ. прав.'},{name:'Ст. ящ. задн.'},{name:'Нижний фасад выкатного ящика'},{name:'стойка верхнего ящика'}]),{boxes:1,ldsp:1,facades:1});
  assert.deepEqual(shareKits(4,[6,2]),[3,1]);assert.deepEqual(shareKits(3,[8,2]),[2,1]);
  // Firmax: 4 одинаковые записи на ящик (2 в точке спереди слева, по одной сзади слева и справа) — 2 ящика = 2 комплекта, не 8 и не 4 пары
  const fx='Направляющие скрытого монтажа Firmax (полного выдвижения) L - 500',box=(n:number)=>[...Array(n)].flatMap(()=>[{name:'Боковина ящика левая'},{name:'Боковина ящика правая'},{name:'Дно ящика'},{name:'Задняя панель ящика'}]);
  assert.deepEqual(guideKits(box(2),[...Array(8)].map(()=>({name:fx,category:'направляющая'}))).map(g=>g.n),[2]);
  // старый формат Базиса: 3 записи на 4 ящика (k30 «Остров») — 4 комплекта
  assert.deepEqual(guideKits(box(4),[...Array(3)].map(()=>({name:fx,category:'направляющая'}))).map(g=>g.n),[4]);
  // нет направляющих в Базисе — нет строки (студия не добавляет); нет ни коробов, ни фасадов ящиков — по записям, пара на комплект, с пометкой
  assert.deepEqual(guideKits(box(3),[]),[]);
  assert.deepEqual(guideKits([{name:'Дверь'}],[...Array(4)].map(()=>({name:fx,category:'направляющая'}))).map(g=>[g.n,g.noBox]),[[2,true]]);
});

test('один ящик Axis PRO и один ящик Firmax — по 1 компл. (параметрика студии)',()=>{
  const one=(system:'axis-pro'|'firmax-ldsp')=>{const m=kitchenBase(initialModule(),600,'drawers' as never);m.doors=false;m.sections[0].shelves=[];m.sections[0].drawers=0;
    m.kdrawers=[system==='axis-pro'?{system,y0:101.5,y1:439,runnerY:174,h:168,len:500}:{system,y0:101.5,y1:439,runnerY:116,box:{y:152,h:264.5,len:490,screws:true}}];return newProject(m);};
  const ax=kits(one('axis-pro')),fx=kits(one('firmax-ldsp'));
  assert.deepEqual(ax.map(l=>[l.id,l.quantity,l.unit]),[['axis-pro:168:500:white',1,'компл']]);
  assert.deepEqual(fx.map(l=>[l.id,l.quantity,l.unit]),[['firmax-ldsp:490',1,'компл']]);
  assert.match(fx[0].label,/^Направляющие скрытого монтажа Firmax 490 мм — комплект \(по 2 шт\.: левая \+ правая\)$/);
  // три ящика Firmax одной длины — одна строка, 3 компл.
  const p=one('firmax-ldsp'),m=p.modules[0].module;m.kdrawers=[0,1,2].map(i=>({system:'firmax-ldsp' as const,y0:101.5+i*240,y1:330+i*240,runnerY:116+i*240,box:{y:152+i*240,h:150,len:490}}));
  assert.deepEqual(kits(p).map(l=>[l.id,l.quantity]),[['firmax-ldsp:490',3]]);
});

test('один ящик в сыром модуле Базиса — 1 компл.: Firmax (4 записи, k30 «Духовка»), Axis PRO (k12 «НМ 2»)',{skip:!has('k30')||!has('k12')},()=>{
  const duh=etalon('k30').modules.find(m=>m.name==='Духовка')!;
  assert.equal(duh.hardware.filter(h=>h.category==='направляющая').length,4,'в Базисе 4 записи на один ящик');
  assert.deepEqual(kits(rawProject(duh)).map(l=>[l.quantity,l.unit]),[[1,'компл']]);
  const nm2=etalon('k12').modules.find(m=>m.key==='m02')!;
  assert.deepEqual(kits(rawProject(nm2)).map(l=>[l.id,l.quantity,l.unit]),[['axis-pro:raw',1,'компл']]);
});

test('сырой модуль k30 «НМ 2»: Firmax — 2 компл. (2 ящика, 8 записей Базиса), внутренний ящик Axis PRO — 1 компл.',{skip:!has('k30')},()=>{
  const ref=etalon('k30').modules.find(m=>m.name==='НМ 2')!;
  assert.equal(ref.hardware.filter(h=>/firmax/i.test(h.name)).length,8);
  const ls=kits(rawProject(ref));
  assert.deepEqual(ls.filter(l=>/^firmax:/.test(l.id)).map(l=>[l.quantity,l.unit]),[[2,'компл']]);
  assert.deepEqual(ls.filter(l=>l.id==='axis-pro:raw').map(l=>l.quantity),[1]);
  assert.ok(!estimate(rawProject(ref)).lines.some(l=>/^bazis:направляющая:/.test(l.id)),'записи Базиса направляющих — не строками');
});

test('k30 целиком: комплектов направляющих в смете = ящиков (13 Firmax + 2 Axis PRO), строки «… — комплект (по 2 шт.: левая + правая)»',{skip:!has('k30')},()=>{
  const e=etalon('k30'),p=buildKitchen(e).project,ls=kits(p);
  const boxes=e.modules.reduce((s,m)=>s+guideKits(m.panels as {name:string}[],m.hardware).reduce((t,g)=>t+g.n,0),0);
  assert.equal(boxes,15);assert.equal(sum(ls),15);
  assert.equal(sum(ls.filter(l=>/^firmax:/.test(l.id))),13);
  assert.ok(ls.filter(l=>/^firmax:/.test(l.id)).every(l=>l.unit==='компл'&&/ — комплект \(по 2 шт\.: левая \+ правая\)$/.test(l.label)));
  assert.equal(new Set(ls.map(l=>l.id)).size,ls.length,'одна строка на систему и длину');
  assert.ok(!estimate(p).lines.some(l=>/направляющ/i.test(l.label)&&l.unit!=='компл'),'направляющих штуками и парами нет');
});

test('шкафы студии: направляющие — комплект на ящик, как были (slide:…, не guides)',()=>{
  const p=newProject();p.modules[0]={...p.modules[0],module:createModule('drawers',600,850,550,initialModule())};
  const m=p.modules[0].module,drawers=m.sections.reduce((s,x)=>s+x.drawers,0),sl=estimate(p).lines.filter(l=>l.id.startsWith('slide:'));
  assert.ok(drawers>0);assert.equal(sum(sl),drawers);assert.ok(sl.every(l=>l.unit==='компл'));
  assert.ok(!estimate(p).lines.some(l=>/^(guides|firmax|versalite-h45|modern-slide):/.test(l.id)));
});
