// Решение Макса 29.10.2026: палитра, модуль в остаток до стены (не хватает места на фальш у стены) — модуль ДОБАВЛЯЕТСЯ сразу,
// суженный (600 → 580 + фальш 20), менеджер видит сообщение «ширина 580 вместо 600»; диалога из трёх кнопок нет («Поставить
// отдельно» был сломан: «пересекается с «Комод»»). Сузить нельзя (меньше минимума, пределы модуля) — понятный отказ.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { initialModule, type Module } from "../src/model";
import { appendModule, applyAutoFillers, bounds, projectErrors, type Project } from "../src/project";
import { createModule } from "../src/ModulePalette";
import { adaptToRow, rowShortage } from "../src/rowFit";

const src = initialModule();
const chest = (w: number) => createModule("drawers", w, 850, 500, src);
const add = (p: Project, m: Module) => applyAutoFillers(appendModule(p, m));
/** Повтор Макса: комната 3000 × 2000, «Комод» 800 + 800 + 779 (h850 d500). */
function repro(): Project {
  let p: Project = { version: 3, room: { width: 3000, depth: 2000, height: 2700, openings: [] }, modules: [] };
  for (const w of [800, 800, 779]) p = add(p, chest(w));
  assert.deepEqual(projectErrors(p), []);
  return p;
}

test("повтор Макса: «Комод» 600 в остаток — добавлен суженным под фальш 20 у стены, в ряд, с сообщением", () => {
  const p = repro(), right = Math.max(...p.modules.map((a) => bounds(a).x + bounds(a).w));
  const free = 3000 - right, m = chest(600), s = rowShortage(p, m)!;
  assert.ok(s, "600 в ряд не встаёт");
  assert.deepEqual([s.free, s.filler, s.withFiller], [free, 20, free - 20]);
  const r = adaptToRow(m, s, chest);
  assert.ok(!("error" in r), "error" in r ? r.error : "");
  if ("error" in r) return;
  assert.equal(r.module.width, free - 20);
  assert.equal(r.note, `«${m.name}»: ширина ${free - 20} вместо 600 — у стены фальш 20 мм (16 + 4).`);
  const n = add(p, r.module), last = n.modules.at(-1)!, b = bounds(last);
  assert.deepEqual(projectErrors(n), []);
  assert.deepEqual([Math.round(b.x), Math.round(b.x + b.w), Object.keys(last.module.wallFiller ?? {})], [right, 3000, ["right"]], "в ряд вплотную, фальш у правой стены");
});

test("сузить нельзя — отказ с причиной, модуль не добавляется (остаток меньше минимума 100 вместе с фальшем)", () => {
  let p = repro();
  const right = Math.max(...p.modules.map((a) => bounds(a).x + bounds(a).w));
  // добить ряд так, чтобы осталось 110: с фальшем 20 — 90 < 100
  p = add(p, chest(3000 - right - 110));
  const s = rowShortage(p, chest(600));
  assert.ok(s, "110 мм остатка — нехватка в ряду");
  if (s === null) return;
  const r = adaptToRow(chest(600), s, chest);
  assert.ok("error" in r);
  if ("error" in r) assert.match(r.error, /Сузить можно только до 90 мм, а модуль — от 100 мм/);
});

test("пределы модуля: собирается с ошибкой — отказ с текстом проверки", () => {
  const s = { width: 600, free: 300, filler: 20, withFiller: 280, withoutFiller: 300 };
  const r = adaptToRow(chest(600), s, () => { throw Error("Ящик: ширина короба меньше допустимой поставщиком."); });
  assert.ok("error" in r);
  if ("error" in r) assert.match(r.error, /При ширине 280 мм модуль не собирается: Ящик: ширина короба меньше допустимой поставщиком/);
});

test("палитра: диалога из трёх кнопок больше нет, нехватка — через adaptToRow и сообщение «Размер изменён»", () => {
  const ui = readFileSync(new URL("../src/ModulePalette.tsx", import.meta.url), "utf8");
  assert.ok(!/Поставить отдельно|palette-row-fit|Сузить до/.test(ui));
  assert.match(ui, /adaptToRow\(m,s,narrowed\)/);
  assert.match(ui, /title:'Размер изменён'/);
});
