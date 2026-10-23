import test from "node:test";
import assert from "node:assert/strict";
import { parts, initialModule, section, validate, parseModule, fastenerCounts, plinth, legCount, type Module, type Part } from "../src/model";
import { setPartialDivider, setDividerByShelves, dividerBounds } from "../src/partialDivider";
import { partPenetration, allowedContact } from "../src/collisions";

// Решение Макса 23.10.2026 (замер удобства: w172, w218, w061): частичная перегородка и «Без цоколя».

const box = (p: Part) => [0, 1, 2].map((k) => p.position[k] - p.size[k] / 2).concat([0, 1, 2].map((k) => p.position[k] + p.size[k] / 2)).map((v) => Math.round(v * 10) / 10);
/** Шкаф 1200 в две секции, как в сценарии менеджера. */
function wardrobe(extra: Partial<Module> = {}): Module {
  return { ...initialModule(), width: 1200, height: 2300, depth: 600, plinthHeight: 80, doors: false, ...extra,
    sections: [{ ...section(), shelves: [] }, { ...section(), shelves: [] }] };
}
/** Пересечения деталей модуля (та же мера, что общая проверка collisions.ts). */
function hits(m: Module): string[] {
  const ps = parts(m), out: string[] = [];
  for (let i = 0; i < ps.length; i++) for (let j = i + 1; j < ps.length; j++) {
    const d = partPenetration(ps[i], ps[j]);
    if (d > 0.1 && !allowedContact(ps[i], ps[j], d, m)) out.push(`${ps[i].name} × ${ps[j].name} (${Math.round(d * 10) / 10})`);
  }
  return out;
}

test("частичная перегородка 720–1652: фактическая длина, сквозные опоры над/под ней, конфирматы в опоры", () => {
  const m = wardrobe();
  setPartialDivider(m, m.sections[1].id, { from: 720, to: 1652 });
  assert.deepEqual(validate(m), []);
  const ps = parts(m), dv = ps.find((p) => p.id === `${m.sections[1].id}:divider`)!;
  assert.deepEqual([box(dv)[1], box(dv)[4]], [720, 1652]);
  assert.equal(dv.length, 932);
  const under = ps.find((p) => p.id.endsWith(":divider:under"))!, over = ps.find((p) => p.id.endsWith(":divider:over"))!;
  assert.deepEqual([box(under)[0], box(under)[1], box(under)[3], box(under)[4]], [16, 704, 1184, 720]);
  assert.deepEqual([box(over)[0], box(over)[1], box(over)[3], box(over)[4]], [16, 1652, 1184, 1668]);
  // крепёж перегородки — сверху через опору над ней, снизу через опору под ней (не в крышу и не в дно)
  const conf = ps.filter((p) => new RegExp(`^fast:${dv.id}:(top|bottom):`).test(p.id));
  assert.equal(conf.length, 4);
  assert.ok(conf.filter((p) => p.id.includes(":top:")).every((p) => Math.abs(box(p)[4] - 1668) < 0.1), "верхние — с верхней пласти опоры");
  assert.ok(conf.filter((p) => p.id.includes(":bottom:")).every((p) => Math.abs(box(p)[1] - 704) < 0.1), "нижние — с нижней пласти опоры");
  // опоры — на конфирматах в боковины (горизонтали корпуса), без полкодержателей
  assert.equal(ps.filter((p) => p.id.startsWith(`fast:${under.id}:`)).length, 4);
  assert.equal(ps.filter((p) => p.id.startsWith(`shp:${under.id}`)).length, 0);
  assert.deepEqual(hits(m), []);
});

test("полки над и под частичной перегородкой — сквозные, в её зоне — свои; одна и та же полка в двух секциях — одна деталь", () => {
  const m = wardrobe();
  setPartialDivider(m, m.sections[1].id, { from: 720, to: 1652 });
  const [L, R] = m.sections, h = 2300 - 16 - 96; // проём от дна (96) до крыши (2284)
  const at = (y: number) => (y - 96) / h;
  L.shelves = [at(400), at(1100), at(2000)]; R.shelves = [at(1100), at(2000)];
  assert.deepEqual(validate(m), []);
  const ps = parts(m), sh = ps.filter((p) => p.role === "shelf");
  const top = sh.filter((p) => Math.abs(p.position[1] - 2000) < 1), low = sh.find((p) => Math.abs(p.position[1] - 400) < 1)!;
  assert.equal(top.length, 1, "полка 2000 в обеих секциях — одна сквозная");
  assert.equal(Math.round(top[0].size[0]), 1166);
  assert.match(top[0].name, /сквозная/);
  assert.equal(Math.round(low.size[0]), 1166);
  const mid = sh.filter((p) => Math.abs(p.position[1] - 1100) < 1);
  assert.equal(mid.length, 2, "в зоне перегородки — по полке в каждой половине");
  assert.ok(mid.every((p) => p.size[0] < 600));
  // полкодержатели сквозной полки — у боковин, не в воздухе посередине
  const pins = ps.filter((p) => p.id.startsWith(`shp:${low.id}:`));
  assert.ok(pins.every((p) => p.position[0] < 30 || p.position[0] > 1170), pins.map((p) => p.position[0]).join(","));
  assert.equal(fastenerCounts(m).shelfHolders, 4 * 4);
  assert.deepEqual(hits(m), []);
});

test("валидация частичной перегородки: минимум высоты, 80 мм до дна/крыши у опоры, полка на опоре, ящики и штанга", () => {
  const m = wardrobe();
  const sid = m.sections[1].id;
  setPartialDivider(m, sid, { from: 720, to: 800 });
  assert.ok(validate(m).some((e) => /не меньше 150/.test(e)));
  setPartialDivider(m, sid, { from: 150, to: 1652 });
  assert.ok(validate(m).some((e) => /до дна нужно не меньше 80/.test(e)));
  setPartialDivider(m, sid, { from: 720, to: 2250 });
  assert.ok(validate(m).some((e) => /до крыши нужно не меньше 80/.test(e)));
  setPartialDivider(m, sid, { from: 720, to: 1652 });
  m.sections[0].shelves = [(730 - 96) / 2188];
  assert.ok(validate(m).some((e) => /не менее 80 мм/.test(e)), "полка вплотную к опоре");
  m.sections[0].shelves = [];
  m.sections[1].drawers = 2;
  assert.ok(validate(m).some((e) => /направляющие ящиков/.test(e)));
  m.sections[1].drawers = 0; m.sections[1].rod = true; m.sections[1].rodAt = 0.9;
  assert.ok(validate(m).some((e) => /штанга крепится к перегородке/.test(e)));
  m.sections[1].rod = false; delete m.sections[1].rodAt;
  assert.deepEqual(validate(m), []);
  assert.throws(() => setPartialDivider(m, m.sections[0].id, { from: 720, to: 1652 }), /первой секции/);
  // от дна до крыши — это перегородка во всю высоту: поля нет
  setPartialDivider(m, sid, { from: 0, to: 5000 });
  assert.equal(m.sections[1].divider, undefined);
});

test("от полки N до полки M: выбранные полки становятся опорами, перегородка — между ними", () => {
  const m = wardrobe();
  const h = 2188, at = (y: number) => (y - 96) / h;
  m.sections[0].shelves = [at(712), at(1660)]; m.sections[1].shelves = [at(712), at(1660), at(1200)];
  const b = dividerBounds(m, 1);
  assert.deepEqual(b.map((x) => Math.round(x.y)), [96, 712, 1200, 1660, 2284]);
  setDividerByShelves(m, m.sections[1].id, b[1].bound, b[3].bound);
  assert.deepEqual(m.sections[1].divider, { from: 720, to: 1652 });
  assert.equal(m.sections[0].shelves.length, 0);
  assert.equal(m.sections[1].shelves.length, 1);
  assert.deepEqual(validate(m), []);
});

test("фасады: одностворчатая дверь с частичной перегородки перевешивается на боковину; петли только там, где перегородка есть", () => {
  const m = wardrobe({ doors: true });
  const sid = m.sections[1].id;
  setPartialDivider(m, sid, { from: 720, to: 1652 });
  const ps = parts(m);
  assert.equal(ps.find((p) => p.id === `${sid}:door:0`)?.hinge, "right");
  assert.equal(ps.find((p) => p.id === `${m.sections[0].id}:door:0`)?.hinge, "left");
  assert.deepEqual(validate(m), []);
  // повесили обратно на перегородку — ошибка: нижняя петля в воздухе
  const back = structuredClone(m);
  back.sections[1].doorHinges = ["left", null, null, null];
  assert.ok(validate(back).some((e) => /в воздухе|200 мм/.test(e)), validate(back).join(" | "));
  // перегородка от дна почти до крыши — петли встают на неё (верхняя ниже торца перегородки, в пределах 200 мм от края фасада)
  const tall = structuredClone(m);
  setPartialDivider(tall, sid, { from: 96, to: 2188 });
  tall.sections[1].doorHinges = ["left", null, null, null];
  const plates = parts(tall).filter((p) => p.id.startsWith(`${sid}:hingeplate:0`));
  assert.ok(plates.length >= 2 && plates.every((p) => p.position[1] + 26.5 <= 2188.5), plates.map((p) => p.position[1]).join(","));
  assert.deepEqual(validate(tall).filter((e) => /в воздухе/.test(e)), []);
});

test("частичная перегородка: roundtrip parseModule, существующие шкафы без поля — без изменений", () => {
  const m = wardrobe();
  setPartialDivider(m, m.sections[1].id, { from: 720, to: 1652 });
  const back = parseModule(JSON.parse(JSON.stringify(m)));
  assert.deepEqual(back.sections[1].divider, { from: 720, to: 1652 });
  assert.deepEqual(parts(back).map((p) => p.id + box(p).join()), parts(m).map((p) => p.id + box(p).join()));
  const plain = wardrobe();
  assert.equal(parseModule(JSON.parse(JSON.stringify(plain))).sections[1].divider, undefined);
  assert.equal(parts(plain).filter((p) => /:divider:(under|over)$/.test(p.id)).length, 0);
});

test("без цоколя: дно на полу, боковины до пола, нет цоколя и опор", () => {
  const m = wardrobe({ plinthHeight: 0, doors: true, height: 900, width: 750, depth: 283 });
  m.sections = [{ ...section(), shelves: [0.33, 0.66] }];
  assert.deepEqual(validate(m), []);
  const ps = parts(m);
  assert.equal(plinth(m), 0);
  assert.equal(legCount(m), 0);
  assert.equal(ps.filter((p) => p.id === "plinth").length, 0);
  assert.deepEqual([box(ps.find((p) => p.id === "left")!)[1], box(ps.find((p) => p.id === "bottom")!)[1]], [0, 0]);
  assert.ok(ps.filter((p) => p.role === "door").every((p) => box(p)[1] === 2), "фасад от низа корпуса с зазором 2");
  const back = parseModule(JSON.parse(JSON.stringify(m)));
  assert.equal(back.plinthHeight, 0);
  assert.deepEqual(hits(m), []);
});
