// Распознаватель: модуль эталона Базиса (Кухни\etalon\kNN.json) → параметрический кухонный модуль студии.
// Все размеры читаются из эталона (ширина, высота, глубина боковины, опоры, дно, царги, задник, фасады, полки, крепёж),
// а не подставляются типовые — так модуль студии можно сверить деталь в деталь (compare.ts).
import { initialModule, section, parts, type Module, type Groove, type GolaCut } from "../../src/model";
import { partAxes } from "../../src/edges";
import type { RefModule, RefPanel } from "./compare";
import type { KitchenRole } from "../../src/kitchen";
import { AXIS_BACK, type KDrawer } from "../../src/kitchenDrawers";

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

export function moduleFromEtalon(ref: RefModule, look: { decor: string; facadeDecor: string } = { decor: "Белый", facadeDecor: "Белый" }): Recognized {
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
  const bottom = horiz.filter(({ b }) => b.z1 - b.z0 > d * 0.6).sort((a, c) => a.b.y0 - c.b.y0)[0];
  const topPanel = horiz.filter(({ b }) => b.z1 - b.z0 > d * 0.6 && b.y1 >= top - 0.5).sort((a, c) => c.b.y1 - a.b.y1)[0];
  const rails = horiz.filter((h) => h !== topPanel && h !== bottom && h.b.z1 - h.b.z0 <= 150 && h.b.y1 >= top - 0.5);
  // стяжки на ребре — на любой высоте (у мойки задняя бывает посередине, под трубы), между боковинами
  const railsEdge = P.filter(({ p, b }) => p.axis === "z" && board(p.kind) && b.z1 <= sideZ1 + 0.5 && b.y1 - b.y0 <= 160 && b.x0 >= left.b.x1 - 0.5 && b.x1 <= right.b.x0 + 0.5 && !fronts.some((f) => f.b === b) && !/выдв/i.test(p.name));
  const shelves = horiz.filter((h) => h !== bottom && h !== topPanel && !rails.includes(h) && !/выдв/i.test(h.p.name)); // дно ящика — не полка

  const m: Module = { ...initialModule(), name: ref.name, width: r1(W), height: H, depth: d, decor: look.decor, facadeDecor: look.facadeDecor, sections: [section()] };
  const role: KitchenRole = ref.archetype.startsWith("wall") ? "wall" : ref.archetype === "antresol" ? "antresol" : ref.archetype.startsWith("tall") ? "tall" : "base";
  m.kitchen = { role };
  // опоры и дно
  if (bottom) {
    const under = bottom.b.x0 <= left.b.x0 + 0.5 && bottom.b.x1 >= right.b.x1 - 0.5;
    if (under) m.bottomUnder = true;
    if (legs.length) m.feet = { height: r1(bottom.b.y0) };
    else if (bottom.b.y0 > 0.5) { m.plinthHeight = r1(bottom.b.y0); notes.push(`низ корпуса на ${r1(bottom.b.y0)} без опор — как цоколь`); }
    else m.plinthHeight = 0;
  } else { m.bottomType = "none"; m.plinthHeight = 0; }
  if (!topPanel) m.topType = "none";
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
  for (const r of railsEdge) { const atTop = r.b.y1 >= top - 0.5; railList.push({ place: r.b.z1 >= sideZ1 - 30 ? "front-top" : "rear-top", height: r1(r.b.y1 - r.b.y0), ...(atTop ? {} : { at: r1(r.b.y0) }) }); }
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
  }
  // ящики Axis PRO: по каждой левой направляющей — её фасад (по держателю фасада), царга (высота, цвет), дно и задняя стенка
  const axisRuns = ref.hardware.filter((h) => h.category === "направляющая" && /Axis PRO Направляющая/.test(h.name) && h.pos[0] < W / 2).sort((a, c) => a.pos[1] - c.pos[1]);
  const drawerPanels: typeof P = [];
  if (axisRuns.length) {
    const kd: KDrawer[] = [];
    for (const r of axisRuns) {
      const [x, y] = r.pos, len = Number(/(\d+)\s*$/.exec(r.name)?.[1] ?? 500) as KDrawer["len"];
      const side = ref.hardware.find((h) => /Axis PRO Царга H-\d+/.test(h.name) && Math.abs(h.pos[0] - x - 15.5) < 1 && Math.abs(h.pos[1] - y - 3.5) < 1);
      const hh = Number(/H-(\d+)/.exec(side?.name ?? "")?.[1] ?? 86) as KDrawer["h"], anthr = /Антрацит/i.test(side?.name ?? "");
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
    m.faceGapBetween = m.kdrawers ? 3 : fronts.length > 1 ? r1(fronts[1].b.x0 - fronts[0].b.x1) : 3; // одиночный фасад: зазор по Базису 3 (при разделении на створки)
    const rows = new Set(fronts.map((f) => Math.round(f.b.y0)));
    if (rows.size > 1 && !m.kdrawers) unsupported.push(`фасады в ${rows.size} ряда (ящики/антресоль) — распознаватель пока только для одного ряда распашных`);
    m.doors = doors.length > 0;
    m.sections[0].doorLeaves = (fronts.length >= 2 ? 2 : 1) as 1 | 2; // число створок — как в Базисе («авто» студии делит 630 на две)
    if (fronts.length === 1) {
      const hinges = hw("петля"), onLeft = hinges.filter((h) => h.pos[0] < W / 2).length, onRight = hinges.length - onLeft;
      m.sections[0].hingeSide = onRight > onLeft ? "right" : "left";
    }
    if (fronts.length > 2 && !m.kdrawers) unsupported.push(`${fronts.length} фасадов в ряду`);
  } else m.doors = false;
  // высоты петель (от низа фасада) — как в проекте, если отличаются от правила 100 мм от краёв
  if (fronts.length && doors.length) {
    const f = fronts[0], ys = hw("петля").filter((h) => h.pos[0] >= f.b.x0 - 30 && h.pos[0] <= f.b.x1 + 30).map((h) => r1(h.pos[1] - f.b.y0)).sort((a, c) => a - c);
    const def = (() => { const n = ys.length, dh = f.b.y1 - f.b.y0, off = Math.min(100, Math.max(40, dh / 4)); return Array.from({ length: n }, (_, k) => n === 1 ? dh / 2 : off + (dh - 2 * off) * k / (n - 1)); })();
    // число петель по правилу кухни — по высоте фасада; если в проекте другое число или другие высоты — берём высоты проекта
    const n0 = (f.b.y1 - f.b.y0) <= 900 ? 2 : (f.b.y1 - f.b.y0) <= 1300 ? 3 : (f.b.y1 - f.b.y0) <= 1700 ? 4 : (f.b.y1 - f.b.y0) <= 2100 ? 5 : 6;
    if (ys.length && (ys.length !== n0 || ys.some((y, k) => Math.abs(y - def[k]) > 0.5))) { m.sections[0].hingeY = ys; m.sections[0].hingeYFor = r1(f.b.y1 - f.b.y0); }
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
  for (const [id, q] of [["bottom", bottom], ["top", topPanel]] as const) {
    if (!q) continue;
    for (const [side, sx] of [["left", left.b.x1], ["right", right.b.x0]] as const) {
      const near = (h: { pos: number[] }) => Math.abs(h.pos[0] - sx) < 1 && h.pos[1] >= q.b.y0 - 1 && h.pos[1] <= q.b.y1 + 1;
      if (ecc.some(near)) { (m.jointFastening ??= {})[`${id}:${side}`] = "eccentric"; }
    }
  }
  if (m.jointFastening && dow.length && ecc.length) {
    const e0 = ecc[0], d0 = dow.filter((d) => Math.abs(d.pos[1] - e0.pos[1]) < 10).sort((a, c) => Math.abs(a.pos[2] - e0.pos[2]) - Math.abs(c.pos[2] - e0.pos[2]))[0];
    if (d0) m.dowels = { offset: r1(Math.abs(d0.pos[2] - e0.pos[2])) };
  }
  // крепёж дна/крыши: отступ конфирматов от концов стыка (снизу через дно — у дна под боковинами; через боковину — в пределах толщины дна/крыши)
  const conf = [...hw("конфирмат"), ...ecc].filter((h) => [bottom, topPanel].some((q) => q && (Math.abs(h.pos[1] - q.b.y0) < 1 || (h.pos[1] > q.b.y0 && h.pos[1] < q.b.y1))));
  const host0 = bottom ?? topPanel;
  if (conf.length && host0) m.confirmatInset = r1(Math.min(...conf.map((h) => h.pos[2] - host0.b.z0)));
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
  // навесы: в ранних кухнях (k01, k03) навешивание иначе — без навесов
  if ((role === "wall" || role === "antresol") && !hw("навес").length) m.kitchen.hangers = false;
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
      const face = Math.abs(bb[ax.t + 3] - hi[ax.t]) < Math.abs(bb[ax.t] - lo[ax.t]) ? "+" : "-";
      out.push({ host: host.id, face, along: [r1(bb[ax.L] - lo[ax.L]), r1(hi[ax.L] - bb[ax.L + 3])], across: [r1(bb[ax.W] - lo[ax.W]), r1(bb[ax.W + 3] - lo[ax.W])], depth: r1(bb[ax.t + 3] - bb[ax.t]), name: gr.name });
    }
    if (out.length) m.grooves = out;
  }
  const other = ref.panels.length - P.filter((x) => [left, right, bottom, topPanel, back, ...rails, ...railsEdge, ...shelves, ...glassSh, ...fronts, plinthPanel, ...drawerPanels].includes(x)).length;
  if (other) unsupported.push(`${other} панелей не распознано (перегородки, ящики, вставки)`);
  return { module: m, notes, unsupported };
}
