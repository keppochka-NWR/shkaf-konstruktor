import test from 'node:test';
import assert from 'node:assert/strict';
import {estimate} from '../src/pricing';
import {newProject,parseProject,type Project} from '../src/project';
import {createKitchenRow} from '../src/ModulePalette';
import {initialModule} from '../src/model';
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