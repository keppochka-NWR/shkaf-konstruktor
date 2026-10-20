import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {initialModule,validate,parts,parseModule} from '../src/model';
import {KITCHEN,kitchenWorktop,kitchenWall,setWorktopMaterial,worktopLabel,WORKTOP_CHOICES} from '../src/kitchen';
import {placeKitchenModule} from '../src/kitchenProject';
import {worktopMaterialItem} from '../src/addMenu';
import {newProject,parseProject,type Project} from '../src/project';
import {estimate} from '../src/pricing';
import {clientView} from '../src/clientPrices';
import {PENDING_CLIENT} from '../src/pendingPrices';
import {details,quoteHTML} from '../src/exports';
import {describeModule} from '../src/quoteDescribe';
import {createKitchenRow} from '../src/ModulePalette';
import {installSink} from '../src/installSink';

// Задача Макса 19.10.2026: столешницы 12 (компакт / акрил в один слой), 20 (кварц), 38 (ЛДСП постформинг), 40 (акрил с подклейкой).
const CASES=[
  {id:'compact-12',material:'compact',t:12,label:'компакт-плита'},
  {id:'acrylic-12',material:'acrylic',t:12,label:'акрил в один слой'},
  {id:'quartz-20',material:'quartz',t:20,label:'кварц'},
  {id:'postforming-38',material:'postforming',t:38,label:'постформинг'},
  {id:'acrylic-40',material:'acrylic',t:40,label:'акрил с подклейкой'},
] as const;
const row=():Project=>({...newProject(),room:{...newProject().room,width:3000},modules:createKitchenRow(2400,initialModule())});

test('выбор материала: пять вариантов, толщина и высота модуля — по материалу',()=>{
  assert.deepEqual(WORKTOP_CHOICES.map(c=>c.id),CASES.map(c=>c.id));
  for(const c of CASES){
    const m=kitchenWorktop(initialModule(),2400);setWorktopMaterial(m,c.material,c.t);
    assert.equal(m.worktop!.thickness,c.t,c.id);assert.equal(m.height,c.t,c.id);
    assert.equal(worktopLabel(m.worktop!),c.label,c.id);
    assert.deepEqual(validate(m),[],c.id);
    const w=parts(m).find(p=>p.id==='worktop')!;
    assert.equal(w.size[1],c.t,c.id+' толщина детали');assert.equal(w.thickness,c.t);
    assert.ok(w.name.includes(c.label)&&w.name.includes(c.t+' мм'),w.name);
    assert.deepEqual(w.edge,c.material==='postforming'?[0,0,2,0]:[0,0,0,0],c.id+' кромка ЛДСП только у постформинга');
    assert.equal(w.external,true,c.id+' не в раскрой ЛДСП');
    assert.equal(details(newProject(m)).length,0,c.id+' не в раскрое');
    // сохранение и загрузка
    assert.deepEqual(parseModule(JSON.parse(JSON.stringify(m))).worktop,m.worktop,c.id+' roundtrip');
  }
  // смена материала без явной толщины: компакт 12, кварц 20, акрил сохраняет подклейку, постформинг после камня — 38
  const m=kitchenWorktop(initialModule(),2400);
  setWorktopMaterial(m,'quartz');assert.equal(m.worktop!.thickness,20);
  setWorktopMaterial(m,'acrylic');assert.equal(m.worktop!.thickness,12);
  setWorktopMaterial(m,'acrylic',40);setWorktopMaterial(m,'acrylic');assert.equal(m.worktop!.thickness,40);
  setWorktopMaterial(m,'postforming');assert.equal(m.worktop!.thickness,KITCHEN.worktopThickness);
  setWorktopMaterial(m,'compact');assert.equal(m.height,12);
});

test('толщина фиксирована материалом: компакт 30 или кварц 38 — ошибка; постформинг — любая 12–60 как раньше',()=>{
  const m=kitchenWorktop(initialModule(),2400);
  m.worktop={...m.worktop!,material:'compact',thickness:30};m.height=30;assert.ok(validate(m).some(e=>/компакт-плита: толщина 12 мм/.test(e)));
  m.worktop={...m.worktop!,material:'quartz',thickness:38};m.height=38;assert.ok(validate(m).some(e=>/кварц: толщина 20 мм/.test(e)));
  m.worktop={...m.worktop!,material:'acrylic',thickness:20};m.height=20;assert.ok(validate(m).some(e=>/толщина 12 или 40 мм/.test(e)));
  m.worktop={...m.worktop!,material:'postforming',thickness:28};m.height=28;assert.deepEqual(validate(m),[]);
});

test('высота столешницы над полом, мойка и всё сверху — от толщины, не от 38',()=>{
  for(const c of CASES){
    const r=row(),p=installSink(r,r.modules.find(a=>a.module.kitchen?.appliance==='sink')!.id);
    const top=p.modules.find(a=>a.module.worktop)!;setWorktopMaterial(top.module,c.material,c.t);
    assert.equal(top.y,KITCHEN.baseHeight,'низ столешницы на нижних корпусах');
    const surface=(top.y??0)+top.module.height;assert.equal(surface,KITCHEN.baseHeight+c.t,c.id+' верх над полом');
    const sink=parts(top.module).find(x=>x.id.startsWith('premial-sink:'))!;assert.ok(sink,c.id+' мойка Premial стоит');
    assert.equal(Math.round((sink.position[1]-c.t)*10)/10,-108.5,c.id+' чаша от верха столешницы этой толщины, не от 38');
    assert.deepEqual(validate(top.module),[],c.id);
  }
});

test('смета: компакт/акрил/кварц — м² и обработка торца п.м, «после финального расчёта»; ЛДСП 38 — как раньше',()=>{
  for(const c of CASES){
    const m=kitchenWorktop(initialModule(),2400);setWorktopMaterial(m,c.material,c.t);
    const e=estimate(newProject(m)),ids=e.pending.map(l=>l.id);
    assert.equal(e.missing.length,0,c.id+' нет «нет цены»');
    if(c.material==='postforming'){
      assert.deepEqual(ids,['worktop:postforming:38']);
      const l=e.lines.find(x=>x.id==='worktop:postforming:38')!;assert.equal(l.quantity,2.4);assert.equal(l.unit,'пог.м');assert.equal(l.label,'Столешница постформинг 38 мм');
      assert.match(l.source,/^Премиал \(предварительно\)/);
      continue;
    }
    const key=c.material+':'+c.t,main=e.lines.find(x=>x.id==='worktop:'+key)!,edge=e.lines.find(x=>x.id==='worktop:edge:'+key)!;
    assert.ok(main&&edge,c.id);
    assert.equal(main.unit,'м²');assert.equal(main.quantity,1.44,c.id+' 2400 × 600 = 1,44 м²');
    assert.equal(edge.unit,'пог.м');assert.equal(edge.quantity,2.4);
    assert.ok(main.pending&&edge.pending,c.id+' pending');
    assert.match(main.source,/^Поставщик не указан — уточнить: столешница/);assert.match(edge.source,/обработка торца/);
    const text=JSON.stringify(e.lines);assert.ok(text.includes(c.label)&&text.includes(c.t+' мм'),c.id+' подпись материала и толщины');
    const cv=clientView(e);assert.ok(cv.pending.every(l=>l.source===PENDING_CLIENT));assert.ok(!JSON.stringify(cv.lines).includes('Поставщик'));
  }
});

test('смета кухни из двух кусков: м² суммируются, подпись без габарита одной детали (прямая 4800, Г 3000 + 1200)',()=>{
  // прямая 4800: createKitchenRow делит столешницу длиннее 4100 на два куска по 2400
  const p:Project={...newProject(),room:{...newProject().room,width:5400},modules:createKitchenRow(4800,initialModule())};
  const tops=p.modules.filter(a=>a.module.worktop);assert.equal(tops.length,2);
  for(const t of tops)setWorktopMaterial(t.module,'quartz',20);
  let l=estimate(p).lines.find(x=>x.id==='worktop:quartz:20')!;
  assert.equal(l.quantity,2.88);assert.equal(l.label,'Столешница кварц 20 мм');assert.ok(!/×/.test(l.label),l.label);
  const cv=clientView(estimate(p));assert.ok(cv.pending.filter(x=>x.label.startsWith('Столешница')).every(x=>!/×/.test(x.label)),'клиент — без габарита');
  // куски разной длины, как у Г-образной 3000 + 1200 (для сметы важны только размеры кусков)
  const a=kitchenWorktop(initialModule(),3000),b=kitchenWorktop(initialModule(),1200);setWorktopMaterial(a,'compact');setWorktopMaterial(b,'compact');
  const g:Project={...newProject(),room:{...newProject().room,width:4600},modules:[{id:'a',x:100,y:KITCHEN.baseHeight,z:0,rotation:0,module:a},{id:'b',x:3200,y:KITCHEN.baseHeight,z:0,rotation:0,module:b}]};
  l=estimate(g).lines.find(x=>x.id==='worktop:compact:12')!;
  assert.equal(l.quantity,2.52);assert.equal(l.label,'Столешница компакт-плита 12 мм');
  assert.equal(estimate(g).lines.find(x=>x.id==='worktop:edge:compact:12')!.quantity,4.2);
});

test('с компакта на старый материал — его обычная толщина: ЛДСП 16+16 → 32, камень и постформинг → 38',()=>{
  const m=kitchenWorktop(initialModule(),2400);
  setWorktopMaterial(m,'compact');setWorktopMaterial(m,'ldsp');assert.equal(m.worktop!.thickness,32);assert.equal(m.height,32);
  setWorktopMaterial(m,'ldsp');assert.equal(m.worktop!.thickness,32,'ЛДСП → ЛДСП без изменений');
  setWorktopMaterial(m,'acrylic');setWorktopMaterial(m,'stone');assert.equal(m.worktop!.thickness,KITCHEN.worktopThickness);
  m.worktop={...m.worktop!,material:'postforming',thickness:28};m.height=28;setWorktopMaterial(m,'ldsp');assert.equal(m.worktop!.thickness,28,'старое поведение между старыми материалами');
});

test('первый навесной ставится от фактической толщины столешницы: зазор 600 у компакта и кварца',()=>{
  for(const c of CASES){
    const r=row(),p={...r,modules:r.modules.filter(a=>a.module.kitchen?.role!=='wall')};
    setWorktopMaterial(p.modules.find(a=>a.module.worktop)!.module,c.material,c.t);
    const w=placeKitchenModule(p,kitchenWall(initialModule(),600)),wa=w.project.modules.find(x=>x.id===w.id)!;
    assert.equal(wa.y,KITCHEN.baseHeight+c.t+KITCHEN.wallGap,c.id);
  }
});

test('КП описывает материал и толщину',()=>{
  for(const c of CASES){
    const m=kitchenWorktop(initialModule(),2400);setWorktopMaterial(m,c.material,c.t);
    const d=describeModule(m);assert.ok(d.materials.some(s=>s.includes(c.label)&&s.includes(c.t+' мм')),c.id+' '+d.materials);
    assert.ok(d.size.endsWith('× '+c.t),d.size);
    const p=newProject(m),e=estimate(p);assert.ok(quoteHTML(p,'Клиент',String(e.retail),'',undefined,{cost:e}).includes(c.label),c.id+' в КП');
  }
});

test('меню правой кнопки по столешнице: «Материал столешницы ›» с пятью вариантами, пункт меняет толщину и высоту',()=>{
  const m=kitchenWorktop(initialModule(),2400);
  const n=structuredClone(m),item=worktopMaterialItem(m,u=>u(n));
  assert.equal(item.label,'Материал столешницы');
  assert.deepEqual(item.children!.map(i=>i.label),['Компакт 12','Акрил 12','Кварц 20','ЛДСП 38','Акрил 40']);
  assert.ok(item.children!.find(i=>i.label==='ЛДСП 38')!.active,'сейчас постформинг 38');
  item.children!.find(i=>i.id==='worktop-quartz-20')!.run!();assert.equal(n.worktop!.material,'quartz');assert.equal(n.height,20);
});

test('старый проект с постформингом 38 — без изменений (детали и смета)',()=>{
  const raw=JSON.parse(readFileSync(new URL('../reports/k08-manual-ui.project.json',import.meta.url),'utf8'));
  const p=parseProject(raw),top=p.modules.find(a=>a.module.worktop)!;
  assert.equal(top.module.worktop!.material,'postforming');
  const before=JSON.stringify(parts(top.module)),e=estimate(p),l=e.lines.find(x=>x.id.startsWith('worktop:postforming:'))!;
  assert.equal(l.unit,'пог.м');assert.ok(!e.lines.some(x=>x.id.startsWith('worktop:edge:')));
  assert.equal(JSON.stringify(parts(parseProject(raw).modules.find(a=>a.module.worktop)!.module)),before);
  assert.equal(parts(top.module).find(x=>x.id==='worktop')!.name,'Столешница постформинг '+top.module.worktop!.thickness+' мм');
});
