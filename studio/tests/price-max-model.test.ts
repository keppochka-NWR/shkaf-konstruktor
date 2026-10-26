// «Цена по большей модели» (решение Макса 26.10.2026, calculation.maxModel; коммит ef9811a ветки o-7441182, перенесён в o-7437584a):
// клиенту — большая из «себестоимость × коэффициент» и «цена за лист»; цены изделий КП — доли по модели цены.
// В этой ветке нет зеркала на фасадах (Module.mirror) — проверки «зеркало вне листа» остались в ветке o-7441182.
import test from "node:test";
import assert from "node:assert/strict";
import { initialModule, section, type Module } from "../src/model";
import { estimate, MARKUP_DEFAULT } from "../src/pricing";
import { newProject, parseProject, type Project } from "../src/project";
import { modulePrices } from "../src/itemPrices";

const box = (patch: Partial<Module> = {}): Module => {
  const m = initialModule();
  Object.assign(m, { name: "Корпус", width: 430, height: 2000, depth: 510, doors: true, decor: "Каньон Ледяной", facadeDecor: "Каньон Ледяной" }, patch);
  m.sections = [{ ...section(), shelves: [], drawers: 0, rod: true }];
  return m;
};
const proj = (...ms: Module[]): Project => ({ ...newProject(), room: { width: 3000, depth: 2000, height: 2600, openings: [] },
  modules: ms.map((module, i) => ({ id: "m" + i, x: 400 + i * 600, y: 0, z: 33, rotation: 0 as const, module })) });
test("цена по большей модели — max(коэффициент; листы × цена листа + вне листа); доли изделий в сумме = итог", () => {
  const calc = (extra: object) => ({ markup: MARKUP_DEFAULT, overrides: {}, ...extra });
  const p: Project = proj(box(), box({ width: 600 }));
  const base = estimate(p), sheet = estimate({ ...p, calculation: calc({ model: "sheet" }) }), max = estimate({ ...p, calculation: calc({ maxModel: true }) });
  assert.equal(max.retail, Math.max(base.byMarkup!, sheet.bySheet), "большая из двух");
  assert.equal(max.maxModel, true);
  assert.equal(base.retail, base.byMarkup, "без флага — как было");
  const sp = { ...p, calculation: calc({ maxModel: true }) }, items = modulePrices(sp, max.retail)!;
  assert.equal(items.reduce((s, v) => s + v, 0), max.retail);
  assert.equal(parseProject(JSON.parse(JSON.stringify(sp))).calculation?.maxModel, true, "сохраняется в проекте");
});
