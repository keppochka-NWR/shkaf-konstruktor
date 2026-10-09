// Короб под вытяжку в навесном из Базиса (разбор 09.10.2026: 7 модулей wall-hood с П-вырезом в горизонталях — k05 m08, k06 m09,
// k15 m08, k18 m12, k25 m16, k27 m04, k28 m01; тот же короб по геометрии ещё у k16 m11, k22 m10, k24 m09, k30 m09, k31 m08, k32 m13).
// Короб — две стенки ЛДСП (ось x) внутри корпуса, не у боковин, и фронт короба (ось z) между ними вровень с их передней кромкой;
// имена в Базисе разные («Вертикальная»/«Фронтальная» у k28 наоборот), поэтому только по геометрии. Дно/крыша с П-вырезом под короб,
// полки слева и справа от короба трапециями, ХДФ у части модулей двумя кусками по сторонам короба (k05, k15, k27), у k27 — два короба.
// Разброс большой (стенки 150–540 от левой боковины, глубина 200–234, вырез есть не во всех горизонталях), параметрики короба в студии
// пока нет — модуль честно сырой, причина в сверке называется прямо, а не «панели не распознаны».
import type { RefModule } from "./compare";

type Box = { x0: number; y0: number; z0: number; x1: number; y1: number; z1: number };
const bx = (b: number[]): Box => ({ x0: b[0], y0: b[1], z0: b[2], x1: b[3], y1: b[4], z1: b[5] });
const r1 = (v: number) => Math.round(v * 10) / 10;

export type HoodBox = { x0: number; x1: number; depth: number; y0: number; y1: number };

/** Короба под вытяжку модуля: пары внутренних стенок с фронтом между ними (снизу вверх). Пусто — короба нет. */
export function hoodBoxes(ref: RefModule): HoodBox[] {
  const board = ref.panels.filter((p) => p.kind === "ldsp" || p.kind === "mdf").map((p) => ({ p, b: bx(p.box) }));
  const xs = board.filter(({ p, b }) => p.axis === "x" && b.y1 - b.y0 > 200).sort((a, c) => a.b.x0 - c.b.x0);
  if (xs.length < 4) return [];
  const sideL = Math.min(...xs.map((q) => q.b.x0)), sideR = Math.max(...xs.map((q) => q.b.x1));
  const inner = xs.filter(({ b }) => b.x0 > sideL + 20 && b.x1 < sideR - 20);
  const out: HoodBox[] = [];
  for (const a of inner)
    for (const c of inner) {
      if (c.b.x0 <= a.b.x1 + 100 || Math.abs(a.b.y0 - c.b.y0) > 1 || Math.abs(a.b.y1 - c.b.y1) > 1 || Math.abs(a.b.z1 - c.b.z1) > 1) continue;
      // фронт короба: накладной на торцы стенок (k05, k25) или вкладной между ними вровень с их кромкой (k06 m09)
      const front = board.find(({ p, b }) => p.axis === "z" && b.z0 <= a.b.z1 + 1 && b.z1 >= a.b.z1 - 1 && b.x0 >= a.b.x0 - 2 && b.x0 <= a.b.x1 + 2 && b.x1 >= c.b.x0 - 2 && b.x1 <= c.b.x1 + 2 && b.y1 - b.y0 > 200);
      if (front) out.push({ x0: r1(a.b.x0), x1: r1(c.b.x1), depth: r1(front.b.z1), y0: r1(a.b.y0), y1: r1(a.b.y1) });
    }
  return out.sort((a, c) => a.y0 - c.y0);
}

/** Причина «не поддержано» для навесного с коробом под вытяжку или null. */
export function hoodBoxReason(ref: RefModule): string | null {
  const hb = hoodBoxes(ref);
  if (!hb.length) return null;
  const b = hb[0];
  return `короб под вытяжку${hb.length > 1 ? ` ×${hb.length}` : ""} (стенки ${b.x0}–${b.x1} мм, фронт короба в ${b.depth} от задней кромки) — пока не поддержано`;
}
