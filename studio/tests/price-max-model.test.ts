// «Цена по большей модели» (решение Макса 26.10.2026, calculation.maxModel): клиенту — большая из «себестоимость × коэффициент»
// и «цена за лист» (листы × 23 000 + то, что вне листовой модели: зеркало и стекло × коэффициент, розница, Вернисаж, Лемана);
// цены изделий в КП — доли по модели цены (за лист: листовая часть по долям листов, «вне листа» — у своего изделия).
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
test("цена по большей модели — max(коэффициент; листы × 23 000 + зеркало вне листа); доли изделий — по модели цены", () => {
  const plain = box(), mirror = box({ mirror: "mirror-silver" });
  const calc = (extra: object) => ({ markup: MARKUP_DEFAULT, overrides: {}, ...extra });
  const p: Project = { ...proj(plain, mirror) };
  const base = estimate(p), sheet = estimate({ ...p, calculation: calc({ model: "sheet" }) }), max = estimate({ ...p, calculation: calc({ maxModel: true }) });
  const mirrorCost = base.lines.filter((l) => l.id.startsWith("glass-") && l.unitPrice !== null).reduce((s, l) => s + l.quantity * l.unitPrice!, 0);
  assert.ok(mirrorCost > 0, "зеркало, плёнка, полировка в смете");
  assert.equal(sheet.offSheet, Math.round(mirrorCost * MARKUP_DEFAULT), "зеркало сверху листов × коэффициент");
  assert.equal(sheet.bySheet, sheet.ldspSheets * sheet.sheetPrice + sheet.retailExtras + sheet.offSheet);
  assert.equal(max.retail, Math.max(base.byMarkup!, sheet.bySheet), "большая из двух");
  assert.equal(max.model, sheet.bySheet > base.byMarkup! ? "sheet" : "markup"); assert.equal(max.maxModel, true);
  assert.equal(base.retail, base.byMarkup, "без флага — как было");
  // позиция без цены: по коэффициенту цена неполная — большую не выбрать
  const open = estimate({ ...p, calculation: calc({ maxModel: true, overrides: {} }), modules: [...p.modules, { id: "x", x: 1800, y: 0, z: 33, rotation: 0, module: box({ facadeMaterial: "external" }) }] });
  assert.ok(open.missing.some((l) => l.id === "facade-external"), "фасады поставщика без цены"); assert.equal(open.retail, null);
  // цены изделий: сумма = итог; по модели «за лист» доля зеркального корпуса выше на зеркало
  const sp = { ...p, calculation: calc({ maxModel: true }) }, items = modulePrices(sp, max.retail)!;
  assert.equal(items.reduce((s, v) => s + v, 0), max.retail);
  const bySheet = modulePrices(sp, sheet.bySheet, "sheet")!, byMarkup = modulePrices(sp, base.byMarkup, "markup")!;
  assert.equal(bySheet.reduce((s, v) => s + v, 0), sheet.bySheet); assert.equal(byMarkup.reduce((s, v) => s + v, 0), base.byMarkup);
  assert.ok(bySheet[1] > bySheet[0] && byMarkup[1] > byMarkup[0]);
  assert.equal(parseProject(JSON.parse(JSON.stringify(sp))).calculation?.maxModel, true, "сохраняется в проекте");
});

test("цена за лист: зеркало шкафа меняет цену только шкафа — листовая часть по долям листов, «вне листа» у своего изделия", () => {
  const calc = { markup: MARKUP_DEFAULT, overrides: {}, model: "sheet" as const };
  const a: Project = { ...proj(box(), box()), calculation: calc }, b: Project = { ...proj(box(), box({ mirror: "mirror-silver" })), calculation: calc };
  const ea = estimate(a), eb = estimate(b), pa = modulePrices(a, ea.retail)!, pb = modulePrices(b, eb.retail)!;
  assert.equal(eb.retail! - ea.retail!, eb.offSheet);
  assert.equal(pb[0], pa[0], "корпус без зеркала — та же цена");
  assert.equal(pb[1] - pa[1], eb.offSheet, "шкаф дороже ровно на зеркало");
});