// Раунд 2 критика релиза 22.10: K1 (подсветки у кухни пока нет — честные подписи), K7 (низ ряда навесных — значение ряда).
// K8 (Esc в «Наполнении») — логика в App.escapeStep, проверяется сценарием scripts/rel-fix-k178-scenario.ts.
import test from 'node:test';
import assert from 'node:assert/strict';
import {initialModule} from '../src/model';
import {createKitchenRow} from '../src/ModulePalette';
import {newProject,projectErrors,applyAutoFillers,type Project,type PlacedModule} from '../src/project';
import {setWallFloor,wallRow,wallRowFloor} from '../src/kitchenProject';
import {lightUnavailable,quickMenuApplies} from '../src/quickMenu';
import {categoryHint} from '../src/SettingsTree';

/** Кухня прямая 3000 от левой стены (место под автофальшь 16 + 5), один навесной на 8 мм ниже ряда. */
function kitchen():{p:Project;walls:PlacedModule[]}{
  const p=newProject();p.room={...p.room,width:4000,depth:3000,height:2700};
  p.modules=createKitchenRow(3000,initialModule()).map(a=>({...a,x:a.x+21}));
  const walls=p.modules.filter(a=>a.module.kitchen?.role==='wall');
  walls[0].y=(walls[0].y??0)-8;
  return {p,walls};
}

test('K1: подзаголовок «Наполнения» обещает подсветку, только если раздел «Подсветка» есть; у кухни — свой',()=>{
  assert.match(categoryHint('Наполнение',['Полки','Ящики','Подсветка']),/подсветка/);
  assert.doesNotMatch(categoryHint('Наполнение',['Полки','Ящики и бутылочницы']),/подсветк/i);
  assert.equal(categoryHint('Наполнение',['Полки'],{'Наполнение':'Полки, ящики и бутылочницы'}),'Полки, ящики и бутылочницы');
  assert.equal(categoryHint('Фасады и открывание',['Ручки']),'Фасады, ручки, петли и способ открывания');
});

test('K1: режим выбора деталей подсветки — у кухни «в следующей версии», не «не ставится»',()=>{
  const k=createKitchenRow(3000,initialModule()),base=k.find(a=>a.module.kitchen?.role==='base')!.module,worktop=k.find(a=>a.module.worktop)?.module;
  assert.equal(quickMenuApplies(base),false);
  for(const m of [base,...(worktop?[worktop]:[])]){const t=lightUnavailable(m);assert.match(t,/Подсветка кухни — в следующей версии/);assert.doesNotMatch(t,/не ставится/);}
  assert.doesNotMatch(lightUnavailable({...initialModule(),kupe:{} as never}),/не ставится/);
});

test('K7: «Низ ряда навесных» — значение ряда; разные — список значений; ввод выравнивает весь ряд',()=>{
  const {p,walls}=kitchen();
  assert.deepEqual(projectErrors(applyAutoFillers(p)),[],'исходная кухня без ошибок');
  // выбран навесной НЕ из «низкого»: ряд — все 5 навесных, значения разные
  const r=wallRowFloor(p,walls[1].id);
  assert.equal(wallRow(p,walls[1].id).length,walls.length);
  assert.equal(r.y,null);assert.deepEqual(r.values,[1450,1458]);
  const q=setWallFloor(p,walls[1].id,1458,true);
  assert.deepEqual([...new Set(q.modules.filter(a=>a.module.kitchen?.role==='wall').map(a=>a.y))],[1458],'весь ряд на 1458');
  assert.deepEqual(projectErrors(applyAutoFillers(q)),[]);
  assert.deepEqual(wallRowFloor(q,walls[0].id),{y:1458,values:[1458]});
  // ровный ряд — как раньше: все навесные сдвигаются вместе, нижние на месте
  const up=setWallFloor(q,walls[2].id,1500,true);
  assert.ok(up.modules.filter(a=>a.module.kitchen?.role==='wall').every(a=>a.y===1500));
  assert.deepEqual(up.modules.filter(a=>a.module.kitchen?.role!=='wall').map(a=>a.y),q.modules.filter(a=>a.module.kitchen?.role!=='wall').map(a=>a.y));
  // без row — только сам модуль
  const one=setWallFloor(q,walls[2].id,1500);
  assert.deepEqual(one.modules.filter(a=>a.module.kitchen?.role==='wall'&&a.y===1500).map(a=>a.id),[walls[2].id]);
  // нижний модуль — не навесной: ряда нет
  const base=p.modules.find(a=>a.module.kitchen?.role==='base')!;
  assert.deepEqual(wallRow(p,base.id),[]);
});

test('K7: антресоль на навесном едет со своим навесным; навесной у другой стены — не в ряду',()=>{
  const {p,walls}=kitchen(),w=walls[1];
  const antresol:PlacedModule={...structuredClone(w),id:'antresol',y:(w.y??0)+w.module.height,module:{...structuredClone(w.module),height:350,kitchen:{...w.module.kitchen!,role:'antresol'}}};
  const far:PlacedModule={...structuredClone(walls[2]),id:'far',z:(walls[2].z??0)+900};
  const p2={...p,modules:[...p.modules,antresol,far]};
  assert.ok(!wallRow(p2,w.id).some(a=>a.id==='far'),'навесной в 900 мм от стены — не ряд');
  const q=setWallFloor(p2,walls[0].id,1500,true);
  const a2=q.modules.find(a=>a.id==='antresol')!;
  assert.equal(a2.y,1500+w.module.height,'антресоль на навесном поднялась вместе с ним');
  assert.equal(q.modules.find(a=>a.id==='far')!.y,far.y,'навесной вне ряда на месте');
});
