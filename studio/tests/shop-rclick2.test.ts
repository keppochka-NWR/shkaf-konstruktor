// Ф3b (20.10.2026): в правую кнопку — самые частые функции «только в панели» по Покрытие.md (coverage-1019):
// деление двери по высоте, тип петли (монтаж фасадов), фальши корпуса. Те же правки модели, что панель.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {initialModule,section,parts,validate,facadeTop,facadeBottom,RULES,type Module} from '../src/model';
import {quickItems,doorQuickItems,doorSplitItem,doorMountItem,fillersItem,defaultDoorSplit,type QuickMenuOps} from '../src/quickMenu';
import type {RadialItem} from '../src/RadialMenu';

const wardrobe=():Module=>({...initialModule(),name:'Шкаф',width:1000,height:2400,depth:600,doors:true,sections:[section(),section()]});
function spy(m:Module){let mod=structuredClone(m);const calls:string[]=[];
  const ops:QuickMenuOps={modify:u=>{const n=structuredClone(mod);u(n);mod=n;calls.push('modify');},addUpper:()=>calls.push('addUpper')};
  return {ops,calls,get mod(){return mod;}};}
const child=(i:RadialItem,id:string)=>{const c=i.children!.find(x=>x.id===id);assert.ok(c,'нет пункта '+id);return c!;};
const doorsIn=(m:Module,sid:string)=>parts(m).filter(p=>p.role==='door'&&p.id.startsWith(sid+':')).length;

test('(а) «Разделить по высоте»: включает деление секции с высотой как у галочки панели и снимает его повторно',()=>{
  const m=wardrobe(),sid=m.sections[0].id,s=spy(m);
  const before=doorsIn(m,sid);
  const it=doorSplitItem(s.mod,sid,s.ops);
  assert.equal(it.label,'Разделить по высоте');assert.ok(!it.active);assert.ok(!it.disabled);
  it.run!();
  const sec=s.mod.sections[0];
  assert.equal(sec.doorSplit,Math.round((facadeTop(m)-facadeBottom(m))/2),'по умолчанию — половина фасадов, как в панели');
  assert.equal(sec.doorSplit,defaultDoorSplit(m,m.sections[0]));
  assert.equal(s.mod.sections[1].doorSplit,undefined,'вторая секция не тронута');
  assert.deepEqual(validate(s.mod),[]);
  assert.ok(doorsIn(s.mod,sid)>before,'дверей в секции стало больше (два ряда)');
  const off=doorSplitItem(s.mod,sid,s.ops);
  assert.equal(off.label,'Не делить дверь');assert.ok(off.active);
  off.run!();
  assert.equal(s.mod.sections[0].doorSplit,undefined);assert.equal(doorsIn(s.mod,sid),before);
});

test('(а) деление снимает удалённые фасады секции и неактивно без распашных фасадов',()=>{
  const m=wardrobe();m.sections[0].removedDoors=[0];
  const s=spy(m);doorSplitItem(s.mod,m.sections[0].id,s.ops).run!();
  assert.equal(s.mod.sections[0].removedDoors,undefined,'как панель: delete removedDoors');
  assert.ok(doorSplitItem({...wardrobe(),doors:false},m.sections[0].id,s.ops).disabled);
});

test('(а) ящики снаружи: нижний ряд считается от полки ящиков, как в панели',()=>{
  const m=wardrobe();m.sections[0].drawers=2;m.sections[0].externalDrawers=true;
  const s=spy(m);doorSplitItem(s.mod,m.sections[0].id,s.ops).run!();
  assert.equal(s.mod.sections[0].doorSplit,defaultDoorSplit(m,m.sections[0]));
  assert.ok(s.mod.sections[0].doorSplit!<Math.round((facadeTop(m)-facadeBottom(m))/2));
});

test('(б) «Тип петли»: накладная / вкладная — doorMount корпуса; полунакладной в модели нет — пункт неактивен',()=>{
  const s=spy(wardrobe());
  const it=doorMountItem(s.mod,s.ops);
  assert.deepEqual(it.children!.map(c=>c.label),['Накладная','Полунакладная','Вкладная']);
  assert.ok(child(it,'q-mount-overlay').active);
  const half=child(it,'q-mount-half');assert.ok(half.disabled);assert.equal(half.run,undefined);
  child(it,'q-mount-inset').run!();
  assert.equal(s.mod.doorMount,'inset');assert.deepEqual(validate(s.mod),[]);
  const again=doorMountItem(s.mod,s.ops);assert.ok(child(again,'q-mount-inset').active);
  child(again,'q-mount-overlay').run!();
  assert.equal(s.mod.doorMount,undefined,'накладные — как по умолчанию (поле удаляется, как в select панели)');
  assert.ok(doorMountItem({...wardrobe(),doors:false},s.ops).disabled);
});

test('(а,б) меню двери: пункты деления и петли — только у шкафов студии с фасадами',()=>{
  const m=wardrobe(),s=spy(m);
  assert.deepEqual(doorQuickItems(m,m.sections[0].id,s.ops).map(i=>i.id),['q-door-split','q-door-mount']);
  assert.equal(doorQuickItems({...m,doors:false},m.sections[0].id,s.ops).length,0);
  assert.equal(doorQuickItems({...m,kitchen:{role:'base'}} as unknown as Module,m.sections[0].id,s.ops).length,0,'кухни — правила Базиса');
  assert.equal(doorQuickItems({...m,raw:true} as unknown as Module,m.sections[0].id,s.ops).length,0);
});

test('(в) «Фальши ›»: боковая фальшпанель слева/справа как галочка панели, повторно — убрать',()=>{
  const s=spy(wardrobe());
  const it=fillersItem(s.mod,s.ops);
  assert.deepEqual(it.children!.map(c=>c.id),['q-side-left','q-side-right','q-top-strip'],'фальша к стене нет — он появляется сам у стены');
  child(it,'q-side-left').run!();
  assert.deepEqual(s.mod.sidePanels,{left:{height:2400,depth:618}});
  assert.deepEqual(validate(s.mod),[]);
  child(fillersItem(s.mod,s.ops),'q-side-right').run!();
  assert.deepEqual(Object.keys(s.mod.sidePanels!).sort(),['left','right']);
  const on=fillersItem(s.mod,s.ops);assert.ok(on.active);assert.ok(child(on,'q-side-left').active);
  child(on,'q-side-left').run!();child(fillersItem(s.mod,s.ops),'q-side-right').run!();
  assert.equal(s.mod.sidePanels,undefined,'последняя убрана — поле удалено, как в панели');
});

test('(в) планка под крышей: 40–120 мм и «Нет», как select панели',()=>{
  const s=spy(wardrobe());
  const strip=child(fillersItem(s.mod,s.ops),'q-top-strip');
  assert.deepEqual(strip.children!.map(c=>c.label),['Нет','40 мм','60 мм','80 мм','100 мм','120 мм']);
  child(strip,'q-top-strip-80').run!();
  assert.equal(s.mod.topStrip,80);assert.deepEqual(validate(s.mod),[]);
  assert.ok(child(child(fillersItem(s.mod,s.ops),'q-top-strip'),'q-top-strip-80').active);
  child(child(fillersItem(s.mod,s.ops),'q-top-strip'),'q-top-strip-0').run!();
  assert.equal(s.mod.topStrip,undefined);
});

test('(в) фальш к стене: ширина планки меняется, только если фальш уже стоит (как поле панели)',()=>{
  const m=wardrobe();m.wallFiller={right:{kind:'edge',width:RULES.fillerStrip}};
  const s=spy(m);const it=fillersItem(s.mod,s.ops);
  const wall=child(it,'q-wall-right');
  assert.ok(!it.children!.some(c=>c.id==='q-wall-left'));
  assert.deepEqual(wall.children!.map(c=>c.label),[`${RULES.wallFillerMin} мм`,'80 мм','100 мм','120 мм',`${RULES.wallFillerMax} мм`]);
  child(wall,'q-wall-right-120').run!();
  assert.deepEqual(s.mod.wallFiller,{right:{kind:'edge',width:120}});
  assert.deepEqual(validate(s.mod),[]);
});

test('(в) «Фальши» в кольце корпуса после «Цоколь / ножки»; в App пункты двери подключены в меню фасада',()=>{
  const m=wardrobe(),s=spy(m);
  assert.deepEqual(quickItems(m,m.sections[0].id,s.ops).map(i=>i.id),['q-section','q-back','q-base','q-fillers','q-light']);
  const app=readFileSync(new URL('../src/App.tsx',import.meta.url),'utf8');
  assert.equal(app.match(/\.\.\.doorQuickItems\(mod,c\.sid,quickOps\)/g)?.length,2,'меню двери и «Фасады ›» корпуса');
});
