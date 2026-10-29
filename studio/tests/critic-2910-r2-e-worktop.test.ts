// Повторная проверка критика 29.10 (круги 2 и 3), находка E: опора шкафной столешницы.
// Круг 2: после п.6 опорой стал любой поднятый корпус с верхом до 1200 — настенная полка «От пола» перехватывала столешницу у комода.
// Круг 3: пороги глубины/верха круга 2 сломали и это (полка 600×150×400 «От пола» 850 с верхом 1000 — снова опора), и старые опоры
// (навесная тумба глубиной 300 с верхом 850, глубиной 431 с верхом 1050 — «Сначала добавьте нижние…»). Правило: опоры — ровно как в
// 32940e7 (на полу или навесной, до 1200) и ещё комод (ящичный модуль), поднятый «От пола» без флага навесного; полка — не опора.
import test from 'node:test';
import assert from 'node:assert/strict';
import { initialModule, section, type Module } from '../src/model';
import { newProject, appendModule, projectErrors, type Project, type PlacedModule } from '../src/project';
import { createModule } from '../src/ModulePalette';
import { hangingDrawer } from '../src/paletteBuild';

const worktop = () => createModule('worktop', 800, 38, 600, initialModule());
function place(mods: PlacedModule[]): Project { const p = newProject(mods[0].module); p.modules = mods; assert.deepEqual(projectErrors(p), []); return p; }
const top = (p: Project) => { const w = appendModule(p, worktop()).modules.find((a) => a.module.worktop)!; return { x: Math.round(w.x), y: w.y }; };
const chest = (h: number, d = 500) => createModule('drawers', 800, h, d, initialModule());
const shelf = (h: number, d: number): Module => ({ ...initialModule(), name: 'Полка настенная', width: 600, height: h, depth: d, doors: false, plinthHeight: 0, sections: [{ ...section(), shelves: [] }] });
const at = (id: string, x: number, y: number, module: Module): PlacedModule => ({ id, x, y, z: 30, rotation: 0, module });
const raised = (h: number, d = 500, hanging = false): Module => { const m = { ...chest(h, d), ...(hanging ? { hanging: true as const } : {}) }; m.plinthHeight = 0; return m; };

test('E: комод на полу + настенная полка «От пола» — столешница на комоде (y 850), а не на полке', () => {
  for (const [h, d, y] of [[300, 250, 850], [150, 400, 850], [100, 400, 880]] as const) {
    assert.deepEqual(top(place([at('f', 30, 0, chest(850)), at('s', 1000, y, shelf(h, d))])), { x: 30, y: 850 }, `полка 600×${h}×${d} на ${y}`);
  }
});
test('E: старые опоры — как в 32940e7 / 235003e: навесная тумба глубиной 300 (верх 850) и 431 (верх 1050)', () => {
  assert.equal(top(place([at('c', 30, 400, raised(450, 300, true))])).y, 850);
  assert.equal(top(place([at('c', 30, 600, raised(450, 431, true))])).y, 1050);
  // dp-2810 ванная: подвесной ящик 825×400×431 на 470 — опора (верх 870)
  assert.equal(top(place([at('v', 300, 470, hangingDrawer(825, 400, 431, initialModule()))])).y, 870);
  // на полу — самый высокий верх
  assert.equal(top(place([at('a', 30, 0, chest(850)), at('b', 900, 0, chest(700))])).y, 850);
});
test('E: комод, поднятый «От пола» без флага навесного (п.6), — опора; полка без флага навесного одна — не опора', () => {
  assert.equal(top(place([at('c', 30, 400, raised(450))])).y, 850);
  assert.equal(top(place([at('c', 30, 600, raised(450))])).y, 1050);
  assert.throws(() => top(place([at('s', 30, 600, shelf(300, 250))])), /Сначала добавьте нижние/);
  assert.throws(() => top(place([at('c', 30, 1800, raised(450))])), /Сначала добавьте нижние/, 'верх выше 1200 — не тумба');
});
