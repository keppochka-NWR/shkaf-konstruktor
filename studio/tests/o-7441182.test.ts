// Заказ 7441182 (прихожая): общие функции студии, которых не хватало для сборки по ТЗ — щит над сиденьем своим декором,
// утопленный цоколь с фасадами над цоколем, петли без доводчика; решения Макса 26.10 — «без фальша у стены» по эскизу и «цена по большей\n// модели» (зеркальный фасад — из ветки o-7427796).
import test from "node:test";
import assert from "node:assert/strict";
import { initialModule, section, validate, parts, parseModule, facadeBottom, facadeTop, RULES, type Module } from "../src/model";
import { estimate } from "../src/pricing";
import { newProject, applyAutoFillers, setWallFillersOff, type Project } from "../src/project";
import { addUpperModule, setWallDistance } from "../src/operations";

const box = (patch: Partial<Module> = {}): Module => {
  const m = initialModule();
  Object.assign(m, { name: "Корпус", width: 430, height: 2000, depth: 510, doors: true, decor: "Каньон Ледяной", facadeDecor: "Каньон Ледяной" }, patch);
  m.sections = [{ ...section(), shelves: [], drawers: 0, rod: true }];
  return m;
};
const proj = (...ms: Module[]): Project => ({ ...newProject(), room: { width: 3000, depth: 2000, height: 2600, openings: [] },
  modules: ms.map((module, i) => ({ id: "m" + i, x: 400 + i * 600, y: 0, z: 33, rotation: 0 as const, module })) });

test("7441182: цоколь утоплен — цоколь на 50 от переда, фасад над цоколем (низ фасада = низ дна)", () => {
  const plain = box(), m = box({ plinthRecess: 50 });
  assert.deepEqual(validate(m), []);
  assert.equal(facadeBottom(plain), RULES.facadeFloorGap, "как было: фасад до 30 от пола");
  assert.equal(facadeBottom(m), 80, "утоплен: фасад от низа дна");
  const pl = parts(m).find((p) => p.id === "plinth")!, door = parts(m).find((p) => p.role === "door")!;
  assert.equal(pl.position[2], 510 - 50 - 8, "цоколь утоплен на 50");
  assert.equal(door.size[1], 2000 - 2 - 80, "дверь 1918 над цоколем");
  assert.ok(validate(box({ plinthRecess: 50, plinthHeight: 0 })).some((e) => e.startsWith("Цоколь утоплен")), "без цоколя — нельзя");
  assert.ok(validate(box({ plinthRecess: 500 })).some((e) => e.startsWith("Цоколь утоплен")));
  assert.equal(parseModule(JSON.parse(JSON.stringify(m))).plinthRecess, 50, "сохраняется");
});

test("7441182: петли без доводчика — своя строка сметы (GTV SOLID PLUS 115 ₽), push и с доводчиком — как было", () => {
  const soft = estimate(proj(box())), simple = estimate(proj(box({ hingeSoft: false })));
  const h = simple.lines.find((l) => l.id === "hinge-simple")!;
  assert.ok(h && h.unitPrice === 115 && h.quantity === 4, JSON.stringify(h));
  assert.ok(!simple.lines.some((l) => l.id === "hinge"), "петель с доводчиком нет");
  assert.ok(soft.lines.some((l) => l.id === "hinge") && !soft.lines.some((l) => l.id === "hinge-simple"));
  const blum = estimate(proj(box({ hingeSoft: false, hingeBrand: "blum" })));
  assert.ok(blum.lines.some((l) => l.id === "hinge-simple:blum"));
  assert.equal(parseModule(JSON.parse(JSON.stringify(box({ hingeSoft: false })))).hingeSoft, false);
  assert.ok(validate({ ...box(), hingeSoft: true as unknown as false }).some((e) => e.startsWith("Неверный тип петель")));
});

test("7441182: тумба с посадочным местом — фасад закрывает торец сиденья (эскиз: 420 от цоколя), щит над сиденьем своим декором в раскрое", () => {
  // эскиз (решение Макса 26.10: подгонять всё под эскиз): цоколь 80 + фасад 420 = верх сиденья 500, ниша 1500 до антресоли на 2000
  const t = box({ width: 500, height: 500, seatTop: true, plinthRecess: 50, seatPanel: { height: 1500, decor: "МАРЦИПАН" } });
  t.sections = [{ ...section(), shelves: [0.5], drawers: 0, rod: false }];
  assert.deepEqual(validate(t), []);
  assert.equal(facadeTop(t), 500 - 2, "накладной фасад до верха сиденья");
  const ps = parts(t), door = ps.find((p) => p.role === "door")!, panel = ps.find((p) => p.id === "seat-panel")!;
  assert.equal(Math.round(door.size[1]), 418, "фасад 418 (80 → 498)");
  assert.deepEqual(panel.size, [500, 1500, 16]);
  assert.equal(panel.position[1], 500 + 750, "стоит на сиденье");
  assert.equal(panel.position[2], 8, "у задней кромки");
  assert.equal(panel.decor, "МАРЦИПАН");
  const e = estimate(proj(t));
  assert.ok(e.lines.some((l) => l.id === "sheet:МАРЦИПАН"), "лист Марципана в смете");
  assert.ok(validate({ ...t, seatPanel: { height: 50 } }).some((x) => x.startsWith("Щит над сиденьем")));
  assert.deepEqual(parseModule(JSON.parse(JSON.stringify(t))).seatPanel, { height: 1500, decor: "МАРЦИПАН" });
});
test("7441182: антресоль на тумбу не наследует сиденье, щит и утопленный цоколь; поднятая — навесная без цоколя", () => {
  const t = box({ width: 500, height: 532, seatTop: true, plinthRecess: 50, seatPanel: { height: 1468 }, hingeSoft: false });
  t.sections = [{ ...section(), shelves: [0.5], drawers: 0, rod: false }];
  let p = proj(t); p.modules[0].x = 21;
  p = addUpperModule(p, "m0");
  const up = p.modules.at(-1)!;
  assert.equal(up.module.seatTop, undefined); assert.equal(up.module.seatPanel, undefined); assert.equal(up.module.plinthRecess, undefined);
  assert.equal(up.module.hingeSoft, false, "петли без доводчика — как у нижнего");
  p = setWallDistance(p, up.id, "y", 2000);
  const lifted = p.modules.find((a) => a.id === up.id)!;
  assert.equal(lifted.y, 2000); assert.equal(lifted.module.hanging, true);
});

test("7441182: «без фальша у стены» по эскизу — планка снята, корпус вплотную к стене, антресоль сверху — тоже без фальша; обратно — планка", () => {
  const t = box({ width: 500, height: 500, hingeSoft: false });
  t.sections = [{ ...section(), shelves: [0.5], drawers: 0, rod: false }];
  let p: Project = { ...proj(t), modules: [{ id: "t", x: 0, y: 0, z: 33, rotation: 0, module: t }] };
  p = applyAutoFillers(p);
  assert.equal(p.modules[0].x, 20, "регламент: фальш 100×16 торцом + зазор 4 = 20 (решение Макса 29.10, было 21)");
  assert.ok(p.modules[0].module.wallFiller?.left);
  p = setWallFillersOff(p, "t", true);
  assert.equal(p.modules[0].x, 0, "вплотную к стене");
  assert.equal(p.modules[0].module.wallFiller, undefined); assert.equal(p.modules[0].module.autoFillersOff, true);
  assert.equal(applyAutoFillers(p).modules[0].x, 0, "автофальши не возвращают планку");
  p = addUpperModule(p, "t");
  const up = p.modules.at(-1)!;
  assert.equal(up.x, 0); assert.equal(up.module.autoFillersOff, true); assert.equal(applyAutoFillers(p).modules.at(-1)!.module.wallFiller, undefined);
  const back = setWallFillersOff(p, "t", false);
  assert.equal(back.modules[0].x, 20); /* 16 + 4 (29.10) */ assert.ok(back.modules[0].module.wallFiller?.left);
});
