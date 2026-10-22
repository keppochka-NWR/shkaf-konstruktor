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
