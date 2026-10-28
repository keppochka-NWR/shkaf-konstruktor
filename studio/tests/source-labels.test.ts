// Критик 28.10.2026: подписи источников цены с закупочными сведениями («старый калькулятор 90 ₽», «Оценка по классу DTC/Unihopper
// (1000–1250)», «1729 ₽ (розница allpremial.ru …)», «в прайсе 9000 ₽ — цена продажи») попадали в JS публичной сборки: запекание
// (bake-prices.ts) меняло числа, но не тексты. Теперь плагин public-build вырезает такие литералы, страж price-guard их ищет в сборке.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {isSensitive,sanitizeEdits,applyEdits,SENSITIVE_SOURCES} from '../scripts/public-build';
import {findSourceLeaks} from '../scripts/price-guard';

const LEAKS=[
  'Толкатель push-to-open (старый калькулятор 90 ₽); подтвердить счётом',
  'Оценка по классу DTC/Unihopper (1000–1250); подтвердить счётом',
  'Оценка по классу Unihopper (1000–1250 ₽); цены в счетах нет, подтвердить',
  'Оценка: Premial Morendo с доводчиком 400 мм — 1729 ₽ (розница allpremial.ru, 10.2026), ±60 ₽ на 50 мм',
  'GTV: пантограф — цена после финального расчёта конструктором (в прайсе 9000 ₽ — цена продажи)',
  'Закупочная цена не найдена; 9000 ₽ в прайсе — цена продажи',
  'Как штанга D25 (старый калькулятор: 300 ₽/м); закупку подтвердить',
  'Интерполяция прайса (250 — 445, 350 — 550); подтвердить счётом',
];
// видимые клиенту тексты, которые трогать нельзя
const CLIENT=['Торцевая ручка — 2 ₽ за мм длины','Нет цены в прайсе для этого сочетания серии и покрытия','ПЭТ не патинируется (в прайсе патина — для ПВХ и эмали)',
  'Лифт газовый Premial АДАЖИО 80N (стандартный) — 2 шт на фасад','Подсветка в полках — 4000 ₽/пог.м','Ширина 300–1200 мм','allpremial.ru/catalog/gazlifty-premial/58860/'];

test('подписи источников с ценой/закупкой распознаются, клиентские тексты — нет',()=>{
  for(const s of LEAKS)assert.ok(isSensitive(s),s);
  for(const s of CLIENT)assert.ok(!SENSITIVE_SOURCES.test(s),s);
});

test('публичная сборка: литерал источника вырезается, страж находит его в несобранном коде и не находит после',()=>{
  const code=LEAKS.map((s,i)=>`const s${i}={price:${i+1},source:${JSON.stringify(s)}};`).join('\n')+'\nconst ok={source:"Торцевая ручка — 2 ₽ за мм длины"};';
  assert.ok(findSourceLeaks(code).length>=LEAKS.length-1);
  const clean=applyEdits(code,sanitizeEdits(code,'pricing.js'));
  assert.deepEqual(findSourceLeaks(clean),[]);
  assert.match(clean,/Торцевая ручка — 2 ₽ за мм длины/);
});

test('исходники сметы: каждая подпись-утечка из списка критика есть в src и будет вырезана (нет «тихих» вариантов без маркера)',()=>{
  const src=['pricing.ts','pendingPrices.ts'].map(f=>readFileSync(new URL('../src/'+f,import.meta.url),'utf8')).join('\n');
  const literals=[...src.matchAll(/'([^'\n]*?(?:старый калькулятор|Оценка по классу|allpremial\.ru,|цена продажи)[^'\n]*)'/gi)].map(m=>m[1]);
  assert.ok(literals.length>=5,'подписи найдены: '+literals.length);
  for(const s of literals)assert.ok(isSensitive(s),s);
});
