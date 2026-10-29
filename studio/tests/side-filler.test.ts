// Баг Макса 29.10.2026: «Фальш не добавляется. В круглом меню возможность есть, по факту не работает». Причина: «Фальши ›
// Фальшпанель слева/справа» ставила панель снаружи боковины без места под неё — у модуля вплотную к соседу правка отклонялась
// «пересекается», панели не было. Правило (РЕШЕНИЯ.md 29.10): с другой стороны свободно — модуль сдвигается на ширину фальша,
// вплотную модуль/стена — модуль уже на ширину фальша; у стены фальш 16 + 4 = 20.
import test from "node:test";
import assert from "node:assert/strict";
import { initialModule, parts, section, type Module } from "../src/model";
import { applyAutoFillers, newProject, projectErrors, type PlacedModule, type Project } from "../src/project";
import { toggleSideFiller } from "../src/sideFiller";
import { placeInRow } from "../src/rowResize";
import { kitchenTemplate } from "../src/kitchenProject";
import { nest } from "../src/exports";
import { estimate } from "../src/pricing";

const empty = () => [{ ...section(), shelves: [], drawers: 0, rod: false }];
const wardrobe = (w = 800, name = "Шкаф"): Module => ({ ...initialModule(), name, width: w, height: 2200, depth: 600, ...(w < 400 ? { sections: empty() } : {}) });
function room(mods: PlacedModule[], width = 4000): Project {
  const p = newProject(mods[0].module); p.room.width = width; p.modules = mods;
  const f = applyAutoFillers(p); assert.deepEqual(projectErrors(f), []); return f;
}
const at = (id: string, x: number, module: Module, y = 0): PlacedModule => ({ id, x, y, z: 30, rotation: 0, module });
const get = (p: Project, id: string) => p.modules.find((a) => a.id === id)!;
const commit = (p: Project) => { const f = applyAutoFillers(p); assert.deepEqual(projectErrors(f), []); return f; };

test("красный до правки: старый путь меню (modifyAt → placeInRow) у модуля вплотную к соседу — «пересекается»", () => {
  const p = room([at("a", 500, wardrobe()), at("b", 1300, wardrobe())]);
  const n = structuredClone(get(p, "b").module); n.sidePanels = { left: { height: 2400, depth: 618 } };
  const e = projectErrors(applyAutoFillers(placeInRow(p, "b", n)));
  assert.ok(e.some((x) => /пересекается/.test(x)), "так было: панель уходила в соседа, правка не применялась");
});

test("слева сосед вплотную, справа свободно — модуль сдвигается вправо на 16, ширина та же, панель слева", () => {
  const p = room([at("a", 500, wardrobe()), at("b", 1300, wardrobe())]);
  const r = toggleSideFiller(p, "b", "left"), b = get(commit(r.project), "b");
  assert.deepEqual([b.x, b.module.width, r.shift, r.narrow], [1316, 800, 16, 0]);
  assert.ok(b.module.sidePanels?.left);
  assert.match(r.note, /сдвинут вправо на 16/);
});

test("пример Макса: справа модуль вплотную, слева ставят фальш — модуль уже на 16 (левый край на месте, правый тоже)", () => {
  const p = room([at("b", 1300, wardrobe()), at("c", 2100, wardrobe())]);
  const r = toggleSideFiller(p, "b", "left"), b = get(commit(r.project), "b");
  assert.deepEqual([b.x, b.module.width, r.shift, r.narrow], [1316, 784, 0, 16]);
  assert.equal(get(r.project, "c").x, 2100, "сосед не тронут");
  assert.match(r.note, /уже на 16 мм: 800 → 784/);
});

test("справа фальш, слева свободно — сдвиг влево; частично свободно (10 мм) — сдвиг на 10 и сужение на 6", () => {
  const p = room([at("b", 1300, wardrobe()), at("c", 2100, wardrobe())]);
  const r = toggleSideFiller(p, "c", "right"), c = get(commit(r.project), "c");
  // у «c» слева вплотную «b» — места нет: сужение
  assert.deepEqual([c.x, c.module.width], [2100, 784]);
  const q = room([at("b", 1300, wardrobe()), at("c", 2110, wardrobe()), at("d", 2910, wardrobe())]);
  const r2 = toggleSideFiller(q, "c", "right"), c2 = get(commit(r2.project), "c");
  assert.deepEqual([r2.shift, r2.narrow, c2.x, c2.module.width], [10, 6, 2100, 794]);
});

test("у стены: фальш торцом 20 (16 + 4) заменяется панелью — модуль не двигается; без места у стены — сдвиг от стены на 20", () => {
  const p = room([at("a", 500, wardrobe())]);
  const wall = toggleSideFiller({ ...p, modules: [{ ...get(p, "a"), x: 20 }] }, "a", "left");
  const a = get(commit(wall.project), "a");
  assert.deepEqual([a.x, a.module.width, wall.shift, wall.narrow], [20, 800, 0, 0]);
  assert.ok(!a.module.wallFiller?.left && a.module.sidePanels?.left);
  // «Без фальша у стены» — корпус вплотную к стене: панели нужно 16 + 4, справа свободно — сдвиг на 20
  const tight = room([{ ...at("a", 0, { ...wardrobe(), autoFillersOff: true }) }]);
  const r = toggleSideFiller(tight, "a", "left"), t = get(commit(r.project), "a");
  assert.deepEqual([t.x, t.module.width, r.shift], [20, 800, 20]);
});

test("ниша впритык: модуль между стеной и соседом сужается; ниже минимума — отказ с причиной", () => {
  // комната 960: «a» 800 у левой стены (фальш 20), «b» 120 до правой стены (фальш 20)
  const p = room([at("a", 20, wardrobe()), at("b", 820, wardrobe(120))], 960);
  const r = toggleSideFiller(p, "b", "left"), b = get(commit(r.project), "b");
  assert.deepEqual([b.module.width, b.x], [104, 836]);
  const q = room([at("a", 20, wardrobe()), at("b", 820, { ...wardrobe(100), doors: false })], 920);
  assert.throws(() => toggleSideFiller(q, "b", "left"), /сузить до 84 мм, а меньше 100/);
});

test("снять панель — только панель; Ctrl+Z (прежний проект) возвращает всё; в деталях и смете панель одна", () => {
  const p = room([at("a", 500, wardrobe()), at("b", 1300, wardrobe())]);
  const r = toggleSideFiller(p, "b", "left"), n = commit(r.project);
  const ids = parts(get(n, "b").module).map((x) => x.id).filter((x) => x.startsWith("side-panel"));
  assert.deepEqual(ids, ["side-panel:left"]);
  const before = estimate(p, nest(p)).retail ?? 0, after = estimate(n, nest(n)).retail ?? 0;
  assert.ok(after > before, `смета выросла: ${before} → ${after}`);  const off = toggleSideFiller(n, "b", "left");
  assert.equal(get(off.project, "b").module.sidePanels, undefined);
});

test("кухонный нижний: панель высотой модуля, сосед справа вплотную — модуль уже на 16", () => {
  const src = initialModule(), k = (w: number) => kitchenTemplate("base-doors", w, src);
  const p = room([at("k1", 500, k(600)), at("k2", 1100, k(600))]);
  const r = toggleSideFiller(p, "k1", "left"), a = get(commit(r.project), "k1");
  assert.equal(a.module.sidePanels!.left!.height, a.module.height);
  assert.deepEqual([a.x, a.module.width], [516, 584]);
});

test("антресоль сверху той же ширины едет и сужается вместе со шкафом", () => {
  const up: Module = { ...wardrobe(), name: "Антресоль", height: 400, plinthHeight: 0, sections: empty() };
  const p = room([at("b", 1300, wardrobe()), at("c", 2100, wardrobe()), at("u", 1300, up, 2200)]);
  const r = toggleSideFiller(p, "b", "left"), n = commit(r.project);
  assert.deepEqual([get(n, "u").x, get(n, "u").module.width], [1316, 784]);
});

test("меню: «Фальши ›» у шкафа и у кухонного модуля палитры; пункт зовёт правило сдвига/сужения (sideFiller), не старую правку", async () => {
  const { fillersItem, kitchenFillerItems, quickItems } = await import("../src/quickMenu");
  const calls: string[] = [];
  const ops = { modify: () => calls.push("modify"), addUpper: () => {}, sideFiller: (s: "left" | "right") => calls.push("side:" + s) };
  fillersItem(wardrobe(), ops).children!.find((x) => x.id === "q-side-left")!.run!();
  assert.deepEqual(calls, ["side:left"]);
  const k = kitchenTemplate("base-doors", 600, initialModule());
  assert.deepEqual(quickItems(k, k.sections[0].id, ops), [], "у кухни нет шкафных пунктов");
  const items = kitchenFillerItems(k, ops);
  assert.deepEqual(items.map((x) => x.id), ["q-fillers"]);
  assert.deepEqual(items[0].children!.map((x) => x.id), ["q-side-left", "q-side-right"], "у кухни — только боковые фальшпанели");
  assert.deepEqual(kitchenFillerItems(wardrobe(), ops), [], "шкаф — через quickItems");
});
