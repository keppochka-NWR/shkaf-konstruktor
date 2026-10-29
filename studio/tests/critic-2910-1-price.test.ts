// Находки критика релиз-кандидата 29.10.2026 (ветка claude/integ-2610): модель цены — свойство заказа — тестом, воспроизводящим находку.
import test from 'node:test';
import assert from 'node:assert/strict';
import { newProject, parseProject, type Project } from '../src/project';
import { estimate } from '../src/pricing';
import { withPriceModel, withOrderCalculation } from '../src/priceModel';
import { activeRoom, addRoom, migrateRoomDocument, updateRoom } from '../src/roomDocument';
import { initialModule, section } from '../src/model';

// ───────── 1. модель цены заказа не стирается ─────────
test('блокер 1: «Новый проект» / «без мебели» / файл без расчёта в комнате не стирают модель цены заказа', () => {
  let d = migrateRoomDocument(newProject());
  d = updateRoom(d, d.activeRoomId, withPriceModel(activeRoom(d).project, 'max', 23000));
  d = addRoom(d, 'Спальня');
  const second = d.activeRoomId, first = d.rooms[0].id;
  assert.ok(d.rooms.every((r) => r.project.calculation?.maxModel));
  // «Новый проект» (newProject() без расчёта) во второй комнате
  const fresh = newProject({ ...initialModule(), sections: [section()] });
  assert.equal(fresh.calculation, undefined);
  let n = updateRoom(d, second, fresh);
  assert.equal(n.calculation?.maxModel, true, 'документ сохранил модель');
  assert.ok(n.rooms.every((r) => r.project.calculation?.maxModel && r.project.calculation.sheetPrice === 23000), 'все комнаты — по модели заказа');
  // «Создать проект без мебели»
  n = updateRoom(n, first, { ...newProject(), modules: [] });
  assert.ok(n.calculation?.maxModel && n.rooms.every((r) => r.project.calculation?.maxModel));
  // импорт файла без расчёта
  const file = JSON.parse(JSON.stringify(fresh)); delete file.calculation;
  n = updateRoom(n, second, parseProject(file));
  assert.ok(n.calculation?.maxModel && n.rooms.every((r) => r.project.calculation?.maxModel));
  // цена комнаты — по большей модели (а не по коэффициенту по умолчанию)
  const e = estimate(activeRoom(n).project);
  assert.equal(e.retail, Math.max(e.byMarkup ?? 0, e.bySheet));
});

test('блокер 1: импорт файла со своей моделью — модель заказа приоритетна, модель файла возвращается для предупреждения', () => {
  const order = withPriceModel(newProject(), 'max', 23000).calculation;
  const file = withPriceModel(newProject(), 'markup', 23000);
  file.calculation!.markup = 3;
  const r = withOrderCalculation(file, order);
  assert.equal(r.project.calculation?.maxModel, true);
  assert.equal(r.replaced?.markup, 3, 'модель файла — для предупреждения');
  const same = withOrderCalculation(withPriceModel(newProject(), 'max', 23000), order);
  assert.equal(same.replaced, undefined, 'та же модель — без предупреждения');
  const none: Project = { ...newProject() }; delete none.calculation;
  assert.equal(withOrderCalculation(none, order).replaced, undefined, 'без поля — молча');
  assert.equal(withOrderCalculation(file, undefined).project, file, 'вне заказа — как было');
});
