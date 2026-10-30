import test from 'node:test';
import assert from 'node:assert/strict';
import {estimate,HDF_SHEET,SHOP_WORK_LDSP_SHEET,SHOP_WORK_HDF_SHEET,MARKUP_DEFAULT,lineGroup} from '../src/pricing';
import {clientView} from '../src/clientPrices';
import {nest} from '../src/exports';
import {newProject,type Project} from '../src/project';
import {initialModule} from '../src/model';
import {createKitchenRow} from '../src/ModulePalette';

// Решение Макса 20.10.2026: работа цеха 3 500 ₽ за лист ЛДСП (было 2 500); лист ЛХДФ — 1 060 ₽ + работа 2 000 ₽ за лист; всё × 2,2.
const line=(e:ReturnType<typeof estimate>,id:string)=>e.lines.find(l=>l.id===id);
const withOv=(p:Project,ov:Record<string,number>):Project=>({...p,calculation:{markup:MARKUP_DEFAULT,overrides:ov}});

test('работа цеха: константы решения 20.10.2026 — ЛДСП 3 500, ЛХДФ 2 000, лист ЛХДФ 1 060, коэффициент 2,2',()=>{
  assert.equal(SHOP_WORK_LDSP_SHEET,3500);assert.equal(SHOP_WORK_HDF_SHEET,2000);assert.equal(HDF_SHEET,1060);assert.equal(MARKUP_DEFAULT,2.2);
  assert.equal(lineGroup('work'),'material');assert.equal(lineGroup('work-hdf'),'material','работа ЛХДФ — в «материалах», в себестоимости');
});

test('шкаф с задником ХДФ: лист ЛХДФ 1 060 + работа 2 000 за лист ЛХДФ, лист ЛДСП + 3 500; клиенту всё × 2,2',()=>{
  const p=newProject(),plan=nest(p),e=estimate(p,plan);
  const hdf=plan.filter(s=>s.material==='hdf').length,ldsp=plan.length-hdf;
  assert.ok(hdf>=1&&ldsp>=1,'в раскрое есть и ЛДСП, и ЛХДФ');
  assert.deepEqual([line(e,'sheet:hdf')!.unitPrice,line(e,'sheet:hdf')!.quantity],[1060,hdf]);
  const wh=line(e,'work-hdf')!,w=line(e,'work')!;
  assert.equal(wh.label,'Работа цеха: ЛХДФ');assert.equal(wh.unitPrice,2000);assert.equal(wh.quantity,hdf);assert.equal(wh.unit,'лист');assert.ok(!wh.retail);
  assert.equal(w.label,'Работа цеха: ЛДСП');assert.equal(w.unitPrice,3500);assert.equal(w.quantity,ldsp);assert.equal(e.ldspSheets,ldsp);
  // себестоимость: ровно 1 060 + 2 000 за лист ЛХДФ, 3 500 за лист ЛДСП
  const free=estimate(withOv(p,{'sheet:hdf':0,'work-hdf':0,work:0}));
  assert.equal(e.knownCost-free.knownCost,hdf*(1060+2000)+ldsp*3500);
  // итог клиенту: × 2,2 (2 000 × 2,2 = 4 400 и 3 500 × 2,2 = 7 700 — кратны 100, итог к сотне сдвигается ровно)
  // × 2,2 — внутренняя оценка byMarkupKnown (с 30.10.2026 цена клиенту — только по листам, работа внутри цены листа)
  assert.equal(e.byMarkupKnown-estimate(withOv(p,{'work-hdf':0})).byMarkupKnown,hdf*4400);
  assert.equal(e.byMarkupKnown-estimate(withOv(p,{work:0})).byMarkupKnown,ldsp*7700);
  const noHdf=estimate(withOv(p,{'sheet:hdf':0,'work-hdf':0}));
  assert.ok(Math.abs(e.byMarkupKnown-noHdf.byMarkupKnown-hdf*(1060+2000)*2.2)<=100,'лист ЛХДФ с работой: (1 060 + 2 000) × 2,2 = 6 732 за лист, ±100 округления итога');
  assert.equal(estimate(withOv(p,{work:0})).retail,e.retail,'цена клиенту по листам от работы не зависит');
  // клиентский вид (КП, публичная сборка): работа и ЛХДФ — «входит в цену за лист»
  const cv=clientView(e);
  for(const id of ['work-hdf','work','sheet:hdf'])assert.equal(line(cv,id)!.unitPrice,null,id);
  assert.equal(cv.retail,e.retail);
});

test('шкаф 1200: итог вырос ровно на (листы ЛДСП × 1 000 − листы ЛХДФ × 500) × 2,2 к правилу «2 500 за любой лист»',()=>{
  const p=newProject();p.modules[0].module.width=1200;
  const e=estimate(p),plan=nest(p),hdf=plan.filter(s=>s.material==='hdf').length,ldsp=plan.length-hdf;
  // старое правило воспроизводим ручной ценой проекта: 2 500 за каждый лист в строке ЛДСП, работа ЛХДФ — внутри неё
  const old=estimate(withOv(p,{work:2500*(ldsp+hdf)/ldsp,'work-hdf':0}));
  assert.equal(e.byMarkupKnown-old.byMarkupKnown,Math.round((ldsp*3500+hdf*2000-(ldsp+hdf)*2500)*2.2));
});

test('кухня 3 м: работа 3 500 за лист ЛДСП, лист ЛХДФ — 1 060 без работы (как до 20.10, вопрос Максу)',()=>{
  const p:Project={...newProject(),room:{...newProject().room,width:3600},modules:createKitchenRow(3000,initialModule())};
  const plan=nest(p),e=estimate(p,plan),hdf=plan.filter(s=>s.material==='hdf').length;
  assert.ok(hdf>=1,'в раскрое кухни есть ЛХДФ');
  assert.equal(line(e,'work')!.unitPrice,3500);assert.equal(line(e,'work')!.quantity,plan.length-hdf);
  assert.equal(line(e,'work-hdf'),undefined,'у кухни работы за ЛХДФ нет');
  assert.equal(line(e,'sheet:hdf')!.unitPrice,1060);
  assert.equal(e.byMarkupKnown-estimate(withOv(p,{work:0})).byMarkupKnown,(plan.length-hdf)*7700);
});
