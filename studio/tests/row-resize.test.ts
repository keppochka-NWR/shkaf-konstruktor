// Ширина модуля в ряду (правило Макса 09.10.2026): сосед сужается, у стены — от стены.
import test from "node:test";
import { readFileSync } from "node:fs";
import assert from "node:assert/strict";
import { initialModule, section, boxes, type Module } from "../src/model";
import { bounds, projectErrors, applyAutoFillers, type PlacedModule, type Project } from "../src/project";
import { resizeInRow, placeInRow } from "../src/rowResize";
import { fitMeshItem } from "../src/operations";
import { DEFAULT_MESH } from "../src/mesh";
import { kitchenTemplate, type KitchenItem } from "../src/kitchenProject";

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

test("пенал рядом с нижним и навесным — бок для обоих уровней: правка одного ряда не трогает пенал и другой ряд", () => {
  const low = (id: string, x: number, w = 600) => at(id, x, mod("Н" + id, w, { height: 800 }));
  const up = (id: string, x: number, w = 600) => at(id, x, mod("В" + id, w, { height: 700 }), { y: 1400 });
  const tall = (id: string, x: number) => at(id, x, mod("Пенал" + id, 600, { height: 2100 }));
  const top = (x: number, w: number) => at("t", x, mod("Столешница", w, { height: 38, worktop: { material: "postforming", thickness: 38 } as unknown as Module["worktop"] }), { y: 800 });
  // […][Нижний Т @2021][Пенал @2621], навесной над нижним 2021..2621, столешница до пенала
  const kitchen = () => proj([low("l", 1421), low("t1", 2021), tall("p", 2621), up("u", 2021), top(1421, 1200)]);
  const p = resizeInRow(kitchen(), "t1", 700);
  assert.deepEqual([get(p, "t1").x, get(p, "t1").module.width], [1921, 700], "нижний растёт от пенала");
  assert.deepEqual([get(p, "l").x, get(p, "l").module.width], [1421, 500], "левый нижний сужается");
  assert.deepEqual([get(p, "p").x, get(p, "p").module.width, get(p, "u").x, get(p, "u").module.width], [2621, 600, 2021, 600], "пенал и навесной на месте");
  // [Мойка 800][Пенал 600], навесной 800 над мойкой: навесной +100 — растёт от пенала влево, пенал не сужается
  const sink = () => proj([at("m", 500, mod("Мойка", 800, { height: 800 })), tall("p", 1300), up("u", 500, 800)]);
  const q = resizeInRow(sink(), "u", 900);
  assert.deepEqual([get(q, "u").x, get(q, "u").module.width, get(q, "p").x, get(q, "p").module.width], [400, 900, 1300, 600]);
  // навесной справа от пенала, справа никого: растёт вправо, пенал (к нему справа примыкает нижний) не трогаем
  const right = () => proj([tall("p", 1000), up("u", 1600), low("b", 1600)]);
  const r = resizeInRow(right(), "u", 700);
  assert.deepEqual([get(r, "u").x, get(r, "u").module.width, get(r, "p").x, get(r, "p").module.width, get(r, "b").module.width], [1600, 700, 1000, 600, 600]);
  // сам пенал между двумя уровнями с обеих сторон: шире — ошибка с понятным текстом
  assert.throws(() => resizeInRow(proj([low("a", 400), up("v", 400), tall("p", 1000), low("b", 1600), up("w", 1600)]), "p", 700), /разных уровней/);
  // пенал без навесного над соседом, но столешница кончается у пенала: нижний не выходит из-под неё — растёт от пенала
  const noUp = resizeInRow(proj([low("l", 1421), low("t1", 2021), tall("p", 2621), top(1421, 1200)]), "t1", 700);
  assert.deepEqual([get(noUp, "t1").x, get(noUp, "l").module.width, get(noUp, "p").module.width], [1921, 500, 600]);
  // два пенала рядом — один уровень, сосед сужается как обычно
  const two = resizeInRow(proj([tall("a", 1000), tall("b", 1600)]), "a", 700);
  assert.deepEqual([get(two, "b").x, get(two, "b").module.width], [1700, 500]);
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
  // цоколь «Ряда» Базиса вдоль модуля: не удлиняется — модуль не выходит за него и он не торчит
  const plinth = at("z", 500, mod("Цоколь · Фронтальная", 600, { height: 100, depth: 19, raw: { panels: [], hardware: [], row: true } as unknown as Module["raw"] }), { z: 500 });
  const onPlinth = () => proj([at("s", 500, mod("Один", 600, { height: 800 })), plinth]);
  assert.throws(() => resizeInRow(onPlinth(), "s", 700), /цоколь Базиса не удлиняется/);
  assert.throws(() => resizeInRow(onPlinth(), "s", 500), /Цоколь «Цоколь · Фронтальная» будет торчать/);
  // внутри ряда (сосед компенсирует) столешница не мешает
  const p = resizeInRow(proj([base("a", 500), base("b", 1100), top]), "a", 700);
  assert.equal(get(p, "b").module.width, 500);
});

test("кухня: сосед не уходит за максимум 1200 и под технику — только ширины ниш", () => {
  const k = (kind: KitchenItem, w: number) => kitchenTemplate(kind, w, initialModule());
  // B 600 → 450 рядом с C 1100: C стал бы 1250 > 1200
  const wide = proj([at("a", 500, k("base-doors", 600)), at("b", 1100, k("base-doors", 600)), at("c", 1700, { ...k("base-doors", 600), width: 1100 })]);
  assert.throws(() => resizeInRow(wide, "b", 450), /расширится до 1250 мм, а больше 1200/);
  // под духовку 600 → 500 и под мойку 600 → 300 — ошибка; под мойку 800 → 600 — можно (ширина ниши)
  assert.throws(() => resizeInRow(proj([at("a", 500, k("base-doors", 600)), at("o", 1100, k("oven", 600))]), "a", 700), /под технику.*600 мм, а стала бы 500/);
  assert.throws(() => resizeInRow(proj([at("a", 500, k("base-doors", 600)), at("s", 1100, k("sink", 600))]), "a", 900), /стала бы 300/);
  const ok = resizeInRow(proj([at("a", 500, k("base-doors", 600)), at("s", 1100, k("sink", 800))]), "a", 800);
  assert.deepEqual([get(ok, "s").x, get(ok, "s").module.width], [1300, 600]);
});

test("подгонка ширины под сетку (fitMeshItem) идёт по правилу ряда: без щели и без наезда", () => {
  const empty = (name: string) => mod(name, 600, { depth: 650, sections: [section()] });
  const z = { z: 30 }; // задняя стенка внакладку — корпус на 3 мм от стены, иначе «выходит за границы помещения»
  const p = proj([at("a", 500, empty("Левый"), z), at("b", 1100, empty("Средний"), z), at("c", 1700, empty("Правый"), z)]);
  const b = get(p, "b"), sid = b.module.sections[0].id;
  const next = fitMeshItem(p, "b", sid, DEFAULT_MESH, boxes(b.module)[0].bottom);
  const w = get(next, "b").module.width;
  assert.notEqual(w, 600, "ширина подогнана");
  assert.equal(get(next, "b").x, 1100);
  assert.deepEqual([get(next, "c").x, get(next, "c").x + get(next, "c").module.width], [1100 + w, 2300], "правый сосед вплотную, правый край ряда на месте");
  assert.deepEqual(projectErrors(next), []);
});

test("объект замера (колонна, короб) — как стена: модуль у него меняется от него, в свободное место до него — не дальше", () => {
  const column = { id: "col", name: "Колонна", type: "column" as const, x: 1100, y: 0, z: 0, width: 300, depth: 300, height: 2700 };
  const withColumn = (modules: PlacedModule[]): Project => { const p = proj(modules); p.room.obstacles = [column]; return p; };
  // модуль вплотную справа к колонне (1100..1400): растёт вправо, правый сосед сужается, колонна не задета
  const p = resizeInRow(withColumn([at("a", 1400, mod("У колонны")), at("b", 2000, mod("Сосед"))]), "a", 700);
  assert.deepEqual([get(p, "a").x, get(p, "a").module.width, get(p, "b").x, get(p, "b").module.width], [1400, 700, 2100, 500]);
  // одиночный слева от колонны в 50 мм: растёт вправо не дальше колонны
  assert.throws(() => resizeInRow(withColumn([at("s", 450, mod("Один"))]), "s", 700), /упирается в объект замера «Колонна»: справа свободно 50 мм/);
  const fits = resizeInRow(withColumn([at("s", 450, mod("Один"))]), "s", 650);
  assert.deepEqual([get(fits, "s").x, get(fits, "s").module.width], [450, 650]);
  // колонна на другой высоте (балка под потолком) нижнему модулю не мешает
  const beam = { ...column, type: "beam" as const, y: 2400, height: 300 };
  const q = proj([at("s", 450, mod("Один", 600, { height: 800 }))]); q.room.obstacles = [beam];
  assert.equal(get(resizeInRow(q, "s", 700), "s").module.width, 700);
});

test("«у стены» и «стык под 90°» — с допусками автофальшей (wallSnap, cornerSnap), а не только вплотную", () => {
  // одиночный в 21 мм от правой стены (место под фальш торцом): у стены — растёт влево, а не «упирается»
  const p = resizeInRow(proj([at("s", 4000 - 21 - 600, mod("Один"))]), "s", 700);
  assert.deepEqual([get(p, "s").x, get(p, "s").module.width], [4000 - 21 - 700, 700]);
  // модуль под 90° в 40 мм слева (стык с угловой фальшью): бок как стена — растём вправо, правый сосед сужается
  const corner: PlacedModule = { id: "k", x: 0, z: 0, rotation: 90, module: mod("Поворотный", 1200) };
  const x0 = bounds(corner).x + bounds(corner).w + 40;
  const q = resizeInRow(proj([corner, at("a", x0, mod("Первый")), at("b", x0 + 600, mod("Второй")), at("c", x0 + 1200, mod("Третий"))]), "b", 700);
  assert.deepEqual([get(q, "b").x, get(q, "c").x, get(q, "c").module.width, get(q, "a").module.width], [x0 + 600, x0 + 1300, 500, 600]);
  const r = resizeInRow(proj([corner, at("a", x0, mod("Первый")), at("b", x0 + 600, mod("Второй"))]), "a", 700);
  assert.deepEqual([get(r, "a").x, get(r, "a").module.width, get(r, "b").module.width], [x0, 700, 500]);
});

test("кухонный ряд при поворотах 0/90/180/270: вплотную без ошибок проекта до и после правки ширины", () => {
  const k = (n: string) => ({ ...kitchenTemplate("base-doors", 600, initialModule()), name: n });
  const place = (rot: 0 | 90 | 180 | 270, n: string, i: number): PlacedModule => {
    const t = 500 + 600 * i;
    return rot === 0 ? { id: n, x: t, z: 3, rotation: 0, module: k(n) } : rot === 90 ? { id: n, x: 3, z: t, rotation: 90, module: k(n) }
      : rot === 180 ? { id: n, x: t, z: 2400, rotation: 180, module: k(n) } : { id: n, x: 3000, z: t, rotation: 270, module: k(n) };
  };
  for (const rot of [0, 90, 180, 270] as const) {
    const p: Project = { version: 3, kind: "kitchen", room: { width: 3600, depth: 3000, height: 2700, openings: [] }, modules: ["A", "B", "C"].map((n, i) => place(rot, n, i)) };
    assert.deepEqual(projectErrors(applyAutoFillers(p)), [], `поворот ${rot}: до правки`);
    const q = applyAutoFillers(resizeInRow(p, "B", 700));
    assert.deepEqual(projectErrors(q), [], `поворот ${rot}: после правки`);
    assert.deepEqual(["A", "B", "C"].map((id) => get(q, id).module.width).sort(), [500, 600, 700], `поворот ${rot}: сосед сузился`);
  }
});

test("подсказка у ширины проёма не обещает, что соседние корпуса стоят на месте (их меняет правило ряда)", () => {
  const app = readFileSync(new URL("../src/App.tsx", import.meta.url), "utf8");
  assert.doesNotMatch(app, /Соседние корпуса сохраняют положение/);
  assert.match(app, /сосед вплотную в ряду сузится или расширится на ту же величину/);
});

test("placeInRow: правка модуля из панели с той же шириной — просто замена; угловой — по-старому", () => {
  const p = row3(), next = { ...get(p, "b").module, name: "Новое имя" };
  assert.equal(get(placeInRow(p, "b", next), "b").module.name, "Новое имя");
  const wider = placeInRow(p, "b", { ...next, width: 700 });
  assert.deepEqual([get(wider, "c").x, get(wider, "c").module.width, get(wider, "b").module.name], [1800, 500, "Новое имя"]);
});
