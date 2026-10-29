// Находки критика релиз-кандидата 29.10.2026 (ветка claude/integ-2610): п.6 — столешница на подвесной тумбе из поднятого комода.
import test from 'node:test';
import assert from 'node:assert/strict';
import { initialModule } from '../src/model';
import { newProject, appendModule, projectErrors, type Project } from '../src/project';
import { createModule } from '../src/ModulePalette';

function raisedChest(y: number): Project {
  const m = createModule('drawers', 800, 450, 500, initialModule());
  m.plinthHeight = 0;
  const p = newProject(m);
  p.modules = [{ id: 'c1', x: 30, y, z: 30, rotation: 0, module: m }];
  return p;
}
test('п.6: комод, поднятый «От пола» (подвесная тумба без флага навесного), — опора шкафной столешницы', () => {
  const p = raisedChest(400);
  assert.ok(!p.modules[0].module.hanging, 'флага навесного нет — как у комода, поднятого полем «От пола»');
  const top = createModule('worktop', 800, 38, 600, initialModule());
  const n = appendModule(p, top);
  const w = n.modules.find((a) => a.module.worktop)!;
  assert.equal(w.y, 400 + 450, 'столешница лежит на верхе тумбы');
  assert.equal(w.module.worktop?.material, 'ldsp');
  assert.equal(w.module.height, 32);
  assert.ok(Math.abs(w.x - 30) < 1, 'над тумбой');
});
test('п.6: корпус выше 1200 от пола (антресоль) опорой столешницы не становится', () => {
  const p = raisedChest(1800);
  assert.throws(() => appendModule(p, createModule('worktop', 800, 38, 600, initialModule())), /Сначала добавьте нижние/);
  void projectErrors;
});
