// Вспомогательные линии как в Базисе (решение Макса 29.10.2026, РЕШЕНИЯ.md): в ортогональном виде Q → навести и щёлкнуть линию
// (ребро корпуса, кромка детали, стена/пол/потолок, другая вспомогательная) → параллельная линия идёт за мышью; набрать размер
// и Enter — линия встаёт на этом расстоянии, сторона — где мышь (справа от вертикальной — вправо, выше горизонтальной — вверх);
// щелчок без числа — на расстоянии мыши (до 1 мм). Линии хранятся в проекте (project.guides) — только для построения:
// не детали, не цена, не документы. Видны в том виде, где поставлены. К ним привязываются перетаскивание корпуса, края и угла.
// Линия — плоскость, перпендикулярная экрану: n·P = at (P — точка в координатах помещения, мм; n — единичная нормаль),
// look — направление «на камеру» вида, в котором она поставлена.
import { localToRoom, type PlacedModule, type Room } from "./project";
import { parts } from "./model";

export type V3 = { x: number; y: number; z: number };
export type Guide = { id: string; look: [number, number, number]; n: [number, number, number]; at: number };
/** Линия-кандидат для Q (и база для новой): плоскость n·P = at, отрезок a–b для показа и попадания мышью. */
export type GuideLine = { n: V3; at: number; a: V3; b: V3; what: string; guideId?: string };

export const dot = (a: V3, b: V3) => a.x * b.x + a.y * b.y + a.z * b.z;
const add = (a: V3, b: V3, k = 1): V3 => ({ x: a.x + b.x * k, y: a.y + b.y * k, z: a.z + b.z * k });
const scale = (a: V3, k: number): V3 => ({ x: a.x * k, y: a.y * k, z: a.z * k });
const cross = (a: V3, b: V3): V3 => ({ x: a.y * b.z - a.z * b.y, y: a.z * b.x - a.x * b.z, z: a.x * b.y - a.y * b.x });
const unit = (a: V3): V3 => { const l = Math.hypot(a.x, a.y, a.z) || 1; return { x: a.x / l + 0, y: a.y / l + 0, z: a.z / l + 0 }; };
const r3 = (v: number) => { const r = Math.round(v * 1000) / 1000; return r === 0 ? 0 : r; };
const r1 = (v: number) => { const r = Math.round(v * 10) / 10; return r === 0 ? 0 : r; };
export const v3 = (t: [number, number, number]): V3 => ({ x: t[0], y: t[1], z: t[2] });
export const tuple = (v: V3): [number, number, number] => [r3(v.x), r3(v.y), r3(v.z)];

/** Направление «на камеру» ортогонального вида — как в Scene.fit(): спереди/сбоку/слева — с учётом поворота выбранного корпуса
 *  (угловой — ещё 45°), сверху — ось Y. 3D — null. */
export function viewLook(view: string, rotation = 0, corner = false): V3 | null {
  if (view === "top") return { x: 0, y: 1, z: 0 };
  const base = view === "front" ? { x: 0, z: 1 } : view === "side" ? { x: 1, z: 0 } : view === "left" ? { x: -1, z: 0 } : null;
  if (!base) return null;
  const t = ((rotation + (corner ? 45 : 0)) * Math.PI) / 180, c = Math.cos(t), s = Math.sin(t);
  return { x: r3(base.x * c + base.z * s), y: 0, z: r3(-base.x * s + base.z * c) };
}
/** Оси экрана вида: h — вправо, v — вверх (в координатах помещения). Сверху: вправо +X, вверх — к задней стене (−Z). */
export function viewAxes(look: V3): { h: V3; v: V3 } {
  if (Math.abs(look.y) > 0.99) return { h: { x: 1, y: 0, z: 0 }, v: { x: 0, y: 0, z: -1 } };
  const h = unit({ x: look.z, y: 0, z: -look.x });
  return { h, v: unit(cross(look, h)) };
}
/** План помещения (RoomPlan, решение Макса 29.10.2026: линии и ручки углов — везде, включая «План») — это вид сверху в тех же
 *  координатах помещения (X вправо, Z к фасадной стене), поэтому линии плана и вида «Сверху» общие: look = +Y. */
export const PLAN_LOOK: V3 = { x: 0, y: 1, z: 0 };
/** Расстояние от точки до отрезка a–b в плоскости плана (X/Z), мм. */
export function planDist(p: V3, a: V3, b: V3): number {
  const dx = b.x - a.x, dz = b.z - a.z, L = dx * dx + dz * dz;
  const t = L ? Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.z - a.z) * dz) / L)) : 0;
  return Math.hypot(p.x - a.x - t * dx, p.z - a.z - t * dz);
}
/** Ближайшая к точке плана линия в пределах tol мм (для Q на плане и выбора поставленной линии). */
export function nearestPlanLine<T extends { a: V3; b: V3 }>(lines: T[], p: V3, tol: number): T | undefined {
  let best: T | undefined, bd = tol;
  for (const l of lines) { const d = planDist(p, l.a, l.b); if (d < bd - 0.01) { bd = d; best = l; } }
  return best;
}
/** Линия поставлена в этом виде (то же направление взгляда). */
export const sameLook = (g: Guide, look: V3) => dot(unit(v3(g.look)), unit(look)) > 0.9995;
export const guidesInView = (list: Guide[] | undefined, look: V3 | null) => (look ? (list ?? []).filter((g) => sameLook(g, look)) : []);

/** Контур точек в виде: 4 линии (левая, правая, нижняя, верхняя) на средней глубине. */
function outline(points: V3[], look: V3, what: string | ((side: "left" | "right" | "bottom" | "top") => string)): GuideLine[] {
  const { h, v } = viewAxes(look);
  const hs = points.map((p) => dot(p, h)), vs = points.map((p) => dot(p, v)), c = points.reduce((s, p) => s + dot(p, look), 0) / points.length;
  const h0 = Math.min(...hs), h1 = Math.max(...hs), v0 = Math.min(...vs), v1 = Math.max(...vs);
  const at = (a: number, b: number) => add(add(scale(h, a), v, b), look, c);
  const name = (s: "left" | "right" | "bottom" | "top") => (typeof what === "string" ? what : what(s));
  return [
    { n: h, at: r1(h0), a: at(h0, v0), b: at(h0, v1), what: name("left") },
    { n: h, at: r1(h1), a: at(h1, v0), b: at(h1, v1), what: name("right") },
    { n: v, at: r1(v0), a: at(h0, v0), b: at(h1, v0), what: name("bottom") },
    { n: v, at: r1(v1), a: at(h0, v1), b: at(h1, v1), what: name("top") },
  ];
}
/** Углы корпуса (без фальшей и выступа фасадов) в координатах помещения. */
export function carcassCorners(a: PlacedModule): V3[] {
  const m = a.module, y0 = a.y ?? 0, out: V3[] = [];
  for (const u of [0, m.width]) for (const w of [0, m.depth]) for (const y of [y0, y0 + m.height]) { const q = localToRoom(a, u, w); out.push({ x: q.x, y, z: q.z }); }
  return out;
}
/** Отрезок вспомогательной линии для показа: вдоль экрана на len мм в обе стороны от точки center. */
export function guideSegment(g: { n: V3; at: number }, look: V3, center: V3, len = 30000): [V3, V3] {
  const t = unit(cross(look, g.n)), base = add(add(scale(g.n, g.at - dot(center, g.n)), center), look, 0);
  return [add(base, t, -len), add(base, t, len)];
}
/** Линии, от которых строится вспомогательная (Q): контуры корпусов в виде, кромки деталей выбранного корпуса,
 *  стены/пол/потолок помещения, поставленные линии этого вида. */
export function candidateLines(modules: PlacedModule[], look: V3, activeId?: string, room?: Room, guides?: Guide[]): GuideLine[] {
  const out: GuideLine[] = [];
  for (const g of guidesInView(guides, look)) {
    const n = v3(g.n), c = scale(n, g.at), [a, b] = guideSegment({ n, at: g.at }, look, c);
    out.push({ n, at: g.at, a, b, what: "вспомогательная линия", guideId: g.id });
  }
  for (const a of modules) {
    if (a.id !== activeId) continue;
    // кромки деталей выбранного корпуса: стойки, полки, крыша, дно, фасады (без фурнитуры и повёрнутых деталей)
    for (const p of parts(a.module)) {
      if (!["body", "shelf", "door"].includes(p.role) || p.rotY || p.rotZ || p.material === "metal") continue;
      const y0 = a.y ?? 0, pts: V3[] = [];
      for (const dx of [-1, 1]) for (const dy of [-1, 1]) for (const dz of [-1, 1]) {
        const q = localToRoom(a, p.position[0] + (dx * p.size[0]) / 2, p.position[2] + (dz * p.size[2]) / 2);
        pts.push({ x: q.x, y: y0 + p.position[1] + (dy * p.size[1]) / 2, z: q.z });
      }
      out.push(...outline(pts, look, "кромка «" + p.name + "»"));
    }
  }
  for (const a of modules) out.push(...outline(carcassCorners(a), look, "край «" + a.module.name + "»"));
  if (room) {
    const pts: V3[] = [];
    for (const x of [0, room.width]) for (const y of [0, room.height]) for (const z of [0, room.depth]) pts.push({ x, y, z });
    const horizontal = Math.abs(look.y) > 0.99;
    out.push(...outline(pts, look, (s) => (horizontal || s === "left" || s === "right" ? "стена" : s === "bottom" ? "пол" : "потолок")));
  }
  return out;
}
/** Новая линия от базы: сторона — где мышь (n·mouse больше at — вправо/вверх), расстояние — набранное или до мыши (1 мм;
 *  exact — мышь привязана Alt/Ctrl к точке, pointSnap.ts: точно до 0,1 мм). */
export function placeGuide(base: { n: V3; at: number }, mouse: V3, typed?: number, exact = false): { at: number; dist: number; sign: 1 | -1 } {
  const s = dot(base.n, mouse) - base.at, sign: 1 | -1 = s < 0 ? -1 : 1;
  const dist = typed !== undefined && Number.isFinite(typed) ? Math.abs(typed) : exact ? r1(Math.abs(s)) : Math.round(Math.abs(s));
  return { at: r1(base.at + sign * dist), dist, sign };
}
/** Набранное число для Q: «600», «12,5», «12.5». Пусто или не число — undefined. */
export function parseTyped(text: string): number | undefined {
  const t = text.replace(",", ".").trim();
  if (!t || !/^\d*\.?\d*$/.test(t) || t === ".") return undefined;
  const v = Number(t);
  return Number.isFinite(v) ? v : undefined;
}
export function makeGuide(id: string, look: V3, n: V3, at: number): Guide { return { id, look: tuple(look), n: tuple(n), at: r1(at) }; }

/** Плоскость привязки: край ложится на n·P = at. */
export type SnapPlane = { n: V3; at: number; what: string };
export const guidePlanes = (list: Guide[] | undefined): SnapPlane[] => (list ?? []).map((g) => ({ n: v3(g.n), at: g.at, what: "вспомогательная линия" }));
/** Ближайший к raw ход края (мм наружу), при котором край ложится на плоскость: край в точке E, наружу — единичный o.
 *  Только плоскости, параллельные краю (нормаль вдоль o), и в пределах tol мм. */
export function snapOut(E: V3, o: V3, raw: number, planes: SnapPlane[], tol: number): { raw: number; what: string } | undefined {
  let best: { raw: number; what: string } | undefined, d = tol + 1e-6;
  for (const p of planes) {
    const k = dot(p.n, o);
    if (Math.abs(k) < 0.999) continue;
    const t = (p.at - dot(p.n, E)) / k;
    if (Math.abs(t - raw) < d) { d = Math.abs(t - raw); best = { raw: r1(t), what: p.what }; }
  }
  return best;
}
/** Перетаскивание корпуса: привязка его краёв (корпус без фальшей) к вспомогательным линиям по осям помещения.
 *  raw — положение по курсору, snapped — после обычной привязки; ось, где край в пределах tol от линии, берётся по линии. */
export function snapMoveToGuides(a: PlacedModule, raw: { x: number; y: number; z: number }, snapped: { x: number; y: number; z: number }, list: Guide[] | undefined, tol: number) {
  const planes = guidePlanes(list);
  if (!planes.length) return snapped;
  const moved: PlacedModule = { ...a, x: raw.x, y: raw.y, z: raw.z }, pts = carcassCorners(moved), next = { ...snapped };
  for (const k of ["x", "y", "z"] as const) {
    const e: V3 = { x: k === "x" ? 1 : 0, y: k === "y" ? 1 : 0, z: k === "z" ? 1 : 0 };
    const lo = Math.min(...pts.map((p) => dot(p, e))), hi = Math.max(...pts.map((p) => dot(p, e)));
    let best: number | undefined, d = tol + 1e-6;
    for (const p of planes) {
      const kk = dot(p.n, e);
      if (Math.abs(kk) < 0.999) continue;
      for (const edge of [lo, hi]) { const t = (p.at - kk * edge) / kk; if (Math.abs(t) < d) { d = Math.abs(t); best = t; } }
    }
    if (best !== undefined) next[k] = r1(raw[k] + best);
  }
  return next;
}
/** Линии из файла проекта: чужие и битые записи отбрасываются (линии — только помощь построению, проект из-за них не падает). */
export function parseGuides(x: unknown): Guide[] {
  if (!Array.isArray(x)) return [];
  const vec = (t: unknown) => Array.isArray(t) && t.length === 3 && t.every((v) => Number.isFinite(v) && Math.abs(v as number) <= 1.001) && Math.hypot(...(t as number[])) > 0.99 && Math.hypot(...(t as number[])) < 1.01;
  return x.filter((g) => g && typeof g.id === "string" && g.id.length <= 64 && vec(g.look) && vec(g.n) && Number.isFinite(g.at) && Math.abs(g.at) <= 100000)
    .slice(0, 200).map((g) => ({ id: g.id, look: [...g.look] as [number, number, number], n: [...g.n] as [number, number, number], at: g.at }));
}
