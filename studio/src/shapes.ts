// Фигурные детали (задача Макса 29.10.2026, ветка claude/fix-shapes): общий механизм контура детали и функции на нём —
//  1) вырезы в деталях корпуса и фасадах (прямоугольный: внутри, у кромки, в углу; круглый под трубу/кабель);
//  2) шкаф с мансардой назад: наклонная крыша, боковины и перегородки трапецией, задник по задней высоте;
//  3) открытый стеллаж с радиусными полками (четверть круга / скругление внешнего угла).
// Контур детали (Part.shape) — многоугольник в плоскости детали (u, v) от угла габарита, выдавленный по оси w на size[w];
// сцена рисует его одной функцией (boardGeometry.shapeGeometry). В раскрой деталь идёт по габариту с пометкой «фигурная»;
// кромка по вырезу/дуге — Part.cutEdge / Part.curveEdge, работа — Part.cutWork (pricing.ts: «Вырез / сложный выпил», «Кромка по кривой»).
import { RULES, boxes, plinth, type Module, type Part } from "./model";
import { setEdges } from "./edges";

export type Pt = [number, number];
export type Axis = 0 | 1 | 2;
/** Контур детали: outline и holes — в (u, v) от угла габарита (мм), CCW; выдавлен по w на size[w]. */
export type PartShape = { axes: { u: Axis; v: Axis; w: Axis }; outline: Pt[]; holes: Pt[][] };
/** Вырез в детали/фасаде (Module.cutouts): host — id детали; rect — w×h, отступы u/v от выбранных краёв до ближней стороны выреза;
 *  round — диаметр w, отступы u/v до центра. fromU/fromV — от какого края считать (min — левый/нижний/задний, max — правый/верхний/передний). */
export type Cutout = { id: string; host: string; shape: "rect" | "round"; w: number; h: number; u: number; v: number; fromU: "min" | "max"; fromV: "min" | "max";
  /** Кромка по контуру выреза: true/false — явно; нет — по правилу (фасад и вырез у кромленого края — да, отверстие в корпусе — нет). */
  edge?: boolean; /** подпись менеджера: «под трубу», «под плинтус»… */ label?: string };

const AX = ["x", "y", "z"] as const;
/** Ось толщины детали: размер, равный толщине (при нескольких — меньший), иначе наименьший. */
export function thinAxis(p: Pick<Part, "size" | "thickness">): Axis {
  const hits = ([0, 1, 2] as Axis[]).filter((i) => Math.abs(p.size[i] - p.thickness) < 0.01);
  const list = hits.length ? hits : ([0, 1, 2] as Axis[]);
  return list.reduce((a, b) => (p.size[b] < p.size[a] ? b : a));
}
/** Оси плоскости детали: u — ширина вида, v — высота вида, w — толщина (сторона, с которой смотрит менеджер). */
export function faceAxes(p: Pick<Part, "size" | "thickness" | "shape">): { u: Axis; v: Axis; w: Axis } {
  if (p.shape) return p.shape.axes;
  const t = thinAxis(p);
  return t === 0 ? { u: 2, v: 1, w: 0 } : t === 1 ? { u: 0, v: 2, w: 1 } : { u: 0, v: 1, w: 2 };
}
/** Подписи краёв по оси (для панели вырезов): min — «слева/снизу/сзади», max — «справа/сверху/спереди». */
export const EDGE_WORDS: Record<Axis, { min: string; max: string; along: string; lo: string; hi: string }> = {
  0: { min: "левого края", max: "правого края", along: "по ширине", lo: "слева", hi: "справа" },
  1: { min: "низа", max: "верха", along: "по высоте", lo: "низ", hi: "верх" },
  2: { min: "заднего края", max: "переднего края", along: "по глубине", lo: "сзади", hi: "спереди" },
};

const area = (pl: Pt[]) => pl.reduce((s, [x, y], i) => { const [a, b] = pl[(i + 1) % pl.length]; return s + x * b - a * y; }, 0) / 2;
const ccw = (pl: Pt[]) => (area(pl) < 0 ? [...pl].reverse() : pl);
function convex(pl: Pt[]) {
  let sign = 0;
  for (let i = 0; i < pl.length; i++) {
    const [a, b, c] = [pl[i], pl[(i + 1) % pl.length], pl[(i + 2) % pl.length]];
    const z = (b[0] - a[0]) * (c[1] - b[1]) - (b[1] - a[1]) * (c[0] - b[0]);
    if (Math.abs(z) < 1e-9) continue;
    if (sign && Math.sign(z) !== sign) return false;
    sign = Math.sign(z);
  }
  return true;
}
function inside(pl: Pt[], [x, y]: Pt) {
  let r = false;
  for (let i = 0, j = pl.length - 1; i < pl.length; j = i++) {
    const [xi, yi] = pl[i], [xj, yj] = pl[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) r = !r;
  }
  return r;
}
function segDist([x, y]: Pt, [ax, ay]: Pt, [bx, by]: Pt) {
  const dx = bx - ax, dy = by - ay, L = dx * dx + dy * dy, k = L ? Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / L)) : 0;
  return Math.hypot(x - ax - k * dx, y - ay - k * dy);
}
const edgeDist = (pl: Pt[], p: Pt) => Math.min(...pl.map((a, i) => segDist(p, a, pl[(i + 1) % pl.length])));
/** Отсечение многоугольника (CCW) выпуклым многоугольником (CCW) — Сазерленд–Ходжмен. */
export function clipConvex(subject: Pt[], clip: Pt[]): Pt[] {
  let out = subject;
  for (let i = 0; i < clip.length && out.length; i++) {
    const a = clip[i], b = clip[(i + 1) % clip.length], input = out;
    const side = (p: Pt) => (b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0]);
    const cut = (p: Pt, q: Pt): Pt => { const sp = side(p), sq = side(q), k = sp / (sp - sq); return [p[0] + k * (q[0] - p[0]), p[1] + k * (q[1] - p[1])]; };
    out = [];
    for (let j = 0; j < input.length; j++) {
      const p = input[j], q = input[(j + 1) % input.length], ip = side(p) >= -1e-9, iq = side(q) >= -1e-9;
      if (ip) { out.push(p); if (!iq) out.push(cut(p, q)); } else if (iq) out.push(cut(p, q));
    }
  }
  return simplify(out);
}
/** Убрать повторы и точки на прямой. */
function simplify(pl: Pt[]): Pt[] {
  let pts = pl.filter((p, i) => { const q = pl[(i + 1) % pl.length]; return Math.hypot(p[0] - q[0], p[1] - q[1]) > 1e-6; });
  let changed = true;
  while (changed && pts.length > 3) {
    changed = false;
    for (let i = 0; i < pts.length; i++) {
      const a = pts[(i + pts.length - 1) % pts.length], b = pts[i], c = pts[(i + 1) % pts.length];
      if (Math.abs((b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0])) < 1e-6) { pts = pts.filter((_, k) => k !== i); changed = true; break; }
    }
  }
  return pts;
}
/** Габарит без прямоугольных выборок (угол/кромка): контур клеток сетки; несколько контуров — деталь разрезана. */
function rectMinus(U: number, V: number, cuts: { u0: number; u1: number; v0: number; v1: number }[]): Pt[][] {
  const xs = [...new Set([0, U, ...cuts.flatMap((c) => [c.u0, c.u1]).map((x) => Math.max(0, Math.min(U, x)))])].sort((a, b) => a - b);
  const ys = [...new Set([0, V, ...cuts.flatMap((c) => [c.v0, c.v1]).map((y) => Math.max(0, Math.min(V, y)))])].sort((a, b) => a - b);
  const I = xs.length - 1, J = ys.length - 1;
  const cell = (i: number, j: number) => i >= 0 && j >= 0 && i < I && j < J && !cuts.some((c) => { const x = (xs[i] + xs[i + 1]) / 2, y = (ys[j] + ys[j + 1]) / 2; return x > c.u0 && x < c.u1 && y > c.v0 && y < c.v1; });
  const next = new Map<string, [number, number][]>(), key = (i: number, j: number) => i + "," + j;
  const push = (a: [number, number], b: [number, number]) => { const k = key(...a); next.set(k, [...(next.get(k) ?? []), b]); };
  for (let i = 0; i < I; i++) for (let j = 0; j < J; j++) {
    if (!cell(i, j)) continue;
    if (!cell(i, j - 1)) push([i, j], [i + 1, j]);
    if (!cell(i + 1, j)) push([i + 1, j], [i + 1, j + 1]);
    if (!cell(i, j + 1)) push([i + 1, j + 1], [i, j + 1]);
    if (!cell(i - 1, j)) push([i, j + 1], [i, j]);
  }
  const loops: Pt[][] = [];
  for (;;) {
    const start = [...next.entries()].find(([, v]) => v.length)?.[0];
    if (!start) break;
    const loop: Pt[] = [];
    let at = start;
    for (let guard = 0; guard < 10000; guard++) {
      const list = next.get(at)!;
      if (!list?.length) break;
      const [i, j] = at.split(",").map(Number);
      loop.push([xs[i], ys[j]]);
      const to = list.shift()!;
      at = key(...to);
      if (at === start) break;
    }
    loops.push(simplify(loop));
  }
  return loops.filter((l) => l.length >= 3 && Math.abs(area(l)) > 1);
}
/** Базовый контур детали в (u, v) от угла габарита: прямоугольник, трапеция, контур Базиса; null — на такой детали вырез не делается. */
export function basePolygon(p: Part): { poly: Pt[]; rect: boolean } | null {
  const ax = faceAxes(p), U = p.size[ax.u], V = p.size[ax.v];
  // контур, выдавленный не по толщине (наклонная крыша мансарды), — вырез в плоскости детали не задаётся
  if (p.shape) return Math.abs(p.size[p.shape.axes.w] - p.thickness) > 0.01 ? null : { poly: p.shape.outline, rect: false };
  if (p.golaCuts?.length || p.rearNotch || p.topNotches || p.planHoles?.length || p.rotY || p.rotZ || p.model || p.vernissage || p.material === "alu" || p.material === "glass" || p.external) return null;
  if (p.faceContour) return { poly: ccw(p.faceContour.map(([a, b]) => (ax.w === 0 ? [b, a] : [a, b]) as Pt)), rect: false };
  if (p.taper && ax.w === 2) return { poly: [[0, 0], [U, 0], [U, p.taper[1]], [0, p.taper[0]]], rect: false };
  if (p.planContour && ax.w === 1) return { poly: ccw(p.planContour.map(([a, b]) => [a, b] as Pt)), rect: false };
  if (p.taperZ && ax.w === 1) return { poly: [[0, 0], [U, 0], [U, p.taperZ[1]], [0, p.taperZ[0]]], rect: false };
  return { poly: [[0, 0], [U, 0], [U, V], [0, V]], rect: true };
}
type Rect = { u0: number; u1: number; v0: number; v1: number };
/** Вырез в координатах плоскости детали. */
export function resolveCut(c: Cutout, U: number, V: number): ({ kind: "rect" } & Rect) | { kind: "round"; cu: number; cv: number; r: number } {
  if (c.shape === "round") return { kind: "round", cu: c.fromU === "min" ? c.u : U - c.u, cv: c.fromV === "min" ? c.v : V - c.v, r: c.w / 2 };
  const u0 = c.fromU === "min" ? c.u : U - c.u - c.w, v0 = c.fromV === "min" ? c.v : V - c.v - c.h;
  return { kind: "rect", u0, u1: u0 + c.w, v0, v1: v0 + c.h };
}
const circle = (cu: number, cv: number, r: number, n = 48): Pt[] => Array.from({ length: n }, (_, i) => [cu + r * Math.cos((2 * Math.PI * i) / n), cv + r * Math.sin((2 * Math.PI * i) / n)] as Pt);
/** Мост материала: наименьшее расстояние от выреза до края детали и между вырезами, мм. */
export const CUT_BRIDGE = 10;
/** Мост у выборки по кромке: остаток детали за вырезом не меньше 30 мм. */
export const CUT_REST = 30;
export const isFacadePart = (p: Pick<Part, "role" | "id">) => p.role === "door" || p.id.endsWith(":facade") || p.id === "slope-filler";
const r1 = (v: number) => Math.round(v * 10) / 10;
const mm = (v: number) => String(r1(v)).replace(".", ",");
/** Подпись выреза для деталировки, бирки и сметы: «вырез 120×80 от низа 0, от заднего края 0», «Ø60 центр …». */
export function cutText(c: Cutout, ax: { u: Axis; v: Axis }): string {
  const fu = EDGE_WORDS[ax.u][c.fromU], fv = EDGE_WORDS[ax.v][c.fromV];
  const what = c.shape === "round" ? `отверстие Ø${mm(c.w)}, центр ${mm(c.u)} от ${fu}, ${mm(c.v)} от ${fv}` : `вырез ${mm(c.w)}×${mm(c.h)}, ${mm(c.u)} от ${fu}, ${mm(c.v)} от ${fv}`;
  return (c.label ? c.label + ": " : "") + what;
}
type Built = { outline: Pt[]; holes: Pt[][]; cutEdge: number; curveEdge: number; errors: string[]; notched: Partial<Record<"u0" | "u1" | "v0" | "v1", number>> };
/** Контур детали с вырезами и проверка: вырез не разрезает деталь, не выходит за неё без смысла, мост ≥ CUT_BRIDGE. */
export function buildCutShape(p: Part, cuts: Cutout[]): Built {
  const base = basePolygon(p), ax = faceAxes(p), U = p.size[ax.u], V = p.size[ax.v], errors: string[] = [];
  const out: Built = { outline: base?.poly ?? [], holes: p.shape?.holes ?? [], cutEdge: 0, curveEdge: 0, errors, notched: {} };
  if (!base) { errors.push(`«${p.name}»: на этой детали вырез не делается (фасад стороннего участка, алюминий, стекло или деталь Базиса с фрезеровкой).`); return out; }
  const poly = ccw(base.poly), isConvex = convex(poly);
  const notches: Rect[] = [], holes: Pt[][] = [], holeBoxes: (Rect & { n: number })[] = [];
  cuts.forEach((c, i) => {
    const n = i + 1, name = `«${p.name}», вырез ${n}`;
    if (!(c.w > 0) || (c.shape === "rect" && !(c.h > 0)) || ![c.u, c.v].every(Number.isFinite)) { errors.push(`${name}: задайте размеры больше 0.`); return; }
    const r = resolveCut(c, U, V);
    if (r.kind === "round") {
      if (!inside(poly, [r.cu, r.cv]) || edgeDist(poly, [r.cu, r.cv]) < r.r + CUT_BRIDGE) { errors.push(`${name}: отверстие Ø${mm(c.w)} выходит за край детали или ближе ${CUT_BRIDGE} мм к нему — сместите центр или уменьшите диаметр (под трубу у края — прямоугольный вырез по кромке).`); return; }
      holes.push(circle(r.cu, r.cv, r.r)); holeBoxes.push({ u0: r.cu - r.r, u1: r.cu + r.r, v0: r.cv - r.r, v1: r.cv + r.r, n });
      out.curveEdge += Math.PI * c.w; return;
    }
    if (r.u1 <= 0.01 || r.u0 >= U - 0.01 || r.v1 <= 0.01 || r.v0 >= V - 0.01) { errors.push(`${name}: вырез целиком вне детали ${mm(U)}×${mm(V)} — проверьте отступы.`); return; }
    const corners: Pt[] = [[r.u0, r.v0], [r.u1, r.v0], [r.u1, r.v1], [r.u0, r.v1]];
    const interior = corners.every((q) => inside(poly, q) && edgeDist(poly, q) >= CUT_BRIDGE - 1e-6);
    if (interior) { holes.push(corners); holeBoxes.push({ ...r, n }); out.cutEdge += 2 * (c.w + c.h); return; }
    if (r.u0 <= 0.01 && r.u1 >= U - 0.01 || r.v0 <= 0.01 && r.v1 >= V - 0.01) { errors.push(`${name}: вырез на всю ${r.u0 <= 0.01 && r.u1 >= U - 0.01 ? "ширину" : "высоту"} детали разрезает её — уменьшите вырез или измените размер детали.`); return; }
    const touches = r.u0 <= 0.01 || r.u1 >= U - 0.01 || r.v0 <= 0.01 || r.v1 >= V - 0.01;
    if (!touches && base.rect) { errors.push(`${name}: вырез ближе ${CUT_BRIDGE} мм к краю — сделайте его по кромке (отступ 0) или отодвиньте от края.`); return; }
    if (!touches) { errors.push(`${name}: у фигурной детали вырез у скошенного края не делается — только по прямой кромке (отступ 0) или внутри.`); return; }
    if (!isConvex) { errors.push(`${name}: у детали сложного контура — только вырез внутри детали.`); return; }
    // выборка от кромки v (низ/верх) оставляет над собой V − h материала, от кромки u — U − w
    const restU = U - (Math.min(U, r.u1) - Math.max(0, r.u0)), restV = V - (Math.min(V, r.v1) - Math.max(0, r.v0));
    if (restV < CUT_REST && (r.v0 <= 0.01 || r.v1 >= V - 0.01) || restU < CUT_REST && (r.u0 <= 0.01 || r.u1 >= U - 0.01)) { errors.push(`${name}: за вырезом остаётся меньше ${CUT_REST} мм детали — она сломается; уменьшите вырез.`); return; }
    notches.push(r);
  });
  // отверстия не сливаются друг с другом и с выборками по кромке
  for (let i = 0; i < holeBoxes.length; i++) {
    const a = holeBoxes[i];
    for (const b of holeBoxes.slice(i + 1)) if (a.u0 < b.u1 + CUT_BRIDGE && b.u0 < a.u1 + CUT_BRIDGE && a.v0 < b.v1 + CUT_BRIDGE && b.v0 < a.v1 + CUT_BRIDGE) errors.push(`«${p.name}»: вырезы ${a.n} и ${b.n} ближе ${CUT_BRIDGE} мм друг к другу — сделайте один общий вырез.`);
    for (const b of notches) if (a.u0 < b.u1 + CUT_BRIDGE && b.u0 < a.u1 + CUT_BRIDGE && a.v0 < b.v1 + CUT_BRIDGE && b.v0 < a.v1 + CUT_BRIDGE) errors.push(`«${p.name}»: вырез ${a.n} ближе ${CUT_BRIDGE} мм к выборке по кромке — сделайте один общий вырез.`);
  }
  if (notches.length) {
    const loops = rectMinus(U, V, notches);
    if (loops.length !== 1) { errors.push(`«${p.name}»: выборки по кромке разрезают деталь на части — уменьшите их.`); return out; }
    let outline = ccw(loops[0]);
    if (!base.rect) outline = clipConvex(outline, poly);
    if (outline.length < 3 || Math.abs(area(outline)) < 1) { errors.push(`«${p.name}»: после выреза от детали ничего не остаётся.`); return out; }
    // кромка по выборке — отрезки нового контура не на границе исходной детали; потерянная длина каждой прямой кромки габарита
    const onBase = (a: Pt, b: Pt) => poly.some((q, i) => segDist(a, q, poly[(i + 1) % poly.length]) < 0.01 && segDist(b, q, poly[(i + 1) % poly.length]) < 0.01);
    for (let i = 0; i < outline.length; i++) { const a = outline[i], b = outline[(i + 1) % outline.length]; if (!onBase(a, b)) out.cutEdge += Math.hypot(b[0] - a[0], b[1] - a[1]); }
    if (base.rect) {
      const along = (sel: (q: Pt) => boolean, k: 0 | 1) => outline.reduce((s, a, i) => { const b = outline[(i + 1) % outline.length]; return sel(a) && sel(b) ? s + Math.abs(b[k] - a[k]) : s; }, 0);
      const keep = { u0: along((q) => Math.abs(q[0]) < 0.01, 1), u1: along((q) => Math.abs(q[0] - U) < 0.01, 1), v0: along((q) => Math.abs(q[1]) < 0.01, 0), v1: along((q) => Math.abs(q[1] - V) < 0.01, 0) };
      for (const k of ["u0", "u1", "v0", "v1"] as const) { const full = k[0] === "u" ? V : U; if (keep[k] < full - 0.01) out.notched[k] = keep[k]; }
    }
    out.outline = outline;
  } else out.outline = poly;
  out.holes = [...out.holes, ...holes.map(ccw)];
  return out;
}
/** Толщина кромки по контуру выреза: фасад — кромка фасадов, корпус — кромка видимых торцов. */
const edgeT = (m: Module, p: Part) => (isFacadePart(p) ? m.edgeFacade ?? 2 : m.edgeBody ?? 2);
/** Вырезы модуля на деталях: контур, пометка «фигурная», кромка по вырезу и работа. Ошибки — в validate (cutoutErrors). */
export function applyCutouts(m: Module, out: Part[]): void {
  const by = new Map<string, Cutout[]>();
  for (const c of m.cutouts ?? []) by.set(c.host, [...(by.get(c.host) ?? []), c]);
  for (const [host, list] of by) {
    const p = out.find((q) => q.id === host);
    if (!p) continue;
    const b = buildCutShape(p, list);
    if (b.errors.length) continue;
    const ax = faceAxes(p), dirs = edgeDirections(ax);
    p.shape = { axes: ax, outline: b.outline, holes: b.holes };
    // кромка по вырезу: явно у выреза; по правилу — фасад, или выборка у кромленого края (видно), отверстие в корпусе — без кромки
    let straight = 0, curve = 0;
    list.forEach((c) => {
      const r = resolveCut(c, p.size[ax.u], p.size[ax.v]), facade = isFacadePart(p);
      const atEdge = r.kind === "rect" && (r.u0 <= 0.01 || r.u1 >= p.size[ax.u] - 0.01 || r.v0 <= 0.01 || r.v1 >= p.size[ax.v] - 0.01);
      const byRule = facade || (atEdge && r.kind === "rect" && (["u0", "u1", "v0", "v1"] as const).some((k) => { const hit = k === "u0" ? r.u0 <= 0.01 : k === "u1" ? r.u1 >= p.size[ax.u] - 0.01 : k === "v0" ? r.v0 <= 0.01 : r.v1 >= p.size[ax.v] - 0.01; return hit && (edgeOn(p, dirs[k]) ?? 0) >= 0.8; }));
      if (!(c.edge ?? byRule)) return;
      if (r.kind === "round") curve += Math.PI * c.w;
      else if (!atEdge) straight += 2 * (c.w + c.h);
      else { const u0 = Math.max(0, r.u0), u1 = Math.min(p.size[ax.u], r.u1), v0 = Math.max(0, r.v0), v1 = Math.min(p.size[ax.v], r.v1);
        // внутренние стороны выборки: те, что не на краю детали
        straight += (r.u0 > 0.01 ? v1 - v0 : 0) + (r.u1 < p.size[ax.u] - 0.01 ? v1 - v0 : 0) + (r.v0 > 0.01 ? u1 - u0 : 0) + (r.v1 < p.size[ax.v] - 0.01 ? u1 - u0 : 0); }
    });
    const t = edgeT(m, p);
    if (straight > 0) p.cutEdge = { len: r1(straight), t };
    if (curve > 0) p.curveEdge = { len: r1(curve), t };
    // прямая кромка габарита короче на выборку (смета и бирки берут edgeLen)
    for (const [k, len] of Object.entries(b.notched)) p.edgeLen = { ...(p.edgeLen ?? {}), [dirs[k as keyof typeof dirs]]: r1(len!) };
    p.cutWork = (p.cutWork ?? 0) + list.length;
    if (!p.name.includes("фигурная")) p.name += " · фигурная (вырез)";
    const note = list.map((c) => cutText(c, ax)).join("; ");
    p.shapeNote = [p.shapeNote, note].filter(Boolean).join("; ");
  }
}
/** Направления торцов габарита в осях модуля по краям плоскости детали. */
function edgeDirections(ax: { u: Axis; v: Axis }) { return { u0: "-" + AX[ax.u], u1: "+" + AX[ax.u], v0: "-" + AX[ax.v], v1: "+" + AX[ax.v] }; }
/** Толщина кромки торца детали по направлению ('+z' и т. п.). */
function edgeOn(p: Part, dir: string): number | undefined { const k = edgeIndex(p, dir); return k < 0 ? undefined : p.edge[k]; }
/** Ошибки вырезов модуля (validate): деталь не найдена, разрезана, вырез вне детали, отверстие у края, вырезы сливаются. */
export function cutoutErrors(m: Module, ps: Part[]): string[] {
  if (!m.cutouts?.length) return [];
  if (m.raw || m.kupe || m.worktop || m.corner || m.casework) return ["Вырезы — у корпусов и фасадов студии; у импорта Базиса, дверей купе, столешницы и углового шкафа вырезы задаются иначе."];
  const errors: string[] = [], by = new Map<string, Cutout[]>();
  for (const c of m.cutouts) {
    if (!c || typeof c.host !== "string" || !["rect", "round"].includes(c.shape)) { errors.push("Вырез: неверная запись — удалите его и задайте заново."); continue; }
    by.set(c.host, [...(by.get(c.host) ?? []), c]);
  }
  for (const [host, list] of by) {
    const p = ps.find((q) => q.id === host);
    if (!p) { errors.push(`Вырез: детали «${host}» в корпусе больше нет (полку убрали или перенумеровали) — удалите вырез в окне «Вырезы».`); continue; }
    errors.push(...buildCutShape(p, list).errors);
  }
  return errors;
}
/** Предупреждения (не ошибки): вырез задевает петлю, полкодержатель или крепёж — переставить фурнитуру или вырез. */
export function cutoutWarnings(m: Module, ps: Part[]): string[] {
  const out: string[] = [];
  (m.cutouts ?? []).forEach((c) => {
    const p = ps.find((q) => q.id === c.host);
    if (!p) return;
    const ax = faceAxes(p), r = resolveCut(c, p.size[ax.u], p.size[ax.v]), min = p.position.map((v, i) => v - p.size[i] / 2);
    const lo: number[] = [0, 0, 0], hi: number[] = [0, 0, 0];
    const [a0, a1, b0, b1] = r.kind === "rect" ? [r.u0, r.u1, r.v0, r.v1] : [r.cu - r.r, r.cu + r.r, r.cv - r.r, r.cv + r.r];
    lo[ax.u] = min[ax.u] + a0; hi[ax.u] = min[ax.u] + a1; lo[ax.v] = min[ax.v] + b0; hi[ax.v] = min[ax.v] + b1;
    lo[ax.w] = min[ax.w] - 2; hi[ax.w] = min[ax.w] + p.size[ax.w] + 2;
    const hits = ps.filter((q) => q.id !== p.id && (q.role === "hinge" || (q.role === "fastener" && /^(shp|fast|ecc|dowel|rafix):/.test(q.id)) || q.role === "handle")
      && [0, 1, 2].every((i) => q.position[i] - q.size[i] / 2 < hi[i] && q.position[i] + q.size[i] / 2 > lo[i]));
    if (!hits.length) return;
    const kinds = [...new Set(hits.map((q) => q.role === "hinge" ? "петлю" : q.id.startsWith("shp:") ? "полкодержатель" : q.role === "handle" ? "ручку" : "крепёж корпуса"))];
    out.push(`«${p.name}»: вырез ${(m.cutouts ?? []).filter((x) => x.host === c.host).indexOf(c) + 1} задевает ${kinds.join(", ")} — сместите вырез или фурнитуру.`);
  });
  return out;
}

// ─────────────────────────── Мансарда: скос потолка назад ───────────────────────────
/** Геометрия мансарды: высота спереди H (= высота модуля), сзади R; наружная линия крыши outer(z), нижняя пласть under(z). */
export function mansardGeom(m: Pick<Module, "height" | "depth" | "mansard">) {
  const t = RULES.panel, H = m.height, R = m.mansard!.rear, D = m.depth, drop = H - R, a = Math.atan2(drop, D), tv = t / Math.cos(a);
  const outer = (z: number) => R + (drop * z) / D;
  return { H, R, D, drop, angle: a, tv, outer, under: (z: number) => outer(z) - tv };
}
export const mansardAngleDeg = (m: Pick<Module, "height" | "depth" | "mansard">) => r1((mansardGeom(m).angle * 180) / Math.PI);
/** Задняя высота по углу скоса (градусы от горизонтали). */
export const mansardRearByAngle = (height: number, depth: number, deg: number) => Math.round(height - depth * Math.tan((deg * Math.PI) / 180));
export const MANSARD = { minRear: 400, minDrop: 50, maxAngle: 60 };
/** Ступени (точные коробки для проверки пересечений) наклонной детали: по z от z0 до z1, y — между lo(z) и hi(z), консервативно внутрь. */
function steps(x0: number, x1: number, z0: number, z1: number, lo: (z: number) => number, hi: (z: number) => number, n: number): Part["collide"] {
  const out: NonNullable<Part["collide"]> = [];
  for (let k = 0; k < n; k++) {
    const a = z0 + ((z1 - z0) * k) / n, b = z0 + ((z1 - z0) * (k + 1)) / n, y0 = Math.max(lo(a), lo(b)), y1 = Math.min(hi(a), hi(b));
    if (y1 - y0 > 0.2) out.push({ size: [x1 - x0, y1 - y0, b - a], position: [(x0 + x1) / 2, (y0 + y1) / 2, (a + b) / 2] });
  }
  return out;
}
/** Мансарда назад (Module.mansard): крыша наклонная (спереди H, сзади R), боковины и перегородки — трапеции, задник — по задней высоте;
 *  крепёж крыши и подсветка под ней — по наклону. Полки, штанги и ящики не двигаются — выше скоса предупреждение (mansardWarnings). */
export function applyMansard(m: Module, out: Part[]): void {
  if (!m.mansard) return;
  const t = RULES.panel, g = mansardGeom(m), { H, R, D, drop, tv } = g, deg = mansardAngleDeg(m), W = m.width;
  const top = out.find((p) => p.id === "top");
  if (top) {
    const n = Math.max(8, Math.ceil(drop / Math.max(1, tv - 2)) + 2);
    Object.assign(top, {
      name: `Крыша · мансарда, уклон ${String(deg).replace(".", ",")}°`,
      size: [W - 2 * t, drop + tv, D], position: [W / 2, R - tv + (drop + tv) / 2, D / 2],
      width: Math.round(D / Math.cos(g.angle) + t * Math.tan(g.angle)),
      shape: { axes: { u: 2, v: 1, w: 0 }, outline: [[0, 0], [D, drop], [D, drop + tv], [0, tv]], holes: [] },
      collide: steps(t, W - t, 0, D, g.under, g.outer, n),
      shapeNote: `торцы спереди и сзади под углом ${String(deg).replace(".", ",")}° (крыша наклонная)`,
    } satisfies Partial<Part>);
  }
  for (const id of ["left", "right"]) {
    const p = out.find((q) => q.id === id);
    if (!p) continue;
    const y0 = p.position[1] - p.size[1] / 2;
    p.shape = { axes: { u: 2, v: 1, w: 0 }, outline: [[0, 0], [D, 0], [D, H - y0], [0, R - y0]], holes: [] };
    p.edgeLen = { ...(p.edgeLen ?? {}), "+y": r1(Math.hypot(D, drop)), "-z": r1(R - y0) };
    p.name += " · трапеция (мансарда)";
    p.shapeNote = `трапеция: спереди ${mm(H - y0)}, сзади ${mm(R - y0)}, скос ${String(deg).replace(".", ",")}°`;
  }
  // перегородки: верх по нижней пласти крыши; ступени — для проверки пересечений
  for (const p of out.filter((q) => q.role === "body" && /:divider$/.test(q.id))) {
    const z0 = p.position[2] - p.size[2] / 2, z1 = z0 + p.size[2], y0 = p.position[1] - p.size[1] / 2, y1 = y0 + p.size[1];
    if (g.under(z0) >= y1 - 0.01) continue;
    const poly = clipConvex([[z0, y0], [z1, y0], [z1, y1], [z0, y1]], [[z0 - 1, -1e5], [z1 + 1, -1e5], [z1 + 1, g.under(z1 + 1)], [z0 - 1, g.under(z0 - 1)]]);
    if (poly.length < 3) continue;
    const top2 = Math.max(...poly.map((q) => q[1]));
    p.size = [p.size[0], top2 - y0, p.size[2]]; p.position = [p.position[0], (y0 + top2) / 2, p.position[2]]; p.length = r1(top2 - y0);
    p.shape = { axes: { u: 2, v: 1, w: 0 }, outline: ccw(poly.map(([z, y]) => [z - z0, y - y0] as Pt)), holes: [] };
    p.collide = steps(p.position[0] - t / 2, p.position[0] + t / 2, z0, z1, () => y0, (z) => Math.min(y1, g.under(z)), Math.max(6, Math.ceil(drop / 8)));
    p.name += " · трапеция (мансарда)";
    p.shapeNote = `трапеция: спереди ${mm(Math.min(y1, g.under(z1)) - y0)}, сзади ${mm(Math.min(y1, g.under(z0)) - y0)}`;
  }
  // задник — по задней высоте (набивной — до наружной линии, в пазу — в паз крыши, ЛДСП — под крышу)
  const back = out.find((p) => p.id === "back");
  if (back) {
    const zb = back.position[2] - back.size[2] / 2, y0 = back.position[1] - back.size[1] / 2;
    const limit = m.backType === "groove" ? g.under(zb) + (m.grooveDepth ?? 8) - (m.grooveClear ?? 0.5) : m.backType === "board" ? g.under(Math.max(0, zb)) : R - (m.backGap ?? 2);
    if (y0 + back.size[1] > limit) { const h = limit - y0; back.size = [back.size[0], h, back.size[2]]; back.position = [back.position[0], y0 + h / 2, back.position[2]]; back.length = r1(h); back.name += " · по задней высоте (мансарда)"; }
  }
  // крепёж крыши — по её наклонной оси; крепёж верха перегородок и подсветка под крышей — по нижней пласти
  const shift = (p: Part, dy: number) => { p.position = [p.position[0], p.position[1] + dy, p.position[2]]; if (p.anchor) p.anchor = [p.anchor[0], p.anchor[1] + dy, p.anchor[2]]; if (p.model?.origin) p.model = { ...p.model, origin: [p.model.origin[0], p.model.origin[1] + dy, p.model.origin[2]] }; };
  for (const p of out) {
    const z = p.model?.origin?.[2] ?? p.position[2];
    if ((p.role === "fastener" || p.role === "hinge") && /^(fast|ecc|dowel|rafix):top:/.test(p.id)) shift(p, g.outer(z) - tv / 2 - (H - t / 2));
    else if (p.role === "fastener" && /:divider:top:/.test(p.id)) shift(p, Math.min(0, g.under(z) - (H - t)));
    else if (p.role === "light" && p.id.endsWith(":light:roof")) shift(p, g.under(p.position[2] - p.size[2] / 2) - (H - t));
  }
}
/** Наполнение выше скоса мансарды: полка, штанга, пантограф, короб ящика у задней кромки выше нижней пласти крыши — деталь проходит
 *  сквозь крышу: ОШИБКА модели, как любое пересечение деталей (критик 29.10, блокер 4; раньше — только предупреждение), с кнопкой
 *  «Опустить полки под скос». Штанга ниже крыши, но без места под плечики (50 мм) — предупреждение. Держатели штанги (выше самой
 *  штанги) — тоже деталь наполнения (круг 2 критика 29.10: штанга на 0,9 при задней высоте 2000 — держатели на 15 мм в крыше без ошибки). */
export function mansardIntrusions(m: Module, ps: Part[]): { part: Part; over: number; error: boolean }[] {
  if (!m.mansard) return [];
  const g = mansardGeom(m), out: { part: Part; over: number; error: boolean }[] = [];
  for (const p of ps) {
    if (!(p.role === "shelf" || p.role === "rod" || p.role === "flange" || p.role === "pantograph" || (p.role === "drawer" && /:drawer:\d+:(back|left)$/.test(p.id)))) continue;
    const body = p.position[1] + p.size[1] / 2, rear = p.position[2] - p.size[2] / 2, under = g.under(rear);
    if (body - under > 0.5) out.push({ part: p, over: Math.ceil(body - under), error: true });
    else if (p.role === "rod" && body + 50 - under > 0.5) out.push({ part: p, over: Math.ceil(body + 50 - under), error: false });
  }
  return out;
}
const intrusionText = (x: { part: Part; over: number; error: boolean }) => x.error
  ? `«${x.part.name.replace(/ · .*$/, "")}» выше скоса мансарды на ${x.over} мм у задней кромки — пересекает крышу. Нажмите «Опустить полки под скос» или уменьшите глубину.`
  : `«${x.part.name.replace(/ · .*$/, "")}» выше скоса мансарды на ${x.over} мм у задней кромки (с местом под плечики 50 мм) — опустите её или уменьшите глубину.`;
/** Ошибки мансарды по деталям (validate): наполнение сквозь наклонную крышу. */
export function mansardFitErrors(m: Module, ps: Part[]): string[] {
  return [...new Set(mansardIntrusions(m, ps).filter((x) => x.error).map(intrusionText))];
}
/** Что выше скоса мансарды для панели «Фигурные детали»: ошибки (сквозь крышу) и предупреждения (штанга без места под плечики). */
export function mansardWarnings(m: Module, ps: Part[]): string[] {
  return [...new Set(mansardIntrusions(m, ps).map(intrusionText))];
}
/** Ошибки мансарды (validate). */
export function mansardErrors(m: Module): string[] {
  if (!m.mansard) return [];
  const e: string[] = [], R = m.mansard.rear;
  if (m.kitchen || m.raw || m.corner || m.desk || m.casework || m.kupe || m.kupeZone || m.kupeBody || m.worktop || m.radius) e.push("Мансарда (скос назад) — у прямого шкафа или стеллажа студии.");
  if (m.slope || m.skew) e.push("Мансарда (скос назад) вместе со скосом влево/вправо или скосом фронта не делается — выберите один скос.");
  if (m.topGlass || m.seatTop || m.seatPanel || m.topType === "none") e.push("Мансарда: крыша — ЛДСП 16 (не стекло, не сиденье и не без крыши).");
  if (m.sectionLayout || m.hanging) e.push("Мансарда: у составных проёмов и навесного шкафа скос назад не делается.");
  if ((m.rails ?? []).some((r) => r.place.endsWith("top"))) e.push("Мансарда: верхние стяжки под наклонной крышей не ставятся — уберите их.");
  if (!Number.isFinite(R) || R < MANSARD.minRear || R > m.height - MANSARD.minDrop) e.push(`Мансарда: высота сзади от ${MANSARD.minRear} до ${m.height - MANSARD.minDrop} мм (спереди — ${m.height}).`);
  else if (mansardAngleDeg(m) > MANSARD.maxAngle) e.push(`Мансарда: скос круче ${MANSARD.maxAngle}° — увеличьте высоту сзади или глубину.`);
  return e;
}

// ─────────────────────────── Стеллаж с радиусными полками ───────────────────────────
export const RADIUS = { min: 50, minW: 250, maxW: 1000, minD: 250, maxD: 700, plinthRecess: 50 };
/** Наибольший радиус скругления у стеллажа: до глубины/ширины полки (четверть круга). */
export const radiusMax = (m: Pick<Module, "width" | "depth">) => Math.min(m.width, m.depth) - RULES.panel;
/** Горизонталь стеллажа в плане: прямоугольник (0..Wl) × (0..Dl) со скруглённым углом у открытой стороны (u — от стороны боковины, v — от задника). */
export function radiusOutline(Wl: number, Dl: number, R: number): Pt[] {
  if (R <= 0) return [[0, 0], [Wl, 0], [Wl, Dl], [0, Dl]];
  const n = Math.max(8, Math.ceil(R / 15)), arc: Pt[] = Array.from({ length: n + 1 }, (_, i) => { const a = (Math.PI / 2) * (i / n); return [Wl - R + R * Math.cos(a), Dl - R + R * Math.sin(a)] as Pt; });
  return simplify([[0, 0], [Wl, 0], ...arc, [0, Dl]]);
}
/** Открытый торцевой стеллаж с радиусными полками (Module.radius): боковина у соседа, задник ЛДСП во всю ширину, дно/крыша/полки —
 *  с дугой у открытой стороны; полки жёсткие на конфирматах; цоколь — две прямые планки с отступом от дуги. Кромка по дуге — криволинейная. */
export function radiusParts(m: Module): Part[] {
  const rs = m.radius!, t = RULES.panel, W = m.width, H = m.height, D = m.depth, P = plinth(m), Wl = W - t, Dl = D - t;
  const R = Math.max(0, Math.min(rs.r, Wl, Dl)), eb = m.edgeBody ?? 2, out: Part[] = [];
  const board = (id: string, name: string, size: Part["size"], position: Part["position"], length: number, width: number, role: Part["role"] = "body", sid?: string): Part => {
    const p: Part = { id, name, sectionId: sid, size, position, length, width, thickness: t, role, material: "board", decor: m.decor, grain: "length", grainAxis: size[1] > size[0] && size[1] > size[2] ? 1 : 0, edge: [0.4, 0.4, eb, 0.4] };
    out.push(p); return p;
  };
  // позиции в «правом» исполнении (дуга справа); левое — зеркально по X в конце
  board("left", "Боковина стеллажа", [t, H, D], [t / 2, H / 2, D / 2], H, D);
  const back = board("back", "Задняя стенка ЛДСП стеллажа", [Wl, H, t], [t + Wl / 2, H / 2, t / 2], H, Wl);
  back.grainAxis = 1;
  setEdges(back, ["+x"], eb); for (const d of ["-x", "+y", "-y"]) { const k = edgeIndex(back, d); if (k >= 0) back.edge[k] = 0.4; }
  const horizontal = (id: string, name: string, y: number, round: boolean, role: Part["role"], sid?: string) => {
    const r = round ? R : 0, p = board(id, name + (r ? ` · фигурная (радиус ${Math.round(r)})` : ""), [Wl, t, Dl], [t + Wl / 2, y, t + Dl / 2], Wl, Dl, role, sid);
    setEdges(p, ["+x", "+z"], eb);
    for (const d of ["-x", "-z"]) { const k = edgeIndex(p, d); if (k >= 0) p.edge[k] = 0.4; }
    if (r) {
      p.shape = { axes: { u: 0, v: 2, w: 1 }, outline: radiusOutline(Wl, Dl, r), holes: [] };
      p.edgeLen = { "+x": r1(Dl - r), "+z": r1(Wl - r) };
      if (Dl - r < 0.5) { const k = edgeIndex(p, "+x"); if (k >= 0) p.edge[k] = 0; }
      if (Wl - r < 0.5) { const k = edgeIndex(p, "+z"); if (k >= 0) p.edge[k] = 0; }
      p.curveEdge = { len: r1((Math.PI * r) / 2), t: eb };
      p.cutWork = 1;
      p.shapeNote = `скругление R${Math.round(r)} у ${rs.side === "left" ? "левого" : "правого"} переднего угла (габарит ${Math.round(Wl)}×${Math.round(Dl)}), кромка по дуге ${mm((Math.PI * r) / 2)} мм`;
    }
    return p;
  };
  horizontal("bottom", "Дно стеллажа", P + t / 2, rs.bottom !== false, "body");
  horizontal("top", "Крыша стеллажа", H - t / 2, rs.top !== false, "body");
  const s = m.sections[0], b = boxes(m)[0], h = b.top - b.bottom;
  s.shelves.forEach((f, j) => horizontal(`${s.id}:shelf:${j}`, "Полка радиусная", b.bottom + f * h, true, "shelf", s.id));
  // цоколь: фронтальная и боковая планки с отступом RADIUS.plinthRecess от края дуги
  if (P > 0) {
    const c = RADIUS.plinthRecess, xMax = (z: number) => (z <= D - R ? W : W - R + Math.sqrt(Math.max(0, R * R - (z - (D - R)) ** 2))), zMax = (x: number) => (x <= W - R ? D : D - R + Math.sqrt(Math.max(0, R * R - (x - (W - R)) ** 2)));
    const xs = W - c - t, zf = D - c - t, xEnd = Math.min(xMax(D - c) - c, xs), zEnd = Math.min(zMax(W - c) - c, zf);
    if (xEnd - t >= 100) board("plinth", "Цоколь фронтальный", [xEnd - t, P, t], [(t + xEnd) / 2, P / 2, zf + t / 2], xEnd - t, P);
    if (zEnd - t >= 100) { const p = board("plinth:side", "Цоколь боковой", [t, P, zEnd - t], [xs + t / 2, P / 2, (t + zEnd) / 2], zEnd - t, P); p.grainAxis = 2; }
  }
  // конфирматы: через боковину в торцы горизонталей и задника, через задник в задние кромки горизонталей
  const conf = (id: string, head: Part["position"], axis: "+x" | "+z", sid?: string) => {
    const L = RULES.confirmatL, d = RULES.confirmatD, c: Part["position"] = axis === "+x" ? [head[0] + L / 2, head[1], head[2]] : [head[0], head[1], head[2] + L / 2];
    out.push({ id, name: "Конфирмат 7×50", sectionId: sid, size: axis === "+x" ? [L, d, d] : [d, d, L], position: c, length: L, width: d, thickness: d, role: "fastener", material: "metal", decor: "", grain: "length", grainAxis: 0, edge: [0, 0, 0, 0] });
  };
  // «Крепёж корпуса: эксцентрики» (критик 29.10, п.8; решение 26.10 — видимого крепежа нет): бочонок в горизонтали (дно — сверху,
  // крыша и полки — снизу) в eccCenter от стойки, шток — в боковину/задник; задник к боковине — бочонок в заднике. Конфирматы (по
  // умолчанию) — только через боковину у соседа и через задник у стены: головки там не видны.
  const ecc = m.fastening === "eccentric", c0 = RULES.eccCenter, bh = RULES.eccBarrelH, bd = RULES.eccBarrelD;
  const eccAt = (id: string, axis: "x" | "z", face: number, y: number, along: number, up: boolean, sid?: string) => {
    const by = up ? y + t / 2 - bh / 2 + 0.3 : y - t / 2 + bh / 2 - 0.3, pin = c0 + t / 2;
    const f = (o: Partial<Part> & Pick<Part, "size" | "position">): Part => ({ id, name: "", sectionId: sid, length: Math.max(...o.size), width: bd, thickness: bd, role: "fastener", material: "metal", decor: "", grain: "length", grainAxis: 0, edge: [0, 0, 0, 0], ...o });
    out.push(f({ name: "Эксцентрик D15 · бочонок", size: axis === "x" ? [bh, bd, bd] : [bd, bd, bh], position: axis === "x" ? [face + c0, by, along] : [along, by, face + c0], anchor: axis === "x" ? [face, up ? y + t / 2 : y - t / 2, along] : [along, up ? y + t / 2 : y - t / 2, face] }));
    out.push(f({ id: id + ":pin", name: "Эксцентрик D15 · шток", size: axis === "x" ? [pin, 7, 7] : [7, 7, pin], position: axis === "x" ? [face + (c0 - t / 2) / 2, y, along] : [along, y, face + (c0 - t / 2) / 2] }));
  };
  for (const p of out.filter((q) => q.size[1] === t && q.material === "board" && !q.id.startsWith("plinth"))) {
    const y = p.position[1], sid = p.sectionId, up = p.id === "bottom";
    if (ecc) {
      [t + 50, D - 50].forEach((z, k) => eccAt(`ecc:${p.id}:left:${k}`, "x", t, y, z, up, sid));
      [t + 50, W - 50].forEach((x, k) => eccAt(`ecc:${p.id}:back:${k}`, "z", t, y, x, up, sid));
      continue;
    }
    [t + 50, D - 50].forEach((z, k) => conf(`fast:${p.id}:left:${k}`, [0, y, z], "+x", sid));
    [t + 50, W - 50].forEach((x, k) => conf(`fast:${p.id}:back:${k}`, [x, y, 0], "+z", sid));
  }
  [P + 100, H / 2, H - 100].forEach((y, k) => {
    if (!ecc) { conf(`fast:back:left:${k}`, [0, y, t / 2], "+x"); return; }
    // задник к боковине: бочонок в внутренней пласти задника, шток — в боковину (по оси x)
    out.push({ id: `ecc:back:left:${k}`, name: "Эксцентрик D15 · бочонок", size: [bd, bd, bh], position: [t + c0, y, t - bh / 2 + 0.3], anchor: [t, y, t], length: bd, width: bd, thickness: bd, role: "fastener", material: "metal", decor: "", grain: "length", grainAxis: 0, edge: [0, 0, 0, 0] });
    out.push({ id: `ecc:back:left:${k}:pin`, name: "Эксцентрик D15 · шток", size: [c0 + t / 2, 7, 7], position: [t + (c0 - t / 2) / 2, y, t / 2], length: c0 + t / 2, width: 7, thickness: 7, role: "fastener", material: "metal", decor: "", grain: "length", grainAxis: 0, edge: [0, 0, 0, 0] });
  });
  // цоколь стеллажа: торцы планок, упёртые в боковину (фронтальная) и в задник (боковая), — на эксцентриках, как цоколь шкафов
  // (hullFasteners: у стеллажа цоколь считается здесь, по деталям); свободные концы планок у дуги лежат под дном
  const pf = out.find((p) => p.id === "plinth"), ps = out.find((p) => p.id === "plinth:side"), nE = P < 150 ? 1 : 2;
  for (let k = 0; k < (pf ? nE : 0); k++) eccAt(`ecc:plinth:left:${k}`, "x", t, nE === 1 ? P / 2 : P * (k + 1) / 3, pf!.position[2], true);
  for (let k = 0; k < (ps ? nE : 0); k++) eccAt(`ecc:plinth:back:${k}`, "z", t, nE === 1 ? P / 2 : P * (k + 1) / 3, ps!.position[0], true);
  if (rs.side === "left") for (const p of out) mirrorX(p, W);
  return out;
}
function edgeIndex(p: Part, dir: string) {
  const t = thinAxis(p), rest = ([0, 1, 2] as Axis[]).filter((i) => i !== t);
  let [L, W] = p.size[rest[0]] >= p.size[rest[1]] ? [rest[0], rest[1]] : [rest[1], rest[0]];
  if (Math.abs(p.size[L] - p.length) > 0.01 && Math.abs(p.size[W] - p.length) <= 0.01) [L, W] = [W, L];
  return ["-" + AX[L], "+" + AX[L], "+" + AX[W], "-" + AX[W]].indexOf(dir);
}
/** Зеркало детали по X (левое исполнение стеллажа): позиция, контур (u по X — зеркально), кромка по направлениям ±x меняется местами. */
function mirrorX(p: Part, W: number) {
  p.position = [W - p.position[0], p.position[1], p.position[2]];
  if (p.shape && p.shape.axes.u === 0) { const U = p.size[0]; p.shape = { ...p.shape, outline: ccw(p.shape.outline.map(([u, v]) => [U - u, v] as Pt)), holes: p.shape.holes.map((h) => ccw(h.map(([u, v]) => [U - u, v] as Pt))) }; }
  if (p.edgeLen) p.edgeLen = Object.fromEntries(Object.entries(p.edgeLen).map(([k, v]) => [k === "+x" ? "-x" : k === "-x" ? "+x" : k, v]));
  if (p.material === "board") {
    const i = edgeIndex(p, "+x"), j = edgeIndex(p, "-x");
    if (i >= 0 && j >= 0) { const e = [...p.edge] as Part["edge"]; [e[i], e[j]] = [e[j], e[i]]; p.edge = e; }
  }
  if (p.id === "left") { p.id = "right"; }
  if (p.id.includes(":left:")) p.id = p.id.replace(":left:", ":right:");
}
/** Разбор полей фигурных деталей из сохранённого проекта (parseModule): только известные поля. */
export function parseShapes(x: Record<string, unknown>): Partial<Pick<Module, "mansard" | "radius" | "cutouts">> {
  const out: Partial<Pick<Module, "mansard" | "radius" | "cutouts">> = {};
  const ms = x.mansard as { rear?: unknown } | undefined;
  if (ms !== undefined) out.mansard = { rear: Number(ms?.rear) };
  const rs = x.radius as { side?: unknown; r?: unknown; top?: unknown; bottom?: unknown } | undefined;
  if (rs !== undefined) out.radius = { side: rs?.side === "left" ? "left" : rs?.side === "right" ? "right" : (String(rs?.side) as "left"), r: Number(rs?.r), ...(rs?.top === false ? { top: false as const } : {}), ...(rs?.bottom === false ? { bottom: false as const } : {}) };
  if (x.cutouts !== undefined) out.cutouts = (Array.isArray(x.cutouts) ? x.cutouts : []).map((c: Record<string, unknown>) => ({
    id: String(c?.id ?? ""), host: String(c?.host ?? ""), shape: c?.shape === "round" ? "round" : c?.shape === "rect" ? "rect" : (String(c?.shape) as "rect"),
    w: Number(c?.w), h: Number(c?.h ?? c?.w), u: Number(c?.u), v: Number(c?.v), fromU: c?.fromU === "max" ? "max" : "min", fromV: c?.fromV === "max" ? "max" : "min",
    ...(typeof c?.edge === "boolean" ? { edge: c.edge } : {}), ...(typeof c?.label === "string" && c.label.trim() ? { label: c.label.trim().slice(0, 60) } : {}) }));
  return out;
}
/** Ошибки стеллажа с радиусными полками (validate). */
export function radiusErrors(m: Module): string[] {
  if (!m.radius) return [];
  const e: string[] = [], r = m.radius, s = m.sections;
  if (!["left", "right"].includes(r.side)) e.push("Радиусный стеллаж: сторона скругления — слева или справа.");
  if (!Number.isFinite(r.r) || r.r < RADIUS.min || r.r > radiusMax(m)) e.push(`Радиусный стеллаж: радиус от ${RADIUS.min} до ${radiusMax(m)} мм (не больше ширины и глубины полки).`);
  if (m.width < RADIUS.minW || m.width > RADIUS.maxW) e.push(`Радиусный стеллаж: ширина от ${RADIUS.minW} до ${RADIUS.maxW} мм.`);
  if (m.depth < RADIUS.minD || m.depth > RADIUS.maxD) e.push(`Радиусный стеллаж: глубина от ${RADIUS.minD} до ${RADIUS.maxD} мм.`);
  if (m.doors || s.length !== 1 || s.some((x) => x.drawers > 0 || x.rod || x.pantograph || x.pullouts || x.divider)) e.push("Радиусный стеллаж — открытый, одна секция только с полками (без дверей, ящиков и штанг).");
  if (m.kitchen || m.raw || m.corner || m.desk || m.casework || m.kupe || m.worktop || m.slope || m.skew || m.mansard || m.sectionLayout || m.topGlass || m.seatTop || m.feet || m.hanging) e.push("Радиусный стеллаж: скосы, ножки, стекло и навесной вариант не применяются.");
  return e;
}
