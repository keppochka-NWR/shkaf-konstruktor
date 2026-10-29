// Повторная проверка критика 29.10 (круг 3), B: «Вставить наполнение секции» поверх ящиков оставлял вырез на новом ящике с тем же
// номером — молча. Теперь вырезы на заменённых деталях наполнения снимаются с сообщением; вырез на боковине/перегородке остаётся.
import test from 'node:test';
import assert from 'node:assert/strict';
import { newProject, type Project } from '../src/project';
import { initialModule, section, validate, type Module } from '../src/model';
import { captureSectionFilling, pasteSectionFilling } from '../src/operations';
import { rebindCutouts } from '../src/cutoutBinding';
import type { Cutout } from '../src/shapes';

const one = (m: Module): Project => { const p = newProject(m); p.modules = [{ id: 'm0', x: 30, y: 0, z: 30, rotation: 0, module: m }]; return p; };
const cut = (id: string, host: string): Cutout => ({ id, host, shape: 'round', w: 30, h: 30, u: 100, v: 40, fromU: 'min', fromV: 'min', label: id });

test('B: «Вставить наполнение секции» поверх ящиков с вырезом — вырез снят с сообщением, а не на новом ящике с тем же номером', () => {
  const t: Module = { ...initialModule(), width: 1200, height: 2000, depth: 600, doors: false, sections: [{ ...section(), shelves: [0.6], drawers: 3 }, { ...section(), shelves: [0.4, 0.7], drawers: 2 }] };
  const [s0, s1] = t.sections.map((s) => s.id);
  const m = { ...t, cutouts: [cut('ящик', `${s0}:drawer:1:facade`), cut('бок', 'left')] };
  assert.deepEqual(validate(m), []);
  const next = pasteSectionFilling(one(m), 'm0', s0, captureSectionFilling(one(m), 'm0', s1)).modules[0].module;
  const r = rebindCutouts(m, next);
  assert.deepEqual((r.module.cutouts ?? []).map((c) => c.id), ['бок'], 'вырез на ящике заменённого наполнения снят, на боковине — остался');
  assert.equal(r.notes.length, 1);
  assert.match(r.notes[0], /Вырез «ящик» снят: деталь «Ящик 2» .*удалена/);
  assert.deepEqual(validate(r.module), []);
});
