// Находки критика релиз-кандидата 29.10.2026 (ветка claude/integ-2610): п.5 — поле «Высота фасада ящика» = видимый фасад; щель между фасадами.
import test from 'node:test';
import assert from 'node:assert/strict';
import { initialModule, section, parts, validate, type Module } from '../src/model';
import { newProject, type Project } from '../src/project';
import { editDrawerConfig, facadeForVisible, visibleFacadeH } from '../src/drawerEditing';
import { drawerGapWarnings } from '../src/roomWarnings';

const one = (m: Module): Project => { const p = newProject(m); p.modules = [{ id: 'm0', x: 30, y: 0, z: 30, rotation: 0, module: m }]; return p; };
/** Подвесной корпус с двумя ящиками (без цоколя, поднят «От пола»): нижний накладной фасад продлевается на 14 мм до низа фасадов. */
const hanging = (): Module => ({ ...initialModule(), name: 'Подвесной', width: 600, height: 400, depth: 500, plinthHeight: 0, doors: false, sections: [{ ...section(), shelves: [], drawers: 2, drawerCap: false, drawerConfigs: [{ slide: 'ball', height: 79, length: 450, y: 0 }, { slide: 'ball', height: 129, length: 450, y: 119 }] }] });
const faces = (m: Module) => parts(m).filter((p) => /:drawer:\d+:facade$/.test(p.id)).map((p) => ({ lo: p.position[1] - p.size[1] / 2, h: p.size[1] })).sort((a, b) => a.lo - b.lo);
const withConfigs = (m: Module, c: Module['sections'][number]['drawerConfigs']): Module => ({ ...m, sections: [{ ...m.sections[0], drawerConfigs: c }] });

test('п.5: поле показывает видимую высоту фасада (как деталь), а не высоту фасада модели', () => {
  const m = hanging(), s = m.sections[0];
  faces(m).forEach((f, j) => assert.equal(visibleFacadeH(m, s, j), Math.round(f.h * 10) / 10));
});
test('п.5: менеджер вводит видимый фасад с эскиза (196) — деталь 196; раньше модель понимала 196 как фасад без продления (деталь 211)', () => {
  const m = hanging(), s = m.sections[0];
  // как было: высота фасада модели 196 → нижний фасад продлевается до низа фасадов → деталь 211
  const old = faces(withConfigs(m, editDrawerConfig(m, s, 0, { facadeH: 196 })));
  assert.ok(old[0].h > 196 + 10, 'находка воспроизводится: ' + old[0].h);
  for (const V of [196, 150, 120]) {
    const n = withConfigs(m, facadeForVisible(m, s, 0, V)), f = faces(n);
    assert.equal(Math.round(f[0].h * 10) / 10, V, `видимый нижний фасад ${V}`);
    assert.deepEqual(validate(n), []);
    // без щели: зазор между фасадами — обычный
    assert.ok(f[1].lo - (f[0].lo + f[0].h) <= 3.01, 'зазор ' + (f[1].lo - f[0].lo - f[0].h));
    assert.deepEqual(drawerGapWarnings(one(n)), []);
  }
});
test('п.5: фасад меньше — ящики выше опускаются вслед, щели между фасадами нет; разрыв положением ящика — предупреждение', () => {
  const m = hanging(), s = m.sections[0];
  const smaller = withConfigs(m, editDrawerConfig(m, s, 0, { facadeH: 110 }));
  const f = faces(smaller);
  assert.ok(f[1].lo - (f[0].lo + f[0].h) <= 3.01, 'короб ниже вслед за фасадом, ящик над ним опустился');
  assert.throws(() => editDrawerConfig(m, s, 0, { facadeH: 90 }), /ниже короба: короб не ниже 68 мм, фасад — от 105 мм/);
  // ящик поднят полем «Ящик от дна проёма» — щель 34 мм: предупреждение с подсказкой
  const lifted = withConfigs(m, editDrawerConfig(m, s, 1, { y: 119 + 32 }));
  const w = drawerGapWarnings(one(lifted));
  assert.equal(w.length, 1);
  assert.match(w[0].message, /между фасадами ящиков 1 и 2 щель 34 мм/);
});
