// Водопадные боковины столешницы из камня (барная стойка / остров, задача 28.10.2026): боковина толщиной столешницы во всю глубину,
// вниз от низа столешницы; площадь — в строке камня, стык под 45° — отдельной строкой без цены; только компакт/акрил/кварц.
import test from 'node:test';
import assert from 'node:assert/strict';
import {initialModule,validate,parts,parseModule} from '../src/model';
import {kitchenWorktop,setWorktopMaterial,waterfallArea} from '../src/kitchen';
import {newProject,parseProject,projectErrors,type Project} from '../src/project';
import {createKitchenRow} from '../src/ModulePalette';
import {estimate} from '../src/pricing';
import {details} from '../src/exports';
import {toggleWaterfall} from '../src/worktopWaterfall';
import {describeModule} from '../src/quoteDescribe';

const acrylic=(w=2400)=>{const m=kitchenWorktop(initialModule(),w);setWorktopMaterial(m,'acrylic',12);return m;};
/** Столешница на высоте 820 (низ над полом) — водопаду есть куда опускаться. */
const at820=(m:ReturnType<typeof acrylic>):Project=>{const p=newProject(m);p.modules[0].y=820;return p;};
/** Ряд кухни 2400 (низы + навесные + столешница) — сдвинут от левой стены на shift. */
const row=(shift=0):Project=>{const p:Project={...newProject(),room:{...newProject().room,width:3600},modules:createKitchenRow(2400,initialModule())};
  p.modules=p.modules.map(a=>({...a,x:a.x+shift}));const wt=p.modules.find(a=>a.module.worktop)!;setWorktopMaterial(wt.module,'acrylic',12);return p;};

test('детали: боковины 12 × drop × глубина под нижней пластью, по краям длины; без водопада — как было',()=>{
  const plain=acrylic(),before=parts(plain).map(p=>p.id);
  assert.ok(!before.some(id=>id.startsWith('worktop:waterfall')));
  const m=acrylic();m.worktop={...m.worktop!,waterfall:{left:true,right:true,drop:820}};
  assert.deepEqual(validate(m),[]);
  const ps=parts(m),L=ps.find(p=>p.id==='worktop:waterfall:left')!,R=ps.find(p=>p.id==='worktop:waterfall:right')!;
  for(const s of [L,R]){
    assert.deepEqual(s.size,[12,820,m.depth]);assert.equal(s.position[1],-410,'вниз от нижней пласти (y модуля < 0)');
    assert.equal(s.external,true,'не в раскрой ЛДСП');assert.deepEqual(s.edge,[0,0,0,0],'без кромки ЛДСП');assert.match(s.name,/водопад.*акрил.*12 мм/i);
  }
  assert.equal(L.position[0],6);assert.equal(R.position[0],2400-6);
  assert.equal(details(newProject(m)).length,0,'камень с боковинами — вне раскроя');
  // одна сторона
  const one=acrylic();one.worktop={...one.worktop!,waterfall:{right:true,drop:700}};
  assert.deepEqual(parts(one).filter(p=>p.id.startsWith('worktop:waterfall')).map(p=>p.id),['worktop:waterfall:right']);
});

test('смета: площадь боковин (drop + T) × глубина прибавлена к площади камня, стык под 45° — строка без цены «после финального расчёта»',()=>{
  const m=acrylic(),plain=estimate(at820(m)).lines;
  m.worktop={...m.worktop!,waterfall:{left:true,right:true,drop:820}};
  const lines=estimate(at820(m)).lines,area=lines.find(l=>l.id==='worktop:acrylic:12')!;
  const D=m.depth,expected=Math.round((2400*D+2*(820+12)*D)/1e4)/100;
  assert.equal(area.quantity,expected);assert.equal(waterfallArea(m),2*(820+12)*D/1e6);
  assert.equal(plain.find(l=>l.id==='worktop:acrylic:12')!.quantity,Math.round(2400*D/1e4)/100,'без водопада — прежняя площадь');
  assert.equal(area.unitPrice,null);assert.match(area.source,/финального расчёта/);
  const joint=lines.find(l=>l.id==='worktop:waterfall:acrylic:12')!;
  assert.ok(joint,'строка стыка');assert.equal(joint.unitPrice,null);assert.equal(joint.unit,'пог.м');assert.equal(joint.quantity,2*(D+820)/1000);
  assert.match(joint.source,/водопад.*финального расчёта/i);
  assert.equal(plain.some(l=>l.id.startsWith('worktop:waterfall')),false);
  assert.ok(describeModule(m).filling.some(f=>/водопад с двух сторон/.test(f)),'КП: водопад в описании');
});

test('только цельный материал: ЛДСП/постформинг — ошибка; смена материала на ЛДСП снимает водопад',()=>{
  const m=kitchenWorktop(initialModule(),2400);setWorktopMaterial(m,'postforming');
  m.worktop={...m.worktop!,waterfall:{left:true,drop:820}};
  assert.ok(validate(m).some(e=>/Водопад столешницы — только из цельного материала/.test(e)));
  assert.equal(parts(m).some(p=>p.id.startsWith('worktop:waterfall')),false,'у ЛДСП боковин не строим');
  const a=acrylic();a.worktop={...a.worktop!,waterfall:{left:true,drop:820}};
  setWorktopMaterial(a,'postforming');assert.equal(a.worktop!.waterfall,undefined);assert.deepEqual(validate(a),[]);
  const q=acrylic();q.worktop={...q.worktop!,waterfall:{left:true,drop:20}};assert.ok(validate(q).some(e=>/высота боковины 50–1500/.test(e)));
  const c=acrylic();c.worktop={...c.worktop!,cutouts:[{kind:'sink',x:5,width:500,depth:450}],waterfall:{left:true,drop:820}};
  assert.ok(validate(c).some(e=>/вырез заходит на боковину/.test(e)));
});

test('сохранение и загрузка: waterfall сохраняется, лишнее отбрасывается; проект целиком',()=>{
  const m=acrylic();m.worktop={...m.worktop!,waterfall:{left:true,drop:820}};
  assert.deepEqual(parseModule(JSON.parse(JSON.stringify(m))).worktop!.waterfall,{left:true,drop:820});
  const junk=JSON.parse(JSON.stringify(m));junk.worktop.waterfall={left:'да',right:false,drop:820};
  assert.equal(parseModule(junk).worktop!.waterfall,undefined,'без стороны — нет водопада');
  const p=row(500),id=p.modules.find(a=>a.module.worktop)!.id,q=toggleWaterfall(p,id,'right',true);
  const back=parseProject(JSON.parse(JSON.stringify(q))).modules.find(a=>a.id===id)!.module.worktop!;
  assert.deepEqual(back.waterfall,{right:true,drop:820});
});

test('проект: над низами столешница удлиняется на толщину в сторону водопада; у стены — понятная ошибка; ниже пола — ошибка',()=>{
  const p=row(500),wt=p.modules.find(a=>a.module.worktop)!;
  assert.deepEqual(projectErrors(p),[]);
  // правая сторона: под краем нижний корпус — столешница +12 вправо, начало на месте
  const r=toggleWaterfall(p,wt.id,'right',true),rw=r.modules.find(a=>a.id===wt.id)!;
  assert.equal(rw.module.width,2412);assert.equal(rw.x,wt.x);assert.deepEqual(projectErrors(r),[]);
  // левая: +12 влево
  const l=toggleWaterfall(r,wt.id,'left',true),lw=l.modules.find(a=>a.id===wt.id)!;
  assert.equal(lw.module.width,2424);assert.equal(lw.x,wt.x-12);assert.deepEqual(lw.module.worktop!.waterfall,{left:true,right:true,drop:820});
  assert.deepEqual(projectErrors(l),[]);
  // снятие — длина та же, боковины нет
  const off=toggleWaterfall(l,wt.id,'left',false),ow=off.modules.find(a=>a.id===wt.id)!;
  assert.equal(ow.module.width,2424);assert.deepEqual(ow.module.worktop!.waterfall,{right:true,drop:820});
  // столешница уже с запасом под боковину (длина задана менеджером) — длина не меняется
  const wide=structuredClone(p),ww=wide.modules.find(a=>a.id===wt.id)!;ww.module.width=2412;
  assert.equal(toggleWaterfall(wide,wt.id,'right',true).modules.find(a=>a.id===wt.id)!.module.width,2412);
  // ряд от левой стены: удлинить влево некуда — ошибка «за границы помещения»
  const atWall=row(0),aw=atWall.modules.find(a=>a.module.worktop)!;
  assert.throws(()=>toggleWaterfall(atWall,aw.id,'left',true),/границы помещения/);
  // ЛДСП — отказ с подсказкой
  const ld=row(500),lt=ld.modules.find(a=>a.module.worktop)!;setWorktopMaterial(lt.module,'postforming');
  assert.throws(()=>toggleWaterfall(ld,lt.id,'left',true),/только у цельной столешницы/);
  // высота боковины больше, чем до пола
  const low=structuredClone(r),lm=low.modules.find(a=>a.id===wt.id)!;lm.module.worktop!.waterfall!.drop=900;
  assert.ok(projectErrors(low).some(e=>/водопад ниже пола/.test(e)));
  // боковина внутри длины над корпусом — пересечение (проверка занятого места видит боковины)
  const clash=structuredClone(p),cm=clash.modules.find(a=>a.id===wt.id)!;cm.module.worktop={...cm.module.worktop!,waterfall:{right:true,drop:820}};
  assert.ok(projectErrors(clash).some(e=>/пересекается/.test(e)));
});
