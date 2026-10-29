// Правки редактирования по списку Макса 29.10.2026 (ветка claude/fix-edit-2910): Delete, «Удалить секцию» правой кнопкой,
// «Заменить у всех» для декора каркаса, штанга без нормы места под ней (предупреждение), перенос вырезов на схожие детали,
// плавное открывание и средняя кнопка (колёсико).
import test from 'node:test';
import assert from 'node:assert/strict';
import { newProject, type Project } from '../src/project';
import { initialModule, section, parts, validate, rodClearanceWarnings, type Module } from '../src/model';
import { insertItem, removeSection } from '../src/operations';
import { createModule, withMansard } from '../src/paletteBuild';
import { placeInRow } from '../src/rowResize';
import { estimate } from '../src/pricing';
import { nest } from '../src/exports';
import { mansardIntrusions } from '../src/shapes';
import { roomWarnings } from '../src/roomWarnings';
import { cutHost } from '../src/partIds';
import { copyCutouts, similarCutParts, partKind } from '../src/cutoutCopy';
import { applyDecorAll, deleteKeyTarget, deleteQuestion, removeModules, openToggleKey, openEase, stepOpen, OPEN_MS, sectionRemoveApplies } from '../src/editActions';
import type { Cutout } from '../src/shapes';

const room = (mods: Module[]): Project => { const p = newProject(mods[0]); p.room.width = 9000; p.modules = mods.map((m, i) => ({ id: 'm' + i, x: 50 + i * 1700, y: 0, z: 30, module: m })); return p; };
const wardrobe = (w = 1000) => createModule('wardrobe', w, 2200, 600, initialModule());
const shelves = (w = 800) => createModule('shelves', w, 2000, 400, initialModule());

test('Delete: деталь — сразу, корпус и отмеченные — через вопрос; ничего не выбрано или объект помещения — ничего', () => {
  const base = { removablePart: false, groupIds: [] as string[], activeId: 'm0', deselected: false, environment: false };
  assert.deepEqual(deleteKeyTarget({ ...base, removablePart: true }), { kind: 'part' });
  assert.deepEqual(deleteKeyTarget(base), { kind: 'modules', ids: ['m0'] });
  assert.deepEqual(deleteKeyTarget({ ...base, groupIds: ['m1', 'm2'] }), { kind: 'modules', ids: ['m1', 'm2'] });
  assert.equal(deleteKeyTarget({ ...base, deselected: true }), null);
  assert.equal(deleteKeyTarget({ ...base, environment: true }), null);
  assert.equal(deleteKeyTarget({ ...base, activeId: undefined }), null);
});

test('Delete: корпуса — одной правкой, последний — только в комнате заказа; вопрос с именем или числом', () => {
  const p = room([wardrobe(), shelves(), shelves(600)]);
  assert.equal(deleteQuestion(p, ['m1']), `Удалить корпус «${p.modules[1].module.name}»?`);
  assert.equal(deleteQuestion(p, ['m0', 'm1']), 'Удалить 2 корпуса?');
  const n = removeModules(p, ['m0', 'm2'], false);
  assert.deepEqual(n.modules.map((a) => a.id), ['m1']);
  assert.equal(p.modules.length, 3, 'исходный проект не меняется (отмена — прежний проект истории)');
  assert.throws(() => removeModules(n, ['m1'], false), /Последний корпус/);
  assert.equal(removeModules(n, ['m1'], true).modules.length, 0);
});

test('«Удалить секцию» правой кнопкой: у шкафа из 2+ секций; секция с вырезом — снимается вместе с ним', () => {
  const m = { ...initialModule(), width: 1200, doors: false, sections: [{ ...section(), shelves: [0.5], drawers: 0, rod: false }, { ...section(), shelves: [0.5], drawers: 0, rod: false }] } as Module;
  assert.deepEqual(validate(m), []);
  assert.ok(sectionRemoveApplies(m));
  assert.equal(sectionRemoveApplies({ ...m, sections: [m.sections[0]] }), false);
  assert.equal(sectionRemoveApplies(createModule('kupe', 1600, 2400, 100, initialModule())), false);
  const p = room([m]), sid = m.sections[1].id, n = removeSection(p, 'm0', sid);
  assert.equal(n.modules[0].module.sections.length, m.sections.length - 1);
  assert.ok(!n.modules[0].module.sections.some((s) => s.id === sid));
});

test('«Заменить у всех»: декор каркаса всем корпусам одной правкой, купе/столешница — с причиной, цена как при правке по одному', () => {
  const kupe = createModule('kupe', 1600, 2400, 100, initialModule()), top = createModule('worktop', 1200, 32, 600, initialModule());
  const p = room([wardrobe(), shelves(), kupe, top]), decor = 'Графит';
  const r = applyDecorAll(p, decor);
  assert.deepEqual(r.changed, ['m0', 'm1']);
  assert.deepEqual(r.skipped.map((s) => s.id), ['m2', 'm3']);
  assert.match(r.note, /заменён у 2 из 4/);
  assert.match(r.note, /двери купе/);
  assert.match(r.note, /столешница/);
  assert.equal(r.project.modules[0].module.decor, decor);
  assert.equal(r.project.modules[2].module.decor, kupe.decor, 'купе не тронуто');
  // по одному: та же правка панели корпуса (поле decor + placeInRow), корпус за корпусом
  let one = p;
  for (const id of ['m0', 'm1']) { const n = structuredClone(one.modules.find((a) => a.id === id)!.module); n.decor = decor; one = placeInRow(one, id, n); }
  assert.deepEqual(r.project, one);
  assert.equal(estimate(r.project, nest(r.project)).retail, estimate(one, nest(one)).retail);
  assert.notEqual(estimate(r.project, nest(r.project)).retail, undefined);
  assert.throws(() => applyDecorAll(room([kupe]), decor), /ни к одному из корпусов проекта/);
});

test('Штанга ставится независимо от места под ней: не ошибка, а предупреждение; сквозь скос мансарды — ошибка', () => {
  const m = { ...initialModule(), doors: false, height: 2000, width: 600 } as Module;
  m.sections = [{ ...section(), shelves: [0.3], drawers: 0, rod: true, rodAt: 0.55 }];
  assert.deepEqual(validate(m), [], 'штанга над полкой ближе 900 мм — модель без ошибок');
  const w = rodClearanceWarnings(m);
  assert.equal(w.length, 1);
  assert.match(w[0], /меньше нормы 900 мм/);
  assert.ok(roomWarnings(room([m])).some((x) => x.kind === 'rod-clearance'), 'предупреждение — в списке «Проверьте расстановку»');
  // меню «Добавить › Штанга» на высоте клика: штанга встаёт там, где кликнули (раньше уезжала вверх или отказ)
  const e = { ...initialModule(), doors: false, height: 2000, width: 600 } as Module;
  e.sections = [{ ...section(), shelves: [0.3], drawers: 0, rod: false }];
  const p = room([e]), n = insertItem(p, 'rod', 'm0', e.sections[0].id, 1000);
  const s = n.modules[0].module.sections[0], rod = parts(n.modules[0].module).find((q) => q.id === s.id + ':rod')!;
  assert.ok(s.rod);
  assert.ok(Math.abs(rod.position[1] - 1000) < 20, `штанга у места клика (${Math.round(rod.position[1])})`);
  assert.ok(rodClearanceWarnings(n.modules[0].module).length > 0);
  // мансарда: штанга выше скоса — по-прежнему ошибка
  const ms = withMansard({ ...initialModule(), doors: false, height: 2200, width: 600, depth: 600, sections: [{ ...section(), shelves: [], drawers: 0, rod: true, rodAt: 0.93 }] } as Module, 1500);
  assert.ok(mansardIntrusions(ms, parts(ms)).some((x) => x.error && (x.part.role === 'rod' || x.part.role === 'flange')), 'штанга сквозь крышу — ошибка');
});

test('Вырезы на схожие детали: та же деталь того же размера — полки, вторая боковина, другой корпус; одна правка; перенос снимает с исходной', () => {
  const a = shelves(800), b = shelves(800), c = shelves(600);
  const p = room([a, b, c]), sh = a.sections[0].id + ':shelf:0';
  const cut: Cutout = { id: 'c1', host: sh, shape: 'round', w: 40, h: 40, u: 150, v: 100, fromU: 'min', fromV: 'min', label: 'под трубу' };
  p.modules[0].module.cutouts = [cut];
  const sim = similarCutParts(p, 'm0', sh);
  assert.ok(sim.some((x) => x.mid === 'm0' && x.pid.includes(':shelf:') && x.pid !== sh), 'другие полки этого корпуса');
  assert.ok(sim.some((x) => x.mid === 'm1'), 'полки корпуса того же размера');
  assert.ok(!sim.some((x) => x.mid === 'm2'), 'корпус 600 — полки другого размера не схожи');
  assert.ok(sim.every((x) => partKind(parts(p.modules.find((q) => q.id === x.mid)!.module).find((q) => q.id === x.pid)!) === 'shelf/shelf'));
  const left = similarCutParts(p, 'm0', 'left');
  assert.ok(left.some((x) => x.mid === 'm0' && x.pid === 'right'), 'зеркальная боковина — схожая');
  const r = copyCutouts(p, 'm0', sh, [cut], sim.map(({ mid, pid }) => ({ mid, pid })));
  assert.equal(r.copied, sim.length);
  for (const x of sim) { const m = r.project.modules.find((q) => q.id === x.mid)!.module; const on = (m.cutouts ?? []).filter((k) => cutHost(m, k) === x.pid); assert.equal(on.length, 1, x.pid); assert.equal(on[0].u, 150); assert.notEqual(on[0].id, 'c1'); assert.deepEqual(validate(m), []); }
  assert.equal(p.modules[1].module.cutouts, undefined, 'исходный проект не тронут — одна правка, одна отмена');
  // повтор — «такой вырез уже есть»; вырез, который на детали не встаёт (рядом другое отверстие ближе 10 мм), — пропуск с причиной
  assert.throws(() => copyCutouts(r.project, 'm0', sh, [cut], [{ mid: 'm1', pid: sim.find((x) => x.mid === 'm1')!.pid }]), /уже есть/);
  const close: Cutout = { ...cut, id: 'c2', u: 175 };
  const t1 = sim.find((x) => x.mid === 'm1')!, r2 = copyCutouts(r.project, 'm0', sh, [close], [{ mid: t1.mid, pid: t1.pid }, { mid: 'm2', pid: 'left' }]);
  assert.equal(r2.copied, 1);
  assert.equal(r2.skipped.length, 1);
  assert.match(r2.skipped[0].reason, /ближе 10 мм/);
  // перенос: с исходной детали вырез снят
  const mv = copyCutouts(p, 'm0', sh, [cut], [{ mid: 'm1', pid: t1.pid }], true);
  assert.equal((mv.project.modules[0].module.cutouts ?? []).length, 0);
  assert.match(mv.note, /перенесены на 1 деталь/);
});

test('Средняя кнопка: что открывается — створка, ящик, полотно; плавно за OPEN_MS', () => {
  assert.equal(openToggleKey('s1:door:0'), 's1:door:0');
  assert.equal(openToggleKey('s1:hingecup:1:0'), 's1:door:1');
  assert.equal(openToggleKey('s1:handle:0'), 's1:door:0');
  assert.equal(openToggleKey('s1:drawer:2:facade'), 's1:drawer:2');
  assert.equal(openToggleKey('s1:drawer:2:left'), 's1:drawer:2');
  assert.equal(openToggleKey('kd:3:front'), 'kd:3');
  assert.equal(openToggleKey('left'), '*');
  assert.equal(openToggleKey(undefined), '*');
  assert.equal(openEase(0), 0);
  assert.equal(openEase(1), 1);
  assert.ok(openEase(0.25) < 0.25 && openEase(0.75) > 0.75, 'плавный разгон и остановка');
  let t = 0, ms = 0;
  while (t < 1) { t = stepOpen(t, 1, 16); ms += 16; }
  assert.ok(ms >= 300 && ms <= 420, `открытие ${ms} мс`);
  assert.ok(OPEN_MS >= 300 && OPEN_MS <= 400);
  assert.equal(stepOpen(0.5, 0, 10000), 0.5 - 64 / OPEN_MS, 'после паузы вкладки — не прыжок');
});
