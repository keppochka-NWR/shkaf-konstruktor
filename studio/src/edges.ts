// Кромка детали по направлениям торцов в осях модуля. Part.edge = [e0, e1, e2, e3]:
// e0/e1 — торцы на концах длины детали (−L / +L), e2/e3 — торцы по ширине (+W / −W); так считают смета и бирки (k<2 — длина кромки = ширина детали).
import type { Part } from "./model";

const AX = ["x", "y", "z"] as const;
/** Оси детали: толщина, длина (большая из двух других), ширина. */
export function partAxes(p: Pick<Part, "size">) {
  const t = p.size.indexOf(Math.min(...p.size)), rest = [0, 1, 2].filter((i) => i !== t);
  const [L, W] = p.size[rest[0]] >= p.size[rest[1]] ? [rest[0], rest[1]] : [rest[1], rest[0]];
  return { t, L, W };
}
/** Направление каждого торца: индекс кромки → '+x' и т. п. */
export function edgeDirs(p: Pick<Part, "size">): string[] {
  const { L, W } = partAxes(p);
  return ["-" + AX[L], "+" + AX[L], "+" + AX[W], "-" + AX[W]];
}
/** Кромка детали как множество направлений с толщиной (без нулевых). */
export function edgeByDir(p: Pick<Part, "size" | "edge">): Record<string, number> {
  const dirs = edgeDirs(p), out: Record<string, number> = {};
  p.edge.forEach((e, i) => { if (e > 0) out[dirs[i]] = e; });
  return out;
}
/** Задать кромку по направлениям: dirs — какие торцы кромить, thick — толщина, остальные без кромки. */
export function setEdges(p: Part, dirs: string[], thick: number) {
  p.edge = edgeDirs(p).map((d) => (dirs.includes(d) ? thick : 0)) as Part["edge"];
}
