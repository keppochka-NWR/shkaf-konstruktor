// Макс 31.10.2026: «сделать более подробно расписанную стоимость» — разложение итога (src/estimateBreakdown.ts). Сумма групп + округление
// = итог сметы до рубля; листы — по декорам раскроя × цена листа; в строках только цены клиенту (как в публичной сборке), без закупки.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,readdirSync,existsSync} from 'node:fs';
import {estimate} from '../src/pricing';
import {nest} from '../src/exports';
import {clientLine,isOffSheetLine} from '../src/clientPrices';
import {estimateBreakdown,breakdownText,breakdownHTML,groupOf,itemShares} from '../src/estimateBreakdown';
import {newProject,parseProject,type Project} from '../src/project';
import {initialModule} from '../src/model';
import {createKitchenRow,createKupeWardrobe} from '../src/ModulePalette';
import {isSensitive} from '../scripts/public-build';

const typical:Record<string,Project>={
  swing:newProject(),
  kupe:{...newProject(),modules:createKupeWardrobe(2400,2400,600,initialModule())},
  kitchen:{...newProject(),room:{...newProject().room,width:3600},modules:createKitchenRow(3000,initialModule())},
  kupeExample:parseProject(JSON.parse(readFileSync(new URL('../examples/kupe-wardrobe.project.json',import.meta.url),'utf8'))),
};
// заказы цеха (examples/orders) и, если есть, локальные проекты (git-ignored) — выборка
const dirs=[new URL('../examples/orders/',import.meta.url),new URL('../public/local-projects/',import.meta.url)];
for(const d of dirs){if(!existsSync(d))continue;readdirSync(d).filter(f=>f.endsWith('.json')).sort().filter((_,i)=>i%7===0).slice(0,40).forEach((f,i)=>{try{typical[(d.pathname.includes('local')?'L':'O')+i]=parseProject(JSON.parse(readFileSync(new URL(f,d),'utf8')));}catch{/* не проект */}});}

for(const [name,p] of Object.entries(typical))test(`разложение = итог сметы: ${name}`,()=>{
  const plan=nest(p),e=estimate(p,plan),b=estimateBreakdown(p,plan,e);
  // группы: сумма строк с ценой
  for(const g of b.groups)assert.equal(g.total,g.rows.reduce((s,r)=>s+(r.amount??0),0),g.id);
  assert.equal(b.sum,b.groups.reduce((s,g)=>s+g.total,0));
  if(e.retail!==null){assert.equal(b.sum+b.rounding,e.retail,'сумма групп + округление = итог');assert.ok(Math.abs(b.rounding)<=100,'округление '+b.rounding);}
  else assert.equal(b.total,null);
  // листы ЛДСП по декорам: число = листы сметы, сумма = листы × цена листа
  const sheets=b.groups.find(g=>g.id==='sheets')?.rows.filter(r=>r.unit==='лист'&&r.status==='priced'&&r.price===e.sheetPrice)??[];
  assert.equal(sheets.reduce((s,r)=>s+r.qty,0),e.ldspSheets);
  assert.equal(sheets.reduce((s,r)=>s+r.amount!,0),e.ldspSheets*e.sheetPrice);
  // только цены клиенту: строка внутри листа — без цены; остальные — клиентская цена (clientLine), не закупка
  const rows=new Map(b.groups.flatMap(g=>g.rows).map(r=>[r.id,r]));
  for(const l of e.lines){const r=rows.get(l.id);assert.ok(r,'строка '+l.id+' в разложении');
    const c=clientLine(l,e.markup,e.vernissageMarkup,'sheet',e.ldspSheets===0);
    if(l.pending){assert.equal(r.status,'pending');continue;}
    if(!l.retail&&!l.id.startsWith('vernissage')&&!l.id.startsWith('mesh:')&&!l.id.startsWith('handle:lm')&&!isOffSheetLine(l.id)&&e.ldspSheets>0){assert.equal(r.price,null,l.id+': внутри цены листа — без цены');continue;}
    assert.equal(r.price,c.unitPrice,l.id);
    assert.equal(groupOf(l.id),b.groups.find(g=>g.rows.includes(r))!.id);}
  // текст и печать — без слов закупки и поставщиков (как страж публикации)
  const txt=breakdownText(b),html=breakdownHTML(b);
  for(const s of [txt,html])assert.equal(isSensitive(s.replace(/Лемана Про/g,'')),false);
  if(e.retail!==null)assert.ok(txt.includes(e.retail.toLocaleString('ru-RU')));
});

test('группы по видам: фасады, купе, фурнитура, подсветка, столешница, листы',()=>{
  assert.equal(groupOf('vernissage:abc'),'facades');assert.equal(groupOf('alu-profile:x'),'facades');assert.equal(groupOf('glass-mirror-glue'),'facades');
  assert.equal(groupOf('kupe-profile:x'),'kupe');assert.equal(groupOf('worktop:x'),'worktop');assert.equal(groupOf('light-shelf'),'light');
  assert.equal(groupOf('slide:ball:450'),'hardware');assert.equal(groupOf('hinge'),'hardware');assert.equal(groupOf('edge2'),'sheets');assert.equal(groupOf('work'),'sheets');
});

test('цены по изделиям — сумма = итог',()=>{
  const p=typical.kitchen,e=estimate(p),items=itemShares(p,e.retail);
  if(e.retail===null||!items)return;
  assert.equal(items.reduce((s,i)=>s+(i.price??0),0),e.retail);
});
