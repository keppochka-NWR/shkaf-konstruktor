// Растяжение модуля за угол, как эластичная секция Базиса (решение Макса 29.10.2026, РЕШЕНИЯ.md): в ортогональном виде тянешь
// за угол выбранного корпуса — двигается этот угол, противоположный стоит на месте. Спереди — ширина + высота, сверху — ширина +
// глубина, сбоку (справа/слева) — глубина + высота. Привязки: края других корпусов, стены, пол, потолок (и потолок минус зазор
// по регламенту), вспомогательные линии (guides.ts); без привязки — размер шагом 10 мм, Alt — 1 мм.
// Ширина идёт через правило ряда (rowResize.planStretch — как ручка «↔»: свободный край не заходит в соседа, стык вплотную
// двигается вместе с соседом), высота и глубина — как ввод размера в панели (App: preparedModule/applyDimension).
// Здесь только геометрия и привязки (без React и three) — проверяется тестами tests/corner-stretch.test.ts.
import { localToRoom, type PlacedModule, type Project } from "./project";
import type { Module } from "./model";
import { ceilingClearance } from "./measurement";
import { carcassCorners, dot, guidePlanes, parseTyped, snapOut, type Guide, type SnapPlane, type V3 } from "./guides";

export type Dim = "width" | "height" | "depth";
/** Какой край оси двигается: lo — левый/нижний/задний, hi — правый/верхний/передний. */
export type End = "lo" | "hi";
export type AxisPull = { end: End; raw: number };
/** Запрос от сцены: какие края тянутся и на сколько мм наружу (по курсору), привязка (Alt — нет), допуск привязки в мм на экране,
 *  вспомогательные линии текущего вида. */
export type CornerPull = { mid: string; width?: AxisPull; height?: AxisPull; depth?: AxisPull; snap: boolean; tol: number; guides?: Guide[];
  /** Размеры, набранные с клавиатуры во время тяги («600;2400»): итог должен совпасть точно, иначе отказ (exactProblem). */
  exact?: Partial<Record<Dim, number>> };
/** Что получится: размеры, к чему привязалось, почему нельзя; preview — корпуса после правки (для показа на сцене). */
export type CornerPlan = { width: number; height: number; depth: number; snapped: string[]; problem?: string; preview?: PlacedModule[] };
export const SIZE_STEP = 10;

/** Пары размеров по виду. 3D — нет. */
export function cornerDims(view: string): [Dim, Dim] | null {
  return view === "front" ? ["width", "height"] : view === "top" ? ["width", "depth"] : view === "side" || view === "left" ? ["depth", "height"] : null;
}
const r1 = (v: number) => { const r = Math.round(v * 10) / 10; return r === 0 ? 0 : r; };
const size = (m: Module, d: Dim) => (d === "width" ? m.width : d === "height" ? m.height : m.depth);
/** Ось размера в координатах помещения (единичная): ширина — +u корпуса, глубина — +v (к фасаду), высота — +Y. */
export function axisOf(a: PlacedModule, d: Dim): V3 {
  if (d === "height") return { x: 0, y: 1, z: 0 };
  const o = localToRoom(a, 0, 0), e = d === "width" ? localToRoom(a, 1, 0) : localToRoom(a, 0, 1);
  return { x: e.x - o.x, y: 0, z: e.z - o.z };
}
/** Точка на двигающемся крае и направление «наружу». */
export function edgeOf(a: PlacedModule, d: Dim, end: End): { E: V3; o: V3 } {
  const m = a.module, y0 = a.y ?? 0, ax = axisOf(a, d), k = end === "hi" ? 1 : -1;
  const q = d === "width" ? localToRoom(a, end === "hi" ? m.width : 0, 0) : d === "depth" ? localToRoom(a, 0, end === "hi" ? m.depth : 0) : localToRoom(a, 0, 0);
  const y = d === "height" ? y0 + (end === "hi" ? m.height : 0) : y0;
  return { E: { x: q.x, y, z: q.z }, o: { x: ax.x * k, y: ax.y * k, z: ax.z * k } };
}
/** Плоскости привязки края вдоль оси: края других корпусов, стены/пол/потолок (и потолок минус зазор), вспомогательные линии. */
export function snapPlanes(p: Project, a: PlacedModule, d: Dim, guides?: Guide[]): SnapPlane[] {
  const ax = axisOf(a, d), out: SnapPlane[] = [];
  for (const o of p.modules) {
    if (o.id === a.id) continue;
    const vals = carcassCorners(o).map((q) => dot(q, ax));
    out.push({ n: ax, at: Math.min(...vals), what: "край «" + o.module.name + "»" }, { n: ax, at: Math.max(...vals), what: "край «" + o.module.name + "»" });
  }
  const room = p.room, box: V3[] = [];
  for (const x of [0, room.width]) for (const y of [0, room.height]) for (const z of [0, room.depth]) box.push({ x, y, z });
  const vals = box.map((q) => dot(q, ax));
  if (d === "height") {
    out.push({ n: ax, at: 0, what: "пол" }, { n: ax, at: room.height, what: "потолок" });
    const c = ceilingClearance(room.ceiling);
    out.push({ n: ax, at: room.height - c, what: `потолок − ${c} мм` });
  } else out.push({ n: ax, at: Math.min(...vals), what: "стена" }, { n: ax, at: Math.max(...vals), what: "стена" });
  out.push(...guidePlanes(guides));
  return out;
}
/** Ход края raw (мм наружу) → итог: привязка к плоскости в пределах tol или размер шагом 10 мм (Alt — 1 мм). */
export function snapAxis(p: Project, a: PlacedModule, d: Dim, pull: AxisPull, snap: boolean, tol: number, guides?: Guide[]): { raw: number; size: number; what?: string } {
  const S = size(a.module, d);
  if (snap) {
    const { E, o } = edgeOf(a, d, pull.end), hit = snapOut(E, o, pull.raw, snapPlanes(p, a, d, guides), tol);
    if (hit) return { raw: hit.raw, size: r1(S + hit.raw), what: hit.what };
    const s = Math.round((S + pull.raw) / SIZE_STEP) * SIZE_STEP;
    return { raw: r1(s - S), size: s };
  }
  const s = Math.round(S + pull.raw);
  return { raw: r1(s - S), size: s };
}
/** Ширина — через правило ряда (planStretch): к вспомогательной линии — точно (без своей привязки planStretch), иначе — как «↔». */
export function widthPull(a: PlacedModule, pull: AxisPull, snap: boolean, tol: number, guides?: Guide[]): { side: "left" | "right"; raw: number; snap: boolean; what?: string } {
  const side = pull.end === "hi" ? "right" : "left";
  if (snap && guides?.length) {
    const { E, o } = edgeOf(a, "width", pull.end), hit = snapOut(E, o, pull.raw, guidePlanes(guides), tol);
    if (hit) return { side, raw: hit.raw, snap: false, what: hit.what };
  }
  return { side, raw: r1(pull.raw), snap };
}
/** Ход курсора delta (мм, в координатах помещения) → тяга углом: по каждой оси вида — проекция на «наружу» тянущегося края. */
export function cornerPullFromDelta(a: PlacedModule, dims: [Dim, Dim], ends: [End, End], delta: V3, snap: boolean, tol: number, guides?: Guide[]): CornerPull {
  const pull: CornerPull = { mid: a.id, snap, tol, guides };
  dims.forEach((d, i) => { const { o } = edgeOf(a, d, ends[i]); pull[d] = { end: ends[i], raw: r1(dot(delta, o)) }; });
  return pull;
}
export const DIM_WORD: Record<Dim, string> = { width: "ширина", height: "высота", depth: "глубина" };
/** Подсказка ручки угла (сцена и план). */
export const cornerHandleTitle = (dims: [Dim, Dim]) =>
  `Угол: тяните — ${DIM_WORD[dims[0]]} и ${DIM_WORD[dims[1]]}, противоположный угол на месте. Привязка к краям, стенам и вспомогательным линиям; Alt — без привязки. ` +
  `Во время тяги наберите размеры «${DIM_WORD[dims[0]]};${DIM_WORD[dims[1]]}», например «600;2400» (одно число — только ${DIM_WORD[dims[0]]}, «;2400» — только ${DIM_WORD[dims[1]]}) и Enter; Esc — отмена`;
/** Набранное во время тяги за угол (решение Макса 29.10.2026): «600;2400» — оба размера в порядке плашки (спереди ширина;высота,
 *  сверху/план ширина;глубина, сбоку глубина;высота), «600» — только первый, «;2400» — только второй. Пусто/не число — null. */
export function parseCornerTyped(text: string): [number | undefined, number | undefined] | null {
  const parts = text.split(";");
  if (parts.length > 2) return null;
  const vals = parts.map((s) => (s.trim() ? parseTyped(s) ?? NaN : undefined));
  if (vals.some((v) => v !== undefined && !Number.isFinite(v))) return null;
  const pair: [number | undefined, number | undefined] = [vals[0], vals[1]];
  return pair[0] === undefined && pair[1] === undefined ? null : pair;
}
/** Тяга по набранным размерам: края — по ручке (противоположный угол на месте), без привязок, точно до 1 мм. */
export function typedCornerPull(a: PlacedModule, dims: [Dim, Dim], ends: [End, End], text: string): { pull?: CornerPull; problem?: string } {
  const typed = parseCornerTyped(text);
  if (!typed) return {};
  const pull: CornerPull = { mid: a.id, snap: false, tol: 0, exact: {} };
  for (let i = 0; i < 2; i++) {
    const v = typed[i], d = dims[i];
    if (v === undefined) continue;
    const want = Math.round(v);
    if (want <= 0) return { problem: `${DIM_WORD[d][0].toUpperCase() + DIM_WORD[d].slice(1)} должна быть больше нуля.` };
    pull[d] = { end: ends[i], raw: r1(want - size(a.module, d)) };
    pull.exact![d] = want;
  }
  return { pull };
}
/** Набранный размер не получился (правило ряда упёрло край в соседа или стену, предел корпуса) — отказ с причиной, как у поля в панели. */
export function exactProblem(got: { width: number; height: number; depth: number }, exact?: Partial<Record<Dim, number>>): string | undefined {
  for (const d of ["width", "height", "depth"] as Dim[]) {
    const want = exact?.[d];
    if (want === undefined || Math.abs(got[d] - want) < 0.05) continue;
    const W = DIM_WORD[d][0].toUpperCase() + DIM_WORD[d].slice(1);
    return want > got[d] ? `${W} ${want} мм не получается: здесь можно не больше ${got[d]} мм (сосед, стена или предел корпуса).`
      : `${W} ${want} мм не получается: здесь можно не меньше ${got[d]} мм.`;
  }
  return undefined;
}
/** Новые высота/глубина модуля, противоположный край на месте: верх тянут — низ стоит (y тот же), низ тянут — верх стоит;
 *  фасад тянут — задняя стенка на месте, заднюю — фасад на месте. next — модуль после правки (ширина та же). */
export function keepOpposite(a: PlacedModule, next: Module, ends: { height?: End; depth?: End }): PlacedModule {
  const n: PlacedModule = { ...a, module: next };
  if (ends.height === "lo") n.y = r1((a.y ?? 0) + a.module.height - next.height);
  const fixV = ends.depth === "lo" ? a.module.depth : 0, fixV2 = ends.depth === "lo" ? next.depth : 0;
  const before = localToRoom(a, 0, fixV), after = localToRoom(n, 0, fixV2);
  n.x = r1(a.x + before.x - after.x); n.z = r1(a.z + before.z - after.z);
  return n;
}
