import { test } from "node:test";
import assert from "node:assert/strict";
import {
  initialModule,
  validate,
  parts,
  boxes,
  parseModule,
  splitSection,
  distribute,
  section,
} from "../src/model";
test("default module has complete positive geometry and unique IDs", () => {
  const m = initialModule();
  assert.deepEqual(validate(m), []);
  const ps = parts(m);
  assert.ok(ps.length > 15);
  assert.equal(new Set(ps.map((p) => p.id)).size, ps.length);
  assert.ok(ps.every((p) => p.size.every((v) => v > 0 && Number.isFinite(v))));
});
test("outer dimensions and section widths conserve panel thickness", () => {
  const m = initialModule();
  for (const w of [700, 850, 1000, 1200]) {
    m.width = w;
    assert.ok(
      Math.abs(
        boxes(m).reduce((sum, b) => sum + b.width, 0) +
          16 * (m.sections.length + 1) -
          w,
      ) < 0.01,
    );
  }
});
test("all forbidden dimensions rejected by model, not just UI", () => {
  for (const dim of ["width", "height", "depth"] as const)
    for (const v of [-1, 0, Infinity, NaN, 10000]) {
      const m = initialModule();
      m[dim] = v;
      assert.ok(validate(m).length > 0);
    }
});
test("invalid imported shape and duplicate section IDs rejected", () => {
  assert.throws(() => parseModule({}));
  const m = initialModule();
  m.sections[1].id = m.sections[0].id;
  assert.throws(() => parseModule(m));
});
test("valid serialized project roundtrips exactly", () => {
  const m = initialModule();
  assert.deepEqual(parseModule(JSON.parse(JSON.stringify(m))), m);
});
test("narrow split rejected while valid empty split succeeds", () => {
  const m = initialModule();
  m.sections = [section()];
  m.width = 700;
  assert.deepEqual(validate(splitSection(m, m.sections[0].id)), []);
  m.width = 350;
  assert.ok(validate(splitSection(m, m.sections[0].id)).length);
});
test("shelf collisions and drawer overlap are rejected", () => {
  const m = initialModule();
  m.sections[0].shelves = [0.5, 0.501];
  assert.ok(validate(m).length);
  m.sections[0].shelves = [0.1];
  m.sections[0].drawers = 3;
  assert.ok(validate(m).length);
});
test("rod needs clear hanging height, shelf distribution respects it", () => {
  const m = initialModule(),
    s = m.sections[1];
  s.shelves = distribute(m, s, 2);
  assert.deepEqual(validate(m), []);
  m.height = 1000;
  assert.ok(validate(m).length);
});
test("changing material does not change identifiers or dimensions", () => {
  const m = initialModule(),
    before = parts(m).map((p) => [p.id, p.size]);
  m.decor = "Белый";
  assert.deepEqual(
    parts(m).map((p) => [p.id, p.size]),
    before,
  );
});
test("doors are bounded and add fillers only for drawer zones", () => {
  const m = initialModule();
  m.doors = true;
  assert.deepEqual(validate(m), []);
  assert.equal(parts(m).filter((p) => p.role === "door").length, 2);
  const fillers = parts(m).filter((p) => p.name === "Фальш-панель");
  assert.equal(fillers.length, 1);
  assert.equal(fillers[0].size[1], 360);
  m.sections = [section()];
  assert.ok(validate(m).some((e) => e.includes("Фасад")));
});
