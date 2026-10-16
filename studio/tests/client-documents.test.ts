// КП и документы для клиента (аудит магазина 15.10.2026, Б3 и п.9): описание по типу модуля, разбивка цены, шапка продавца,
// клиентские документы без номера заказа и служебных строк, чертежи в целых мм, склонения, без дублей предупреждений.
import test from 'node:test';
import assert from 'node:assert/strict';
import {initialModule} from '../src/model';
import {newProject} from '../src/project';
import {kitchenProject} from '../src/kitchenProject';
import {createKupeModule} from '../src/ModulePalette';
import {DEFAULT_KUPE} from '../src/kupe';
import {describeModule,drawerCount} from '../src/quoteDescribe';
import {quoteHTML,quoteBreakdown,clientSpecificationHTML,uniqueWarnings,orderNumber,nestingHTML,labelsHTML} from '../src/exports';
import {drawingLevels,drawingsHTML} from '../src/drawings';
import {estimate} from '../src/pricing';
import {plural,count,DETAILS} from '../src/ru';
import {hasSeller} from '../src/sellerInfo';
import {VERNISSAGE_MILLINGS} from '../src/facadesVernissage';

const strip=(html:string)=>html.replace(/<[^>]+>/g,' ');

test('склонения: 1 деталь, 3 детали, 5/11/12 деталей, 21 деталь, 22 детали',()=>{
  assert.equal(count(1,DETAILS),'1 деталь');assert.equal(count(3,DETAILS),'3 детали');assert.equal(count(5,DETAILS),'5 деталей');
  assert.equal(count(11,DETAILS),'11 деталей');assert.equal(count(12,DETAILS),'12 деталей');assert.equal(count(21,DETAILS),'21 деталь');assert.equal(count(22,DETAILS),'22 детали');
  assert.equal(plural(0,['ящик','ящика','ящиков']),'ящиков');
});

test('КП: двери купе — профиль и наполнение по полотнам, не корпус «пантографов: 0»',()=>{
  const m=createKupeModule(1800,2400,initialModule());
  m.kupe={...DEFAULT_KUPE,doors:3,system:'Стандарт (Аристо)',color:'Серебро матовое',fills:['Зеркало Серебро 4мм','Зеркало Серебро 4мм','Зеркало Серебро 4мм']};
  const d=describeModule(m);
  assert.equal(d.kind,'Двери купе');
  assert.ok(d.materials.some(x=>x.startsWith('Профиль: Стандарт (Аристо), цвет Серебро матовое')));
  assert.ok(d.materials.some(x=>x.includes('Зеркало Серебро 4мм — все 3 полотна')));
  assert.ok(d.filling.includes('3 полотна'));
  assert.ok(!d.materials.some(x=>x.startsWith('Корпус')));
  const p=newProject(m),html=quoteHTML(p,'','','');
  assert.ok(!html.includes('пантограф'));assert.ok(!html.includes('Корпус:'));
  // разное наполнение — по каждому полотну
  m.kupe.fills=['Зеркало Серебро 4мм',m.kupe.fills[0],'Зеркало Серебро 4мм'];m.kupe.doors=2;
  const two=describeModule(m);assert.ok(two.materials.some(x=>x.includes('все 2 полотна')));
});

test('КП: столешница — её материал и толщина; кухонный модуль с ящиками — фактическое число ящиков',()=>{
  const p=kitchenProject(),top=p.modules.find(a=>a.module.worktop)!.module,drw=p.modules.find(a=>a.module.kdrawers?.length)!.module;
  const t=describeModule(top);
  assert.equal(t.kind,'Столешница');assert.deepEqual(t.materials,[`Столешница: постформинг, ${top.worktop!.thickness} мм`]);
  assert.ok(t.size.endsWith('× '+top.worktop!.thickness));
  const d=describeModule(drw);
  assert.equal(drawerCount(drw),drw.kdrawers!.length);
  assert.ok(d.kind.startsWith('Кухонный нижний модуль'));
  assert.ok(d.filling.includes(`${drw.kdrawers!.length} ящика`),d.filling.join('|'));
  const sink=describeModule(p.modules.find(a=>a.module.kitchen?.appliance==='sink')!.module);
  assert.equal(sink.kind,'Кухонный нижний модуль под мойку');
  const html=strip(quoteHTML(p,'','',''));
  assert.ok(!/ящиков: 0|пантографов|штанг: 0/.test(html));
});

test('КП: фасады Вернисаж — серия, фрезеровка и покрытие; алюминий — профиль и вставка',()=>{
  const p=kitchenProject(),m=p.modules.find(a=>a.module.doors&&a.module.kitchen?.role==='base')!.module,id=VERNISSAGE_MILLINGS[0].id;
  m.vernissage={milling:id,cover:'film',film:'Моно белый',thickness:19};
  const d=describeModule(m),f=d.materials.find(x=>x.startsWith('Фасады:'))!;
  assert.ok(f.includes('«Вернисаж»')&&f.includes('серия «')&&f.includes('фрезеровка №'+id)&&f.includes('плёнка ПВХ «Моно белый»')&&f.includes('19 мм'),f);
  assert.ok(!f.includes(m.facadeDecor+'')||m.facadeDecor==='Моно белый','не декор ЛДСП «'+m.facadeDecor+'»');
  const w=newProject().modules[0].module;w.alu={profile:'F1-09',color:'silver',insert:'mirror-silver'};
  const a=describeModule(w).materials.find(x=>x.startsWith('Фасады:'))!;
  assert.ok(a.includes('алюминиевая рамка')&&a.includes('вставка'),a);
});

test('КП: шкаф — нулевые позиции не печатаются, есть полки/ящики со склонением',()=>{
  const p=newProject(),m=p.modules[0].module,d=describeModule(m);
  assert.equal(d.kind,'Шкаф');
  assert.ok(d.filling.every(x=>!/^0 /.test(x)));
  assert.ok(!d.filling.some(x=>x.includes('пантограф')));
  m.sections[0].pantograph=false;m.sections[0].rod=true;
  assert.ok(describeModule(m).filling.includes('1 штанга'));
});

test('КП: без «Стоимость введена менеджером»; разбивка материалы/фурнитура только при цене по смете (модель коэффициента)',()=>{
  const p=newProject(),e=estimate(p);
  assert.notEqual(e.retail,null);
  const html=quoteHTML(p,'Клиент','' + e.retail,'',undefined,{cost:e});
  assert.ok(!html.includes('введена менеджером'));
  const b=quoteBreakdown(String(e.retail),e)!;
  assert.ok(b&&b.material+b.hardware===e.retail&&b.hardware===e.split.hardware&&b.hardware>0);
  assert.ok(html.includes('Материалы')&&html.includes('Фурнитура')&&html.includes(b.hardware.toLocaleString('ru-RU')+' ₽'));
  // цена изменена вручную (скидка) — только итог
  assert.equal(quoteBreakdown(String(e.retail!-1000),e),null);
  assert.ok(!quoteHTML(p,'','' + (e.retail!-1000),'',undefined,{cost:e}).includes('Фурнитура'));
  // модель «цена за лист» — фурнитура внутри листа, разбивки нет
  assert.equal(quoteBreakdown(String(e.retail),{...e,model:'sheet'}),null);
  assert.ok(quoteHTML(p,'','','').includes('после согласования'));
});

test('КП: шапка продавца из настроек — пустая не печатается; номер заказа и «Заказ не указан» в клиентских документах не печатаются',()=>{
  const p=newProject();
  assert.ok(!quoteHTML(p,'','','',undefined,{seller:{name:'',contacts:'  '}}).includes('class="seller"'));
  assert.equal(hasSeller({name:'',contacts:''}),false);
  const html=quoteHTML(p,'','','',undefined,{seller:{name:'Салон <Тест>',contacts:'+7 000 000-00-00'}});
  assert.ok(html.includes('class="seller"')&&html.includes('Салон &lt;Тест&gt;')&&html.includes('+7 000 000-00-00'));
  p.measurement={number:'9990001',date:'',notes:''};
  for(const doc of [quoteHTML(p,'','',''),clientSpecificationHTML(p,'')]){assert.ok(!doc.includes('Заказ не указан'));assert.ok(!doc.includes('9990001'));}
  assert.equal(orderNumber(p),'9990001');assert.ok(labelsHTML(p).includes('9990001'));
  p.measurement.number='  ';assert.equal(orderNumber(p),'');
});

test('спецификация для клиента: изделия и материалы без цены и координат',()=>{
  const p=kitchenProject(),html=clientSpecificationHTML(p,'Проект 1');
  assert.ok(html.includes('<h1>Спецификация</h1>')&&html.includes('Столешница')&&html.includes('Кухонный навесной модуль'));
  assert.ok(!html.includes('₽')&&!/X \d+, Z \d+/.test(html)&&!html.includes('Технолог'));
});

test('чертежи: целые миллиметры, секции с 1, элементы вне секций — «—»',()=>{
  const p=kitchenProject();
  for(const a of p.modules)for(const l of drawingLevels(a.module)){
    for(const v of [l.bottom,l.top,l.center,l.fromOpening])assert.ok(Number.isInteger(v),a.module.name+' '+l.name+' '+v);
    assert.ok(l.section===null||l.section>=1);
  }
  const html=drawingsHTML(p);
  assert.ok(!/\d\.\d<\/td>/.test(html),'нет дробных мм в таблицах чертежей');
});

test('документы производства: склонение «деталь», понятное имя раскроя; предупреждения без дублей',()=>{
  const p=newProject();
  assert.ok(!/\b[234] деталей\b/.test(nestingHTML(p)));
  p.calculation={markup:2.2,overrides:{},cuttingEngine:'guillotine'};
  const g=nestingHTML(p);assert.ok(g.includes('под форматную пилу')&&!g.includes('гильотина как в Базисе'));
  assert.deepEqual(uniqueWarnings([{message:'а'},{message:'б'},{message:'а'}]).map(w=>w.message),['а','б']);
});
