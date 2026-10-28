import test from "node:test";
import assert from "node:assert/strict";
import { parts, initialModule, section, validate, parseModule, fastenerCounts, distribute, type Module, type Part } from "../src/model";
import { newProject, projectErrors, type Project } from "../src/project";
import { placeInRow } from "../src/rowResize";
import { nest, detailCSV, labelData } from "../src/exports";
import { estimate } from "../src/pricing";
import { partCollisions } from "../src/collisions";
import { buildCutShape, cutoutWarnings, mansardWarnings, mansardGeom, mansardRearByAngle, radiusOutline, type Cutout } from "../src/shapes";
import { addUpperModule } from "../src/operations";
import { roomWarnings } from "../src/roomWarnings";
import { createModule, radiusShelving, withMansard } from "../src/paletteBuild";
import { detailsSheet } from "../src/estimateXlsx";

// Фигурные детали (задача Макса 29.10.2026, ветка claude/fix-shapes): вырезы, мансарда назад, радиусные полки.

const wardrobe = (extra: Partial<Module> = {}): Module => ({ ...initialModule(), name: "Шкаф ФД", width: 600, height: 2000, depth: 550, doors: true, sections: [{ ...section(), shelves: [0.3, 0.6] }], ...extra });
const cut = (c: Partial<Cutout> & Pick<Cutout, "host">): Cutout => ({ id: "c" + Math.random(), shape: "rect", w: 100, h: 100, u: 0, v: 0, fromU: "min", fromV: "min", ...c });
const part = (m: Module, id: string) => parts(m).find((p) => p.id === id)!;
const project = (...ms: Module[]): Project => { const p = newProject(ms[0]); p.modules = ms.map((m, i) => ({ id: "m" + i, x: 30 + i * 1000, y: 0, z: 30, rotation: 0, module: m })); return p; };
const area = (pl: [number, number][]) => Math.abs(pl.reduce((s, [x, y], i) => { const [a, b] = pl[(i + 1) % pl.length]; return s + x * b - a * y; }, 0) / 2);

test("вырез под плинтус в боковине: угол сзади снизу, контур, раскрой по габариту, пометка, кромка, работа в смете", () => {
  const m = wardrobe({ cutouts: [cut({ host: "left", w: 20, h: 80, label: "под плинтус" })] });
  assert.deepEqual(validate(m), []);
  const plain = part(wardrobe(), "left"), p = part(m, "left");
  assert.deepEqual([p.length, p.width, p.thickness], [plain.length, plain.width, plain.thickness], "раскрой — по габариту");
  assert.ok(p.shape && p.shape.outline.length === 6, "угловая выборка: 6 вершин");
  assert.equal(Math.round(area(p.shape!.outline)), Math.round(plain.length * plain.width - 20 * 80));
  assert.match(p.name, /фигурная \(вырез\)/);
  assert.match(p.shapeNote!, /под плинтус: вырез 20×80, 0 от заднего края, 0 от низа/);
  assert.equal(p.cutWork, 1);
  // нижний и задний торцы боковины без видимой кромки — выборка без кромки по правилу
  assert.equal(p.cutEdge, undefined);
  const e = estimate(project(m)), w = e.lines.find((l) => l.id === "cut-work")!;
  assert.equal(w.quantity, 1); assert.ok(w.pending, "цена работы — после финального расчёта (Макс не назвал)");
  assert.equal(estimate(project(m)).retail !== null, estimate(project(wardrobe())).retail !== null, "итог не пропадает из-за работы без цены");
  const d = nest(project(m)).flatMap((s) => s.items).find((a) => a.detail.id === "left")!;
  assert.deepEqual([d.h, d.w], [plain.length, plain.width]);
  assert.match(detailCSV(project(m)), /фигурная: под плинтус: вырез 20×80/);
  assert.match(labelData(project(m)).find((l) => /Боковина левая/.test(l.name))!.notches, /вырез 20×80/);
});

test("вырез у передней кромки (видимая кромка 2) — кромка по вырезу; фасад: круглое отверстие — кромка по кривой", () => {
  const m = wardrobe({ doors: false, cutouts: [cut({ host: "left", w: 40, h: 300, u: 0, v: 900, fromU: "max" })] });
  assert.deepEqual(validate(m), []);
  const p = part(m, "left");
  assert.deepEqual(p.cutEdge, { len: 300 + 40 + 40, t: 2 });
  assert.equal(p.edgeLen?.["+z"], 2000 - 300, "передняя кромка короче на выборку");
  const plain = wardrobe(), door = parts(plain).find((q) => q.role === "door")!;
  const md: Module = { ...plain, cutouts: [cut({ host: door.id, shape: "round", w: 60, u: 150, v: 1000 })] };
  assert.deepEqual(validate(md), []);
  const dp = part(md, door.id);
  assert.equal(dp.shape!.holes.length, 1);
  assert.ok(Math.abs(dp.curveEdge!.len - Math.PI * 60) < 0.1);
  const e = estimate(project(md)), base = estimate(project(plain));
  assert.ok(e.lines.some((l) => l.id === "edge-curve" && l.pending));
  const e2 = (x: typeof e) => x.lines.find((l) => l.id === "edge2")!.quantity;
  assert.ok(Math.abs(e2(e) - e2(base) - Math.PI * 0.06) < 0.002, "кромка 2 мм прибавилась на длину окружности");
});

test("задник ЛХДФ: отверстие под розетку внутри — без кромки, работа; ошибки: разрез пополам, за край, у края, сливаются, нет детали", () => {
  const ok = wardrobe({ cutouts: [cut({ host: "back", w: 80, h: 80, u: 200, v: 300 })] });
  assert.deepEqual(validate(ok), []);
  const b = part(ok, "back");
  assert.equal(b.shape!.holes.length, 1); assert.equal(b.cutEdge, undefined); assert.equal(b.cutWork, 1);
  const err = (c: Partial<Cutout> & Pick<Cutout, "host">, re: RegExp) => { const e = validate(wardrobe({ cutouts: [cut(c)] })); assert.ok(e.some((x) => re.test(x)), JSON.stringify(e)); };
  err({ host: "left", w: 600, h: 100, v: 500 }, /разрезает/);
  err({ host: "left", w: 50, h: 50, u: 5000 }, /вне детали/);
  err({ host: "left", shape: "round", w: 60, u: 20, v: 500 }, /выходит за край/);
  err({ host: "left", w: 50, h: 50, u: 4, v: 500 }, /ближе 10 мм к краю/);
  err({ host: "left", w: 530, h: 50, v: 500 }, /остаётся меньше 30/);
  err({ host: "nope", w: 50, h: 50 }, /детали «nope» в корпусе больше нет/);
  const two = validate(wardrobe({ cutouts: [cut({ host: "back", w: 80, h: 80, u: 200, v: 300 }), cut({ host: "back", w: 80, h: 80, u: 285, v: 300 })] }));
  assert.ok(two.some((x) => /ближе 10 мм друг к другу/.test(x)), JSON.stringify(two));
  // L-образная выборка из двух прямоугольников — допустима (общий контур)
  assert.deepEqual(validate(wardrobe({ cutouts: [cut({ host: "left", w: 20, h: 80 }), cut({ host: "left", w: 120, h: 20 })] })), []);
});

test("вырез задевает петлю — предупреждение; без выреза — нет", () => {
  const m = wardrobe(), ps = parts(m), plate = ps.find((p) => p.role === "hinge" && p.id.includes(":hingeplate:") && p.position[0] < 300)!;
  const side = ps.find((p) => p.id === "left")!, y = plate.position[1] - (side.position[1] - side.size[1] / 2);
  const m2 = wardrobe({ cutouts: [cut({ host: "left", w: 60, h: 60, u: 20, v: y - 30, fromU: "max" })] });
  assert.deepEqual(validate(m2), []);
  assert.ok(cutoutWarnings(m2, parts(m2)).some((w) => /петлю/.test(w)), JSON.stringify(cutoutWarnings(m2, parts(m2))));
  assert.deepEqual(cutoutWarnings(m, ps), []);
  assert.ok(roomWarnings(project(m2)).some((w) => w.kind === "shape" && /петлю/.test(w.message)));
});

test("вырезы переживают сохранение (parseModule) и не меняют модуль без вырезов", () => {
  const m = wardrobe({ cutouts: [cut({ host: "left", w: 20, h: 80, label: "под плинтус", edge: true })] });
  const back = parseModule(JSON.parse(JSON.stringify(m)));
  assert.deepEqual(back.cutouts, m.cutouts);
  assert.deepEqual(parts(wardrobe()).map((p) => p.shape ?? null).filter(Boolean), []);
});

test("buildCutShape: трапеция мансарды — выборка у низа обрезается по контуру, у скоса — нет", () => {
  const m = withMansard(wardrobe({ height: 2400, depth: 600 }), 1800);
  const side = parts(m).find((p) => p.id === "left")!;
  const ok = buildCutShape(side, [cut({ host: "left", w: 20, h: 80 })]);
  assert.deepEqual(ok.errors, []); assert.equal(ok.outline.length, 6);
});

test("мансарда назад: наклонная крыша, трапеции боковин, задник по задней высоте, фасады по передней, без пересечений", () => {
  const m = withMansard(wardrobe({ width: 800, height: 2400, depth: 600, sections: [{ ...section(), shelves: [0.25, 0.5, 0.75] }] }), 1800);
  assert.deepEqual(validate(m), []);
  const ps = parts(m), g = mansardGeom(m);
  const top = ps.find((p) => p.id === "top")!, left = ps.find((p) => p.id === "left")!, back = ps.find((p) => p.id === "back")!;
  assert.equal(top.shape!.axes.w, 0);
  assert.equal(top.width, Math.round(600 / Math.cos(g.angle) + 16 * Math.tan(g.angle)));
  assert.match(top.name, /уклон 45°/);
  assert.deepEqual(left.shape!.outline.map(([u, v]) => [Math.round(u), Math.round(v)]), [[0, 0], [600, 0], [600, 2400], [0, 1800]]);
  assert.ok(back.position[1] + back.size[1] / 2 <= 1800 + 0.01, "задник не выше задней высоты");
  const doors = ps.filter((p) => p.role === "door");
  assert.ok(doors.length && doors.every((d) => d.position[1] + d.size[1] / 2 > 2300), "фасады — по передней высоте");
  // крепёж крыши — в наклонной крыше (не висит над ней)
  for (const f of ps.filter((p) => /^(fast|ecc):top:/.test(p.id))) { const y = f.model?.origin?.[1] ?? f.position[1], z = f.model?.origin?.[2] ?? f.position[2]; assert.ok(y < g.outer(z) && y > g.under(z) - 1, f.id + " " + y); }
  assert.deepEqual(mansardWarnings(m, ps), []);
  assert.deepEqual(partCollisions(ps, m).map((c) => c.names.join(" × ")), []);
  // полка выше скоса — предупреждение и пересечение с крышей
  const high = { ...m, sections: [{ ...m.sections[0], shelves: [0.25, 0.5, 0.95] }] };
  assert.ok(mansardWarnings(high, parts(high)).some((w) => /выше скоса/.test(w)));
  const e = estimate(project(m));
  assert.ok(e.retail !== null && e.retail > 0);
  assert.equal(mansardRearByAngle(2400, 600, 45), 1800);
});

test("мансарда в ряду: сосед вплотную, ширина по правилу ряда, без ошибок и пересечений", () => {
  const man = withMansard(wardrobe({ width: 800, height: 2400, depth: 600 }), 1800), next = wardrobe({ width: 600, height: 2400, depth: 600 });
  const p = project(man, next); p.modules[1].x = 30 + 800;
  assert.deepEqual(projectErrors(p), []);
  const wider = placeInRow(p, "m0", { ...man, width: 900 });
  assert.deepEqual(projectErrors(wider), []);
  const a = wider.modules.find((x) => x.id === "m0")!, b = wider.modules.find((x) => x.id === "m1")!;
  assert.ok(a.x + a.module.width <= b.x + 0.5, "сосед не перекрыт после расширения мансарды");
  assert.ok(!roomWarnings(wider).some((w) => w.kind === "mansard-upper"));
});

test("мансарда: ошибки и антресоль не ставится", () => {
  assert.ok(validate(withMansard(wardrobe(), 300)).some((e) => /высота сзади от 400/.test(e)));
  assert.ok(validate({ ...withMansard(wardrobe(), 1600), slope: { side: "left", lowHeight: 1500 } }).some((e) => /один скос/.test(e)));
  const m = withMansard(wardrobe({ height: 2200 }), 1700), p = project(m);
  assert.throws(() => addUpperModule(p, "m0"), /антресоль не ставится/);
  const up: Project = { ...p, modules: [...p.modules, { id: "up", x: 30, y: 2200, z: 30, rotation: 0, module: { ...wardrobe({ height: 400, name: "Антресоль" }) } }] };
  assert.ok(roomWarnings(up).some((w) => w.kind === "mansard-upper"));
});

test("палитра «Шкаф для одежды» с мансардой: полки и штанга под скосом", () => {
  const m = withMansard(createModule("wardrobe", 800, 2400, 600, initialModule()), 1700);
  assert.deepEqual(validate(m), []);
  assert.deepEqual(mansardWarnings(m, parts(m)), []);
});

test("стеллаж с радиусными полками: четверть круга, кромка по дуге, работа, жёсткие полки без полкодержателей", () => {
  const m = radiusShelving(400, 2000, 400, initialModule());
  assert.deepEqual(validate(m), []);
  const ps = parts(m), shelves = ps.filter((p) => p.role === "shelf");
  assert.equal(shelves.length, 4);
  const s = shelves[0];
  assert.ok(Math.abs(area(s.shape!.outline) / (Math.PI * 384 * 384 / 4) - 1) < 0.002, "полка — четверть круга R384 (дуга ломаной)");
  assert.equal(Math.round(s.curveEdge!.len), Math.round(Math.PI * 384 / 2));
  assert.deepEqual([s.length, s.width], [384, 384], "раскрой — по габариту");
  assert.match(s.name, /радиус 384/);
  assert.equal(fastenerCounts(m).shelfHolders, 0);
  assert.ok(fastenerCounts(m).confirmats > 0);
  assert.deepEqual(partCollisions(ps, m).map((c) => c.names.join(" × ")), []);
  const e = estimate(project(m));
  const curve = e.lines.find((l) => l.id === "edge-curve")!, work = e.lines.find((l) => l.id === "cut-work")!;
  assert.equal(work.quantity, 6, "4 полки + дно + крыша");
  assert.ok(Math.abs(curve.quantity - 6 * Math.PI * 0.384 / 2) < 0.01);
  assert.ok(e.retail !== null);
  assert.ok(detailsSheet({ ...project(m), measurement: { number: "T-1" } as Project["measurement"] }).rows.some((r) => r.some((c) => "v" in c && /фигурная: скругление R384/.test(String(c.v)))));
});

test("радиусный стеллаж: скругление внешнего угла R150, левое исполнение зеркально, ошибки", () => {
  const m = radiusShelving(600, 1800, 400, initialModule(), { r: 150, side: "left" });
  assert.deepEqual(validate(m), []);
  const ps = parts(m), side = ps.find((p) => p.id === "right")!, s = ps.find((p) => p.role === "shelf")!;
  assert.ok(side && side.position[0] > 500, "боковина у соседа — справа");
  const xs = s.shape!.outline.map((q) => q[0]);
  assert.ok(s.shape!.outline.some(([u, v]) => u < 1 && v < 1) === false || xs.length > 4);
  // дуга — у левого переднего угла: у левого края полки (u≈0) передняя точка ниже полной глубины
  const front = s.shape!.outline.filter(([u]) => u < 1).map(([, v]) => v);
  assert.ok(Math.max(...front) < 384 - 100, JSON.stringify(front));
  assert.ok(validate({ ...m, radius: { side: "left", r: 500 } }).some((e) => /радиус от 50 до 384/.test(e)));
  assert.ok(validate({ ...m, doors: true }).some((e) => /открытый/.test(e)));
  assert.equal(radiusOutline(100, 100, 0).length, 4);
  void distribute;
});

test("фигурные детали не меняют детали и цену обычных шкафов", () => {
  const m = wardrobe();
  const ps: Part[] = parts(m);
  assert.ok(ps.every((p) => !p.shape && !p.cutWork && !p.curveEdge));
  assert.ok(!estimate(project(m)).lines.some((l) => l.id === "cut-work" || l.id === "edge-curve"));
});
