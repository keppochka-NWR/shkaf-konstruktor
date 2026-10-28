import test from 'node:test';
import assert from 'node:assert/strict';
import {estimate} from '../src/pricing';
import {newProject,parseProject,type Project} from '../src/project';
import {createKitchenRow} from '../src/ModulePalette';
import {initialModule,validate,parts,drawerConfig,falshZones,falshSupportErrors,slideSupport,FALSH_HINGE_SPARE,FALSH_SLIDE_SUPPORT_MIN} from '../src/model';
import {partPenetration} from '../src/collisions';
import {kitchenBase} from '../src/kitchen';
import {layoutKitchenDrawers,setKitchenDrawerCount} from '../src/kitchenEditing';
import {kitchenDrawerErrors} from '../src/kitchenDrawers';
import {quoteHTML,PENDING_INCLUDED_NOTE} from '../src/exports';
import {pendingTotalLabel} from '../src/pendingPrices';

// Ревью Codex 16.10.2026 (shop-release 5bd8335), сценарии воспроизведения .qa/review-*.ts — регрессионные тесты R3, R4, R6.

test('R6: строка о неоценённых позициях в КП — по статусу комплектации, скидка её не убирает; закрыть — только явной отметкой',()=>{
  const p:Project={...newProject(),modules:createKitchenRow(3000,initialModule())},k=estimate(p);
  // 5: навесы и заглушки с 27.10.2026 с ценой Макса (комплект 120 ₽), не финальный расчёт
  assert.equal(k.pending.length,5);
  const note=pendingTotalLabel(5);
  assert.ok(quoteHTML(p,'Client',String(k.retail),'',undefined,{cost:k}).includes(note),'цена = смете');
  assert.ok(quoteHTML(p,'Client',String(k.retail!-1000),'',undefined,{cost:k}).includes(note),'скидка 1000 ₽ — строка остаётся');
  assert.ok(quoteHTML(p,'Client','',' ',undefined,{cost:k}).includes(note),'цена «после согласования» — строка остаётся');
  // явное действие менеджера: цена КП включает эти позиции — вместо счётчика печатается отметка
  const closed={...p,offer:{customer:'Client',price:String(k.retail!+5000),notes:'',pendingIncluded:true}};
  const html=quoteHTML(closed,'Client',closed.offer.price,'',undefined,{cost:k});
  assert.ok(!html.includes(note)&&html.includes(PENDING_INCLUDED_NOTE));
  assert.equal(parseProject(JSON.parse(JSON.stringify(closed))).offer!.pendingIncluded,true,'отметка переживает сохранение');
  assert.throws(()=>parseProject(JSON.parse(JSON.stringify({...closed,offer:{...closed.offer,pendingIncluded:'да'}}))));
  // без неоценённых позиций строки нет
  const w=newProject(),e=estimate(w);assert.equal(e.pending.length,0);
  assert.ok(!quoteHTML(w,'Client',String(e.retail),'',undefined,{cost:e}).includes('Позиции после'));
});
// ---- R3 (кухонный «Зазор 30 мм») снят решением Макса 18.10.2026: на кухне зазора нет — вместо него профиль Gola
test('R3: на кухне зазора 30 мм нет — kdrawerGrip из старого файла отбрасывается, проверка и детали как без зазора (на кухне — Gola)',()=>{
  for(const [H,n,sys] of [[762,4,'axis-pro'],[720,4,'firmax-ldsp'],[762,4,'versalite-h45']] as const){
    const m=kitchenBase(initialModule(),600);m.height=H;setKitchenDrawerCount(m,n);m.kdrawers=layoutKitchenDrawers(m,n,undefined,sys);
    assert.deepEqual(validate(m),[]);
    const p0=newProject(),old=parseProject(JSON.parse(JSON.stringify({...p0,modules:[{...p0.modules[0],module:{...m,kdrawerGrip:true}}]}))).modules[0].module;
    assert.equal('kdrawerGrip' in old,false);assert.deepEqual(validate(old),[]);assert.deepEqual(parts(old),parts(m),`${sys} H${H}`);
    assert.deepEqual(kitchenDrawerErrors(old),[]);
  }
});
// ---- R4: опора направляющей у составного фальша (сценарий .qa/review-falsh-support.ts: ящики 120, «Зазор 30 мм»)
test('R4: разрыв фальша у петли — только в зоне петли спереди; сзади вставка держит направляющую, проверка опоры в validate',()=>{
  const m=initialModule(),s=m.sections[0];
  s.drawerConfigs=Array.from({length:s.drawers},(_,i)=>({...drawerConfig(m,s,i),height:120}));s.drawerGrip=true;
  assert.deepEqual(validate(m),[]);assert.deepEqual(falshSupportErrors(m),[]);
  const ps=parts(m),zone=falshZones(m)[s.id+':left'];assert.ok(zone?.length,'петля в зоне ящиков — составной фальш');
  const plate=ps.find(p=>/:hingeplate:0:0$/.test(p.id))!,plateRear=plate.position[2]-plate.size[2]/2;
  assert.equal(zone[0].z,Math.floor(plateRear-FALSH_HINGE_SPARE),'граница зоны — задняя грань планки петли минус запас');
  const inserts=ps.filter(p=>new RegExp(`^${s.id}:filler:left:[ab]:r\\d+$`).test(p.id));assert.equal(inserts.length,2,'вставка за петлёй в обеих плитах');
  for(const p of inserts){assert.ok(Math.abs(p.position[2]+p.size[2]/2-zone[0].z)<0.01,'вставка до зоны петли');assert.ok(partPenetration(plate,p)<=0.1,'вставка не задевает планку петли');}
  const slide=ps.find(p=>p.id===`${s.id}:drawer:0:slide:0`)!,b=ps.filter(p=>p.id.startsWith(`${s.id}:filler:left:b:`));
  assert.ok(slideSupport(slide,b)>=FALSH_SLIDE_SUPPORT_MIN,'нижняя левая направляющая (Y133,5–178,5) опирается на вставку');
  // прежняя геометрия (разрыв на всю глубину, плиты с Y180) — опоры нет, проверка это ловит
  assert.equal(slideSupport(slide,b.filter(p=>!/:r\d+$/.test(p.id))),0);
  // склейка в смете — по площади обеих частей плиты у боковины
  const e=estimate({...newProject(),modules:[{...newProject().modules[0],module:m}]});
  const glue=e.lines.find(l=>/склейк/i.test(l.label));assert.ok(glue,'строка склейки');
  const area=ps.filter(p=>/:filler:(left|right):a:r?\d+$/.test(p.id)).reduce((a,p)=>a+p.length*p.width/1e6,0);
  assert.ok(Math.abs(glue!.quantity-Math.round(area*1000)/1000)<0.002,`склейка ${glue!.quantity} м² = площадь ${area}`);
});
