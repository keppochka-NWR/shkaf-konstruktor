// w-formerrors (задача Макса 23.10 «ошибки списком»): форма «Добавить мебель» показывает все ошибки сразу, у полей, с пределом,
// «Что сделать» и исправлением; автоисправление даёт допустимый модуль; отказ поля «Габариты» — все причины списком.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {initialModule,parts,validate,RULES} from '../src/model';
import {createModule,createKupeWardrobe,createKitchenRow} from '../src/ModulePalette';
import {createModuleRow,bodyWidths} from '../src/paletteBuild';
import {paletteIssues,paletteAutoFix,paletteErrors,fieldReasons} from '../src/paletteCheck';

const source=initialModule();

// волна 29.10: корпус от 100×100 (было 250×250) — пределы в текстах 100
test('w059-подобный ввод 3000 × 2600 × 150: три ошибки сразу, каждая у своего поля, с пределом, подсказкой и исправлением',()=>{
  const list=paletteIssues({kind:'empty',width:3000,height:2600,depth:150,doors:4},source);
  assert.equal(list.length,3,list.map(x=>x.problem).join(' / '));
  const [w,h,d]=list;
  assert.equal(w.field,'width');assert.equal(w.problem,'Ширина 3000 > 2782 мм');assert.deepEqual(w.limit,{min:RULES.minW,max:RULES.maxW});
  assert.match(w.action,/Разделите на 2 корпуса по 1500 мм/);assert.deepEqual(w.fixes.map(f=>f.label),['2 корпуса по 1500 мм','Ширина 2782']);
  assert.equal(h.field,'height');assert.equal(h.problem,'Высота 2600 > 2500 мм');assert.match(h.action,/Максимум 2500 мм/);assert.deepEqual(h.fixes[0].patch,{height:2500});
  assert.equal(d.field,'depth');assert.equal(d.problem,'Глубина 150 < 200 мм');assert.match(d.action,/Минимум 200 мм/);assert.deepEqual(d.fixes[0].patch,{depth:200});
  // исходные тексты проверки не изменились — разбираются, а не переписываются
  assert.deepEqual(list.map(x=>x.text),['Ширина: допустимо от 100 до 2782 мм.','Высота: допустимо от 100 до 2500 мм. Выше 2500 — без задней стенки или с задником ЛДСП (до 2730 по листу 2750).' /* заказ 7442203 */,'Глубина: допустимо от 200 до 2782 мм.']);
});

test('«Исправить автоматически» для 3000 × 2600 × 150: 2 корпуса по 1500 × 2500 × 200 — допустимые модули, ошибок не осталось',()=>{
  const r=paletteAutoFix({kind:'empty',width:3000,height:2600,depth:150,doors:4},source);
  assert.deepEqual(r.patch,{bodies:2,height:2500,depth:200});
  assert.equal(r.left.length,0);
  const row=createModuleRow('empty',r.input.width,r.input.bodies!,r.input.height,r.input.depth,source,r.input.doors);
  assert.equal(row.length,2);
  for(const a of row){assert.deepEqual(validate(a.module),[]);assert.equal(a.module.height,2500);assert.equal(a.module.depth,200);}
  assert.deepEqual(row.map(a=>a.module.width),[1500,1500]);
  assert.equal(row[1].x,row[0].x+1500,'корпуса вплотную в ряд');
});

test('w059 тестера-2 (3001 × 2587): ширина, высота и «фасад шире 600» — сразу, третья проверена на исправленных размерах',()=>{
  const list=paletteIssues({kind:'empty',width:3001,height:2587,depth:600},source);
  assert.deepEqual(list.map(x=>x.field),['width','height','doors']);
  assert.match(list[0].action,/2 корпуса 1500 \+ 1501 мм/);
  assert.ok(list[2].after);assert.match(list[2].problem,/^При 3001 \(2 корпуса\) × 2500 × 600: фасад шире 600 мм при высоте 2468/);
  assert.equal(list[2].fixes[0].label,'4 двери · 2 секции');
  const r=paletteAutoFix({kind:'empty',width:3001,height:2587,depth:600},source);
  assert.deepEqual(r.patch,{bodies:2,height:2500,doors:4});assert.equal(r.left.length,0);
  const row=createModuleRow('empty',3001,2,2500,600,source,4);
  assert.deepEqual(row.map(a=>a.module.width),[1500,1501]);
  for(const a of row){assert.deepEqual(validate(a.module),[]);assert.equal(a.module.sections.length,2);
    const doors=parts(a.module).filter(p=>p.role==='door');assert.equal(doors.length,4);assert.ok(doors.every(p=>p.width<=600));}
});

test('один цикл вместо трёх: до — ошибки по одной (createModule бросает первую), после — все в одном списке',()=>{
  // «до»: каждое «Добавить» показывает одну ошибку; исправляем её — следующая
  const steps:[number,number,number|undefined][]=[[3001,2587,undefined],[1501,2587,undefined],[1501,2500,undefined]],seen:string[]=[];
  for(const [w,h,doors] of steps){try{createModule('empty',w,h,600,source,doors);seen.push('ok');}catch(e){seen.push((e as Error).message);}}
  assert.deepEqual(seen,['Ширина: допустимо от 100 до 2782 мм.','Высота: допустимо от 100 до 2500 мм. Выше 2500 — без задней стенки или с задником ЛДСП (до 2730 по листу 2750).' /* заказ 7442203: подсказка, как получить выше 2500 */,'Фасад шире 600 мм при высоте 2468. Разделите модуль на секции или уберите фасады.']);
  // «после»: те же три причины — в первом же списке
  const now=paletteIssues({kind:'empty',width:3001,height:2587,depth:600},source).map(x=>x.text);
  for(const t of seen)assert.ok(now.includes(t),t);
});

test('сборка палитры без проверки формы — прежние исключения и тексты (тесты и вызовы не ломаются)',()=>{
  assert.throws(()=>createModule('empty',3000,2600,150,source),/^Error: Ширина: допустимо от 100 до 2782 мм\.$/);
  assert.throws(()=>createKupeWardrobe(2400,2400,300,source),/Глубина шкафа-купе от 450 мм: 100 мм занимают направляющие\./);
  assert.throws(()=>createKitchenRow(7000,source),/Прямая кухня: длина стены 600–6000 мм\./);
  assert.deepEqual(bodyWidths(3001,2),[1500,1501]);
});

test('другие виды: кухня прямая, шкаф-купе, стол, двери купе — ошибки у полей с исправлением',()=>{
  const row=paletteIssues({kind:'kitchen-row',width:7000,height:870,depth:560},source);
  assert.equal(row[0].field,'width');assert.equal(row[0].problem,'Длина 7000 > 6000 мм');assert.equal(row[0].fixes[0].label,'Длина 6000');assert.deepEqual(row[0].auto,{width:6000,bodies:1});
  const kupe=paletteIssues({kind:'kupe-wardrobe',width:2400,height:2400,depth:300,mount:'free'},source);
  assert.equal(kupe[0].field,'depth');assert.equal(kupe[0].problem,'Глубина 300 < 450 мм');
  assert.ok(paletteErrors({kind:'kupe-wardrobe',width:2400,height:2400,depth:300,mount:'free'},source).length>=1);
  const desk=paletteIssues({kind:'desk',width:3000,height:900,depth:600},source);
  assert.deepEqual(desk.map(x=>x.field),['width','height']);
  const doors=paletteAutoFix({kind:'kupe',width:7000,height:3200,depth:100},source);
  assert.equal(doors.left.length,0,doors.left.map(x=>x.problem).join(' / '));assert.equal(doors.patch.width,6000);assert.equal(doors.patch.height,3000);assert.ok(doors.patch.doors);
});

test('п.3: отказ поля «Ширина» 3000 у корпуса с одной секцией — все причины: предел и фасады шире 600',()=>{
  const m=createModule('empty',900,2000,550,source);
  const more=fieldReasons(m,'width',3000);
  assert.ok(more.some(e=>/^Фасад шире 600 мм/.test(e)),more.join(' / '));
  assert.ok(!more.some(e=>/^Ширина: допустимо/.test(e)),'предел поля пишет само поле, не дублируется');
  // validate по умолчанию — как было: при недопустимой ширине только ошибки габаритов
  assert.deepEqual(validate({...m,width:3000}),['Ширина: допустимо от 100 до 2782 мм.']);
  assert.ok(validate({...m,width:3000},{all:true}).length>1);
});

test('форма: проверка после выхода из поля, ошибки у полей, «Исправить автоматически», корпуса в ряд; панель — причины списком',()=>{
  const palette=readFileSync(new URL('../src/ModulePalette.tsx',import.meta.url),'utf8');
  assert.match(palette,/onBlur=\{\(\)=>leave\(f\.key\)\}/);
  assert.match(palette,/aria-invalid=\{bad\(f\.key\)\|\|undefined\}/);
  assert.match(palette,/Исправить автоматически/);
  assert.match(palette,/Корпусов в ряд/);
  const app=readFileSync(new URL('../src/App.tsx',import.meta.url),'utf8');
  assert.equal((app.match(/reasons=\{v=>\(\{list:fieldReasons\(m,'(width|height|depth)',v\)/g)??[]).length,3);
  const kp=readFileSync(new URL('../src/KitchenPanel.tsx',import.meta.url),'utf8');
  assert.equal((kp.match(/reasons=\{\(v\) => \(\{ list: fieldReasons\(m, "(width|height|depth)", v\)/g)??[]).length,3);
  const kpal=readFileSync(new URL('../src/KitchenPalette.tsx',import.meta.url),'utf8');
  assert.match(kpal,/onBlur=\{\(\) => setLenSeen\(true\)\}/);
});
