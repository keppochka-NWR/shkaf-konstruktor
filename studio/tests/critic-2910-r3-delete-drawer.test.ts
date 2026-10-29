// Повторная проверка критика 29.10 (круг 3): ловушка удаления — плашка выбранной детали «Ящик N» с общим «Удалить» и клавиша Delete
// снимали только фасад ящика (короб без фасада). Теперь «Удалить ящик» / Delete — весь ящик (wholeDrawerPid), «Снять фасад» — отдельно.
// Мышью — scripts/critic-2910-scenario.ts (H).
import test from 'node:test';
import assert from 'node:assert/strict';
import { newProject, type Project } from '../src/project';
import { initialModule, parts, validate, type Module } from '../src/model';
import { removePart, wholeDrawerPid } from '../src/operations';
import { createModule } from '../src/ModulePalette';

const one = (m: Module): Project => { const p = newProject(m); p.modules = [{ id: 'm0', x: 30, y: 0, z: 30, rotation: 0, module: m }]; return p; };
const faces = (m: Module) => parts(m).filter((p) => /:drawer:\d+:facade$/.test(p.id)).length;

test('Удалить / Delete у выбранного фасада ящика — весь ящик; «Снять фасад» — только фасад', () => {
  const m = createModule('drawers', 800, 1000, 550, initialModule()), sid = m.sections[0].id, facade = `${sid}:drawer:0:facade`;
  // выбранная деталь — фасад ящика (щелчок по сцене, вкладка «Ящик 1»): как было — removePart(фасад) оставлял короб без фасада
  const old = removePart(one(m), 'm0', sid, facade).modules[0].module;
  assert.equal(old.sections[0].drawers, 3, 'находка: ящиков столько же');
  assert.equal(faces(old), 2, 'находка: у ящика 1 нет фасада');
  // «Удалить ящик» / Delete
  assert.equal(wholeDrawerPid(facade), `${sid}:drawer:0:bottom`);
  const whole = removePart(one(m), 'm0', sid, wholeDrawerPid(facade)).modules[0].module;
  assert.equal(whole.sections[0].drawers, 2); assert.equal(faces(whole), 2); assert.deepEqual(validate(whole), []);
  // остальные детали — как были
  for (const pid of [`${sid}:shelf:0`, `${sid}:drawer:1:left`, `${sid}:rod`, `${sid}:door:0`]) assert.equal(wholeDrawerPid(pid), pid);
});
