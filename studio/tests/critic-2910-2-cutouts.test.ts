// Находки критика релиз-кандидата 29.10.2026 (ветка claude/integ-2610): привязка вырезов к детали — тестом, воспроизводящим находку.
import test from 'node:test';
import assert from 'node:assert/strict';
import { newProject, type Project } from '../src/project';
import { initialModule, section, parts, validate, type Module } from '../src/model';
import { insertItem, removePart } from '../src/operations';
import { rebindCutouts, cutFamily } from '../src/cutoutBinding';
import type { Cutout } from '../src/shapes';

const one = (m: Module): Project => { const p = newProject(m); p.modules = [{ id: 'm0', x: 30, y: 0, z: 30, rotation: 0, module: m }]; return p; };

// ───────── 2. вырез не переезжает на другую полку ─────────
const shelvesAt = (m: Module) => parts(m).filter((p) => p.role === 'shelf' && /:shelf:\d+$/.test(p.id)).map((p) => [p.id, Math.round(p.position[1])] as const);
const holeOn = (m: Module) => parts(m).filter((p) => p.shape?.holes.length).map((p) => Math.round(p.position[1]));
function cutShelfModule() {
  const m: Module = { ...initialModule(), width: 800, height: 2000, depth: 600, doors: false, sections: [{ ...section(), shelves: [0.3, 0.6, 0.85] }] };
  const sid = m.sections[0].id, top = shelvesAt(m).at(-1)!;
  const c: Cutout = { id: 'c1', host: top[0], shape: 'round', w: 60, h: 60, u: 300, v: 200, fromU: 'min', fromV: 'min', label: 'под кабель' };
  return { m: { ...m, cutouts: [c] }, sid, topY: top[1] };
}
test('блокер 2: вставили полку ниже — вырез остаётся на своей (верхней) полке, а не переезжает', () => {
  const { m, sid, topY } = cutShelfModule();
  assert.deepEqual(holeOn(m), [topY]);
  const inserted = insertItem(one(m), 'shelf', 'm0', sid, 900).modules[0].module;
  // без перепривязки (как было): номер полки тот же, а полка под ним другая — вырез уехал вниз
  assert.notDeepEqual(holeOn(inserted), [topY], 'находка воспроизводится без перепривязки');
  const r = rebindCutouts(m, inserted);
  assert.deepEqual(holeOn(r.module), [topY], 'вырез на той же полке ' + topY);
  assert.equal(r.module.cutouts![0].host, `${sid}:shelf:3`);
  assert.deepEqual(r.notes, []);
  assert.deepEqual(validate(r.module), []);
});
test('блокер 2: удалили полку ниже — вырез идёт за полкой; удалили саму полку — вырез снят с сообщением', () => {
  const { m, sid, topY } = cutShelfModule();
  const lower = removePart(one(m), 'm0', sid, `${sid}:shelf:0`).modules[0].module;
  const r = rebindCutouts(m, lower);
  assert.deepEqual(holeOn(r.module), [topY]);
  assert.equal(r.module.cutouts![0].host, `${sid}:shelf:1`);
  const gone = removePart(one(m), 'm0', sid, `${sid}:shelf:2`).modules[0].module;
  const g = rebindCutouts(m, gone);
  assert.equal(g.module.cutouts, undefined, 'вырез снят, на соседнюю полку не переехал');
  assert.match(g.notes.join(' '), /снят: деталь «Полка.*удалена/);
  // полку сдвинули (число полок то же) — вырез идёт с ней
  const moved = structuredClone(m); moved.sections[0].shelves[2] = 0.8;
  const mv = rebindCutouts(m, moved);
  assert.equal(mv.module.cutouts![0].host, m.cutouts![0].host); assert.deepEqual(mv.notes, []);
});
test('блокер 2: вырез на фасаде ящика и на двери секции — привязка по месту, а не по номеру', () => {
  assert.equal(cutFamily('s1:drawer:2:facade'), 's1:drawer:#:facade');
  assert.equal(cutFamily('s1:divider'), 's1:divider');
  const m: Module = { ...initialModule(), width: 800, height: 2000, depth: 600, doors: true, sections: [{ ...section(), shelves: [0.5], drawers: 3 }] };
  const sid = m.sections[0].id;
  const faces = parts(m).filter((p) => /:drawer:\d+:facade$/.test(p.id)).sort((a, b) => a.position[1] - b.position[1]);
  const host = faces[2];
  const c: Cutout = { id: 'c2', host: host.id, shape: 'round', w: 40, h: 40, u: 200, v: 60, fromU: 'min', fromV: 'min' };
  const withCut = { ...m, cutouts: [c] };
  // убрали фасад другого ящика — вырез на своём фасаде
  const other = removePart(one(withCut), 'm0', sid, faces[0].id).modules[0].module;
  const r = rebindCutouts(withCut, other);
  assert.equal(r.module.cutouts?.[0].host, host.id);
});
