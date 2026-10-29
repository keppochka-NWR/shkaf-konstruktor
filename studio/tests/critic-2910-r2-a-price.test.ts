// Повторная проверка критика 29.10 (круг 2), находка A: «Восстановить предыдущий проект» в окне «Новый проект» комнаты заказа молча
// заменял модель цены всего заказа (резервная копия шла мимо защиты импорта). Тест воспроизводит находку и проверяет путь окна:
// NewProjectPanel → open(проект, «резервной копии») → withOrderCalculation + orderCalculationNotice → updateRoom (как App).
import test from 'node:test';
import assert from 'node:assert/strict';
import { newProject, parseProject } from '../src/project';
import { withPriceModel, withOrderCalculation, orderCalculationNotice } from '../src/priceModel';
import { activeRoom, addRoom, migrateRoomDocument, updateRoom } from '../src/roomDocument';

function twoRoomOrder() {
  let d = migrateRoomDocument(newProject());
  d = updateRoom(d, d.activeRoomId, withPriceModel(activeRoom(d).project, 'max', 23000));
  return addRoom(d, 'Спальня');
}
const backup = () => parseProject(JSON.parse(JSON.stringify(withPriceModel(newProject(), 'sheet', 19000))));

test('A: резервная копия «за лист» 19 000 в комнате заказа «по большей модели» 23 000 — модель заказа сохранена, сообщение', () => {
  const d = twoRoomOrder(), order = activeRoom(d).project.calculation;
  // как было: проект резервной копии напрямую в комнату — весь заказ становится «за лист» 19 000
  const old = updateRoom(d, d.activeRoomId, backup());
  assert.equal(old.calculation?.model, 'sheet', 'находка воспроизводится: модель заказа заменена молча');
  assert.equal(old.calculation?.sheetPrice, 19000);
  // как теперь (App, окно «Новый проект» → «Восстановить предыдущий проект»): как импорт
  const own = withOrderCalculation(backup(), order);
  const n = updateRoom(d, d.activeRoomId, own.project);
  assert.equal(n.calculation?.maxModel, true, 'заказ — по большей модели');
  assert.equal(n.calculation?.sheetPrice, 23000);
  assert.ok(n.rooms.every((r) => r.project.calculation?.maxModel && r.project.calculation.sheetPrice === 23000 && r.project.calculation.model !== 'sheet'), 'все комнаты — по модели заказа');
  const note = orderCalculationNotice(own, order, 'резервной копии');
  assert.ok(note, 'менеджеру сообщение');
  assert.match(note!.text, /В резервной копии своя модель цены — за лист ЛДСП \(19\s000 ₽\/лист\)/);
  assert.match(note!.text, /по модели заказа — по большей модели \(23\s000 ₽\/лист\)/);
});

test('A: модель заказа не выбрана (по умолчанию) — модель из файла/копии применяется к заказу, но не молча: сообщение какая', () => {
  const d = migrateRoomDocument(newProject());
  const order = activeRoom(d).project.calculation;
  assert.equal(order, undefined, 'заказ по умолчанию — расчёт не задан');
  const own = withOrderCalculation(backup(), order);
  assert.equal(own.adopted?.model, 'sheet');
  const n = updateRoom(d, d.activeRoomId, own.project);
  assert.equal(n.calculation?.model, 'sheet', 'модель файла стала моделью заказа');
  const note = orderCalculationNotice(own, order, 'файле');
  assert.equal(note?.title, 'Модель цены заказа');
  assert.match(note!.text, /модель цены не была выбрана — применена модель из файла: за лист ЛДСП \(19\s000 ₽\/лист\)/);
  assert.match(orderCalculationNotice(own, order, 'резервной копии')!.text, /из резервной копии/);
  // файл без своей модели и «Создать новый проект» — без сообщения
  assert.equal(orderCalculationNotice(withOrderCalculation(newProject(), order), order, 'файле'), undefined);
  assert.equal(orderCalculationNotice(withOrderCalculation(newProject(), withPriceModel(newProject(), 'max', 23000).calculation), order, 'файле'), undefined);
});
