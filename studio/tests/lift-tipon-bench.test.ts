// Решения Макса 26.10.2026: усилие газлифта АДАЖИО — по весу фасада; откидной фасад без ручки — толкатель TIP-ON в смете сам;
// скамья «без дна» — обувь на полу, перегородки на полу, царга спереди кусками между перегородками.
import test from "node:test";
import assert from "node:assert/strict";
import { initialModule, section, validate, parts, fastenerCounts, type Module } from "../src/model";
import { setDoorHinge } from "../src/facadeEditing";
import { estimate } from "../src/pricing";
import { newProject } from "../src/project";
import { partCollisions } from "../src/collisions";
import { adagioChoice, LIFT_ARM_M } from "../src/gasLift";
import { facadeWeight } from "../src/weight";

const ant = (patch: Partial<Module> = {}): Module => {
  const m = initialModule();
  Object.assign(m, { name: "Антресоль", width: 800, height: 590, depth: 282, doors: true, doorOpen: "push", plinthHeight: 0, hanging: true, topStrip: 90, backType: "nailed" }, patch);
  m.sections = [{ ...section(), drawers: 0, rod: false, doorLeaves: 1, shelves: [0.8387], fixed: [0] }];
  setDoorHinge(m, `${m.sections[0].id}:door:0`, "top", "adagio");
  return m;
};
const est = (m: Module) => estimate({ ...newProject(), modules: [{ id: "a", x: 10, y: 2000, z: 10, rotation: 0, module: m }] });

test("газлифт АДАЖИО: усилие по весу фасада (момент в горизонтали / плечо), ряд 60/80 ПРЕМИУМ, 100/120 — без цены", () => {
  const m = ant(), door = parts(m).find((p) => p.role === "door")!;
  const c = adagioChoice(door, m), w = facadeWeight(door, m);
  assert.equal(c.count, 2, "фасад шире 600 — 2 газлифта (правило Premial)");
  assert.equal(c.required, Math.round((w * 9.81 * door.size[1] / 2000) / (2 * LIFT_ARM_M)));
  assert.equal(c.force, 80); assert.equal(c.premium, true);
  const line = est(m).lines.find((l) => l.id.startsWith("lift-mechanism:premial-adagio"))!;
  assert.match(line.label, /80N/); assert.equal(line.unitPrice, 347.2); assert.equal(line.quantity, 2);
  // тяжёлый фасад (зеркало) — стандартная серия без цены сайта → финальный расчёт с усилием в названии
  const heavy = ant({ mirror: "mirror-silver" }), hd = parts(heavy).find((p) => p.role === "door")!, hc = adagioChoice(hd, heavy);
  assert.ok(hc.required > 80);
  const hl = est(heavy).lines.find((l) => l.id.startsWith("lift-mechanism:premial-adagio"))!;
  assert.equal(hl.unitPrice, null); assert.ok(hl.pending);
});

test("откидной фасад на газлифте без ручки — толкатель TIP-ON (после финального расчёта); с ручкой — нет", () => {
  const e = est(ant());
  const tip = e.lines.find((l) => l.id === "tip-on-lift")!;
  assert.ok(tip && tip.pending && tip.quantity === 1);
  const withHandle = ant({ doorOpen: undefined });
  const hasHandle = parts(withHandle).some((p) => p.role === "handle");
  assert.equal(est(withHandle).lines.some((l) => l.id === "tip-on-lift"), !hasHandle);
});

test("скамья без дна: перегородка на полу, царга спереди кусками, без пересечений и без крепежа в несуществующее дно", () => {
  const m: Module = { ...initialModule(), name: "Скамья", width: 1000, height: 450, depth: 300, doors: false, plinthHeight: 0, backType: "nailed", seatTop: true,
    bottomType: "none", rails: [{ place: "front-bottom", height: 80 }], sections: [section(), section()] };
  assert.deepEqual(validate(m), []);
  const ps = parts(m);
  assert.equal(ps.some((p) => p.id === "bottom"), false, "дна нет — обувь на полу");
  const rails = ps.filter((p) => p.id.startsWith("rail:front-bottom") && p.role !== "fastener");
  assert.equal(rails.length, 2, "царга между боковиной и перегородкой — два куска");
  const dv = ps.find((p) => p.id.endsWith(":divider"))!;
  assert.equal(Math.round(dv.position[1] - dv.size[1] / 2), 0, "перегородка стоит на полу");
  assert.deepEqual(partCollisions(ps, m), []);
  assert.equal(ps.some((p) => p.id.includes(":divider:bottom")), false);
  assert.equal(ps.filter((p) => p.id.startsWith("fast:rail:front-bottom")).length, 4, "по конфирмату в каждый торец куска");
  assert.ok(fastenerCounts(m).confirmats >= 4);
  assert.ok(estimate(newProject(m)).retail! > 0);
});
