import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {estimate,estimateCSV,decorPrice,kupeLdspPerM2,LDSP_SHEET_M2,MARKUP_DEFAULT} from '../src/pricing';
import {clientView} from '../src/clientPrices';
import {PENDING_CLIENT,pendingPrice,pendingTotalLabel} from '../src/pendingPrices';
import {quoteBreakdown,quoteHTML,splitRows} from '../src/exports';
import {salesCSV} from '../src/SalesSummary';
import {KUPE_FILLS} from '../src/kupeData';
import {kupeLines} from '../src/kupe';
import {newProject,type Project} from '../src/project';
import {initialModule} from '../src/model';
import {createKitchenRow,createKupeWardrobe} from '../src/ModulePalette';
import {layoutKitchenDrawers,setKitchenGola} from '../src/kitchenEditing';
import {installSink} from '../src/installSink';

// Решения Макса 16.10.2026 (studio/docs/РЕШЕНИЯ.md): позиции кухни без счёта, Lamarty вместо 1800, двери купе отдельной графой.
const kitchen=():Project=>({...newProject(),room:{...newProject().room,width:3600},modules:createKitchenRow(3000,initialModule())});
const kupe=():Project=>({...newProject(),modules:createKupeWardrobe(2400,2400,600,initialModule())});

test('кухня 3 м: позиции без счёта — «после финального расчёта конструктором», итог по известным позициям',()=>{
  const e=estimate(kitchen());
  // навесы ABS с 27.10.2026 — с ценой Макса (120 ₽ за комплект, заглушки в комплекте), не финальный расчёт
  assert.deepEqual(e.pending.map(l=>l.id).sort(),['axis-pro:120:500:white','axis-pro:200:500:white','kitchen-clip','kitchen-leg','worktop:postforming:38']);
  const hk=e.lines.find(l=>l.id==='kitchen-hanger')!,hc=e.lines.find(l=>l.id==='kitchen-hanger-cap')!;
  assert.deepEqual([hk.unit,hk.unitPrice,hk.retail],['компл',120,true]);assert.equal(hc.unitPrice,0);assert.equal(hc.quantity,hk.quantity*2);
  assert.equal(e.missing.length,0,'не «нет цены»');
  // цена — только по листам (30.10.2026): позиции «после расчёта» в итог не входят, итог = листы + розница
  assert.equal(e.retail,e.ldspSheets*e.sheetPrice+e.retailExtras+e.offSheet,'итог = листы + известные позиции вне листа');
  assert.ok(e.pending.every(l=>l.unitPrice===null&&!e.missing.includes(l)));
  // поставщик и ориентир — менеджеру в источнике строки; в итог ориентир не входит
  const src=(id:string)=>e.pending.find(l=>l.id===id)!.source;
  assert.match(src('kitchen-leg'),/^ФАМ/);assert.match(src('kitchen-clip'),/^ФАМ/);
  assert.match(src('axis-pro:200:500:white'),/^Мегатрейд.*~7 000 ₽ за комплект/);
  assert.match(src('worktop:postforming:38'),/^Премиал \(предварительно\)/);
  // клиенту: та же цена, нейтральная подпись, без поставщика и ориентира
  const c=clientView(e),text=JSON.stringify(c.lines);
  assert.equal(c.retail,e.retail);assert.equal(c.pending.length,5);assert.equal(c.missing.length,0);
  assert.ok(c.pending.every(l=>l.source===PENDING_CLIENT&&l.unitPrice===null));
  for(const w of ['ФАМ','ФАС','Мегатрейд','7 000','~120','ориентир'])assert.ok(!text.includes(w),w);
  // КП, CSV, итог для клиента: явная строка с числом позиций
  const label=pendingTotalLabel(5);assert.equal(label,'Позиции после финального расчёта конструктором: 5');
  assert.ok(quoteHTML(kitchen(),'Клиент',String(e.retail),'',undefined,{cost:e}).includes(label));
  assert.ok(estimateCSV(kitchen(),e).includes(label));
  assert.ok(salesCSV(kitchen()).includes('Позиции после финального расчёта конструктором;5'));
});

test('ручная цена снимает пометку «после расчёта», вырез под варочную — финальный расчёт (22.10)',()=>{
  const p=kitchen();p.calculation={markup:2.2,overrides:{'kitchen-leg':50}};
  const e=estimate(p);
  assert.ok(!e.pending.some(l=>l.id==='kitchen-leg'));assert.equal(e.lines.find(l=>l.id==='kitchen-leg')!.unitPrice,50);
  assert.ok(pendingPrice('worktop-cut:hob'),'вырез под варочную — с 22.10 тоже финальный расчёт (аудит сметы), итог не обнуляет');
  assert.equal(pendingPrice('gola-X'),null,'только профили Gola L и C');
});

test('T2 18.10: кухня 2400 + Axis PRO + Gola + мойка Premial — Gola, вырез и мойка «после финального расчёта», missing 0',()=>{
  const p:Project={...newProject(),room:{...newProject().room,width:3000},modules:createKitchenRow(2400,initialModule())};
  for(const a of p.modules){const m=a.module;if(m.kitchen?.role!=='base')continue;
    if(m.kdrawers?.length)m.kdrawers=layoutKitchenDrawers(m,m.kdrawers.length,undefined,'axis-pro');
    setKitchenGola(m,true);}
  const sink=p.modules.find(a=>a.module.kitchen?.appliance==='sink')!;assert.ok(sink,'в ряду 2400 есть тумба под мойку');
  const q=installSink(p,sink.id),e=estimate(q),ids=e.pending.map(l=>l.id);
  assert.deepEqual(e.missing.map(l=>l.id),[],'нет строк «нет цены»');
  for(const id of ['gola-L','gola-C','worktop-cut:sink','premial-sink:210245'])assert.ok(ids.includes(id),id);
  assert.ok(e.lines.some(l=>l.id.startsWith('axis-pro:')&&l.pending),'Axis PRO — тоже после расчёта');
  assert.ok((e.retail??0)>0);assert.equal(e.retail,e.bySheet,'итог = листы + известные позиции вне листа');
  const src=(id:string)=>e.pending.find(l=>l.id===id)!.source;
  assert.match(src('gola-L'),/Поставщик не указан — уточнить/);assert.match(src('premial-sink:210245'),/^Premial/);assert.match(src('worktop-cut:sink'),/^Премиал/);
  // клиенту — нейтральная подпись без поставщиков, число позиций в итоговой строке
  const c=clientView(e);assert.equal(c.missing.length,0);assert.equal(c.pending.length,e.pending.length);
  assert.ok(c.pending.every(l=>l.source===PENDING_CLIENT));
  assert.ok(estimateCSV(q,e).includes(pendingTotalLabel(e.pending.length)));
});

test('наполнение купе ЛДСП: цены 1800 ₽/м² нет, цена — лист Lamarty по прайсу ÷ площадь листа × 2,2',()=>{
  const ldsp=KUPE_FILLS.filter(f=>f.g.startsWith('ЛДСП'));
  assert.ok(ldsp.length>100);assert.ok(ldsp.every(f=>f.p===undefined),'у ЛДСП нет единой цены за м²');
  assert.ok(!/"p":1800\b/.test(readFileSync(new URL('../src/kupeData.ts',import.meta.url),'utf8')));
  assert.ok(!/1800/.test(readFileSync(new URL('../scripts/import-kupe.cjs',import.meta.url),'utf8')),'генератор не возвращает 1800');
  assert.equal(MARKUP_DEFAULT,2.2);
  for(const f of ldsp){const d=decorPrice(f.n),q=kupeLdspPerM2(f.n,2.2);assert.ok(d.price!==null,f.n);assert.equal(q.price,Math.round(d.price!/LDSP_SHEET_M2*2.2),f.n);}
  // в смете купе: ЛДСП «Белый» = 2150 / 5,0325 × 2,2 ≈ 940 ₽/м² (было 1800)
  const p=kupe(),k=p.modules.find(a=>a.module.kupe)!.module;k.kupe={...k.kupe!,fills:['Белый']};
  const line=estimate(p).lines.find(l=>l.id==='kupe-fill:Белый')!;
  assert.equal(line.unitPrice,Math.round(2150/(2.75*1.83)*2.2));assert.equal(line.retail,true);
  assert.match(line.source,/Lamarty|Победа/);
  // коэффициент проекта применяется и к наполнению купе
  p.calculation={markup:3,overrides:{}};assert.equal(estimate(p).lines.find(l=>l.id==='kupe-fill:Белый')!.unitPrice,Math.round(2150/(2.75*1.83)*3));
  // без функции цены (панель до сметы) — ЛДСП без цены, а не 1800
  assert.equal(kupeLines(k).find(l=>l.id==='kupe-fill:Белый')!.unitPrice,null);
});

test('цена по листам (30.10.2026): двери купе — розница сверху листов; разбивки «Материалы / Фурнитура / Двери купе» нет — только итог',()=>{
  const p=kupe(),e=estimate(p);
  const kupeSum=Math.round(e.lines.filter(l=>l.id.startsWith('kupe-')).reduce((s,l)=>s+l.quantity*(l.unitPrice??0),0));
  assert.equal(e.split.kupe,kupeSum);assert.ok(kupeSum>0);
  assert.equal(e.retail,e.ldspSheets*e.sheetPrice+e.retailExtras+e.offSheet+e.vernissageOnTop);assert.ok(e.retailExtras>=kupeSum);
  assert.equal(quoteBreakdown(String(e.retail),e),null);
  const kp=quoteHTML(p,'Клиент',String(e.retail),'',undefined,{cost:e});assert.ok(!kp.includes('<td>Двери купе</td>')&&!kp.includes('<td>Фурнитура</td>'));
  assert.ok(!estimateCSV(p,e).includes('"Разбивка:'));
});
test('разбивка по смете (код старой модели «по коэффициенту»): Материалы / Фурнитура / Двери купе, сумма граф = итогу',()=>{
  const p=kupe(),e0=estimate(p),e={...e0,model:'markup' as const,retail:e0.byMarkup};
  const s=quoteBreakdown(String(e.retail),e)!;
  assert.equal(s.material+s.hardware+s.kupe,e.retail);assert.equal(s.kupe,e.split.kupe);
  assert.deepEqual(splitRows(s).map(r=>r[0]),['Материалы','Фурнитура','Двери купе']);
  const html=quoteHTML(p,'Клиент',String(e.retail),'',undefined,{cost:e});
  assert.ok(html.includes('<td>Двери купе</td>'));assert.ok(html.includes('<td>Итого</td>'));
  // клиентский вид — те же графы
  const c=clientView(e);assert.deepEqual(quoteBreakdown(String(c.retail),c),s);
  // без купе графы «Двери купе» нет
  const sw0=estimate(newProject()),sw={...sw0,model:'markup' as const,retail:sw0.byMarkup},ss=quoteBreakdown(String(sw.retail),sw)!;
  assert.equal(ss.kupe,0);assert.deepEqual(splitRows(ss).map(r=>r[0]),['Материалы','Фурнитура']);assert.equal(ss.material+ss.hardware,sw.retail);
});
