// Зазоры в ряду, «Дотянуть», «Вплотную», растяжение мышью (запрос Макса 20.10.2026, РЕШЕНИЯ.md «Ширина в ряду»).
import test from "node:test";
import assert from "node:assert/strict";
import { initialModule, type Module } from "../src/model";
import { bounds, projectErrors, applyAutoFillers, type PlacedModule, type Project } from "../src/project";
import { resizeInRow, gaps, fillGap, flush, planStretch } from "../src/rowResize";
import { kitchenTemplate } from "../src/kitchenProject";

const mod = (name: string, width = 600, extra: Partial<Module> = {}): Module => ({ ...initialModule(), name, width, ...extra });
const at = (id: string, x: number, m: Module, more: Partial<PlacedModule> = {}): PlacedModule => ({ id, x, z: 0, module: m, ...more });
const proj = (modules: PlacedModule[], width = 5000): Project => ({ version: 3, room: { width, depth: 3000, height: 2700, openings: [] }, modules });
const get = (p: Project, id: string) => p.modules.find((a) => a.id === id)!;
/** Ряд как у Макса (снимок 20.10): пара 600 вплотную, комод, пара 600 вплотную, зазор 300, следующий модуль. */
const maxRow = () => proj([
  at("a", 0, mod("Шкаф 1")), at("b", 600, mod("Шкаф 2")), at("k", 1200, mod("Комод", 800, { height: 900, doors: false })),
  at("c", 2000, mod("Шкаф 3")), at("d", 2600, mod("Шкаф 4")), at("e", 3500, mod("Угловой")),
]);

test("ряд Макса: правый модуль пары перед зазором 600 → 700 растёт вправо, левый сосед не меняется", () => {
  const p = resizeInRow(maxRow(), "d", 700);
  assert.deepEqual([get(p, "d").x, get(p, "d").module.width], [2600, 700]);
  assert.deepEqual([get(p, "c").x, get(p, "c").module.width], [2000, 600], "левый сосед на месте");
  assert.deepEqual([get(p, "e").x, get(p, "e").module.width], [3500, 600], "следующий за зазором на месте");
  assert.equal(gaps(p, "d").right.gap, 200);
  // места мало — понятная ошибка с подсказкой, ничего не меняется
  assert.throws(() => resizeInRow(maxRow(), "d", 1000), /«Шкаф 4»: справа свободно 300 мм до «Угловой», а нужно 400\. Можно дотянуть до него \(\+300 мм\)/);
  // левый модуль пары (сосед справа вплотную) — как раньше: меняется правый сосед
  const q = resizeInRow(maxRow(), "c", 700);
  assert.deepEqual([get(q, "d").x, get(q, "d").module.width], [2700, 500]);
});

test("gaps: до соседа любого уровня, объекта замера, стены; вплотную — 0", () => {
  const g = gaps(maxRow(), "d");
  assert.deepEqual([g.left.gap, g.left.what], [0, "«Шкаф 3»"]);
  assert.deepEqual([g.right.gap, g.right.what, g.right.to, g.right.id, g.right.fillWidth], [300, "«Угловой»", "«Угловой»", "e", 900]);
  assert.deepEqual(g.right.moveTo, { x: 2900, z: 0 });
  const e = gaps(maxRow(), "e");
  assert.deepEqual([e.left.gap, e.right.gap, e.right.what, e.right.to], [300, 900, "стена", "стены"]);
  // навесной над зазором нижнему не мешает; пенал (перекрыт по высоте) — препятствие; объект замера — тоже
  const low = (id: string, x: number) => at(id, x, mod("Н" + id, 600, { height: 800 }));
  const p = proj([low("l", 1000), at("u", 1700, mod("Навесной", 600, { height: 700 }), { y: 1500 }), at("t", 2000, mod("Пенал", 600, { height: 2100 }))]);
  assert.deepEqual([gaps(p, "l").right.gap, gaps(p, "l").right.what], [400, "«Пенал»"]);
  p.room.obstacles = [{ id: "col", name: "Колонна", type: "column", x: 1800, y: 0, z: 0, width: 100, depth: 300, height: 2700 }];
  assert.deepEqual([gaps(p, "l").right.gap, gaps(p, "l").right.to], [200, "объекта замера «Колонна»"]);
});

test("fillGap: край доходит до соседа, противоположный край на месте; пределы ширины, техника, вплотную — ошибка", () => {
  const p = fillGap(maxRow(), "d", "right");
  assert.deepEqual([get(p, "d").x, get(p, "d").module.width, get(p, "e").x, get(p, "c").module.width], [2600, 900, 3500, 600]);
  assert.equal(gaps(p, "d").right.gap, 0);
  const q = fillGap(maxRow(), "e", "left");
  assert.deepEqual([get(q, "e").x, get(q, "e").module.width], [3200, 900], "левый край дотянут, правый на месте");
  assert.throws(() => fillGap(maxRow(), "c", "right"), /уже вплотную/);
  assert.throws(() => fillGap(proj([at("s", 1000, mod("Один"))], 4000), "s", "right"), /ширина стала бы 3000 мм, а больше 1300/);
  const k = (kind: Parameters<typeof kitchenTemplate>[0], w: number) => kitchenTemplate(kind, w, initialModule());
  assert.throws(() => fillGap(proj([at("o", 500, k("oven", 600)), at("b", 1200, k("base-doors", 600))]), "o", "right"), /под технику.*стала бы 700/);
});

test("fillGap до стены: автофальшь у стены не сдвигает неподвижный край, проект без ошибок", () => {
  const z = { z: 30 }; // задняя стенка внакладку — не к самой стене
  const p = proj([at("s", 1000, mod("Один"), z), at("n", 400, mod("Сосед"), z)], 2000);
  const q = applyAutoFillers(fillGap(p, "s", "right"));
  assert.equal(bounds(get(q, "s")).x, 1000, "левый край (стык с соседом) на месте");
  assert.equal(gaps(q, "s").right.gap, 0, "дотянут до стены с учётом фальши");
  assert.deepEqual(projectErrors(q), []);
});

test("flush: придвинуть вплотную и задать зазор; дальше свободного места — ошибка", () => {
  const p = flush(maxRow(), "e", "left");
  assert.deepEqual([get(p, "e").x, get(p, "e").module.width], [3200, 600]);
  assert.equal(get(flush(maxRow(), "e", "left", 50), "e").x, 3250);
  assert.equal(get(flush(maxRow(), "e", "right"), "e").x, 4400, "к правой стене");
  assert.throws(() => flush(maxRow(), "e", "left", 1500), /свободно только 900 мм \(до стены\)/);
});

test("planStretch: свободный край — привязка 10 мм и к соседу в 30 мм, Alt без привязки, не заходит в соседа, min", () => {
  const p = maxRow();
  assert.deepEqual([planStretch(p, "d", "right", 247).width, planStretch(p, "d", "right", 247).gap], [850, 50]);
  assert.equal(planStretch(p, "d", "right", 247, false).width, 847, "Alt — без привязки");
  assert.equal(planStretch(p, "d", "right", 276).width, 900, "в 30 мм от соседа — к его краю");
  const over = planStretch(p, "d", "right", 800);
  assert.deepEqual([over.width, over.gap, over.mode], [900, 0, "free"], "в соседа не заходит");
  assert.deepEqual(get(over.project!, "d").x, 2600);
  const shrink = planStretch(p, "d", "right", -100);
  assert.deepEqual([shrink.width, shrink.gap, get(shrink.project!, "c").module.width], [500, 400, 600]);
  assert.equal(planStretch(p, "d", "right", -1000).width, 100, "не уже минимума (волна 29.10: 100, было 250)");
  const left = planStretch(p, "e", "left", 100);
  assert.deepEqual([get(left.project!, "e").x, left.width], [3400, 700], "левый край тянется, правый на месте");
});

test("planStretch: край вплотную к соседу — двигается стык, с пределами соседа; техника — текст ошибки", () => {
  const p = maxRow();
  const j = planStretch(p, "c", "right", 100);
  assert.deepEqual([j.mode, j.width, j.neighbor?.width, get(j.project!, "d").x, get(j.project!, "d").module.width], ["joint", 700, 500, 2700, 500]);
  assert.deepEqual([planStretch(p, "c", "right", 600).width, planStretch(p, "c", "right", 600).neighbor?.width], [1100, 100], "сосед не уже минимума (волна 29.10: 100, было 250)");
  const k = (kind: Parameters<typeof kitchenTemplate>[0], w: number) => kitchenTemplate(kind, w, initialModule());
  const oven = planStretch(proj([at("a", 500, k("base-doors", 600)), at("o", 1100, k("oven", 600))]), "a", "right", 100);
  assert.equal(oven.project, undefined);
  assert.match(oven.problem ?? "", /под технику/);
});

test("повороты 0/90/180/270: зазор по оси ширины, «Дотянуть» и «Вплотную» без ошибок проекта", () => {
  const k = (n: string) => ({ ...kitchenTemplate("base-doors", 600, initialModule()), name: n });
  const place = (rot: 0 | 90 | 180 | 270, n: string, i: number): PlacedModule => {
    const t = 500 + 900 * i;
    return rot === 0 ? { id: n, x: t, z: 3, rotation: 0, module: k(n) } : rot === 90 ? { id: n, x: 3, z: t, rotation: 90, module: k(n) }
      : rot === 180 ? { id: n, x: t, z: 2400, rotation: 180, module: k(n) } : { id: n, x: 3000, z: t, rotation: 270, module: k(n) };
  };
  for (const rot of [0, 90, 180, 270] as const) {
    const p: Project = applyAutoFillers({ version: 3, kind: "kitchen", room: { width: 3600, depth: 3000, height: 2700, openings: [] }, modules: ["A", "B"].map((n, i) => place(rot, n, i)) });
    const g = gaps(p, "A"), side = g.right.what === "«B»" ? "right" : "left";
    assert.equal(g[side].gap, 300, `поворот ${rot}: зазор до B`);
    assert.equal(gaps(p, "B")[side === "right" ? "left" : "right"].gap, 300, `поворот ${rot}: зазор у B с другой стороны`);
    const filled = applyAutoFillers(fillGap(p, "A", side));
    assert.deepEqual([get(filled, "A").module.width, gaps(filled, "A")[side].gap], [900, 0], `поворот ${rot}: дотянут`);
    assert.deepEqual(projectErrors(filled), [], `поворот ${rot}: дотянуть без ошибок`);
    const moved = applyAutoFillers(flush(p, "A", side));
    assert.deepEqual([get(moved, "A").module.width, gaps(moved, "A")[side].gap], [600, 0], `поворот ${rot}: вплотную`);
    assert.deepEqual(projectErrors(moved), [], `поворот ${rot}: вплотную без ошибок`);
    const st = planStretch(p, "A", side, 150);
    assert.deepEqual([st.width, st.gap], [750, 150], `поворот ${rot}: растяжение`);
    assert.deepEqual(projectErrors(applyAutoFillers(st.project!)), [], `поворот ${rot}: растяжение без ошибок`);
  }
});

test("m3: «Задать зазор» меняет ширину (край со стороны зазора), «Вплотную» не отрывает от соседа; m9 — причина у неактивных", async () => {
  const { setGap, flushBlock } = await import("../src/rowResize");
  const p = setGap(maxRow(), "d", "right", 50);
  assert.deepEqual([get(p, "d").x, get(p, "d").module.width, gaps(p, "d").right.gap], [2600, 850, 50], "правый край на зазор 50, левый на месте");
  const q = setGap(maxRow(), "e", "left", 100);
  assert.deepEqual([get(q, "e").x, get(q, "e").module.width], [3300, 800], "у «Углового» двигается левый край, правый на месте");
  assert.equal(get(setGap(maxRow(), "d", "right", 400), "d").module.width, 500, "больший зазор — уже");
  // «Шкаф 4» вплотную к «Шкаф 3» слева — «Вплотную вправо» оторвёт от него
  assert.equal(flushBlock(maxRow(), "d", "right"), "оторвёт от «Шкаф 3»");
  assert.throws(() => flush(maxRow(), "d", "right"), /оторвёт от «Шкаф 3»/);
  assert.equal(flushBlock(maxRow(), "e", "left"), undefined, "«Угловой» справа свободен — можно");
  assert.equal(flushBlock(maxRow(), "b", "right"), "вплотную с обеих сторон");
  assert.equal(flushBlock(maxRow(), "d", "left"), "зазора нет");
});

test("B2: два «Добавить в комнату» подряд из пустой комнаты — второй вплотную справа, без ложного пересечения", async () => {
  const { appendModule, newProject } = await import("../src/project");
  const { createModule } = await import("../src/ModulePalette");
  const m = createModule("empty", 600, 2000, 550, initialModule());
  // первый — как из пустой комнаты: без автофальши у стены (раньше её ставило только следующее сохранение)
  const first = appendModule({ ...newProject(), modules: [] }, m);
  let p = applyAutoFillers(appendModule(first, m));
  assert.deepEqual(projectErrors(p), [], "второй без «пересекается»");
  assert.equal(gaps(p, p.modules[1].id).left.gap, 0, "второй вплотную к первому");
  for (let i = 0; i < 3; i++) p = applyAutoFillers(appendModule(p, m));
  assert.deepEqual(projectErrors(p), [], "пятый тоже");
  assert.equal(p.modules.length, 5);
});

test("интерфейс: плашки зазора пропускают правый клик и колесо, ручки растяжения ew-resize, пункты «Размеры ›»", async () => {
  const { readFileSync } = await import("node:fs");
  const scene = readFileSync(new URL("../src/Scene.tsx", import.meta.url), "utf8"), app = readFileSync(new URL("../src/App.tsx", import.meta.url), "utf8");
  const css = readFileSync(new URL("../src/style.css", import.meta.url), "utf8");
  assert.match(scene, /function gapPlaque[\s\S]{0,600}passThrough\(b\)/, "плашка зазора — passThrough (fromLabel, колесо)");
  assert.match(scene, /function stretchHandle[\s\S]{0,600}passThrough\(b\)/);
  assert.match(css, /\.stretch-handle \{[\s\S]*?cursor: ew-resize/);
  assert.match(app, /size\('depth','Глубина'\),\.\.\.rowGapItems\(a\.id\)/);
  // u2 (замер удобства 22.10): «Задать зазор» — два явных пункта: сдвинуть модуль / изменить ширину
  assert.match(app, /Дотянуть \(\+\{fillAdd\(g\)\} мм\)[\s\S]*Придвинуть вплотную[\s\S]*Задать зазор — сдвинуть модуль…[\s\S]*Задать зазор — изменить ширину…/);
});

test("кухня: справа свободно, но там кончается столешница — как раньше растёт влево за счёт левого соседа", () => {
  const base = (id: string, x: number) => at(id, x, mod("Н" + id, 600, { height: 800 }));
  const top = at("t", 500, mod("Столешница", 1200, { height: 38, worktop: { material: "postforming", thickness: 38 } as unknown as Module["worktop"] }), { y: 800 });
  const p = resizeInRow(proj([base("a", 500), base("b", 1100), top]), "b", 700);
  assert.deepEqual([get(p, "b").x, get(p, "b").module.width, get(p, "a").module.width], [1000, 700, 500]);
  // столешница длиннее ряда (край не на модуле) — свободное место справа, растёт вправо
  const long = { ...top, module: { ...top.module, width: 1500 } };
  const q = resizeInRow(proj([base("a", 500), base("b", 1100), long]), "b", 700);
  assert.deepEqual([get(q, "b").x, get(q, "b").module.width, get(q, "a").module.width], [1100, 700, 600]);
});
