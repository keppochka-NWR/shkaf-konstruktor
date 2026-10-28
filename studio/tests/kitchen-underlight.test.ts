// Подсветка рабочей зоны под навесными кухонными модулями (28.10.2026): LED снизу дна у переднего края, горизонталь 4000 ₽/пог.м
// клиенту (решение Макса 20.10), блок питания — отдельной строкой (27.10), включение у модуля и всем навесным ряда.
import test from 'node:test';
import assert from 'node:assert/strict';
import {initialModule,validate,parts,parseModule,RULES} from '../src/model';
import {kitchenWall,kitchenBase} from '../src/kitchen';
import {newProject,parseProject,projectErrors,type Project} from '../src/project';
import {createKitchenRow} from '../src/ModulePalette';
import {estimate} from '../src/pricing';
import {setUnderLight,UNDER_LIGHT_ID} from '../src/kitchenUnderLight';
import {setRowUnderLight,wallRowIds} from '../src/kitchenUnderLightRow';
import {lightSummary} from '../src/lights';
import {describeModule} from '../src/quoteDescribe';
import {partCollisions} from '../src/collisions';

const row=():Project=>({...newProject(),room:{...newProject().room,width:3000},modules:createKitchenRow(2400,initialModule())});
const led=(m:ReturnType<typeof initialModule>)=>parts(m).find(p=>p.id===UNDER_LIGHT_ID);

test('деталь: у навесного под дном у передней кромки, по ширине проёма −20 с краёв; без флага — нет',()=>{
  const m=kitchenWall(initialModule(),600);
  assert.equal(led(m),undefined,'по умолчанию подсветки нет');
  setUnderLight(m,true);assert.deepEqual(validate(m),[]);
  const l=led(m)!,bottom=parts(m).find(p=>p.id==='bottom')!;
  assert.equal(l.role,'light');assert.equal(l.length,600-2*16-40);assert.equal(l.size[0],528);
  assert.ok(Math.abs(l.position[1]+l.size[1]/2-(bottom.position[1]-bottom.size[1]/2))<1e-9,'верх профиля — нижняя пласть дна');
  assert.ok(Math.abs(l.position[2]+l.size[2]/2-(bottom.position[2]+bottom.size[2]/2-20))<1e-9,'20 мм от передней кромки дна');
  assert.equal(l.position[0],300);
  assert.equal(partCollisions(parts(m),m).some(c=>c.names.some(n=>/рабочей зоны/.test(n))),false,'LED ничего не пересекает (фасад, навесы, дно)');
  // тип модуля (накладной профиль) — сечение как у прочей подсветки
  m.lightType='surface';assert.deepEqual([led(m)!.size[2],led(m)!.size[1]],[RULES.lightSurfaceW,RULES.lightSurfaceT]);
  setUnderLight(m,false);assert.equal(led(m),undefined);assert.equal('underLight' in m.kitchen!,false);
});

test('только навесной: у нижнего — отказ и ошибка проверки',()=>{
  const b=kitchenBase(initialModule(),600);
  assert.throws(()=>setUnderLight(b,true),/только у навесного/);
  b.kitchen={...b.kitchen!,underLight:true};assert.ok(validate(b).some(e=>/Подсветка рабочей зоны — только у навесного/.test(e)));
  assert.equal(led(b),undefined);
});

test('смета: строка «Подсветка рабочей зоны под навесными» 4000 ₽/пог.м (розница), блок питания — отдельной строкой',()=>{
  const p=row(),w=p.modules.find(a=>a.module.kitchen?.role==='wall')!;
  const q=setRowUnderLight(p,w.id,true,false);assert.deepEqual(projectErrors(q),[]);
  const e=estimate(q),l=e.lines.find(x=>x.id==='light-under')!;
  assert.ok(l,'строка подсветки');assert.match(l.label,/Подсветка рабочей зоны под навесными/);
  assert.equal(l.unitPrice,RULES.shelfLightRetailPerM);assert.equal(l.unitPrice,4000);assert.equal(l.retail,true);
  assert.equal(l.quantity,(w.module.width-72)/1000);
  const psu=e.lines.find(x=>x.id==='light-psu')!;assert.equal(psu.quantity,1,'блок питания поставлен сам — один');
  // без подсветки — ни строки, ни блока
  const none=estimate(p).lines;assert.equal(none.some(x=>x.id==='light-under'||x.id==='light-psu'),false);
  // КП: горизонталь «рабочей зоны под навесными»
  const m=q.modules.find(a=>a.id===w.id)!.module;
  assert.equal(lightSummary(m).horizontal.where,'рабочей зоны под навесными');
  assert.ok(describeModule(m).filling.some(f=>/подсветка рабочей зоны под навесными/.test(f)));
});

test('всем навесным ряда: у каждого LED, блок питания — один на ряд; снятие убирает и блок',()=>{
  const p=row(),first=p.modules.find(a=>a.module.kitchen?.role==='wall')!,ids=wallRowIds(p,first.id);
  assert.equal(ids.length,4);
  const q=setRowUnderLight(p,ids[2],true);
  const walls=q.modules.filter(a=>ids.includes(a.id));
  assert.ok(walls.every(a=>a.module.kitchen!.underLight));assert.equal(walls.filter(a=>a.module.lightPsu).length,1);
  assert.equal(q.modules.find(a=>a.id===ids[0])!.module.lightPsu,true,'блок — у крайнего левого');
  const e=estimate(q),total=walls.reduce((s,a)=>s+a.module.width-72,0)/1000;
  assert.ok(Math.abs(e.lines.find(x=>x.id==='light-under')!.quantity-total)<1e-9);assert.equal(e.lines.find(x=>x.id==='light-psu')!.quantity,1);
  const off=setRowUnderLight(q,ids[0],false);
  assert.ok(off.modules.every(a=>!a.module.kitchen?.underLight&&!a.module.lightPsu));
  // нижние и столешница не тронуты
  for(const a of p.modules.filter(x=>!ids.includes(x.id)))assert.deepEqual(q.modules.find(x=>x.id===a.id),a);
});

test('сохранение и загрузка; шкафы студии без изменений',()=>{
  const m=kitchenWall(initialModule(),800);setUnderLight(m,true);
  assert.equal(parseModule(JSON.parse(JSON.stringify(m))).kitchen!.underLight,true);
  const r0=row(),p=setRowUnderLight(r0,r0.modules[1].id,true);
  const loaded=parseProject(JSON.parse(JSON.stringify(p)));
  assert.deepEqual(loaded.modules.map(a=>!!a.module.kitchen?.underLight),p.modules.map(a=>!!a.module.kitchen?.underLight));
  // шкаф (не кухня): ни детали, ни строки
  const wardrobe=initialModule();
  assert.equal(parts(wardrobe).some(x=>x.id===UNDER_LIGHT_ID),false);
  assert.equal(estimate(newProject(wardrobe)).lines.some(x=>x.id==='light-under'),false);
});
