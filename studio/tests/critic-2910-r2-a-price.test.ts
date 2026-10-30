// Повторная проверка критика 29.10 (круг 2), находка A: «Восстановить предыдущий проект» в окне «Новый проект» комнаты заказа молча
// заменял настройки расчёта всего заказа (резервная копия шла мимо защиты импорта). Тест воспроизводит находку и проверяет путь окна:
// NewProjectPanel → open(проект, «резервной копии») → withOrderCalculation + orderCalculationNotice → updateRoom (как App).
// С 30.10.2026 цена — только по листам: различаются цена листа, коэффициент и ручные цены, «модели цены» нет.
import test from 'node:test';
import assert from 'node:assert/strict';
import { newProject, parseProject, type Project } from '../src/project';
import { withOrderCalculation, orderCalculationNotice } from '../src/priceModel';
import { activeRoom, addRoom, migrateRoomDocument, updateRoom } from '../src/roomDocument';

const withSheet = (p: Project, sheetPrice: number): Project => ({ ...p, calculation: { ...(p.calculation ?? { markup: 2.2, overrides: {} }), sheetPrice } });
function twoRoomOrder() {
  let d = migrateRoomDocument(newProject());
  d = updateRoom(d, d.activeRoomId, withSheet(activeRoom(d).project, 23000));
  return addRoom(d, 'Спальня');
}
// резервная копия старого формата: «за лист» 19 000 (поле model отбрасывается при загрузке, цена листа остаётся)
const backup = () => parseProject(JSON.parse(JSON.stringify({ ...newProject(), calculation: { markup: 2.2, overrides: {}, model: 'sheet', sheetPrice: 19000 } })));

test('A: резервная копия с ценой листа 19 000 в комнате заказа 23 000 — настройки заказа сохранены, сообщение', () => {
  const d = twoRoomOrder(), order = activeRoom(d).project.calculation;
  // как было: проект резервной копии напрямую в комнату — весь заказ становится 19 000
  const old = updateRoom(d, d.activeRoomId, backup());
  assert.equal(old.calculation?.sheetPrice, 19000, 'находка воспроизводится: настройки заказа заменены молча');
  assert.equal(old.calculation?.model, undefined, 'устаревшая модель цены отброшена');
  // как теперь (App, окно «Новый проект» → «Восстановить предыдущий проект»): как импорт
  const own = withOrderCalculation(backup(), order);
  const n = updateRoom(d, d.activeRoomId, own.project);
  assert.equal(n.calculation?.sheetPrice, 23000);
  assert.ok(n.rooms.every((r) => r.project.calculation?.sheetPrice === 23000), 'все комнаты — по настройкам заказа');
  const note = orderCalculationNotice(own, order, 'резервной копии');
  assert.ok(note, 'менеджеру сообщение');
  assert.match(note!.text, /В резервной копии свои настройки расчёта — цена листа 19\s000 ₽/);
  assert.match(note!.text, /по настройкам заказа — цена листа 23\s000 ₽/);
  assert.doesNotMatch(note!.text + note!.title, /модел|коэффициент/i, 'без слов о модели цены');
});

test('A: настройки заказа не заданы (по умолчанию) — настройки из файла/копии применяются к заказу, но не молча: сообщение какие', () => {
  const d = migrateRoomDocument(newProject());
  const order = activeRoom(d).project.calculation;
  assert.equal(order, undefined, 'заказ по умолчанию — расчёт не задан');
  const own = withOrderCalculation(backup(), order);
  assert.equal(own.adopted?.sheetPrice, 19000);
  const n = updateRoom(d, d.activeRoomId, own.project);
  assert.equal(n.calculation?.sheetPrice, 19000, 'настройки файла стали настройками заказа');
  const note = orderCalculationNotice(own, order, 'файле');
  assert.equal(note?.title, 'Расчёт заказа');
  assert.match(note!.text, /настройки расчёта не были заданы — применены настройки из файла: цена листа 19\s000 ₽/);
  assert.match(orderCalculationNotice(own, order, 'резервной копии')!.text, /из резервной копии/);
  // файл без своих настроек и «Создать новый проект» — без сообщения
  assert.equal(orderCalculationNotice(withOrderCalculation(newProject(), order), order, 'файле'), undefined);
});
