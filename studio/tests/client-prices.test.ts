import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {estimate} from '../src/pricing';
import {clientView,clientLine,CLIENT_SOURCE,CLIENT_SOURCE_MISSING} from '../src/clientPrices';
import {PUBLIC_BUILD} from '../src/buildMode';
import {newProject,parseProject,type Project} from '../src/project';
import {initialModule} from '../src/model';
import {createKitchenRow,createKupeWardrobe} from '../src/ModulePalette';
import {sanitizeEdits,applyEdits,isSensitive,NEUTRAL} from '../scripts/public-build';

// Типовые заказы: распашной (первый шкаф), купе 2400×2400×600, прямая кухня 3 м из палитры, пример купе из examples.
const typical:Record<string,Project>={
  swing:newProject(),
  kupe:{...newProject(),modules:createKupeWardrobe(2400,2400,600,initialModule())},
  kitchen:{...newProject(),room:{...newProject().room,width:3600},modules:createKitchenRow(3000,initialModule())},
  sheetModel:{...newProject(),calculation:{markup:2.2,overrides:{},model:'sheet'}},
  kupeExample:parseProject(JSON.parse(readFileSync(new URL('../examples/kupe-wardrobe.project.json',import.meta.url),'utf8'))),
};
const totals=(e:ReturnType<typeof estimate>)=>({retail:e.retail,byMarkup:e.byMarkup,byMarkupKnown:e.byMarkupKnown,bySheet:e.model==='sheet'?e.bySheet:null,material:e.split.material,hardware:e.split.hardware,vernissage:e.vernissageOnTop,missing:e.missing.length,model:e.model});

test('tests run in manager mode (no __PUBLIC_BUILD__ outside vite build)',()=>{assert.equal(PUBLIC_BUILD,false);});

for(const [name,p] of Object.entries(typical))test(`client view keeps the client price of a typical order to the ruble: ${name}`,()=>{
  const manager=estimate(p),client=clientView(manager);
  assert.deepEqual(totals(client),totals(manager));
  assert.ok((manager.byMarkupKnown??0)>0,'typical order has a price');
  // в строках — клиентские цены: база × коэффициент (Вернисаж — свой, розница — как есть), без источников закупки
  for(const [i,l] of client.lines.entries()){
    const m=manager.lines[i],k=m.retail?1:m.id.startsWith('vernissage')?manager.vernissageMarkup:manager.markup;
    assert.equal(l.id,m.id);
    assert.equal(l.unitPrice,m.unitPrice===null?null:Math.round(m.unitPrice*k*100)/100,l.id);
    assert.ok(l.source===CLIENT_SOURCE||l.source===CLIENT_SOURCE_MISSING,l.source);
  }
  assert.equal(client.markup,1);assert.equal(client.sheetPrice,0);if(manager.model!=='sheet')assert.equal(client.bySheet,manager.byMarkupKnown,'sheet price is not recoverable');
  assert.ok(!isSensitive(JSON.stringify(client.lines)),'no purchase words in client lines');
  assert.equal(client.split.materialCost,client.split.material);assert.equal(client.split.hardwareCost,client.split.hardware);
});

test('client line: vernissage × own coefficient, retail as is, missing stays missing',()=>{
  const base={quantity:2,unit:'шт',source:'Счета ФАМ, 2026'};
  assert.equal(clientLine({...base,id:'hinge',label:'Петля',unitPrice:100},2.2,1.6).unitPrice,220);
  assert.equal(clientLine({...base,id:'vernissage:x',label:'Фасад',unitPrice:1000},2.2,1.6).unitPrice,1600);
  assert.equal(clientLine({...base,id:'light',label:'Подсветка',unitPrice:500,retail:true},2.2,1.6).unitPrice,500);
  const miss=clientLine({...base,id:'kitchen-leg',label:'Опора',unitPrice:null},2.2,1.6);
  assert.equal(miss.unitPrice,null);assert.equal(miss.source,CLIENT_SOURCE_MISSING);
});

test('public build sanitizer: strings with purchase words or supplier names become neutral, keys and imports stay',()=>{
  const code=`import x from "./ФАМ.js";const t={"Победа":1,a:"Счета ФАМ, 2026",b:"Белый",c:\`закупка × \${k}\`,d:"АТБ, прайс",e:"Фамилия клиента",f:"ПОБЕДА"};const s='База закупки СФЗ / Победа';const r=/закуп/.test(q);`;
  const out=applyEdits(code,sanitizeEdits(code));
  assert.ok(out.includes('import x from "./ФАМ.js"'),'import source kept');
  assert.ok(out.includes('"Победа":1'),'object key kept');
  assert.ok(out.includes('b:"Белый"'),'neutral string kept');
  assert.ok(out.includes('e:"Фамилия клиента"'),'ФАМ inside a word is not a supplier');
  for(const k of ['a','c','d'])assert.ok(out.includes(k+':'+JSON.stringify(NEUTRAL)),k);
  assert.ok(out.includes('const s='+JSON.stringify(NEUTRAL)));
  assert.ok(out.includes('/закуп/.test(q)'),'regex literal kept (logic)');
  assert.ok(!/Счета|СФЗ|АТБ/.test(out));
});
