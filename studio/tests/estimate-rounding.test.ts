// B1 (критик релиза 22.10.2026): в клиентской смете Excel сумма строк = итог = КП = экран; «Разбивка» = сумма подытогов групп;
// подпись «итог округлён до 100 ₽» — только когда итог реально кратен сотне и строки до него округлены.
import test from 'node:test';
import assert from 'node:assert/strict';
import {estimate} from '../src/pricing';
import {clientView} from '../src/clientPrices';
import {estimateSheet,clientSheet,roundingPlan,ROUNDING_LABEL} from '../src/estimateXlsx';
import {modulePrices} from '../src/itemPrices';
import {quoteBreakdown,quoteHTML,splitRows} from '../src/exports';
import {newProject,type Project} from '../src/project';
import {initialModule} from '../src/model';
import {createKitchenRow,createKupeWardrobe} from '../src/ModulePalette';
import {setAllHinges} from '../src/hardwareSwap';
import {setAllStands} from '../src/lights';
import type {XCell} from '../src/xlsx';

const wardrobe=(w=1200):Project=>{const p=newProject();const m=p.modules[0].module;m.width=w;m.sections[0].drawers=2;return p;};
const lit=(p:Project)=>{for(const a of p.modules)setAllStands(a.module,true);return p;};
const two=(a:Project)=>({...a,room:{...a.room,width:Math.max(a.room.width,2*a.modules[0].module.width+400)},modules:[a.modules[0],{...structuredClone(a.modules[0]),id:'m2',x:a.modules[0].x+a.modules[0].module.width+100}]});
const kitchen=(w=3000):Project=>({...newProject(),room:{...newProject().room,width:w+600},modules:createKitchenRow(w,initialModule())});
const kupe=(w=2400):Project=>({...newProject(),modules:createKupeWardrobe(w,2400,600,initialModule())});
const doors=(p:Project)=>{for(const a of p.modules)a.module.doors=true;return p;};
const sheetModel=(p:Project):Project=>({...p,calculation:{markup:p.calculation?.markup??2,overrides:{},model:'sheet',sheetPrice:23000} as Project['calculation']});

const projects:[string,()=>Project][]=[
  ['шкаф с ящиками',()=>wardrobe()],
  ['шкаф 1000',()=>wardrobe(1000)],
  ['два шкафа',()=>two(wardrobe())],
  ['шкаф с подсветкой',()=>lit(wardrobe())],
  ['шкаф Blum',()=>setAllHinges(wardrobe(),'blum')],
  ['два шкафа Blum + подсветка',()=>lit(setAllHinges(two(wardrobe()),'blum'))],
  ['кухня 3000',()=>kitchen(3000)],
  ['кухня 3600 с подсветкой',()=>lit(kitchen(3600))],
  ['кухня 2400 Blum',()=>setAllHinges(kitchen(2400),'blum')],
  ['купе 2400',()=>kupe(2400)],
  ['купе 1800',()=>kupe(1800)],
  ['цена за лист',()=>sheetModel(wardrobe())],
];
const F=(c:XCell|undefined)=>c&&(c.t==='n'||c.t==='f')?(c.v??0):0;
const label=(r:XCell[])=>{const c=r[1];return c&&c.t==='s'?c.v:'';};

test('B1: клиентская смета Excel — сумма строк = итог = КП = экран, разбивка = сумма групп (10+ проектов)',()=>{
  let withRounding=0;
  for(const [name,make] of projects){
    const p=make(),screen=estimate(p),e=clientView(screen);
    assert.equal(e.retail,screen.retail,name+': итог клиента = итогу экрана');
    if(e.retail===null)continue;
    const sh=estimateSheet(p,e,false);
    // строки позиций (формула C*E) и строки «Округление»
    const lineSum=sh.rows.filter(r=>r[5]?.t==='f'&&/^C\d+\*E\d+$/.test((r[5] as {f:string}).f)).reduce((s,r)=>s+F(r[5]),0);
    const roundRows=sh.rows.filter(r=>label(r)===ROUNDING_LABEL),round=roundRows.reduce((s,r)=>s+F(r[5]),0);
    if(roundRows.length)withRounding++;
    assert.ok(Math.abs(lineSum+round-e.retail)<0.01,`${name}: строки ${lineSum} + округление ${round} = итог ${e.retail}`);
    const items=sh.rows.find(r=>label(r)==='Итого по позициям')!,price=sh.rows.find(r=>label(r)==='Расчётная цена')!;
    assert.ok(Math.abs(F(items[5])-e.retail)<0.01,name+': «Итого по позициям» = «Расчётная цена»');
    assert.equal(F(price[5]),e.retail);
    // подытоги групп в сумме = итогу
    const subs=sh.rows.filter(r=>/^Итого «/.test(label(r))).reduce((s,r)=>s+F(r[5]),0);
    assert.ok(Math.abs(subs+(roundingPlan(e)?.total??0)-e.retail)<0.01,name+': подытоги = итог');
    // подпись про округление до 100 ₽ — только когда итог кратен сотне и округление было
    const note=(price[6]&&price[6].t==='s')?price[6].v:'';
    if(note.includes('округлён до 100'))assert.ok(e.retail%100===0&&roundRows.length>0,name+': подпись про сотню только при реальном округлении');
    // разбивка: графы = КП, сумма граф = итог, «Материалы» = «Материалы» + «Работа цеха»
    const split=quoteBreakdown(String(e.retail),e);
    if(split){
      const rows=sh.rows.filter(r=>/^Разбивка: /.test(label(r)));
      assert.deepEqual(rows.map(r=>[label(r).replace('Разбивка: ',''),F(r[5])]),splitRows(split),name+': разбивка Excel = КП');
      assert.equal(rows.reduce((s,r)=>s+F(r[5]),0),e.retail,name+': сумма граф = итог');
      const sub=(g:string)=>F(sh.rows.find(r=>label(r)===`Итого «${g}»`)?.[5]);
      if(!roundingPlan(e)?.total){
        assert.ok(Math.abs(sub('Материалы')+sub('Работа цеха')-split.material)<0.01,`${name}: Материалы ${split.material} = группы ${sub('Материалы')}+${sub('Работа цеха')}`);
        assert.ok(Math.abs(sub('Фурнитура')-split.hardware)<0.01,name+': Фурнитура = группа');
        for(const r of rows)assert.equal(r[5].t,'f',name+': графа разбивки — формула по подытогам');
      }
    }
    // КП: цены изделий в сумме = итог, итог КП = итог сметы
    const it=modulePrices(p,e.retail);
    if(it)assert.equal(it.reduce((s,v)=>s+v,0),e.retail,name+': изделия КП = итог');
    const html=quoteHTML(p,'Тест',String(e.retail),'',undefined,{cost:e,items:it});
    assert.ok(html.includes(e.retail.toLocaleString('ru-RU')+' ₽'),name+': итог в КП');
    // «Кратко для клиента»: строки изделий есть, у каждой своя высота, сумма = итог
    const cs=clientSheet(p,e);
    const goods=cs.rows.filter(r=>r[0]?.t==='n'&&r.length>=5);
    assert.equal(goods.length,p.modules.length,name+': строки изделий в «Кратко для клиента»');
    for(let i=0;i<cs.rows.length;i++)if(goods.includes(cs.rows[i]))assert.ok((cs.heights?.[i]??0)>=15,name+': высота строки изделия');
    if(it){const sum=cs.rows.flat().find(c=>c.t==='f'&&c.f.startsWith('SUM(F'));assert.equal(sum&&F(sum),e.retail,name+': итог «Кратко»');}
  }
  assert.ok(withRounding>=1,'хотя бы в одном проекте строки округления понадобились (проверка не холостая)');
});

test('B1: случай критика — строки с копейками, итог не кратен 100: без подписи «до 100 ₽», явная строка округления',()=>{
  const e={...clientView(estimate(lit(wardrobe())))};
  // искусственно: итог на 38 ₽ меньше суммы строк (как 142 853 против 142 891), разбивка та же по фурнитуре
  const all=e.lines.filter(l=>l.unitPrice!==null&&!l.pending).reduce((s,l)=>s+l.quantity*l.unitPrice!,0);
  const retail=Math.round(all)-38,q={...e,retail,byMarkup:retail};
  const plan=roundingPlan(q)!;assert.ok(plan);
  const sh=estimateSheet(newProject(),q,false),price=sh.rows.find(r=>label(r)==='Расчётная цена')!;
  assert.ok(!(price[6]&&price[6].t==='s'&&price[6].v.includes('до 100')),'итог не кратен 100 — подписи нет');
  assert.ok(sh.rows.some(r=>label(r)===ROUNDING_LABEL),'строка «Округление до итога сметы»');
});
