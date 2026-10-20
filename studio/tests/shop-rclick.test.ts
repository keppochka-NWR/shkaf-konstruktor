// Ручной тест 19.10.2026 (шкаф w139 мышью): тупики правой кнопки и быстрые действия меню корпуса.
import test from 'node:test';
import assert from 'node:assert/strict';
import {Trash,Box} from 'lucide-react';
import {initialModule,section,id,boxes,parts,RULES,type Module} from '../src/model';
import {newProject,type Project} from '../src/project';
import {insertItem} from '../src/operations';
import {estimate,lineGroup} from '../src/pricing';
import {pendingPrice} from '../src/pendingPrices';
import {composeContextMenu,confirmDelete,moduleDims,labelSide,placeMenu,menuArea} from '../src/contextMenu';
import {missMenuTarget,screenRect,sectionAtX} from '../src/missMenu';
import {readFileSync} from 'node:fs';
import {quickItems,applySectionTemplate,menuDropY,lightItem,upperItem,backItem,baseItem,SHELF_STEP,type QuickMenuOps} from '../src/quickMenu';
import type {RadialItem} from '../src/RadialMenu';

const wardrobe=():Module=>({...initialModule(),name:'Корпус шкафа-купе',width:1000,height:2400,depth:600,doors:true,sections:[section(),section()]});
function project(m:Module):Project{const p=newProject({...initialModule(),sections:[section()]});p.modules=[{id:id(),x:200,y:0,z:200,rotation:0,module:m}];return p;}
function spy(m:Module){let mod=structuredClone(m);const calls:string[]=[];
  const ops:QuickMenuOps={modify:u=>{const n=structuredClone(mod);u(n);mod=n;calls.push('modify');},addUpper:()=>calls.push('addUpper')};
  return {ops,calls,get mod(){return mod;}};}
const ring=(n:number):RadialItem[]=>Array.from({length:n},(_,k)=>({id:k===n-1?'delete':'r'+k,label:'R'+k,icon:Box,danger:k===n-1,run:()=>{}}));

test('подзаголовок меню — размеры корпуса, а не «× ×»',()=>{
  const m=wardrobe();
  assert.equal(moduleDims(m),'1000 × 2400 × 600');
  const r=composeContextMenu(m,{title:m.name,subtitle:'',items:[]},ring(5),false);
  assert.equal(r.subtitle,'1000 × 2400 × 600');assert.equal(r.title,m.name);
});

test('правый клик по полке: первым кольцом действия полки, «Удалить полку» на первом кольце, корпус — в «Корпус ›»',()=>{
  const m=wardrobe(),body:RadialItem={id:'body',label:'Корпус',icon:Box,children:[]};
  const part={title:'Полка 2',subtitle:m.name,items:[{id:'up',label:'Выше',icon:Box},{id:'down',label:'Ниже',icon:Box},{id:'copy-part',label:'Копия',icon:Box},{id:'fixed',label:'Жёсткая',icon:Box},{id:'params',label:'Параметры',icon:Box},body,{id:'remove',label:'Удалить',icon:Trash,danger:true,run:()=>{}}] as RadialItem[]};
  const r=composeContextMenu(m,part,ring(9),true);
  assert.equal(r.title,'Полка 2');assert.match(r.subtitle,/1000 × 2400 × 600/);
  assert.deepEqual(r.items.map(i=>i.label),['Выше','Ниже','Копия','Жёсткая','Параметры','Корпус','Удалить полку']);
  assert.ok(!r.items.some(i=>i.id==='delete'),'удаления корпуса на первом кольце нет');
  const corp=r.items.find(i=>i.id==='body')!;assert.equal(corp.children!.length,9,'в «Корпус ›» все действия модуля');
  const del=corp.children!.find(i=>i.id==='delete')!;
  assert.equal(del.label,'Удалить корпус');assert.equal(del.run,undefined,'сразу не удаляет');
  assert.deepEqual(del.children!.map(i=>i.label),['Да, удалить','Отмена']);
});

test('удаление корпуса — только через «Да, удалить»; клик по корпусу — меню модуля как раньше',()=>{
  let removed=0;const item=confirmDelete({id:'delete',label:'Удалить',icon:Trash,danger:true,run:()=>{removed++;}});
  item.children![1].run!();assert.equal(removed,0);item.children![0].run!();assert.equal(removed,1);
  const m=wardrobe(),full=ring(13),r=composeContextMenu(m,{title:m.name,subtitle:'',items:[]},full,false);
  assert.deepEqual(r.items.map(i=>i.id),full.map(i=>i.id),'клик по корпусу — меню модуля, порядок тот же');
});

test('п.1 критика: в ЛЮБОМ меню корпуса (клик по корпусу, промах, «Корпус ›», двери купе) — «Удалить корпус» только через «Да, удалить / Отмена»',()=>{
  const m=wardrobe();
  const check=(items:RadialItem[],label:string)=>{
    const del=items.find(i=>i.id==='delete')!;assert.ok(del,'есть кнопка удаления');
    assert.equal(del.label,label);assert.equal(del.danger,true);assert.equal(del.run,undefined,'сразу не удаляет');
    assert.deepEqual(del.children!.map(i=>i.label),['Да, удалить','Отмена']);
    return del;
  };
  let removed=0;const full=ring(13).map(i=>i.id==='delete'?{...i,run:()=>{removed++;}}:i);
  // клик по корпусу (не по детали) и промах мимо детали (clickedPart=false, pid нет)
  const byBody=composeContextMenu(m,{title:m.name,subtitle:'',items:[]},full,false);
  const d=check(byBody.items,'Удалить корпус');d.children![1].run!();assert.equal(removed,0,'«Отмена» не удаляет');d.children![0].run!();assert.equal(removed,1,'«Да, удалить» удаляет');
  // клик по детали → «Корпус ›»
  const byPart=composeContextMenu(m,{title:'Полка 1',subtitle:'',items:[{id:'remove',label:'Удалить',icon:Trash,danger:true,run:()=>{}}]},full,true);
  check(byPart.items.find(i=>i.id==='body')!.children!,'Удалить корпус');
  // двери купе — своё кольцо, то же подтверждение
  const kupe={...wardrobe(),kupe:{doors:2,fills:['x']}} as unknown as Module;
  const k=composeContextMenu(kupe,{title:'Двери купе',subtitle:'1500 × 2500 · 2 дв.',items:ring(5)},null,false);
  check(k.items,'Удалить двери купе');
  // единственный корпус: кнопка неактивна, но подписана «Удалить корпус»
  const one=composeContextMenu(m,{title:m.name,subtitle:'',items:[]},ring(3).map(i=>i.id==='delete'?{...i,disabled:true}:i),false);
  assert.equal(one.items.find(i=>i.id==='delete')!.label,'Удалить корпус');
});

test('п.2 критика: промах мимо детали — меню только внутри экранной рамки корпуса; секция и высота — по точке клика',()=>{
  const m=wardrobe();// две секции по ~484 мм
  const rect=screenRect([{x:100,y:50},{x:500,y:50},{x:100,y:650},{x:500,y:650},null]);
  assert.deepEqual(rect,{left:100,right:500,top:50,bottom:650});
  assert.equal(missMenuTarget(m,rect,{x:520,y:300},{x:1100,y:1200}),null,'правее корпуса — ничего');
  assert.equal(missMenuTarget(m,rect,{x:300,y:20},{x:500,y:2500}),null,'выше корпуса — ничего');
  assert.equal(missMenuTarget(m,null,{x:300,y:300},{x:500,y:1000}),null,'корпус за камерой — ничего');
  assert.ok(missMenuTarget(m,rect,{x:300,y:690},{x:500,y:-80},true),'плашка размера под корпусом (вне рамки) — меню корпуса, как в находке 1');
  const [s1,s2]=boxes(m);
  const right=missMenuTarget(m,rect,{x:400,y:300},{x:s2.x+s2.width/2,y:1700})!;
  assert.equal(right.sid,m.sections[1].id,'клик над правой секцией — правая секция, не sections[0]');assert.equal(right.localY,1700,'высота клика, а не height/2');
  assert.equal(sectionAtX(m,s1.x+s1.width/2),m.sections[0].id);
  assert.equal(sectionAtX(m,(s1.x+s1.width+s2.x)/2-1),m.sections[0].id,'щель у стойки ближе к левой секции — левая');
  assert.equal(sectionAtX(m,-10),m.sections[0].id,'левая боковина — ближайшая левая секция');
  assert.equal(sectionAtX(m,m.width+10),m.sections[1].id,'правая боковина — ближайшая правая секция');
  assert.equal(missMenuTarget(m,rect,{x:300,y:300},{x:100,y:-50})!.localY,0,'высота в пределах корпуса');
});

// Решение Макса 20.10.2026: «Подсветки в горизонтах должны считаться 4000 ₽, в вертикалях 3000 ₽» — за пог.м, клиенту, поверх коэффициента
test('подсветка в полках: N полок ширины W → сумма = длина × 4000 ₽ (розница поверх коэффициента), итог проекта не «уточняется»',()=>{
  const m=wardrobe();m.sections[0].shelves=[0.2,0.4,0.6];m.sections[0].shelfLight=true;
  const base=structuredClone(m);delete base.sections[0].shelfLight;
  const W=boxes(m).find(b=>b.id===m.sections[0].id)!.width,N=3,len=N*(W-40)/1000;
  assert.equal(RULES.shelfLightRetailPerM,4000);
  const e=estimate(project(m)),e0=estimate(project(base));
  const row=e.lines.find(i=>i.id==='light-shelf')!;
  assert.equal(row.unitPrice,4000);assert.equal(row.retail,true,'розница — без коэффициента');assert.ok(!row.pending,'не «после финального расчёта»');
  assert.ok(Math.abs(row.quantity-len)<0.001,`длина ${row.quantity} = ${N} × (${W} − 40) / 1000`);
  assert.equal(e.knownCost,e0.knownCost,'себестоимость (под коэффициент) не меняется');
  assert.equal(e.retail,e0.retail!+Math.round(row.quantity*4000),'итог = прежний + длина × 4000');
  assert.equal(e.split.hardware,e0.split.hardware+Math.round(row.quantity*4000),'в той же группе разбивки, что подсветка стоек');
  assert.equal(e.split.material,e0.split.material);
  assert.ok(e.retail!==null,'итог есть');assert.equal(e.missing.length,e0.missing.length,'подсветка не добавляет «Цена уточняется»');
  assert.ok(!e.missing.some(i=>i.id==='light-shelf')&&!e.pending.some(i=>i.id==='light-shelf'));
  assert.equal(e.pending.length,e0.pending.length);
  assert.equal(pendingPrice('light-shelf'),null,'в pendingPrices подсветки в полках больше нет');
  assert.equal(lineGroup('light-shelf'),lineGroup('light-stand'),'разбивка: подсветки — одна группа');
  const hint=lightItem(m,m.sections[0].id,spy(m).ops).children![1].hint!;assert.match(hint,/4 000 ₽ за пог\. м/);assert.doesNotMatch(hint,/уточнит/);
});

test('подсветка в стойках: длина × 3000 ₽ (RULES.lightRetailPerM), в полках и стойках вместе — сумма обеих',()=>{
  const m=wardrobe();m.sections[0].shelves=[0.3,0.6];
  const e0=estimate(project(m));
  const st=structuredClone(m);st.standLight=true;
  const strips=parts(st).filter(p=>p.role==='light'&&!p.id.includes(':shelf-light:')),standLen=strips.reduce((s,p)=>s+p.length,0)/1000;
  assert.equal(RULES.lightRetailPerM,3000);assert.ok(strips.length>0);
  const es=estimate(project(st)),stand=es.lines.find(l=>l.id==='light-stand')!;
  assert.equal(stand.unitPrice,3000);assert.equal(stand.retail,true);assert.ok(Math.abs(stand.quantity-standLen)<0.001);
  assert.equal(es.retail,e0.retail!+Math.round(stand.quantity*3000));
  const both=structuredClone(st);both.sections[0].shelfLight=true;
  const eb=estimate(project(both)),shelf=eb.lines.find(l=>l.id==='light-shelf')!;
  // retailOf округляет сумму розничных строк группы один раз — так и сравниваем (не сумму двух округлений)
  const lightBoth=Math.round(stand.quantity*3000+shelf.quantity*4000);
  assert.equal(eb.retail,e0.retail!+lightBoth);
  assert.equal(eb.split.hardware,e0.split.hardware+lightBoth);
  assert.match(lightItem(st,st.sections[0].id,spy(st).ops).children![0].hint!,/3 000 ₽ за пог\. м/);
});

test('п.4 критика: жёлтая полоса — фон насквозь (pointer-events: none), мышь ловят только кнопки',()=>{
  const css=readFileSync(new URL('../src/radial-menu.css',import.meta.url),'utf8');
  assert.match(css,/div\.selection-action-bar\s*\{\s*pointer-events:\s*none;?\s*\}/);
  assert.match(css,/div\.selection-action-bar button[^{]*\{\s*pointer-events:\s*auto/);
});

test('п.5 критика (находка 6): меню не перекрывает правую панель инструментов сцены — сдвиг туда, где есть место',()=>{
  const canvas={left:300,top:60,right:1366,bottom:720},tools={left:1316,top:200,right:1358,bottom:520};
  const area=menuArea({width:1366,height:768},canvas,tools);
  assert.equal(area.right,1310,'правый край области — левее панели');
  assert.deepEqual(menuArea({width:1366,height:768},canvas,{left:310,top:200,right:350,bottom:500}).right,1366,'панель слева — правый край не трогаем');
  const R=116,SIZE=48,extent=R+SIZE/2+110;
  for(const x of [400,700,1000,1150,1250,1300]){
    const {cx,cy}=placeMenu(x,400,R,SIZE,area);
    assert.ok(cx+extent<=area.right+0.01,`клик x=${x}: меню (с подписями) не заходит на панель: ${cx+extent} > ${area.right}`);
    assert.ok(cx-extent>=area.left-0.01,`клик x=${x}: и не уходит за левый край сцены`);
    assert.ok(cy-(R+SIZE/2)>=area.top&&cy+(R+SIZE/2)<=area.bottom);
  }
  assert.ok(placeMenu(1250,400,R,SIZE,area).cx<1250,'у правой панели — меню слева от клика');
  assert.ok(placeMenu(400,400,R,SIZE,area).cx>400,'есть место справа — меню справа от клика');
});

test('фасад: действия фасада сразу на первом кольце + «Корпус ›»; двери купе — своё кольцо с размерами',()=>{
  const m=wardrobe(),facade:RadialItem={id:'facade',label:'Фасад',icon:Box,children:[{id:'edit-facade',label:'Редактировать фасад',icon:Box},{id:'remove',label:'Удалить',icon:Trash}]};
  const r=composeContextMenu(m,{title:'Фасад',subtitle:m.name,items:[facade,{id:'body',label:'Корпус',icon:Box}]},ring(5),true);
  assert.deepEqual(r.items.map(i=>i.label),['Редактировать фасад','Удалить фасад','Корпус']);
  const kupe={...wardrobe(),kupe:{doors:2,fills:['x']}} as unknown as Module;
  const k=composeContextMenu(kupe,{title:'Двери купе',subtitle:'1500 × 2500 · 2 дв.',items:[]},null,true);
  assert.equal(k.subtitle,'1500 × 2500 · 2 дв.');
});

test('подписи кольца наружу: соседние подписи сверху не ставятся друг над другом',()=>{
  const R=116,sides=Array.from({length:13},(_,i)=>{const a=-Math.PI/2+2*Math.PI*i/13;return labelSide(Math.cos(a)*R,Math.sin(a)*R,R);});
  assert.equal(sides.filter(s=>s===' above').length,1);assert.ok(sides.filter(s=>s===' below').length<=1);
});

test('задняя стенка: ХДФ накладной / в паз / ЛДСП / без задника — то же поле backType, что селект панели',()=>{
  const s=spy(wardrobe()),item=backItem(s.mod,s.ops);
  assert.deepEqual(item.children!.map(c=>c.label),['ХДФ накладной','ХДФ в паз','ЛДСП','Без задника']);
  item.children![1].run!();assert.equal(s.mod.backType,'groove');
  backItem(s.mod,s.ops).children![2].run!();assert.equal(s.mod.backType,'board');
  backItem(s.mod,s.ops).children![0].run!();assert.equal(s.mod.backType,undefined);
});

test('цоколь / ножки: те же поля plinthHeight/feet, что «Опоры» панели',()=>{
  const s=spy(wardrobe());const it=baseItem(s.mod,s.ops);
  it.children!.find(c=>c.id==='q-feet-100')!.run!();assert.deepEqual(s.mod.feet,{height:100});
  baseItem(s.mod,s.ops).children!.find(c=>c.id==='q-plinth-100')!.run!();assert.equal(s.mod.feet,undefined);assert.equal(s.mod.plinthHeight,100);
});

test('наполнение секции: шаблоны меняют только эту секцию и дают валидный шкаф',()=>{
  const m=wardrobe();m.sections[1].shelves=[0.5];
  for(const kind of ['clear','shelves3','shelves5','rod-shelf','drawers-rod','drawers-shelves'] as const){
    const n=structuredClone(m);n.sections[0].shelves=[0.2,0.4,0.6,0.8];n.sections[0].fixed=[1];
    applySectionTemplate(n,n.sections[0].id,kind);
    assert.deepEqual(n.sections[1],m.sections[1],'соседняя секция не тронута: '+kind);
    assert.equal(n.sections[0].fixed,undefined);
    const p=project(n);assert.doesNotThrow(()=>parts(n));assert.ok(estimate(p));
  }
  const n=structuredClone(m);applySectionTemplate(n,n.sections[0].id,'rod-shelf');assert.equal(n.sections[0].shelves.length,1);assert.ok(n.sections[0].rod);
  applySectionTemplate(n,n.sections[0].id,'clear');assert.deepEqual([n.sections[0].shelves,n.sections[0].drawers,n.sections[0].rod],[[],0,false]);
});

test('антресоль: добавить / убрать; кухни и сырые модули — без быстрых пунктов',()=>{
  const s=spy(wardrobe());upperItem(s.ops).children![0].run!();assert.deepEqual(s.calls,['addUpper']);
  assert.ok(upperItem(s.ops).children![1].disabled,'убрать нечего');
  let removed=false;const u=upperItem({...s.ops,removeUpper:()=>{removed=true;}});assert.ok(u.children![0].disabled);u.children![1].run!();assert.ok(removed);
  assert.equal(quickItems({...wardrobe(),kitchen:{role:'base'}} as unknown as Module,'x',s.ops).length,0,'кухни — только правила Базиса');
  assert.equal(quickItems({...wardrobe(),raw:true} as unknown as Module,'x',s.ops).length,0);
  assert.deepEqual(quickItems(wardrobe(),wardrobe().sections[0].id,s.ops).map(i=>i.id),['q-section','q-back','q-base','q-fillers','q-light']);
});

test('подсветка в полках: флаг секции, LED-профиль под передней кромкой каждой полки, смета 4000 ₽/пог.м (решение 20.10)',()=>{
  const m=wardrobe();m.sections[0].shelves=[0.3,0.6];
  const before=parts(m).length,s=spy(m);
  lightItem(s.mod,m.sections[0].id,s.ops).children![1].run!();
  const n=s.mod;assert.equal(n.sections[0].shelfLight,true);assert.equal(n.sections[1].shelfLight,undefined);
  const lights=parts(n).filter(p=>p.id.includes(':shelf-light:'));assert.equal(lights.length,2);assert.equal(parts(n).length,before+2);
  const shelf=parts(n).find(p=>p.id===m.sections[0].id+':shelf:0')!,led=lights[0];
  assert.ok(led.position[1]<shelf.position[1]-shelf.size[1]/2+0.01,'под полкой');
  assert.ok(led.position[2]+led.size[2]/2<=shelf.position[2]+shelf.size[2]/2,'не выступает за кромку');
  const row=estimate(project(n)).lines.find(i=>i.id==='light-shelf')!;
  assert.ok(row,'строка сметы');assert.equal(row.label,'Подсветка в полках');assert.equal(row.unit,'пог.м');assert.equal(row.unitPrice,RULES.shelfLightRetailPerM);
  assert.match(row.source,/4000 ₽\/пог\.м, поверх коэффициента/);
  assert.ok(!estimate(project(n)).lines.some(i=>i.id==='light-stand'),'не считается как подсветка в стойках');
  // без флага — шкаф без изменений
  assert.ok(!parts(m).some(p=>p.id.includes('shelf-light')));
  lightItem(n,m.sections[0].id,s.ops).children![1].run!();assert.equal(s.mod.sections[0].shelfLight,undefined);
});

test('штанга из меню — под ближайшей полкой сверху (70 мм, RULES.rodTopOffset), полка — на высоте клика по шагу 32',()=>{
  const m=wardrobe(),sid=m.sections[0].id;m.sections[0].shelves=[0.8];
  const b=boxes(m).find(x=>x.id===sid)!,span=b.top-b.bottom,shelfY=b.bottom+0.8*span;
  assert.equal(menuDropY(m,sid,'rod',b.bottom+500),shelfY-RULES.rodTopOffset);
  assert.equal(menuDropY(m,sid,'rod',shelfY+100),b.top-RULES.rodTopOffset,'выше полок — под крышей');
  const y=menuDropY(m,sid,'shelf',b.bottom+1000);assert.equal((y-b.bottom)%SHELF_STEP,0);assert.ok(Math.abs(y-b.bottom-1000)<=SHELF_STEP/2);
  const p=project(m),mid=p.modules[0].id,next=insertItem(p,'rod',mid,sid,menuDropY(m,sid,'rod',b.bottom+500));
  const rod=parts(next.modules[0].module).find(x=>x.id===sid+':rod')!;
  assert.ok(Math.abs(rod.position[1]-(shelfY-RULES.rodTopOffset))<=5,'штанга в 70 мм под полкой, а не на высоте клика');
});
