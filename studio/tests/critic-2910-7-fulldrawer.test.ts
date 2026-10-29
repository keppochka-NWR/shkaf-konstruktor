// Находки критика релиз-кандидата 29.10.2026 (ветка claude/integ-2610): п.7 — выкатной ящик на всю секцию, фасад не выше 800.
import test from 'node:test';
import assert from 'node:assert/strict';
import { initialModule, section, parts, validate, type Module } from '../src/model';
import { fullSectionDrawer, fullDrawerFacadeH } from '../src/drawerModes';

const antresol = (height: number): Module => ({ ...initialModule(), name: 'Антресоль', width: 800, height, depth: 500, plinthHeight: 0, doors: true, sections: [{ ...section(), shelves: [0.5] }] });
const face = (m: Module) => parts(m).filter((p) => /:drawer:\d+:facade$/.test(p.id)).map((p) => p.size[1]);

test('п.7: антресоль 830 — «Один выкатной ящик на всю секцию» отказывает по высоте фасада (826 > 800), а не проёма (795)', () => {
  const m = antresol(830);
  assert.equal(Math.round(fullDrawerFacadeH(m, m.sections[0].id)), 826);
  assert.throws(() => fullSectionDrawer(structuredClone(m), m.sections[0].id), /Фасад ящика на всю секцию выйдет 826 мм — выше 800/);
});
test('п.7: антресоль 800 — ящик на всю секцию ставится, фасад 796 ≤ 800', () => {
  const m = antresol(800);
  fullSectionDrawer(m, m.sections[0].id);
  assert.deepEqual(validate(m), []);
  const f = face(m);
  assert.equal(f.length, 1);
  assert.ok(f[0] <= 800 && Math.abs(f[0] - fullDrawerFacadeH(m, m.sections[0].id)) < 0.01, 'фасад ' + f[0]);
});
