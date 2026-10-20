// Страж разбора (n7-spec-dedupe, аудит 11.10.2026): parseModule — ручной список полей, новое поле без строки в parse терялось молча.
// 1) round-trip: parseModule(JSON(m)) deepEqual m (с точностью до ключей undefined) для шаблонов студии, кухонной палитры и всех модулей
//    клиентских проектов local-projects (kitchen-k*.json, wardrobe-*.json; папки нет в git — тесты пропускаются);
// 2) легаси: старый JSON с noFasteners/confDepth/eccBelow/endsX/screw/kitchen.bazis парсится в новые поля, а parts()/holes()
//    совпадают с эталоном, снятым до дедупликации (tests/fixtures/legacy-spec.json, 0ae6f30).
import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync,readdirSync,readFileSync} from 'node:fs';
import {initialModule,parseModule,parts,validate,type Module} from '../src/model';
import {holes} from '../src/drilling';
import {kitchenTemplate,KITCHEN_ITEMS,type KitchenItem} from '../src/kitchenProject';
import {createModule,type ModuleKind} from '../src/ModulePalette';
import {fastenersMode,KITCHEN} from '../src/kitchen';

const strip=<T,>(x:T):T=>JSON.parse(JSON.stringify(x));
const roundTrip=(m:Module,label:string)=>{
  let back:Module;
  try{back=parseModule(strip(m));}catch(e){assert.fail(`${label}: parseModule бросил «${(e as Error).message}»`);}
  assert.deepEqual(strip(back!),strip(m),`${label}: parseModule(JSON(m)) ≠ m`);
};
const LOCAL='public/local-projects';
const localFiles=()=>existsSync(LOCAL)?readdirSync(LOCAL).filter(f=>/^(kitchen-k\d+|wardrobe-\d+)\.json$/.test(f)).sort():[];

test('round-trip: initialModule, кухонная палитра и шаблоны шкафов студии',()=>{
  roundTrip(initialModule(),'initialModule');
  const look=initialModule();
  for(const [kind,it] of Object.entries(KITCHEN_ITEMS) as [KitchenItem,{widths:number[]}][])for(const w of it.widths)roundTrip(kitchenTemplate(kind,w,look),`kitchenTemplate(${kind},${w})`);
  const wardrobes:[ModuleKind,number,number,number][]=[['empty',900,2200,500],['shelves',800,2000,400],['wardrobe',1000,2400,600],['drawers',600,850,550],['desk',1200,750,600],['corner',1050,2000,450],['kupe',1600,2400,100],['kitchen-base',600,KITCHEN.baseHeight,KITCHEN.baseDepth],['kitchen-wall',600,KITCHEN.wallHeight,KITCHEN.wallDepth],['worktop',2400,KITCHEN.worktopThickness,KITCHEN.worktopDepth]];
  for(const [kind,w,h,d] of wardrobes)roundTrip(createModule(kind,w,h,d,look),`createModule(${kind})`);
});

test('round-trip: все модули клиентских проектов local-projects (kitchen-k*, wardrobe-*)',{skip:!localFiles().length},()=>{
  let n=0;
  for(const f of localFiles()){
    const p=JSON.parse(readFileSync(`${LOCAL}/${f}`,'utf8')) as {modules:{module:unknown}[]};
    for(const [i,a] of p.modules.entries()){
      let m:Module;
      try{m=parseModule(a.module);}catch(e){assert.fail(`${f} модуль ${i}: parseModule бросил «${(e as Error).message}»`);}
      roundTrip(m!,`${f} модуль ${i} «${m!.name}»`);
      // после разбора старых полей в модуле нет (parse переводит их в новые)
      const k=m!.kitchen as Record<string,unknown>|undefined;
      for(const old of ['noFasteners','confDepth','eccBelow','screw','bazis'])assert.equal(k?.[old],undefined,`${f} модуль ${i}: kitchen.${old} после parse`);
      assert.equal((m!.edgeScheme as Record<string,unknown>|undefined)?.endsX,undefined,`${f} модуль ${i}: edgeScheme.endsX после parse`);
      n++;
    }
  }
  assert.ok(n>0);
});

test('легаси: старый JSON (noFasteners/confDepth/eccBelow/endsX/screw/kitchen.bazis) → новые поля, parts()/holes() как до правки',()=>{
  const fx=JSON.parse(readFileSync('tests/fixtures/legacy-spec.json','utf8')) as {legacy:Record<string,unknown>[];expected:{parts:string[];holes:string[]}[]};
  const r1=(v:number)=>Math.round(v*10)/10;
  // эталон снят до расположения ручек (20.10): у кухонь новое умолчание ручки (угол напротив петли) — сверяем при «по правилу»
  const digest=(m0:Module)=>{const m=structuredClone(m0);for(const s of m.sections)s.handlePos=[...Array(4)].map((_,i)=>s.handlePos?.[i]??'rule');const ps=parts(m);return {
    parts:ps.map(p=>[p.id,p.name.replace(/×/g,'х'),p.size.map(r1),p.position.map(r1),p.edge??null,p.anchor?p.anchor.map(r1):null].map(String).join('|')).sort(),
    holes:holes(m,ps).map(h=>[h.src,h.part,h.d,r1(h.depth),h.at.map(r1),h.dir.map(r1)].map(String).join('|')).sort()};};
  assert.equal(fx.legacy.length,6);
  const ms=fx.legacy.map(raw=>parseModule(strip(raw)));
  ms.forEach((m,i)=>assert.deepEqual(digest(m),fx.expected[i],`легаси-модуль ${i+1}: детали/присадка разошлись с эталоном до правки`));
  // 1: confDepth → drill.confirmat; kitchen.bazis → m.bazis; screw → confirmatName; endsX:true → ends (дно и крыша)
  assert.deepEqual(ms[0].kitchen?.drill,{confirmat:42});assert.equal(ms[0].bazis,true);assert.equal(ms[0].kitchen?.bazis,undefined);
  assert.equal(ms[0].kitchen?.confirmatName,'Евровинт 6х50');assert.equal(ms[0].kitchen?.screw,undefined);
  assert.deepEqual(ms[0].edgeScheme?.ends,{bottom:['+z','-z','+x','-x'],top:['+z','-z','+x','-x']});
  // 2: noFasteners → fasteners:'pins' (полкодержатели остаются); endsX:'bottom' → только дно
  assert.equal(fastenersMode(ms[1].kitchen),'pins');assert.ok(parts(ms[1]).some(p=>p.id.startsWith('shp:')));
  assert.deepEqual(ms[1].edgeScheme?.ends,{bottom:['+z','-z','+x','-x']});
  // 3: eccBelow → ecc.bottomOut
  assert.deepEqual(ms[2].kitchen?.ecc,{bottomOut:true});
  // 4: fasteners:false — без всего, в том числе полкодержателей
  assert.equal(fastenersMode(ms[3].kitchen),false);assert.ok(!parts(ms[3]).some(p=>/^(fast|ecc|dowel|shp):/.test(p.id)));
  // 5: endsX:'top' → только крыша; rear при набивном ХДФ
  assert.deepEqual(ms[4].edgeScheme?.ends,{top:['+z','-z','+x','-x']});assert.deepEqual(ms[4].kitchen?.drill,{confirmat:37});
  // 6: noFasteners + fasteners:false вместе — false строже
  assert.equal(fastenersMode(ms[5].kitchen),false);
  // старые ключи после разбора не живут; повторный разбор — тот же модуль
  for(const m of ms){for(const old of ['noFasteners','confDepth','eccBelow','screw','bazis'])assert.equal((m.kitchen as Record<string,unknown>)[old],undefined);assert.equal((m.edgeScheme as Record<string,unknown>|undefined)?.endsX,undefined);roundTrip(m,'легаси');}
});

test('validate: петля вне фасада у кухни — ошибка, а не тихий кламп; опоры и столешница в пределах',()=>{
  const m=kitchenTemplate('base-doors',600,initialModule());
  const dh=parts(m).find(p=>p.role==='door')!.size[1];
  const ok={...m,sections:[{...m.sections[0],hingeY:[100,Math.round(dh-100)],hingeYFor:dh}]};
  assert.deepEqual(validate(ok).filter(e=>/петля вне фасада/.test(e)),[]);
  const low={...m,sections:[{...m.sections[0],hingeY:[20,Math.round(dh-100)],hingeYFor:dh}]};
  assert.ok(validate(low).some(e=>/петля вне фасада/.test(e)));
  const high={...m,sections:[{...m.sections[0],hingeY:[100,Math.round(dh-10)],hingeYFor:dh}]};
  assert.ok(validate(high).some(e=>/петля вне фасада/.test(e)));
  assert.throws(()=>parseModule(strip(high)),/петля вне фасада/);
  // шкаф студии: правило не трогаем (кламп как раньше)
  const w=initialModule();w.sections=[{...w.sections[0],hingeY:[20,500],hingeYFor:2000}];
  assert.deepEqual(validate(w).filter(e=>/петля вне фасада/.test(e)),[]);
  // опоры за дном
  const legsOk={...m,kitchen:{...m.kitchen!,legs:{back:70,front:70,xs:[50,550]}}};assert.deepEqual(validate(legsOk).filter(e=>/Опоры/.test(e)),[]);
  assert.ok(validate({...m,kitchen:{...m.kitchen!,legs:{back:70,front:700}}}).some(e=>/Опоры/.test(e)));
  assert.ok(validate({...m,kitchen:{...m.kitchen!,legs:{back:70,front:70,xs:[-5,300]}}}).some(e=>/Опоры/.test(e)));
  assert.ok(validate({...m,kitchen:{...m.kitchen!,legs:{back:70,front:70,pts:[[100,900]]}}}).some(e=>/Опоры/.test(e)));
  // столешница: глубина 400–1200
  const wt=createModule('worktop',2400,KITCHEN.worktopThickness,KITCHEN.worktopDepth,initialModule());
  assert.deepEqual(validate(wt).filter(e=>/глубина 400/.test(e)),[]);
  assert.ok(validate({...wt,depth:300}).some(e=>/Столешница: глубина 400–1200/.test(e)));
  assert.ok(validate({...wt,depth:1300}).some(e=>/Столешница: глубина 400–1200/.test(e)));
});
