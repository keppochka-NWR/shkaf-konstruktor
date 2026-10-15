// Распознавание низа навесного модуля Базиса без опор, когда дно поднято над низом модуля (статистика по 34 кухням, 09.10.2026):
//  A) корпус поднят, фасады опущены до низа модуля (закрывают подсветку): боковины начинаются на уровне дна или выше
//     (дно под боковинами) — k17, k21, k23, k28, k30; цоколя и панелей под дном в Базисе нет;
//  B) боковины до низа, дно поднято (ниша под вытяжку/СВЧ/сушку): k01, k04, k06, k10, k14, k15, k18, k22, k25, k31, k32;
//     под дном у части — фронтальная панель ЛДСП во всю высоту ниши (её роль — цоколь, имя в Базисе «Фронтальная», «ФП»).
// Студия не добавляет цоколь, которого нет в Базисе (кухни из Базиса — только то, что есть в проекте): только панель под дном, если она есть.
import type { KitchenSpec } from "../../src/kitchen";
import type { RefPanel } from "./compare";

type B = { x0: number; y0: number; z0: number; x1: number; y1: number; z1: number };
type PB = { p: RefPanel; b: B };
const r1 = (v: number) => Math.round(v * 10) / 10;

export type WallRaise = { plinthHeight: number; raisedSides: boolean; raise: NonNullable<KitchenSpec["raise"]>; panel?: PB; plank?: PB; note: string; unsupported?: string };

/** Планка лёжа под поднятым дном у задней кромки (kitchen.raise.plank): горизонталь ЛДСП от низа боковин, глубиной до 120 от задней кромки,
 *  между боковинами (k04 m06: 12…582 при боковинах 16/584 — допуск 5, студия ставит между боковинами), ниже дна. По базе 7 навесных (см. KitchenSpec.raise). */
export function raisePlank(P: PB[], left: PB, right: PB, bottom: PB, sideZ0: number): PB | undefined {
  const sideY0 = Math.min(left.b.y0, right.b.y0);
  return P.find(({ p, b }) => p.axis === "y" && (p.kind === "ldsp" || p.kind === "mdf") && b.y0 <= sideY0 + 1 && b.y1 <= bottom.b.y0 - 1 && b.z0 <= sideZ0 + 1 && b.z1 - b.z0 <= 120
    && b.x0 >= left.b.x1 - 5 && b.x1 <= right.b.x0 + 5 && b.x1 - b.x0 >= (right.b.x0 - left.b.x1) - 10);
}

/** Планка на ребре навесного стоит на дне (низ планки = верх дна): это нижняя стяжка (k04 m05, m07, m08 — задние планки навески сверху и снизу). */
export function wallRailOnBottom(role: string, rail: PB, bottom: PB | undefined): boolean {
  return (role === "wall" || role === "antresol") && !!bottom && Math.abs(rail.b.y0 - bottom.b.y1) < 0.5;
}

/** Дно навесного короче спереди (k06 m07/m08/m10, k10 m09/m10, k15 m09: 24,5 — ниша под подсветку): от задней кромки боковин, не доходит до лица. */
export function bottomFrontRecess(bottom: PB, sideZ0: number, sideZ1: number): number | null {
  const gap = r1(sideZ1 - bottom.b.z1);
  return bottom.b.z0 <= sideZ0 + 0.5 && gap > 0.5 && gap <= 100 ? gap : null;
}

/** Дно навесного короче сзади: стоит перед ХДФ, задник проходит за ним в пазах боковин (k08 m10, k04 m06/m09, k13 m05, k14 m06: 20–21). */
export function bottomBackRecess(bottom: PB, sideZ0: number, max = 120): number | null {
  const gap = r1(bottom.b.z0 - sideZ0);
  return gap > 0.5 && gap <= max ? gap : null;
}

/** Низ навесного с поднятым дном: подъём дна, боковины над ним или до низа, фронтальная панель под дном, фасады до низа. */
export function wallRaise(P: PB[], left: PB, right: PB, bottom: PB, fronts: PB[], sideZ1: number, sideZ0 = 0): WallRaise | null {
  const lift = r1(bottom.b.y0);
  if (lift <= 0.5) return null;
  const sideY0 = Math.min(left.b.y0, right.b.y0);
  const plank = sideY0 <= 0.5 ? raisePlank(P, left, right, bottom, sideZ0) : undefined;
  const withPlank = (w: WallRaise): WallRaise => (plank ? { ...w, plank, raise: { ...w.raise, plank: { depth: r1(plank.b.z1 - plank.b.z0) } }, note: `${w.note}, планка ${r1(plank.b.z1 - plank.b.z0)} под дном сзади` } : w);
  const doorY0 = fronts.length ? Math.min(...fronts.map((f) => f.b.y0)) : Infinity;
  const doorsToFloor = doorY0 < 0.5;
  if (sideY0 >= lift - 0.6) {
    // A: боковины стоят на уровне дна (или на дне) — весь корпус поднят
    return { plinthHeight: lift, raisedSides: true, raise: doorsToFloor ? { doorsToFloor: true } : {}, note: `корпус поднят на ${lift}${doorsToFloor ? ", фасады до низа модуля" : ""}` };
  }
  // боковины начинаются выше низа модуля, но ниже дна (k26 m01: составной навесной) — честно не поддержано, цоколь не выдумываем
  if (sideY0 > 0.5) return { plinthHeight: lift, raisedSides: false, raise: {}, note: `боковины от ${r1(sideY0)}, дно на ${lift}`, unsupported: `боковины начинаются на ${r1(sideY0)} мм, дно на ${lift} мм (составной навесной) — пока не поддержано` };
  // B: фронтальная ЛДСП под дном: от низа боковин до дна, у лица корпуса, между боковинами
  const panel = P.find(({ p, b }) => p.axis === "z" && (p.kind === "ldsp" || p.kind === "mdf") && b.y0 <= sideY0 + 1 && Math.abs(b.y1 - lift) <= 1 && b.z1 >= sideZ1 - 40 && b.z1 <= sideZ1 + 0.5 && b.x0 >= left.b.x1 - 0.5 && b.x1 <= right.b.x0 + 0.5);
  const raise: NonNullable<KitchenSpec["raise"]> = { ...(panel ? { front: r1(sideZ1 - panel.b.z1) } : {}), ...(doorsToFloor ? { doorsToFloor: true } : {}) };
  return withPlank({ plinthHeight: lift, raisedSides: false, raise, panel, note: `дно поднято на ${lift}${panel ? ", фронтальная под дном" : ", под дном открыто"}` });
}
