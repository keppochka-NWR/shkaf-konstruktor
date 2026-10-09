// Распознаватель: модуль эталона Базиса (Кухни\etalon\kNN.json) → параметрический кухонный модуль студии.
// Все размеры читаются из эталона (ширина, высота, глубина боковины, опоры, дно, царги, задник, фасады, полки, крепёж),
// а не подставляются типовые — так модуль студии можно сверить деталь в деталь (compare.ts).
import { initialModule, section, parts, scaleHingeY, type Module, type Groove, type GolaCut } from "../../src/model";
import { partAxes } from "../../src/edges";
import type { RefModule, RefPanel } from "./compare";
import type { KitchenRole } from "../../src/kitchen";
import { AXIS_BACK, FIRMAX, firmaxConf, type AxisDrawer, type FirmaxBox, type KDrawer } from "../../src/kitchenDrawers";
import { rafixZs, type KitchenRafix, type RafixGrid } from "../../src/kitchenRafix";

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

/** Ниша под технику между двумя рядами распашных фасадов пенала (одинаковое число створок, 1 или 2, ряды по одной линии x):
 *  gap — зазор между створками ряда (у одной створки — 3, как у Базиса), split — от низа нижнего ряда до его верха + gap/2,
 *  niche — от верха нижнего ряда до низа верхнего. undefined — ряды не совпадают по ширине/створкам. */
export function nicheFromRows(low: B[], up: B[]): { gap: number; split: number; niche: number } | undefined {
  const r = doorRowsFromFronts([low, up], 3);
  return r && r.niche !== undefined ? { gap: r.gap, split: r.split, niche: r.niche } : undefined;
}

/** Ряды распашных фасадов пенала снизу вверх (в каждом ряду 1 или 2 створки, ряды по одной линии x, створки ряда одной высоты):
 *  gap — зазор между створками (у одной створки — зазор между рядами 2-й и выше, иначе single), split — нижний ряд + gap/2,
 *  niche — открытая ниша над нижним рядом (если зазор там не равен зазору рядов), rows — высоты средних рядов.
 *  undefined — ряды не сводятся к этой схеме (разное число створок, разные зазоры между верхними рядами). */
export function doorRowsFromFronts(rows: B[][], single = 3): { gap: number; split: number; niche?: number; rows: number[] } | undefined {
  if (rows.length < 2 || rows.some((r) => !r.length || r.length > 2 || r.length !== rows[0].length)) return undefined;
  const rs = rows.map((r) => [...r].sort((a, c) => a.x0 - c.x0));
  for (const r of rs) {
    if (r.some((q, k) => Math.abs(q.x0 - rs[0][k].x0) > 0.6 || Math.abs(q.x1 - rs[0][k].x1) > 0.6)) return undefined;
    if (r.some((q) => Math.abs(q.y0 - r[0].y0) > 0.6 || Math.abs(q.y1 - r[0].y1) > 0.6)) return undefined;
  }
  const gaps = rs.slice(1).map((r, i) => r1(r[0].y0 - rs[i][0].y1));
  const rowGap = gaps.length > 1 ? gaps[1] : undefined;
  if (gaps.slice(1).some((g) => Math.abs(g - gaps[1]) > 0.6) || gaps.some((g) => g < -0.5)) return undefined;
  const gap = rs[0].length === 2 ? r1(rs[0][1].x0 - rs[0][0].x1) : rowGap ?? (gaps[0] <= 10 ? gaps[0] : single);
  if (rowGap !== undefined && Math.abs(rowGap - gap) > 0.6) return undefined; // у двух створок зазор рядов = зазор створок
  const niche = Math.abs(gaps[0] - gap) > 0.6 ? gaps[0] : undefined;
  return { gap, split: r1(rs[0][0].y1 - rs[0][0].y0 + gap / 2), ...(niche !== undefined ? { niche } : {}), rows: rs.slice(1, -1).map((r) => r1(r[0].y1 - r[0].y0)) };
}

/** Сетка крепежа (конфирмат/эксцентрик) на стыке горизонтали со стойкой по Базису: точки у левой стойки (нет — у правой),
 *  отступы от заднего/переднего торца горизонтали, штук; стыки, где точек меньше двух или шаг неравный, не возвращаются. */
export function jointGridsFromEtalon(ref: RefModule, hosts: [string, B][], left: B, right: B): Record<string, RafixGrid> {
  const fs = ref.hardware.filter((h) => h.category === "конфирмат" || h.category === "эксцентрик"), out: Record<string, RafixGrid> = {};
  for (const [key, q] of hosts) {
    const at = (s: B) => fs.filter((h) => (Math.abs(h.pos[1] - q.y0) < 1 || (h.pos[1] > q.y0 && h.pos[1] < q.y1)) && h.pos[0] >= s.x0 - 1 && h.pos[0] <= s.x1 + 1 && h.pos[2] >= q.z0 - 1 && h.pos[2] <= q.z1 + 1);
    const pts = at(left).length ? at(left) : at(right);
    const zs = [...new Set(pts.map((h) => r1(h.pos[2])))].sort((a, c) => a - c);
    if (zs.length < 2) continue;
    const g: RafixGrid = { rear: r1(zs[0] - q.z0), front: r1(q.z1 - zs[zs.length - 1]), n: zs.length };
    if (rafixZs(g, q.z0, q.z1).every((z, k) => Math.abs(z - zs[k]) < 0.6)) out[key] = g;
  }
  return out;
}

/** Жёсткие полки без крепежа к стойкам в Базисе (ни конфирмата, ни эксцентрика, ни шканта, ни рафикса у торцов полки на её высоте). */
export function bareShelvesFromEtalon(ref: RefModule, shelves: B[], fixed: number[]): number[] {
  const fs = ref.hardware.filter((h) => ["конфирмат", "эксцентрик", "шкант", "рафикс"].includes(h.category));
  return fixed.filter((j) => {
    const b = shelves[j];
    if (!b) return false;
    return !fs.some((h) => h.pos[1] >= b.y0 - 1 && h.pos[1] <= b.y1 + 1 && h.pos[2] >= b.z0 - 1 && h.pos[2] <= b.z1 + 1 && (h.pos[0] <= b.x0 + 20 || h.pos[0] >= b.x1 - 20));
  });
}

/** Створки без петель (номер row*2+col, ряды снизу, створки слева): у фасада холодильника петель в Базисе нет — он на двери техники. */
export function hingelessDoors(rows: B[][], hinges: { pos: number[] }[]): number[] {
  const out: number[] = [];
  rows.forEach((r, row) => [...r].sort((a, c) => a.x0 - c.x0).forEach((q, col) => {
    if (!hinges.some((h) => h.pos[1] >= q.y0 - 0.5 && h.pos[1] <= q.y1 + 0.5 && h.pos[0] >= q.x0 - 30 && h.pos[0] <= q.x1 + 30)) out.push(row * 2 + col);
  }));
  return out;
}

/** Позиции опор по ширине: точки ближе 2 мм — одна позиция (среднее), иначе студия поставила бы лишние опоры в каждый ряд. */
export function clusterLegXs(xs: number[]): number[] {
  const out: number[][] = [];
  for (const x of [...xs].sort((a, c) => a - c)) { const g = out[out.length - 1]; if (g && x - g[g.length - 1] <= 2) g.push(x); else out.push([x]); }
  return out.map((g) => r1(g.reduce((s, v) => s + v, 0) / g.length));
}

/** Точек крепежа (конфирмат/эксцентрик) по глубине на стыке дна и крыши с левой стойкой: наибольшее из двух; 2 или 3, иначе undefined. */
export function jointPointsFromEtalon(ref: RefModule, hosts: (B | undefined)[], left: B): 2 | 3 | undefined {
  let n = 0;
  for (const q of hosts) {
    if (!q) continue;
    const fs = ref.hardware.filter((h) => (h.category === "конфирмат" || h.category === "эксцентрик") && (Math.abs(h.pos[1] - q.y0) < 1 || (h.pos[1] > q.y0 && h.pos[1] < q.y1)) && h.pos[0] >= left.x0 - 1 && h.pos[0] <= left.x1 + 1);
    n = Math.max(n, new Set(fs.map((h) => Math.round(h.pos[2]))).size);
  }
  return n === 2 || n === 3 ? n : undefined;
}

/** Рафиксы Базиса у жёстких полок: точка — торец полки у стойки × нижняя пласть; сетка по глубине от торцов полки.
 *  Общая сетка — самая частая среди полок, у остальных — своя (per). confirmat — жёсткие полки без рафиксов (их крепёж не меняем).
 *  shelves — коробы полок снизу вверх (номера как в section.shelves), fixed — номера жёстких полок. */
export function rafixFromEtalon(ref: RefModule, shelves: B[], fixed: number[]): { rafix?: KitchenRafix; confirmat: number[]; notes: string[] } {
  const rf = ref.hardware.filter((h) => h.category === "рафикс"), notes: string[] = [];
  if (!rf.length) return { confirmat: [], notes };
  const grids = new Map<number, RafixGrid>(), confirmat: number[] = [];
  for (const j of fixed) {
    const b = shelves[j]; if (!b) continue;
    // рафикс полки — у её торца (не у вставки/фронтальной панели на той же высоте, k18 m08)
    const mine = rf.filter((h) => Math.abs(h.pos[1] - b.y0) < 1 && (Math.abs(h.pos[0] - b.x0) < 1 || Math.abs(h.pos[0] - b.x1) < 1) && h.pos[2] >= b.z0 - 1 && h.pos[2] <= b.z1 + 1);
    if (!mine.length) { confirmat.push(j); continue; }
    // сторона с большим числом точек (у Базиса обе стороны одинаковые; k27 m13 — разные, берём левую)
    const left = mine.filter((h) => h.pos[0] < (b.x0 + b.x1) / 2), right = mine.filter((h) => h.pos[0] >= (b.x0 + b.x1) / 2);
    const zs = (left.length >= right.length ? left : right).map((h) => h.pos[2]).sort((a, c) => a - c);
    const g: RafixGrid = { rear: r1(zs[0] - b.z0), front: r1(b.z1 - zs[zs.length - 1]), n: zs.length };
    const even = rafixZs(g, b.z0, b.z1).every((z, k) => Math.abs(z - zs[k]) < 0.6);
    if (!even) notes.push(`рафиксы полки ${j + 1}: шаг неравный (${zs.map((z) => r1(z - b.z0)).join(", ")})`);
    if (left.length !== right.length || left.some((h, k) => Math.abs(h.pos[2] - (right[k]?.pos[2] ?? h.pos[2])) > 0.6)) notes.push(`рафиксы полки ${j + 1}: стороны разные (${left.length}/${right.length})`);
    grids.set(j, g);
  }
  if (!grids.size) return { confirmat: [], notes };
  const key = (g: RafixGrid) => `${g.rear}|${g.front}|${g.n}`, freq = new Map<string, number>();
  for (const g of grids.values()) freq.set(key(g), (freq.get(key(g)) ?? 0) + 1);
  const top = [...freq].sort((a, c) => c[1] - a[1])[0][0], base = [...grids.values()].find((g) => key(g) === top)!;
  const per = Object.fromEntries([...grids].filter(([, g]) => key(g) !== top).map(([j, g]) => [String(j), g]));
  return { rafix: { ...base, ...(Object.keys(per).length ? { per } : {}) }, confirmat, notes };
}

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
  const fxBox = (name: string) => /ящика/i.test(name) && ref.hardware.some((h) => /Firmax/.test(h.name)); // короб ящика Firmax — не царга и не полка
  const railsEdge = P.filter(({ p, b }) => p.axis === "z" && board(p.kind) && b.z1 <= sideZ1 + 0.5 && b.y1 - b.y0 <= 160 && b.x0 >= left.b.x1 - 0.5 && b.x1 <= right.b.x0 + 0.5 && !fronts.some((f) => f.b === b) && !/выдв/i.test(p.name) && !fxBox(p.name));
  const shelves = horiz.filter((h) => h !== bottom && h !== topPanel && !rails.includes(h) && !/выдв/i.test(h.p.name) && !fxBox(h.p.name)); // дно ящика — не полка

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
    // ряды опор Базиса бывают сдвинуты на 1 мм (k25 m10: зад 69/531, перед 70/530) — это те же позиции по ширине, а не 4 опоры в ряду
    const xs = clusterLegXs(legs.map((l) => l.pos[0]));
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
    const tallRows = role === "tall" && rowYs.length === 2 && !m.kdrawers;
    const upOver = tallRows && upRow.length ? r1(Math.max(...upRow.map((q) => q.b.y1)) - top) : 0;
    const rowsOk = tallRows && upOver <= 20 && lowRow.length === upRow.length && lowRow.length <= 2 && rowsGap > -0.5;
    const niche = rowsOk && rowsGap > 10 ? nicheFromRows(lowRow.map((q) => q.b), upRow.map((q) => q.b)) : undefined;
    const split = rowsOk && rowsGap <= 10;
    // 3+ ряда распашных у пенала: все фасады — двери (на петлях), верхний ряд в пределах корпуса
    const allRows = rowYs.map(inRow), topOver = fronts.length ? r1(Math.max(...fronts.map((q) => q.b.y1)) - top) : 0;
    const multi = role === "tall" && rowYs.length >= 3 && rowYs.length <= 5 && !m.kdrawers && topOver <= 20 && hw("петля").length > 0 && !hw("направляющая").length && !fronts.some((q) => /^Фронтал/i.test(q.p.name)) ? doorRowsFromFronts(allRows.map((r) => r.map((q) => q.b))) : undefined;
    if (niche) {
      // ниша под технику (духовка/СВЧ) между рядами распашных: нижний ряд — doorSplit, ниша — doorNiche, зазор створок — faceGapBetween
      m.faceGapBetween = niche.gap;
      m.sections[0].doorSplit = niche.split;
      m.sections[0].doorNiche = niche.niche;
      notes.push(`ниша под технику ${niche.niche} мм между рядами фасадов`);
    } else if (tallRows && upOver > 20) unsupported.push(`фасады пенала выше боковин на ${upOver} мм (пенал из нескольких корпусов) — пока не поддержано`);
    else if (tallRows && rowsGap > 10) unsupported.push(`ниша под технику между фасадами ${r1(rowsGap)} мм (пенал под духовку/СВЧ), ряды фасадов разные — пока не поддержано`);
    else if (split) {
      const gapY = r1(upRow[0].b.y0 - lowRow[0].b.y1);
      m.sections[0].doorSplit = r1(lowRow[0].b.y1 + gapY / 2 - lowRow[0].b.y0); // от низа нижнего фасада до середины зазора между рядами
      if (lowRow.length === 1) m.faceGapBetween = gapY;
    } else if (multi) {
      // пенал в 3+ ряда распашных: нижний — doorSplit, средние — doorRows, верхний — до верха; ниша над нижним — doorNiche
      m.faceGapBetween = multi.gap;
      m.sections[0].doorSplit = multi.split;
      if (multi.niche !== undefined) m.sections[0].doorNiche = multi.niche;
      m.sections[0].doorRows = multi.rows;
      notes.push(`фасады в ${rowYs.length} ряда: средние ${multi.rows.join(", ")}${multi.niche !== undefined ? `, ниша ${multi.niche}` : ""}`);
    } else if (rows.size > 1 && !m.kdrawers) unsupported.push(`фасады в ${rows.size} ряда (ящики/антресоль) — распознаватель пока только для одного ряда распашных`);
    const perRow = split || niche || multi ? lowRow.length : fronts.length;
    // пенал без петель в Базисе, но с дверями (k23 «Пустой»): двери есть, петель нет — не добавляем их (hingeless)
    const bareDoors = role === "tall" && !doors.length && !m.kdrawers && !hw("направляющая").length && fronts.every((q) => /^Дверь/i.test(q.p.name));
    m.doors = doors.length > 0 || bareDoors;
    if (role === "tall" && m.doors) {
      const rowsB = (m.sections[0].doorSplit !== undefined ? rowYs.map(inRow) : [fronts]).map((r) => r.map((q) => q.b));
      const hl = hingelessDoors(rowsB, hw("петля"));
      if (hl.length) { m.sections[0].hingeless = hl; notes.push(`фасады без петель (как в Базисе): ${hl.join(", ")}`); }
    }
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
  const sh = [...shelves, ...glassSh].sort((a, c) => a.b.y0 - c.b.y0), looseBare: number[] = [];
  m.sections[0].shelves = sh.map((s) => (s.b.y0 + s.b.y1) / 2).map((cy) => (cy - innerBottom) / (innerTop - innerBottom));
  const gl = sh.map((s, j) => (glassSh.includes(s) ? j : -1)).filter((j) => j >= 0);
  if (gl.length) { m.sections[0].glassShelves = gl; m.glassT = r1(glassSh[0].b.y1 - glassSh[0].b.y0); m.glassGap = r1(glassSh[0].b.x0 - left.b.x1); }
  if (sh.length) {
    const s0 = sh[0], rear = m.backType === "groove" ? (m.grooveInset ?? 16) + 3 + 1 : 0;
    m.sections[0].shelfDepth = r1(s0.b.z1 - s0.b.z0);
    m.shelfRear = r1(s0.b.z0 - sideZ0 - rear);
    const pins = hw("полкодержатель").filter((h) => Math.abs(h.pos[1] - s0.b.y0) < 2);
    if (pins.length) m.shelfPinInset = r1(Math.min(...pins.map((h) => h.pos[2] - s0.b.z0)));
    const noPins = sh.map((s, j) => (hw("полкодержатель").some((h) => Math.abs(h.pos[1] - s.b.y0) < 2) ? -1 : j)).filter((j) => j >= 0);
    // полка с зазорами у стоек (как съёмная), но без полкодержателей и крепежа в Базисе (k23 «Пустой») — съёмная без фурнитуры, не жёсткая
    looseBare.push(...noPins.filter((j) => !glassSh.includes(sh[j]) && sh[j].b.x0 - left.b.x1 >= 0.9 && right.b.x0 - sh[j].b.x1 >= 0.9 && bareShelvesFromEtalon(ref, sh.map((q) => q.b), [j]).length > 0));
    const fixed = noPins.filter((j) => !looseBare.includes(j));
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
  // фиксированные полки пенала (ниши под технику, разрез фасадов): эксцентрик + шкант, как у крыши — по фурнитуре Базиса у каждой стороны
  for (const j of m.sections[0].fixed ?? []) {
    const q = sh[j];
    if (!q) continue;
    for (const [side, sx] of [["left", left.b.x1], ["right", right.b.x0]] as const)
      if (ecc.some((h) => Math.abs(h.pos[0] - sx) < 1 && h.pos[1] >= q.b.y0 - 1 && h.pos[1] <= q.b.y1 + 1)) (m.jointFastening ??= {})[`${m.sections[0].id}:shelf:${j}:${side}`] = "eccentric";
  }
  // рафиксы жёстких полок (Базис): сетка по полкам; жёсткие полки на конфирматах при этом — явно в jointFastening
  const rfx = rafixFromEtalon(ref, sh.map((q) => q.b), m.sections[0].fixed ?? []);
  if (rfx.rafix) {
    m.kitchen.rafix = rfx.rafix;
    for (const j of rfx.confirmat) for (const side of ["left", "right"] as const) {
      const key = `${m.sections[0].id}:shelf:${j}:${side}`;
      if (!m.jointFastening?.[key]) (m.jointFastening ??= {})[key] = "confirmat";
    }
  }
  notes.push(...rfx.notes);
  // жёсткие полки без крепежа в Базисе — студия его не добавляет
  const bare = [...bareShelvesFromEtalon(ref, sh.map((q) => q.b), m.sections[0].fixed ?? []), ...looseBare].sort((a, c) => a - c);
  if (bare.length) { m.kitchen.bareShelves = bare; notes.push(`жёсткие полки без крепежа (как в Базисе): ${bare.map((j) => j + 1).join(", ")}`); }
  if (m.jointFastening && dow.length && ecc.length) {
    const e0 = ecc[0], d0 = dow.filter((d) => Math.abs(d.pos[1] - e0.pos[1]) < 10).sort((a, c) => Math.abs(a.pos[2] - e0.pos[2]) - Math.abs(c.pos[2] - e0.pos[2]))[0];
    if (d0) m.dowels = { offset: r1(Math.abs(d0.pos[2] - e0.pos[2])) };
  }
  // крепёж дна/крыши: отступ конфирматов от концов стыка (снизу через дно — у дна под боковинами; через боковину — в пределах толщины дна/крыши)
  const conf = [...hw("конфирмат"), ...ecc].filter((h) => [bottom, topPanel].some((q) => q && (Math.abs(h.pos[1] - q.b.y0) < 1 || (h.pos[1] > q.b.y0 && h.pos[1] < q.b.y1))));
  const host0 = bottom ?? topPanel;
  if (conf.length && host0) m.confirmatInset = r1(Math.min(...conf.map((h) => h.pos[2] - host0.b.z0)));
  // точек крепежа на стык дна/крыши (2 или 3) — своё число, если не совпадает с правилом kitchenJointPoints
  const jp = jointPointsFromEtalon(ref, [bottom?.b, topPanel?.b], left.b);
  if (jp && jp !== (d > 600 ? 3 : 2)) m.kitchen.jointPoints = jp;
  // своя сетка крепежа у стыков, где Базис поставил его иначе, чем у модуля (k23: крыша 104,5/64,5 при 64,5/64,5 у дна)
  if (m.confirmatInset !== undefined) {
    const nDef = jp ?? (d > 600 ? 3 : 2), ins = m.confirmatInset, hosts: [string, B][] = [];
    if (bottom) hosts.push(["bottom", bottom.b]);
    if (topPanel) hosts.push(["top", topPanel.b]);
    for (const j of m.sections[0].fixed ?? []) if (sh[j] && !m.kitchen.bareShelves?.includes(j) && !(m.kitchen.rafix && !rfx.confirmat.includes(j))) hosts.push([`shelf:${j}`, sh[j].b]);
    const grids = jointGridsFromEtalon(ref, hosts, left.b, right.b);
    const own = Object.entries(grids).filter(([k, g]) => Math.abs(g.rear - ins) > 0.6 || Math.abs(g.front - ins) > 0.6 || g.n !== (k.startsWith("shelf:") ? 2 : nDef));
    if (own.length) m.kitchen.joints = Object.fromEntries(own);
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
