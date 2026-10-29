// Привязки курсора клавишами, как в Базисе (решение Макса 29.10.2026, РЕШЕНИЯ.md): во всех ортогональных видах и на «Плане»,
// для всего, что тянется мышью (линия Q, угол, край «↔», перенос корпуса):
//   Alt  — точка на ближайшей линии: перпендикуляр от курсора на вспомогательную линию, край/контур корпуса, кромку детали,
//          стену, пол, потолок (в пределах допуска на экране);
//   Ctrl — ближайшее пересечение двух линий (линия × линия, линия × край, край × край — угол корпуса, углы помещения);
//   Shift — без привязки, шаг 1 мм (раньше это был Alt).
// Ctrl+щелчок без движения — по-прежнему отметить корпус (мультивыбор). Здесь только 2D-геометрия в осях экрана вида
// (h — вправо, v — вверх, guides.viewAxes) — без React и three; проверяется тестами tests/point-snap.test.ts.
import { dot, viewAxes, type GuideLine, type V3 } from "./guides";
import { editsText } from "./historyShortcuts";

/** Отпускание Alt (критик 29.10, блокер): Chrome на Windows по keyup Alt уводит фокус в меню браузера — и следующая клавиша
 *  уходит туда. Alt теперь — привязка, его отпускают и после тяги: гасим всегда, кроме полей ввода. */
export const altKeyupGuard = (e: { key: string; target: EventTarget | null }) =>
  e.key === "Alt" && (typeof Element === "undefined" || !editsText(e.target));

/** snap — обычные привязки; free — без привязки (Shift); line — точка на линии (Alt); cross — пересечение (Ctrl). */
export type SnapMode = "snap" | "free" | "line" | "cross";
type Mods = { altKey?: boolean; ctrlKey?: boolean; metaKey?: boolean; shiftKey?: boolean };
/** Модификаторы → режим. Ctrl (Cmd) старше Alt, Alt старше Shift. */
export function snapMode(e: Mods): SnapMode {
  if (e.ctrlKey || e.metaKey) return "cross";
  if (e.altKey) return "line";
  if (e.shiftKey) return "free";
  return "snap";
}
/** Режим привязки к точке (Alt/Ctrl). */
export const isPointMode = (m: SnapMode): m is "line" | "cross" => m === "line" || m === "cross";
export const MODE_WORD: Record<SnapMode, string> = { snap: "", free: "Без привязки", line: "Alt — точка на линии", cross: "Ctrl — пересечение" };
/** Допуск привязки к точке, px экрана (Alt/Ctrl нажаты нарочно — чуть шире обычных 10 px). */
export const POINT_SNAP_PX = 14;

export type P2 = { h: number; v: number };
export type Seg2 = { a: P2; b: P2; what: string };
/** free — составляющие, которые привязка не задаёт (вдоль вертикальной линии — v, вдоль горизонтальной — h): они идут за курсором. */
export type PointHit = { p: P2; what: string; d: number; kind: "line" | "cross"; free?: { h: boolean; v: boolean } };

const r1 = (v: number) => { const r = Math.round(v * 10) / 10; return r === 0 ? 0 : r; };
/** Точка помещения → оси экрана вида. */
export function toView(p: V3, look: V3): P2 { const { h, v } = viewAxes(look); return { h: dot(p, h), v: dot(p, v) }; }
/** Оси экрана → точка помещения; глубина (вдоль взгляда) — как у точки depth. */
export function fromView(p: P2, look: V3, depth: V3): V3 {
  const { h, v } = viewAxes(look), k = dot(depth, look);
  return { x: h.x * p.h + v.x * p.v + look.x * k, y: h.y * p.h + v.y * p.v + look.y * k, z: h.z * p.h + v.z * p.v + look.z * k };
}
/** Сдвиг по осям экрана → сдвиг в помещении (без составляющей вдоль взгляда). */
export function viewDelta(dh: number, dv: number, look: V3): V3 { return fromView({ h: dh, v: dv }, look, { x: 0, y: 0, z: 0 }); }
/** Линии вида (GuideLine, guides.candidateLines) → отрезки в осях экрана; отрезки нулевой длины отбрасываются. */
export function toSegments(lines: GuideLine[], look: V3): Seg2[] {
  const out: Seg2[] = [];
  for (const l of lines) {
    const a = toView(l.a, look), b = toView(l.b, look);
    if (Math.hypot(b.h - a.h, b.v - a.v) > 1e-6) out.push({ a, b, what: l.what });
  }
  return out;
}
/** Ближайшая к p точка отрезка (перпендикуляр, у концов — сам конец). */
export function closestOnSegment(p: P2, s: Seg2): P2 {
  const dh = s.b.h - s.a.h, dv = s.b.v - s.a.v, L = dh * dh + dv * dv;
  const t = L ? Math.max(0, Math.min(1, ((p.h - s.a.h) * dh + (p.v - s.a.v) * dv) / L)) : 0;
  return { h: s.a.h + t * dh, v: s.a.v + t * dv };
}
const dist = (a: P2, b: P2) => Math.hypot(a.h - b.h, a.v - b.v);
/** Alt: точка на ближайшей линии в пределах tol (мм). */
export function nearestOnLine(p: P2, segs: Seg2[], tol: number): PointHit | undefined {
  let best: PointHit | undefined;
  for (const s of segs) {
    const q = closestOnSegment(p, s), d = dist(p, q);
    const dh = Math.abs(s.b.h - s.a.h), dv = Math.abs(s.b.v - s.a.v), free = { h: dv < 1e-6 * (dh + dv), v: dh < 1e-6 * (dh + dv) };
    if (d <= tol && (!best || d < best.d - 1e-9)) best = { p: { h: r1(q.h), v: r1(q.v) }, what: s.what, d, kind: "line", free };
  }
  return best;
}
/** Пересечение двух отрезков (концы продлеваются на ext мм — край, упёртый в стену, «пересекает» её). Параллельные — нет. */
export function segmentCross(s1: Seg2, s2: Seg2, ext = 0): P2 | undefined {
  const d1h = s1.b.h - s1.a.h, d1v = s1.b.v - s1.a.v, d2h = s2.b.h - s2.a.h, d2v = s2.b.v - s2.a.v;
  const L1 = Math.hypot(d1h, d1v), L2 = Math.hypot(d2h, d2v), den = d1h * d2v - d1v * d2h;
  if (!L1 || !L2 || Math.abs(den) < 1e-6 * L1 * L2) return undefined;
  const wh = s2.a.h - s1.a.h, wv = s2.a.v - s1.a.v, t = (wh * d2v - wv * d2h) / den, u = (wh * d1v - wv * d1h) / den;
  const e1 = ext / L1, e2 = ext / L2;
  if (t < -e1 || t > 1 + e1 || u < -e2 || u > 1 + e2) return undefined;
  return { h: s1.a.h + t * d1h, v: s1.a.v + t * d1v };
}
/** Имя пересечения: две вспомогательные — «вспомогательные линии», стена × стена — «угол помещения», края одного корпуса — «угол: край …». */
export const crossName = (a: string, b: string) =>
  a !== b ? a + " × " + b : a === "вспомогательная линия" ? "вспомогательные линии" : a === "стена" ? "угол помещения" : "угол: " + a;
/** Ctrl: ближайшее к p пересечение двух линий в пределах tol (мм). В расчёт идут только линии не дальше 2·tol от курсора. */
export function nearestCross(p: P2, segs: Seg2[], tol: number): PointHit | undefined {
  const near = segs.filter((s) => dist(p, closestOnSegment(p, s)) <= tol * 2);
  let best: PointHit | undefined;
  for (let i = 0; i < near.length; i++)
    for (let j = i + 1; j < near.length; j++) {
      const q = segmentCross(near[i], near[j], tol);
      if (!q) continue;
      const d = dist(p, q);
      if (d <= tol && (!best || d < best.d - 1e-9)) best = { p: { h: r1(q.h), v: r1(q.v) }, what: crossName(near[i].what, near[j].what), d, kind: "cross" };
    }
  return best;
}
/** Привязка точки по режиму: line — на линию, cross — к пересечению; иначе undefined. */
export function pointSnap(mode: SnapMode, p: P2, segs: Seg2[], tol: number): PointHit | undefined {
  return mode === "line" ? nearestOnLine(p, segs, tol) : mode === "cross" ? nearestCross(p, segs, tol) : undefined;
}
/** Ход по одной оси dir (линия Q вдоль своей нормали, край «↔» вдоль ширины): линии, параллельные ходу, для Alt не в счёт —
 *  иначе у пола побеждает пол и ход вдоль оси нулевой (критик 29.10, п.2). */
export function acrossSegments(segs: Seg2[], dir: P2): Seg2[] {
  const L = Math.hypot(dir.h, dir.v) || 1;
  return segs.filter((s) => { const dh = s.b.h - s.a.h, dv = s.b.v - s.a.v, l = Math.hypot(dh, dv) || 1; return Math.abs(dh * dir.v - dv * dir.h) / (l * L) > 0.05; });
}
/** Тянется точка ref (угол, опорный угол корпуса, курсор у линии Q) на ход delta (оси экрана): с привязкой — ход до пойманной
 *  точки, иначе ход как есть (без привязки, до 0,1 мм — шаг округляет потребитель). */
export function snapDelta(mode: SnapMode, ref: P2, delta: P2, segs: Seg2[], tol: number): { delta: P2; hit?: PointHit } {
  const hit = pointSnap(mode, { h: ref.h + delta.h, v: ref.v + delta.v }, segs, tol);
  if (!hit) return { delta };
  return { delta: { h: hit.free?.h ? Math.round(delta.h) : r1(hit.p.h - ref.h), v: hit.free?.v ? Math.round(delta.v) : r1(hit.p.v - ref.v) }, hit };
}
/** Край, который ходит только вдоль o (единичный, оси экрана; ручка «↔»): точка края at, вдоль края — где курсор.
 *  Итог — добавка хода вдоль o до пойманной точки (0 — не поймали). */
export function snapAlong(mode: SnapMode, at: P2, o: P2, cursor: P2, segs: Seg2[], tol: number): { shift: number; hit?: PointHit } {
  const perp = { h: -o.v, v: o.h }, k = (cursor.h - at.h) * perp.h + (cursor.v - at.v) * perp.v;
  const P = { h: at.h + perp.h * k, v: at.v + perp.v * k }, hit = pointSnap(mode, P, mode === "line" ? acrossSegments(segs, o) : segs, tol);
  return hit ? { shift: (hit.p.h - P.h) * o.h + (hit.p.v - P.v) * o.v, hit } : { shift: 0 };
}
/** Опорная точка переноса корпуса: угол его контура в виде, ближайший к месту, где схватили. */
export function nearestOutlineCorner(points: V3[], look: V3, grab: P2): P2 {
  const q = points.map((p) => toView(p, look)), hs = q.map((p) => p.h), vs = q.map((p) => p.v);
  const h = Math.abs(grab.h - Math.min(...hs)) <= Math.abs(grab.h - Math.max(...hs)) ? Math.min(...hs) : Math.max(...hs);
  const v = Math.abs(grab.v - Math.min(...vs)) <= Math.abs(grab.v - Math.max(...vs)) ? Math.min(...vs) : Math.max(...vs);
  return { h, v };
}
/** Плашка: что поймали. */
export const hitText = (hit: PointHit | undefined, mode: SnapMode) =>
  isPointMode(mode) ? (hit ? (mode === "line" ? "Alt · на линии: " : "Ctrl · пересечение: ") + hit.what : mode === "line" ? "Alt · рядом нет линии" : "Ctrl · рядом нет пересечения") : MODE_WORD[mode];
