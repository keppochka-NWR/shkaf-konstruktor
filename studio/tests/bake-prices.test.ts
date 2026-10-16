import test from 'node:test';
import assert from 'node:assert/strict';
import {cpSync,readFileSync,readdirSync,rmSync,writeFileSync,existsSync} from 'node:fs';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {join} from 'node:path';
import {estimate,withPriceStamp} from '../src/pricing';
import {clientView} from '../src/clientPrices';
import {newProject,parseProject,type Project} from '../src/project';
import {initialModule} from '../src/model';
import {createKitchenRow,createKupeWardrobe} from '../src/ModulePalette';
import {bakeEdits,applyBake,readCoefs,purchaseValues,BAKE_RULES} from '../scripts/bake-prices';
import {PRICE_LITERALS} from '../scripts/public-build';
import {findPurchaseNumbers} from '../scripts/price-guard';

// Запекание (магазин п.1, 16.10.2026): копия src/ с запечёнными таблицами и PUBLIC_BUILD=true считает от розницы; итог — тот же,
// что у менеджера в клиентском виде (clientView от себестоимости). Копия — в test-results (не коммитится).
const studio=fileURLToPath(new URL('..',import.meta.url)),src=join(studio,'src'),out=join(studio,'test-results','bake-src');
const coefs=readCoefs(src);
function bakedCopy(){
  rmSync(out,{recursive:true,force:true});cpSync(src,out,{recursive:true});
  for(const f of readdirSync(out,{recursive:true}) as string[]){
    if(!/\.tsx?$/.test(f))continue;const p=join(out,f),code=readFileSync(p,'utf8'),e=bakeEdits(code,'src/'+f.replace(/\\/g,'/'),coefs);
    if(e.length)writeFileSync(p,applyBake(code,e));
  }
  writeFileSync(join(out,'buildMode.ts'),'export const PUBLIC_BUILD:boolean=true;\nexport const MANAGER_PRICING=!PUBLIC_BUILD;\n');
}
bakedCopy();
const baked=await import(pathToFileURL(join(out,'pricing.ts')).href) as typeof import('../src/pricing');

const kupeLdsp=()=>{const p:Project={...newProject(),modules:createKupeWardrobe(2400,2400,600,initialModule())};const k=p.modules.find(a=>a.module.kupe)!.module;k.kupe={...k.kupe!,fills:['Белый']};return p;};
const swing1200=()=>{const p=newProject();p.modules[0].module.width=1200;return p;};
const typical:Record<string,()=>Project>={
  swing:()=>newProject(),swing1200,
  kupe:()=>({...newProject(),modules:createKupeWardrobe(2400,2400,600,initialModule())}),kupeLdsp,
  kitchen:()=>({...newProject(),room:{...newProject().room,width:3600},modules:createKitchenRow(3000,initialModule())}),
};
const examples=readdirSync(join(studio,'examples')).filter(f=>f.endsWith('.project.json'));

function compare(name:string,p:Project,exactTotal:boolean){
  const manager=clientView(estimate(p)),pub=baked.estimate(p);
  if(exactTotal){assert.equal(pub.retail,manager.retail,name+' retail');assert.equal(pub.byMarkupKnown,manager.byMarkupKnown,name+' byMarkupKnown');}
  else assert.ok(Math.abs((pub.byMarkupKnown??0)-(manager.byMarkupKnown??0))<=Math.max(100,0.01*manager.byMarkupKnown),`${name}: ${pub.byMarkupKnown} vs ${manager.byMarkupKnown}`);
  assert.equal(pub.missing.length,manager.missing.length,name+' missing');assert.equal(pub.pending.length,manager.pending.length,name+' pending');
  // строки: розница из запечённых таблиц = закупка × коэффициент (±1 ₽ округления; оценочные формулы — ±3 %)
  for(const [i,l] of pub.lines.entries()){
    const m=manager.lines[i];assert.equal(l.id,m.id,name);
    if(m.unitPrice===null||l.unitPrice===null){assert.equal(l.unitPrice,m.unitPrice,name+' '+l.id);continue;}
    const tol=Math.max(1,0.03*m.unitPrice);
    assert.ok(Math.abs(l.unitPrice-m.unitPrice)<=tol,`${name} ${l.id}: запечено ${l.unitPrice}, клиенту ${m.unitPrice} — таблица не запечена?`);
  }
  // разбивка: части ±1 ₽ на часть (округление), сумма — итог
  for(const k of ['material','hardware','kupe'] as const)assert.ok(Math.abs((pub.split[k]??0)-(manager.split[k]??0))<=(exactTotal?2:Math.max(100,0.01*manager.split[k])),`${name} split.${k}: ${pub.split[k]} vs ${manager.split[k]}`);
  return {manager:manager.retail??manager.byMarkupKnown,pub:pub.retail??pub.byMarkupKnown};
}

for(const [n,make] of Object.entries(typical))test(`запекание: типовой заказ «${n}» — итог тот же до рубля, строки — розница`,()=>{compare(n,make(),true);});
test('запекание: примеры examples/ — итог в пределах округления',()=>{
  for(const f of examples){const p=parseProject(JSON.parse(readFileSync(join(studio,'examples',f),'utf8')));compare(f,p,false);}
});
test('запекание: локальные проекты (если есть, только чтение) — итог в пределах округления',()=>{
  const dir=join(studio,'public','local-projects');if(!existsSync(dir))return;
  let n=0;for(const f of readdirSync(dir).filter(f=>f.endsWith('.json')).slice(0,40)){let p:Project;try{p=parseProject(JSON.parse(readFileSync(join(dir,f),'utf8')));}catch{continue;}
    // публичная сборка: модель «себестоимость × коэффициент», без ручных цен проекта (закупка) — сравниваем в тех же условиях
    p={...p,calculation:{...(p.calculation??{markup:2.2,overrides:{}}),model:'markup',overrides:{}}};compare(f,p,false);n++;}
  assert.ok(n>=0);
});

test('запекание: в запечённых таблицах нет закупочных чисел с контекстом цены, коэффициенты — 1',()=>{
  const values=purchaseValues(src);
  assert.ok(values.length>50,'множество закупочных значений собрано: '+values.length);
  assert.ok(values.some(v=>v.key==='price'&&v.value===445),'шариковые 250 мм — 445');
  assert.ok(values.some(v=>v.key==='MARKUP_DEFAULT'&&v.value===2.2));
  for(const r of BAKE_RULES){const code=readFileSync(join(out,r.file),'utf8');assert.deepEqual(findPurchaseNumbers(code,values.filter(v=>v.file===r.file)).slice(0,3),[],r.file);}
  const pricing=readFileSync(join(out,'pricing.ts'),'utf8');
  assert.match(pricing,/export const MARKUP_DEFAULT=1;/);assert.match(pricing,/export const VERNISSAGE_MARKUP_DEFAULT=1;/);assert.match(pricing,/export const SHEET_PRICE_DEFAULT=0;/);
  assert.ok(!/\{price:445,/.test(pricing)&&/\{price:979,/.test(pricing),'445 × 2,2 = 979');
  assert.equal([...pricing.matchAll(PRICE_LITERALS)].filter(m=>/markup|sheetPrice|\?\?/.test(m[0])).length,0);
});

test('страж: закупочные числа находятся в минифицированном виде по ключу поля цены, розница — нет',()=>{
  const v=[{key:'price',value:445,file:'x'},{key:'price',value:0.7,file:'x'},{key:'sheetPrice',value:23000,file:'x'},{key:'markup',value:2.2,file:'x'}];
  assert.equal(findPurchaseNumbers('a={price:445,source:``},b={price:.7},c=e.sheetPrice??23e3,d={markup:2.2}',v).length,4);
  assert.equal(findPurchaseNumbers('a={price:979,source:``},b={price:1.54},c={price:4450},d={width:445}',v).length,0);
});

// ---- Ревью Codex 16.10.2026 (shop-release 5bd8335): R1, R2, R5 — сценарии воспроизведения review-prices.ts
const kitchen3m=()=>({...newProject(),modules:createKitchenRow(3000,initialModule())}) as Project;
test('R1: ручная цена проекта (лист 10 000) в публичной сборке — тот же итог, что у менеджера (83 000 + склейка), не 50 800',()=>{
  const p=newProject();p.calculation={markup:2.2,overrides:{'sheet:Дуб Вотан':10000}};
  const m=estimate(p),pub=baked.estimate(p);
  // 83 000 у Codex (5bd8335) + 159 ₽ склейки составного фальша (1000 ₽/м², 3dd13b2) = 83 159
  assert.equal(m.retail,83159);assert.equal(pub.retail,m.retail);assert.equal(pub.notice===baked.MANAGER_CALC_NOTICE,false);
});
test('R1: кухня с 7 ручными ценами 1000 — итог как в менеджерской, позиции не pending',()=>{
  const p=kitchen3m(),e=estimate(p);assert.equal(e.pending.length,7);
  p.calculation={markup:2.2,overrides:Object.fromEntries(e.pending.map(l=>[l.id,1000]))};
  const m=estimate(p),pub=baked.estimate(p);
  assert.equal(m.retail,215600);assert.equal(pub.retail,m.retail);assert.equal(pub.pending.length,0);assert.equal(m.pending.length,0);
});
test('R1: нестандартный коэффициент проекта не теряется: со штампом менеджера — итог менеджера, без штампа — явное предупреждение',()=>{
  const p=newProject();p.calculation={markup:2.5,overrides:{}};
  const m=estimate(p),stamped=withPriceStamp(p);
  assert.equal(stamped.calculation!.baseMarkup,2.2);
  const pubStamped=baked.estimate(parseProject(JSON.parse(JSON.stringify(stamped))));
  assert.ok(Math.abs(pubStamped.retail!-m.retail!)<=100,`со штампом ${pubStamped.retail} vs ${m.retail}`);assert.equal(pubStamped.notice,null);
  const pubOld=baked.estimate(p);assert.equal(pubOld.notice,baked.MARKUP_UNVERIFIED_NOTICE);
  // ручная цена без коэффициента проекта — пересчитать нельзя: итога нет, «Расчёт сделан менеджером»
  const b=baked.publicSettings({markup:Number.NaN,overrides:{'sheet:Дуб Вотан':10000}});assert.equal(b.blocked,true);assert.equal(b.ov,null);
  assert.equal(baked.publicSettings({markup:Number.NaN,overrides:{}}).blocked,false,'без ручных цен пересчитывать нечего');
  // проект публичной сборки (коэффициент запечён в 1) — без предупреждений
  assert.equal(baked.estimate({...newProject(),calculation:{markup:1,overrides:{}}}).notice,null);
});
test('R2: «цена за лист» без цены листа — модель не переключается, итог 69 000 не подменяется; штамп менеджера сохраняет цену листа',()=>{
  const p=newProject();p.calculation={markup:2.2,model:'sheet',overrides:{}};
  const m=estimate(p);assert.equal(m.model,'sheet');assert.equal(m.retail,69159,'69 000 у Codex + 159 ₽ склейки фальша');
  const pub=baked.estimate(p);
  assert.equal(pub.model,'sheet','модель не меняется молча');assert.equal(pub.retail,null,'нового меньшего итога нет');
  assert.equal(pub.needSheetPrice,true);assert.equal(pub.notice,baked.SHEET_PRICE_NOTICE);
  const saved=parseProject(JSON.parse(JSON.stringify(withPriceStamp(p))));
  assert.equal(saved.calculation!.sheetPrice,23000);
  const pubSaved=baked.estimate(saved);assert.equal(pubSaved.model,'sheet');assert.equal(pubSaved.retail,69159);
});
test('R5: «цена за лист» с ручками Лемана — розница как есть (98 ₽), итог 69 294 и в публичной сборке',()=>{
  const p=newProject();p.calculation={markup:2.2,model:'sheet',sheetPrice:23000,overrides:{}};p.modules[0].module.handleId='lm86728212';
  const m=clientView(estimate(p)),pub=baked.estimate(p);
  assert.equal(m.retail,69453,'69 294 у Codex + 159 ₽ склейки фальша');assert.equal(pub.retail,m.retail);
  const h=pub.lines.find(l=>l.id==='handle:lm86728212')!;assert.equal(h.unitPrice,98);assert.equal(h.quantity,3);
  // модель наценки — та же ручка × коэффициент (215,60), как у менеджера
  const pk=newProject();pk.modules[0].module.handleId='lm86728212';
  assert.equal(baked.estimate(pk).lines.find(l=>l.id==='handle:lm86728212')!.unitPrice,215.6);
  assert.equal(baked.estimate(pk).retail,clientView(estimate(pk)).retail);
});
