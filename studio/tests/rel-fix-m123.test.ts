// Критик релиза 22.10, сценарий «шкаф 2400 в нише»: m1 — второй шкаф не встаёт в ряд (фальш у стены), m2 — «Дотянуть» показывает
// фактическую прибавку, m3 — скачок итога целым листом при переносе модуля к стене / от стены.
import test from "node:test";
import assert from "node:assert/strict";
import { initialModule } from "../src/model";
import { appendModule, applyAutoFillers, bounds, projectErrors, type Project } from "../src/project";
import { createModule } from "../src/ModulePalette";
import { rowShortage, rowShortageText } from "../src/rowFit";
import { gaps, fillGap, fillAdd, fillerNote, planStretch, resizeInRow } from "../src/rowResize";
import { fillerCount, sameDesign, sheetChangeNote } from "../src/sheetNote";
import { estimate } from "../src/pricing";
import { kitchenTemplate } from "../src/kitchenProject";

const src = initialModule();
/** Комната 2400 × 3000, первый шкаф 1200 из пустой комнаты (у левой стены, фальш 21 мм). */
function niche(kind: "empty" | "wardrobe" = "empty"): Project {
  return applyAutoFillers(appendModule({ version: 3, room: { width: 2400, depth: 3000, height: 2700, openings: [] }, modules: [] }, createModule(kind, 1200, 2400, 550, src, 2)));
}
const second = (w = 1200) => createModule("empty", w, 2400, 550, src, 2);
const last = (p: Project) => p.modules.at(-1)!;

test("m1: второй шкаф 1200 в нише 2400 — нехватка 21 мм под фальш у стены, варианты проверены расстановкой", () => {
  const p = niche();
  assert.equal(bounds(p.modules[0]).x + bounds(p.modules[0]).w, 1221, "первый с фальшем у левой стены: 0…1221");
  const s = rowShortage(p, second());
  const { apart, ...rest } = s!; // apart — место «Поставить отдельно» перед рядом (проверено в palette-apart.test.ts)
  assert.deepEqual(rest, { width: 1200, free: 1179, filler: 21, withFiller: 1158, withoutFiller: 1179 });
  assert.ok(apart, "перед первым шкафом место есть");
  assert.equal(rowShortageText("Пустой шкаф", s!), "«Пустой шкаф» 1200 мм в ряд не встаёт: справа свободно 1179 из 1200 мм, у стены нужна фальшпанель 21 мм (16 + 5). Можно сузить до 1158 мм (с фальшпанелью) или 1179 мм без фальшпанели у стены. Или поставить отдельно — встанет перед шкафами.");
  // «Сузить до 1158»: встаёт справа вплотную, фальш у правой стены, без ошибок
  const a = applyAutoFillers(appendModule(p, second(1158)));
  assert.deepEqual([bounds(last(a)).x, bounds(last(a)).x + bounds(last(a)).w, Object.keys(last(a).module.wallFiller ?? {})], [1221, 2400, ["right"]]);
  assert.deepEqual(projectErrors(a), []);
  // «1179 без фальша у стены»: автофальши выключены у нового корпуса
  const b = applyAutoFillers(appendModule(p, { ...second(1179), autoFillersOff: true }));
  assert.deepEqual([last(b).x, last(b).module.width, last(b).module.wallFiller], [1221, 1179, undefined]);
  assert.deepEqual(projectErrors(b), []);
  // раньше 1179 «с фальшем» молча уезжал бы в соседа — этот вариант не предлагается
  assert.notEqual(projectErrors(applyAutoFillers({ ...p, modules: [...p.modules, { id: "x", x: 1221, y: 0, z: 30, module: second(1179) }] })).length, 0);
});

test("m1: встаёт — null; кухня, пустая комната, корпус без фасадов — без фальша", () => {
  const p = niche();
  assert.equal(rowShortage(p, second(1158)), null, "1158 встаёт в ряд");
  assert.equal(rowShortage(p, second(900)), null);
  assert.equal(rowShortage({ ...p, modules: [] }, second()), null, "первый корпус");
  assert.equal(rowShortage(p, kitchenTemplate("base-doors", 600, src)), null, "кухня — своя расстановка");
  const open = createModule("shelves", 1200, 2400, 550, src);
  const { apart: _a, ...rest } = rowShortage(p, open)!; void _a;
  assert.deepEqual(rest, { width: 1200, free: 1179, filler: 0, withFiller: 1179, withoutFiller: null }, "стеллаж без дверей — фальш не нужен");
});

test("m2: «Дотянуть (+79)» до стены прибавляет 58 — плашка и пункт пишут фактическую прибавку и фальш 21 мм", () => {
  const p = niche();
  const q = applyAutoFillers({ ...p, modules: [...p.modules, { id: "m2", x: 1221, y: 0, z: 30, module: second(1100) }] });
  assert.deepEqual(projectErrors(q), []);
  const g = gaps(q, "m2").right;
  assert.deepEqual([g.gap, g.filler, g.fillWidth, fillAdd(g), fillerNote(g)], [79, 21, 1158, 58, "21 мм — фальш у стены"]);
  assert.equal(gaps(q, "m2").left.filler, undefined, "к соседу — без фальша");
  const f = applyAutoFillers(fillGap(q, "m2", "right"));
  assert.equal(f.modules.find((a) => a.id === "m2")!.module.width, 1100 + fillAdd(g), "прибавка как в подписи");
  // растяжение мышью до стены: ширина фактическая, фальш в плашке
  const st = planStretch(q, "m2", "right", 79);
  assert.deepEqual([st.width, st.filler], [1158, 21]);
  // ширину полем больше, чем встанет с фальшем, — понятная ошибка вместо «пересекается»
  assert.throws(() => resizeInRow(q, "m2", 1179), /справа свободно 79 мм до стены \(21 мм из них — фальш у стены\), а нужно 79\. Можно дотянуть до неё \(\+58 мм; 21 мм — фальш у стены\)/);
  assert.equal(resizeInRow(q, "m2", 1158).modules.find((a) => a.id === "m2")!.module.width, 1158);
});

test("m2 (критик 22.10, повтор): «Дотянуть» с фальшем у стены проверяет ширину после фальша — 1158 + 40 = 1198, а не 1219", () => {
  // ниша 2440: второй шкаф 1158 (2 двери), справа 61 мм до стены — встанет 40 мм, 21 мм — фальш
  const p = { ...niche(), room: { ...niche().room, width: 2440 } };
  const q = applyAutoFillers({ ...p, modules: [...p.modules, { id: "m2", x: 1221, y: 0, z: 30, module: second(1158) }] });
  assert.deepEqual(projectErrors(q), []);
  const g = gaps(q, "m2").right;
  assert.deepEqual([g.gap, g.filler, g.fillWidth, fillAdd(g)], [61, 21, 1198, 40]);
  // раньше: «при ширине 1219 мм: фасад шире 600» — проверка шла по ширине вместе с фальшем
  const f = applyAutoFillers(fillGap(q, "m2", "right"));
  assert.equal(f.modules.find((a) => a.id === "m2")!.module.width, 1198);
  assert.equal(gaps(f, "m2").right.gap, 0, "дотянут до стены с фальшем");
  assert.deepEqual(projectErrors(f), []);
  // растяжение мышью до стены — та же проверка
  const st = planStretch(q, "m2", "right", 61);
  assert.deepEqual([st.problem, st.width, st.filler], [undefined, 1198, 21]);
  // ширина, которая и после фальша не проходит, — по-прежнему понятный отказ с фактической шириной
  const r = { ...p, room: { ...p.room, width: 2500 } };
  const wide = applyAutoFillers({ ...r, modules: [...r.modules, { id: "m2", x: 1221, y: 0, z: 30, module: second(1158) }] });
  assert.throws(() => fillGap(wide, "m2", "right"), /при ширине 1258 мм/);
});

test("m3: перенос 1100 от стены в ряд — минус целый лист раскроя (фальш у стены убран), подсказка в «Стоимости»", () => {
  const p = niche();
  const atWall = applyAutoFillers({ ...p, modules: [...p.modules, { id: "m2", x: 21, y: 0, z: 700, module: second(1100) }] });
  const inRow = applyAutoFillers({ ...atWall, modules: atWall.modules.map((a) => (a.id === "m2" ? { ...a, x: 1221, z: 30 } : a)) });
  const ea = estimate(atWall), eb = estimate(inRow);
  assert.deepEqual([ea.ldspSheets, eb.ldspSheets, fillerCount(atWall), fillerCount(inRow)], [5, 4, 2, 1]);
  // числа критика 97 900 → 84 000; с 28.10.2026 + крепёж корпуса (эксцентрики цоколя, коробы ящиков, саморезы фальша) — по +100
  assert.deepEqual([ea.retail, eb.retail], [98000, 84100], "числа критика: 97 900 → 84 000 (+100 крепёж корпуса 28.10)");
  assert.ok(sameDesign(atWall, inRow));
  assert.equal(sheetChangeNote({ ldsp: 5, total: ea.retail, fillers: 2 }, { ldsp: 4, total: eb.retail, fillers: 1 }),
    `Цена снизилась на ${(13900).toLocaleString("ru-RU")} ₽: листов ЛДСП 5 → 4 — фальшпанель у стены или в углу убрана. Плита и работа цеха считаются целыми листами раскроя.`);
  assert.equal(sheetChangeNote({ ldsp: 4, total: 1, fillers: 1 }, { ldsp: 4, total: 2, fillers: 1 }), null, "листов столько же — без подсказки");
  assert.equal(sameDesign(atWall, niche()), false, "другой проект — без подсказки");
});

test("m3: «Стоимость» внизу — строка «Листов ЛДСП в раскрое» и подсказка", async () => {
  const { readFileSync } = await import("node:fs");
  const dock = readFileSync(new URL("../src/ProjectDock.tsx", import.meta.url), "utf8");
  assert.match(dock, /Листов ЛДСП в раскрое: <b>\{fresh\.ldsp\}<\/b>[\s\S]{0,200}fresh\.note/);
});
