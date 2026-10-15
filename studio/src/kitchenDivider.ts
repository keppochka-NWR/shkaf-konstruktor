// Пакет 5 развития калькулятора (backlog F_PARTITION): вертикальная перегородка кухонного модуля Базиса между дном и крышей —
// это перегородка секций студии (Module.sections, boxes(): `<секция>:divider`), а не новая деталь. У кухни Базиса своё только то,
// чем она отличается от шкафа: глубина (от задней кромки боковин z0 до лица боковин минус front) и крепёж каждого конца
// по проекту. Статистика по базе (34 кухни, перегородки во всю глубину между дном и крышей): конфирматы с обоих концов
// (k07 m02/m04, k14 m01, k17 m08, k20 m10, k30 m01), эксцентрик + шкант снизу и конфирмат сверху (k01 m07, k09 m01, k17 m08,
// k30 m15, k31 m11, k31 m23), эксцентрики с обоих концов (k03 m12, k15 m07, k15 m10, k17 m07, k31 m10); точки — симметрично от концов
// перегородки (51,5–65,5 мм), шкант — на 32 ближе к середине, бочонок D15×12 — в одну пласть перегородки в 34 от стыка.
import type { Module } from "./model";

export type KitchenDividerEnd = {
  kind: "conf" | "ecc";
  /** Отступы точек крепежа от задней и передней кромок перегородки, мм (правило «от кромки детали»). */
  ins: [number, number];
  /** Эксцентрик: пласть перегородки с бочонком D15 (Базис: «-x» — левая, «+x» — правая). */
  face?: "left" | "right";
  /** Эксцентрик: шкант 8×30 на столько мм ближе к середине перегородки, чем эксцентрик (Базис — 32); нет поля — без шкантов. */
  dowel?: number;
};
export type KitchenDivider = {
  /** Задняя кромка перегородки от задней кромки боковин, мм. */
  z0: number;
  /** Передняя кромка перегородки от лица боковин, мм (0 — вровень). */
  front?: number;
  bottom?: KitchenDividerEnd;
  top?: KitchenDividerEnd;
};

const fin = (v: unknown) => typeof v === "number" && Number.isFinite(v);
function parseEnd(x: unknown): KitchenDividerEnd | undefined {
  const e = x as Partial<KitchenDividerEnd> | undefined;
  if (!e || (e.kind !== "conf" && e.kind !== "ecc") || !Array.isArray(e.ins) || e.ins.length !== 2 || !e.ins.every(fin)) return undefined;
  return { kind: e.kind, ins: [Number(e.ins[0]), Number(e.ins[1])], ...(e.kind === "ecc" && (e.face === "left" || e.face === "right") ? { face: e.face } : {}), ...(e.kind === "ecc" && fin(e.dowel) ? { dowel: Number(e.dowel) } : {}) };
}
export function parseDivider(x: unknown): { divider?: KitchenDivider } {
  const d = x as Partial<KitchenDivider> | undefined;
  if (!d || !fin(d.z0)) return {};
  const bottom = parseEnd(d.bottom), top = parseEnd(d.top);
  return { divider: { z0: Number(d.z0), ...(fin(d.front) && Number(d.front) ? { front: Number(d.front) } : {}), ...(bottom ? { bottom } : {}), ...(top ? { top } : {}) } };
}

/** Перегородка кухни Базиса по глубине: [z задней кромки, z передней]; undefined — перегородка шкафа студии (как прежде). */
export function kitchenDividerZ(m: Module): [number, number] | undefined {
  const d = m.kitchen?.divider;
  return d ? [d.z0, m.depth - (d.front ?? 0)] : undefined;
}

export function kitchenDividerErrors(m: Module): string[] {
  const d = m.kitchen?.divider;
  if (!d) return [];
  const [z0, z1] = kitchenDividerZ(m)!, out: string[] = [];
  if (m.sections.length < 2) out.push("Перегородка кухни: нужно не менее двух секций.");
  if (!(z0 >= 0 && z1 - z0 >= 60)) out.push("Перегородка кухни: глубина от 60 мм в пределах корпуса.");
  for (const [k, e] of [["низ", d.bottom], ["верх", d.top]] as const)
    if (e && (e.ins[0] < 8 || e.ins[1] < 8 || e.ins[0] + e.ins[1] + (e.dowel ?? 0) * 2 > z1 - z0)) out.push(`Перегородка кухни: крепёж (${k}) не помещается по глубине перегородки.`);
  return out;
}

/** Зеркало модуля: бочонок эксцентрика — в другую пласть. */
export function mirrorDivider(d: KitchenDivider): KitchenDivider {
  const f = (e?: KitchenDividerEnd) => (e?.face ? { ...e, face: e.face === "left" ? ("right" as const) : ("left" as const) } : e);
  return { ...d, ...(d.bottom ? { bottom: f(d.bottom) } : {}), ...(d.top ? { top: f(d.top) } : {}) };
}
