// Крепёж дна/крыши навесного по Базису: отступы конфирматов (эксцентриков) от задней и передней кромки горизонтали — у каждого стыка свои.
// Статистика по 34 кухням (09.10.2026): у навесных один общий отступ (confirmatInset) не держится — дно короче спереди с крепежом
// «как у полного дна» (k10 m10: 53 / 28,5), дно со своими 56,8 / 56,7 при крыше 53 / 53 (k10 m09), разные отступы у дна и крыши (k22, k24, k06).
// Значения читаются из проекта Базиса и хранятся относительно кромок детали — переживают изменение глубины корпуса.
import type { RefHardware, RefPanel } from "./compare";

type B = { x0: number; y0: number; z0: number; x1: number; y1: number; z1: number };
type PB = { p: RefPanel; b: B };
const r1 = (v: number) => Math.round(v * 10) / 10;

/** Паз в торце детали (Базис «Паз торцевой» 2,5×10 в переднем торце дна — k06 m10, k10 m08–m10, k15 m09): коробка паза bb у торца ±W
 *  и внутри толщины → Groove с end. ax — оси детали студии (L, W, t), lo/hi — её границы. null — паз не торцевой. */
export function endGroove(bb: number[], ax: { L: number; W: number; t: number }, lo: number[], hi: number[], name: string) {
  const inside = bb[ax.t] > lo[ax.t] + 0.5 && bb[ax.t + 3] < hi[ax.t] - 0.5;
  const atHi = Math.abs(bb[ax.W + 3] - hi[ax.W]) < 0.6, atLo = Math.abs(bb[ax.W] - lo[ax.W]) < 0.6;
  if (!inside || atHi === atLo) return null;
  return { face: "+" as const, end: (atHi ? "+" : "-") as "+" | "-", along: [r1(bb[ax.L] - lo[ax.L]), r1(hi[ax.L] - bb[ax.L + 3])] as [number, number],
    across: [r1(bb[ax.t] - lo[ax.t]), r1(bb[ax.t + 3] - lo[ax.t])] as [number, number], depth: r1(bb[ax.W + 3] - bb[ax.W]), name };
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
