// Ширина модуля в ряду (правило Макса 09.10.2026): сосед сужается, у стены — от стены.
import test from "node:test";
import assert from "node:assert/strict";
import { initialModule, type Module } from "../src/model";
import { bounds, type PlacedModule, type Project } from "../src/project";
import { resizeInRow, placeInRow } from "../src/rowResize";

const mod = (name: string, width = 600, extra: Partial<Module> = {}): Module => ({ ...initialModule(), name, width, ...extra });
const at = (id: string, x: number, m: Module, more: Partial<PlacedModule> = {}): PlacedModule => ({ id, x, z: 0, module: m, ...more });
const proj = (modules: PlacedModule[], width = 4000): Project => ({ version: 3, room: { width, depth: 3000, height: 2700, openings: [] }, modules });
const get = (p: Project, id: string) => p.modules.find((a) => a.id === id)!;
const span = (p: Project, id: string) => { const b = bounds(get(p, id)); return [b.x, b.x + b.w, b.z, b.z + b.d]; };
const row3 = () => proj([at("a", 500, mod("Левый")), at("b", 1100, mod("Средний")), at("c", 1700, mod("Правый"))]);

test("ряд из 3: средний +100 — правый сужается на 100, его левый край сдвигается", () => {
  const p = resizeInRow(row3(), "b", 700);
  assert.deepEqual([get(p, "b").x, get(p, "b").module.width], [1100, 700]);
  assert.deepEqual([get(p, "c").x, get(p, "c").module.width], [1800, 500]);
  assert.deepEqual([get(p, "a").x, get(p, "a").module.width], [500, 600]);
});

test("крайний правый без соседа справа: растёт влево, левый сосед сужается", () => {
  const p = resizeInRow(row3(), "c", 700);
  assert.deepEqual([get(p, "c").x, get(p, "c").module.width], [1600, 700]);
  assert.deepEqual([get(p, "b").x, get(p, "b").module.width], [1100, 500]);
  assert.equal(get(p, "c").x + 700, 2300, "правый край ряда на месте");
});

test("сужение: сосед расширяется по тем же правилам", () => {
  const p = resizeInRow(row3(), "b", 500);
  assert.deepEqual([get(p, "b").x, get(p, "b").module.width], [1100, 500]);
  assert.deepEqual([get(p, "c").x, get(p, "c").module.width], [1600, 700]);
});

test("у левой стены: растёт вправо, правый сужается", () => {
  const p = resizeInRow(proj([at("a", 0, mod("У стены")), at("b", 600, mod("Сосед"))]), "a", 700);
  assert.deepEqual([get(p, "a").x, get(p, "a").module.width], [0, 700]);
  assert.deepEqual([get(p, "b").x, get(p, "b").module.width], [700, 500]);
});

test("у правой стены: растёт влево (в сторону, где стена дальше), левый сужается", () => {
  const p = resizeInRow(proj([at("a", 2800, mod("Сосед")), at("b", 3400, mod("У стены"))]), "b", 700);
  assert.deepEqual([get(p, "b").x, get(p, "b").module.width], [3300, 700]);
  assert.equal(get(p, "b").x + 700, 4000, "бок на стене остаётся");
  assert.deepEqual([get(p, "a").x, get(p, "a").module.width], [2800, 500]);
});

test("у стены и без соседей: растёт в свободное место от стены; места нет — «упирается в стену»", () => {
  const right = resizeInRow(proj([at("a", 3400, mod("Один"))]), "a", 700);
  assert.deepEqual([get(right, "a").x, get(right, "a").module.width], [3300, 700]);
  assert.throws(() => resizeInRow(proj([at("a", 0, mod("Во всю стену"))], 600), "a", 700), /упирается в стену/);
  // в свободное место до несмежного модуля — растёт; наезд ловит обычная проверка проекта (пересечение)
  const far = resizeInRow(proj([at("a", 0, mod("Первый")), at("b", 3400, mod("Дальний"))], 4000), "a", 1000);
  assert.deepEqual([get(far, "a").x, get(far, "a").module.width, get(far, "b").x], [0, 1000, 3400]);
});

test("повёрнутый ряд (rotation 90): «справа» — по локальной оси ширины (−z), правый сосед сужается", () => {
  const r = (id: string, z: number, name: string): PlacedModule => ({ id, x: 0, z, rotation: 90, module: mod(name) });
  const p = resizeInRow(proj([r("a", 500, "A"), r("b", 1100, "B"), r("c", 1700, "C")]), "b", 700);
  // u = 0 (левый край B, как смотрит человек на фасад) — z = 1700, на месте; правый край ушёл к меньшему z
  assert.deepEqual(span(p, "b").slice(2), [1000, 1700]);
  assert.deepEqual(span(p, "a").slice(2), [500, 1000]);
  assert.equal(get(p, "a").module.width, 500);
  assert.deepEqual(span(p, "c").slice(2), [1700, 2300]);
});

test("повороты 180 и 270: правый сосед — по оси ширины (−x и +z)", () => {
  const r180 = (id: string, x: number): PlacedModule => ({ id, x, z: 2300, rotation: 180, module: mod(id) });
  const p = resizeInRow(proj([r180("a", 500), r180("b", 1100), r180("c", 1700)]), "b", 700);
  assert.deepEqual(span(p, "b").slice(0, 2), [1000, 1700]);
  assert.deepEqual([span(p, "a").slice(0, 2), get(p, "a").module.width], [[500, 1000], 500]);
  const r270 = (id: string, z: number): PlacedModule => ({ id, x: 3400, z, rotation: 270, module: mod(id) });
  const q = resizeInRow(proj([r270("a", 500), r270("b", 1100), r270("c", 1700)]), "b", 700);
  assert.deepEqual(span(q, "b").slice(2), [1100, 1800]);
  assert.deepEqual([span(q, "c").slice(2), get(q, "c").module.width], [[1800, 2300], 500]);
});

test("сосед стал бы меньше минимума — ошибка, ничего не меняется", () => {
  const p = proj([at("a", 500, mod("Левый")), at("b", 1100, mod("Средний")), at("c", 1700, mod("Узкий", 300))]);
  assert.throws(() => resizeInRow(p, "b", 700), /«Узкий» сузится до 200 мм, а меньше 250/);
});

test("сосед — сырой модуль Базиса — ошибка; столешница и объекты ряда соседями не считаются", () => {
  const raw = mod("НМПГ", 600, { raw: { panels: [], hardware: [] } as unknown as Module["raw"] });
  assert.throws(() => resizeInRow(proj([at("a", 500, mod("Левый")), at("b", 1100, mod("Средний")), at("c", 1700, raw)]), "b", 700), /«НМПГ» — модуль из Базиса/);
  const plinth = mod("Цоколь", 1800, { height: 100, raw: { panels: [], hardware: [], row: true } as unknown as Module["raw"] });
  const p = resizeInRow(proj([at("a", 500, mod("Левый")), at("b", 1100, mod("Средний")), at("c", 1700, mod("Правый")), at("p", 500, plinth, { z: 500 })]), "b", 700);
  assert.equal(get(p, "p").module.width, 1800, "объект ряда не тронут");
  assert.equal(get(p, "c").module.width, 500);
});

test("два уровня: нижний и навесной ряды не влияют друг на друга", () => {
  const low = (id: string, x: number) => at(id, x, mod("Н" + id, 600, { height: 800 }));
  const up = (id: string, x: number) => at(id, x, mod("В" + id, 600, { height: 700 }), { y: 1500 });
  const p = resizeInRow(proj([low("a", 500), low("b", 1100), low("c", 1700), up("u", 500), up("v", 1100), up("w", 1700)]), "b", 700);
  assert.deepEqual([get(p, "c").x, get(p, "c").module.width], [1800, 500]);
  for (const id of ["u", "v", "w"]) assert.equal(get(p, id).module.width, 600);
  assert.deepEqual(["u", "v", "w"].map((id) => get(p, id).x), [500, 1100, 1700]);
});

test("модуль под 90° у бока считается стеной: растём от него", () => {
  // угловой модуль повёрнут на 90° у левой стены, ряд начинается вплотную к его боку
  const corner: PlacedModule = { id: "k", x: 0, z: 0, rotation: 90, module: mod("Поворотный", 1200) };
  const kb = bounds(corner), x0 = kb.x + kb.w;
  const p = resizeInRow(proj([corner, at("a", x0, mod("Первый")), at("b", x0 + 600, mod("Второй"))]), "a", 700);
  assert.deepEqual([get(p, "a").x, get(p, "a").module.width], [x0, 700]);
  assert.deepEqual([get(p, "b").x, get(p, "b").module.width], [x0 + 700, 500]);
});

test("столешница над внешним краем: модуль не выходит из-под неё и она не начинает торчать", () => {
  const base = (id: string, x: number) => at(id, x, mod("Н" + id, 600, { height: 800 }));
  const top = at("t", 500, mod("Столешница", 1200, { height: 38, worktop: { material: "postforming", thickness: 38 } as unknown as Module["worktop"] }), { y: 800 });
  // одиночный модуль без соседей меняет внешний край ряда: шире — выходит из-под столешницы, уже — столешница торчит
  const single = () => proj([at("s", 500, mod("Один", 600, { height: 800 })), { ...top, module: { ...top.module, width: 600 } }]);
  assert.throws(() => resizeInRow(single(), "s", 700), /из-под столешницы/);
  assert.throws(() => resizeInRow(single(), "s", 500), /торчать/);
  // внутри ряда (сосед компенсирует) столешница не мешает
  const p = resizeInRow(proj([base("a", 500), base("b", 1100), top]), "a", 700);
  assert.equal(get(p, "b").module.width, 500);
});

test("placeInRow: правка модуля из панели с той же шириной — просто замена; угловой — по-старому", () => {
  const p = row3(), next = { ...get(p, "b").module, name: "Новое имя" };
  assert.equal(get(placeInRow(p, "b", next), "b").module.name, "Новое имя");
  const wider = placeInRow(p, "b", { ...next, width: 700 });
  assert.deepEqual([get(wider, "c").x, get(wider, "c").module.width, get(wider, "b").module.name], [1800, 500, "Новое имя"]);
});
