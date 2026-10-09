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

/** Есть ли у стяжки/царги крепёж в боковинах корпуса: конфирмат/евровинт/эксцентрик/шкант в её полосе по высоте и глубине у наружной
 *  грани боковин (x ≤ xL или x ≥ xR). k21 m02: передняя стяжка мойки в проекте без крепежа — студия его не добавляет.
 *  Крепёж в полосе только внутри корпуса (стенки короба ящика «Задняя панель ящика» k01 m04/m05, k02 m04/m05, k07 m02, k11 m03, k04 m02:
 *  конфирматы в боковинах короба x=29/571) — не крепёж к боковинам корпуса: студия крепит стяжку только через боковины корпуса, и
 *  такие конфирматы встали бы в боковины, где в Базисе отверстий нет (+8…+28 лишних отверстий). Поэтому «без крепежа» (правило 2:
 *  студия не добавляет того, чего нет в Базисе); крепёж короба ящика студия пока не воспроизводит — его нет, а не он не там. */
export function railFastened(b: Box, hardware: Hw[], xL: number, xR: number): boolean {
  const inBand = (h: Hw) => (/конфирмат|эксцентрик|шкант/.test(h.category) || /^Евровинт/.test(h.name)) && h.pos[1] >= b.y0 - 1 && h.pos[1] <= b.y1 + 1 && h.pos[2] >= b.z0 - 1 && h.pos[2] <= b.z1 + 1;
  return hardware.some((h) => inBand(h) && (h.pos[0] <= xL + 1 || h.pos[0] >= xR - 1));
}

const isConf = (h: Hw) => h.category === "конфирмат" || /^Евровинт/.test(h.name);
/** Высоты конфирматов стяжки на ребре от её низа (через боковины корпуса, x ≤ xL или x ≥ xR), если в проекте не один по центру.
 *  По всем 34 кухням у стяжек на ребре между боковинами высотой 100: один по центру — 37 сторон, два (34 и 66) — 21 сторона, по проекту;
 *  у стяжек 124–200 — всегда два. Берём, только если слева и справа одинаково; иначе — правило студии (один по центру).
 *  В боковинах конфирматов нет ни слева, ни справа — [] (k15 m08, k19 m02: стяжка навесного без конфирматов; студия их не добавляет). */
export function railConfY(b: Box, hardware: Hw[], xL: number, xR: number): number[] | undefined {
  const inBand = (h: Hw) => isConf(h) && h.pos[1] >= b.y0 - 1 && h.pos[1] <= b.y1 + 1 && h.pos[2] >= b.z0 - 1 && h.pos[2] <= b.z1 + 1;
  const ys = (f: (h: Hw) => boolean) => hardware.filter((h) => inBand(h) && f(h)).map((h) => r1(h.pos[1] - b.y0)).sort((a, c) => a - c);
  const L = ys((h) => h.pos[0] <= xL + 1), R = ys((h) => h.pos[0] >= xR - 1), mid = (b.y1 - b.y0) / 2;
  if (L.length !== R.length || L.some((v, i) => Math.abs(v - R[i]) > 0.6)) return undefined;
  if (!L.length) return [];
  return L.length === 1 && Math.abs(L[0] - mid) < 0.6 ? undefined : L;
}

/** Конфирматы через крышу (стяжка под ней) или дно (стяжка на нём) в торец стяжки — мм от левого конца стяжки, по проекту Базиса:
 *  точки на наружной пласти горизонтали hz в пределах ширины стяжки (k03: 2 через крышу в 51–60 от концов; k04: 56–65; k20: один
 *  по центру; у каждого проекта своё — общего правила нет). Нет таких — undefined. */
export function railTopConf(b: Box, hardware: Hw[], hz?: Box): number[] | undefined {
  if (!hz) return undefined;
  const yo = hz.y0 >= b.y1 - 0.5 ? hz.y1 : hz.y0; // наружная пласть крыши (над стяжкой) или дна (под ней)
  const xs = hardware.filter((h) => isConf(h) && h.pos[2] >= b.z0 - 0.5 && h.pos[2] <= b.z1 + 0.5 && Math.abs(h.pos[1] - yo) < 0.6 && h.pos[0] > b.x0 + 0.5 && h.pos[0] < b.x1 - 0.5)
    .map((h) => r1(h.pos[0] - b.x0)).sort((a, c) => a - c);
  return xs.length ? xs : undefined;
}

/** Крепёж стяжки на ребре по проекту Базиса — одно правило для нижних, навесных и антресолей (слияние n4-base railConfY, n4-wall railConf):
 *  confY — конфирматы через боковины (Module.rails[].confY), topConf — через крышу/дно (rails[].topConf). Без полей — правило студии. */
export function railConf(b: Box, hardware: Hw[], xL: number, xR: number, hz?: Box): Pick<Rail, "confY" | "topConf"> {
  const confY = railConfY(b, hardware, xL, xR), topConf = railTopConf(b, hardware, hz);
  return { ...(confY ? { confY } : {}), ...(topConf ? { topConf } : {}) };
}

/** Крепёж корпуса проекта: «Евровинт 6х50» (шаблоны «Т_» k33, k34 — у Базиса в категории «прочее») вместо конфирмата 7×50. */
export const isEuro6 = (h: { name: string }) => /^Евровинт 6/.test(h.name);
export function screwKind(hardware: Hw[]): "euro-6x50" | undefined {
  return hardware.some(isEuro6) && !hardware.some((h) => h.category === "конфирмат") ? "euro-6x50" : undefined;
}
