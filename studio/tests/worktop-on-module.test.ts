// Правка Макса 29.10.2026: «Полка тоже может быть опорой столешницы, делаем так, что столешница выставляется на модуль через
// правое меню». Опору не угадываем — «Столешница на модуль» кладёт столешницу на верх выбранного модуля (любого: комод на полу,
// поднятая полка, подвесная тумба, кухонный нижний), его ширины и с его поворотом. Палитра «Столешница» — как была.
import test from "node:test";
import assert from "node:assert/strict";
import { initialModule, section, type Module } from "../src/model";
import { applyAutoFillers, appendModule, bounds, newProject, projectErrors, type PlacedModule, type Project } from "../src/project";
import { createModule } from "../src/ModulePalette";
import { hangingDrawer } from "../src/paletteBuild";
import { kitchenTemplate } from "../src/kitchenProject";
import { worktopOnModule, worktopHostProblem } from "../src/worktopOn";
import { KITCHEN } from "../src/kitchen";

const chest = () => createModule("drawers", 800, 850, 500, initialModule());
const shelf = (): Module => ({ ...initialModule(), name: "Полка настенная", width: 600, height: 300, depth: 400, doors: false, plinthHeight: 0, sections: [{ ...section(), shelves: [] }] });
const at = (id: string, x: number, y: number, module: Module, rotation = 0): PlacedModule => ({ id, x, y, z: 30, rotation, module });
function place(mods: PlacedModule[]): Project { const p = newProject(mods[0].module); p.modules = mods; const f = applyAutoFillers(p); assert.deepEqual(projectErrors(f), []); return f; }
const top = (p: Project, id: string) => p.modules.find((a) => a.id === id)!;

test("красный до правки: палитра без выбора опоры — полка «От пола» не опора, столешница не встаёт", () => {
  assert.throws(() => appendModule(place([at("s", 30, 1000, shelf())]), createModule("worktop", 600, 38, 600, initialModule())), /Сначала добавьте нижние/);
});

test("комод на полу: ЛДСП 32, ширина комода, на его верху, от задней кромки до лица фасадов", () => {
  const p = place([at("c", 30, 0, chest())]);
  const r = worktopOnModule(p, "c"), w = top(r.project, r.id);
  assert.deepEqual([w.module.worktop!.material, w.module.worktop!.thickness, w.module.height, w.module.width, w.y], ["ldsp", 32, 32, 800, 850]);
  assert.equal(w.module.depth, 3 + 500 + 18, "задник 3 + корпус 500 + фасад 18");
  const b = bounds(top(p, "c")), bw = bounds(w);
  assert.deepEqual([bw.x, bw.z, bw.x + bw.w, bw.z + bw.d], [b.x, b.z, b.x + b.w, b.z + b.d], "в плане — ровно габарит комода с фасадами");
  assert.deepEqual(projectErrors(applyAutoFillers(r.project)), []);
});

test("поднятая полка (без флага навесного) и подвесная тумба — тоже опоры, если выбрал менеджер", () => {
  const p = place([at("s", 30, 1000, shelf())]);
  const r = worktopOnModule(p, "s"), w = top(r.project, r.id);
  assert.deepEqual([w.y, w.module.width, w.module.depth], [1300, 600, 403]);
  const q = place([at("v", 300, 470, hangingDrawer(825, 400, 431, initialModule()))]);
  const r2 = worktopOnModule(q, "v"), w2 = top(r2.project, r2.id);
  assert.deepEqual([w2.y, w2.module.width], [870, 825]);
});

test("кухонный нижний: кухонная столешница 38, до фасада + свес 24, не мельче 600", () => {
  const k = kitchenTemplate("base-doors", 600, initialModule());
  const p = place([at("k", 500, 0, k)]);
  const r = worktopOnModule(p, "k"), w = top(r.project, r.id);
  assert.deepEqual([w.module.worktop!.material, w.module.worktop!.thickness, w.module.width, w.y], ["postforming", KITCHEN.worktopThickness, 600, k.height]);
  assert.ok(w.module.depth >= KITCHEN.worktopDepth);
});

test("повёрнутый модуль — столешница с тем же поворотом над ним; второй раз — отказ; купе и столешница — пункт неактивен", () => {
  const p = place([at("c", 1000, 0, chest(), 90)]);
  const r = worktopOnModule(p, "c"), w = top(r.project, r.id);
  assert.equal(w.rotation, 90);
  const b = bounds(top(p, "c")), bw = bounds(w);
  assert.deepEqual([bw.x, bw.z, bw.w, bw.d], [b.x, b.z, b.w, b.d]);
  assert.throws(() => worktopOnModule(r.project, "c"), /уже лежит/);
  assert.match(worktopHostProblem(w.module)!, /уже столешница/);
});
