// Критик целостности интерфейса, релиз 22.10.2026 (ветка claude/rel-fix3).
import test from 'node:test';
import assert from 'node:assert/strict';
import {newProject,type Project} from '../src/project';
import {initialModule} from '../src/model';
import {createKitchenRow,createModule} from '../src/ModulePalette';
import {nestPlan,nest,details,quoteHTML,unplacedDetails} from '../src/exports';
import {cutting} from '../src/cornerCutting';
import {estimate} from '../src/pricing';
import {menuArea,ringRadius,ringOverlaps} from '../src/contextMenu';

/** Новый проект → «Угловой шкаф» → «Кухня прямая» 3000 × 820 × 557 (как в сценарии критика). */
function cornerKitchen():Project{
  const p=newProject(),corner=createModule('corner',1050,2000,450,initialModule());
  return {...p,room:{...p.room,width:6000,depth:4000},modules:[{id:'c1',x:100,y:0,z:100,rotation:0,module:corner},...createKitchenRow(3000,initialModule()).map(a=>({...a,x:a.x+1300}))]};
}

test('БЛОКЕР 1: угловой + кухня прямая 3000 — раскрой и смета без исключения, столешница не кроится из листа ЛДСП',()=>{
  const p=cornerKitchen();
  assert.ok(p.modules.some(a=>a.module.worktop),'в ряду есть столешница во всю длину');
  const cut=cutting(p);
  assert.ok(!cut.pieces.some(x=>x.part.external),'покупная столешница (external) не в раскрое углового движка');
  assert.equal(cut.unplaced.length,0);
  const plan=nestPlan(p);
  assert.equal(plan.engine,'classic');assert.deepEqual(plan.unplaced,[]);
  const e=estimate(p);
  assert.equal(e.unplaced,0);assert.ok(e.retail!==null&&e.retail>0,'цена посчитана');
  assert.ok(e.lines.some(l=>l.id.startsWith('worktop:')),'столешница в смете отдельной строкой, как без углового');
});

test('БЛОКЕР 1: строка столешницы одинакова с угловым и без; «не помещается» пусто в обоих движках',()=>{
  const p=cornerKitchen(),alone:Project={...p,modules:p.modules.filter(a=>!a.module.corner)};
  const w=(q:Project)=>estimate(q).lines.filter(l=>l.id.startsWith('worktop:')).map(l=>[l.id,l.quantity,l.unitPrice]);
  assert.deepEqual(w(p),w(alone));
  assert.deepEqual(unplacedDetails(alone),[]);
  const g:Project={...p,calculation:{markup:2.2,overrides:{},cuttingEngine:'guillotine'} as Project['calculation']};
  assert.doesNotThrow(()=>estimate(g));assert.deepEqual(unplacedDetails(g),[]);
  assert.ok(nest(p).length>0);
});
test('m3: кольцо из 11 пунктов (меню фасада) — подписи не наезжают друг на друга и на кнопки; малые меню того же радиуса',()=>{
  const facade=['Ручка ›','Петли ›','Открывание ›','Тип петли ›','Цвет ›','Удалить фасад','Разделить по высоте','Разделить по ширине','Этот фасад ›','Открыть створки','Корпус ›'];
  const r=ringRadius(facade,76,48);
  assert.equal(ringOverlaps(facade,r,48),0);assert.ok(r<=150,'радиус '+r);
  assert.ok(ringOverlaps(facade,Math.ceil(11*56/(2*Math.PI)),48)>0,'прежний радиус давал наезды');
  assert.equal(ringRadius(['Размеры ›','Добавить ›','Фасады ›','Удалить корпус ›','Копия','Повернуть'],76,48),76);
});

test('m1: область кругового меню начинается под плавающими полосами над сценой',()=>{
  const canvas={left:250,top:100,right:1066,bottom:700},bar={left:274,top:164,right:990,bottom:208};
  assert.equal(menuArea({width:1366,height:768},canvas,null,[bar]).top,212);
  assert.equal(menuArea({width:1366,height:768},canvas,null,[{left:274,top:650,right:990,bottom:690}]).top,100,'полоса внизу верх не трогает');
  assert.equal(menuArea({width:1366,height:768},canvas,null,[null]).top,100);
});

test('m8: КП без цены — один заголовок «Стоимость», без повтора «Стоимость:»',()=>{
  const html=quoteHTML(newProject(),'','','');
  assert.equal(html.match(/Стоимость/g)?.length,1);
  assert.ok(html.includes('после согласования'));
  const priced=quoteHTML(newProject(),'','50000','');
  assert.ok(!priced.includes('Стоимость:'));
});

test('u1: ПКМ › Ящик › «Копия» — копия в той же секции, пока есть место; дальше понятный отказ, а не «Здесь недостаточно…»',async()=>{
  const {duplicatePart}=await import('../src/operations');
  let p=newProject();const a=p.modules[0],s=a.module.sections[0];s.drawers=2;s.shelves=[];s.rod=false;
  const before=p.modules[0].module.sections[0].drawers;let n=0,last='';
  for(let i=0;i<20;i++){try{p=duplicatePart(p,a.id,s.id,s.id+':drawer:0:facade').project;n++;}catch(e){last=(e as Error).message;break;}}
  assert.ok(n>=1,'хотя бы одна копия встала');
  assert.equal(p.modules[0].module.sections[0].drawers,before+n);
  assert.match(last,/^Копия ящика не помещается: в секции нет места/);
});

test('u2: «Задать зазор — сдвинуть модуль» сдвигает (ширина та же), «изменить ширину» — меняет ширину',async()=>{
  const {flush,setGap,gaps}=await import('../src/rowResize');
  const p=newProject();const a=p.modules[0];const g=gaps(p,a.id);
  const moved=flush(p,a.id,'right',g.right.gap-100),m2=moved.modules[0];
  assert.equal(m2.module.width,a.module.width);assert.equal(gaps(moved,a.id).right.gap,g.right.gap-100);
  const wider=setGap(p,a.id,'right',g.right.gap-100);
  assert.ok(wider.modules[0].module.width>a.module.width);
});

test('v1: палитра 1288 × 2500 — «авто» не собирается, но двери выбираются (4 · секций 2), как у 1200',async()=>{
  const {doorCountOptions}=await import('../src/paletteDoors');
  assert.throws(()=>createModule('empty',1288,2500,550,initialModule()),'одна секция 1288 — створки шире предела');
  const m=createModule('empty',1288,2500,550,initialModule(),4);
  assert.equal(m.sections.length,2);assert.ok(doorCountOptions(m).includes(4));
  assert.ok(doorCountOptions(createModule('empty',1200,2500,550,initialModule())).includes(4));
});

test('v2: «От левой стены» 40 у корпуса с автофальшью у стены — корпус ровно в 40 мм от стены, не 61',async()=>{
  const {setWallDistance}=await import('../src/operations');
  const {applyAutoFillers,bounds}=await import('../src/project');
  const p=newProject();p.modules[0].x=0;const at=applyAutoFillers(p);
  assert.ok(at.modules[0].module.wallFiller?.left,'у стены — планка');
  const r=applyAutoFillers(setWallDistance(at,at.modules[0].id,'x',40)),a=r.modules[0];
  assert.equal(a.x,40);assert.equal(bounds(a).x,40);
});

test('v3: полка в нишу над ящиками — число полок по validate; без ниши — 0 (причину даёт панель)',async()=>{
  const {maxEvenShelves}=await import('../src/shelfCount');
  const m=createModule('drawers',700,925,550,initialModule()),s=m.sections[0];
  assert.equal(maxEvenShelves(m,s),0,'ящики до крыши — ниши нет');
  s.drawers=2;s.drawerConfigs=s.drawerConfigs!.slice(0,2);
  assert.equal(maxEvenShelves(m,s),1,'ниша над двумя ящиками — одна полка');
});

test('v5: число полок не сбрасывает проёмы, выставленные вручную; ровные полки — поровну, как раньше',async()=>{
  const {setShelfCount}=await import('../src/shelfCount');
  const {distribute,validate}=await import('../src/model');
  const m=createModule('shelves',600,2000,550,initialModule()),s=m.sections[0];
  s.shelves=[0.2,0.3,0.6];setShelfCount(m,s,4);
  assert.deepEqual(s.shelves.filter(f=>[0.2,0.3,0.6].includes(f)),[0.2,0.3,0.6],'ручные полки на месте');
  assert.equal(s.shelves.length,4);assert.equal(validate(m).length,0);
  setShelfCount(m,s,2);assert.deepEqual(s.shelves,[0.2,0.3],'лишние сняты сверху');
  const e=createModule('shelves',600,2000,550,initialModule()),es=e.sections[0];es.shelves=distribute(e,es,3);setShelfCount(e,es,5);
  assert.deepEqual(es.shelves,distribute(e,es,5));
});
