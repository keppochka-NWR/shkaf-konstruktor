// Критик релиза 22.10, повтор: m4 — «+» у «Ящики» на пятом ящике неактивен без подсказки; окно «Фурнитура» не закрывалось по Esc.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { initialModule, MAX_DRAWERS_REASON, MAX_SHELVES_REASON, RULES } from "../src/model";
import { insertItem } from "../src/operations";
import { drawerAddReason } from "../src/drawerLimit";
import type { Project } from "../src/project";

const full = (): Project => {
  const m = initialModule();
  m.sections[0] = { ...m.sections[0], drawers: RULES.maxDrawers };
  return { version: 3, room: { width: 3600, depth: 3000, height: 2700, openings: [] }, modules: [{ id: "a", x: 500, y: 0, z: 3, module: m }] };
};

test("m4: предел ящиков — один текст у ПКМ «Добавить › Ящик», причины отказа и подсказки у «+»", () => {
  const p = full(), sid = p.modules[0].module.sections[0].id;
  assert.match(MAX_DRAWERS_REASON, /В секции уже 5 ящиков — это предел для одной секции\. Выберите другую секцию или удалите ненужный ящик\./);
  assert.throws(() => insertItem(p, "drawer", "a", sid, 300), (e: Error) => e.message === MAX_DRAWERS_REASON, "ПКМ «Добавить › Ящик»");
  assert.equal(drawerAddReason(p, "a", sid), MAX_DRAWERS_REASON, "поле «Ящиков в секции»");
  assert.match(MAX_SHELVES_REASON, /В секции уже 10 полок — это предел/);
});

test("m4: счётчик — у неактивного «+» title и подпись с причиной; «Полки» и «Ящики» передают её", () => {
  const app = readFileSync(new URL("../src/App.tsx", import.meta.url), "utf8");
  assert.match(app, /aria-label=\{`Добавить: \$\{label\}`\}\s*disabled=\{full\}\s*title=\{full \? maxHint : undefined\}/);
  assert.match(app, /\{full && maxHint && <p className="field-note counter-max" role="note" data-testid="counter-max">\{maxHint\}<\/p>\}/);
  assert.match(app, /max=\{RULES\.maxShelves\}\s*maxHint=\{MAX_SHELVES_REASON\}/);
  assert.match(app, /max=\{RULES\.maxDrawers\}\s*maxHint=\{MAX_DRAWERS_REASON\}/);
});

test("окно «Фурнитура»: Esc — один слушатель на погружении на всё время окна (не пересоздаётся при перерисовке дока)", () => {
  const hw = readFileSync(new URL("../src/HardwareWindow.tsx", import.meta.url), "utf8");
  assert.match(hw, /close\.current = onClose;/);
  assert.match(hw, /if \(e\.key === "Escape"\) \{ e\.preventDefault\(\); close\.current\(\); \} \}; window\.addEventListener\("keydown", k, true\); return \(\) => window\.removeEventListener\("keydown", k, true\); \}, \[\]\);/);
  assert.doesNotMatch(hw, /\}, \[onClose\]\);/, "слушатель с [onClose] снимался перерисовкой посреди нажатия");
});
