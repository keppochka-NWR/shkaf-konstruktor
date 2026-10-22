// КП понятнее (менеджеры 22.10.2026, п. 9): карточки изделий с миниатюрой, «что внутри» простыми словами, образцы материалов,
// цена по изделиям (переключатель offer.itemPrices), «входит / не входит», без закупочных цен.
import test from 'node:test';
import assert from 'node:assert/strict';
import {estimate} from '../src/pricing';
import {quoteHTML} from '../src/exports';
import {modulePrices} from '../src/itemPrices';
import {plainFeatures} from '../src/quoteDescribe';
import {moduleThumbSVG} from '../src/quoteThumb';
import {newProject,type Project} from '../src/project';
import {initialModule} from '../src/model';
import {createKupeWardrobe} from '../src/ModulePalette';

const two=():Project=>{const p=newProject();p.modules[0].module.sections[0].drawers=2;p.modules.push({...structuredClone(p.modules[0]),id:'m2',x:1300});p.modules[1].module.width=1000;return p;};

test('КП: карточка на каждое изделие — миниатюра вида спереди, размеры, что внутри, материалы с образцом',()=>{
  const p=two(),e=estimate(p),html=quoteHTML(p,'Клиент',String(e.retail),'',undefined,{cost:e,items:modulePrices(p,e.retail)});
  assert.equal(html.match(/class="q-item"/g)?.length,2);
  assert.equal(html.match(/<div class="q-thumb"><svg /g)?.length,2,'миниатюры');
  assert.ok(html.includes('Состав заказа')&&html.includes('Входит в стоимость')&&html.includes('Не входит'));
  assert.ok(html.includes('доставка')&&html.includes('монтаж (сборка и установка)'));
  assert.ok(/class="sw" style="background-color:#[0-9a-f]{6}"/.test(html),'образец цвета без текстуры');
  assert.ok(html.includes('петли GTV с доводчиком'),'петли простыми словами');
  assert.ok(/2 ящика на шариковых направляющих, с доводчиком/.test(html),'ящики и направляющие');
  assert.ok(html.includes('ручки: '),'ручки');
  // без закупки и служебных слов
  for(const bad of ['закуп','Себестоимость','коэффициент','ФАМ','Мега-Трейд'])assert.ok(!html.includes(bad),bad);
});

test('КП: цены по изделиям — по умолчанию да, сумма = цене КП; выключатель и скидка',()=>{
  const p=two(),e=estimate(p),items=modulePrices(p,e.retail)!;
  const html=quoteHTML(p,'Клиент',String(e.retail),'',undefined,{cost:e,items});
  for(const v of items)assert.ok(html.includes(`<span class="q-price">${v.toLocaleString('ru-RU')} ₽</span>`));
  const off=quoteHTML({...p,offer:{customer:'',price:'',notes:'',itemPrices:false}},'Клиент',String(e.retail),'',undefined,{cost:e,items});
  assert.ok(!off.includes('class="q-price"'),'выключено — только итог');
  // цена КП со скидкой — доли от неё же (сумма сходится), иначе цены изделий не печатаются
  const disc=e.retail!-1000,di=modulePrices(p,disc)!;assert.equal(di.reduce((s,v)=>s+v,0),disc);
  assert.ok(quoteHTML(p,'',String(disc),'',undefined,{cost:e,items:di}).includes('class="q-price"'));
  assert.ok(!quoteHTML(p,'',String(disc),'',undefined,{cost:e,items}).includes('class="q-price"'),'доли не от этой цены — не печатаем');
  assert.ok(!quoteHTML(p,'','','',undefined,{items}).includes('class="q-price"'),'без цены — без цен изделий');
});

test('КП: push-to-open и купе простыми словами; миниатюра купе',()=>{
  const p=newProject();p.modules[0].module.doorOpen='push';
  assert.ok(plainFeatures(p.modules[0].module).some(x=>x.startsWith('открывание нажатием (push-to-open)')));
  const k=createKupeWardrobe(2400,2400,600,initialModule())[0].module;
  assert.deepEqual(plainFeatures(k),[]);
  assert.ok(moduleThumbSVG(k).startsWith('<svg'));
});
