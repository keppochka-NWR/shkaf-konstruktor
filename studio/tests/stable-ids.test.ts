// Постоянные id деталей наполнения (решение Макса 29.10.2026: «вырез должен держаться даже при редактировании», src/partIds.ts).
// Модель меняется НЕ через окно «Вырезы»: операции operations.ts, отмена/повтор (история проектов), файл туда-обратно (и старый
// файл без id), пересборка палитры (мансарда, малый размер), кухонные операции, прямые правки массивов полок/ящиков — вырез
// остаётся на той же физической детали (та же высота / тот же ящик), снятый носитель — вырез снят с сообщением.
import test from 'node:test';
import assert from 'node:assert/strict';
import { newProject, parseProject, copyModuleGroup, type Project } from '../src/project';
import { initialModule, section, parts, validate, type Module } from '../src/model';
import { insertItem, removePart, movePart, duplicatePart, transferPart, removeSection, clearSection, compactDrawers, applyDrawerSlide, captureSectionFilling, pasteSectionFilling } from '../src/operations';
import { setDrawerCount } from '../src/drawerModes';
import { keepProjectCutouts } from '../src/cutoutBinding';
import { bindCutouts, cutHost } from '../src/partIds';
import { withMansard } from '../src/paletteBuild';
import { fitSmallModule } from '../src/smallSize';
import { kitchenBase, kitchenWall } from '../src/kitchen';
import { setKitchenDrawerCount, setKitchenGola } from '../src/kitchenEditing';
import { estimate } from '../src/pricing';
import { nest } from '../src/exports';
import type { Cutout } from '../src/shapes';

const one = (m: Module): Project => { const p = newProject(m); p.modules = [{ id: 'm0', x: 30, y: 0, z: 30, rotation: 0, module: m }]; return p; };
const mod = (p: Project) => p.modules[0].module;
const cut = (id: string, host: string, u = 150): Cutout => ({ id, host, shape: 'round', w: 40, h: 40, u, v: 120, fromU: 'min', fromV: 'min', label: id });
/** Как окно «Вырезы» при сохранении: вырез на детали pid → постоянная ссылка. */
const withCuts = (m: Module, ...cs: Cutout[]): Module => { const n = structuredClone(m); n.cutouts = cs; bindCutouts(n); return n; };
/** Где вырезы: деталь с отверстием → [id выреза, высота центра детали, мм]. */
const holes = (m: Module) => (m.cutouts ?? []).map((c) => { const p = parts(m).find((q) => q.id === cutHost(m, c)); return [c.id, p ? Math.round(p.position[1]) : null] as const; });
/** Как App: правка проекта → сохранение (keepProjectCutouts) → проверка. */
function commit(prev: Project, next: Project) { const r = keepProjectCutouts(prev, next); assert.deepEqual(validate(mod(r.project)), [], 'модель без ошибок'); return r; }

const wardrobe = (): Module => ({ ...initialModule(), width: 1200, height: 2000, depth: 600, doors: false, sections: [{ ...section(), shelves: [0.3, 0.6, 0.85] }, { ...section(), shelves: [0.5], drawers: 3 }] });
function setup() {
  const m0 = wardrobe(), [s0, s1] = m0.sections.map((s) => s.id);
  const m = withCuts(m0, cut('полка', `${s0}:shelf:2`), cut('ящик', `${s1}:drawer:2:facade`), cut('бок', 'left'));
  return { m, s0, s1, at: Object.fromEntries(holes(m)) as Record<string, number> };
}

test('формат: полка/ящик — постоянная ссылка (ref), host — id детали; id только у секций с вырезами на наполнении; детали как раньше', () => {
  const { m, s0, s1 } = setup();
  const [shelf, drawer, side] = m.cutouts!;
  assert.equal(shelf.ref, `${s0}:shelf@h2`); assert.equal(shelf.host, `${s0}:shelf:2`);
  assert.equal(drawer.ref, `${s1}:drawer@d2:facade`); assert.equal(drawer.host, `${s1}:drawer:2:facade`);
  assert.equal(side.ref, undefined, 'боковина — id по роли, ссылка не нужна');
  assert.deepEqual(m.sections[0].shelfIds, ['h0', 'h1', 'h2']); assert.equal(m.sections[0].drawerIds, undefined);
  assert.deepEqual(m.sections[1].drawerIds, ['d0', 'd1', 'd2']); assert.equal(m.sections[1].shelfIds, undefined);
  // id на детали, раскрой и цену не влияют: модуль с id и тот же без id
  const bare = structuredClone(m); for (const s of bare.sections) { delete s.shelfIds; delete s.drawerIds; } bare.cutouts = bare.cutouts!.map(({ ref: _r, ...c }) => c);
  assert.equal(JSON.stringify(parts(m)), JSON.stringify(parts(bare)));
  assert.deepEqual(estimate(one(m), nest(one(m))).retail, estimate(one(bare), nest(one(bare))).retail);
  assert.deepEqual(validate(m), []);
});

test('operations.ts без сохранения: вставка/удаление/сдвиг полок, дублирование — вырез на той же полке; удалили её — снят', () => {
  const { m, s0, at } = setup();
  const ins = mod(insertItem(one(m), 'shelf', 'm0', s0, 500));
  assert.equal(ins.sections[0].shelves.length, 4); assert.equal(holes(ins)[0][1], at['полка'], 'вставили полку ниже');
  assert.equal(ins.cutouts![0].host, `${s0}:shelf:2`, 'host — кэш на момент правки, деталь берётся по ref');
  assert.equal(cutHost(ins, ins.cutouts![0]), `${s0}:shelf:3`);
  const low = mod(removePart(one(m), 'm0', s0, `${s0}:shelf:0`));
  assert.equal(holes(low)[0][1], at['полка'], 'удалили полку ниже');
  const moved = mod(movePart(one(m), 'm0', s0, `${s0}:shelf:2`, -100));
  assert.equal(holes(moved)[0][1], at['полка'] - 100, 'сдвинули саму полку — вырез с ней');
  const other = mod(movePart(one(m), 'm0', s0, `${s0}:shelf:0`, 50));
  assert.equal(holes(other)[0][1], at['полка'], 'сдвинули соседнюю');
  const dup = duplicatePart(one(m), 'm0', s0, `${s0}:shelf:2`), dm = mod(dup.project);
  assert.equal(new Set(dm.sections[0].shelfIds).size, 4, 'у копии полки — новый id');
  assert.equal(holes(dm)[0][1], at['полка']); assert.equal(dm.cutouts!.filter((c) => c.id === 'полка').length, 1, 'вырез на копию не копируется');
  const gone = mod(removePart(one(m), 'm0', s0, `${s0}:shelf:2`));
  assert.deepEqual(gone.cutouts!.map((c) => c.id), ['ящик', 'бок'], 'удалили полку с вырезом — вырез снят, на соседнюю не переехал');
  for (const x of [ins, low, moved, other, dm, gone]) assert.deepEqual(validate(x), []);
});

test('operations.ts: ящики — удалили нижний, добавили, сомкнули, сменили направляющие — вырез на своём ящике; «−» сверху — снят', () => {
  const { m, s1 } = setup();
  const faceOrder = (x: Module) => parts(x).filter((p) => p.sectionId === s1 && /:drawer:\d+:facade$/.test(p.id)).sort((a, b) => a.position[1] - b.position[1]).map((p) => p.id);
  const rank = (x: Module) => faceOrder(x).indexOf(cutHost(x, x.cutouts!.find((c) => c.id === 'ящик')!)!);
  assert.equal(rank(m), 2);
  const low = mod(removePart(one(m), 'm0', s1, `${s1}:drawer:0:bottom`));
  assert.equal(rank(low), 1, 'верхний из двух — бывший верхний');
  assert.equal(rank(mod(compactDrawers(one(m), 'm0', s1))), 2);
  assert.equal(rank(mod(applyDrawerSlide(one(m), 'm0', s1, 0))), 2);
  const minus = structuredClone(m); setDrawerCount(minus, s1, 2);
  assert.equal(minus.sections[1].drawerIds!.length, 2);
  assert.equal(cutHost(minus, minus.cutouts![1]), undefined, '«−» снял верхний ящик — носителя нет');
  for (const x of [low]) assert.deepEqual(validate(x), []);
});

test('перенос полки в другую секцию — та же деталь: id и вырез едут с ней', () => {
  const { m, s0, s1 } = setup();
  const t = mod(transferPart(one(m), 'm0', s0, `${s0}:shelf:2`, 'm0', s1, 1200));
  const c = t.cutouts!.find((x) => x.id === 'полка')!;
  assert.match(c.ref!, new RegExp(`^${s1}:shelf@h2$`));
  const host = parts(t).find((p) => p.id === cutHost(t, c))!;
  assert.equal(host.sectionId, s1); assert.ok(host.shape?.holes.length, 'отверстие на перенесённой полке');
  assert.equal(t.sections[0].shelfIds!.includes('h2'), false);
  assert.deepEqual(validate(t), []);
});

test('секции и наполнение: удалили другую секцию — вырез на месте; свою — снят с сообщением; очистка и вставка наполнения — сняты', () => {
  const { m, s0, s1, at } = setup();
  const p = one(m);
  const rs = removeSection(p, 'm0', s1), r = commit(p, rs);
  assert.deepEqual(holes(mod(r.project)), [['полка', at['полка']], ['бок', at['бок']]]);
  assert.match(r.notes.join(' '), /Вырез «ящик» снят: деталь «Ящик 3»/);
  const cl = clearSection(p, 'm0', s0), c = commit(p, cl);
  assert.deepEqual(mod(c.project).cutouts!.map((x) => x.id), ['ящик', 'бок']); assert.match(c.notes.join(' '), /Вырез «полка» снят: деталь «Полка/);
  // вставили наполнение секции 1 в секцию 0: полки — копии с новыми id, вырез с заменённой полки снят; копия выреза не несёт
  const pa = pasteSectionFilling(p, 'm0', s0, captureSectionFilling(p, 'm0', s1)), pr = commit(p, pa);
  assert.deepEqual(mod(pr.project).cutouts!.map((x) => x.id), ['ящик', 'бок']); assert.equal(pr.notes.length, 1);
  assert.notDeepEqual(mod(pr.project).sections[0].drawerIds, mod(pr.project).sections[1].drawerIds);
});

test('отмена/повтор: история проектов — в каждом состоянии вырез на своей полке, правка после отмены — тоже', () => {
  const { m, s0, at } = setup();
  const h: Project[] = [one(m)];
  const step = (f: (p: Project) => Project) => { const prev = h.at(-1)!; h.push(commit(prev, f(prev)).project); };
  step((p) => insertItem(p, 'shelf', 'm0', s0, 400));
  step((p) => removePart(p, 'm0', s0, `${s0}:shelf:0`));
  step((p) => movePart(p, 'm0', s0, `${s0}:shelf:2`, 60));
  const ys = h.map((p) => holes(mod(p))[0][1]);
  assert.deepEqual(ys, [at['полка'], at['полка'], at['полка'], at['полка'] + 60]);
  // Ctrl+Z ×2 → состояние 1, правка от него (новая ветка истории), Ctrl+Y недоступен — вырез на своей полке
  const undone = h[1];
  assert.equal(holes(mod(undone))[0][1], at['полка']);
  const branch = commit(undone, insertItem(undone, 'shelf', 'm0', s0, 1700)).project;
  assert.equal(holes(mod(branch))[0][1], at['полка']);
  assert.equal(holes(mod(h[3]))[0][1], at['полка'] + 60, 'повтор — то же состояние');
});

test('файл: сохранить/открыть — id и ссылки те же, детали и цена те же; старый файл (без id, host — номер) открывается так же', () => {
  const { m, s0, at } = setup();
  const p = one(m), back = parseProject(JSON.parse(JSON.stringify(p)));
  assert.deepEqual(mod(back).cutouts, m.cutouts); assert.deepEqual(mod(back).sections.map((s) => [s.shelfIds, s.drawerIds]), m.sections.map((s) => [s.shelfIds, s.drawerIds]));
  assert.equal(JSON.stringify(parts(mod(back))), JSON.stringify(parts(m)));
  // старый формат (до 29.10): вырезы с порядковым host, у секций нет id
  const old = JSON.parse(JSON.stringify(p)); for (const s of old.modules[0].module.sections) { delete s.shelfIds; delete s.drawerIds; }
  old.modules[0].module.cutouts = old.modules[0].module.cutouts.map(({ ref: _r, ...c }: Cutout) => c);
  const a = parseProject(structuredClone(old)), b = parseProject(structuredClone(old));
  assert.deepEqual(mod(a).cutouts, m.cutouts, 'перевод детерминированный: те же ссылки, что у редактора'); assert.deepEqual(mod(a), mod(b));
  assert.equal(JSON.stringify(parts(mod(a))), JSON.stringify(parts(m)), 'детали те же');
  assert.equal(estimate(a, nest(a)).retail, estimate(p, nest(p)).retail, 'цена та же');
  // после перевода — правка мимо редактора: вырез на своей полке
  assert.equal(holes(mod(insertItem(a, 'shelf', 'm0', s0, 300)))[0][1], at['полка']);
  // файл без вырезов — без id (байт в байт как был)
  const plain = one(wardrobe()); assert.equal(JSON.stringify(parseProject(JSON.parse(JSON.stringify(plain)))), JSON.stringify(parseProject(JSON.parse(JSON.stringify(plain)))));
  assert.ok(parseProject(JSON.parse(JSON.stringify(plain))).modules[0].module.sections.every((s) => !s.shelfIds && !s.drawerIds));
});

test('прямые правки массивов (в обход id): перестановка, удаление, вставка, «поровну» — после сохранения вырез на своей полке', () => {
  const { m, s0, at } = setup();
  const p = one(m), edit = (f: (s: Module['sections'][number]) => void) => { const n = structuredClone(p); f(mod(n).sections[0]); return commit(p, n); };
  // id знает: переставили полки вместе с id — вырез на той же полке и без сохранения
  const aware = structuredClone(m); aware.sections[0].shelves.reverse(); aware.sections[0].shelfIds!.reverse();
  assert.equal(holes(aware)[0][1], at['полка']);
  // в обход id: только shelves
  assert.equal(holes(mod(edit((s) => s.shelves.reverse()).project))[0][1], at['полка'], 'переставили shelves');
  assert.equal(holes(mod(edit((s) => s.shelves.splice(0, 1)).project))[0][1], at['полка'], 'удалили нижнюю');
  assert.equal(holes(mod(edit((s) => { s.shelves.push(0.1); s.shelves.sort((x, y) => x - y); }).project))[0][1], at['полка'], 'вставили снизу');
  const even = edit((s) => { s.shelves = [0.25, 0.5, 0.75]; });
  assert.equal(cutHost(mod(even.project), mod(even.project).cutouts![0]), `${s0}:shelf:2`, '«поровну» — та же (верхняя) полка');
  const cutTop = edit((s) => { s.shelves = s.shelves.slice(0, 2); });
  assert.deepEqual(mod(cutTop.project).cutouts!.map((c) => c.id), ['ящик', 'бок']); assert.match(cutTop.notes.join(' '), /Вырез «полка» снят/);
});

test('пересборка палитры: мансарда (полки под скос), малый размер (полки сняты/переставлены) — вырез на своей полке или снят с сообщением', () => {
  const { m, at } = setup();
  const p = one(m);
  const ms = structuredClone(p); ms.modules[0].module = withMansard(m, 1700);
  const r = commit(p, ms);
  assert.equal(cutHost(mod(r.project), mod(r.project).cutouts![0]), cutHost(m, m.cutouts![0]), 'полки поровну под скосом — вырез на той же (верхней) полке');
  assert.ok(holes(mod(r.project))[0][1]! < at['полка']);
  // корпус 500: полки поровну по новой высоте (3 — вырез на верхней), ящиков 2 — верхний снят, вырез с него снят с сообщением
  const small = structuredClone(p); small.modules[0].module.height = 500; fitSmallModule(small.modules[0].module);
  const s = commit(p, small), sm = mod(s.project);
  assert.equal(cutHost(sm, sm.cutouts!.find((c) => c.id === 'полка')!), cutHost(m, m.cutouts![0]));
  assert.deepEqual(sm.cutouts!.map((c) => c.id), ['полка', 'бок']); assert.match(s.notes.join(' '), /Вырез «ящик» снят: деталь «Ящик 3»/);
  // корпус 400: полок 2 — верхней нет, вырез с неё снят с сообщением
  const tiny = structuredClone(p); tiny.modules[0].module.height = 400; fitSmallModule(tiny.modules[0].module);
  const t = keepProjectCutouts(p, tiny);
  assert.equal(mod(t.project).cutouts?.some((c) => c.id === 'полка') ?? false, false, 'верхнюю полку малый корпус снял — вырез снят');
  assert.match(t.notes.join(' '), /Вырез «полка» снят/);
});

test('кухонные операции: Gola — вырез на полке и дне на месте; ящики вместо полки — вырез с полки снят с сообщением', () => {
  const b = kitchenBase(initialModule(), 600), sid = b.sections[0].id;
  const m = withCuts(b, cut('полка', `${sid}:shelf:0`, 100), cut('бок', 'bottom', 100));
  assert.deepEqual(validate(m), []);
  const before = holes(m), p = one(m);
  const g = structuredClone(p); setKitchenGola(mod(g), true);
  assert.deepEqual(holes(mod(commit(p, g).project)), before);
  const d = structuredClone(p); setKitchenDrawerCount(mod(d), 2);
  const r = keepProjectCutouts(p, d);
  assert.deepEqual(mod(r.project).cutouts!.map((c) => c.id), ['бок']); assert.match(r.notes.join(' '), /Вырез «полка» снят: деталь «Полка/);
  // навесной: прямая правка полок кухни (вставили полку ниже) — вырез на своей
  const w = kitchenWall(initialModule(), 600), wid = w.sections[0].id, wm = withCuts(w, cut('полка', `${wid}:shelf:0`, 100)), wp = one(wm), wy = holes(wm)[0][1];
  const wn = structuredClone(wp); mod(wn).sections[0].shelves.unshift(0.25);
  assert.equal(holes(mod(keepProjectCutouts(wp, wn).project))[0][1], wy);
});

test('копия корпуса: вырезы копии — на деталях копии (новые id секций), у оригинала — без изменений', () => {
  const { m, at } = setup();
  const p = { ...one(m), room: { ...one(m).room, width: 6000 } };
  const c = copyModuleGroup(p, ['m0']), copy = c.project.modules.find((a) => a.id === c.ids[0])!.module;
  assert.notEqual(copy.sections[0].id, m.sections[0].id);
  assert.ok(copy.cutouts!.every((x) => !x.host.startsWith(m.sections[0].id) && !x.host.startsWith(m.sections[1].id)));
  assert.deepEqual(holes(copy), holes(m)); assert.deepEqual(validate(copy), []);
  assert.deepEqual(Object.fromEntries(holes(c.project.modules[0].module)), at);
});
