// Заказ 7437584 (часть «б», изделия 2, 4, 5): функции студии, которых не хватало для сборки по ТЗ, и сама сборка.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { initialModule, section, validate, parts, boxes, setRodTiers, drawerFaceInset, RULES, type Module } from "../src/model";
import { createKupeWardrobe, assembleModule, hangingDrawer, KIND_LABEL } from "../src/paletteBuild";
import { setWorktopMaterial, WORKTOP_CHOICES } from "../src/kitchen";
import { partCollisions } from "../src/collisions";
import { estimate } from "../src/pricing";
import { pendingPrice } from "../src/pendingPrices";
import { appendModule, newProject, type Project } from "../src/project";
import { removePart } from "../src/operations";
import { orderProject, PRODUCTS } from "../scripts/order-7437584-b";

const look = (decor: string): Module => ({ ...initialModule(), decor, facadeDecor: decor });
const wardrobe = (): Module => {
  const m: Module = { ...initialModule(), name: "Шкаф QA", width: 900, height: 2400, depth: 560, doors: false, sections: [section()] };
  const s = m.sections[0]; s.shelves = [0.9]; s.fixed = [0]; s.rod = true;
  return m;
};

test("вешалка в два яруса: нижняя штанга, вертикальная труба, фланцы и держатели; без пересечений", () => {
  const m = wardrobe(), s = m.sections[0];
  setRodTiers(m, s, true);
  assert.ok(s.rod && s.rodLower! > 0.3 && s.rodLower! < 0.6, String(s.rodLower));
  assert.deepEqual(validate(m), []);
  const ps = parts(m), up = ps.find((p) => p.id === s.id + ":rod")!, low = ps.find((p) => p.id === s.id + ":rod:lower")!, pipe = ps.find((p) => p.id === s.id + ":pipe")!;
  assert.ok(up && low && pipe);
  assert.ok(up.position[1] - low.position[1] >= RULES.rodTierClear, "ярус между штангами");
  assert.ok(pipe.size[1] > pipe.size[0] && pipe.size[1] > 1500, "труба вертикальная, от дна до полки");
  assert.equal(ps.filter((p) => p.id.startsWith(s.id + ":pipe:holder:")).length, 2);
  assert.equal(ps.filter((p) => p.id.startsWith(s.id + ":flange:lower:")).length, 2);
  assert.deepEqual(partCollisions(ps, m), []);
});
test("вешалка в два яруса: проверки ярусов, снятие второго яруса и смета", () => {
  const m = wardrobe(), s = m.sections[0];
  setRodTiers(m, s, true);
  s.rodLower = 0.2;
  assert.ok(validate(m).some((e) => /под нижней штангой/.test(e)));
  s.rodLower = 0.8;
  assert.ok(validate(m).some((e) => /между штангами/.test(e)));
  setRodTiers(m, s, true);
  const p = newProject(m), e = estimate(p), ids = e.lines.map((l) => l.id);
  assert.ok(ids.includes("pipe25") && ids.includes("rod-pipe-holder"), ids.join(","));
  assert.equal(e.lines.find((l) => l.id === "rod-pipe-holder")!.quantity, 2);
  assert.ok(pendingPrice("rod-pipe-holder"), "держатель — после финального расчёта конструктором");
  assert.equal(e.lines.find((l) => l.id === "screw35x16-rod")!.quantity, 3 * RULES.rodMountScrews);
  const r = removePart(p, p.modules[0].id, s.id, s.id + ":rod:lower");
  const s2 = r.modules[0].module.sections[0];
  assert.ok(s2.rod && s2.rodLower === undefined, "ПКМ «Удалить» по нижней штанге снимает только второй ярус");
  setRodTiers(m, s, false);
  assert.equal(s.rodLower, undefined);
});
test("шкаф-купе с дверями внутри: фасады ящиков вкладные (не упираются в выдвинутые боковины)", () => {
  const [body] = createKupeWardrobe(1660, 2600, 600, look("Клауд"), 2, "inside"), m = body.module;
  m.sections.forEach((s) => { s.rod = false; s.shelves = []; s.drawers = 3; });
  assert.ok(drawerFaceInset(m, m.sections[1]));
  assert.deepEqual(validate(m), []);
  const ps = parts(m), right = ps.find((p) => p.id === "right")!, fronts = ps.filter((p) => p.id.endsWith(":facade"));
  assert.ok(fronts.length === 6 && fronts.every((f) => f.position[2] + f.size[2] / 2 <= m.depth + 0.01), "фасад в плоскости корпуса");
  assert.deepEqual(partCollisions(ps, m).filter((c) => c.names.includes(right.name)), []);
  assert.ok(!drawerFaceInset({}, {}), "обычный шкаф — накладные, как было");
});
test("встречные конфирматы через перегородку разнесены по глубине", () => {
  const m: Module = { ...initialModule(), width: 1000, height: 2000, depth: 500, doors: false, sections: [section(), section()] };
  m.sections.forEach((s) => { s.shelves = [0.5]; s.fixed = [0]; });
  assert.deepEqual(partCollisions(parts(m), m), []);
});
test("палитра «Подвесной ящик»: навесной, push DTC, короб под навесами, фасад на всю высоту; 800×200 и 600×200 глубиной 284", () => {
  assert.equal(KIND_LABEL["hanging-drawer"], "Подвесной ящик");
  for (const w of [800, 600]) {
    const m = assembleModule("hanging-drawer", w, 200, 284, look("Тэффи"));
    assert.ok(m.hanging && m.plinthHeight === 0 && !m.doors);
    assert.deepEqual(validate(m), []);
    const c = m.sections[0].drawerConfigs![0];
    assert.equal(c.slide, "gtv0fpo"); assert.equal(c.operation, "push"); assert.equal(c.brand, "dtc"); assert.equal(c.length, 250);
    const ps = parts(m), f = ps.find((p) => p.id.endsWith(":drawer:0:facade"))!;
    assert.ok(f.size[1] >= 194, "фасад " + f.size[1]);
    assert.ok(ps.some((p) => p.id === "kitchen-hanger:left"), "на навесах");
    assert.deepEqual(partCollisions(ps, m), []);
  }
  // в комнату — низом на 750 от пола
  const p = appendModule(newProject(), hangingDrawer(800, 200, 284, look("Тэффи")));
  assert.equal(p.modules.at(-1)!.y, RULES.hangingFloorY);
  assert.match(readFileSync("src/ModulePalette.tsx", "utf8"), /'hanging-drawer'/);
});
test("столешница ЛДСП 32 (16+16): две плиты в раскрое, глубина 320, без кухонных низов — над корпусом на полу; склейка в смете", () => {
  assert.ok(WORKTOP_CHOICES.some((c) => c.id === "ldsp-32" && c.material === "ldsp" && c.thickness === 32));
  const top = assembleModule("worktop", 2600, 32, 320, look("Тэффи"));
  setWorktopMaterial(top, "ldsp", 32);
  assert.deepEqual(validate(top), []);
  const ps = parts(top);
  assert.deepEqual(ps.map((p) => [p.id, p.thickness, !!p.external]), [["worktop", 16, false], ["worktop:lower", 16, false]]);
  const kom = assembleModule("drawers", 900, 800, 284, look("Тэффи"));
  let p: Project = newProject(kom);
  p = appendModule(p, top);
  assert.equal(p.modules.at(-1)!.y, 800, "ставится на комод");
  const e = estimate(p), ids = e.lines.map((l) => l.id);
  assert.ok(ids.includes("worktop-glue") && !ids.some((x) => x.startsWith("worktop:ldsp")), ids.join(","));
  assert.equal(e.lines.find((l) => l.id === "worktop-glue")!.quantity, 0.832);
  // кухонная (постформинг) без кухонных низов — как было: отказ
  assert.throws(() => appendModule(newProject(kom), assembleModule("worktop", 2600, 38, 600, look("Тэффи"))), /нижние кухонные корпуса/);
});
test("заказ 7437584 (изделия 2, 4, 5): собирается функциями без ошибок и пересечений, все позиции с ценой", () => {
  const p = orderProject();
  for (const a of p.modules) {
    assert.deepEqual(validate(a.module), [], a.module.name);
    if (!a.module.kupe && !a.module.worktop) assert.deepEqual(partCollisions(parts(a.module), a.module), [], a.module.name);
  }
  const e = estimate(p);
  assert.equal(e.missing.length, 0, e.missing.map((l) => l.label).join("; "));
  assert.ok((e.byMarkup ?? 0) > 100000);
  assert.ok(PRODUCTS.every(([, re]) => p.modules.some((a) => re.test(a.module.name))));
  const kupe = p.modules.find((a) => a.module.kupeZone)!.module, bb = boxes(kupe);
  assert.deepEqual(bb.map((b) => Math.round(b.width)), [816, 390, 390]);
  assert.equal(kupe.plinthHeight, 100);
});
