// «Красивая смета в Excel» (менеджеры 22.10.2026, п. 8): .xlsx из SpreadsheetML без новых зависимостей.
import test from 'node:test';
import assert from 'node:assert/strict';
import {unzipSync,strFromU8} from 'three/addons/libs/fflate.module.js';
import {estimate} from '../src/pricing';
import {estimateWorkbookFiles,estimateXLSX,xlsxGroup,clientSheet,estimateSheet} from '../src/estimateXlsx';
import {modulePrices} from '../src/itemPrices';
import {colName} from '../src/xlsx';
import {newProject,parseProject,type Project} from '../src/project';
import {initialModule} from '../src/model';
import {createKitchenRow,createKupeWardrobe} from '../src/ModulePalette';

const wardrobe=():Project=>{const p=newProject();p.modules[0].module.sections[0].drawers=2;return p;};
const kitchen=():Project=>({...newProject(),room:{...newProject().room,width:3600},modules:createKitchenRow(3000,initialModule())});
const kupe=():Project=>({...newProject(),modules:createKupeWardrobe(2400,2400,600,initialModule())});

/** Проверка корректности XML без парсера: теги парные и вложены правильно, амперсанды — только сущности. */
function wellFormed(x:string){
  assert.ok(!/&(?!(amp|lt|gt|quot|apos|#\d+);)/.test(x),'голый &');
  const stack:string[]=[];
  for(const m of x.matchAll(/<(\/?)([A-Za-z_][\w:.-]*)([^>]*?)(\/?)>/g)){
    if(m[0].startsWith('<?'))continue;
    const [,close,name,,self]=m;
    if(self)continue;
    if(close){assert.equal(stack.pop(),name,'закрывающий тег '+name);}else stack.push(name);
  }
  assert.deepEqual(stack,[],'все теги закрыты');
}
/** Ячейки листа: адрес → {v, f, text}. */
function cells(x:string){
  const out=new Map<string,{v?:number;f?:string;text?:string}>();
  for(const m of x.matchAll(/<c r="([A-Z]+\d+)"[^>]*?(?:\/>|>(.*?)<\/c>)/g)){
    const body=m[2]??'',v=/<v>([^<]*)<\/v>/.exec(body)?.[1],f=/<f>([^<]*)<\/f>/.exec(body)?.[1]?.replace(/&quot;/g,'"'),t=/<t[^>]*>([^<]*)<\/t>/.exec(body)?.[1];
    out.set(m[1],{...(v!==undefined?{v:Number(v)}:{}),...(f!==undefined?{f}:{}),...(t!==undefined?{text:t}:{})});
  }
  return out;
}
const rowOf=(c:Map<string,{text?:string}>,label:string)=>[...c].find(([,v])=>v.text===label)?.[0].replace(/^[A-Z]+/,'');

test('xlsx: zip с книгой из трёх листов, весь XML корректен, стили и шапка закреплены',async()=>{
  const p=wardrobe(),data=await estimateXLSX(p);
  assert.equal(data[0],0x50);assert.equal(data[1],0x4b,'zip');
  const files=unzipSync(data),names=Object.keys(files).sort();
  for(const n of ['[Content_Types].xml','_rels/.rels','xl/workbook.xml','xl/_rels/workbook.xml.rels','xl/styles.xml','xl/worksheets/sheet1.xml','xl/worksheets/sheet2.xml','xl/worksheets/sheet3.xml'])assert.ok(names.includes(n),n);
  for(const n of names)wellFormed(strFromU8(files[n]));
  const wb=strFromU8(files['xl/workbook.xml']);
  assert.match(wb,/name="Смета"/);assert.match(wb,/name="Детали"/);assert.match(wb,/name="Кратко для клиента"/);assert.match(wb,/fullCalcOnLoad="1"/);
  const st=strFromU8(files['xl/styles.xml']);assert.match(st,/formatCode="#,##0&quot; ₽&quot;"/);assert.match(st,/<b\/>/);assert.match(st,/patternType="solid"/);
  const s1=strFromU8(files['xl/worksheets/sheet1.xml']);assert.match(s1,/<pane ySplit="4"[^>]*state="frozen"/);assert.match(s1,/<cols>/);assert.match(s1,/wrapText|<c r="B5"/);assert.match(st,/wrapText="1"/);
  assert.equal(colName(0),'A');assert.equal(colName(25),'Z');assert.equal(colName(26),'AA');
});

test('xlsx «Смета»: группы с подытогами SUMIFS, себестоимость и итог совпадают со сметой',()=>{
  for(const p of [wardrobe(),kitchen(),kupe()]){
    const e=estimate(p),files=estimateWorkbookFiles(p,e),c=cells(files['xl/worksheets/sheet1.xml']);
    // строки по группам: каждая строка сметы есть в листе
    for(const l of e.lines)assert.ok([...c.values()].some(v=>v.text===l.label),'строка '+l.label);
    const subs=[...c].filter(([,v])=>v.f?.startsWith('SUMIFS('));
    assert.ok(subs.length>=1,'подытоги формулами');
    // формула суммы строки = кол-во × цена, значение совпадает
    const withPrice=e.lines.filter(l=>l.unitPrice!==null);
    const sumCells=[...c].filter(([k,v])=>/^F\d+$/.test(k)&&/^C\d+\*E\d+$/.test(v.f??''));
    assert.equal(sumCells.length,withPrice.length,'у каждой строки с ценой формула суммы');
    const cost=rowOf(c,'Себестоимость (закупка)')!;assert.ok(cost);
    assert.equal(Math.round(c.get('F'+cost)!.v!),e.knownCost,'себестоимость = смете');
    const total=rowOf(c,'Расчётная цена')!;
    if(e.retail!==null)assert.equal(c.get('F'+total)!.v,e.retail,'расчётная цена = смете');
    // сумма подытогов закупки = себестоимость (формула ссылается на подытоги)
    const buy=subs.filter(([,v])=>v.f!.includes('"закупка"')).reduce((s,[,v])=>s+v.v!,0);
    assert.equal(Math.round(buy),e.knownCost);
  }
});

test('xlsx: группы — материалы / работа / фурнитура / двери купе / после финального расчёта',()=>{
  assert.equal(xlsxGroup({id:'work'}),'work');assert.equal(xlsxGroup({id:'small'}),'work');
  assert.equal(xlsxGroup({id:'sheet:Белый'}),'material');assert.equal(xlsxGroup({id:'hinge'}),'hardware');
  assert.equal(xlsxGroup({id:'kupe-fill:x'}),'kupe');assert.equal(xlsxGroup({id:'kitchen-leg',pending:true}),'pending');
  const k=kitchen(),e=estimate(k),sh=estimateSheet(k,e,true);
  const texts=sh.rows.flat().map(c=>c.t==='s'?c.v:'');
  for(const g of ['Материалы','Работа цеха','Фурнитура','После финального расчёта конструктором'])assert.ok(texts.includes(g),g);
  assert.ok(texts.some(t=>/Позиции после финального расчёта конструктором: \d+ — в итог не входят/.test(t)));
  const ku=kupe(),sk=estimateSheet(ku,estimate(ku),true);assert.ok(sk.rows.flat().some(c=>c.t==='s'&&c.v==='Двери купе'));
});

test('xlsx «Кратко для клиента» и клиентский режим «Сметы»: без закупки, коэффициентов и источников; цены изделий = итогу',()=>{
  for(const p of [wardrobe(),kitchen(),kupe(),{...wardrobe(),modules:[...wardrobe().modules,{...wardrobe().modules[0],id:'m2',x:1300}]}]){
    const e=estimate(p),client=clientSheet(p,e),text=JSON.stringify(client.rows);
    for(const bad of ['закуп','Себестоимость','Коэффициент','ФАМ','Счёт','Мега-Трейд','Оценка'])assert.ok(!text.includes(bad),'нет «'+bad+'»');
    // закупочные цены строк (не розничных) в клиентском листе не встречаются числами
    const nums=new Set(client.rows.flat().filter(c=>c.t==='n').map(c=>(c as {v:number}).v));
    for(const l of e.lines)if(!l.retail&&l.unitPrice!==null&&l.unitPrice>1000)assert.ok(!nums.has(l.unitPrice),'закупка '+l.label);
    const items=modulePrices(p,e.retail);
    if(items){assert.equal(items.reduce((s,v)=>s+v,0),e.retail,'сумма цен изделий = итог');const f=client.rows.flat().find(c=>c.t==='f'&&c.f.startsWith('SUM(F'));assert.ok(f&&f.t==='f'&&f.v===e.retail);}
    const pub=JSON.stringify(estimateSheet(p,e,false).rows);
    for(const bad of ['закупка','Себестоимость','Коэффициент'])assert.ok(!pub.includes(bad),'клиентская смета без «'+bad+'»');
  }
});

test('цены по изделиям: доли по сметам изделий, сумма ровно итог, выключатель offer.itemPrices',()=>{
  const p={...wardrobe(),modules:[wardrobe().modules[0],{...wardrobe().modules[0],id:'m2',x:1300,module:{...wardrobe().modules[0].module,width:1000}}]};
  const e=estimate(p),items=modulePrices(p,e.retail)!;
  assert.equal(items.length,2);assert.equal(items[0]+items[1],e.retail);assert.ok(items[1]>items[0],'шире — дороже');
  assert.ok(modulePrices(p,50000)!.every(v=>v%100===0),'итог кратен 100 — изделия сотнями');
  assert.deepEqual(modulePrices(p,null),null);assert.deepEqual(modulePrices(p,12345)?.reduce((s,v)=>s+v,0),12345);
  const off={...p,offer:{customer:'',price:'',notes:'',itemPrices:false}};
  assert.ok(!JSON.stringify(clientSheet(off,e).rows).includes('Цена, ₽'));
  // поле сохраняется при чтении проекта
  assert.equal(parseProject(JSON.parse(JSON.stringify(off))).offer?.itemPrices,false);
});

test('xlsx «Детали»: деталировка только с номером заказа (правило T3)',()=>{
  const p=wardrobe(),f0=estimateWorkbookFiles(p);
  assert.match(f0['xl/worksheets/sheet2.xml'],/Укажите номер заказа/);
  const q={...p,measurement:{number:'T-1',date:'',notes:''}},c=cells(estimateWorkbookFiles(q)['xl/worksheets/sheet2.xml']);
  assert.equal(c.get('A5')!.text,'1.1');assert.ok([...c.values()].some(v=>v.f?.startsWith('SUM(M')));
});
