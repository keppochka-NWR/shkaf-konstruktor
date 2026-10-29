// Повторная проверка критика 29.10 (круг 2), находка B: вырез на деталях ящика был привязан к порядковому номеру. Удалили нижний ящик
// комода — вырез с верхнего снят с сообщением «Ящик 3 удалена»; удалили ящик 1 — вырез с ящика 2 остался на месте 2 (бывший ящик 3);
// удалили сам ящик 2 — вырез переехал на бывший ящик 3. Удаление секции с вырезом на перегородке/полке — отказ «детали больше нет».
// Тест — путь App: операция → rebindCutouts(prev, next) (commitProject) → validate.
import test from 'node:test';
import assert from 'node:assert/strict';
import { newProject, type Project } from '../src/project';
import { initialModule, section, parts, validate, type Module } from '../src/model';
import { removePart, removeSection } from '../src/operations';
import { setDrawerCount } from '../src/drawerModes';
import { rebindCutouts } from '../src/cutoutBinding';
import { createModule } from '../src/ModulePalette';
import type { Cutout } from '../src/shapes';

const one = (m: Module): Project => { const p = newProject(m); p.modules = [{ id: 'm0', x: 30, y: 0, z: 30, rotation: 0, module: m }]; return p; };
const cut = (host: string): Cutout => ({ id: 'c1', host, shape: 'round', w: 30, h: 30, u: 100, v: 40, fromU: 'min', fromV: 'min', label: 'кабель' });
/** Ящик — по высоте его фасада (снизу вверх: 0, 1, 2 …), как видит менеджер. */
const order = (m: Module) => parts(m).filter((p) => /:drawer:\d+:facade$/.test(p.id)).sort((a, b) => a.position[1] - b.position[1]).map((p) => p.id.split(':drawer:')[1].split(':')[0]);
/** Вырез: [номер ящика по высоте снизу (0…), деталь]. */
const where = (m: Module) => (m.cutouts ?? []).map((c) => { const [, j, part] = /:drawer:(\d+):(.+)$/.exec(c.host)!; return [order(m).indexOf(j), part] as const; });
/** Как App: операция, затем перепривязка вырезов prev → next. */
function apply(m: Module, op: (p: Project) => Project) {
  const next = op(one(m)).modules[0].module, r = rebindCutouts(m, next);
  assert.deepEqual(validate(r.module), [], 'модель без ошибок');
  return r;
}
const chest = () => createModule('drawers', 800, 1000, 550, initialModule());
const wardrobe = (): Module => ({ ...initialModule(), width: 800, height: 2000, depth: 600, doors: false, sections: [{ ...section(), shelves: [0.6], drawers: 3 }] });

for (const [name, make] of [['комод 800×1000×550', chest], ['шкаф 800×2000 со стопкой 3 ящиков', wardrobe]] as const) {
  test(`B, ${name}: вырез на ВЕРХНЕМ ящике, удалили НИЖНИЙ — вырез на том же (верхнем) ящике, без «удалена»`, () => {
    const m0 = make(), sid = m0.sections[0].id;
    assert.equal(m0.sections[0].drawers, 3);
    const m = { ...m0, cutouts: [cut(`${sid}:drawer:2:facade`)] };
    assert.deepEqual(where(m), [[2, 'facade']]);
    const r = apply(m, (p) => removePart(p, 'm0', sid, `${sid}:drawer:0:bottom`));
    assert.deepEqual(where(r.module), [[1, 'facade']], 'верхний из двух оставшихся — бывший верхний');
    assert.deepEqual(r.notes, [], 'без сообщения «удалена»');
  });
  for (const part of ['facade', 'left']) test(`B, ${name}: вырез на ящике 2 (${part}), удалили ящик 1 — вырез на бывшем ящике 2 (теперь нижний), а не на бывшем 3`, () => {
    const m0 = make(), sid = m0.sections[0].id;
    const m = { ...m0, cutouts: [cut(`${sid}:drawer:1:${part}`)] };
    const r = apply(m, (p) => removePart(p, 'm0', sid, `${sid}:drawer:0:bottom`));
    assert.deepEqual(where(r.module), [[0, part]]);
    assert.deepEqual(r.notes, []);
  });
  test(`B, ${name}: удалили сам ящик 2 с вырезом — вырез снят с сообщением, на бывший ящик 3 не переехал`, () => {
    const m0 = make(), sid = m0.sections[0].id;
    const m = { ...m0, cutouts: [cut(`${sid}:drawer:1:facade`)] };
    const r = apply(m, (p) => removePart(p, 'm0', sid, `${sid}:drawer:1:bottom`));
    assert.equal(r.module.cutouts, undefined);
    assert.equal(r.notes.length, 1);
    assert.match(r.notes[0], /Вырез «кабель» снят: деталь «Ящик 2» .*удалена/);
  });
}
test('B, комод: «−» снимает верхний ящик — вырез с него снят с сообщением; вырез на нижнем ящике остаётся без сообщения', () => {
  const m0 = chest(), sid = m0.sections[0].id;
  const top = { ...m0, cutouts: [cut(`${sid}:drawer:2:facade`)] };
  const r = apply(top, (p) => { const n = structuredClone(p); setDrawerCount(n.modules[0].module, sid, 2); return n; });
  assert.equal(r.module.cutouts, undefined);
  assert.match(r.notes.join(' '), /снят: деталь «Ящик 3»/);
  const low = { ...m0, cutouts: [cut(`${sid}:drawer:0:left`)] };
  const l = apply(low, (p) => { const n = structuredClone(p); setDrawerCount(n.modules[0].module, sid, 2); return n; });
  assert.deepEqual(where(l.module), [[0, 'left']]);
  assert.deepEqual(l.notes, [], 'ящик на месте — без «проверьте» и «удалена»');
});
test('B: удалили секцию с вырезом на её полке / перегородке — вырез снят с сообщением (как у полки), а не отказ «детали больше нет»', () => {
  const t: Module = { ...initialModule(), width: 1200, height: 2000, depth: 600, doors: false, sections: [{ ...section(), shelves: [0.3, 0.6, 0.85] }, { ...section(), shelves: [0.5] }] };
  const s1 = t.sections[1].id;
  for (const host of [`${s1}:shelf:0`, `${s1}:divider`]) {
    assert.ok(parts(t).some((p) => p.id === host), host);
    const m = { ...t, cutouts: [cut(host)] };
    const r = apply(m, (p) => removeSection(p, 'm0', s1));
    assert.equal(r.module.cutouts, undefined, host);
    assert.match(r.notes.join(' '), /Вырез «кабель» снят: деталь «.+» \(\d+ мм от низа корпуса\) удалена/, host);
  }
  // вырез на полке другой секции — остаётся
  const s0 = t.sections[0].id, keep = { ...t, cutouts: [cut(`${s0}:shelf:1`)] };
  const k = apply(keep, (p) => removeSection(p, 'm0', s1));
  assert.equal(k.module.cutouts?.[0].host, `${s0}:shelf:1`);
});
