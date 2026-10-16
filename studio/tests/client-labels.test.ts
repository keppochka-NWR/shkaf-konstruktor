import test from 'node:test';
import assert from 'node:assert/strict';
import {VERNISSAGE_MILLINGS,vernissageMilling} from '../src/facadesVernissage';
import {ALLEGRO} from '../src/premialPullout';
import {HINGE_BRANDS,SLIDES} from '../src/hardware';
import {catalog} from '../src/catalog';
import {FACADE_KIND_LABEL,decorLabel,decorTitle,missingPriceLabel,newModuleName,hingeBrandLabel,kupeProfileCaption,allegroLabel,allegroVisible,millingName,millingOptionLabel,millingVisible,openingSizeLabel,gapLabelX} from '../src/clientLabels';

// Аудит магазина 15.10 «Лишние цифры и техмусор»: клиентские подписи без кодов, артикулов, пометок источника.
const TECH=/в раскрое цеха|сторонний участок|\(прайс\)|Импорт Базиса|паспорт|условно|₽\/шт|ФАМ|интерполяц|Сечение по заводскому|D\*/;

test('материал фасадов — клиентские названия',()=>{
 assert.equal(FACADE_KIND_LABEL.ldsp,'ЛДСП');
 assert.equal(FACADE_KIND_LABEL.vernissage,'МДФ Вернисаж');
 assert.equal(FACADE_KIND_LABEL.alu,'Алюминиевая рамка');
 for(const v of Object.values(FACADE_KIND_LABEL))assert.doesNotMatch(v,TECH);
});

test('фрезеровки Вернисаж: клиенту «№15 Мыло», менеджеру — паспорт/условно; неопознанные клиенту не показываются',()=>{
 const m15=vernissageMilling('15')!;
 assert.equal(millingOptionLabel(m15,{handle:false,misfit:false,manager:false}),'№15 Мыло');
 assert.match(millingOptionLabel(m15,{handle:false,misfit:false,manager:true}),/паспорт/);
 const unknown=vernissageMilling('8')!;
 assert.equal(millingName(unknown),null,'№8 — рисунок не определён');
 assert.equal(millingVisible(unknown,false,false),false,'клиенту не показываем');
 assert.equal(millingVisible(unknown,true,false),true,'уже выбранный остаётся в списке');
 assert.equal(millingVisible(unknown,false,true),true,'менеджеру видно');
 for(const m of VERNISSAGE_MILLINGS){
  const handle=m.series==='handle';
  const label=millingOptionLabel(m,{handle,misfit:false,manager:false});
  assert.doesNotMatch(label,TECH,label);
  assert.ok(label.length<=40,`коротко: ${label}`);
 }
 // в каждой серии клиенту остаётся выбор
 for(const s of new Set(VERNISSAGE_MILLINGS.filter(m=>m.series!=='pet').map(m=>m.series)))assert.ok(VERNISSAGE_MILLINGS.some(m=>m.series===s&&millingVisible(m,false,false)),s);
 assert.equal(millingOptionLabel(vernissageMilling('6')!,{handle:false,misfit:true,manager:false}),'№6 Шейкер · не по размеру фасадов');
});

test('бутылочница: без артикула клиенту, неподходящие скрыты; менеджеру — артикул и «не подходит»',()=>{
 const a=ALLEGRO[0];
 const client=allegroLabel(a,true,false);
 assert.ok(!client.includes(a.article));assert.doesNotMatch(client,/не подходит/);
 assert.match(client,/^АЛЛЕГРО \d+ · (левая|правая)$/);
 assert.match(allegroLabel(a,true,true),new RegExp(a.article+' — не подходит$'));
 assert.equal(allegroVisible(true,false,false),false);
 assert.equal(allegroVisible(true,true,false),true,'выбранный не пропадает');
 assert.equal(allegroVisible(true,false,true),true);
 assert.equal(allegroVisible(false,false,false),true);
});

test('петли без цены, профиль купе без «26.51 мм» и «Сечение…», ящики без «Закупка ФАМ»',()=>{
 for(const b of Object.values(HINGE_BRANDS)){const l=hingeBrandLabel(b);assert.doesNotMatch(l,/₽|\d{2,}/);assert.ok(l.startsWith(b.label));}
 assert.equal(kupeProfileCaption('ARISTO Шато',26.51,false),'Профиль-ручка · ARISTO Шато');
 assert.equal(kupeProfileCaption('ARISTO Шато',26.51,true),'Профиль-ручка · ARISTO Шато · 27 мм','менеджеру — целые мм');
 for(const s of Object.values(SLIDES))assert.doesNotMatch(s.note,/ФАМ|интерполяц|закупк|вашему/i);
});

test('декоры без кодов и «D*» в подписи, код — в подсказке',()=>{
 assert.equal(decorLabel('Серый 7810'),'Серый');
 assert.equal(decorLabel('Орех Бруно D*'),'Орех Бруно');
 assert.equal(decorLabel('Дуб Вотан'),'Дуб Вотан');
 assert.equal(decorTitle('Дуб Вотан'),undefined);
 assert.match(decorTitle('Серый 7810')!,/7810/);
 for(const c of catalog)assert.doesNotMatch(decorLabel(c.n),/D\*|\s\d{3,}$/,c.n);
 // подписи не склеивают два разных декора каталога в одно имя
 const seen=new Map<string,string>();for(const c of catalog){const l=decorLabel(c.n);assert.ok(!seen.has(l)||seen.get(l)===c.n,`${c.n} и ${seen.get(l)} → ${l}`);seen.set(l,c.n);}
});

test('«Нет цены: N» → нейтрально, имя модуля без номера, проём с «мм»',()=>{
 assert.equal(missingPriceLabel(7),'Цена уточняется (7 поз.)');
 assert.doesNotMatch(missingPriceLabel(7),/Нет цены/);
 assert.equal(newModuleName('Для одежды'),'Для одежды');
 assert.equal(newModuleName('Для одежды 4'),'Для одежды');
 assert.equal(openingSizeLabel(451),'451 мм');
 assert.equal(openingSizeLabel(1224.6),'1225 мм');
});

test('подписи проёмов крайних секций — снаружи корпуса, средней — по центру секции',()=>{
 const W=1200,t=16;
 assert.ok(gapLabelX({x:t,width:W-2*t},W,t)>W/2,'одна секция — справа снаружи');
 assert.ok(gapLabelX({x:t,width:400},W,t)< -W/2,'левая — слева снаружи');
 assert.equal(gapLabelX({x:432,width:336},W,t),432+168-W/2,'средняя — центр секции');
});
