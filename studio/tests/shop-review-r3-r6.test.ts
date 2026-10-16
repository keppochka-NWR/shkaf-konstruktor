import test from 'node:test';
import assert from 'node:assert/strict';
import {estimate} from '../src/pricing';
import {newProject,parseProject,type Project} from '../src/project';
import {createKitchenRow} from '../src/ModulePalette';
import {initialModule,validate,parts,type Module} from '../src/model';
import {kitchenBase} from '../src/kitchen';
import {layoutKitchenDrawers,setKitchenDrawerCount} from '../src/kitchenEditing';
import {gripKDrawers,kdrawerGripErrors,kitchenDrawerErrors,axisTop,type VersaliteDrawer} from '../src/kitchenDrawers';
import {quoteHTML,PENDING_INCLUDED_NOTE} from '../src/exports';
import {pendingTotalLabel} from '../src/pendingPrices';

// Ревью Codex 16.10.2026 (shop-release 5bd8335), сценарии воспроизведения .qa/review-*.ts — регрессионные тесты R3, R4, R6.

test('R6: строка о неоценённых позициях в КП — по статусу комплектации, скидка её не убирает; закрыть — только явной отметкой',()=>{
  const p:Project={...newProject(),modules:createKitchenRow(3000,initialModule())},k=estimate(p);
  assert.equal(k.pending.length,7);
  const note=pendingTotalLabel(7);
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
// ---- R3: «Зазор 30 мм» у кухонных ящиков — проверяется итоговая геометрия (сценарии .qa/review-grip.ts, review-grip-guides.ts)
const kgrip=(H:number,n:number,sys:'axis-pro'|'firmax-ldsp'|'versalite-h45')=>{const m=kitchenBase(initialModule(),600);m.height=H;setKitchenDrawerCount(m,n);m.kdrawers=layoutKitchenDrawers(m,n,undefined,sys);assert.deepEqual(validate(m),[],'без зазора — ящики собираются');m.kdrawerGrip=true;return m;};
test('R3: Axis PRO 4 ящика H762 — царги ниже фасада на 30 нет: «Зазор 30 мм» отклоняется понятной ошибкой, старый короб не остаётся молча',()=>{
  const m=kgrip(762,4,'axis-pro'),v=validate(m);
  assert.ok(v.some(e=>/Ящик \d: «Зазор между ящиками 30 мм» невозможен — нет царги Axis PRO/.test(e)),v.join('\n'));
  assert.ok(kdrawerGripErrors(m).length>0);
  // 3 ящика H762 — возможно: каждый короб под верхом своего фасада не менее 30 и ниже прежнего на 30
  const ok=kgrip(762,3,'axis-pro');assert.deepEqual(validate(ok),[]);
  gripGaps(ok);
});
test('R3: Firmax 4 ящика H720 — боковины ниже 60 мм: отклоняется (было 1,5–3 мм вместо 30)',()=>{
  const m=kgrip(720,4,'firmax-ldsp'),v=validate(m);
  assert.ok(v.some(e=>/«Зазор между ящиками 30 мм» невозможен — боковины короба/.test(e)),v.join('\n'));
  const ok=kgrip(820,4,'firmax-ldsp');assert.deepEqual(validate(ok),[]);gripGaps(ok);
});
test('R3: Versalite 4 ящика H762 — направляющая переносится с боковиной (середина новой боковины), итоговая геометрия без ошибок',()=>{
  const m=kgrip(762,4,'versalite-h45');assert.deepEqual(validate(m),[]);
  const ks=gripKDrawers(m) as VersaliteDrawer[];assert.deepEqual(kitchenDrawerErrors({...m,kdrawers:ks}),[]);
  gripGaps(m);
  const ps=parts(m);
  for(const [i,k] of ks.entries()){
    assert.equal(k.runnerY,Math.round((k.box.y+k.box.h/2)*10)/10,'ось направляющей — середина боковины');
    assert.ok(k.runnerY-22.5>=k.box.y-0.01&&k.runnerY+22.5<=k.box.y+k.box.h+0.01,`ящик ${i+1}: направляющая H45 в пределах боковины ${k.box.y}–${k.box.y+k.box.h}`);
    for(const lr of ['L','R']){const slide=ps.find(p=>p.id===`kd:${i}:slide:${lr}`)!;
      assert.equal(slide.position[1],k.runnerY,'деталь направляющей построена по новому runnerY');
      assert.ok(slide.position[1]-slide.size[1]/2>=k.box.y-0.01&&slide.position[1]+slide.size[1]/2<=k.box.y+k.box.h+0.01,`ящик ${i+1}: габарит направляющей в пределах боковины`);}
  }
});
function gripGaps(m:Module){
  for(const [i,k] of gripKDrawers(m).entries()){const old=m.kdrawers![i];
    assert.ok(k.y1-axisTop(k)>=29.99,`ящик ${i+1}: верх короба на ${k.y1-axisTop(k)} ниже верха фасада`);
    assert.ok(axisTop(old)-axisTop(k)>=29.99,`ящик ${i+1}: короб ниже прежнего на ${axisTop(old)-axisTop(k)}`);}
}
