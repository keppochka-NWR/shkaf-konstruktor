// Решение Макса 29.10.2026: фальш у стены — 16 + 4 = 20 мм вдоль стены (было 16 + 5 = 21), «чтобы размеры были красивее».
// Одно правило RULES.wallFillerEdgeGap: автофальш у стены (шкафы и кухонные модули палитры), отступ кухонного ряда от стены,
// угловая кухня (место под фальш-планку у стены напротив), палитра «в ряд у стены», «Поставить к стене».
import test from "node:test";
import assert from "node:assert/strict";
import { initialModule, RULES } from "../src/model";
import { applyAutoFillers, bounds, newProject } from "../src/project";
import { KITCHEN_WALL_OFFSET, kitchenTemplate } from "../src/kitchenProject";
import { kitchenCornerBounds } from "../src/kitchenCornerRow";
import { rowShortageText } from "../src/rowFit";

test("фальш у стены 16 + 4 = 20: правило, шкаф у левой и правой стены, кухонный модуль", () => {
  assert.equal(RULES.panel + RULES.wallFillerEdgeGap, 20);
  const p = newProject(); p.modules[0].x = 0; p.modules[0].z = 3;
  const a = applyAutoFillers(p).modules[0];
  assert.equal(a.x, 20, "корпус от стены на 16 + 4");
  assert.equal(bounds(a).x, 0, "габарит с фальшем — от стены");
  const r = newProject(); r.modules[0].x = r.room.width - r.modules[0].module.width; r.modules[0].z = 3;
  const b = applyAutoFillers(r).modules[0];
  assert.equal(r.room.width - (b.x + b.module.width), 20);
  const k = newProject(kitchenTemplate("base-doors", 600, initialModule())); k.modules[0].x = 0; k.modules[0].z = 3;
  assert.equal(applyAutoFillers(k).modules[0].x, 20, "кухонный модуль палитры — то же правило");
});

test("кухня: отступ ряда от стены и место под фальш-планку угловой кухни — 20", () => {
  assert.equal(KITCHEN_WALL_OFFSET, 20);
  assert.equal(kitchenCornerBounds().wallOffset, 20);
});

test("текст палитры: «у стены нужна фальшпанель 20 мм (16 + 4)»", () => {
  assert.match(rowShortageText("Комод", { width: 600, free: 590, filler: 20, withFiller: 570, withoutFiller: 590 }), /фальшпанель 20 мм \(16 \+ 4\)/);
});
