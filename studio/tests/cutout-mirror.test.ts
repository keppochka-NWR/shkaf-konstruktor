// «Отразить корпус» (решение Макса 29.10, вариант 1): вырез отражается вместе со своей деталью — левая боковина ↔ правая, створка ↔
// створка, перегородка, полка и ящик своей секции; положение по X зеркальное, по высоте и глубине — то же; дважды — как было.
// Было: mirrorModule вырезы не трогал — вырез оставался на левой боковине и на прежнем месте полки.
import test from 'node:test';
import assert from 'node:assert/strict';
import { newProject, type Project } from '../src/project';
import { initialModule, section, parts, validate, type Module } from '../src/model';
import { mirrorModule } from '../src/operations';
import { keepProjectCutouts } from '../src/cutoutBinding';
import { bindCutouts, cutHost } from '../src/partIds';
import { faceAxes, type Cutout } from '../src/shapes';
import { createModule } from '../src/paletteBuild';

const one = (m: Module): Project => { const p = newProject(m); p.modules = [{ id: 'm0', x: 30, y: 0, z: 30, rotation: 0, module: m }]; return p; };
const cut = (id: string, host: string, shape: 'rect' | 'round' = 'rect', u = 120, v = 150): Cutout => ({ id, host, shape, w: 60, h: 40, u, v, fromU: 'min', fromV: 'min', label: id });
const withCuts = (m: Module, ...cs: Cutout[]) => { const n = structuredClone(m); n.cutouts = cs; bindCutouts(n); return n; };
/** Центр отверстия выреза в осях модуля [x, y, z] и деталь-носитель. */
function hole(m: Module, id: string) {
  const c = m.cutouts!.find((x) => x.id === id)!, p = parts(m).find((q) => q.id === cutHost(m, c))!;
  assert.ok(p?.shape?.holes.length, `отверстие ${id} построено`);
  const ax = faceAxes(p), h = p.shape!.holes[0], mid = (k: 0 | 1) => h.reduce((s, pt) => s + pt[k], 0) / h.length;
  const out = p.position.map((v, i) => v - p.size[i] / 2);
  out[ax.u] += mid(0); out[ax.v] += mid(1); out[ax.w] += p.size[ax.w] / 2;
  return { part: p, at: out.map((v) => Math.round(v * 10) / 10) };
}
const mirror = (m: Module) => { const p = one(m), n = mirrorModule(p, 'm0'); return keepProjectCutouts(p, n).project.modules[0].module; };

const wardrobe = (): Module => ({ ...initialModule(), width: 1200, height: 2000, depth: 600, doors: true, sections: [{ ...section(), shelves: [0.3, 0.6], doorLeaves: 2 }, { ...section(), shelves: [0.5], drawers: 2 }] });

test('отразить корпус: вырезы на боковине, полке, створке, перегородке и ящике — на зеркальной детали, X зеркальный, Y/Z те же', () => {
  const m0 = wardrobe(), [s0, s1] = m0.sections.map((s) => s.id);
  const m = withCuts(m0, cut('бок', 'left'), cut('полка', `${s0}:shelf:1`), cut('дверь', `${s0}:door:0`, 'round', 150, 400), cut('перегородка', `${s1}:divider`, 'round'), cut('ящик', `${s1}:drawer:1:facade`, 'round', 100, 60));
  assert.deepEqual(validate(m), []);
  const r = mirror(m), W = m.width;
  assert.deepEqual(validate(r), []);
  for (const id of ['бок', 'полка', 'дверь', 'перегородка', 'ящик']) {
    const a = hole(m, id), b = hole(r, id);
    assert.deepEqual([b.at[0], b.at[1], b.at[2]], [Math.round((W - a.at[0]) * 10) / 10, a.at[1], a.at[2]], `${id}: X зеркальный, Y и Z те же`);
    assert.equal(b.part.role, a.part.role);
  }
  assert.equal(cutHost(r, r.cutouts!.find((c) => c.id === 'бок')!), 'right', 'левая боковина → правая');
  assert.equal(cutHost(r, r.cutouts!.find((c) => c.id === 'дверь')!)?.endsWith(':door:1'), true, 'левая створка → правая');
  assert.equal(r.cutouts!.find((c) => c.id === 'полка')!.fromU, 'max', 'на полке отступ — от другого края');
  assert.equal(r.cutouts!.find((c) => c.id === 'бок')!.fromU, 'min', 'на боковине ширина вида — глубина, не меняется');
  // полка и ящик — та же деталь (постоянный id), секция та же
  assert.equal(r.cutouts!.find((c) => c.id === 'полка')!.ref, m.cutouts!.find((c) => c.id === 'полка')!.ref);
  assert.equal(r.cutouts!.find((c) => c.id === 'ящик')!.ref, m.cutouts!.find((c) => c.id === 'ящик')!.ref);
  // дважды отразить — как было
  const back = mirror(r);
  assert.deepEqual(back.cutouts, m.cutouts);
  assert.equal(JSON.stringify(parts(back).filter((p) => p.shape)), JSON.stringify(parts(m).filter((p) => p.shape)));
});

test('отразить комод: круглый вырез на фасаде ящика у края — зеркально, деталь та же; ассиметричный вырез в боковине у плинтуса', () => {
  const k0 = createModule('drawers', 800, 1000, 550, initialModule()), sid = k0.sections[0].id;
  const k = withCuts(k0, cut('кабель', `${sid}:drawer:2:facade`, 'round', 80, 60), { ...cut('плинтус', 'right', 'rect', 0, 0), w: 20, h: 80 });
  assert.deepEqual(validate(k), []);
  const r = mirror(k);
  const a = hole(k, 'кабель'), b = hole(r, 'кабель');
  assert.deepEqual(b.at, [Math.round((800 - a.at[0]) * 10) / 10, a.at[1], a.at[2]]);
  const pl = r.cutouts!.find((c) => c.id === 'плинтус')!;
  assert.equal(cutHost(r, pl), 'left', 'выборка под плинтус ушла на левую боковину');
  const sideL = parts(r).find((p) => p.id === 'left')!, sideR = parts(k).find((p) => p.id === 'right')!;
  assert.deepEqual(sideL.shape!.outline, sideR.shape!.outline, 'контур той же выборки');
  assert.deepEqual(mirror(r).cutouts, k.cutouts, 'дважды — как было');
});
