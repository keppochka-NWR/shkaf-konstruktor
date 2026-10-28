import test from "node:test";
import assert from "node:assert/strict";
import { parts, initialModule, section, validate, parseModule, fastenerCounts, plinth, legCount, distribute, innerMinus, RULES, type Module, type Part } from "../src/model";
import { setPartialDivider, setDividerByShelves, dividerBounds, moveDividerEnd, oneLeafAtDivider } from "../src/partialDivider";
import { newProject } from "../src/project";
import { mirrorModule, setWallDistance, addUpperModule } from "../src/operations";
import { nest } from "../src/exports";
import { estimate } from "../src/pricing";
import { partPenetration, allowedContact } from "../src/collisions";
import { existsSync, readFileSync } from "node:fs";
import { compareModule } from "../scripts/kitchen/compare";
import { wardrobeFromEtalon, type WRefModule } from "../scripts/wardrobe/fromEtalon";
import { ETALON_W } from "../scripts/wardrobe/batch";

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

test("критик 24.10: две створки у частичной перегородки — секции сами переходят на одну створку на боковине; отказ — с выполнимым советом", () => {
  const m = wardrobe({ doors: true });
  const [L, R] = m.sections;
  L.doorLeaves = 2; R.doorLeaves = 2;
  const notes = setPartialDivider(m, R.id, { from: 720, to: 1652 });
  assert.equal(notes.length, 2, notes.join(" | "));
  assert.ok(notes.every((n) => /одна створка/.test(n)));
  assert.deepEqual([L.doorLeaves, R.doorLeaves], [1, 1]);
  const ps = parts(m);
  assert.equal(ps.find((p) => p.id === `${L.id}:door:0`)?.hinge, "left");
  assert.equal(ps.find((p) => p.id === `${R.id}:door:0`)?.hinge, "right");
  assert.deepEqual(validate(m), []);
  // повторное изменение границ — без новых сообщений
  assert.deepEqual(setPartialDivider(m, R.id, { from: 720, to: 2000 }), []);
  // менеджер выбрал «Две створки» у перегородки — отказ с советом «одна створка» (не «перевесьте фасад»), кнопка его выполняет
  const two = structuredClone(m);
  two.sections[0].doorLeaves = 2;
  const errs = validate(two).filter((e) => /частичной перегородк/.test(e));
  assert.equal(errs.length, 1, errs.join(" | ")); // одна строка на секцию — одна кнопка
  assert.ok(/^Секция 1: две створки/.test(errs[0]) && /«Одна створка в секции»/.test(errs[0]) && !/Перевесьте/.test(errs[0]), errs[0]);
  assert.equal(oneLeafAtDivider(two, two.sections[0].id), true);
  assert.deepEqual(validate(two), []);
  // широкая секция (одна створка шире предела): створки не меняются, совет — перегородка во всю высоту
  const wide = { ...wardrobe({ doors: true }), width: 1300 }; // секции по 634: авто — две створки, одна шире 600
  assert.deepEqual(setPartialDivider(wide, wide.sections[1].id, { from: 720, to: 1652 }), []);
  const we = validate(wide).filter((e) => /частичной перегородк/.test(e));
  assert.ok(we.length && we.every((e) => /шире \d+ мм: сделайте перегородку во всю высоту/.test(e)), we.join(" | "));
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

// Сверка со шкафом Базиса (эталон Кухни/etalon-w, вне git; пропуск, если эталонов на машине нет): стеллаж с перегородкой 720–1652
// на сквозных полках 704 и 1652, по две полки в половинах. По X и Y детали перегородки совпадают; по глубине — правило шкафов студии
// (перегородка и полки на 25 мм мельче корпуса, Базис — во всю глубину) — вопрос Максу, не правка этой задачи.
const W172 = `${ETALON_W}/w172.json`;
test("сверка с Базисом: частичная перегородка распознаётся (divider), перегородка, опоры и полки — те же по X/Y", { skip: !existsSync(W172) }, () => {
  const ref = (JSON.parse(readFileSync(W172, "utf8")) as { modules: WRefModule[] }).modules[0];
  const { module: m, unsupported } = wardrobeFromEtalon(ref);
  assert.ok(!unsupported.some((u) => /W_PART/.test(u)), unsupported.join("; "));
  assert.deepEqual(m.sections[1].divider, { from: 720, to: 1652 });
  assert.deepEqual(validate(m), []);
  const c = compareModule(ref, m);
  const ours = c.pairs.filter((p) => /Перегородка|перегородк|Полка/.test(p.studio.name));
  assert.equal(ours.length, 7, ours.map((p) => p.studio.name).join(", ")); // перегородка, 2 опоры, 4 полки в половинах
  // faces: [x0, y0, z0, x1, y1, z1] — X и Y до 0,1 мм
  for (const p of ours) assert.ok([0, 1, 3, 4].every((k) => p.faces[k] <= 0.11), `${p.studio.name}: ${p.faces.join(" ")}`);
  // глубина (решение Макса 23.10.2026): перегородка и опора под ней — во всю глубину, как в Базисе; опора над ней у Базиса 398 (по 1 мм),
  // съёмные полки у Базиса 398, у студии 395 (правило −5)
  for (const p of ours.filter((q) => /^Перегородка|под перегородкой/.test(q.studio.name))) assert.ok(p.faces.every((v) => v <= 0.11), `${p.studio.name}: ${p.faces.join(" ")}`);
  assert.ok(ours.every((p) => p.faces[2] <= 1.01 && p.faces[5] <= 4.01), ours.map((p) => p.studio.name + " " + p.faces.join(" ")).join(" | "));
  assert.ok(!c.missing.some((x) => /\|y\|/.test(x.cls)), "все горизонтали Базиса нашлись");
});

test("«Полок в секции» у частичной перегородки — в её зоне (как у Базиса: 2 полки 1028 и 1344 при 720–1652); тянуть конец перегородки", () => {
  const m = wardrobe();
  setPartialDivider(m, m.sections[1].id, { from: 720, to: 1652 });
  for (const s of m.sections) s.shelves = distribute(m, s, 2);
  const ys = parts(m).filter((p) => p.role === "shelf").map((p) => Math.round(p.position[1]));
  assert.deepEqual([...new Set(ys)].sort((a, z) => a - z), [1028, 1344]);
  assert.deepEqual(validate(m), []);
  moveDividerEnd(m, m.sections[1].id, "over", 100);
  assert.deepEqual(m.sections[1].divider, { from: 720, to: 1752 });
  moveDividerEnd(m, m.sections[1].id, "under", -700); // ниже дна — «от дна»
  assert.equal(m.sections[1].divider!.from, 96);
  assert.equal(parts(m).filter((p) => p.id.endsWith(":divider:under")).length, 0, "от дна — опора не нужна, перегородка стоит на дне");
});

test("отражение корпуса: частичная перегородка остаётся между теми же секциями; смета и раскрой — фактическая длина", () => {
  const m = wardrobe(), p = newProject(m);
  const sec = p.modules[0].module.sections;
  sec[0].weight = 1; sec[1].weight = 2;
  setPartialDivider(p.modules[0].module, sec[1].id, { from: 720, to: 1652 });
  const before = parts(p.modules[0].module).find((x) => x.id.endsWith(":divider"))!;
  const r = mirrorModule(p, p.modules[0].id), mm = r.modules[0].module;
  assert.deepEqual(mm.sections.map((s) => !!s.divider), [false, true]);
  const after = parts(mm).find((x) => x.id.endsWith(":divider"))!;
  assert.equal(Math.round(after.position[0]), Math.round(1200 - before.position[0]));
  assert.equal(after.length, 932);
  const items = nest(p).flatMap((s) => s.items.map((i) => i.detail));
  assert.equal(items.find((d) => d.id.endsWith(":divider"))?.length, 932);
  assert.equal(items.filter((d) => /:divider:(under|over)$/.test(d.id)).length, 2);
  const e = estimate(p);
  assert.ok(Number.isFinite(e.knownCost) && e.knownCost > 0);
});

test("навесной (решение Макса 23.10): «От пола» > 0 — сразу навесной: без цоколя, на двух навесах, навесы и заглушки в смете", () => {
  const p = newProject(wardrobe({ height: 700, doors: true }));
  const r = setWallDistance(p, p.modules[0].id, "y", 1200), m = r.modules[0].module;
  assert.equal(m.hanging, true);
  assert.equal(plinth(m), 0);
  const ps = parts(m);
  assert.equal(ps.filter((x) => x.id === "plinth").length, 0);
  assert.deepEqual(ps.filter((x) => /^kitchen-hanger(-cap)?:/.test(x.id)).map((x) => x.id).sort(), ["kitchen-hanger-cap:left", "kitchen-hanger-cap:right", "kitchen-hanger:left", "kitchen-hanger:right"]);
  assert.deepEqual(hits(m), []);
  const lines = estimate(r).lines;
  assert.equal(lines.find((l) => l.id === "kitchen-hanger")?.quantity, 1, "два навеса = один комплект ABS (Макс 27.10.2026)");
  assert.equal(lines.find((l) => l.id === "kitchen-hanger-cap")?.quantity, 2);
  assert.equal(parseModule(JSON.parse(JSON.stringify(m))).hanging, true);
  // опустили на пол — снова стоит на полу (без цоколя), навесов нет
  const down = setWallDistance(r, r.modules[0].id, "y", 0).modules[0].module;
  assert.equal(down.hanging, undefined);
  assert.equal(parts(down).filter((x) => x.id.startsWith("kitchen-hanger")).length, 0);
  // на ножках — не навесной
  const f = newProject({ ...wardrobe({ height: 700 }), feet: { height: 100 } });
  const fr = setWallDistance(f, f.modules[0].id, "y", 1200).modules[0].module;
  assert.deepEqual([fr.feet, fr.hanging], [{ height: 100 }, undefined]);
});

test("существующие навесные и антресоли не меняются: антресоль на нижнем корпусе — не навесная, старый корпус над полом — без навесов", () => {
  const p = newProject(wardrobe({ height: 1800 }));
  const up = addUpperModule(p, p.modules[0].id), ant = up.modules[1];
  assert.equal(ant.module.hanging, undefined);
  assert.equal(parts(ant.module).filter((x) => x.id.startsWith("kitchen-hanger")).length, 0);
  // «От пола» антресоли, стоящей на нижнем корпусе, — та же высота: она стоит на корпусе, навесной не становится
  const same = setWallDistance(up, ant.id, "y", ant.y ?? 0).modules[1].module;
  assert.equal(same.hanging, undefined);
  // старый проект: корпус над полом без поля hanging — детали как были (без навесов)
  const old = wardrobe({ height: 700, plinthHeight: 0 });
  assert.equal(parts(old).filter((x) => x.id.startsWith("kitchen-hanger")).length, 0);
});

test("глубина (решение Макса 23.10): съёмные полки — корпус − 5, жёсткие, полка над ящиками, перегородки и опоры — в размер корпуса", () => {
  const m = wardrobe();
  const [L, R] = m.sections, at = (y: number) => (y - 96) / 2188;
  L.shelves = [at(400), at(1200)]; L.fixed = [1]; R.drawers = 2;
  setPartialDivider(m, R.id, { from: 96, to: 1652 });
  const ps = parts(m), z = (id: RegExp) => ps.filter((p) => id.test(p.id)).map((p) => [box(p)[2], box(p)[5]]);
  assert.deepEqual(z(new RegExp(`^${L.id}:shelf:0$`)), [[0, 595]], "съёмная — 600 − 5");
  assert.deepEqual(z(new RegExp(`^${L.id}:shelf:1$`)), [[0, 600]], "жёсткая — 600");
  assert.deepEqual(z(/:divider$/), [[0, 600]]);
  assert.deepEqual(z(/:divider:over$/), [[0, 600]]);
  assert.deepEqual(z(/:drawer-cap$/), [[0, 600]]);
  assert.deepEqual(hits(m), []);
  // ХДФ в паз: от задника (лицевая плоскость паза + 1) до переда
  const g = wardrobe({ backType: "groove" });
  g.sections[0].shelves = [0.5];
  const gs = parts(g).find((p) => p.id.endsWith(":shelf:0"))!, gd = parts(g).find((p) => p.id.endsWith(":divider"))!;
  assert.deepEqual([box(gd)[2], box(gd)[5], box(gs)[5]], [20, 600, 595]);
  // вкладные фасады: перегородка и жёсткие — до фасада (16 + зазор 2), съёмные — ещё на 5 меньше
  const inset = wardrobe({ doors: true, doorMount: "inset" });
  inset.sections[0].shelves = [0.5];
  const ip = parts(inset);
  assert.deepEqual([box(ip.find((p) => p.id.endsWith(":divider"))!)[5], box(ip.find((p) => p.id.endsWith(":shelf:0"))!)[5]], [582, 577]);
  assert.deepEqual(hits(inset), []);
  // кухни — как было
  assert.equal(innerMinus({ ...m, kitchen: { role: "base" } } as Module, "removable"), RULES.shelfDepthMinus);
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
