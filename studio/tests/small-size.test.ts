// Волна 29.10, правка 2: «убрать ограничения размеров на минимальную ширину и высоту до 100 мм». Корпус, модуль, секция — от 100;
// наполнение, которое в малый корпус физически не входит, снимается с сообщением (smallSize.ts), размер не запрещается.
import test from 'node:test';
import assert from 'node:assert/strict';
import {initialModule,parts,validate,RULES,minHeightOf,section,type Module} from '../src/model';
import {KITCHEN,kitchenBase} from '../src/kitchen';
import {createModule,paletteFitNotes,type ModuleKind} from '../src/paletteBuild';
import {paletteIssues} from '../src/paletteCheck';
import {fitSmallModule} from '../src/smallSize';
import {newProject,projectErrors} from '../src/project';
import {estimate} from '../src/pricing';
import {nest} from '../src/exports';
import {partCollisions} from '../src/collisions';
import {kupeErrors} from '../src/kupe';
import {createKupeModule} from '../src/paletteBuild';

const src=initialModule();
const KINDS:[ModuleKind,number][]=[['empty',550],['shelves',400],['wardrobe',600],['drawers',550],['hanging-drawer',400],['kitchen-wall',330]];

test('пределы: корпус, модуль и секция от 100 мм (было 250 × 250, ящичный 150, секция 180 внутри, кухня 150)',()=>{
  assert.equal(RULES.minW,100);assert.equal(RULES.minH,100);assert.equal(RULES.minDrawerModuleH,100);assert.equal(RULES.minSection,100-2*RULES.panel);assert.equal(KITCHEN.minWidth,100);
  assert.equal(minHeightOf(initialModule()),100);
  // нижний кухонный стоит на опорах (kitchenErrors) — корпус 100 над опорами 100
  assert.equal(minHeightOf(kitchenBase(initialModule(),600)),200);
  assert.ok(validate({...initialModule(),width:99}).some(e=>e.startsWith('Ширина: допустимо от 100')));
  assert.ok(validate({...initialModule(),height:99}).some(e=>e.startsWith('Высота: допустимо от 100')));
});

test('палитра 100 × 100: каждый вид собирается без ошибок; детали, пересечения, смета и раскрой — корректны',()=>{
  for(const [kind,depth] of KINDS){
    const m=createModule(kind,100,100,depth,src);
    assert.deepEqual(validate(m),[],kind);
    const ps=parts(m);
    assert.ok(ps.length>0,kind);
    for(const p of ps)assert.ok(p.size.every(v=>Number.isFinite(v)&&v>0)&&p.position.every(Number.isFinite),`${kind}: ${p.name} ${p.size}`);
    assert.deepEqual(partCollisions(ps,m).filter(c=>!c.bazis).map(c=>c.a+'×'+c.b),[],kind);
    const p=newProject(m);assert.deepEqual(projectErrors(p),[],kind);
    const e=estimate(p);assert.ok(Number.isFinite(e.retail)&&(e.retail??0)>0,`${kind}: смета ${e.retail}`);
    assert.ok(nest(p).length>=1,`${kind}: раскрой`);
  }
  // нижний кухонный — на опорах: 100 × 200
  const b=createModule('kitchen-base',100,200,557,src);assert.deepEqual(validate(b),[]);assert.ok(Number.isFinite(estimate(newProject(b)).retail));
});

test('малый корпус: что не входит — снимается с сообщением (двери, штанга, полки, ящики, цоколь), форма палитры без ошибок',()=>{
  const w=paletteFitNotes('wardrobe',100,100,600,src).join(' ');
  assert.match(w,/Цоколь снят/);assert.match(w,/Штанга снята/);assert.match(w,/Полки сняты/);
  assert.match(paletteFitNotes('empty',600,300,550,src).join(' '),/Двери сняты: распашной фасад \d+ мм ниже 360/);
  assert.match(paletteFitNotes('drawers',100,850,550,src).join(' '),/Ящики сняты: ящику нужно от 250 мм внутри/);
  assert.deepEqual(paletteFitNotes('wardrobe',1000,2200,600,src),[],'обычный размер — ничего не снимается');
  for(const [kind,depth] of KINDS)assert.deepEqual(paletteIssues({kind,width:100,height:100,depth},src).map(x=>x.text),[],kind);
});

test('смена размера модуля до 100 × 100 (как поле «Ширина»/«Высота»): не отказ, а снятое наполнение и сообщение',()=>{
  const m=createModule('wardrobe',1000,2200,600,src);m.sections[0].drawers=0;
  const n:Module={...structuredClone(m),width:100,height:100};
  const notes=fitSmallModule(n);
  assert.ok(notes.length>=3,notes.join(' '));
  assert.deepEqual(validate(n),[]);
  // две секции в 150 по корпусу не встают (по 51 внутри) — корпус одной секцией
  const two:Module={...initialModule(),width:150,sections:[section(),section()]};
  assert.match(fitSmallModule(two).join(' '),/Перегородки сняты/);assert.equal(two.sections.length,1);assert.deepEqual(validate(two),[]);
  // до 100 сужается и ящичный модуль — ящик снят, корпус остаётся
  const d=createModule('drawers',600,850,550,src),dn:Module={...structuredClone(d),width:100};
  assert.match(fitSmallModule(dn).join(' '),/Ящики сняты/);assert.deepEqual(validate(dn),[]);
});

test('пределы внешних поставщиков не снижены: двери купе (Аристо) — по системе; ALU — по СТП; Вернисаж — по паспорту',()=>{
  // двери купе: полотно и проём — по системе калькулятора купе, проём 100 × 100 по-прежнему не делается
  assert.throws(()=>createKupeModule(100,100,src));
  const k=createKupeModule(1600,2400,src);assert.deepEqual(kupeErrors(k),[]);
  // шкаф-купе: глубина от 450 (направляющие 100) — не размер корпуса, без изменений
  assert.ok(RULES.doorMinH===360,'створка шкафа от 360 — правило цеха (не снижено, дверь в низком корпусе снимается)');
});
