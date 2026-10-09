// Общие правила распознавания модулей Базиса (кухни), которыми пользуются разные архетипы (мойки, нижние распашные, ящики…).
// Функции маленькие и чистые: на вход — коробки панелей эталона, на выход — параметры модуля студии. Правила — по статистике 34 кухонь.
import type { Module } from "../../src/model";

export const r1 = (v: number) => Math.round(v * 10) / 10;
export type Box = { x0: number; y0: number; z0: number; x1: number; y1: number; z1: number };
export type Rail = NonNullable<Module["rails"]>[number];

/** Стяжка на ребре между боковинами: место (передняя — в 30 мм от лица), высота, высота низа (если не у верха боковин)
 *  и отступ от кромки боковин — у части моек Базиса задняя стяжка отступлена от задней кромки на 1–2 мм. */
export function edgeRail(b: Box, top: number, sideZ0: number, sideZ1: number): Rail {
  const front = b.z1 >= sideZ1 - 30, atTop = b.y1 >= top - 0.5;
  const sb = r1(front ? sideZ1 - b.z1 : b.z0 - sideZ0);
  return { place: front ? "front-top" : "rear-top", height: r1(b.y1 - b.y0), ...(atTop ? {} : { at: r1(b.y0) }), ...(sb > 0.5 ? { setback: sb } : {}) };
}

type Hw = { name: string; category: string; pos: number[] };
/** Саморезы площадки опоры: у КАЖДОЙ опоры Базиса 4 «3x3» по квадрату 31×31 вокруг оси на её высоте (k21, k24). Иначе — нет. */
export function legScrews(hardware: Hw[]): boolean {
  const legs = hardware.filter((h) => h.category === "опора"), s = hardware.filter((h) => h.name === "3x3");
  return legs.length > 0 && legs.every((l) => s.filter((h) => Math.abs(h.pos[1] - l.pos[1]) < 0.6 && Math.abs(Math.abs(h.pos[0] - l.pos[0]) - 15.5) < 0.6 && Math.abs(Math.abs(h.pos[2] - l.pos[2]) - 15.5) < 0.6).length === 4);
}

/** Кромится ли верхний торец боковины низа: в большинстве кухонь да, в k03, k20, k23 — нет (13 из 151 нижних). */
export function sideTopEdged(side: { edges?: { side: string; thick: number }[] }): boolean {
  return (side.edges ?? []).some((e) => e.side === "+y" && e.thick > 0);
}

/** Есть ли у стяжки/царги крепёж в боковинах: любой конфирмат/евровинт/эксцентрик/шкант в её полосе по высоте и глубине у наружной
 *  грани боковин (x ≤ xL или x ≥ xR). k21 m02: передняя стяжка мойки в проекте без крепежа — студия его не добавляет. */
export function railFastened(b: Box, hardware: Hw[], xL: number, xR: number): boolean {
  return hardware.some((h) => /конфирмат|эксцентрик|шкант/.test(h.category) || /^Евровинт/.test(h.name) ? h.pos[1] >= b.y0 - 1 && h.pos[1] <= b.y1 + 1 && h.pos[2] >= b.z0 - 1 && h.pos[2] <= b.z1 + 1 && (h.pos[0] <= xL + 1 || h.pos[0] >= xR - 1) : false);
}

/** Конфирматы стяжки на ребре — как в Базисе (только кухни):
 *  conf — точки в боковинах по высоте стяжки от её низа, когда их в Базисе больше одной (k03: 34 и 66 у стяжки 100 — 10 модулей
 *  базы; у остальных одна по центру — студия так и ставит, поле не пишется);
 *  topConf — конфирматы через крышу в стяжку, стоящую под крышей: отступ от левой внутренней грани боковины вдоль стяжки
 *  (k03, k04 — по 2, в 51–65 мм от боковин; у каждого проекта своё, поэтому по проекту, а не правилом). */
export function railConfirmats(b: Box, hardware: Hw[], xL: number, xR: number, t: number, top: number): { conf?: number[]; topConf?: number[] } {
  const c = hardware.filter((h) => h.category === "конфирмат"), inZ = (h: Hw) => h.pos[2] >= b.z0 - 1 && h.pos[2] <= b.z1 + 1;
  const side = c.filter((h) => inZ(h) && h.pos[1] >= b.y0 - 1 && h.pos[1] <= b.y1 + 1 && (h.pos[0] <= xL + 1 || h.pos[0] >= xR - 1));
  const ys = [...new Set(side.map((h) => r1(h.pos[1] - b.y0)))].sort((p, q) => p - q);
  const underTop = b.y1 >= top - t - 1;
  const xs = underTop ? c.filter((h) => inZ(h) && h.pos[1] >= top - 1 && h.pos[0] > xL + t + 1 && h.pos[0] < xR - t - 1).map((h) => r1(h.pos[0] - (xL + t))).sort((p, q) => p - q) : [];
  return { ...(ys.length > 1 ? { conf: ys } : {}), ...(xs.length ? { topConf: xs } : {}) };
}

/** Гвозди набивного ХДФ — как в Базисе (k01, k03, k07, k24 — 19 модулей базы): точки на задней плоскости ХДФ от левого
 *  наружного края и низа корпуса и поворот сетки Базиса. Шаг у проектов разный (138, 186…), поэтому по проекту. */
export function hdfNails(hardware: (Hw & { quat?: number[]; mesh?: string | null })[], x0: number, y0: number): { at: [number, number]; quat?: number[] }[] {
  return hardware.filter((h) => /^Гвозд/.test(h.name)).map((h) => ({ at: [r1(h.pos[0] - x0), r1(h.pos[1] - y0)] as [number, number], ...(h.quat ? { quat: h.quat.map((v) => Math.round(v * 1e4) / 1e4) } : {}) }));
}

/** Крепёж корпуса проекта: «Евровинт 6х50» (шаблоны «Т_» k33, k34 — у Базиса в категории «прочее») вместо конфирмата 7×50. */
export const isEuro6 = (h: { name: string }) => /^Евровинт 6/.test(h.name);
export function screwKind(hardware: Hw[]): "euro-6x50" | undefined {
  return hardware.some(isEuro6) && !hardware.some((h) => h.category === "конфирмат") ? "euro-6x50" : undefined;
}
