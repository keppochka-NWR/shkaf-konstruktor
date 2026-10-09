// Распознаватель: модуль эталона Базиса (Кухни\etalon\kNN.json) → параметрический кухонный модуль студии.
// Все размеры читаются из эталона (ширина, высота, глубина боковины, опоры, дно, царги, задник, фасады, полки, крепёж),
// а не подставляются типовые — так модуль студии можно сверить деталь в деталь (compare.ts).
import { initialModule, section, parts, scaleHingeY, type Module, type Groove, type GolaCut } from "../../src/model";
import { partAxes } from "../../src/edges";
import type { RefModule, RefPanel } from "./compare";
import type { KitchenRole } from "../../src/kitchen";
import { wallRaise, bottomFrontRecess, bottomBackRecess, wallRailOnBottom, type WallRaise } from "./wallRaise";
import { wallDryer } from "./wallDryer";
import { wallCornerRaw } from "./wallCorner";
import { wallJointZ, wallJointNone, endGroove, wallShelfEdges, wallEndEdges, wallFixedShelfEdges, bottomUnderDowelOffset } from "./wallJoints";
import { normalizeRefHardware, confirmatName } from "./refHardware";
import { rearNotchFromContour, topCornerNotchFromContour } from "./sideNotch";
import { AXIS_BACK, FIRMAX, firmaxConf, type AxisDrawer, type FirmaxBox, type KDrawer } from "../../src/kitchenDrawers";

const r1 = (v: number) => Math.round(v * 10) / 10;
type B = { x0: number; y0: number; z0: number; x1: number; y1: number; z1: number };
const bx = (p: RefPanel): B => ({ x0: p.box[0], y0: p.box[1], z0: p.box[2], x1: p.box[3], y1: p.box[4], z1: p.box[5] });

/** Пазы панелей эталона, кроме паза под задник (по положению на z задника), со слиянием проходов. */
export function refGrooves(ref: RefModule, backZ0: number | null): { box: [number, number, number, number, number, number]; name: string; panel: number }[] {
  const out: { box: [number, number, number, number, number, number]; name: string; panel: number }[] = [];
  for (const p of ref.panels as (RefPanel & { cuts?: { kind: string; name: string; sign?: string; box?: number[]; width?: number; depth?: number; face?: string }[] })[]) {
    const cs = (p.cuts ?? []).filter((c) => c.kind === "groove" && Array.isArray(c.box) && !(backZ0 !== null && c.box![2] <= backZ0 && c.box![5] >= backZ0 + 2.9 && (c.width ?? 0) <= 4.5));
    const runs: { box: number[]; c: (typeof cs)[number] }[] = [];
    for (const c of cs.sort((a, b) => a.box![2] - b.box![2] || a.box![0] - b.box![0])) {
      const r = runs.find((x) => x.c.face === c.face && Math.abs(x.box[1] - c.box![1]) < 1 && Math.abs(x.box[4] - c.box![4]) < 1 && c.box![2] <= x.box[5] + 0.5 && c.box![0] <= x.box[3] + 0.5 && c.box![3] >= x.box[0] - 0.5);
      if (r) r.box = r.box.map((v, i) => (i < 3 ? Math.min(v, c.box![i]) : Math.max(v, c.box![i])));
      else runs.push({ box: [...c.box!], c });
    }
    for (const r of runs) {
      const w = r1(Math.min(r.box[3] - r.box[0], r.box[4] - r.box[1], r.box[5] - r.box[2]) === r1(r.c.depth ?? 0) ? Math.max(...[r.box[3] - r.box[0], r.box[4] - r.box[1], r.box[5] - r.box[2]].sort((a, b) => a - b).slice(0, 2)) : 0);
      // имя без опечаток Базиса («Подстветка»): «паз под подсветку» / «паз»; размеры пишет grooveText
      out.push({ box: r.box.map(r1) as [number, number, number, number, number, number], name: /подс?т?в?е?т/i.test(r.c.sign ?? "") || /подсвет/i.test(r.c.name) ? "паз под подсветку" : "паз", panel: p.i });
    }
  }
  return out;
}
export type Recognized = { module: Module; notes: string[]; unsupported: string[] };

/** Вырезы Gola по контуру боковины Базиса: участки контура, ушедшие вглубь от переднего торца (z < zFront) не дальше 100 мм.
 *  top0/top1 — от верха боковины, depth — глубина, r — скругление (переход от вертикали выреза к его дну). */
export function golaFromContour(p: { contour?: [number, number][]; contourPlane?: string }, yTop: number, zFront: number): GolaCut[] {
  const c = p.contour; if (!c || p.contourPlane !== "yz" || c.length < 6) return [];
  const inCut = (q: [number, number]) => q[1] < zFront - 0.5 && q[1] > zFront - 100;
  const out: GolaCut[] = []; let grp: [number, number][] = [];
  const flush = () => {
    if (grp.length >= 2) {
      const ys = grp.map((q) => q[0]), zMin = Math.min(...grp.map((q) => q[1])), y0 = Math.min(...ys), y1 = Math.max(...ys);
      const zEdge = Math.max(grp[0][1], grp[grp.length - 1][1]);
      if (y1 - y0 > 10 && y1 - y0 < 300) out.push({ top0: r1(yTop - y1), top1: r1(yTop - y0), depth: r1(zFront - zMin), r: r1(Math.max(0, zEdge - zMin)) });
    }
    grp = [];
  };
  for (const q of c) { if (inCut(q)) grp.push(q); else flush(); }
  flush();
  return out.sort((a, b) => a.top0 - b.top0);
}

export function moduleFromEtalon(ref0: RefModule, look: { decor: string; facadeDecor: string } = { decor: "Белый", facadeDecor: "Белый" }): Recognized {
  const ref: RefModule = { ...ref0, hardware: normalizeRefHardware(ref0.hardware) }; // «Евровинт 6х50» из «прочего» — конфирмат
  const notes: string[] = [], unsupported: string[] = [];
  const W = ref.size[0], P = ref.panels.map((p) => ({ p, b: bx(p) }));
  const board = (k: string) => k === "ldsp" || k === "mdf";
  const sides = P.filter(({ p, b }) => p.axis === "x" && board(p.kind) && b.y1 - b.y0 > 200).sort((a, c) => a.b.x0 - c.b.x0);
  const left = sides[0], right = sides[sides.length - 1];
  if (!left || left === right) throw Error("нет двух боковин");
  const t = left.b.x1 - left.b.x0;
  const sideZ0 = Math.min(left.b.z0, right.b.z0), sideZ1 = Math.max(left.b.z1, right.b.z1), d = r1(sideZ1 - sideZ0);
  const top = Math.max(left.b.y1, right.b.y1);
  const H = r1(top);
  const horiz = P.filter(({ p }) => p.axis === "y" && board(p.kind));
  const fronts = P.filter(({ p, b }) => p.axis === "z" && p.kind !== "hdf" && b.z0 >= sideZ1 - 1).sort((a, c) => a.b.x0 - c.b.x0 || a.b.y0 - c.b.y0);
  const hdf = P.filter(({ p }) => p.kind === "hdf");
  const hw = (cat: string) => ref.hardware.filter((h) => h.category === cat);
  const legs = hw("опора");
  // дно — нижняя горизонталь; крыша — верхняя горизонталь во всю глубину
  const bottom0 = horiz.filter(({ b }) => b.z1 - b.z0 > d * 0.6).sort((a, c) => a.b.y0 - c.b.y0)[0];
  const topPanel = horiz.filter(({ b }) => b.z1 - b.z0 > d * 0.6 && b.y1 >= top - 0.5).sort((a, c) => c.b.y1 - a.b.y1)[0];
  // единственная горизонталь во всю глубину — наверху (k34 m04: сушка без дна, «Крышка» и ХДФ до низа): это крыша, дна нет
  const bottom = bottom0 && bottom0 === topPanel && bottom0.b.y0 > top / 2 ? undefined : bottom0;
  const rails = horiz.filter((h) => h !== topPanel && h !== bottom && h.b.z1 - h.b.z0 <= 150 && h.b.y1 >= top - 0.5);
  // стяжки на ребре — на любой высоте (у мойки задняя бывает посередине, под трубы), между боковинами
  const fxBox = (name: string) => /ящика/i.test(name) && ref.hardware.some((h) => /Firmax/.test(h.name)); // короб ящика Firmax — не царга и не полка
  const railsEdge = P.filter(({ p, b }) => p.axis === "z" && board(p.kind) && b.z1 <= sideZ1 + 0.5 && b.y1 - b.y0 <= 160 && b.x0 >= left.b.x1 - 0.5 && b.x1 <= right.b.x0 + 0.5 && !fronts.some((f) => f.b === b) && !/выдв/i.test(p.name) && !fxBox(p.name));
  const shelves = horiz.filter((h) => h !== bottom && h !== topPanel && !rails.includes(h) && !/выдв/i.test(h.p.name) && !fxBox(h.p.name)); // дно ящика — не полка

  const m: Module = { ...initialModule(), name: ref.name, width: r1(W), height: H, depth: d, decor: look.decor, facadeDecor: look.facadeDecor, sections: [section()] };
  const role: KitchenRole = ref.archetype.startsWith("wall") ? "wall" : ref.archetype === "antresol" ? "antresol" : ref.archetype.startsWith("tall") ? "tall" : "base";
  m.kitchen = { role };
  // опоры и дно
  let wr: WallRaise | null = null;
  if (bottom) {
    const under = bottom.b.x0 <= left.b.x0 + 0.5 && bottom.b.x1 >= right.b.x1 - 0.5;
    if (under) m.bottomUnder = true;
    const bf = role === "wall" ? bottomFrontRecess(bottom, sideZ0, sideZ1) : null;
    if (bf !== null) { m.kitchen.bottomFront = bf; notes.push(`дно короче спереди на ${bf}`); }
    const bb = role === "wall" ? bottomBackRecess(bottom, sideZ0) : null;
    if (bb !== null) { m.kitchen.bottomBack = bb; notes.push(`дно короче сзади на ${bb}`); }
    if (legs.length) m.feet = { height: r1(bottom.b.y0) };
    else if (bottom.b.y0 > 0.5 && (role === "wall" || role === "antresol") && (wr = wallRaise(P, left, right, bottom, fronts, sideZ1))) {
      m.plinthHeight = wr.plinthHeight; if (wr.raisedSides) m.raisedSides = true; m.kitchen.raise = wr.raise; notes.push(wr.note); if (wr.unsupported) unsupported.push(wr.unsupported);
    } else if (bottom.b.y0 > 0.5) { m.plinthHeight = r1(bottom.b.y0); notes.push(`низ корпуса на ${r1(bottom.b.y0)} без опор — как цоколь`); }
    else m.plinthHeight = 0;
  } else { m.bottomType = "none"; m.plinthHeight = 0; }
  if (!topPanel) m.topType = "none";
  const cn = confirmatName(ref.hardware); if (cn) m.kitchen.confirmatName = cn; // «Евровинт 6х50» (k33, k34) — так и в деталях и смете
  if (role === "base" && !legs.length) { m.kitchen.noLegs = true; notes.push("опор в проекте нет — студия их не добавляет"); } // k33, k34: нижний стоит на дне
  if (legs.length) {
    const xs = [...new Set(legs.map((l) => r1(l.pos[0])))].sort((a, c) => a - c);
    const zs = [...new Set(legs.map((l) => r1(l.pos[2] - sideZ0)))].sort((a, c) => a - c);
    // симметричная раскладка (отступ от торцов) — относительной: переживёт изменение ширины
    const sym = xs.length >= 2 && Math.abs(xs[0] - (r1(W) - xs[xs.length - 1])) < 0.6 && (xs.length === 2 || (xs.length === 3 && Math.abs(xs[1] - W / 2) < 0.6 && W > 1300));
    m.kitchen.legs = { back: zs[0], front: r1(d - zs[zs.length - 1]), ...(sym ? { side: xs[0] } : { xs }) };
    if (W < 250 && xs.length === 1 && Math.abs(xs[0] - W / 2) < 0.6) m.kitchen.legs = { back: zs[0], front: r1(d - zs[zs.length - 1]) };
  }
  // цоколь в модуле? (панель у пола перед опорами)
  const plinthPanel = P.find(({ p, b }) => p.axis === "z" && board(p.kind) && b.y0 < 5 && b.y1 <= (bottom?.b.y0 ?? 0) + 1 && b.y1 - b.y0 > 40);
  const clips = hw("клипса").length > 0;
  if (role === "base" || role === "tall") m.kitchen.plinth = { ...(plinthPanel ? { height: r1(plinthPanel.b.y1 - plinthPanel.b.y0) } : { height: 95, off: true }), ...(legs.length && !clips ? { clips: false } : {}) };
  if (fronts.length && !hw("ручка").length) m.noHandles = true;
  if (!plinthPanel && (role === "base" || role === "tall")) notes.push("цоколя в модуле нет (в Базисе — у ряда или отсутствует)");
  // царги
  const railList: NonNullable<Module["rails"]> = [];
  for (const r of rails) {
    const front = r.b.z1 >= sideZ1 - 30, w = r1(r.b.z1 - r.b.z0);
    const sb = front ? r1(sideZ1 - r.b.z1) : r1(r.b.z0 - sideZ0); // утопание передней — от фронта, задней — от задней кромки боковин
    railList.push({ place: front ? "front-top" : "rear-top", height: w, lay: "flat", ...(sb > 0.5 ? { setback: sb } : {}) });
  }
  for (const r of railsEdge) {
    if (r === wr?.panel) continue; // фронтальная под дном навесного — уже панель raise.front, не стяжка
    const atTop = r.b.y1 >= top - 0.5, front = r.b.z1 >= sideZ1 - 30;
    // навесной: планка на ребре, стоящая на дне (k04: верхняя и нижняя задние планки навески) — нижняя стяжка студии, не вторая «верхняя»
    if (wallRailOnBottom(role, r, bottom)) { railList.push({ place: front ? "front-bottom" : "rear-bottom", height: r1(r.b.y1 - r.b.y0) }); continue; }
    railList.push({ place: front ? "front-top" : "rear-top", height: r1(r.b.y1 - r.b.y0), ...(atTop ? {} : { at: r1(r.b.y0) }) });
  }
  if (railList.length) m.rails = railList;
  // задник
  const back = hdf.sort((a, c) => (c.b.x1 - c.b.x0) * (c.b.y1 - c.b.y0) - (a.b.x1 - a.b.x0) * (a.b.y1 - a.b.y0))[0];
  if (!back) m.backType = "none";
  else if (back.b.z1 <= sideZ0 + 0.5) { m.backType = "nailed"; m.backGap = r1(back.b.x0 - left.b.x0); }
  else {
    m.backType = "groove";
    const z0 = r1(back.b.z0 - sideZ0), gw = 4, gd = 8;
    m.grooveInset = r1(z0 - (gw - 3)); m.grooveWidth = gw; m.grooveDepth = gd;
    m.grooveClear = r1((W - 2 * t + 2 * gd - (back.b.x1 - back.b.x0)) / 2);
    // крыша перед ХДФ (k33, k34): крыша короче сзади, ХДФ проходит за ней почти до верха модуля
    if ((role === "wall" || role === "antresol") && topPanel && topPanel !== bottom && topPanel.b.z0 - sideZ0 > 0.5 && back.b.z1 <= topPanel.b.z0 + 0.5) {
      m.kitchen.topBack = r1(topPanel.b.z0 - sideZ0);
      if (back.b.y1 > topPanel.b.y0 + 0.5) m.kitchen.backTopGap = r1(top - back.b.y1);
      if (!bottom && m.kitchen.backTopGap !== undefined) m.kitchen.backBottomGap = r1(back.b.y0 - Math.min(left.b.y0, right.b.y0)); // без дна (k34 m04): ХДФ от низа модуля
      notes.push(`крыша короче сзади на ${m.kitchen.topBack} (перед ХДФ)${m.kitchen.backTopGap !== undefined ? `, ХДФ до верха минус ${m.kitchen.backTopGap}` : ""}`);
    }
    // ХДФ с вырезами в обоих верхних углах (k33, k34: 25×45) — контур Базиса из 8 точек
    const bn = role === "wall" || role === "antresol" ? topCornerNotchFromContour(back.p as unknown as { figure?: boolean; contour?: number[][]; contourPlane?: string }) : null;
    if (bn) { m.kitchen.backNotch = bn; notes.push(`ХДФ: вырезы ${bn.width}×${bn.height} в верхних углах`); }
  }
  // ящики Axis PRO: по каждой левой направляющей — её фасад (по держателю фасада), царга (высота, цвет), дно и задняя стенка
  const axisRuns = ref.hardware.filter((h) => h.category === "направляющая" && /Axis PRO Направляющая/.test(h.name) && h.pos[0] < W / 2).sort((a, c) => a.pos[1] - c.pos[1]);
  const drawerPanels: typeof P = [];
  if (axisRuns.length) {
    const kd: KDrawer[] = [];
    for (const r of axisRuns) {
      const [x, y] = r.pos, len = Number(/(\d+)\s*$/.exec(r.name)?.[1] ?? 500) as AxisDrawer["len"];
      const side = ref.hardware.find((h) => /Axis PRO Царга H-\d+/.test(h.name) && Math.abs(h.pos[0] - x - 15.5) < 1 && Math.abs(h.pos[1] - y - 3.5) < 1);
      const hh = Number(/H-(\d+)/.exec(side?.name ?? "")?.[1] ?? 86) as AxisDrawer["h"], anthr = /Антрацит/i.test(side?.name ?? "");
      const f = fronts.find((q) => q.b.y0 <= y + 3.5 && q.b.y1 >= y + 3.5);
      const bot = P.find(({ p, b }) => /Дно выдв/.test(p.name) && Math.abs(b.y0 - (y - 22)) < 0.6), bk = P.find(({ p, b }) => /Задн\. ст\. выдв/.test(p.name) && Math.abs(b.y0 - (y - 22)) < 0.6);
      if (!f) { unsupported.push(`ящик Axis PRO на ${r1(y)} без фасада`); continue; }
      for (const q of [f, bot, bk]) if (q) drawerPanels.push(q);
      const backH = bk ? r1(bk.b.y1 - bk.b.y0) : undefined;
      const faceScrews = ref.hardware.some((h) => h.name === "3x3" && Math.abs(h.pos[0] - x - 15.5) < 1 && Math.abs(h.pos[1] - y - 3.5) < 1);
      kd.push({ system: "axis-pro", y0: r1(f.b.y0), y1: r1(f.b.y1), runnerY: r1(y), h: hh, len, ...(anthr ? { color: "anthracite" as const } : {}), ...(backH !== undefined && backH !== AXIS_BACK[hh] ? { backH } : {}), ...(faceScrews ? { faceScrews } : {}) });
    }
    if (kd.length) m.kdrawers = kd;
  }
  // ящики Firmax скрытого монтажа: короб ЛДСП 16 по левой боковине ящика; направляющие (по 2 точки Базиса на ящик) — снизу вверх
  const fxRuns = ref.hardware.filter((h) => h.category === "направляющая" && /Firmax/.test(h.name)).sort((a, c) => a.pos[1] - c.pos[1]);
  if (fxRuns.length && !axisRuns.length) {
    const lefts = P.filter(({ p, b }) => /^Боковина ящика лев/i.test(p.name) && b.x0 < W / 2).sort((a, c) => a.b.y0 - c.b.y0);
    const kd: KDrawer[] = [];
    lefts.forEach((s) => {
      const b = s.b, inBox = (q: { b: typeof b }) => q.b.y0 >= b.y0 - 0.5 && q.b.y1 <= b.y1 + 0.5 && q.b.x0 >= b.x1 - 0.5 && q.b.x0 < b.x1 + 30 && q.b.z0 >= b.z0 - 0.5 && q.b.z1 <= b.z1 + 0.5;
      const ov = (q: { b: typeof b }) => Math.min(q.b.y1, b.y1) - Math.max(q.b.y0, b.y0);
      const f = [...fronts].sort((a, c) => ov(c) - ov(a))[0];
      const rs = P.find(({ p, b: q }) => /^Боковина ящика прав/i.test(p.name) && Math.abs(q.y0 - b.y0) < 0.6 && Math.abs(q.z0 - b.z0) < 0.6 && q.x0 > W / 2);
      const bot = P.find((q) => /^Дно ящика/i.test(q.p.name) && inBox(q)), bk = P.find((q) => /^Задн/i.test(q.p.name) && /ящика/i.test(q.p.name) && inBox(q) && q.b.z0 < b.z0 + 1), fal = P.find((q) => /^Фальш/i.test(q.p.name) && inBox(q));
      if (!f || !bot || !bk) { unsupported.push(`ящик Firmax на ${r1(b.y0)}: нет фасада/дна/задней стенки`); return; }
      for (const q of [f, s, rs, bot, bk, fal]) if (q && !drawerPanels.includes(q)) drawerPanels.push(q);
      const box: FirmaxBox = { y: r1(b.y0), h: r1(b.y1 - b.y0), len: r1(b.z1 - b.z0) };
      const gap = r1(b.x0 - left.b.x1), front = r1(sideZ1 - b.z1), bu = r1(bot.b.y0 - b.y0);
      if (gap !== FIRMAX.gap) box.gap = gap;
      if (Math.abs(front) > 0.05) box.front = front;
      if (bu !== FIRMAX.bottomUp) box.bottomUp = bu;
      const confs = ref.hardware.filter((h) => /онфирмат/.test(h.name) && Math.abs(h.pos[0] - b.x0) < 0.6);
      const cb = confs.filter((h) => Math.abs(h.pos[2] - (bk.b.z0 + 8)) < 1 && h.pos[1] > bk.b.y0 - 1 && h.pos[1] < bk.b.y1 + 1).map((h) => r1(h.pos[1] - bk.b.y0)).sort((a, c) => a - c);
      if (cb.length && JSON.stringify(cb) !== JSON.stringify(firmaxConf(r1(bk.b.y1 - bk.b.y0)))) box.conf = cb;
      const cz = confs.filter((h) => Math.abs(h.pos[1] - (bot.b.y0 + 8)) < 1).map((h) => r1(h.pos[2] - b.z0)).sort((a, c) => a - c);
      if (cz.length && cz[0] !== FIRMAX.confBottom) box.confBottom = cz[0];
      const fs = fal ? ref.hardware.filter((h) => /^Шуруп 3,5х30/.test(h.name) && Math.abs(h.pos[2] - fal.b.z0) < 0.6 && h.pos[1] > fal.b.y0 - 0.5 && h.pos[1] < fal.b.y1 + 0.5 && h.pos[0] > b.x1 && h.pos[0] < W - b.x1) : [];
      if (fs.length) box.faceScrews = fs.map((h) => [r1(h.pos[0] - b.x1), r1(h.pos[1] - fal!.b.y0)]);
      if (ref.hardware.some((h) => (h.name === "3x3" || /^Шуруп 3,5х16/.test(h.name)) && Math.abs(h.pos[0] - left.b.x1) < 0.6 && h.pos[1] > b.y0 - 0.5 && h.pos[1] < b.y0 + 40)) box.screws = true;
      if (!ref.hardware.some((h) => h.name === "5x12" && Math.abs(h.pos[2] - b.z0) < 0.6 && h.pos[1] > b.y0 - 0.5 && h.pos[1] < b.y0 + 40)) box.rearHoles = false;
      // точки направляющих Базиса: каждая — ящику с ближайшим низом короба не ниже точки (иначе — верхнему); не две в «x0, runnerY, F» — храним как есть
      const mine = fxRuns.filter((h) => (lefts.find((q) => q.b.y0 >= h.pos[1] - 0.1) ?? lefts[lefts.length - 1]) === s);
      // без своих точек (k22/m03: все 4 у нижнего ящика) — точка по правилу раскладки: низ своего фасада, а не чужая
      const runY = mine[0]?.pos[1] ?? f.b.y0;
      const std = mine.length === 2 && mine.every((h) => Math.abs(h.pos[0] - left.b.x1) < 0.05 && Math.abs(h.pos[1] - runY) < 0.05 && Math.abs(h.pos[2] - sideZ1) < 0.05);
      if (!std) box.runs = mine.map((h) => [r1(h.pos[0] - left.b.x1), r1(h.pos[1]), r1(h.pos[2] - sideZ1)]);
      kd.push({ system: "firmax-ldsp", y0: r1(f.b.y0), y1: r1(f.b.y1), runnerY: r1(runY), box });
    });
    if (kd.length) m.kdrawers = kd;
  }
  // фасады (одна строка распашных; ящики — выше)
  const doors = fronts.filter((f) => hw("петля").length);
  if (fronts.length) {
    const f0 = fronts[0];
    if (f0.p.kind === "other" || f0.p.kind === "mdf") m.facadeMaterial = "external";
    const fEdge = (f0.p as unknown as { edges?: { thick: number }[] }).edges?.find((e) => e.thick > 0)?.thick;
    if (m.facadeMaterial === "external" && fEdge) m.facadeEdge = fEdge; // фасадный материал с кромкой «фасадная 1×22»
    m.facadeT = r1(f0.b.z1 - f0.b.z0);
    m.faceAir = r1(f0.b.z0 - sideZ1);
    m.faceGap = r1(f0.b.x0 - left.b.x0);
    // зазор между фасадами: сосед в том же ряду (по x); если рядов несколько, а в ряду один фасад — зазор между рядами (по y)
    const sameRow = fronts.find((q) => q !== f0 && Math.abs(q.b.y0 - f0.b.y0) < 1 && q.b.x0 > f0.b.x1 - 1);
    const above = fronts.filter((q) => q.b.y0 > f0.b.y1 - 1).sort((a, c) => a.b.y0 - c.b.y0)[0];
    m.faceGapBetween = m.kdrawers ? 3 : sameRow ? r1(sameRow.b.x0 - f0.b.x1) : above ? r1(above.b.y0 - f0.b.y1) : 3; // одиночный фасад: зазор по Базису 3 (при разделении на створки)
    const rows = new Set(fronts.map((f) => Math.round(f.b.y0)));
    // пенал: два ряда распашных (низ + верх, по одной или по две створки) = section.doorSplit студии (разрез фасадов по высоте)
    const rowYs = [...rows].sort((a, c) => a - c), inRow = (y: number) => fronts.filter((q) => Math.abs(Math.round(q.b.y0) - y) < 1);
    const lowRow = inRow(rowYs[0]), upRow = rowYs.length > 1 ? inRow(rowYs[1]) : [];
    const rowsGap = upRow.length && lowRow.length ? upRow[0].b.y0 - lowRow[0].b.y1 : 0;
    // только пенал (role tall) и только если верхний ряд в пределах корпуса: пенал из двух корпусов (k30 m05: боковины 850, фасады до 2469) — не разрез
    // навесной: два ряда распашных (нижний и верхний фасад, k23, k07, k04) — тот же разрез doorSplit
    // навесной — только распашные на боковых петлях: складной подъёмник (ФриФолд, k07 m08/m10) и петли на крыше — не разрез фасадов
    const wallSwing = role === "wall" && !ref.hardware.some((h) => /фри\s*фолд|free\s*fold|подъемник|подъёмник/i.test(h.name)) && hw("петля").every((h) => h.pos[0] <= left.b.x1 + 1 || h.pos[0] >= right.b.x0 - 1);
    const tallRows = (role === "tall" || wallSwing) && rowYs.length === 2 && !m.kdrawers;
    const upOver = tallRows && upRow.length ? r1(Math.max(...upRow.map((q) => q.b.y1)) - top) : 0;
    const split = tallRows && upOver <= 20 && lowRow.length === upRow.length && lowRow.length <= 2 && rowsGap > -0.5 && rowsGap <= 10;
    if (tallRows && rowsGap > 10) unsupported.push(`ниша под технику между фасадами ${r1(rowsGap)} мм (пенал под духовку/СВЧ) — пока не поддержано`);
    else if (tallRows && upOver > 20) unsupported.push(`фасады пенала выше боковин на ${upOver} мм (пенал из нескольких корпусов) — пока не поддержано`);
    else if (split) {
      const gapY = r1(upRow[0].b.y0 - lowRow[0].b.y1);
      m.sections[0].doorSplit = r1(lowRow[0].b.y1 + gapY / 2 - lowRow[0].b.y0); // от низа нижнего фасада до середины зазора между рядами
      if (lowRow.length === 1) m.faceGapBetween = gapY;
    } else if (rows.size > 1 && !m.kdrawers) unsupported.push(`фасады в ${rows.size} ряда (ящики/антресоль) — распознаватель пока только для одного ряда распашных`);
    const perRow = split ? lowRow.length : fronts.length;
    m.doors = doors.length > 0;
    m.sections[0].doorLeaves = (perRow >= 2 ? 2 : 1) as 1 | 2; // число створок — как в Базисе («авто» студии делит 630 на две)
    // подъёмный фасад: «Петля накладная» на нижней плоскости крыши (кватернион Базиса [0,−0,71,0,0,71]), выше середины фасада
    const topHinge = (h: { pos: number[]; quat?: number[] }) => !!h.quat && Math.abs(h.quat[0]) < 0.1 && Math.abs(h.quat[2]) < 0.1 && Math.abs(Math.abs(h.quat[1]) - Math.SQRT1_2) < 0.05 && h.pos[1] > (f0.b.y0 + f0.b.y1) / 2;
    if (fronts.length === 1 && hw("петля").length && hw("петля").every(topHinge)) {
      m.sections[0].doorHinges = ["top"];
      // газлифт PD-G-N02 Базиса (шток, газблок, фиксаторы) — комплект на боковину
      if (hw("газлифт").some((h) => /PD-G-N02/.test(h.name))) m.kitchenLift = { system: "pd-g-n02" };
      if (hw("газлифт").some((h) => !/PD-G-N02/.test(h.name))) unsupported.push(`газлифт ${hw("газлифт").find((h) => !/PD-G-N02/.test(h.name))!.name}`);
      const xs = hw("петля").map((h) => r1(h.pos[0] - f0.b.x0)).sort((a, c) => a - c), dw = f0.b.x1 - f0.b.x0;
      if (xs.length !== 2 || Math.abs(xs[0] - 100) > 0.5 || Math.abs(xs[1] - (dw - 100)) > 0.5) notes.push(`петли подъёмного фасада не по правилу 100 мм от кромок: ${xs.join(", ")}`);
    } else if (perRow === 1) {
      const hinges = hw("петля"), onLeft = hinges.filter((h) => h.pos[0] < W / 2).length, onRight = hinges.length - onLeft;
      m.sections[0].hingeSide = onRight > onLeft ? "right" : "left";
    }
    if (perRow > 2 && !m.kdrawers) unsupported.push(`${fronts.length} фасадов в ряду`);
  } else m.doors = false;
  // высоты петель (от низа фасада) — как в проекте, если отличаются от правила 100 мм от краёв
  if (fronts.length && doors.length && !m.sections[0].doorHinges?.includes("top")) {
    const twoRows = m.sections[0].doorSplit !== undefined; // два ряда (пенал): петли нижнего фасада — hingeY, верхнего — hingeYUp
    const rowHinges = (f: (typeof fronts)[number]) => {
      const ys = hw("петля").filter((h) => h.pos[0] >= f.b.x0 - 30 && h.pos[0] <= f.b.x1 + 30 && (!twoRows || (h.pos[1] >= f.b.y0 && h.pos[1] <= f.b.y1))).map((h) => r1(h.pos[1] - f.b.y0)).sort((a, c) => a - c);
      const def = (() => { const n = ys.length, dh = f.b.y1 - f.b.y0, off = Math.min(100, Math.max(40, dh / 4)); return Array.from({ length: n }, (_, k) => n === 1 ? dh / 2 : off + (dh - 2 * off) * k / (n - 1)); })();
      // число петель по правилу кухни — по высоте фасада; если в проекте другое число или другие высоты — берём высоты проекта
      const n0 = (f.b.y1 - f.b.y0) <= 900 ? 2 : (f.b.y1 - f.b.y0) <= 1300 ? 3 : (f.b.y1 - f.b.y0) <= 1700 ? 4 : (f.b.y1 - f.b.y0) <= 2100 ? 5 : 6;
      return { ys, custom: ys.length > 0 && (ys.length !== n0 || ys.some((y, k) => Math.abs(y - def[k]) > 0.5)), dh: r1(f.b.y1 - f.b.y0) };
    };
    const lo = rowHinges(fronts[0]);
    if (lo.custom) { m.sections[0].hingeY = lo.ys; m.sections[0].hingeYFor = lo.dh; }
    if (twoRows) {
      const fu = fronts.filter((q) => q.b.y0 > fronts[0].b.y1 - 1).sort((a, c) => a.b.x0 - c.b.x0)[0], up = rowHinges(fu);
      // верхний ряд: свои высоты, если не совпадают с тем, что студия дала бы сама (правило или масштаб нижних)
      const scaled = lo.custom ? scaleHingeY(lo.ys, lo.dh, up.dh) : null;
      if (up.custom || (scaled && (scaled.length !== up.ys.length || scaled.some((y, k) => Math.abs(y - up.ys[k]) > 0.5)))) { m.sections[0].hingeYUp = up.ys; m.sections[0].hingeYUpFor = up.dh; }
    }
  }
  // полки (ЛДСП и стекло)
  const glassSh = P.filter(({ p }) => p.axis === "y" && p.kind === "glass");
  const innerBottom = bottom ? bottom.b.y1 : 0, innerTop = topPanel ? topPanel.b.y0 : top;
  const sh = [...shelves, ...glassSh].sort((a, c) => a.b.y0 - c.b.y0);
  m.sections[0].shelves = sh.map((s) => (s.b.y0 + s.b.y1) / 2).map((cy) => (cy - innerBottom) / (innerTop - innerBottom));
  const gl = sh.map((s, j) => (glassSh.includes(s) ? j : -1)).filter((j) => j >= 0);
  if (gl.length) { m.sections[0].glassShelves = gl; m.glassT = r1(glassSh[0].b.y1 - glassSh[0].b.y0); m.glassGap = r1(glassSh[0].b.x0 - left.b.x1); }
  if (sh.length) {
    const s0 = sh[0], rear = m.backType === "groove" ? (m.grooveInset ?? 16) + 3 + 1 : 0;
    m.sections[0].shelfDepth = r1(s0.b.z1 - s0.b.z0);
    m.shelfRear = r1(s0.b.z0 - sideZ0 - rear);
    const pins = hw("полкодержатель").filter((h) => Math.abs(h.pos[1] - s0.b.y0) < 2);
    if (pins.length) m.shelfPinInset = r1(Math.min(...pins.map((h) => h.pos[2] - s0.b.z0)));
    const fixed = sh.map((s, j) => (hw("полкодержатель").some((h) => Math.abs(h.pos[1] - s.b.y0) < 2) ? -1 : j)).filter((j) => j >= 0);
    if (fixed.length) m.sections[0].fixed = fixed;
  }
  // крепёж по стыкам: эксцентрик (+шкант) или конфирмат — по фурнитуре у каждой стороны дна/крыши
  const ecc = hw("эксцентрик"), dow = hw("шкант");
  // в проекте нет крепежа корпуса вовсе (k32: ни фурнитуры, ни присадки) — студия его не добавляет
  if (!ecc.length && !dow.length && !hw("конфирмат").length) m.kitchen.noFasteners = true;
  for (const [id, q] of [["bottom", bottom], ["top", topPanel]] as const) {
    if (!q) continue;
    for (const [side, sx] of [["left", left.b.x1], ["right", right.b.x0]] as const) {
      const near = (h: { pos: number[] }) => Math.abs(h.pos[0] - sx) < 1 && h.pos[1] >= q.b.y0 - 1 && h.pos[1] <= q.b.y1 + 1;
      if (ecc.some(near)) { (m.jointFastening ??= {})[`${id}:${side}`] = "eccentric"; }
    }
  }
  // фиксированные полки пенала (ниши под технику, разрез фасадов): эксцентрик + шкант, как у крыши — по фурнитуре Базиса у каждой стороны
  for (const j of m.sections[0].fixed ?? []) {
    const q = sh[j];
    if (!q) continue;
    for (const [side, sx] of [["left", left.b.x1], ["right", right.b.x0]] as const)
      if (ecc.some((h) => Math.abs(h.pos[0] - sx) < 1 && h.pos[1] >= q.b.y0 - 1 && h.pos[1] <= q.b.y1 + 1)) (m.jointFastening ??= {})[`${m.sections[0].id}:shelf:${j}:${side}`] = "eccentric";
  }
  if (m.jointFastening && dow.length && ecc.length) {
    const e0 = ecc[0], d0 = dow.filter((d) => Math.abs(d.pos[1] - e0.pos[1]) < 10).sort((a, c) => Math.abs(a.pos[2] - e0.pos[2]) - Math.abs(c.pos[2] - e0.pos[2]))[0];
    if (d0) m.dowels = { offset: r1(Math.abs(d0.pos[2] - e0.pos[2])) };
  }
  // крепёж дна/крыши: отступ конфирматов от концов стыка (снизу через дно — у дна под боковинами; через боковину — в пределах толщины дна/крыши)
  const conf = [...hw("конфирмат"), ...ecc].filter((h) => [bottom, topPanel].some((q) => q && (Math.abs(h.pos[1] - q.b.y0) < 1 || (h.pos[1] > q.b.y0 && h.pos[1] < q.b.y1))));
  const host0 = bottom ?? topPanel;
  if (conf.length && host0) m.confirmatInset = r1(Math.min(...conf.map((h) => h.pos[2] - host0.b.z0)));
  // навесные: у каждого стыка дна/крыши свои отступы крепежа, если они не совпадают с общим
  if ((role === "wall" || role === "antresol") && m.confirmatInset !== undefined) {
    // жёсткие полки (k05 m10/m11: полка над сушкой на конфирматах 53/52 при общем 63) — тоже свои отступы
    const fixedJ = (m.sections[0].fixed ?? []).map((j) => [`${m.sections[0].id}:shelf:${j}`, sh[j]] as [string, (typeof sh)[number] | undefined]);
    const jz = wallJointZ(ref.hardware, [["bottom", bottom], ["top", topPanel], ...fixedJ], left, right, m.confirmatInset);
    if (Object.keys(jz).length) m.kitchen.jointZ = jz;
    // жёсткая полка без крепежа в проекте (k21 m05: полка над сушкой на 724 — в Базисе ни конфирматов, ни эксцентриков) — студия его не добавляет
    const jn = wallJointNone(ref.hardware, [["bottom", bottom], ["top", topPanel], ...fixedJ], left, right);
    if (jn.length) m.kitchen.jointNone = jn;
    // дно под боковинами на эксцентриках (k30, k31): шкант на нижней пласти дна — своё смещение от эксцентрика
    if (m.bottomUnder && bottom && !m.dowels && (m.jointFastening?.["bottom:left"] === "eccentric" || m.jointFastening?.["bottom:right"] === "eccentric")) {
      const off = bottomUnderDowelOffset(ref.hardware, bottom);
      if (off !== null) m.dowels = { offset: off };
    }
  }
  // кромка: толщина — по кромке боковины (Базис: 1 или 0,5 мм на открытых торцах, скрытые — без кромки)
  const et = (left.p as unknown as { edges?: { thick: number }[] }).edges?.find((e) => e.thick > 0)?.thick;
  if (et) m.edgeScheme = { t: et };
  // Gola: вырезы в переднем торце боковин — по контуру боковины Базиса (contourPlane yz, точки [y, z])
  if (role === "base") {
    const gc = golaFromContour(left.p as unknown as { contour?: [number, number][]; contourPlane?: string }, left.b.y1, left.b.z1);
    const fTop = fronts.length ? Math.max(...fronts.map((f) => f.b.y1)) : null;
    // кромка по самому вырезу: сумма кромки переднего торца у Базиса больше прямых участков
    const ze = ((left.p as unknown as { edges?: { side: string; thick: number; len?: number }[] }).edges ?? []).filter((e) => e.side === "+z" && e.thick > 0 && e.len !== undefined).reduce((s, e) => s + e.len!, 0);
    if (gc.length && ze > left.b.y1 - left.b.y0 - gc.reduce((s, c) => s + c.top1 - c.top0, 0) + 1) gc.forEach((c) => (c.edged = true));
    if (gc.length) { m.gola = { cuts: gc }; if (fTop !== null && gc.some((c) => c.top0 === 0)) m.gola.faceTop = r1(top - fTop); notes.push(`Gola: ${gc.length} выреза в боковинах (${gc.map((c) => `${c.top0}–${c.top1} от верха, глуб. ${c.depth}, R${c.r}`).join("; ")})`); }
  }
  // задняя царга заподлицо с задней кромкой боковин: у части кухонь её задний торец не кромится
  const rearRail = rails.find((r) => Math.abs(r.b.z0 - sideZ0) < 0.6), rre = (rearRail?.p as unknown as { edges?: { side: string; thick: number }[] } | undefined)?.edges;
  if (et && rre?.some((e) => e.thick > 0) && !rre.some((e) => e.side === "-z" && e.thick > 0)) m.edgeScheme = { t: et, railBack: false };
  // навесные: кромка съёмных полок — своя толщина (k10: 0,5 при корпусе 0,4) и свои торцы (k22: только перед) — по первой полке на полкодержателях
  if (et && m.edgeScheme && (role === "wall" || role === "antresol")) {
    Object.assign(m.edgeScheme, wallShelfEdges(shelves, hw("полкодержатель"), et));
    // торцы дна и крыши: правило студии (kitchenEdges) — перед и (при пазе/без задника) зад; дно под боковинами — ещё концы
    const rear: ("-z")[] = m.backType === "groove" || m.backType === "none" ? ["-z"] : [];
    const ends = wallEndEdges(bottom, topPanel, { bottom: m.bottomUnder ? ["+z", "+x", "-x", ...rear] : ["+z", ...rear], top: ["+z", ...rear] });
    if (Object.keys(ends).length) m.edgeScheme.ends = ends;
    const fx = m.sections[0].fixed?.length ? wallFixedShelfEdges(sh[m.sections[0].fixed[0]]) : undefined;
    if (fx) m.edgeScheme.fixedSides = fx;
  }
  // глубина присадки по проекту, если не типовая: D5 конфирмата в торец дна/крыши (типовая 35; k33/k34 «Евровинт 6х50» — 36), D5 полкодержателя (12; k33/k34 — 9)
  {
    const body = new Set([bottom, topPanel, left, right].filter(Boolean).map((x) => x!.p.i));
    const mode = (xs: number[]) => { const c = new Map<number, number>(); for (const x of xs) c.set(x, (c.get(x) ?? 0) + 1); return [...c].sort((a, b) => b[1] - a[1])[0]?.[0]; };
    const srcCat = (h: { src?: number | null }) => (h.src === null || h.src === undefined ? undefined : ref.hardware[h.src]?.category);
    const hs = ref.holes ?? [];
    const conf = mode(hs.filter((h) => h.d === 5 && srcCat(h) === "конфирмат" && body.has(h.panel)).map((h) => r1(h.depth)));
    const pin = mode(hs.filter((h) => h.d === 5 && srcCat(h) === "полкодержатель").map((h) => r1(h.depth)));
    const drill: NonNullable<NonNullable<Module["kitchen"]>["drill"]> = {};
    if (conf !== undefined && Math.abs(t - 16) < 0.1 && conf !== 35) drill.confirmat = conf;
    if (pin !== undefined && pin !== 12) drill.pin = pin;
    // эксцентрик со своей присадкой (k33/k34 «Стяжка Макмарт Ø15»): бочонок D15×13, шток D7×28, в стойку D5×9, шкант в стойку D8×11, бочонок дна снизу
    const eh = hs.filter((h) => srcCat(h) === "эксцентрик"), dh = hs.filter((h) => srcCat(h) === "шкант" && h.d === 8);
    if (eh.length && !m.bottomUnder) {
      const e: NonNullable<NonNullable<Module["kitchen"]>["ecc"]> = {};
      const barrel = mode(eh.filter((h) => h.d === 15).map((h) => r1(h.depth))), side = mode(eh.filter((h) => h.d === 5).map((h) => r1(h.depth)));
      const stems = eh.filter((h) => (h.d === 7 || h.d === 8) && h.depth > 20), stemD = mode(stems.map((h) => h.d)), stemL = mode(stems.map((h) => r1(h.depth)));
      const dSide = mode(dh.filter((h) => h.depth < 20).map((h) => r1(h.depth)));
      if (barrel !== undefined && barrel !== 12) e.barrel = barrel;
      if (stemD !== undefined && stemL !== undefined && (stemD !== 8 || stemL !== 34)) e.stem = [stemD, stemL];
      if (side !== undefined && side !== 12) e.side = side;
      if (dSide !== undefined && dSide !== 12) e.dowelSide = dSide;
      if (bottom && eh.some((h) => h.d === 15 && h.panel === bottom.p.i && h.face === "-y")) e.bottomOut = true;
      if (Object.keys(e).length) { m.kitchen.ecc = e; notes.push(`эксцентрик по проекту: ${JSON.stringify(e)}`); }
    }
    if (Object.keys(drill).length) { m.kitchen.drill = drill; notes.push(`присадка по проекту: ${Object.entries(drill).map(([k, v]) => `${k === "pin" ? "полкодержатель" : "конфирмат"} D5×${v}`).join(", ")}`); }
  }
  // навесные/антресоли: вырез в заднем верхнем углу боковины (k32: 100×20, контур из 6 точек) — у каждой боковины свой (k32 m14: только у правой)
  if (role === "wall" || role === "antresol") {
    for (const [side, s] of [["left", left], ["right", right]] as const) {
      const n = rearNotchFromContour(s.p as unknown as { figure?: boolean; contour?: number[][]; contourPlane?: string });
      if (n) { (m.kitchen.sideNotch ??= {})[side] = n; notes.push(`вырез ${n.height}×${n.depth} в заднем верхнем углу боковины (${side === "left" ? "левой" : "правой"})`); }
    }
  }
  // навесы: в ранних кухнях (k01, k03) навешивание иначе — без навесов
  if ((role === "wall" || role === "antresol") && !hw("навес").length) m.kitchen.hangers = false;
  // сушка навесного: элементы с сеткой Базиса — в точке и с поворотом проекта; без сетки — только заметка
  if (role === "wall") { const dr = wallDryer(ref.hardware, W, sideZ0); if (dr.dryer) m.kitchen.dryer = dr.dryer; notes.push(...dr.notes); }
  // пазы (кроме паза под задник): проходы фрезы одного паза сливаем (2×10 внахлёст = паз 17)
  // пазы — относительно детали-носителя студии (идут за деталью при изменении размеров)
  const g = refGrooves(ref, back ? r1(back.b.z0) : null);
  if (g.length) {
    const ps = parts(m).filter((p) => p.material === "board"), out: Groove[] = [];
    for (const gr of g) {
      const bb = [gr.box[0], gr.box[1], gr.box[2] - sideZ0, gr.box[3], gr.box[4], gr.box[5] - sideZ0];
      const host = ps.find((p) => [0, 1, 2].every((i) => bb[i] >= p.position[i] - p.size[i] / 2 - 0.6 && bb[i + 3] <= p.position[i] + p.size[i] / 2 + 0.6));
      if (!host) { unsupported.push(`паз ${gr.name} без детали-носителя`); continue; }
      const ax = partAxes(host), lo = host.position.map((v, i) => v - host.size[i] / 2), hi = host.position.map((v, i) => v + host.size[i] / 2);
      const eg = endGroove(bb, ax, lo, hi, gr.name); // паз в торце (под LED-профиль в переднем торце дна)
      if (eg) { out.push({ host: host.id, ...eg }); continue; }
      const face = Math.abs(bb[ax.t + 3] - hi[ax.t]) < Math.abs(bb[ax.t] - lo[ax.t]) ? "+" : "-";
      out.push({ host: host.id, face, along: [r1(bb[ax.L] - lo[ax.L]), r1(hi[ax.L] - bb[ax.L + 3])], across: [r1(bb[ax.W] - lo[ax.W]), r1(bb[ax.W + 3] - lo[ax.W])], depth: r1(bb[ax.t + 3] - bb[ax.t]), name: gr.name });
    }
    if (out.length) m.grooves = out;
  }
  // панель у пола под дном — цоколь только у нижних и пеналов; у навесных/антресолей её берёт лишь wallRaise (wr.panel),
  // иначе она не распознана (k31 m20/m21: задняя вертикаль 568×537 под поднятым корпусом) — не терять молча
  const plinthUsed = role === "base" || role === "tall" ? plinthPanel : undefined;
  const other = ref.panels.length - P.filter((x) => [left, right, bottom, topPanel, back, ...rails, ...railsEdge, ...shelves, ...glassSh, ...fronts, plinthUsed, wr?.panel, ...drawerPanels].includes(x)).length;
  if (other) unsupported.push(`${other} панелей не распознано (перегородки, ящики, вставки)`);
  // угловой навесной с диагональным фасадом — параметрики нет (см. wallCorner.ts), причина первой
  if (ref.archetype.startsWith("wall")) { const why = wallCornerRaw(ref); if (why) unsupported.unshift(why); }
  return { module: m, notes, unsupported };
}
