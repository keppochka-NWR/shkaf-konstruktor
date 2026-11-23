import test from "node:test";
import assert from "node:assert/strict";
import { parts, initialModule, section, validate, parseModule, boxes, type Module } from "../src/model";
import { setDividerByShelves, setDividerOverRight, setPartialDivider } from "../src/partialDivider";

// Заказ 7563292: короткая перегородка справа от нижней полки до полки правой половины; слева над нижней полкой — длинная вешалка
// до верхней полки, штанга под верхней полкой сквозная (одна на всю ширину).
function wardrobe(): Module {
  const m: Module = { ...initialModule(), width: 1048, height: 2120, depth: 704, plinthHeight: 80, doors: false,
    sections: [{ ...section(), shelves: [], rod: true }, { ...section(), shelves: [], rod: false }] };
  const b = boxes(m)[0], h = b.top - b.bottom, f = (y: number) => (y - b.bottom) / h;
  const low = b.bottom + 308, right = low + 316, top = b.top - 208;
  m.sections[0].shelves = [f(low), f(top)];
  m.sections[1].shelves = [f(low), f(right), f(top)];
  m.sections[0].rodAt = f(top - 8 - 70);
  setDividerByShelves(m, m.sections[1].id, { section: 1, shelf: 0 }, { section: 1, shelf: 1 });
  m.sections[1].shelves = m.sections[1].shelves.filter((x) => Math.abs(b.bottom + x * h - top) > 1);
  return m;
}

test("без overRight — как раньше: горизонталь над перегородкой во всю ширину, штанга над ней — ошибка (решение 23.10)", () => {
  const m = wardrobe();
  assert.ok(validate(m).some((e) => /штанга крепится к перегородке/.test(e)));
  const over = parts(m).find((p) => p.id.endsWith(":divider:over"))!;
  assert.equal(over.size[0], 1016);
});

test("overRight: полка над перегородкой только справа, на торце перегородки; штанга одна сквозная; слева крепежа у полки нет", () => {
  const m = wardrobe(), sid = m.sections[1].id;
  setDividerOverRight(m, sid, true);
  assert.deepEqual(validate(m), []);
  const ps = parts(m), dv = ps.find((p) => p.id === sid + ":divider")!, over = ps.find((p) => p.id === sid + ":divider:over")!;
  assert.equal(Math.round(dv.size[1]), 300);
  const ox0 = over.position[0] - over.size[0] / 2, ox1 = over.position[0] + over.size[0] / 2;
  assert.equal(Math.round(ox0), Math.round(dv.position[0] - 8)); // от левой грани перегородки
  assert.equal(Math.round(ox1), 1048 - 16);
  const rods = ps.filter((p) => p.role === "rod");
  assert.equal(rods.length, 1);
  assert.equal(rods[0].size[0], 1016);
  assert.equal(ps.filter((p) => p.role === "flange").length, 2);
  assert.ok(!ps.some((p) => p.id.startsWith(`fast:${sid}:divider:over:left`)));
  assert.ok(ps.some((p) => p.id.startsWith(`fast:${sid}:divider:over:right`)));
  assert.ok(ps.some((p) => p.id.startsWith(`fast:${sid}:divider:top`)));
  // сохраняется в проекте и переживает правку высоты перегородки
  const back = parseModule(JSON.parse(JSON.stringify(m)));
  assert.equal(back.sections[1].divider?.overRight, true);
  const dvSpan = m.sections[1].divider!;
  setPartialDivider(m, sid, { from: dvSpan.from, to: dvSpan.to + 50 });
  assert.equal(m.sections[1].divider?.overRight, true);
  setDividerOverRight(m, sid, false);
  assert.equal(parts(m).find((p) => p.id === sid + ":divider:over")!.size[0], 1016);
});

test("overRight у перегородки до крыши не ставится", () => {
  const m = wardrobe(), sid = m.sections[1].id, b = boxes(m)[1];
  setPartialDivider(m, sid, { from: m.sections[1].divider!.from, to: b.top });
  assert.throws(() => setDividerOverRight(m, sid, true));
});

test("штанга-ярус вне перегородки — по-прежнему ошибка", () => {
  const m = wardrobe();
  m.sections[0].rodLower = 0.4;
  assert.ok(validate(m).some((e) => /штанга крепится к перегородке/.test(e)));
});
