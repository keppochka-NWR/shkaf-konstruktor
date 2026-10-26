// Вес изделия по деталям (решение Макса 26.10.2026): плита/ЛХДФ/стекло/зеркало — площадь × толщина × плотность; фурнитура без массы — 0 с пометкой.
import test from "node:test";
import assert from "node:assert/strict";
import { initialModule, parts, section, type Module, type Part } from "../src/model";
import { newProject } from "../src/project";
import { moduleWeight, partMass, facadeWeight, hangerLoad, LDSP_DENSITY, GLASS_DENSITY } from "../src/weight";
import { quoteHTML } from "../src/exports";
import { estimateWorkbookFiles } from "../src/estimateXlsx";

test("лист Lamarty 16×2750×1830 при 700 кг/м³ — 56,4 кг (как у продавцов 56,4–57,2)", () => {
  const sheet = { length: 2750, width: 1830, thickness: 16, material: "board" } as Part;
  assert.equal(LDSP_DENSITY, 700);
  assert.equal(Math.round(partMass(sheet)! * 10) / 10, 56.4);
});

test("вес модуля = сумма плит по площади и толщине; фурнитура без массы считается отдельно", () => {
  const m: Module = { ...initialModule(), width: 600, height: 2000, depth: 550, doors: true, sections: [{ ...section(), doorLeaves: 1, shelves: [0.5] }] };
  const w = moduleWeight(m), ps = parts(m);
  const board = ps.filter((p) => p.material === "board").reduce((s, p) => s + (p.length * p.width * p.thickness) / 1e9 * LDSP_DENSITY, 0);
  assert.ok(Math.abs(w.board - board) < 0.1, `${w.board} ≈ ${board}`);
  assert.ok(w.total >= w.board && w.total < 200);
  assert.ok(w.hardwareNoMass > 0, "петли, ручка — без массы, в итог не входят");
  // зеркало на фасаде добавляет 4 мм стекла по площади фасада
  const door = ps.find((p) => p.role === "door")!;
  const mw = moduleWeight({ ...m, mirror: "mirror-silver" });
  const mirror = (door.length * door.width * 4) / 1e9 * GLASS_DENSITY;
  assert.ok(Math.abs(mw.mirror - mirror) < 0.1);
  assert.ok(facadeWeight({ ...door, mirror: "mirror-silver" }) > facadeWeight(door));
  assert.equal(hangerLoad(m), null, "у корпуса на полу навесов нет");
});

test("КП и Excel: строка «Вес изделия, кг»", () => {
  const p = newProject({ ...initialModule(), width: 600, height: 2000, depth: 550 });
  assert.match(quoteHTML(p, "", "10000", ""), /Вес изделия, кг: \d/);
  const files = estimateWorkbookFiles(p);
  assert.ok(Object.values(files).some((x) => x.includes("Вес изделия, кг")));
});
