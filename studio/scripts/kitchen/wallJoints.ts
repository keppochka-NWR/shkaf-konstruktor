// Крепёж дна/крыши навесного по Базису: отступы конфирматов (эксцентриков) от задней и передней кромки горизонтали — у каждого стыка свои.
// Статистика по 34 кухням (09.10.2026): у навесных один общий отступ (confirmatInset) не держится — дно короче спереди с крепежом
// «как у полного дна» (k10 m10: 53 / 28,5), дно со своими 56,8 / 56,7 при крыше 53 / 53 (k10 m09), разные отступы у дна и крыши (k22, k24, k06).
// Значения читаются из проекта Базиса и хранятся относительно кромок детали — переживают изменение глубины корпуса.
import type { RefHardware, RefPanel } from "./compare";

type B = { x0: number; y0: number; z0: number; x1: number; y1: number; z1: number };
type PB = { p: RefPanel; b: B };
const r1 = (v: number) => Math.round(v * 10) / 10;

type Side = "+x" | "-x" | "+z" | "-z";
/** Кромка съёмных полок навесного по Базису (статистика по навесным: 111 полок по кругу, 26 — перед и зад, 18 — только перед;
 *  10 полок k10 — 0,5 при корпусе 0,4): толщина и торцы первой полки на полкодержателях, если отличаются от «по кругу, как корпус». */
export function wallShelfEdges(shelves: PB[], pins: RefHardware[], bodyT: number): { shelfT?: number; shelfSides?: Side[] } {
  const s = shelves.find((q) => pins.some((h) => Math.abs(h.pos[1] - q.b.y0) < 2));
  if (!s) return {};
  const ed = ((s.p as unknown as { edges?: { side: string; thick: number }[] }).edges ?? []).filter((e) => e.thick > 0);
  const sides = (["+x", "-x", "+z", "-z"] as Side[]).filter((d) => ed.some((e) => e.side === d));
  const th = ed.length ? Math.max(...ed.map((e) => e.thick)) : bodyT;
  return { ...(Math.abs(th - bodyT) > 0.01 ? { shelfT: th } : {}), ...(sides.length !== 4 ? { shelfSides: sides } : {}) };
}

/** Шкант рядом с эксцентриком стыка «дно под боковинами» (k30: эксцентрик на верхней пласти дна, шкант на нижней, 32 мм внутрь стыка):
 *  смещение шканта от эксцентрика по глубине. Общий поиск по высоте эксцентрика его не находит — шкант на 16 ниже. */
export function bottomUnderDowelOffset(hardware: RefHardware[], bottom: PB): number | null {
  const ecc = hardware.filter((h) => h.category === "эксцентрик" && Math.abs(h.pos[1] - bottom.b.y1) < 1);
  const dow = hardware.filter((h) => h.category === "шкант" && Math.abs(h.pos[1] - bottom.b.y0) < 1);
  if (!ecc.length || !dow.length) return null;
  const e0 = ecc[0], d0 = dow.filter((d) => Math.abs(d.pos[0] - e0.pos[0]) <= 9).sort((a, c) => Math.abs(a.pos[2] - e0.pos[2]) - Math.abs(c.pos[2] - e0.pos[2]))[0];
  return d0 ? r1(Math.abs(d0.pos[2] - e0.pos[2])) : null;
}

/** Торцы жёсткой полки навесного (без полкодержателей), кромлёные в Базисе (k05 m10/m11: перед и зад): только если не «по кругу». */
export function wallFixedShelfEdges(fixed: PB | undefined): Side[] | undefined {
  if (!fixed) return undefined;
  const ed = ((fixed.p as unknown as { edges?: { side: string; thick: number }[] }).edges ?? []).filter((e) => e.thick > 0);
  const sides = (["+x", "-x", "+z", "-z"] as Side[]).filter((d) => ed.some((e) => e.side === d));
  return sides.length === 4 ? undefined : sides;
}

/** Торцы дна и крыши навесного, кромлёные в Базисе (k32 — по кругу, включая торцы у боковин): только если отличаются от правила студии. */
export function wallEndEdges(bottom: PB | undefined, top: PB | undefined, def: { bottom: Side[]; top: Side[] }): Partial<Record<"bottom" | "top", Side[]>> {
  const out: Partial<Record<"bottom" | "top", Side[]>> = {};
  for (const [id, q] of [["bottom", bottom], ["top", top]] as const) {
    if (!q) continue;
    const ed = ((q.p as unknown as { edges?: { side: string; thick: number }[] }).edges ?? []).filter((e) => e.thick > 0);
    const sides = (["+x", "-x", "+z", "-z"] as Side[]).filter((d) => ed.some((e) => e.side === d));
    const d0 = [...def[id]].sort().join(), d1 = [...sides].sort().join();
    if (d0 !== d1) out[id] = sides;
  }
  return out;
}

/** Паз в торце детали (Базис «Паз торцевой» 2,5×10 в переднем торце дна — k06 m10, k10 m08–m10, k15 m09): коробка паза bb у торца ±W
 *  и внутри толщины → Groove с end. ax — оси детали студии (L, W, t), lo/hi — её границы. null — паз не торцевой. */
export function endGroove(bb: number[], ax: { L: number; W: number; t: number }, lo: number[], hi: number[], name: string) {
  const inside = bb[ax.t] > lo[ax.t] + 0.5 && bb[ax.t + 3] < hi[ax.t] - 0.5;
  if (!inside) return null;
  // торец — на конце ширины детали (W) или, у узкой детали, на конце длины (L: дно 118×275 у k06 m10 — передний торец по длине, endL)
  for (const [E, A, endL] of [[ax.W, ax.L, false], [ax.L, ax.W, true]] as const) {
    const atHi = Math.abs(bb[E + 3] - hi[E]) < 0.6, atLo = Math.abs(bb[E] - lo[E]) < 0.6;
    if (atHi === atLo) continue;
    return { face: "+" as const, end: (atHi ? "+" : "-") as "+" | "-", ...(endL ? { endL: true as const } : {}), along: [r1(bb[A] - lo[A]), r1(hi[A] - bb[A + 3])] as [number, number],
      across: [r1(bb[ax.t] - lo[ax.t]), r1(bb[ax.t + 3] - lo[ax.t])] as [number, number], depth: r1(bb[E + 3] - bb[E]), name };
  }
  return null;
}

/** Стыки дна/крыши, у которых в проекте нет ни конфирмата, ни эксцентрика (k08 m10, k14 m06, k34 m04: дно под вытяжку перед ХДФ). */
export function wallJointNone(hardware: RefHardware[], joints: [string, PB | undefined][], left: PB, right: PB): string[] {
  const fast = hardware.filter((h) => h.category === "конфирмат" || h.category === "эксцентрик");
  if (!fast.length) return [];
  const out: string[] = [];
  for (const [id, q] of joints) {
    if (!q) continue;
    for (const [side, s] of [["left", left], ["right", right]] as const)
      if (!fast.some((h) => h.pos[0] >= s.b.x0 - 1 && h.pos[0] <= s.b.x1 + 1 && h.pos[1] >= q.b.y0 - 1 && h.pos[1] <= q.b.y1 + 1 && h.pos[2] >= q.b.z0 - 1 && h.pos[2] <= q.b.z1 + 1)) out.push(`${id}:${side}`);
  }
  return out;
}

/** Отступы крепежа стыков «горизонталь × боковина» [от задней кромки, от передней] там, где они отличаются от общего inset. */
export function wallJointZ(hardware: RefHardware[], joints: [string, PB | undefined][], left: PB, right: PB, inset: number): Record<string, [number, number]> {
  const out: Record<string, [number, number]> = {};
  const fast = hardware.filter((h) => h.category === "конфирмат" || h.category === "эксцентрик");
  for (const [id, q] of joints) {
    if (!q) continue;
    for (const [side, s] of [["left", left], ["right", right]] as const) {
      const zs = fast.filter((h) => h.pos[0] >= s.b.x0 - 1 && h.pos[0] <= s.b.x1 + 1 && h.pos[1] >= q.b.y0 - 1 && h.pos[1] <= q.b.y1 + 1 && h.pos[2] > q.b.z0 && h.pos[2] < q.b.z1).map((h) => h.pos[2]).sort((a, c) => a - c);
      if (zs.length !== 2) continue;
      const v: [number, number] = [r1(zs[0] - q.b.z0), r1(q.b.z1 - zs[1])];
      if (Math.abs(v[0] - inset) > 0.5 || Math.abs(v[1] - inset) > 0.5) out[`${id}:${side}`] = v;
    }
  }
  return out;
}
