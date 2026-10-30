// Находки критика релиз-кандидата 29.10.2026 (ветка claude/integ-2610): настройки расчёта — свойство заказа — тестом, воспроизводящим находку.
// С 30.10.2026 цена — только по листам (выбора «Модель цены» нет); свойство заказа — цена листа, коэффициент, ручные цены.
import test from 'node:test';
import assert from 'node:assert/strict';
import { newProject, parseProject, type Project } from '../src/project';
import { estimate } from '../src/pricing';
import { withOrderCalculation } from '../src/priceModel';
import { activeRoom, addRoom, migrateRoomDocument, updateRoom } from '../src/roomDocument';
import { initialModule, section } from '../src/model';

const withSheet = (p: Project, sheetPrice: number): Project => ({ ...p, calculation: { ...(p.calculation ?? { markup: 2.2, overrides: {} }), sheetPrice } });

// ───────── 1. настройки расчёта заказа не стираются ─────────
test('блокер 1: «Новый проект» / «без мебели» / файл без расчёта в комнате не стирают настройки расчёта заказа', () => {
  let d = migrateRoomDocument(newProject());
  d = updateRoom(d, d.activeRoomId, withSheet(activeRoom(d).project, 25000));
  d = addRoom(d, 'Спальня');
  const second = d.activeRoomId, first = d.rooms[0].id;
  assert.ok(d.rooms.every((r) => r.project.calculation?.sheetPrice === 25000));
  // «Новый проект» (newProject() без расчёта) во второй комнате
  const fresh = newProject({ ...initialModule(), sections: [section()] });
  assert.equal(fresh.calculation, undefined);
  let n = updateRoom(d, second, fresh);
  assert.equal(n.calculation?.sheetPrice, 25000, 'документ сохранил настройки');
  assert.ok(n.rooms.every((r) => r.project.calculation?.sheetPrice === 25000), 'все комнаты — по настройкам заказа');
  // «Создать проект без мебели»
  n = updateRoom(n, first, { ...newProject(), modules: [] });
  assert.ok(n.calculation?.sheetPrice === 25000 && n.rooms.every((r) => r.project.calculation?.sheetPrice === 25000));
  // импорт файла без расчёта
  const file = JSON.parse(JSON.stringify(fresh)); delete file.calculation;
  n = updateRoom(n, second, parseProject(file));
  assert.ok(n.calculation?.sheetPrice === 25000 && n.rooms.every((r) => r.project.calculation?.sheetPrice === 25000));
  // цена комнаты — по листам с ценой листа заказа
  const e = estimate(activeRoom(n).project);
  assert.equal(e.sheetPrice, 25000); assert.equal(e.retail, e.bySheet);
});

test('блокер 1: импорт файла со своими настройками — настройки заказа приоритетны, настройки файла возвращаются для предупреждения', () => {
  const order = withSheet(newProject(), 25000).calculation;
  const file = withSheet(newProject(), 25000);
  file.calculation!.markup = 3;
  const r = withOrderCalculation(file, order);
  assert.equal(r.project.calculation?.markup, 2.2);
  assert.equal(r.replaced?.markup, 3, 'настройки файла — для предупреждения');
  const same = withOrderCalculation(withSheet(newProject(), 25000), order);
  assert.equal(same.replaced, undefined, 'те же настройки — без предупреждения');
  // старый файл «по большей модели» с той же ценой листа после загрузки (поле отброшено) — те же настройки, без предупреждения
  const old = parseProject(JSON.parse(JSON.stringify({ ...newProject(), calculation: { ...order, maxModel: true } })));
  assert.equal(withOrderCalculation(old, order).replaced, undefined, 'устаревшая модель цены — не повод для предупреждения');
  const none: Project = { ...newProject() }; delete none.calculation;
  assert.equal(withOrderCalculation(none, order).replaced, undefined, 'без поля — молча');
  assert.equal(withOrderCalculation(file, undefined).project, file, 'вне заказа — как было');
});
