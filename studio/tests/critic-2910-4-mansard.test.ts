// Находки критика релиз-кандидата 29.10.2026 (ветка claude/integ-2610): мансарда: наполнение сквозь крышу — ошибка — тестом, воспроизводящим находку.
import test from 'node:test';
import assert from 'node:assert/strict';
import { newProject, projectErrors, type Project } from '../src/project';
import { initialModule, section, parts, validate, type Module } from '../src/model';
import { mansardWarnings } from '../src/shapes';
import { withMansard, fitUnderMansard } from '../src/paletteBuild';
import { drawingsHTML } from '../src/drawings';

const one = (m: Module): Project => { const p = newProject(m); p.modules = [{ id: 'm0', x: 30, y: 0, z: 30, rotation: 0, module: m }]; return p; };

// ───────── 4. мансарда: полка сквозь крышу — ошибка ─────────
test('блокер 4: полка выше скоса мансарды — ошибка модели (пересекает крышу) с кнопкой «Опустить полки под скос»', () => {
  const w: Module = { ...initialModule(), name: 'Шкаф М', width: 800, height: 2400, depth: 600, doors: false, sections: [{ ...section(), shelves: [0.3, 0.6, 0.9], rod: false }] };
  const ok = withMansard(w, 1800);
  assert.deepEqual(validate(ok), [], 'мансарда с полками под скосом');
  // мансарда без «Опустить полки» (задняя высота меньше, полки на месте) — верхняя полка проходит сквозь крышу
  const bad: Module = { ...w, mansard: { rear: 1650 } };
  const errs = validate(bad);
  assert.ok(errs.some((e) => /выше скоса мансарды на \d+ мм у задней кромки — пересекает крышу\. Нажмите «Опустить полки под скос»/.test(e)), errs.join(' | '));
  assert.ok(projectErrors(one(bad)).some((e) => /пересекает крышу/.test(e)), 'ошибка проекта — изменение не применяется, смета/документы — как при других ошибках');
  assert.throws(() => drawingsHTML(one(bad)), /пересекает крышу/);
  const fixed = fitUnderMansard(bad);
  assert.deepEqual(validate(fixed), [], 'после «Опустить полки под скос» ошибок нет');
  // штанга с заданной высотой тоже опускается
  const rod: Module = { ...withMansard({ ...w, sections: [{ ...section(), shelves: [], rod: true, rodAt: 0.9 }] }, 1800), mansard: { rear: 1500 } };
  assert.ok(validate(rod).some((e) => /Штанга.*пересекает крышу/.test(e)), validate(rod).join(' | '));
  assert.deepEqual(validate(fitUnderMansard(rod)), []);
  assert.deepEqual(mansardWarnings(fitUnderMansard(rod), parts(fitUnderMansard(rod))), [], 'и место под плечики есть');
});
