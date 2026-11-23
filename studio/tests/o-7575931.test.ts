// Заказ 7575931 (шкаф над стиральной машиной): крыша-столешка ЛДСП 16 на боковинах — функция студии, которой не хватало для сборки по эскизу.
import test from "node:test";
import assert from "node:assert/strict";
import { initialModule, section, validate, parts, parseModule, type Module } from "../src/model";
import { newProject } from "../src/project";
import { addUpperModule } from "../src/operations";
import { partCollisions } from "../src/collisions";
import { plainFeatures } from "../src/quoteDescribe";

const washerBase = (): Module => {
  const m = initialModule();
  Object.assign(m, { name: "Низ под стиральную машину", width: 650, height: 900, depth: 650, doors: false, plinthHeight: 0, backType: "none", bottomType: "none",
    rails: [{ place: "rear-bottom", height: 100 }], topOnSides: true });
  m.sections = [{ ...section(), shelves: [], drawers: 0, rod: false }];
  return m;
};

test("7575931: столешка 16 лежит на боковинах на всю ширину и глубину, боковины короче на 16, крепёж — эксцентрики снизу", () => {
  const m = washerBase();
  assert.deepEqual(validate(m, { all: true }), []);
  const ps = parts(m), top = ps.find((p) => p.id === "top")!, left = ps.find((p) => p.id === "left")!, right = ps.find((p) => p.id === "right")!;
  assert.deepEqual(top.size, [650, 16, 650], "столешка 650 × 650");
  assert.equal(top.position[1], 900 - 8, "верх столешки — верх модуля");
  assert.equal(left.size[1], 900 - 16, "боковины под столешкой");
  assert.equal(right.size[1], 900 - 16);
  assert.deepEqual(top.edge, [2, 2, 2, 0.4], "кромка 2 спереди и по бокам, сзади 0,4");
  assert.equal(ps.filter((p) => p.id.startsWith("fast:top:")).length, 0, "видимого крепежа сверху нет");
  assert.equal(ps.filter((p) => p.id.startsWith("ecc:top:") && !p.id.endsWith(":pin")).length, 4, "по 2 эксцентрика на боковину");
  assert.deepEqual(partCollisions(ps, m), []);
  // без флага — крыша между боковинами, как было
  const plain = parts({ ...m, topOnSides: undefined }).find((p) => p.id === "top")!;
  assert.deepEqual(plain.size, [618, 16, 650]);
});

test("7575931: столешка сохраняется в проекте, в КП, антресоль её не наследует; несовместимые крыши — ошибка", () => {
  const m = washerBase();
  assert.equal(parseModule(JSON.parse(JSON.stringify(m))).topOnSides, true);
  assert.ok(plainFeatures(m).some((s) => s.includes("столешка")));
  for (const bad of [{ topGlass: "glass" }, { seatTop: true as const }, { topType: "none" as const }, { slope: { side: "left" as const, lowHeight: 600 } }])
    assert.ok(validate({ ...m, ...bad }).some((e) => e.startsWith("Крыша на боковинах")), JSON.stringify(bad));
  const p = { ...newProject(), modules: [{ id: "low", x: 100, y: 0, z: 0, rotation: 0, module: m }] };
  const up = addUpperModule(p, "low").modules.find((a) => a.id !== "low")!.module;
  assert.equal(up.topOnSides, undefined);
});
