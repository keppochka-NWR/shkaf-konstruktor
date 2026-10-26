// Заказ 7437584 (часть «а», изделия 1 и 3): общие функции студии, которых не хватало для сборки по ТЗ.
import test from "node:test";
import assert from "node:assert/strict";
import { initialModule, section, validate, minHeightOf, isDrawerModule, parts, parseModule, RULES, TOP_STRIP_STEPS, type Module } from "../src/model";
import { setDoorHinge } from "../src/facadeEditing";
import { freePanel } from "../src/freePanels";
import { estimate, slidePrice } from "../src/pricing";
import { newProject } from "../src/project";

const drawerBox = (patch: Partial<Module> = {}): Module => {
  const m = initialModule();
  Object.assign(m, { name: "Подвесной ящик", width: 800, height: 200, depth: 282, doors: false, plinthHeight: 0, hanging: true, backType: "nailed" }, patch);
  m.sections = [{ ...section(), shelves: [], rod: false, drawers: 1, drawerConfigs: [{ slide: "gtv0fpo", brand: "dtc", operation: "push", height: 120, length: 250, handle: false }] }];
  return m;
};

test("7437584: подвесной ящик 800×200 глубиной 300 с фасадом — ящичный модуль от 150 мм, корпус 282 под направляющую 250", () => {
  const m = drawerBox();
  assert.equal(isDrawerModule(m), true);
  assert.equal(minHeightOf(m), RULES.minDrawerModuleH);
  assert.deepEqual(validate(m), []);
  const ps = parts(m);
  assert.ok(ps.some((p) => p.role === "drawer"), "ящик построен");
  assert.ok(!ps.some((p) => p.id === "plinth"), "навесной — без цоколя");
  // ниже предела ящичного модуля — ошибка с пределом 150
  assert.ok(validate(drawerBox({ height: 140 })).some((e) => e.startsWith(`Высота: допустимо от ${RULES.minDrawerModuleH} до`)));
  // с полкой или дверями это уже не ящичный модуль: прежний предел 250 и глубина 300 для ящиков
  const shelf = drawerBox(); shelf.sections[0].shelves = [0.5];
  assert.equal(minHeightOf(shelf), RULES.minH);
  const doors = drawerBox({ doors: true, height: 600 });
  assert.ok(validate(doors).some((e) => /глубина корпуса от 300 мм/.test(e)), "шкаф с дверями и ящиками — по-прежнему от 300");
});

test("7437584: откидной вверх фасад 800 на подъёмнике — не по пределу распашной створки 640; без подъёмника — как было", () => {
  const ant = (): Module => {
    const m = initialModule();
    Object.assign(m, { name: "Антресоль", width: 800, height: 590, depth: 282, doors: true, doorOpen: "push", plinthHeight: 0, hanging: true, topStrip: 90, backType: "nailed" });
    m.sections = [{ ...section(), drawers: 0, rod: false, doorLeaves: 1, shelves: [0.8387], fixed: [0] }];
    return m;
  };
  const side = ant();
  assert.ok(validate(side).some((e) => e.startsWith("Фасад шире 640")), "распашная створка 800 — ошибка, как раньше");
  const lift = ant();
  setDoorHinge(lift, `${lift.sections[0].id}:door:0`, "top", "adagio");
  assert.deepEqual(validate(lift), []);
  const door = parts(lift).find((p) => p.role === "door")!;
  assert.equal(door.hinge, "top");
  assert.ok(Math.abs(door.size[0] - 796) < 1 && Math.abs(door.size[1] - 494) < 1, "фасад 796 × 494 под карнизом 90");
  assert.ok(parts(lift).some((p) => /:hingeplate:/.test(p.id)), "петли сверху держатся за жёсткую полку у кромки фасада");
  assert.ok(estimate({ ...newProject(), modules: [{ id: "a", x: 10, y: 2000, z: 10, rotation: 0, module: lift }] }).lines.some((l) => l.id === "lift-mechanism:premial-adagio"));
});

test("7437584: свободная панель (щит на стену) не делает смету неполной; скрытые направляющие 250 — оценка от 300", () => {
  const p = newProject(), panel = freePanel({ name: "Щит", width: 1000, height: 1550, thickness: 16, plane: "xy", edge: 2, decor: "Клауд" });
  Object.assign(panel, { x: 100, y: 450, z: 0 });
  const e = estimate({ ...p, modules: [panel] });
  assert.ok(!e.lines.some((l) => l.id === "bazis-hardware:raw"), "у панели студии нет «фурнитуры Базиса»");
  assert.equal(e.missing.length, 0);
  assert.notEqual(e.byMarkup, null);
  const s = slidePrice({ slide: "gtv0fpo", brand: "dtc", operation: "push", length: 250 });
  assert.equal(s.price, 990);
  assert.match(s.source, /Оценка/);
  assert.equal(slidePrice({ slide: "gtv0fpo", brand: "dtc", operation: "push", length: 300 }).price, 1040, "300 — по счёту, как было");
});

test("7437584: скамья — посадочное место 32 (две плиты склейкой на боковинах), склейка в смете; карниз 90 в списке планки", () => {
  const m = initialModule();
  Object.assign(m, { name: "Скамья", width: 1000, height: 450, depth: 300, doors: false, plinthHeight: 0, backType: "nailed", seatTop: true });
  m.sections = [{ ...section(), shelves: [], drawers: 0, rod: false }, { ...section(), shelves: [], drawers: 0, rod: false }];
  assert.deepEqual(validate(m), []);
  const ps = parts(m), top = ps.find((p) => p.id === "top")!, glue = ps.find((p) => p.id === "top:glue")!, left = ps.find((p) => p.id === "left")!;
  assert.deepEqual(top.size, [1000, 16, 300], "верхняя плита на всю ширину");
  assert.equal(glue.position[1], 450 - 24, "нижняя плита под верхней");
  assert.equal(left.size[1], 450 - 32, "боковины короче на 32");
  assert.deepEqual(top.edge, [2, 2, 2, 2]);
  assert.deepEqual(glue.edge, [0, 0, 0, 0]);
  assert.ok(ps.filter((p) => p.id.startsWith("fast:top:")).every((p) => p.size[1] === 50 && Math.abs(p.position[1] - 425) < 1), "конфирматы сверху в торец боковин");
  const e = estimate({ ...newProject(), modules: [{ id: "b", x: 10, y: 0, z: 10, rotation: 0, module: m }] });
  const g = e.lines.find((l) => l.id === "seat-glue")!;
  assert.equal(g.quantity, 0.3);
  assert.equal(g.retail, true);
  assert.ok(validate({ ...m, topGlass: "glass" }).some((e) => e.startsWith("Посадочное место 32")));
  assert.deepEqual(parseModule(JSON.parse(JSON.stringify(m))).seatTop, true, "сохраняется в проекте");
  assert.ok(TOP_STRIP_STEPS.includes(90));
  const a = initialModule(); a.topStrip = 90; assert.deepEqual(validate(a), []);
});
