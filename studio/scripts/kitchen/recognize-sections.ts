// Пакет 5 (backlog F_PARTITION): вертикальная перегородка кухонного модуля Базиса → две секции студии (Module.sections, перегородка
// `<секция>:divider` — тот же механизм, что у шкафов) + kitchen.divider (глубина и крепёж концов по проекту, src/kitchenDivider.ts).
// Берём только перегородку во всю внутреннюю высоту (стоит на дне, упирается в крышу) и до лица боковин; перегородки на часть
// высоты/глубины (до жёсткой полки k03 m12, сушки, стенки короба вытяжки, держатели полки под духовку) — не трогаем.
import type { RefModule, RefPanel } from "./compare";
import type { KitchenDivider, KitchenDividerEnd } from "../../src/kitchenDivider";

type B = { x0: number; y0: number; z0: number; x1: number; y1: number; z1: number };
type P = { p: RefPanel; b: B };
const r1 = (v: number) => Math.round(v * 10) / 10;
const board = (k: string) => k === "ldsp" || k === "mdf";

/** Перегородки во всю высоту между дном и крышей и до лица боковин, слева направо. */
export function partitionsOf(P: P[], left: P, right: P, bottom: P | undefined, top: P | undefined, sideZ1: number): P[] {
  if (!bottom || !top) return [];
  const t = left.b.x1 - left.b.x0;
  return P.filter(({ p, b }) => p.axis === "x" && board(p.kind) && Math.abs(b.x1 - b.x0 - t) < 0.6 && b.x0 >= left.b.x1 + 50 && b.x1 <= right.b.x0 - 50
    && Math.abs(b.y0 - bottom.b.y1) < 0.6 && Math.abs(b.y1 - top.b.y0) < 0.6 && sideZ1 - b.z1 < 1.1).sort((a, c) => a.b.x0 - c.b.x0);
}

type Hw = { category: string; pos: number[] };
type Hole = { panel: number; face: string; at: number[]; d: number };

/** Крепёж конца перегородки по фурнитуре Базиса: две точки (конфирматы или эксцентрики), симметрично от кромок; иначе причина. */
function endOf(ref: RefModule, part: P, edge: "bottom" | "top"): KitchenDividerEnd | undefined | string {
  const b = part.b, y = edge === "bottom" ? b.y0 : b.y1;
  const near = (h: Hw) => h.pos[0] >= b.x0 - 1 && h.pos[0] <= b.x1 + 1 && Math.abs(h.pos[1] - y) < 60 && h.pos[2] >= b.z0 - 1 && h.pos[2] <= b.z1 + 1;
  const hw = (cat: string) => (ref.hardware as Hw[]).filter((h) => h.category === cat && near(h)).map((h) => r1(h.pos[2])).sort((a, c) => a - c);
  const ecc = hw("эксцентрик"), conf = hw("конфирмат"), dow = hw("шкант");
  if (!ecc.length && !conf.length) return dow.length ? `перегородка: шканты без стяжки (${edge === "bottom" ? "низ" : "верх"}) — пока не поддержано` : undefined;
  if (ecc.length && conf.length) return "перегородка: эксцентрики и конфирматы на одном конце — пока не поддержано";
  const zs = ecc.length ? ecc : conf;
  if (zs.length !== 2) return `перегородка: ${zs.length} точек крепежа на конце — пока не поддержано`;
  const ins: [number, number] = [r1(zs[0] - b.z0), r1(b.z1 - zs[1])];
  if (conf.length) return dow.length ? "перегородка: шканты при конфирматах — пока не поддержано" : { kind: "conf", ins };
  const i = (ref.panels as RefPanel[]).indexOf(part.p);
  const barrel = ((ref as unknown as { holes?: Hole[] }).holes ?? []).filter((h) => h.panel === i && h.d === 15 && Math.abs(h.at[1] - (edge === "bottom" ? y + 34 : y - 34)) < 1);
  const faces = new Set(barrel.map((h) => h.face));
  if (faces.size !== 1) return "перегородка: бочонки эксцентриков в обе пласти — пока не поддержано";
  const face = faces.has("-x") ? ("left" as const) : ("right" as const);
  // шканты — по паре на ровном шаге от эксцентриков к середине (Базис: 32); чужие (стяжка у задней кромки) не берём
  const inside = dow.filter((z) => z > zs[0] && z < zs[1]);
  const dowel = inside.length === 2 && Math.abs(inside[0] - zs[0] - (zs[1] - inside[1])) < 0.6 ? r1(inside[0] - zs[0]) : undefined;
  if (inside.length && dowel === undefined) return "перегородка: шканты не парой от эксцентриков — пока не поддержано";
  return { kind: "ecc", ins, face, ...(dowel ? { dowel } : {}) };
}

/** kitchen.divider по перегородке Базиса; строка — честная причина «не поддержано». */
export function dividerOf(ref: RefModule, part: P, sideZ0: number, sideZ1: number): KitchenDivider | string {
  const bottom = endOf(ref, part, "bottom"), top = endOf(ref, part, "top");
  for (const e of [bottom, top]) if (typeof e === "string") return e;
  const front = r1(sideZ1 - part.b.z1);
  return { z0: r1(part.b.z0 - sideZ0), ...(front ? { front } : {}), ...(bottom ? { bottom: bottom as KitchenDividerEnd } : {}), ...(top ? { top: top as KitchenDividerEnd } : {}) };
}
