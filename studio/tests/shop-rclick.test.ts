// Ручной тест 19.10.2026 (шкаф w139 мышью): тупики правой кнопки и быстрые действия меню корпуса.
import test from 'node:test';
import assert from 'node:assert/strict';
import {Trash,Box} from 'lucide-react';
import {initialModule,section,id,boxes,parts,RULES,type Module} from '../src/model';
import {newProject,type Project} from '../src/project';
import {insertItem} from '../src/operations';
import {estimate} from '../src/pricing';
import {composeContextMenu,confirmDelete,moduleDims,labelSide} from '../src/contextMenu';
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
  assert.equal(r.items,full);
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
  assert.deepEqual(quickItems(wardrobe(),wardrobe().sections[0].id,s.ops).map(i=>i.id),['q-section','q-back','q-base','q-light']);
});

test('подсветка в полках: флаг секции, LED-профиль под передней кромкой каждой полки, смета без цены «после финального расчёта конструктором»',()=>{
  const m=wardrobe();m.sections[0].shelves=[0.3,0.6];
  const before=parts(m).length,s=spy(m);
  lightItem(s.mod,m.sections[0].id,s.ops).children![1].run!();
  const n=s.mod;assert.equal(n.sections[0].shelfLight,true);assert.equal(n.sections[1].shelfLight,undefined);
  const lights=parts(n).filter(p=>p.id.includes(':shelf-light:'));assert.equal(lights.length,2);assert.equal(parts(n).length,before+2);
  const shelf=parts(n).find(p=>p.id===m.sections[0].id+':shelf:0')!,led=lights[0];
  assert.ok(led.position[1]<shelf.position[1]-shelf.size[1]/2+0.01,'под полкой');
  assert.ok(led.position[2]+led.size[2]/2<=shelf.position[2]+shelf.size[2]/2,'не выступает за кромку');
  const row=estimate(project(n)).lines.find(i=>i.id==='light-shelf')!;
  assert.ok(row,'строка сметы');assert.equal(row.label,'Подсветка в полках');assert.equal(row.unit,'пог.м');assert.equal(row.unitPrice,null);
  assert.match(row.source,/после финального расчёта конструктором/);
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
