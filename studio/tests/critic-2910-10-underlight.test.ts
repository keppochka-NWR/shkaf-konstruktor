// Находки критика релиз-кандидата 29.10.2026 (ветка claude/integ-2610): п.10 — блок питания подсветки под навесными при удалении модуля.
import test from 'node:test';
import assert from 'node:assert/strict';
import { initialModule } from '../src/model';
import { newProject, type Project } from '../src/project';
import { createKitchenRow } from '../src/ModulePalette';
import { estimate } from '../src/pricing';
import { setRowUnderLight, wallRowIds, keepRowPsu } from '../src/kitchenUnderLightRow';

const row = (): Project => ({ ...newProject(), room: { ...newProject().room, width: 3000 }, modules: createKitchenRow(2400, initialModule()) });
const psuQty = (p: Project) => estimate(p).lines.find((l) => l.id === 'light-psu')?.quantity ?? 0;

test('п.10: удалили навесной с блоком питания — блок переезжает на крайний левый подсвеченный модуль ряда (строка 1 800 остаётся)', () => {
  const p = row(), first = p.modules.find((a) => a.module.kitchen?.role === 'wall')!, ids = wallRowIds(p, first.id);
  const lit = setRowUnderLight(p, ids[2], true);
  assert.equal(lit.modules.find((a) => a.id === ids[0])!.module.lightPsu, true);
  assert.equal(psuQty(lit), 1);
  const removed: Project = { ...lit, modules: lit.modules.filter((a) => a.id !== ids[0]) };
  assert.equal(psuQty(removed), 0, 'находка: без переноса блок питания пропадал молча');
  const r = keepRowPsu(lit, removed);
  assert.equal(psuQty(r.project), 1, 'блок питания в смете остался');
  assert.equal(r.project.modules.find((a) => a.id === ids[1])!.module.lightPsu, true, 'на следующем слева модуле ряда');
  assert.match(r.notes.join(' '), /Блок питания подсветки перенесён/);
  // удалили модуль без блока — ничего не меняется
  const other = keepRowPsu(lit, { ...lit, modules: lit.modules.filter((a) => a.id !== ids[3]) });
  assert.deepEqual(other.notes, []);
  // подсветку ряда сняли целиком, затем удалили модуль — блок не добавляется
  const off = setRowUnderLight(lit, ids[0], false);
  assert.equal(psuQty(keepRowPsu(off, { ...off, modules: off.modules.filter((a) => a.id !== ids[0]) }).project), 0);
});
