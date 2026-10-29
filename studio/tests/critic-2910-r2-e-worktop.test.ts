// Повторная проверка критика 29.10 (круг 2), находка E (регрессия п.6): опорой шкафной столешницы стал любой поднятый корпус с верхом
// до 1200. Комод на полу 800×850 + настенная полка 600×300×250 «От пола» 850 (верх 1150) → столешница легла на полку (x 1000, y 1150),
// а до правки п.6 (32940e7) — на комод (x 30, y 850).
import test from 'node:test';
import assert from 'node:assert/strict';
import { initialModule, section, type Module } from '../src/model';
import { newProject, appendModule, projectErrors, WORKTOP_BASE, type Project } from '../src/project';
import { createModule } from '../src/ModulePalette';
import { hangingDrawer } from '../src/paletteBuild';

const worktop = () => createModule('worktop', 800, 38, 600, initialModule());
const placed = (p: Project) => p.modules.find((a) => a.module.worktop)!;
function chestAndShelf(hanging: boolean): Project {
  const floor = createModule('drawers', 800, 850, 500, initialModule());
  const shelf: Module = { ...initialModule(), name: 'Полка настенная', width: 600, height: 300, depth: 250, doors: false, plinthHeight: 0, sections: [{ ...section(), shelves: [] }], ...(hanging ? { hanging: true as const } : {}) };
  const p = newProject(floor);
  p.modules = [{ id: 'f', x: 30, y: 0, z: 30, rotation: 0, module: floor }, { id: 's', x: 1000, y: 850, z: 30, rotation: 0, module: shelf }];
  assert.deepEqual(projectErrors(p), []);
  return p;
}
test('E: комод на полу + настенная полка «От пола» 850 (верх 1150) — столешница на комоде (x 30, y 850), а не на полке', () => {
  for (const hanging of [false, true]) {
    const w = placed(appendModule(chestAndShelf(hanging), worktop()));
    assert.equal(w.y, 850, `полка ${hanging ? 'навесная' : 'без флага навесного'}: столешница на верхе комода`);
    assert.ok(Math.abs(w.x - 30) < 1, 'над комодом, x ' + w.x);
    assert.equal(w.module.worktop?.material, 'ldsp');
  }
});
test('E: опора из поднятых — только тумба под столешницу (глубина от 350, верх до 1000); на полу — как было', () => {
  assert.deepEqual(WORKTOP_BASE, { minDepth: 350, maxTop: 1000 });
  // п.6: комод, поднятый «От пола» 400 (верх 850, глубина 500) — опора
  const m = createModule('drawers', 800, 450, 500, initialModule()); m.plinthHeight = 0;
  const raised = newProject(m); raised.modules = [{ id: 'c1', x: 30, y: 400, z: 30, rotation: 0, module: m }];
  assert.equal(placed(appendModule(raised, worktop())).y, 850);
  // dp-2810 ванная: подвесной ящик 825×400×431 на 470 (верх 870) — опора
  const v = hangingDrawer(825, 400, 431, initialModule());
  const bath = newProject(v); bath.modules = [{ id: 'v', x: 300, y: 470, z: 0, rotation: 0, module: v }];
  assert.equal(placed(appendModule(bath, worktop())).y, 870);
  // мелкая (250) поднятая полка с верхом 900 одна — не опора: «Сначала добавьте нижние…»
  const shelf: Module = { ...initialModule(), name: 'Полка', width: 600, height: 300, depth: 250, doors: false, plinthHeight: 0, sections: [{ ...section(), shelves: [] }] };
  const only = newProject(shelf); only.modules = [{ id: 's', x: 30, y: 600, z: 30, rotation: 0, module: shelf }];
  assert.throws(() => appendModule(only, worktop()), /Сначала добавьте нижние/);
});
