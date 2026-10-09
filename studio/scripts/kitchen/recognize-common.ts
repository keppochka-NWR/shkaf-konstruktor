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
