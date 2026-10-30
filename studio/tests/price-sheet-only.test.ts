// Цена — ТОЛЬКО по листам (решение Макса 30.10.2026): листы ЛДСП в раскрое × цена листа + всё вне листа (зеркало и стекло × коэффициент,
// розница, Вернисаж, Лемана). «По коэффициенту» и «по большей модели» больше не используются; старые проекты с calculation.model /
// maxModel открываются и считаются по листам. Цены изделий в КП — доли по листам (листовая часть по долям листов, «вне листа» — у своего изделия).
import test from "node:test";
import assert from "node:assert/strict";
import { initialModule, section, type Module } from "../src/model";
import { estimate, MARKUP_DEFAULT, SHEET_PRICE_DEFAULT } from "../src/pricing";
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
test("цена только по листам: листы × 23 000 + зеркало вне листа; старые model/maxModel не меняют цену и отбрасываются при загрузке", () => {
  const plain = box(), mirror = box({ mirror: "mirror-silver" });
  const calc = (extra: object) => ({ markup: MARKUP_DEFAULT, overrides: {}, ...extra });
  const p: Project = { ...proj(plain, mirror) };
  const e = estimate(p);
  assert.equal(e.model, "sheet"); assert.equal(e.sheetPrice, SHEET_PRICE_DEFAULT);
  const mirrorCost = e.lines.filter((l) => l.id.startsWith("glass-") && l.unitPrice !== null && !l.retail).reduce((s, l) => s + l.quantity * l.unitPrice!, 0);
  assert.ok(mirrorCost > 0, "зеркало, плёнка, полировка в смете");
  assert.equal(e.offSheet, Math.round(mirrorCost * MARKUP_DEFAULT), "зеркало сверху листов × коэффициент");
  // наклейка зеркала — розница 1 200 ₽/м² (Макс 27.10.2026): сверху листов как есть, в retailExtras, не × коэффициент
  const glue = e.lines.find((l) => l.id === "glass-mirror-glue")!;
  assert.deepEqual([glue.unitPrice, glue.retail], [1200, true]); assert.equal(e.retailExtras, Math.round(glue.quantity * 1200));
  assert.equal(e.bySheet, e.ldspSheets * e.sheetPrice + e.retailExtras + e.offSheet);
  assert.equal(e.retail, e.bySheet, "цена — по листам");
  // старые проекты: «по коэффициенту», «за лист», «по большей» — та же цена по листам
  for (const old of [{ model: "markup" }, { model: "sheet" }, { maxModel: true }, { maxModel: true, model: "markup" }]) {
    const raw = JSON.parse(JSON.stringify({ ...p, calculation: calc(old) })), q = parseProject(raw);
    assert.equal(q.calculation?.model, undefined); assert.equal(q.calculation?.maxModel, undefined);
    assert.equal(estimate(q).retail, e.retail, JSON.stringify(old));
    assert.equal(estimate({ ...p, calculation: calc(old) }).retail, e.retail, "и без загрузки поле не читается: " + JSON.stringify(old));
  }
  // priceMax ветки o-7427796 — тоже отбрасывается
  assert.equal(parseProject(JSON.parse(JSON.stringify({ ...p, calculation: calc({ priceMax: true }) }))).calculation?.maxModel, undefined);
  // «доп» вне листа без цены (фасады поставщика) — итога нет; с ручной ценой — сверху листов × коэффициент
  const ext: Project = { ...p, modules: [...p.modules, { id: "x", x: 1800, y: 0, z: 33, rotation: 0, module: box({ facadeMaterial: "external" }) }] };
  const open = estimate(ext);
  assert.ok(open.missing.some((l) => l.id === "facade-external"), "фасады поставщика без цены"); assert.equal(open.missingExtras, 1); assert.equal(open.retail, null);
  const priced = estimate({ ...ext, calculation: calc({ overrides: { "facade-external": 5000 } }) }), fq = priced.lines.find((l) => l.id === "facade-external")!.quantity;
  assert.equal(priced.retail, priced.bySheet); assert.equal(priced.offSheet - open.offSheet, Math.round(fq * 5000 * MARKUP_DEFAULT));
  // позиция без цены внутри листа итог не блокирует — tests/pricing.test.ts (направляющая 550), pricing-groups (фурнитура Базиса)
  // своя цена листа проекта — действует
  assert.equal(estimate({ ...p, calculation: calc({ sheetPrice: 25000 }) }).retail, e.ldspSheets * 25000 + e.retailExtras + e.offSheet);
  // цены изделий: сумма = итог; доля зеркального корпуса выше на зеркало
  const items = modulePrices(p, e.retail)!;
  assert.equal(items.reduce((s, v) => s + v, 0), e.retail);
  assert.ok(items[1] > items[0]);
});

test("цена по листам: зеркало шкафа меняет цену только шкафа — листовая часть по долям листов, «вне листа» у своего изделия", () => {
  const a: Project = proj(box(), box()), b: Project = proj(box(), box({ mirror: "mirror-silver" }));
  const ea = estimate(a), eb = estimate(b), pa = modulePrices(a, ea.retail)!, pb = modulePrices(b, eb.retail)!;
  // вне листа: зеркало, плёнка, полировка × коэффициент (offSheet) + наклейка зеркала — розница (retailExtras, Макс 27.10.2026)
  const extra = eb.offSheet + eb.retailExtras - ea.retailExtras;
  assert.equal(eb.retail! - ea.retail!, extra);
  assert.equal(pb[0], pa[0], "корпус без зеркала — та же цена");
  assert.equal(pb[1] - pa[1], extra, "шкаф дороже ровно на зеркало");
});
