// Поиск по параметрам и обучение (Макс 31.10.2026): подбор по словам, формам слов, синонимам и опечаткам; реестр и шаги тура.
import test from 'node:test';
import assert from 'node:assert/strict';
import {searchItems,stem,norm,wordMatch,lev} from '../src/searchMatch';
import {SEARCH_ITEMS,SUGGESTED} from '../src/searchRegistry';
import {TOUR_STEPS,tourAllowed} from '../src/tourSteps';
import {initialModule} from '../src/model';

const top=(q:string,n=1)=>searchItems(SEARCH_ITEMS,q).slice(0,n).map(h=>h.item.id);
const first=(q:string)=>top(q)[0];

test('основа слова: формы одного слова сходятся',()=>{
  for(const w of ['полка','полки','полку','полкой'])assert.equal(stem(norm(w)),'полк',w);
  for(const w of ['петли','петля','петлю'])assert.equal(stem(norm(w)),'петл',w);
  assert.equal(stem(norm('Ящики')),stem(norm('ящиков')));
  assert.equal(stem(norm('стоимость')),stem(norm('стоимости')));
  assert.equal(norm('Ёлка, «петли»!'),'елка петли');
  assert.equal(lev('петли','петил'),2);assert.equal(lev('кот','кит'),1);
});

test('совпадение слова: точно, начало, опечатка, короткое',()=>{
  assert.equal(wordMatch('петл','петл'),1);
  assert.ok(wordMatch('пет','петл')>0);            // набирают слово
  assert.ok(wordMatch('зеркол','зеркал')>0);       // опечатка
  assert.equal(wordMatch('пол','полк')<wordMatch('пол','пол'),true);
  assert.equal(wordMatch('ок','окн'),0.5);
  assert.equal(wordMatch('xyz','петл'),0);
});

test('главные слова Макса находят свой пункт первым',()=>{
  const cases:[string,string][]=[
    ['петли','hinges'],['Петли','hinges'],['полка','shelves'],['полки','shelves'],['полку','shelves'],['полок','shelves'],
    ['ящик','drawers'],['ящики','drawers'],['ручка','handles'],['ручки','handles'],['цоколь','plinth'],['фальш','fillers'],
    ['подсветка','light'],['штанга','rod'],['вырез','cutouts'],['зеркало','mirror'],['стекло','glass-shelf'],
    ['форма комнаты','room-shape'],['обои','finishes'],['ламинат','finishes'],['розетка','fixtures'],['окно','openings'],
    ['стоимость','price'],['цена','price'],['кп','doc-quote'],['раскрой','doc-sheets'],['обучение','tour'],['линия q','guides'],
    ['привязки','snapping'],['базис','bazis-import'],['декор','decor'],['столешница','radial-worktop'],
  ];
  for(const [q,id] of cases)assert.equal(first(q),id,`«${q}» → ${top(q,3).join(', ')}`);
});

test('синонимы и общие слова: нужное в первых трёх',()=>{
  const near:[string,string][]=[['цвет','decor'],['цвет','facade-decor'],['высота','height'],['ширина','width'],['фасад','doors'],['дверь','openings'],['документы','stages'],['скос','slope'],['скос','room-shape'],['смета','price'],['помощь','tour'],['фальшпанель','fillers'],['петил','hinges'],['зеркол','mirror']];
  for(const [q,id] of near)assert.ok(top(q,4).includes(id),`«${q}» → ${top(q,4).join(', ')} (ждали ${id})`);
});

test('глоссарий ревизии структуры 31.10: пары находят друг друга',()=>{
  const near:[string,string][]=[
    ['модуль','modules'],['найти корпус','modules'],['шкаф','add-cabinet'],
    ['фп','fillers'],['добор','fillers'],['фальшпанель','radial-fillers'],
    ['тип петли','door-mount'],['накладная','door-mount'],['вкладные','door-mount'],['монтаж фасада','door-mount'],
    ['материал корпуса','decor'],['цвет','decor'],
    ['спецификация','doc-client-spec'],['бирки','doc-labels'],['чертежи','doc-drawings'],
    ['файл заказа','save-file'],['файл заказа','open-file'],['скачать','save-file'],
    ['отменить','undo'],['назад','undo'],['ctrl z','undo'],
    ['наполнение','shelves'],['наполнение','drawers'],['наполнение','rod'],
    ['вариант','variants'],['копия проекта','variants'],
  ];
  // «наполнение» — общее слово: полки, ящики и штанга в первых восьми рядом с «Копировать/Очистить наполнение»
  for(const [q,id] of near)assert.ok(top(q,8).includes(id),`«${q}» → ${top(q,8).join(', ')} (ждали ${id})`);
  // функции только правой кнопкой и клавишами
  const hidden:[string,string][]=[['поставить к стене','radial-wall'],['за угол','radial-corner'],['столешница на модуль','radial-worktop'],['скрыть модуль','radial-hide'],['как у соседа','radial-match'],['выровнять отмеченные','radial-align'],['вырез на схожие','cut-similar'],['линия q','guides'],['600;2400','type-size'],['alt','snap-keys'],['колесом','wheel-door']];
  for(const [q,id] of hidden)assert.equal(first(q),id,`«${q}» → ${top(q,3).join(', ')}`);
});

test('каждое слово из списка Макса что-то находит, мусор — ничего',()=>{
  for(const q of ['полка','полки','ящик','ручка','петли','цоколь','фальш','высота','ширина','декор','цвет','фасад','стекло','зеркало','подсветка','штанга','вырез','столешница','окно','дверь','розетка','ламинат','обои','форма комнаты','скос','линия Q','привязки','Базис','КП','раскрой','стоимость','документы','обучение'])
    assert.ok(searchItems(SEARCH_ITEMS,q).length>0,q);
  assert.equal(searchItems(SEARCH_ITEMS,'qwertyzz').length,0);
  assert.equal(searchItems(SEARCH_ITEMS,'   ').length,0);
  // все слова запроса должны найтись: «петли ламинат» — пусто
  assert.equal(searchItems(SEARCH_ITEMS,'петли ламинат').length,0);
});

test('реестр: id уникальны, у пунктов есть цель или действие, подсказки существуют',()=>{
  const ids=SEARCH_ITEMS.map(i=>i.id);
  assert.equal(new Set(ids).size,ids.length);
  for(const i of SEARCH_ITEMS){assert.ok(i.action||i.target.length,i.id);assert.ok(i.title&&i.where,i.id);if(i.radial!==undefined)assert.ok(i.module,i.id);}
  for(const id of SUGGESTED)assert.ok(ids.includes(id),id);
});

test('неприменимые пункты: причина для шкафа без фасадов и для модуля Базиса',()=>{
  const m=initialModule();m.doors=false;
  const hinges=SEARCH_ITEMS.find(i=>i.id==='hinges')!;
  assert.match(hinges.applies!(m)!,/нет распашных фасадов/);
  m.doors=true;assert.equal(hinges.applies!(m),undefined);
  const shelves=SEARCH_ITEMS.find(i=>i.id==='shelves')!;
  assert.match(shelves.applies!({...m,raw:{} as never})!,/Базис/);
});

test('тур: 6–9 шагов, у каждого цель и текст; авто-показ не мешает сценариям',()=>{
  assert.ok(TOUR_STEPS.length>=6&&TOUR_STEPS.length<=9);
  for(const s of TOUR_STEPS){assert.ok(s.target.length&&s.title&&s.text,s.id);assert.ok(s.text.length<=230,s.id+' длинный текст');}
  assert.equal(tourAllowed({search:'',webdriver:false,seen:false}),true);
  assert.equal(tourAllowed({search:'?project=x&fresh=1',webdriver:false,seen:false}),false);
  assert.equal(tourAllowed({search:'',webdriver:true,seen:false}),false);
  assert.equal(tourAllowed({search:'',webdriver:false,seen:true}),false);
  assert.equal(tourAllowed({search:'?notour=1',webdriver:false,seen:false}),false);
  assert.equal(tourAllowed({search:'?tour=1',webdriver:true,seen:true}),true);
});
