// Контур помещения произвольной формы (задача Макса 30.10.2026: «не все помещения ровные — 5-угольные, со скосом, со скруглениями,
// нужно редактировать комнату свободнее»). Контур — вершины плана по порядку обхода, у каждой — стрела дуги ребра к следующей:
//   bulge > 0 — стена выгнута наружу (комната больше), < 0 — внутрь, нет/0 — прямая. Скос угла — две вершины, скругление
//   угла — две вершины и дуга между ними (roundCorner). Координаты — как у прямоугольной комнаты: x вправо от левой стены,
//   z от задней стены к передней; контур сдвинут так, что его габарит начинается в 0, room.width/depth — габарит (все старые
//   чтения ширины/глубины остаются верными как «рамка»). Порядок обхода — как у прямоугольника: задняя (0) → правая (1) →
//   передняя (2) → левая (3), площадь по формуле шнурования > 0. Комната без room.outline — прямоугольник width × depth.
import type { Room } from "./project";

export type OutlinePoint = { x: number; z: number; bulge?: number };
export type RoomOutline = OutlinePoint[];
export type P2 = { x: number; z: number };
/** Сегмент сплющенного контура: от a до b, принадлежит ребру edge (стене) контура. */
export type FlatPolygon = { pts: P2[]; edge: number[] };

export const OUTLINE_MAX_POINTS = 40;
export const OUTLINE_MIN_EDGE = 50;
const ARC_STEP = 40; // мм — шаг сплющивания дуги (для попадания и показа)
const r1 = (v: number) => { const r = Math.round(v * 10) / 10; return r === 0 ? 0 : r; };

export const rectOutline = (w: number, d: number): RoomOutline => [{ x: 0, z: 0 }, { x: w, z: 0 }, { x: w, z: d }, { x: 0, z: d }];
/** Контур комнаты: свой или прямоугольник width × depth. */
export const roomOutline = (room: Pick<Room, "width" | "depth"> & { outline?: RoomOutline }): RoomOutline => room.outline ?? rectOutline(room.width, room.depth);
/** Прямоугольник по осям без дуг — хранить его не нужно (комната как раньше). */
export function isPlainRect(o: RoomOutline): boolean {
  if (o.length !== 4 || o.some((p) => p.bulge)) return false;
  const b = outlineBounds(o);
  return o.every((p) => (Math.abs(p.x - b.x0) < 0.05 || Math.abs(p.x - b.x1) < 0.05) && (Math.abs(p.z - b.z0) < 0.05 || Math.abs(p.z - b.z1) < 0.05))
    && new Set(o.map((p) => Math.round(p.x) + ":" + Math.round(p.z))).size === 4 && o.every((p, i) => { const q = o[(i + 1) % 4]; return Math.abs(p.x - q.x) < 0.05 || Math.abs(p.z - q.z) < 0.05; });
}

/** Внутренняя нормаль ребра a→b при нашем порядке обхода. */
export function inwardNormal(a: P2, b: P2): P2 { const l = Math.hypot(b.x - a.x, b.z - a.z) || 1; return { x: -(b.z - a.z) / l, z: (b.x - a.x) / l }; }
/** Дуга ребра a→b со стрелой s: центр, радиус, угол охвата (со знаком: поворот от a к b вокруг центра). */
export function edgeArc(a: P2, b: P2, s: number): { c: P2; R: number; sweep: number } | null {
  const ch = Math.hypot(b.x - a.x, b.z - a.z);
  if (!s || Math.abs(s) < 0.05 || ch < 1e-6) return null;
  const sa = Math.abs(s), R = (ch * ch / 4 + sa * sa) / (2 * sa), n = inwardNormal(a, b), sg = Math.sign(s);
  const m = { x: (a.x + b.x) / 2, z: (a.z + b.z) / 2 }, u = { x: -n.x * sg, z: -n.z * sg }; // u — к вершине дуги
  const c = { x: m.x + u.x * (sa - R), z: m.z + u.z * (sa - R) };
  const phi = 4 * Math.atan((2 * sa) / ch);
  // направление поворота: средняя точка дуги должна быть у вершины (apex = m + u·sa)
  const rot = (p: P2, t: number) => ({ x: c.x + (p.x - c.x) * Math.cos(t) - (p.z - c.z) * Math.sin(t), z: c.z + (p.x - c.x) * Math.sin(t) + (p.z - c.z) * Math.cos(t) });
  const apex = { x: m.x + u.x * sa, z: m.z + u.z * sa }, mid = rot(a, phi / 2), mid2 = rot(a, -phi / 2);
  const sweep = Math.hypot(mid.x - apex.x, mid.z - apex.z) <= Math.hypot(mid2.x - apex.x, mid2.z - apex.z) ? phi : -phi;
  return { c, R, sweep };
}
/** Точки ребра i (от вершины i до i+1 включительно): прямая — 2 точки, дуга — по шагу step мм. */
export function edgePoints(o: RoomOutline, i: number, step = ARC_STEP): P2[] {
  const a = o[i], b = o[(i + 1) % o.length], arc = edgeArc(a, b, a.bulge ?? 0);
  if (!arc) return [{ x: a.x, z: a.z }, { x: b.x, z: b.z }];
  const n = Math.max(4, Math.min(96, Math.ceil((Math.abs(arc.sweep) * arc.R) / step))), out: P2[] = [];
  for (let k = 0; k <= n; k++) {
    const t = (arc.sweep * k) / n;
    out.push({ x: arc.c.x + (a.x - arc.c.x) * Math.cos(t) - (a.z - arc.c.z) * Math.sin(t), z: arc.c.z + (a.x - arc.c.x) * Math.sin(t) + (a.z - arc.c.z) * Math.cos(t) });
  }
  out[n] = { x: b.x, z: b.z };
  return out;
}
/** Длина стены i: хорда или длина дуги. */
export function edgeLength(o: RoomOutline, i: number): number {
  const a = o[i], b = o[(i + 1) % o.length], arc = edgeArc(a, b, a.bulge ?? 0);
  return arc ? Math.abs(arc.sweep) * arc.R : Math.hypot(b.x - a.x, b.z - a.z);
}
/** Сплющенный контур: многоугольник и номер стены у каждого сегмента pts[k]→pts[k+1]. */
export function flatten(o: RoomOutline, step = ARC_STEP): FlatPolygon {
  const pts: P2[] = [], edge: number[] = [];
  o.forEach((_, i) => { const e = edgePoints(o, i, step); for (let k = 0; k < e.length - 1; k++) { pts.push(e[k]); edge.push(i); } });
  return { pts, edge };
}
export function outlineBounds(o: RoomOutline): { x0: number; z0: number; x1: number; z1: number } {
  const p = o.some((q) => q.bulge) ? flatten(o, 10).pts : o;
  const xs = p.map((q) => q.x), zs = p.map((q) => q.z);
  return { x0: Math.min(...xs), z0: Math.min(...zs), x1: Math.max(...xs), z1: Math.max(...zs) };
}
const shoelace = (p: P2[]) => p.reduce((s, q, i) => { const r = p[(i + 1) % p.length]; return s + q.x * r.z - r.x * q.z; }, 0) / 2;
export const outlineArea = (o: RoomOutline) => shoelace(flatten(o).pts);

/** Привести контур к правилам: без повторов подряд, обход как у прямоугольника, габарит от 0, до 0,1 мм.
 *  Возвращает контур и габарит (width/depth для room). Прямоугольник по осям — outline: undefined. */
export function normalizeOutline(raw: RoomOutline): { outline?: RoomOutline; width: number; depth: number } {
  let o = raw.map((p) => ({ x: p.x, z: p.z, ...(p.bulge && Math.abs(p.bulge) >= 0.05 ? { bulge: p.bulge } : {}) }));
  o = o.filter((p, i) => { const q = o[(i + 1) % o.length]; return o.length < 2 || Math.hypot(p.x - q.x, p.z - q.z) > 0.05; });
  if (o.length >= 3 && shoelace(o) < 0) {
    // обратный обход: вершины в обратном порядке, стрела ребра переезжает к новой начальной вершине (знак — относительно комнаты, тот же)
    const n = o.length, rev: RoomOutline = [];
    for (let k = 0; k < n; k++) { const p = o[n - 1 - k], prev = o[(2 * n - 2 - k) % n]; rev.push({ x: p.x, z: p.z, ...(prev.bulge ? { bulge: prev.bulge } : {}) }); }
    o = rev;
  }
  const b = outlineBounds(o);
  o = o.map((p) => ({ x: r1(p.x - b.x0), z: r1(p.z - b.z0), ...(p.bulge ? { bulge: r1(p.bulge) } : {}) }));
  const width = r1(b.x1 - b.x0), depth = r1(b.z1 - b.z0);
  return isPlainRect(o) ? { width, depth } : { outline: o, width, depth };
}

function segCross(a: P2, b: P2, c: P2, d: P2): boolean {
  const o = (p: P2, q: P2, r: P2) => (q.x - p.x) * (r.z - p.z) - (q.z - p.z) * (r.x - p.x);
  const d1 = o(c, d, a), d2 = o(c, d, b), d3 = o(a, b, c), d4 = o(a, b, d);
  return ((d1 > 1e-6 && d2 < -1e-6) || (d1 < -1e-6 && d2 > 1e-6)) && ((d3 > 1e-6 && d4 < -1e-6) || (d3 < -1e-6 && d4 > 1e-6));
}
/** Ошибка контура или null: 3–40 вершин, числа, стены от 50 мм, дуга не больше полуокружности, без самопересечений. */
export function outlineError(o: unknown): string | null {
  if (!Array.isArray(o) || o.length < 3 || o.length > OUTLINE_MAX_POINTS) return `Контур помещения: от 3 до ${OUTLINE_MAX_POINTS} точек.`;
  for (const p of o as OutlinePoint[])
    if (!p || ![p.x, p.z].every(Number.isFinite) || p.x < -0.05 || p.z < -0.05 || p.x > 20000 || p.z > 20000 || (p.bulge !== undefined && !Number.isFinite(p.bulge)))
      return "Контур помещения: координаты точек от 0 до 20 000 мм.";
  const c = o as RoomOutline;
  for (let i = 0; i < c.length; i++) {
    const a = c[i], b = c[(i + 1) % c.length], ch = Math.hypot(b.x - a.x, b.z - a.z);
    if (ch < OUTLINE_MIN_EDGE) return `Контур помещения: стена ${i + 1} короче ${OUTLINE_MIN_EDGE} мм.`;
    if (a.bulge && Math.abs(a.bulge) > ch / 2 + 0.05) return `Контур помещения: дуга стены ${i + 1} больше полуокружности.`;
  }
  const f = flatten(c, 80).pts, n = f.length;
  for (let i = 0; i < n; i++) for (let j = i + 2; j < n; j++) {
    if (i === 0 && j === n - 1) continue;
    if (segCross(f[i], f[(i + 1) % n], f[j], f[(j + 1) % n])) return "Контур помещения пересекает сам себя.";
  }
  if (shoelace(f) <= 0) return "Контур помещения: обход точек против правил (задняя → правая → передняя → левая).";
  return null;
}

/** Точка внутри контура (на стене — внутри, допуск tol мм). */
export function pointInOutline(p: P2, poly: FlatPolygon | RoomOutline, tol = 0.1): boolean {
  const pts = "pts" in poly ? poly.pts : flatten(poly).pts, n = pts.length;
  let inside = false;
  for (let i = 0, j = n - 1; i < n; j = i++) {
    const a = pts[i], b = pts[j];
    if (distToSeg(p, a, b) <= tol) return true;
    if ((a.z > p.z) !== (b.z > p.z) && p.x < ((b.x - a.x) * (p.z - a.z)) / (b.z - a.z) + a.x) inside = !inside;
  }
  return inside;
}
export function distToSeg(p: P2, a: P2, b: P2): number {
  const dx = b.x - a.x, dz = b.z - a.z, L = dx * dx + dz * dz, t = L ? Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.z - a.z) * dz) / L)) : 0;
  return Math.hypot(p.x - a.x - t * dx, p.z - a.z - t * dz);
}
/** Многоугольник (след корпуса на плане) целиком в комнате: все его вершины внутри, ни одна вершина комнаты не внутри него
 *  (выступ стены в корпус), стены не режут его стороны. */
export function polygonInOutline(poly: P2[], room: FlatPolygon, tol = 0.1): boolean {
  if (!poly.every((p) => pointInOutline(p, room, tol))) return false;
  const shrink = (p: P2[]) => { const c = p.reduce((s, q) => ({ x: s.x + q.x / p.length, z: s.z + q.z / p.length }), { x: 0, z: 0 }); return p.map((q) => { const l = Math.hypot(q.x - c.x, q.z - c.z) || 1, k = Math.max(0, l - tol) / l; return { x: c.x + (q.x - c.x) * k, z: c.z + (q.z - c.z) * k }; }); };
  const inner = shrink(poly), n = room.pts.length;
  for (const v of room.pts) if (strictInside(v, inner)) return false;
  for (let i = 0; i < inner.length; i++) for (let j = 0; j < n; j++) if (segCross(inner[i], inner[(i + 1) % inner.length], room.pts[j], room.pts[(j + 1) % n])) return false;
  return true;
}
function strictInside(p: P2, poly: P2[]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i], b = poly[j];
    if ((a.z > p.z) !== (b.z > p.z) && p.x < ((b.x - a.x) * (p.z - a.z)) / (b.z - a.z) + a.x) inside = !inside;
  }
  return inside && poly.every((a, i) => distToSeg(p, a, poly[(i + 1) % poly.length]) > 1e-6);
}

/** Рамка стены i: начало a, касательная t (по обходу), внутрь комнаты n, длина хорды; для дуги — ещё центр/радиус. */
export function edgeFrame(o: RoomOutline, i: number) {
  const a = o[i], b = o[(i + 1) % o.length], len = Math.hypot(b.x - a.x, b.z - a.z) || 1;
  return { a: { x: a.x, z: a.z }, b: { x: b.x, z: b.z }, t: { x: (b.x - a.x) / len, z: (b.z - a.z) / len }, n: inwardNormal(a, b), chord: len, arc: edgeArc(a, b, a.bulge ?? 0) };
}
/** Внутренний угол при вершине i, градусы (между стенами i−1 и i; по хордам). */
export function cornerAngle(o: RoomOutline, i: number): number {
  const p = o[(i - 1 + o.length) % o.length], c = o[i], q = o[(i + 1) % o.length];
  const a1 = Math.atan2(p.z - c.z, p.x - c.x), a2 = Math.atan2(q.z - c.z, q.x - c.x);
  let d = ((a1 - a2) * 180) / Math.PI; d = ((d % 360) + 360) % 360;
  return r1(d);
}
/** Старые имена стен прямоугольной комнаты ↔ номера рёбер (задняя 0, правая 1, передняя 2, левая 3). */
export const RECT_WALLS = ["back", "right", "front", "left"] as const;
export type RectWall = (typeof RECT_WALLS)[number];
export const wallEdgeIndex = (w: RectWall) => RECT_WALLS.indexOf(w);

// ── правки контура (редактор плана). Все возвращают новый массив; нормализацию делает вызывающий (normalizeOutline). ──
export function moveVertex(o: RoomOutline, i: number, p: P2): RoomOutline { return o.map((q, k) => (k === i ? { ...q, x: p.x, z: p.z } : q)); }
/** Вставить вершину на стене i в доле t (0..1) хорды; дуга делится на две с сохранением формы приблизительно (стрелы по 1/4). */
export function insertVertex(o: RoomOutline, i: number, t = 0.5): RoomOutline {
  const a = o[i], b = o[(i + 1) % o.length], arc = edgeArc(a, b, a.bulge ?? 0);
  let p: P2 = { x: a.x + (b.x - a.x) * t, z: a.z + (b.z - a.z) * t };
  if (arc) { const ang = arc.sweep * t; p = { x: arc.c.x + (a.x - arc.c.x) * Math.cos(ang) - (a.z - arc.c.z) * Math.sin(ang), z: arc.c.z + (a.x - arc.c.x) * Math.sin(ang) + (a.z - arc.c.z) * Math.cos(ang) }; }
  const sag = (ang: number) => (arc ? Math.sign(a.bulge!) * arc.R * (1 - Math.cos(ang / 2)) : 0);
  const out = o.slice(), first = { ...a, ...(arc ? { bulge: r1(sag(arc.sweep * t)) } : {}) }, mid: OutlinePoint = { x: r1(p.x), z: r1(p.z), ...(arc ? { bulge: r1(sag(arc.sweep * (1 - t))) } : {}) };
  out.splice(i, 1, first, mid);
  return out;
}
export function removeVertex(o: RoomOutline, i: number): RoomOutline { if (o.length <= 3) return o; const out = o.slice(); out.splice(i, 1); const prev = (i - 1 + out.length) % out.length; out[prev] = { ...out[prev], bulge: undefined }; return out.map((p) => (p.bulge === undefined ? { x: p.x, z: p.z } : p)); }
/** Скос угла i: срез da мм по входящей стене и db мм по выходящей (db по умолчанию = da). */
export function chamferCorner(o: RoomOutline, i: number, da: number, db = da): RoomOutline {
  const n = o.length, p = o[(i - 1 + n) % n], c = o[i], q = o[(i + 1) % n];
  const lp = Math.hypot(p.x - c.x, p.z - c.z), lq = Math.hypot(q.x - c.x, q.z - c.z);
  const A = { x: r1(c.x + ((p.x - c.x) * da) / lp), z: r1(c.z + ((p.z - c.z) * da) / lp) }, B = { x: r1(c.x + ((q.x - c.x) * db) / lq), z: r1(c.z + ((q.z - c.z) * db) / lq) };
  const out = o.slice(); out.splice(i, 1, A, { ...B, ...(c.bulge ? { bulge: c.bulge } : {}) });
  return out;
}
/** Скругление угла i радиусом R: касательные точки на обеих стенах и дуга между ними (вогнутая часть комнаты — дуга внутрь). */
export function roundCorner(o: RoomOutline, i: number, R: number): RoomOutline {
  const n = o.length, p = o[(i - 1 + n) % n], c = o[i], q = o[(i + 1) % n];
  const u1 = { x: p.x - c.x, z: p.z - c.z }, u2 = { x: q.x - c.x, z: q.z - c.z }, l1 = Math.hypot(u1.x, u1.z), l2 = Math.hypot(u2.x, u2.z);
  const cos = (u1.x * u2.x + u1.z * u2.z) / (l1 * l2), th = Math.acos(Math.max(-1, Math.min(1, cos))); // внутренний угол по хордам
  const d = R / Math.tan(th / 2); // от угла до точек касания
  const A = { x: c.x + (u1.x * d) / l1, z: c.z + (u1.z * d) / l1 }, B = { x: c.x + (u2.x * d) / l2, z: c.z + (u2.z * d) / l2 };
  const ch = Math.hypot(B.x - A.x, B.z - A.z), sag = R - Math.sqrt(Math.max(0, R * R - (ch * ch) / 4));
  // выпуклый угол комнаты (внутренний < 180): дуга срезает угол — относительно хорды A→B она выгнута наружу, к вершине угла
  const convex = cornerAngle(o, i) < 180;
  const out = o.slice(); out.splice(i, 1, { x: r1(A.x), z: r1(A.z), bulge: r1(convex ? sag : -sag) }, { x: r1(B.x), z: r1(B.z), ...(c.bulge ? { bulge: c.bulge } : {}) });
  return out;
}
/** Стрела дуги по радиусу R для хорды ch (меньшая дуга); радиус по стреле. */
export const sagittaFromRadius = (ch: number, R: number) => (R * 2 < ch ? ch / 2 : R - Math.sqrt(R * R - (ch * ch) / 4));
export const radiusFromSagitta = (ch: number, s: number) => (ch * ch / 4 + s * s) / (2 * Math.abs(s));
export function setBulge(o: RoomOutline, i: number, bulge: number): RoomOutline { return o.map((p, k) => (k === i ? (bulge ? { ...p, bulge } : { x: p.x, z: p.z }) : p)); }
/** Длина стены i по хорде: конец стены (вершина i+1) едет вдоль стены, остальные стоят. */
export function setEdgeLength(o: RoomOutline, i: number, len: number): RoomOutline {
  const f = edgeFrame(o, i), j = (i + 1) % o.length;
  return moveVertex(o, j, { x: r1(f.a.x + f.t.x * len), z: r1(f.a.z + f.t.z * len) });
}

/** Готовые формы (заготовки в панели «Форма комнаты»): размеры — от габарита w × d. */
export type OutlinePreset = "rect" | "chamfer" | "pentagon" | "L" | "rounded" | "bay";
export function outlinePreset(kind: OutlinePreset, w: number, d: number): RoomOutline {
  const r = rectOutline(w, d), cut = Math.round(Math.min(w, d) / 4 / 10) * 10;
  switch (kind) {
    case "rect": return r;
    case "chamfer": return chamferCorner(r, 1, cut); // скошен задний правый угол
    case "pentagon": return [{ x: 0, z: 0 }, { x: w, z: 0 }, { x: w, z: d - cut }, { x: w - cut, z: d }, { x: 0, z: d }]; // скошен передний правый
    case "L": return [{ x: 0, z: 0 }, { x: w, z: 0 }, { x: w, z: Math.round(d / 2) }, { x: Math.round(w / 2), z: Math.round(d / 2) }, { x: Math.round(w / 2), z: d }, { x: 0, z: d }];
    case "rounded": return roundCorner(r, 1, cut * 2);
    case "bay": return setBulge(r, 0, Math.round(Math.min(w / 4, d / 3) / 10) * 10); // задняя стена — дуга наружу (эркер)
  }
}
export const PRESET_NAMES: Record<OutlinePreset, string> = { rect: "Прямоугольная", chamfer: "Скошенный угол", pentagon: "Пятиугольная", L: "Г-образная", rounded: "Скруглённый угол", bay: "Эркер (дуга)" };
/** Комната с новым контуром: габарит в width/depth, прямоугольник — без outline. */
export function withOutline<R extends Room>(room: R, raw: RoomOutline): R {
  const n = normalizeOutline(raw), next = { ...room, width: n.width, depth: n.depth } as R;
  if (n.outline) next.outline = n.outline; else delete next.outline;
  return next;
}
