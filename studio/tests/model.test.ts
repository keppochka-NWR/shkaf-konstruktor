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
  for (const w of [400, 600, 850, 900]) {
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
  m.sections.push({...m.sections[0]});
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
    s = m.sections[0];
  s.rod=true;
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
  assert.equal(parts(m).filter((p) => p.role === "door").length, 1);
  const fillers = parts(m).filter((p) => p.name.startsWith("Фальш-панель"));
  assert.equal(fillers.length, 1);
  assert.equal(fillers[0].size[1], 360);
  m.width=900;
  assert.deepEqual(validate(m), []);
  assert.equal(parts(m).filter(p=>p.role==="door").length,2);
  assert.equal(parts(m).filter(p=>p.name.startsWith("Фальш-панель")).length,2);
});

test('splitting subtracts the new panel only from the selected opening',()=>{const m=initialModule();m.width=900;m.sections=[{...section(),weight:2,shelves:[.5]},{...section(),weight:1}];const before=boxes(m),n=splitSection(m,m.sections[0].id),after=boxes(n);assert.deepEqual(validate(n),[]);assert.ok(Math.abs(after[0].width-(before[0].width-16)/2)<.001);assert.equal(after[0].width,after[1].width);assert.ok(Math.abs(after[2].width-before[1].width)<.001);assert.deepEqual(n.sections[0].shelves,[.5]);assert.deepEqual(n.sections[1].shelves,[]);assert.equal(m.sections.length,2);});
