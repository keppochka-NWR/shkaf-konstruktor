// Волна 22.10 (ветка claude/w-kitchen): K3 — техника не открывается «Открыть створки»; K1/K2 — пеналы под технику шаблоном калькулятора
// (сверка генератора с эталонами Базиса k25 m10 и k14 m08); п. 6 — низ навесных от пола; п. 10 — модель стиральной машины.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as THREE from 'three';
import {initialModule,parts,validate,parseModule} from '../src/model';
import {kitchenTemplate,kitchenProject,placeKitchenModule,kitchenItemOf,rebuildKitchen,setLegHeight,setWallFloor,defaultWallY,KITCHEN_ITEMS} from '../src/kitchenProject';
import {kitchenTallColumn,configureColumn,columnErrors,columnShelves,TALL_COLUMN} from '../src/kitchenTall';
import {wallFloorY,KITCHEN} from '../src/kitchen';
import {projectErrors,appendModule,parseProject} from '../src/project';
import {collisionWarnings} from '../src/roomWarnings';
import {procModel} from '../src/hardwareModels';
import {applianceModel,APPLIANCE_MODEL_TYPES} from '../src/applianceGeometry';
import {describeModule} from '../src/quoteDescribe';
import {OVEN} from '../src/ovenDimensions';
import {compareModule,honestPass} from '../scripts/kitchen/compare';
import {k25Fridge,k14Oven,tallRef} from '../scripts/kitchen/tallEtalons';

const src={decor:'Белый',facadeDecor:'Белый'};
const box=(o:THREE.Object3D)=>new THREE.Box3().setFromObject(o);
const span=(m:ReturnType<typeof kitchenTemplate>,id:string)=>{const p=parts(m).find(q=>q.id===id)!;return [p.position[1]-p.size[1]/2,p.position[1]+p.size[1]/2];};

test('K3: «Открыть створки» не открывает технику — духовка и СВЧ в сцене всегда закрыты, холодильник и посудомойка тоже',()=>{
  const m=kitchenTemplate('tall-oven',600,src),oven=parts(m).find(p=>p.id==='layout-oven')!;
  // процедурная модель духовки без флага открытия: дверца закрыта (лицо не дальше габарита детали)
  const g=procModel(oven,{left:false})!;assert.ok(box(g).max.z<=OVEN_DEPTH_HALF(oven)+0.5,'дверца духовки закрыта');
  const scene=readFileSync(new URL('../src/Scene.tsx',import.meta.url),'utf8');
  assert.ok(!/procModel\(part, \{[^}]*open/.test(scene),'procModel не получает openDoors');
  assert.ok(!/applianceModel\(o,state\.openDoors\)/.test(scene),'техника замера не получает openDoors');
  assert.ok(scene.includes('!part.hingeless'),'фасад на двери техники (без петель) не распахивается');
  // фасады мебели по-прежнему открываются: условие поворота дверей осталось
  /* 29.10 (плавное открывание): створка всегда на петлевой оси, открыта ли — по «Открыть створки» (openMove) */assert.ok(scene.includes('openMove(placed.id,part.id,state.openDoors,true'));
});
function OVEN_DEPTH_HALF(p:{size:number[]}){return p.size[2]/2;}

test('K1: «Пенал: духовка + СВЧ» — шаблон: ящик, ниша духовки 585 на опорной полке, ниша СВЧ 380, дверь сверху; без ошибок и пересечений',()=>{
  const m=kitchenTemplate('tall-oven',600,src);
  assert.deepEqual(validate(m),[]);assert.equal(m.height,KITCHEN.baseHeight+KITCHEN.worktopThickness+KITCHEN.wallGap+KITCHEN.wallHeight);
  const c=m.kitchen!.column!;assert.equal(c.kind,'oven');
  const [s0,s1,s2]=columnShelves(m);
  assert.equal(s1-s0-16,TALL_COLUMN.ovenNiche);assert.equal(s2-s1-16,380);
  const ps=parts(m),ids=ps.map(p=>p.id);
  for(const id of ['layout-oven','layout-microwave','back','back:low','kd:0:facade'])assert.ok(ids.includes(id),id);
  // духовка стоит на опорной полке, СВЧ — в своей нише; фасады только выше СВЧ, ящик под опорной полкой
  const oven=ps.find(p=>p.id==='layout-oven')!,mw=ps.find(p=>p.id==='layout-microwave')!;
  assert.equal(oven.position[1]-oven.size[1]/2,c.kind==='oven'?c.support-OVEN.frontBelowSupport:0);
  assert.ok(mw.position[1]-mw.size[1]/2>=s1+8-1&&mw.position[1]+mw.size[1]/2<=s2-8+1);
  const door=ps.find(p=>p.role==='door'&&p.id.includes(':door:'))!;assert.ok(door.position[1]-door.size[1]/2>s2);
  assert.ok(m.kdrawers![0].y1<=(c.kind==='oven'?c.support:0)-OVEN.frontBelowSupport);
  // задник: над СВЧ и за ящиком, ниши — без задника
  const [b0]=span(m,'back'),[,l1]=span(m,'back:low');assert.ok(b0>=s2-8&&b0<=s2-8+1&&l1<=s0+8);
  const p=placeKitchenModule(kitchenProject(),m);
  assert.deepEqual(projectErrors(p.project),[]);
  assert.deepEqual(collisionWarnings(p.project).filter(w=>w.moduleId===p.id),[]);
  // палитра: карточка и назначение; КП — «под духовой шкаф и СВЧ», техника — не позиция КП
  assert.equal(KITCHEN_ITEMS['tall-oven'].label,'Пенал: духовка + СВЧ');assert.equal(kitchenItemOf(m),'tall-oven');
  const d=describeModule(m);assert.match(d.kind,/под духовой шкаф и СВЧ/);
});

test('K1: ниши в мм переживают смену высоты и опор; СВЧ 460 и без СВЧ; ошибки ниш по паспорту',()=>{
  const m=kitchenTemplate('tall-oven',600,src),before=columnShelves(m);
  const back=parseModule(JSON.parse(JSON.stringify(m)));assert.deepEqual(back.kitchen!.column,m.kitchen!.column);assert.equal(back.kitchen!.backBelowShelf,m.kitchen!.backBelowShelf);
  m.height+=100;configureColumn(m);assert.deepEqual(columnShelves(m),before);assert.deepEqual(validate(m),[]);
  configureColumn(m,{mwNiche:460});assert.deepEqual(validate(m),[]);assert.equal(parts(m).find(p=>p.id==='layout-microwave')!.size[1],462);
  configureColumn(m,{mwNiche:0});assert.deepEqual(validate(m),[]);assert.ok(!parts(m).some(p=>p.id==='layout-microwave'));
  configureColumn(m,{ovenNiche:620});assert.ok(columnErrors(m).some(e=>e.includes('ниши духовки')));
  const n=kitchenTemplate('tall-oven',600,src);n.sections[0].shelves=n.sections[0].shelves.map(f=>f+0.01);assert.ok(columnErrors(n).some(e=>e.includes('пересоберите')));
  const w=kitchenTemplate('tall-oven',600,src);w.width=650;assert.ok(columnErrors(w).some(e=>e.includes('ширина ниши')));
  // опоры: setLegHeight раскладывает полки заново
  const p=placeKitchenModule(kitchenProject(),kitchenTemplate('tall-oven',600,src)),q=setLegHeight(p.project,[p.id],120),a=q.modules.find(x=>x.id===p.id)!.module;
  assert.deepEqual(validate(a),[]);assert.deepEqual(columnErrors(a),[]);
  // сохранение: спецификация колонны и второй задник переживают разбор проекта
  // смена назначения: пенал → пенал под холодильник и обратно
  const r=rebuildKitchen(kitchenTemplate('tall',600,src),'tall-oven');assert.equal(r.kitchen!.column!.kind,'oven');assert.deepEqual(validate(r),[]);
});

test('K2: «Пенал под холодильник» — ниша 1780, фасад ниши без петель на двери холодильника, антресольная дверь, вентканал, задник от полки',()=>{
  const m=kitchenTemplate('tall-fridge',600,src);assert.deepEqual(validate(m),[]);
  const ps=parts(m),[s0]=columnShelves(m);
  assert.equal(s0-8-(m.feet!.height+16),TALL_COLUMN.fridgeNiche);
  const doors=ps.filter(p=>p.role==='door');assert.equal(doors.length,2);
  const low=doors.find(d=>d.id.endsWith(':door:0'))!,up=doors.find(d=>d.id.endsWith(':door:2'))!;
  assert.equal(low.hingeless,true);assert.ok(!up.hingeless);
  assert.ok(!ps.some(p=>p.role==='hinge'&&p.id.includes(':door:0')),'у фасада холодильника нет мебельных петель');
  const fr=ps.find(p=>p.id==='layout-fridge')!;assert.ok(fr.position[1]+fr.size[1]/2<s0-8);
  assert.equal(m.kitchen!.bottomBack,50);assert.equal(m.kitchen!.topBack,50);assert.equal(m.kitchen!.backFromShelf,0);
  const p=placeKitchenModule(kitchenProject(),m);
  assert.deepEqual(projectErrors(p.project),[]);assert.deepEqual(collisionWarnings(p.project).filter(w=>w.moduleId===p.id),[]);
  assert.equal(kitchenItemOf(m),'tall-fridge');assert.match(describeModule(m).kind,/под холодильник/);
});

test('K2: генератор студии = эталон Базиса k25 m10 «Пенал 600 (Холодильник)» — PASS',()=>{
  const m=k25Fridge(),c=compareModule(tallRef('k25-m10'),m);
  assert.ok(honestPass(c,validate(m),[]),JSON.stringify({missing:c.missing.map(x=>x.name),extra:c.extra.map(x=>x.name),hw:c.hardware.filter(h=>h.ref!==h.studio),holes:c.holes&&[c.holes.matched,c.holes.ref]}));
});

test('K1: генератор против эталона k14 m08 «Пенал под духовку» — известные расхождения (съёмные полки по правилу, кромка торца полок)',()=>{
  const m=k14Oven(),c=compareModule(tallRef('k14-m08'),m);
  assert.deepEqual(validate(m),[]);
  assert.equal(c.missing.length,0);assert.equal(c.extra.length,0);
  // все детали на местах; отличия — только две съёмные полки (по правилу «поровну» вместо мест Базиса, ≤ 6 мм) и их полкодержатели
  const bad=c.pairs.filter(p=>p.delta>0.5);assert.ok(bad.every(p=>p.ref.name==='Горизонтальная'&&p.delta<=6),JSON.stringify(bad.map(p=>p.delta)));
  assert.ok(c.holes!.matched>=117,`отверстия ${c.holes!.matched}/${c.holes!.ref}`);
});

test('п. 6: низ навесного от пола — по умолчанию 1458 (как в Базисе), поле модуля и ряда; палитра ставит на заданную высоту',()=>{
  assert.equal(wallFloorY(),1458);
  const p=kitchenProject(),walls=p.modules.filter(a=>a.module.kitchen?.role==='wall');
  assert.ok(walls.length>1&&walls.every(a=>a.y===1458));assert.equal(defaultWallY(p),1458);
  const one=setWallFloor(p,walls[0].id,1450);assert.equal(one.modules.find(a=>a.id===walls[0].id)!.y,1450);assert.equal(one.modules.find(a=>a.id===walls[1].id)!.y,1458);
  const row=setWallFloor(p,walls[0].id,1450,true);assert.ok(row.modules.filter(a=>a.module.kitchen?.role==='wall').every(a=>a.y===1450));assert.deepEqual(projectErrors(row),[]);
  // палитра: заданный низ — новый навесной на нём; без поля — в ряд
  const empty={...p,modules:p.modules.filter(a=>a.module.kitchen?.role!=='wall')};
  const a=placeKitchenModule(empty,kitchenTemplate('wall',600,src),{wallY:1400});assert.equal(a.project.modules.find(x=>x.id===a.id)!.y,1400);
  const b=placeKitchenModule(empty,kitchenTemplate('wall',600,src));assert.equal(b.project.modules.find(x=>x.id===b.id)!.y,1458);
  // общая палитра (appendModule): навесной на низ по умолчанию, не 0 и не 1500
  const c=appendModule(empty,kitchenTemplate('wall',600,src));assert.equal(c.modules.at(-1)!.y,1458);
});

test('п. 10: стиральная машина — процедурная модель по габариту замера (корпус, люк с кольцом, панель управления)',()=>{
  assert.ok(APPLIANCE_MODEL_TYPES.includes('washer'));
  for(const depth of [400,600]){
    const g=applianceModel({id:'w1',name:'Стиральная машина',type:'washer',x:0,y:0,z:0,width:600,height:850,depth})!;
    const s=box(g).getSize(new THREE.Vector3());
    assert.ok(Math.abs(s.x-600)<=1&&Math.abs(s.y-850)<=1,`габарит ${s.x}×${s.y}`);assert.ok(s.z<=depth+20,`глубина ${s.z}`);
    let torus=0;g.traverse(o=>{if(o instanceof THREE.Mesh&&o.geometry instanceof THREE.TorusGeometry)torus++;});assert.equal(torus,1,'кольцо люка');
  }
  const p=parseProject(JSON.parse(JSON.stringify({...kitchenProject(),room:{...kitchenProject().room,obstacles:[{id:'w1',name:'Стиральная машина',type:'washer',x:100,y:0,z:0,width:600,height:850,depth:500}]}})));
  assert.equal(p.room.obstacles![0].type,'washer');
});

test('шаблоны колонны строятся от initialModule без исключений для всех ширин палитры',()=>{
  for(const k of ['tall-oven','tall-fridge'] as const)for(const w of KITCHEN_ITEMS[k].widths){const m=kitchenTallColumn(initialModule(),w,k==='tall-oven'?'oven':'fridge');assert.deepEqual(validate(m),[]);}
});
