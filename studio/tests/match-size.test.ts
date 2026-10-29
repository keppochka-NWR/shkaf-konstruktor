// Макс 29.10.2026: «Как мне быстро понять высоту левого модуля и сделать правый такой же высотой?» — src/matchSize.ts, labelPriority.ts.
import test from 'node:test';
import assert from 'node:assert/strict';
import {newProject,bounds,type Project,type PlacedModule} from '../src/project';
import {initialModule,fitDrawersAfterResize,type Module} from '../src/model';
import {createModule,createKupeModule} from '../src/paletteBuild';
import {neighborSize,setModuleSize,matchGroupSize,columnOf} from '../src/matchSize';
import {matchSizeItems,groupSizeItems} from '../src/matchSizeMenu';
import {resizeSmall} from '../src/smallSize';
import {placeInRow} from '../src/rowResize';
import {labelRank,isOverallDim} from '../src/labelPriority';

const src=initialModule();
/** Случай Макса: слева высокий шкаф 2500, справа вплотную открытый стеллаж 400 × 2000 × 550. */
function room(extra:PlacedModule[]=[]):Project{
  const p=newProject();
  const tall:PlacedModule={id:'tall',x:50,z:30,y:0,rotation:0,module:createModule('wardrobe',800,2500,600,src)};
  const shelf:PlacedModule={id:'shelf',x:850,z:30,y:0,rotation:0,module:{...createModule('shelves',400,2000,550,src),doors:false}};
  return {...p,modules:[tall,shelf,...extra]};
}
const mod=(p:Project,id:string)=>p.modules.find(a=>a.id===id)!;

test('высота как у соседа слева (2500): стеллаж на полу растёт вверх, ширина и место — как были',()=>{
  const p=room(),n=neighborSize(p,'shelf','left','height');
  assert.equal(n.value,2500);assert.equal(n.name,mod(p,'tall').module.name);assert.ok(n.project,n.problem??'');
  const s=mod(n.project!,'shelf');
  assert.equal(s.module.height,2500);assert.equal(s.y??0,0);assert.equal(s.x,850);assert.equal(s.module.width,400);
  // то же, что ввод 2500 в поле «Высота» (modify: подгонка ящиков, малый корпус, placeInRow)
  const manual=structuredClone(mod(p,'shelf').module);manual.height=2500;fitDrawersAfterResize(manual,mod(p,'shelf').module);resizeSmall(mod(p,'shelf').module,manual,undefined,fitDrawersAfterResize);
  assert.deepEqual(s.module,mod(placeInRow(p,'shelf',manual),'shelf').module);
  // и глубина как у соседа
  const d=neighborSize(p,'shelf','left','depth');assert.equal(d.value,600);assert.equal(mod(d.project!,'shelf').module.depth,600);
});

test('сосед — стопка (тумба 800 + малый 200 + высокий 1500 = 2500): высота как у колонны соседа (2500)',()=>{
  const p=newProject(),w=(h:number)=>createModule('wardrobe',800,h,600,src);
  const stack:PlacedModule[]=[{id:'s1',x:50,z:30,y:0,rotation:0,module:createModule('drawers',800,800,600,src)},
    {id:'s2',x:50,z:30,y:800,rotation:0,module:{...w(200),plinthHeight:0,doors:false}},
    {id:'s3',x:50,z:30,y:1000,rotation:0,module:{...w(1500),plinthHeight:0}}];
  const shelf:PlacedModule={id:'shelf',x:850,z:30,y:0,rotation:0,module:{...createModule('shelves',400,2000,550,src),doors:false}};
  const q={...p,modules:[...stack,shelf]};
  assert.deepEqual(columnOf(q.modules,'s1').ids.sort(),['s1','s2','s3']);assert.equal(columnOf(q.modules,'s2').height,2500);
  assert.deepEqual(columnOf(q.modules,'shelf').ids,['shelf'],'стеллаж рядом — не в колонне (план не перекрывается)');
  const n=neighborSize(q,'shelf','left','height');
  assert.equal(n.value,2500);assert.equal(n.stack,3);assert.ok(n.project,n.problem??'');
  assert.equal(mod(n.project!,'shelf').module.height,2500);
  const it=matchSizeItems(q,'shelf',()=>{}).find(i=>i.id==='match-height-left')!;
  assert.equal(it.label,'Высота как у соседа слева (2500)');assert.match(it.hint!,/Колонна из 3 модулей: 2500 мм/);
  // мультивыбор по модулю стопки: высота колонны (2500) — стеллажу; модули самой колонны не трогаются
  const g=matchGroupSize(q,['s2','shelf','s3'],'s2','height');
  assert.equal(g.value,2500);assert.deepEqual(g.changed,['shelf']);assert.equal(mod(g.project,'s2').module.height,200);
  assert.match(groupSizeItems(q,['s2','shelf'],'s2',()=>{})[0].label,/· колонна \(2500\)$/);
});

test('нет соседа / уже так / не встаёт — пункт недоступен с причиной',()=>{
  const p=room();
  assert.match(neighborSize(p,'shelf','right','height').problem!,/^Справа нет соседнего модуля/);
  assert.match(neighborSize(p,'tall','left','height').problem!,/^Слева нет соседнего модуля/);
  const same=neighborSize({...p,modules:p.modules.map(a=>a.id==='shelf'?{...a,module:{...a.module,height:2500}}:a)},'shelf','left','height');
  assert.match(same.problem!,/уже 2500 мм/);assert.equal(same.project,undefined);
  // стеллаж поднят на 300 от пола: 300 + 2500 > потолка 2700 — понятная ошибка, проект не меняется
  const raised={...p,modules:p.modules.map(a=>a.id==='shelf'?{...a,y:300,module:{...a.module,height:1500}}:a)};
  const r=neighborSize(raised,'shelf','left','height');assert.equal(r.project,undefined);assert.ok(r.problem&&r.problem.length>5,r.problem??'');
  // меню: подписи с размером соседа, недоступные — с причиной
  const items=matchSizeItems(p,'shelf',()=>{});
  const h=items.find(i=>i.id==='match-height-left')!;assert.equal(h.label,'Высота как у соседа слева (2500)');assert.ok(!h.disabled);
  const hr=items.find(i=>i.id==='match-height-right')!;assert.ok(hr.disabled);assert.match(hr.hint!,/нет соседнего/);
});

test('корпус под потолком растёт вниз: верх остаётся у потолка',()=>{
  const p=newProject(),H=p.room.height;
  const a:PlacedModule={id:'a',x:50,z:30,y:H-600,rotation:0,module:{...createModule('shelves',800,600,400,src),doors:false,plinthHeight:0}};
  const b:PlacedModule={id:'b',x:850,z:30,y:H-400,rotation:0,module:{...createModule('shelves',800,400,400,src),doors:false,plinthHeight:0}};
  const q={...p,modules:[a,b]};
  const r=setModuleSize(q,'b','height',600).project,m=mod(r,'b');
  assert.equal(m.module.height,600);assert.equal((m.y??0)+m.module.height,H,'верх у потолка');
  assert.deepEqual(mod(neighborSize(q,'b','left','height').project!,'b'),m);
});

test('ящики подгоняются: комод 1000 → высота шкафа 2100, как вводом в поле',()=>{
  const p=newProject();
  const w:PlacedModule={id:'w',x:50,z:30,y:0,rotation:0,module:createModule('wardrobe',800,2100,600,src)};
  const k:PlacedModule={id:'k',x:850,z:30,y:0,rotation:0,module:createModule('drawers',800,1000,600,src)};
  const q={...p,modules:[w,k]},r=neighborSize(q,'k','left','height');
  assert.ok(r.project,r.problem??'');
  const manual:Module=structuredClone(k.module);manual.height=2100;fitDrawersAfterResize(manual,k.module);resizeSmall(k.module,manual,undefined,fitDrawersAfterResize);
  assert.deepEqual(mod(r.project!,'k').module,manual);
});

test('мультивыбор: «Выровнять высоту по …» — всем отмеченным, купе пропускается, одна правка проекта',()=>{
  const p=newProject();
  const kupe:PlacedModule={id:'ku',x:2300,z:30,y:0,rotation:0,module:createKupeModule(1500,2400,src)};
  const q=room([{id:'w2',x:1300,z:30,y:0,rotation:0,module:createModule('wardrobe',900,2100,600,src)},kupe]);
  const r=matchGroupSize({...q,room:{...p.room,width:5000}},['tall','shelf','w2','ku'],'tall','height');
  assert.deepEqual(r.changed,['shelf','w2']);assert.deepEqual(r.skipped.map(s=>[s.id,s.reason]),[['ku','двери купе']]);
  for(const id of ['tall','shelf','w2'])assert.equal(mod(r.project,id).module.height,2500);
  assert.equal(mod(r.project,'ku').module.height,2400);
  const items=groupSizeItems(q,['tall','shelf'],'tall',()=>{});
  assert.equal(items[0].label,`Выровнять высоту по «${mod(q,'tall').module.name}» (2500)`);
  assert.throws(()=>matchGroupSize(q,['tall','ku'],'tall','height'),/не встала ни одному/);
  void bounds;
});

test('подписи сцены: общие высота и ширина — сразу после ручек и плашек зазоров, раньше проёмов',()=>{
  assert.ok(isOverallDim('height')&&isOverallDim('width')&&!isOverallDim(undefined));
  const order=[{gap:true},{overall:true},{fixed:true},{},{rowGap:true}].sort((a,b)=>labelRank(a)-labelRank(b));
  assert.deepEqual(order,[{fixed:true},{rowGap:true},{overall:true},{},{gap:true}]);
});
