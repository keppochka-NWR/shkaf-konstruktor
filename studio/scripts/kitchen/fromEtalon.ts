// Распознаватель: модуль эталона Базиса (Кухни\etalon\kNN.json) → параметрический кухонный модуль студии.
// Все размеры читаются из эталона (ширина, высота, глубина боковины, опоры, дно, царги, задник, фасады, полки, крепёж),
// а не подставляются типовые — так модуль студии можно сверить деталь в деталь (compare.ts).
import { initialModule, section, parts, scaleHingeY, doorRowCount, facadeBottom, type Module, type Groove, type GolaCut } from "../../src/model";
import { partAxes, edgeByDir } from "../../src/edges";
import { hingePositions } from "../../src/hardware";
import type { RefModule, RefPanel } from "./compare";
import { jointPointsRule, type KitchenRole } from "../../src/kitchen";
import { AXIS_BACK, FIRMAX, VERSALITE, MODERN, firmaxConf, type AxisDrawer, type FirmaxBox, type KDrawer, type VersaliteLen } from "../../src/kitchenDrawers";
import { edgeRail, isEuro6, legScrews, railConf, railFastened, screwKind, sideTopEdged } from "./recognize-common";
import { cornerFillerSink, faceFillerFlat } from "./recognize-sink";
import { recognizeBaseExtras, eccFromBelow } from "./recognize-base";
import { axisAsBazis, firmaxAsBazis } from "./recognize-drawers";
import { wallRaise, bottomFrontRecess, bottomBackRecess, wallRailOnBottom, type WallRaise } from "./wallRaise";
import { aluFacadeReason } from "./aluFacade";
import { hoodBoxReason } from "./hoodBox";
import { wallDryer } from "./wallDryer";
import { wallCornerRaw } from "./wallCorner";
import { wallJointZ, wallJointNone, endGroove, wallShelfEdges, wallEndEdges, wallFixedShelfEdges, bottomUnderDowelOffset } from "./wallJoints";
import { normalizeRefHardware, confirmatName } from "./refHardware";
import { handlePlace } from "./recognize-handle";
import { recognizeNails } from "./recognize-nails";
import { railUnder } from "./recognize-wallrail";
import { rearNotchFromContour, topCornerNotchFromContour } from "./sideNotch";
import { rafixZs, type KitchenRafix, type RafixGrid } from "../../src/kitchenRafix";

const r1 = (v: number) => Math.round(v * 10) / 10;
type B = { x0: number; y0: number; z0: number; x1: number; y1: number; z1: number };
const bx = (p: RefPanel): B => ({ x0: p.box[0], y0: p.box[1], z0: p.box[2], x1: p.box[3], y1: p.box[4], z1: p.box[5] });

/** Пазы панелей эталона, кроме паза под задник (по положению на z задника), со слиянием проходов. */
export function refGrooves(ref: RefModule, backZ0: number | null): { box: [number, number, number, number, number, number]; name: string; panel: number }[] {
  const out: { box: [number, number, number, number, number, number]; name: string; panel: number }[] = [];
  for (const p of ref.panels as (RefPanel & { cuts?: { kind: string; name: string; sign?: string; box?: number[]; width?: number; depth?: number; face?: string }[] })[]) {
    const cs = (p.cuts ?? []).filter((c) => c.kind === "groove" && Array.isArray(c.box) && !(backZ0 !== null && c.box![2] <= backZ0 && c.box![5] >= backZ0 + 2.9 && (c.width ?? 0) <= 4.5));
    const runs: { box: number[]; c: (typeof cs)[number] }[] = [];
    for (const c of cs.sort((a, b) => a.box![2] - b.box![2] || a.box![0] - b.box![0])) {
      const r = runs.find((x) => x.c.face === c.face && Math.abs(x.box[1] - c.box![1]) < 1 && Math.abs(x.box[4] - c.box![4]) < 1 && c.box![2] <= x.box[5] + 0.5 && c.box![0] <= x.box[3] + 0.5 && c.box![3] >= x.box[0] - 0.5);
      if (r) r.box = r.box.map((v, i) => (i < 3 ? Math.min(v, c.box![i]) : Math.max(v, c.box![i])));
      else runs.push({ box: [...c.box!], c });
    }
    for (const r of runs) {
      const w = r1(Math.min(r.box[3] - r.box[0], r.box[4] - r.box[1], r.box[5] - r.box[2]) === r1(r.c.depth ?? 0) ? Math.max(...[r.box[3] - r.box[0], r.box[4] - r.box[1], r.box[5] - r.box[2]].sort((a, b) => a - b).slice(0, 2)) : 0);
      // имя без опечаток Базиса («Подстветка»): «паз под подсветку» / «паз»; размеры пишет grooveText
      out.push({ box: r.box.map(r1) as [number, number, number, number, number, number], name: /подс?т?в?е?т/i.test(r.c.sign ?? "") || /подсвет/i.test(r.c.name) ? "паз под подсветку" : "паз", panel: p.i });
    }
  }
  return out;
}
export type Recognized = { module: Module; notes: string[]; unsupported: string[] };

/** Ниша под технику между двумя рядами распашных фасадов пенала (одинаковое число створок, 1 или 2, ряды по одной линии x):
 *  gap — зазор между створками ряда (у одной створки — 3, как у Базиса), split — от низа нижнего ряда до его верха + gap/2,
 *  niche — от верха нижнего ряда до низа верхнего. undefined — ряды не совпадают по ширине/створкам. */
export function nicheFromRows(low: B[], up: B[]): { gap: number; split: number; niche: number } | undefined {
  const r = doorRowsFromFronts([low, up], 3);
  return r && r.niche !== undefined ? { gap: r.gap, split: r.split, niche: r.niche } : undefined;
}

/** Ряды распашных фасадов пенала снизу вверх (в каждом ряду 1 или 2 створки, ряды по одной линии x, створки ряда одной высоты):
 *  gap — зазор между створками (у одной створки — зазор между рядами 2-й и выше, иначе single), split — нижний ряд + gap/2,
 *  niche — открытая ниша над нижним рядом (если зазор там не равен зазору рядов), rows — высоты средних рядов.
 *  undefined — ряды не сводятся к этой схеме (разное число створок, разные зазоры между верхними рядами). */
export function doorRowsFromFronts(rows: B[][], single = 3): { gap: number; split: number; niche?: number; rows: number[] } | undefined {
  if (rows.length < 2 || rows.some((r) => !r.length || r.length > 2 || r.length !== rows[0].length)) return undefined;
  const rs = rows.map((r) => [...r].sort((a, c) => a.x0 - c.x0));
  for (const r of rs) {
    if (r.some((q, k) => Math.abs(q.x0 - rs[0][k].x0) > 0.6 || Math.abs(q.x1 - rs[0][k].x1) > 0.6)) return undefined;
    if (r.some((q) => Math.abs(q.y0 - r[0].y0) > 0.6 || Math.abs(q.y1 - r[0].y1) > 0.6)) return undefined;
  }
  const gaps = rs.slice(1).map((r, i) => r1(r[0].y0 - rs[i][0].y1));
  const rowGap = gaps.length > 1 ? gaps[1] : undefined;
  if (gaps.slice(1).some((g) => Math.abs(g - gaps[1]) > 0.6) || gaps.some((g) => g < -0.5)) return undefined;
  const gap = rs[0].length === 2 ? r1(rs[0][1].x0 - rs[0][0].x1) : rowGap ?? (gaps[0] <= 10 ? gaps[0] : single);
  if (rowGap !== undefined && Math.abs(rowGap - gap) > 0.6) return undefined; // у двух створок зазор рядов = зазор створок
  const niche = Math.abs(gaps[0] - gap) > 0.6 ? gaps[0] : undefined;
  return { gap, split: r1(rs[0][0].y1 - rs[0][0].y0 + gap / 2), ...(niche !== undefined ? { niche } : {}), rows: rs.slice(1, -1).map((r) => r1(r[0].y1 - r[0].y0)) };
}

/** Сетка крепежа (конфирмат/эксцентрик) на стыке горизонтали со стойкой по Базису: точки у левой стойки (нет — у правой),
 *  отступы от заднего/переднего торца горизонтали, штук; стыки, где точек меньше двух или шаг неравный, не возвращаются. */
export function jointGridsFromEtalon(ref: RefModule, hosts: [string, B][], left: B, right: B): Record<string, RafixGrid> {
  const fs = ref.hardware.filter((h) => h.category === "конфирмат" || h.category === "эксцентрик"), out: Record<string, RafixGrid> = {};
  for (const [key, q] of hosts) {
    const at = (s: B) => fs.filter((h) => (Math.abs(h.pos[1] - q.y0) < 1 || (h.pos[1] > q.y0 && h.pos[1] < q.y1)) && h.pos[0] >= s.x0 - 1 && h.pos[0] <= s.x1 + 1 && h.pos[2] >= q.z0 - 1 && h.pos[2] <= q.z1 + 1);
    const pts = at(left).length ? at(left) : at(right);
    const zs = [...new Set(pts.map((h) => r1(h.pos[2])))].sort((a, c) => a - c);
    // узкая жёсткая полка (глубина до 100, у задника под ящиками: k17 m02, k18 m06, k25 m05, k27 m02, k28 m04, k29 m05, k31 m16 —
    // 7 из 7) — один конфирмат посередине на сторону, как в Базисе; у дна/крыши одиночную точку сеткой не считаем
    if (zs.length < (key.startsWith("shelf:") ? 1 : 2)) continue;
    const g: RafixGrid = { rear: r1(zs[0] - q.z0), front: r1(q.z1 - zs[zs.length - 1]), n: zs.length };
    if (rafixZs(g, q.z0, q.z1).every((z, k) => Math.abs(z - zs[k]) < 0.6)) out[key] = g;
  }
  return out;
}

/** Жёсткие полки без крепежа к стойкам в Базисе (ни конфирмата, ни эксцентрика, ни шканта, ни рафикса у торцов полки на её высоте). */
export function bareShelvesFromEtalon(ref: RefModule, shelves: B[], fixed: number[]): number[] {
  const fs = ref.hardware.filter((h) => ["конфирмат", "эксцентрик", "шкант", "рафикс"].includes(h.category));
  return fixed.filter((j) => {
    const b = shelves[j];
    if (!b) return false;
    return !fs.some((h) => h.pos[1] >= b.y0 - 1 && h.pos[1] <= b.y1 + 1 && h.pos[2] >= b.z0 - 1 && h.pos[2] <= b.z1 + 1 && (h.pos[0] <= b.x0 + 20 || h.pos[0] >= b.x1 - 20));
  });
}

/** Стык горизонтали (дно/крыша) со стойками без крепежа в Базисе: ни одной фурнитуры любой категории (конфирмат, эксцентрик, шкант,
 *  «крепёж» и др.) и ни одного отверстия у торцов горизонтали на её высоте. Осторожно: что-то есть — стык не «голый». */
export function bareJointFromEtalon(ref: RefModule, b: B): boolean {
  const near = (p: number[]) => p[1] >= b.y0 - 1 && p[1] <= b.y1 + 1 && p[2] >= b.z0 - 1 && p[2] <= b.z1 + 1 && (p[0] <= b.x0 + 20 || p[0] >= b.x1 - 20);
  return !ref.hardware.some((h) => near(h.pos)) && !(ref.holes ?? []).some((h) => near(h.at));
}

/** Створки без петель (номер row*2+col, ряды снизу, створки слева): у фасада холодильника петель в Базисе нет — он на двери техники.
 *  rows — фасады Базиса по рядам створок студии, leaves — створок в ряду студии, total — всего фасадов Базиса.
 *  Номер row*2+col указывает на дверь студии, только если ряды и створки совпадают один в один и других фасадов нет
 *  (фасады ящиков, «Фронтальная», «Front» в общем ряду сбили бы номера — k30 m15, k28 m15). Иначе и если какая-то петля Базиса
 *  не на этих створках — пусто: студия не снимает петли, которые в Базисе есть. */
export function hingelessDoors(rows: B[][], hinges: { pos: number[] }[], leaves = 2, total = rows.flat().length): number[] {
  if (rows.some((r) => r.length !== leaves) || rows.flat().length !== total) return [];
  const on = (h: { pos: number[] }, q: B) => h.pos[1] >= q.y0 - 0.5 && h.pos[1] <= q.y1 + 0.5 && h.pos[0] >= q.x0 - 30 && h.pos[0] <= q.x1 + 30;
  if (hinges.some((h) => !rows.flat().some((q) => on(h, q)))) return [];
  const out: number[] = [];
  rows.forEach((r, row) => [...r].sort((a, c) => a.x0 - c.x0).forEach((q, col) => {
    if (!hinges.some((h) => on(h, q))) out.push(row * 2 + col);
  }));
  return out;
}

/** Позиции опор по ширине: точки ближе 2 мм — одна позиция (среднее), иначе студия поставила бы лишние опоры в каждый ряд. */
export function clusterLegXs(xs: number[]): number[] {
  const out: number[][] = [];
  for (const x of [...xs].sort((a, c) => a - c)) { const g = out[out.length - 1]; if (g && x - g[g.length - 1] <= 2) g.push(x); else out.push([x]); }
  return out.map((g) => r1(g.reduce((s, v) => s + v, 0) / g.length));
}

/** Точек крепежа (конфирмат/эксцентрик) по глубине на стыках дна и крыши со стойками: самое частое число по стыкам (обе стойки, если
 *  передана правая; при равенстве — большее); 2 или 3, иначе undefined. Один стык с лишней точкой (k10 m02: у крыши слева 3 эксцентрика,
 *  на остальных трёх стыках по 2) не переносит своё число на все стыки — студия не добавляет крепёж, которого в Базисе нет. */
export function jointPointsFromEtalon(ref: RefModule, hosts: (B | undefined)[], left: B, right?: B): 2 | 3 | undefined {
  const ns: number[] = [];
  for (const q of hosts) {
    if (!q) continue;
    for (const s of right ? [left, right] : [left]) {
      const fs = ref.hardware.filter((h) => (h.category === "конфирмат" || h.category === "эксцентрик") && (Math.abs(h.pos[1] - q.y0) < 1 || (h.pos[1] > q.y0 && h.pos[1] < q.y1)) && h.pos[0] >= s.x0 - 1 && h.pos[0] <= s.x1 + 1);
      const n = new Set(fs.map((h) => Math.round(h.pos[2]))).size;
      if (n) ns.push(n);
    }
  }
  const cnt = (v: number) => ns.filter((n) => n === v).length;
  const n = ns.length ? [...new Set(ns)].sort((a, c) => cnt(c) - cnt(a) || c - a)[0] : 0;
  return n === 2 || n === 3 ? n : undefined;
}

/** Рафиксы Базиса у жёстких полок: точка — торец полки у стойки × нижняя пласть; сетка по глубине от торцов полки.
 *  Общая сетка — самая частая среди полок, у остальных — своя (per). confirmat — жёсткие полки без рафиксов (их крепёж не меняем).
 *  shelves — коробы полок снизу вверх (номера как в section.shelves), fixed — номера жёстких полок. */
export function rafixFromEtalon(ref: RefModule, shelves: B[], fixed: number[]): { rafix?: KitchenRafix; confirmat: number[]; notes: string[] } {
  const rf = ref.hardware.filter((h) => h.category === "рафикс"), notes: string[] = [];
  if (!rf.length) return { confirmat: [], notes };
  const grids = new Map<number, RafixGrid>(), confirmat: number[] = [];
  for (const j of fixed) {
    const b = shelves[j]; if (!b) continue;
    // рафикс полки — у её торца (не у вставки/фронтальной панели на той же высоте, k18 m08)
    const mine = rf.filter((h) => Math.abs(h.pos[1] - b.y0) < 1 && (Math.abs(h.pos[0] - b.x0) < 1 || Math.abs(h.pos[0] - b.x1) < 1) && h.pos[2] >= b.z0 - 1 && h.pos[2] <= b.z1 + 1);
    if (!mine.length) { confirmat.push(j); continue; }
    // сторона с большим числом точек (у Базиса обе стороны одинаковые; k27 m13 — разные, берём левую)
    const left = mine.filter((h) => h.pos[0] < (b.x0 + b.x1) / 2), right = mine.filter((h) => h.pos[0] >= (b.x0 + b.x1) / 2);
    const zs = (left.length >= right.length ? left : right).map((h) => h.pos[2]).sort((a, c) => a - c);
    const g: RafixGrid = { rear: r1(zs[0] - b.z0), front: r1(b.z1 - zs[zs.length - 1]), n: zs.length };
    const even = rafixZs(g, b.z0, b.z1).every((z, k) => Math.abs(z - zs[k]) < 0.6);
    if (!even) notes.push(`рафиксы полки ${j + 1}: шаг неравный (${zs.map((z) => r1(z - b.z0)).join(", ")})`);
    if (left.length !== right.length || left.some((h, k) => Math.abs(h.pos[2] - (right[k]?.pos[2] ?? h.pos[2])) > 0.6)) notes.push(`рафиксы полки ${j + 1}: стороны разные (${left.length}/${right.length})`);
    grids.set(j, g);
  }
  if (!grids.size) return { confirmat: [], notes };
  const key = (g: RafixGrid) => `${g.rear}|${g.front}|${g.n}`, freq = new Map<string, number>();
  for (const g of grids.values()) freq.set(key(g), (freq.get(key(g)) ?? 0) + 1);
  const top = [...freq].sort((a, c) => c[1] - a[1])[0][0], base = [...grids.values()].find((g) => key(g) === top)!;
  const per = Object.fromEntries([...grids].filter(([, g]) => key(g) !== top).map(([j, g]) => [String(j), g]));
  return { rafix: { ...base, ...(Object.keys(per).length ? { per } : {}) }, confirmat, notes };
}

type Hw = { name: string; category: string; pos: number[] };
/** Навесы Базиса → kitchen.hangerAt: [ниже верха боковины, от задней кромки, внутрь от внутренней грани боковины] по каждой стороне.
 *  null — навесов нет; {} — стоят по правилу студии (15 / 20 / 0, большинство навесов базы); иначе — как в проекте: у части проектов
 *  навесы выше корпуса (на 130–1000 мм, k12, k15, k26–k28, k31) или в 100 мм от боковины (k18) — повторяем как есть, отверстий в боковине
 *  тогда нет, как и у Базиса. */
export function hangersFromEtalon(hardware: Hw[], leftInner: number, rightInner: number, top: number, sideZ0: number): { hangerAt?: NonNullable<NonNullable<Module["kitchen"]>["hangerAt"]>; note?: string } | null {
  const hs = hardware.filter((h) => h.category === "навес");
  if (!hs.length) return null;
  const mid = (leftInner + rightInner) / 2;
  // сторона — по положению: у Базиса имена бывают перепутаны (k08 m09: «правый» навес у левой боковины) — по имени навес левой
  // стороны встал бы у правой боковины и вышел бы сквозь неё в соседний модуль; по имени — только если по положению не разложить
  const byPos = hs.filter((h) => h.pos[0] < mid);
  const L = byPos.length === 1 && hs.length === 2 ? byPos : hs.filter((h) => /лев/i.test(h.name) || (!/прав/i.test(h.name) && h.pos[0] < mid)), R = hs.filter((h) => !L.includes(h));
  if (L.length !== 1 || R.length !== 1) return { note: `навесов в Базисе ${hs.length} (по одному на сторону не разложить) — по правилу студии` };
  const at = (h: Hw, inner: number, dir: 1 | -1): [number, number, number] => [r1(top - h.pos[1]) + 0, r1(h.pos[2] - sideZ0) + 0, r1(dir * (h.pos[0] - inner)) + 0]; // + 0: без «−0» в проекте
  const left = at(L[0], leftInner, 1), right = at(R[0], rightInner, -1);
  // заглушки навесов: обычно в той же точке, что и навес; у k18 навес на планке в 100 мм от боковины, а заглушка — на боковине по правилу
  const cs = hardware.filter((h) => h.category === "заглушка" && /навес/i.test(h.name));
  const cPos = cs.filter((h) => h.pos[0] < mid), byPosC = cPos.length === 1 && cs.length === 2; // сторона заглушки — тоже по положению
  const CL = byPosC ? cPos : cs.filter((h) => /лев/i.test(h.name)), CR = byPosC ? cs.filter((h) => !cPos.includes(h)) : cs.filter((h) => /прав/i.test(h.name));
  const capL = CL.length === 1 ? at(CL[0], leftInner, 1) : left, capR = CR.length === 1 ? at(CR[0], rightInner, -1) : right;
  const same = (a: number[], b: number[]) => a.every((v, i) => Math.abs(v - b[i]) < 0.05);
  const std = (a: [number, number, number]) => same(a, [15, 20, 0]);
  const caps = same(capL, left) && same(capR, right) ? {} : { caps: { left: capL, right: capR } };
  if (std(left) && std(right) && !caps.caps) return {};
  const out = Math.max(-left[0], -right[0]);
  return { hangerAt: { left, right, ...caps }, ...(out > 0 ? { note: `навесы Базиса выше корпуса на ${r1(out + 15)} мм — повторено как в проекте` } : {}) };
}

/** Боковины стоят на дне (дно под боковинами) на эксцентриках: стяжка Базиса — на наружной пласти боковины на уровне верха дна
 *  (k16 m08–m10, k28 m10–m12, k31 m03/m04). Отступы стяжек от задней/передней кромки дна, стороны и отступ шкантов (по оси боковины, низ дна). */
export function underEccFromEtalon(hardware: Hw[], bottom: B, left: B, right: B): { at: { back: number; front: number }; sides: ("left" | "right")[]; dowel?: number } | null {
  const outer = { left: left.x0, right: right.x1 };
  const ecc = hardware.filter((h) => h.category === "эксцентрик" && Math.abs(h.pos[1] - bottom.y1) < 0.6);
  const bySide = (s: "left" | "right") => ecc.filter((h) => Math.abs(h.pos[0] - outer[s]) < 0.6);
  const sides = (["left", "right"] as const).filter((s) => bySide(s).length === 2);
  if (!sides.length) return null;
  const zs = sides.flatMap((s) => bySide(s).map((h) => h.pos[2]));
  const at = { back: r1(Math.min(...zs) - bottom.z0), front: r1(bottom.z1 - Math.max(...zs)) };
  const e0 = bySide(sides[0]).sort((a, c) => a.pos[2] - c.pos[2])[0], cx = sides[0] === "left" ? (left.x0 + left.x1) / 2 : (right.x0 + right.x1) / 2;
  const d0 = hardware.filter((h) => h.category === "шкант" && Math.abs(h.pos[1] - bottom.y0) < 0.6 && Math.abs(h.pos[0] - cx) < 0.6).sort((a, c) => Math.abs(a.pos[2] - e0.pos[2]) - Math.abs(c.pos[2] - e0.pos[2]))[0];
  return { at, sides: [...sides], ...(d0 ? { dowel: r1(Math.abs(d0.pos[2] - e0.pos[2])) } : {}) };
}

/** Петли подъёмного фасада (по крыше): позиции от левой кромки фасада, если в проекте не по правилу студии (число и 100 мм от кромок);
 *  иначе undefined. По антресолям базы: k31 m13 — 114,5 от кромок, k01 — своё число петель. */
export function liftHingeX(xs: number[], dw: number, dh: number): number[] | undefined {
  const rule = hingePositions(dw, dh, true);
  return xs.length && (xs.length !== rule.length || xs.some((x, k) => Math.abs(x - rule[k]) > 0.05)) ? xs : undefined;
}

/** ХДФ в пазу дна и крыши: зазор до дна паза снизу и сверху, если он не тот же, что по ширине (grooveClear) — как в проекте
 *  (k28 m10: снизу 2,5, сверху 1; k28 m11: 2,2 и 1). Иначе undefined. */
export function backClearY(back: B, bottom: B, top: B, gd: number, gc: number): [number, number] | undefined {
  const lo = r1(back.y0 - (bottom.y1 - gd)), hi = r1(top.y0 + gd - back.y1);
  return lo >= 0 && hi >= 0 && (Math.abs(lo - gc) > 0.05 || Math.abs(hi - gc) > 0.05) ? [lo, hi] : undefined;
}

/** Отступ одиночного фасада от кромок корпуса: у Базиса фасад бывает несимметричным (k23 m08: слева 2,5, справа и сверху 2) —
 *  берём отступ, общий хотя бы для двух сторон из трёх (лево, право, верх); все разные — левый, как раньше. */
export function faceGapOf(f: B, x0: number, x1: number, top: number): number {
  const g = [r1(f.x0 - x0), r1(x1 - f.x1), r1(top - f.y1)];
  return g.find((v, i) => g.some((w, j) => j !== i && Math.abs(w - v) < 0.05)) ?? g[0];
}

/** Дно/крыша между боковинами с кромкой на торцах у боковин (±x) — так в части проектов (k32: кромка по кругу у всех панелей). */
export function endsEdged(hs: RefPanel[]): boolean {
  const ed = (p: RefPanel) => ((p as unknown as { edges?: { side: string; thick: number }[] }).edges ?? []).filter((e) => e.thick > 0).map((e) => e.side);
  return hs.length > 0 && hs.every((p) => ed(p).includes("+x") && ed(p).includes("-x"));
}

/** Отличия кромки проекта Базиса от схемы студии (kitchenEdges): торцы дна/крыши между боковинами (k32), торцы дна под боковинами
 *  без кромки (k28), задние торцы при набивном ХДФ (k31). Только то, что видно в кромке эталона. */
export function edgeFlags(side: RefPanel, bottom: RefPanel | undefined, top: RefPanel | undefined, bottomUnder: boolean, backType: Module["backType"]): { endsX?: true | "bottom" | "top"; underEnds?: false; rear?: true } {
  const ed = (p: RefPanel) => ((p as unknown as { edges?: { side: string; thick: number }[] }).edges ?? []).filter((e) => e.thick > 0).map((e) => e.side);
  const out: { endsX?: true | "bottom" | "top"; underEnds?: false; rear?: true } = {};
  const eb = !bottomUnder && !!bottom && endsEdged([bottom]), etp = !!top && endsEdged([top]);
  if (eb || etp) out.endsX = eb && etp ? true : eb ? "bottom" : "top";
  if (bottomUnder && bottom && !ed(bottom).includes("+x") && !ed(bottom).includes("-x")) out.underEnds = false;
  if (backType === "nailed" && ed(side).includes("-z")) out.rear = true;
  return out;
}

/** Кромка в проекте Базиса не заложена вовсе: у всех панелей ЛДСП список кромки есть и пуст (по базе — только k23, 15 модулей). */
export function noEdges(panels: RefPanel[]): boolean {
  const ldsp = panels.filter((p) => p.kind === "ldsp");
  return ldsp.length > 0 && ldsp.every((p) => { const e = (p as unknown as { edges?: { thick: number }[] }).edges; return Array.isArray(e) && !e.some((x) => x.thick > 0); });
}

/** Глубина D5 конфирмата в торце второй детали: одна на весь модуль и не 35 (по базе: k11 — 37, k31 — 42) — иначе undefined. */
export function confDepthFromEtalon(ref: RefModule): number | undefined {
  const ds = new Set((ref.holes ?? []).filter((h) => h.d === 5 && h.src !== null && h.src !== undefined && ref.hardware.find((x) => x.i === h.src)?.category === "конфирмат").map((h) => h.depth));
  const [d] = [...ds];
  return ds.size === 1 && d !== 35 ? d : undefined;
}

/** Крепёж корпуса в проекте Базиса не заложен вовсе (ни конфирматов, ни эксцентриков, ни шкантов, ни отверстий) — студия его не добавляет. */
export function fastenersAbsent(ref: RefModule): boolean {
  return !ref.hardware.some((h) => ["конфирмат", "эксцентрик", "шкант"].includes(h.category)) && !(ref.holes ?? []).length;
}

/** Вырезы Gola по контуру боковины Базиса: участки контура, ушедшие вглубь от переднего торца (z < zFront) не дальше 100 мм.
 *  top0/top1 — от верха боковины, depth — глубина, r — скругление (переход от вертикали выреза к его дну). */
export function golaFromContour(p: { contour?: [number, number][]; contourPlane?: string }, yTop: number, zFront: number): GolaCut[] {
  const c = p.contour; if (!c || p.contourPlane !== "yz" || c.length < 6) return [];
  const inCut = (q: [number, number]) => q[1] < zFront - 0.5 && q[1] > zFront - 100;
  const out: GolaCut[] = []; let grp: [number, number][] = [];
  const flush = () => {
    if (grp.length >= 2) {
      const ys = grp.map((q) => q[0]), zMin = Math.min(...grp.map((q) => q[1])), y0 = Math.min(...ys), y1 = Math.max(...ys);
      const zEdge = Math.max(grp[0][1], grp[grp.length - 1][1]);
      if (y1 - y0 > 10 && y1 - y0 < 300) out.push({ top0: r1(yTop - y1), top1: r1(yTop - y0), depth: r1(zFront - zMin), r: r1(Math.max(0, zEdge - zMin)) });
    }
    grp = [];
  };
  for (const q of c) { if (inCut(q)) grp.push(q); else flush(); }
  flush();
  return out.sort((a, b) => a.top0 - b.top0);
}

export function moduleFromEtalon(ref0: RefModule, look: { decor: string; facadeDecor: string } = { decor: "Белый", facadeDecor: "Белый" }): Recognized {
  const ref: RefModule = { ...ref0, hardware: normalizeRefHardware(ref0.hardware) }; // «Евровинт 6х50» из «прочего» — конфирмат
  const notes: string[] = [], unsupported: string[] = [];
  const W = ref.size[0], P = ref.panels.map((p) => ({ p, b: bx(p) }));
  const board = (k: string) => k === "ldsp" || k === "mdf";
  const sides = P.filter(({ p, b }) => p.axis === "x" && board(p.kind) && b.y1 - b.y0 > 200).sort((a, c) => a.b.x0 - c.b.x0);
  const left = sides[0], right = sides[sides.length - 1];
  if (!left || left === right) throw Error("нет двух боковин");
  const t = left.b.x1 - left.b.x0;
  const sideZ0 = Math.min(left.b.z0, right.b.z0), sideZ1 = Math.max(left.b.z1, right.b.z1), d = r1(sideZ1 - sideZ0);
  const top = Math.max(left.b.y1, right.b.y1);
  const H = r1(top);
  const horiz = P.filter(({ p }) => p.axis === "y" && board(p.kind));
  // угловая мойка с плоским фальшем (recognize-sink.ts, n4-base): фальш и планка — не фасады, а kitchen.faceFiller
  const role: KitchenRole = ref.archetype.startsWith("wall") ? "wall" : ref.archetype === "antresol" ? "antresol" : ref.archetype.startsWith("tall") ? "tall" : "base";
  const ffFlat = role === "base" && horiz.length ? faceFillerFlat(ref, P, left, right, sideZ1, Math.min(...horiz.map((h) => h.b.y0)), top) : undefined;
  const fronts = P.filter((x) => x.p.axis === "z" && x.p.kind !== "hdf" && x.b.z0 >= sideZ1 - 1 && !ffFlat?.panels.includes(x)).sort((a, c) => a.b.x0 - c.b.x0 || a.b.y0 - c.b.y0);
  // фасад в алюминиевом профиле: рамки в проекте нет (профиль без сетки) — модуль честно сырой (aluFacade.ts); наполнение из рядов
  // фасадов не убираем: по нему считается низ корпуса (подъём, фасады до низа), без него корпус съезжает (k21 m05: Δ3,5)
  const aluWhy = aluFacadeReason(ref);
  if (aluWhy) unsupported.push(aluWhy);
  // короб под вытяжку у навесного (две стенки и фронт внутри корпуса, П-вырез в дне/крыше) — параметрики нет, честно сырой (hoodBox.ts)
  const hoodWhy = ref.archetype.startsWith("wall") ? hoodBoxReason(ref) : null;
  if (hoodWhy) unsupported.push(hoodWhy);
  const hdf = P.filter(({ p }) => p.kind === "hdf");
  const hw = (cat: string) => ref.hardware.filter((h) => h.category === cat);
  const legs = hw("опора");
  // дно — нижняя горизонталь; крыша — верхняя горизонталь во всю глубину
  const bottom0 = horiz.filter(({ b }) => b.z1 - b.z0 > d * 0.6).sort((a, c) => a.b.y0 - c.b.y0)[0];
  const topPanel = horiz.filter(({ b }) => b.z1 - b.z0 > d * 0.6 && b.y1 >= top - 0.5).sort((a, c) => c.b.y1 - a.b.y1)[0];
  // единственная горизонталь во всю глубину — наверху (k34 m04: сушка без дна, «Крышка» и ХДФ до низа): это крыша, дна нет
  const bottom = bottom0 && bottom0 === topPanel && bottom0.b.y0 > top / 2 ? undefined : bottom0;
  const rails = horiz.filter((h) => h !== topPanel && h !== bottom && h.b.z1 - h.b.z0 <= 150 && h.b.y1 >= top - 0.5);
  // стяжки на ребре — на любой высоте (у мойки задняя бывает посередине, под трубы), между боковинами
  // короб Firmax без направляющих в проекте (k22 m05, k14 m08): «5x12» (зацеп Firmax) есть, направляющих в Базисе нет
  const fxBare = !ref.hardware.some((h) => h.category === "направляющая") && ref.hardware.some((h) => h.name === "5x12") && P.some(({ p }) => /^Боковина ящика лев/i.test(p.name));
  const fxBox = (name: string) => /ящика|ящ\./i.test(name) && (fxBare || ref.hardware.some((h) => /Firmax|Versalite Light H45|СТАРТ Soft-Closing|Направляющая Indigo|MODERN SLIDE/.test(h.name))); // короб ящика ЛДСП (Firmax, Versalite) — не царга и не полка
  // цоколь в модуле? (панель ЛДСП у пола под дном, как бы ни называлась в Базисе: «Цоколь», «Фронтальная» k20 m09) — самая передняя
  // в передней половине глубины: планка у задней стены (k04 m09, k14 m06) — не цоколь; у навесных и антресолей цоколя нет
  const floorRole = !ref.archetype.startsWith("wall") && ref.archetype !== "antresol";
  const plinthPanel = floorRole ? P.filter(({ p, b }) => p.axis === "z" && board(p.kind) && b.y0 < 5 && b.y1 <= (bottom?.b.y0 ?? 0) + 1 && b.y1 - b.y0 > 40 && b.z1 > (sideZ0 + sideZ1) / 2).sort((a, c) => c.b.z1 - a.b.z1)[0] : undefined;
  // цоколь — не стяжка на ребре (k20 m09: «Фронтальная» 0–70 была и стяжкой «на высоте 0», и цоколем — студия ставила деталь дважды)
  const railsEdge = P.filter(({ p, b }) => p.axis === "z" && board(p.kind) && b.z1 <= sideZ1 + 0.5 && b.y1 - b.y0 <= 160 && b.x0 >= left.b.x1 - 0.5 && b.x1 <= right.b.x0 + 0.5 && !fronts.some((f) => f.b === b) && !/выдв/i.test(p.name) && !fxBox(p.name) && plinthPanel?.b !== b);
  const shelves = horiz.filter((h) => h !== bottom && h !== topPanel && !rails.includes(h) && !/выдв/i.test(h.p.name) && !fxBox(h.p.name)); // дно ящика — не полка

  const m: Module = { ...initialModule(), name: ref.name, width: r1(W), height: H, depth: d, decor: look.decor, facadeDecor: look.facadeDecor, sections: [section()] };
  m.kitchen = { role, bazis: true }; // из проекта Базиса: смета — без того, чего в Базисе нет (pricing.ts; n3-antresol)
  const sk = screwKind(ref0.hardware); if (sk) m.kitchen.screw = sk; // по исходной категории Базиса: «Евровинт 6х50» в «прочем» (normalizeRefHardware переносит его в конфирматы)
  // опоры и дно
  let wr: WallRaise | null = null;
  if (bottom) {
    const under = bottom.b.x0 <= left.b.x0 + 0.5 && bottom.b.x1 >= right.b.x1 - 0.5;
    if (under) m.bottomUnder = true;
    const bf = role === "wall" ? bottomFrontRecess(bottom, sideZ0, sideZ1) : null;
    if (bf !== null) { m.kitchen.bottomFront = bf; notes.push(`дно короче спереди на ${bf}`); }
    const bb = role === "wall" ? bottomBackRecess(bottom, sideZ0) : null;
    if (bb !== null) { m.kitchen.bottomBack = bb; notes.push(`дно короче сзади на ${bb}`); }
    if (legs.length) m.feet = { height: r1(bottom.b.y0) };
    else if (bottom.b.y0 > 0.5 && (role === "wall" || role === "antresol") && (wr = wallRaise(P, left, right, bottom, fronts, sideZ1))) {
      m.plinthHeight = wr.plinthHeight; if (wr.raisedSides) m.raisedSides = true; m.kitchen.raise = wr.raise; notes.push(wr.note); if (wr.unsupported) unsupported.push(wr.unsupported);
    } else if (bottom.b.y0 > 0.5) {
      m.plinthHeight = r1(bottom.b.y0);
      // цоколь — деталь, закрывающая низ под дном (у Базиса бывает «Фронтальная» ЛДСП): панель в плоскости фронта под дном.
      // Нет её — под дном открытая ниша (техника, k18 m21, k23 m04, k30 m02) или зазор: цоколь студия не рисует.
      const under = P.some(({ p, b }) => p.axis === "z" && board(p.kind) && b.y1 <= bottom.b.y0 + 1 && b.y1 - b.y0 >= Math.min(40, bottom.b.y0 / 2) && b.z1 >= sideZ1 - 100);
      if (under) notes.push(`низ корпуса на ${r1(bottom.b.y0)} без опор — как цоколь`);
      else { m.kitchen = { ...m.kitchen!, bareBottom: true }; notes.push(`низ корпуса на ${r1(bottom.b.y0)} без опор и без панели под дном — цоколя нет`); }
    }
    else m.plinthHeight = 0;
  } else { m.bottomType = "none"; m.plinthHeight = 0; }
  if (!topPanel) m.topType = "none";
  const cn = confirmatName(ref.hardware); if (cn) m.kitchen.confirmatName = cn; // «Евровинт 6х50» (k33, k34) — так и в деталях и смете
  if (role === "base" && !legs.length) { m.kitchen.noLegs = true; notes.push("опор в проекте нет — студия их не добавляет"); } // k33, k34: нижний стоит на дне
  if (legs.length) {
    // ряды опор Базиса бывают сдвинуты на 1 мм (k25 m10: зад 69/531, перед 70/530) — это те же позиции по ширине, а не 4 опоры в ряду
    const xs = clusterLegXs(legs.map((l) => l.pos[0]));
    const zs = [...new Set(legs.map((l) => r1(l.pos[2] - sideZ0)))].sort((a, c) => a - c);
    // симметричная раскладка (отступ от торцов) — относительной: переживёт изменение ширины
    const sym = xs.length >= 2 && Math.abs(xs[0] - (r1(W) - xs[xs.length - 1])) < 0.6 && (xs.length === 2 || (xs.length === 3 && Math.abs(xs[1] - W / 2) < 0.6 && W > 1300));
    // шире 1300 при двух рядах (мойки k28 m17 1480, k31 m22 1347, остров k30 m01 1324 — все широкие модули Базиса с правильной
    // раскладкой) — без третьего ряда студии посередине (rows2); симметричные — по отступу от торцов, правые идут за боковиной
    const wide2 = xs.length === 2 && W > 1300;
    m.kitchen.legs = { back: zs[0], front: r1(d - zs[zs.length - 1]), ...(sym ? { side: xs[0], ...(wide2 ? { rows2: true as const } : {}) } : { xs }) };
    if (W < 250 && xs.length === 1 && Math.abs(xs[0] - W / 2) < 0.6) m.kitchen.legs = { back: zs[0], front: r1(d - zs[zs.length - 1]) };
    if (legScrews(ref.hardware)) m.kitchen.legs.screws = true;
    // левые опоры у большинства проектов — своя сетка (cb84c30b57a5); в части проектов (k26, k27) — та же, что у правых
    const lefts = legs.filter((l) => l.pos[0] < W / 2 - 0.6);
    if (lefts.length && lefts.every((l) => l.mesh === "ac675db9fc57")) m.kitchen.legs.same = true;
  }
  const clips = hw("клипса").length > 0;
  // цоколь модуля без опор — деталь ЛДСП под дном спереди, как бы она ни называлась в Базисе («Фронтальная» k20 m09): отступ от переда — как в Базисе
  const plInset = plinthPanel && !legs.length ? r1(sideZ1 - plinthPanel.b.z1) : undefined;
  if (role === "base" || role === "tall") m.kitchen.plinth = { ...(plinthPanel ? { height: r1(plinthPanel.b.y1 - plinthPanel.b.y0) } : { height: 95, off: true }), ...(legs.length && !clips ? { clips: false } : {}), ...(plInset !== undefined && Math.abs(plInset - 2) > 0.05 ? { inset: plInset } : {}) };
  // навесной/антресоль: дно выше низа боковин (боковины свисают на 18,5–28, или «дно» — верхняя горизонталь) — у Базиса под дном
  // спереди детали нет (задняя планка у стены k14 m06 — не цоколь), студия цоколь не ставит
  else if (!legs.length && (m.plinthHeight ?? 0) > 0 && !P.some(({ p, b }) => p.axis === "z" && board(p.kind) && b.y0 < 5 && b.y1 <= (bottom?.b.y0 ?? 0) + 1 && b.z1 >= sideZ1 - 40)) m.kitchen.plinth = { height: 95, off: true };
  if (fronts.length && !hw("ручка").length) m.noHandles = true;
  else if (fronts.length) { const hp = handlePlace(ref, fronts.map(({ b }) => [b.x0, b.y0, b.z0, b.x1, b.y1, b.z1])); if (hp) m.kitchen.handle = hp; } // место ручки как в Базисе (n4-wall)
  if (!plinthPanel && (role === "base" || role === "tall")) notes.push("цоколя в модуле нет (в Базисе — у ряда или отсутствует)");
  // корпус приподнят без опор: фронтальная панель ЛДСП под дном в Базисе (цоколь/планка под другим именем) — студия ставит её «Цоколем»;
  // нет такой панели — цоколя нет (навесной со свесом фасада ниже дна: правило Макса — не добавлять того, чего нет в Базисе)
  const lowFront = !legs.length && bottom && bottom.b.y0 > 0.5 ? P.find(({ p, b }) => p.axis === "z" && board(p.kind) && b.y1 <= bottom.b.y0 + 1 && b.z1 >= sideZ1 - 30 && !fronts.some((f) => f.b === b)) : undefined;
  if (lowFront) m.kitchen.lowFront = true;
  // царги
  const railList: NonNullable<Module["rails"]> = [];
  for (const r of rails) {
    const front = r.b.z1 >= sideZ1 - 30, w = r1(r.b.z1 - r.b.z0);
    const sb = front ? r1(sideZ1 - r.b.z1) : r1(r.b.z0 - sideZ0); // утопание передней — от фронта, задней — от задней кромки боковин
    // царга лёжа без крепежа в Базисе (k19 m10: передняя 69 — ни конфирмата, ни эксцентрика, ни шканта в её полосе) — студия не добавляет
    const bare = role === "base" && !railFastened(r.b, ref.hardware, Infinity, -Infinity);
    railList.push({ place: front ? "front-top" : "rear-top", height: w, lay: "flat", ...(sb > 0.5 ? { setback: sb } : {}), ...(bare ? { fasten: false as const } : {}) });
  }
  for (const r of railsEdge) {
    if (r === wr?.panel) continue; // фронтальная под дном навесного — уже панель raise.front, не стяжка (n3-wall)
    const front = r.b.z1 >= sideZ1 - 30;
    // навесной: планка на ребре, стоящая на дне (k04: верхняя и нижняя задние планки навески) — нижняя стяжка студии, не вторая «верхняя»
    if (wallRailOnBottom(role, r, bottom)) {
      const place = front ? "front-bottom" : "rear-bottom";
      railList.push({ place, height: r1(r.b.y1 - r.b.y0) });
      const ru = bottom ? railUnder(ref.hardware, r.b, bottom.b) : undefined; if (ru) m.kitchen.railUnder = { ...m.kitchen.railUnder, [place]: ru }; // эксцентрики и шканты снизу (n4-wall)
      continue;
    }
    // стяжка на ребре: место, высота, «на высоте», отступ от кромки (edgeRail) и без крепежа, если его нет в Базисе (n3-sink)
    // и крепёж по проекту: конфирматы через боковины (confY, если не один по центру) и через крышу/дно (topConf) — одно правило
    // railConf для нижних, навесных и антресолей (слияние n4-base railConfY и n4-wall railConf)
    const fastened = role !== "base" || railFastened(r.b, ref.hardware, left.b.x0, right.b.x1);
    const hz = topPanel && Math.abs(topPanel.b.y0 - r.b.y1) < 0.6 ? topPanel.b : bottom && Math.abs(bottom.b.y1 - r.b.y0) < 0.6 ? bottom.b : undefined;
    const rc = fastened && !m.kitchen.noFasteners && role !== "tall" ? railConf(r.b, ref.hardware, left.b.x0, right.b.x1, hz) : {};
    railList.push({ ...edgeRail(r.b, top, sideZ0, sideZ1), ...(fastened ? {} : { fasten: false as const }), ...rc });
  }
  if (railList.length) m.rails = railList;
  // задник
  const back = hdf.sort((a, c) => (c.b.x1 - c.b.x0) * (c.b.y1 - c.b.y0) - (a.b.x1 - a.b.x0) * (a.b.y1 - a.b.y0))[0];
  if (!back) m.backType = "none";
  else if (back.b.z1 <= sideZ0 + 0.5) {
    m.backType = "nailed"; m.backGap = r1(back.b.x0 - left.b.x0);
    const nails = recognizeNails(ref, back.b); if (nails) m.kitchen.nails = nails; // гвозди ХДФ по раскладке Базиса (n4-wall)
    // отступы снизу и сверху не как сбоку (k32 m06: 2 и 4 при 1,5) — по проекту; низ — от низа корпуса (у модуля на опорах — от дна)
    const yb = legs.length && bottom ? bottom.b.y0 : Math.min(left.b.y0, right.b.y0, bottom?.b.y0 ?? Infinity), g0 = r1(back.b.y0 - yb), g1 = r1(top - back.b.y1);
    if (!m.raisedSides && (Math.abs(g0 - m.backGap) > 0.01 || Math.abs(g1 - m.backGap) > 0.01) && g0 >= 0 && g1 >= 0) m.kitchen.backGapY = [g0, g1];
  }
  else {
    m.backType = "groove";
    const z0 = r1(back.b.z0 - sideZ0), gw = 4, gd = 8;
    m.grooveInset = r1(z0 - (gw - 3)); m.grooveWidth = gw; m.grooveDepth = gd;
    m.grooveClear = r1((W - 2 * t + 2 * gd - (back.b.x1 - back.b.x0)) / 2);
    // крыша перед ХДФ (k33, k34): крыша короче сзади, ХДФ проходит за ней почти до верха модуля
    if ((role === "wall" || role === "antresol") && topPanel && topPanel !== bottom && topPanel.b.z0 - sideZ0 > 0.5 && back.b.z1 <= topPanel.b.z0 + 0.5) {
      m.kitchen.topBack = r1(topPanel.b.z0 - sideZ0);
      if (back.b.y1 > topPanel.b.y0 + 0.5) m.kitchen.backTopGap = r1(top - back.b.y1);
      if (!bottom && m.kitchen.backTopGap !== undefined) m.kitchen.backBottomGap = r1(back.b.y0 - Math.min(left.b.y0, right.b.y0)); // без дна (k34 m04): ХДФ от низа модуля
      notes.push(`крыша короче сзади на ${m.kitchen.topBack} (перед ХДФ)${m.kitchen.backTopGap !== undefined ? `, ХДФ до верха минус ${m.kitchen.backTopGap}` : ""}`);
    }
    // ХДФ с вырезами в обоих верхних углах (k33, k34: 25×45) — контур Базиса из 8 точек
    const bn = role === "wall" || role === "antresol" ? topCornerNotchFromContour(back.p as unknown as { figure?: boolean; contour?: number[][]; contourPlane?: string }) : null;
    if (bn) { m.kitchen.backNotch = bn; notes.push(`ХДФ: вырезы ${bn.width}×${bn.height} в верхних углах`); }
    // крыша — та, что у студии (под верхом боковин): у k13 m04 «+ полка» верхняя горизонталь Базиса стоит над боковинами (1034 при высоте 705),
    // зазор от неё давал ХДФ отрицательной высоты (−18)
    const cy = bottom && topPanel && m.kitchen.backTopGap === undefined ? backClearY(back.b, bottom.b, { ...topPanel.b, y0: Math.min(topPanel.b.y0, H - t) }, gd, m.grooveClear) : undefined;
    if (cy) m.kitchen.backClearY = cy;
  }
  // ящики Axis PRO: по каждой левой направляющей — её фасад (по держателю фасада), царга (высота, цвет), дно и задняя стенка
  const axisRuns = ref.hardware.filter((h) => h.category === "направляющая" && /Axis PRO Направляющая/.test(h.name) && h.pos[0] < W / 2).sort((a, c) => a.pos[1] - c.pos[1]);
  const drawerPanels: typeof P = [];
  if (axisRuns.length) {
    const kd: KDrawer[] = [], axOwners = new Set<unknown>();
    for (const r of axisRuns) {
      const [x, y] = r.pos, len = Number(/(\d+)\s*$/.exec(r.name)?.[1] ?? 500) as AxisDrawer["len"];
      const side = ref.hardware.find((h) => /Axis PRO Царга H-\d+/.test(h.name) && Math.abs(h.pos[0] - x - 15.5) < 1 && Math.abs(h.pos[1] - y - 3.5) < 1);
      const hh = Number(/H-(\d+)/.exec(side?.name ?? "")?.[1] ?? 86) as AxisDrawer["h"], anthr = /Антрацит/i.test(side?.name ?? "");
      const f = fronts.find((q) => q.b.y0 <= y + 3.5 && q.b.y1 >= y + 3.5);
      const bot = P.find(({ p, b }) => /Дно выдв/.test(p.name) && Math.abs(b.y0 - (y - 22)) < 0.6), bk = P.find(({ p, b }) => /Задн\. ст\. выдв/.test(p.name) && Math.abs(b.y0 - (y - 22)) < 0.6);
      if (!f) { unsupported.push(`ящик Axis PRO на ${r1(y)} без фасада`); continue; }
      // внутренний ящик (8 модулей базы, k21 m03 и др.): держатели передней панели в точке держателя фасада, направляющая утоплена
      // от передней кромки корпуса (9) — своего фасада нет, стоит за фасадом ящика ниже или за дверью
      const pp = ref.hardware.some((h) => /Держатель ПП/.test(h.name) && Math.abs(h.pos[0] - x - 15.5) < 1 && Math.abs(h.pos[1] - y - 3.5) < 1);
      const front = r1(sideZ1 - r.pos[2]), inner = pp && front > 0.05;
      if (inner) notes.push(`ящик Axis PRO на ${r1(y)}: внутренний, за фасадом ящика ниже, утоплен на ${front} — как в Базисе`);
      axOwners.add(f);
      for (const q of [inner ? undefined : f, bot, bk]) if (q) drawerPanels.push(q);
      const backH = bk ? r1(bk.b.y1 - bk.b.y0) : undefined;
      const faceScrews = ref.hardware.some((h) => h.name === "3x3" && Math.abs(h.pos[0] - x - 15.5) < 1 && Math.abs(h.pos[1] - y - 3.5) < 1);
      kd.push({ system: "axis-pro", y0: r1(f.b.y0), y1: r1(f.b.y1), runnerY: r1(y), h: hh, len, ...(anthr ? { color: "anthracite" as const } : {}), ...(backH !== undefined && backH !== AXIS_BACK[hh] ? { backH } : {}), ...(faceScrews ? { faceScrews } : {}), ...(inner ? { inner: true as const, front } : front > 0.05 ? { front } : {}), // утоплен — как в Базисе (k25 m05: 1,5)
        ...(ref.hardware.some((h) => h.name.trim() === "Logo" && Math.abs(h.pos[0] - x - 37.5) < 1 && Math.abs(h.pos[1] - y - 9.6) < 0.5) ? { logo: true as const } : {}) });
    }
    if (kd.length) m.kdrawers = kd;
  }
  // ящики Firmax скрытого монтажа: короб ЛДСП 16 по левой боковине ящика; направляющие (по 2 точки Базиса на ящик) — снизу вверх
  const fxRuns = ref.hardware.filter((h) => h.category === "направляющая" && /Firmax/.test(h.name)).sort((a, c) => a.pos[1] - c.pos[1]);
  // короб Firmax без направляющих в проекте (fxBare) — короб без них (runs: []), студия направляющих не добавляет
  // Firmax вместе с внутренним ящиком Axis PRO (k30 m12/m13: два короба Firmax, за верхним фасадом — внутренний Axis) — каждый своей системой
  const axisInnerOnly = axisRuns.length > 0 && !!m.kdrawers?.length && m.kdrawers.every((k) => k.system === "axis-pro" && !!k.inner);
  if ((fxRuns.length || fxBare) && (!axisRuns.length || axisInnerOnly)) {
    const lefts = P.filter(({ p, b }) => /^Боковина ящика лев/i.test(p.name) && b.x0 < W / 2).sort((a, c) => a.b.y0 - c.b.y0);
    const kd: KDrawer[] = [];
    lefts.forEach((s) => {
      const b = s.b, inBox = (q: { b: typeof b }) => q.b.y0 >= b.y0 - 0.5 && q.b.y1 <= b.y1 + 0.5 && q.b.x0 >= b.x1 - 0.5 && q.b.x0 < b.x1 + 30 && q.b.z0 >= b.z0 - 0.5 && q.b.z1 <= b.z1 + 0.5;
      const ov = (q: { b: typeof b }) => Math.min(q.b.y1, b.y1) - Math.max(q.b.y0, b.y0);
      const f = [...fronts].sort((a, c) => ov(c) - ov(a))[0];
      const rs = P.find(({ p, b: q }) => /^Боковина ящика прав/i.test(p.name) && Math.abs(q.y0 - b.y0) < 0.6 && Math.abs(q.z0 - b.z0) < 0.6 && q.x0 > W / 2);
      const bot = P.find((q) => /^Дно ящика/i.test(q.p.name) && inBox(q)), bk = P.find((q) => /^Задн/i.test(q.p.name) && /ящика/i.test(q.p.name) && inBox(q) && q.b.z0 < b.z0 + 1), fal = P.find((q) => /^Фальш/i.test(q.p.name) && inBox(q));
      if (!f || !bot || !bk) { unsupported.push(`ящик Firmax на ${r1(b.y0)}: нет фасада/дна/задней стенки`); return; }
      for (const q of [f, s, rs, bot, bk, fal]) if (q && !drawerPanels.includes(q)) drawerPanels.push(q);
      const box: FirmaxBox = { y: r1(b.y0), h: r1(b.y1 - b.y0), len: r1(b.z1 - b.z0) };
      const gap = r1(b.x0 - left.b.x1), front = r1(sideZ1 - b.z1), bu = r1(bot.b.y0 - b.y0);
      if (gap !== FIRMAX.gap) box.gap = gap;
      if (Math.abs(front) > 0.05) box.front = front;
      if (bu !== FIRMAX.bottomUp) box.bottomUp = bu;
      const confs = ref.hardware.filter((h) => /онфирмат/.test(h.name) && Math.abs(h.pos[0] - b.x0) < 0.6);
      const cb = confs.filter((h) => Math.abs(h.pos[2] - (bk.b.z0 + 8)) < 1 && h.pos[1] > bk.b.y0 - 1 && h.pos[1] < bk.b.y1 + 1).map((h) => r1(h.pos[1] - bk.b.y0)).sort((a, c) => a - c);
      if (cb.length && JSON.stringify(cb) !== JSON.stringify(firmaxConf(r1(bk.b.y1 - bk.b.y0)))) box.conf = cb;
      const cz = confs.filter((h) => Math.abs(h.pos[1] - (bot.b.y0 + 8)) < 1).map((h) => r1(h.pos[2] - b.z0)).sort((a, c) => a - c);
      if (cz.length && cz[0] !== FIRMAX.confBottom) box.confBottom = cz[0];
      const fs = fal ? ref.hardware.filter((h) => /^Шуруп 3,5х30/.test(h.name) && Math.abs(h.pos[2] - fal.b.z0) < 0.6 && h.pos[1] > fal.b.y0 - 0.5 && h.pos[1] < fal.b.y1 + 0.5 && h.pos[0] > b.x1 && h.pos[0] < W - b.x1) : [];
      if (fs.length) box.faceScrews = fs.map((h) => [r1(h.pos[0] - b.x1), r1(h.pos[1] - fal!.b.y0)]);
      if (ref.hardware.some((h) => (h.name === "3x3" || /^Шуруп 3,5х16/.test(h.name)) && Math.abs(h.pos[0] - left.b.x1) < 0.6 && h.pos[1] > b.y0 - 0.5 && h.pos[1] < b.y0 + 40)) box.screws = true;
      if (!ref.hardware.some((h) => h.name === "5x12" && Math.abs(h.pos[2] - b.z0) < 0.6 && h.pos[1] > b.y0 - 0.5 && h.pos[1] < b.y0 + 40)) box.rearHoles = false;
      // точки направляющих Базиса: каждая — ящику с ближайшим низом короба не ниже точки (иначе — верхнему); не две в «x0, runnerY, F» — храним как есть
      const mine = fxRuns.filter((h) => (lefts.find((q) => q.b.y0 >= h.pos[1] - 0.1) ?? lefts[lefts.length - 1]) === s);
      // без своих точек (k22/m03: все 4 у нижнего ящика) — точка по правилу раскладки: низ своего фасада, а не чужая
      const runY = mine[0]?.pos[1] ?? f.b.y0;
      const std = mine.length === 2 && mine.every((h) => Math.abs(h.pos[0] - left.b.x1) < 0.05 && Math.abs(h.pos[1] - runY) < 0.05 && Math.abs(h.pos[2] - sideZ1) < 0.05);
      if (!std) box.runs = mine.map((h) => [r1(h.pos[0] - left.b.x1), r1(h.pos[1]), r1(h.pos[2] - sideZ1)]);
      kd.push({ system: "firmax-ldsp", y0: r1(f.b.y0), y1: r1(f.b.y1), runnerY: r1(runY), box });
    });
    if (kd.length) m.kdrawers = axisInnerOnly ? [...m.kdrawers!, ...kd].sort((x, y) => x.runnerY - y.runnerY) : kd;
  }
  // ящики MODERN SLIDE: короб ЛДСП как у Firmax/Versalite, направляющие без сетки — точки Базиса храним как есть (по правилу Firmax)
  const msRuns = ref.hardware.filter((h) => h.category === "направляющая" && /MODERN SLIDE/.test(h.name)).sort((a, c) => a.pos[1] - c.pos[1]);
  if (msRuns.length && !axisRuns.length) {
    const lefts = P.filter(({ p, b }) => /^Боковина ящика лев/i.test(p.name) && b.x0 < W / 2).sort((a, c) => a.b.y0 - c.b.y0);
    const kd: KDrawer[] = [];
    lefts.forEach((s) => {
      const b = s.b, inBox = (q: { b: typeof b }) => q.b.y0 >= b.y0 - 0.5 && q.b.y1 <= b.y1 + 0.5 && q.b.x0 >= b.x1 - 0.5 && q.b.x0 < b.x1 + 30 && q.b.z0 >= b.z0 - 0.5 && q.b.z1 <= b.z1 + 0.5;
      const ov = (q: { b: typeof b }) => Math.min(q.b.y1, b.y1) - Math.max(q.b.y0, b.y0);
      const f = [...fronts].sort((a, c) => ov(c) - ov(a))[0];
      const rs = P.find(({ p, b: q }) => /^Боковина ящика прав/i.test(p.name) && Math.abs(q.y0 - b.y0) < 0.6 && Math.abs(q.z0 - b.z0) < 0.6 && q.x0 > W / 2);
      const bot = P.find((q) => /^Дно ящика/i.test(q.p.name) && inBox(q)), bk = P.find((q) => /^Задн/i.test(q.p.name) && /ящика/i.test(q.p.name) && inBox(q) && q.b.z0 < b.z0 + 1), fal = P.find((q) => /^Фальш/i.test(q.p.name) && inBox(q));
      if (!f || !bot || !bk) { unsupported.push(`ящик MODERN SLIDE на ${r1(b.y0)}: нет фасада/дна/задней стенки`); return; }
      for (const q of [f, s, rs, bot, bk, fal]) if (q && !drawerPanels.includes(q)) drawerPanels.push(q);
      const box: FirmaxBox = { y: r1(b.y0), h: r1(b.y1 - b.y0), len: r1(b.z1 - b.z0) };
      const gap = r1(b.x0 - left.b.x1), front = r1(sideZ1 - b.z1), bu = r1(bot.b.y0 - b.y0);
      if (gap !== MODERN.gap) box.gap = gap;
      if (Math.abs(front) > 0.05) box.front = front;
      if (bu !== MODERN.bottomUp) box.bottomUp = bu;
      const confs = ref.hardware.filter((h) => /онфирмат/.test(h.name)), side = confs.filter((h) => Math.abs(h.pos[0] - b.x0) < 0.6);
      const cb = side.filter((h) => Math.abs(h.pos[2] - (bk.b.z0 + 8)) < 1 && h.pos[1] > bk.b.y0 - 1 && h.pos[1] < bk.b.y1 + 1).map((h) => r1(h.pos[1] - bk.b.y0)).sort((a, c) => a - c);
      if (cb.length && JSON.stringify(cb) !== JSON.stringify(firmaxConf(r1(bk.b.y1 - bk.b.y0)))) box.conf = cb;
      const cz = side.filter((h) => Math.abs(h.pos[1] - (bot.b.y0 + 8)) < 1).map((h) => r1(h.pos[2] - b.z0)).sort((a, c) => a - c);
      if (cz.length && cz[0] !== MODERN.confBottom) box.confBottom = cz[0];
      const cu = confs.filter((h) => Math.abs(h.pos[1] - bot.b.y0) < 0.3 && h.pos[0] > b.x1 && h.pos[0] < bot.b.x1 && h.pos[2] > b.z0 && h.pos[2] < b.z1).map((h) => r1(h.pos[0] - b.x1)).sort((a, c) => a - c);
      if (cu.length && cu[0] !== MODERN.confUnder) box.confUnder = cu[0];
      const fs = fal ? ref.hardware.filter((h) => /^Саморез 4х30/.test(h.name) && Math.abs(h.pos[2] - fal.b.z0) < 0.6 && h.pos[1] > fal.b.y0 - 0.5 && h.pos[1] < fal.b.y1 + 0.5) : [];
      if (fs.length) box.faceScrews = fs.map((h) => [r1(h.pos[0] - b.x1), r1(h.pos[1] - fal!.b.y0)] as [number, number]);
      if (!ref.hardware.some((h) => /^Саморез 3,5х16/.test(h.name) && Math.abs(h.pos[0] - left.b.x1) < 0.6 && h.pos[1] > b.y0 - 0.5 && h.pos[1] < b.y0 + 40)) box.screws = false;
      if (!ref.hardware.some((h) => h.name === "5x12" && Math.abs(h.pos[2] - b.z0) < 0.6 && h.pos[1] > b.y0 - 0.5 && h.pos[1] < b.y0 + 40)) box.rearHoles = false;
      const mine = msRuns.filter((h) => (lefts.find((q) => q.b.y0 >= h.pos[1] - 0.1) ?? lefts[lefts.length - 1]) === s);
      box.runs = mine.map((h) => [r1(h.pos[0] - left.b.x1), r1(h.pos[1]), r1(h.pos[2] - sideZ1)]);
      kd.push({ system: "modern-slide", y0: r1(f.b.y0), y1: r1(f.b.y1), runnerY: r1(b.y0), box });
    });
    if (kd.length) m.kdrawers = kd;
  }
  // ящики Indigo: по каждой направляющей у левой боковины корпуса — царга (H=90/175, цвет), дно и задняя стенка ЛДСП
  const igRuns = ref.hardware.filter((h) => h.category === "направляющая" && /^Направляющая Indigo/.test(h.name) && Math.abs(h.pos[0] - left.b.x1) < 0.6).sort((a, c) => a.pos[1] - c.pos[1]);
  if (igRuns.length && !axisRuns.length) {
    const kd: KDrawer[] = [];
    for (const r of igRuns) {
      const [x, y] = r.pos, cg = ref.hardware.find((h) => /^Царга Indigo H=\d+/.test(h.name) && Math.abs(h.pos[0] - x) < 0.6 && Math.abs(h.pos[1] - y + 44) < 1);
      const hc = Number(/H=(\d+)/.exec(cg?.name ?? "")?.[1]);
      const bot = P.find(({ p, b }) => /^Дно ящ/.test(p.name) && Math.abs(b.y0 - (y - 5)) < 0.6), bk = P.find(({ p, b }) => /^Зад\. ст\. ящ/.test(p.name) && Math.abs(b.y0 - (y + 11.4)) < 0.6);
      const f = fronts.find((q) => q.b.y0 <= y && q.b.y1 >= y);
      if (!cg || (hc !== 90 && hc !== 175) || !f || !bot || !bk) { unsupported.push(`ящик Indigo на ${r1(y)}: нет царги H=90/175, фасада, дна или задней стенки`); continue; }
      drawerPanels.push(f, bot, bk);
      const backH = r1(bk.b.y1 - bk.b.y0), def = hc === 175 ? 147.2 : 62.2;
      kd.push({ system: "indigo", y0: r1(f.b.y0), y1: r1(f.b.y1), runnerY: r1(y), hc, len: 500, ...(/белая/.test(cg.name) ? { color: "white" as const } : {}), ...(Math.abs(backH - def) > 0.05 ? { backH } : {}), ...(/правая/.test(r.name) ? { mirror: true as const } : {}) });
      // зеркальный модуль Базиса (k16 m05): у левой боковины корпуса «правая» направляющая — сетки зеркального набора
      if (/правая/.test(r.name)) notes.push(`ящик Indigo на ${r1(y)}: модуль в Базисе зеркальный — сетки зеркального набора`);
    }
    if (kd.length) m.kdrawers = kd;
  }
  // ящики Boyard СТАРТ: по каждой левой направляющей — боковина SBxx (тип), дно и задняя стенка ЛДСП, рейлинг; фасад — по высоте оси.
  // Внутренний ящик (за чужим фасадом, утоплен) — без своего фасада, как в Базисе.
  const stRuns = ref.hardware.filter((h) => h.category === "направляющая" && /СТАРТ Soft-Closing/.test(h.name) && h.pos[0] < W / 2).sort((a, c) => a.pos[1] - c.pos[1]);
  // в одном модуле бывают СТАРТ и Axis PRO вместе (k21 m03: нижний СТАРТ, верхний Axis) — каждый ящик своей системой
  if (stRuns.length) {
    const kd: KDrawer[] = [], owners = new Map<unknown, number>();
    for (const r of stRuns) {
      const [x, y, z] = r.pos, len = (Number(/(\d+)\s*мм/.exec(r.name)?.[1] ?? 500) === 400 ? 400 : 500) as 400 | 500;
      const side = ref.hardware.find((h) => /^Боковина СТАРТ SB\d+/.test(h.name) && Math.abs(h.pos[0] - x - 37.5) < 1 && Math.abs(h.pos[2] - z) < 1 && Math.abs(h.pos[1] - y) < 30);
      const sb = (/SB(08|19|20)/.exec(side?.name ?? "")?.[0] ?? "") as "SB08" | "SB19" | "SB20" | "";
      if (!sb) { unsupported.push(`ящик СТАРТ на ${r1(y)}: нет боковины SB08/SB19/SB20`); continue; }
      const sy = side!.pos[1], front = r1(sideZ1 - z);
      const bot = P.find(({ p, b }) => /^Дно ящ/.test(p.name) && Math.abs(b.y0 - sy) < 0.6 && b.x0 < W / 2), bk = P.find(({ p, b }) => /^Зад\. ст\. ящ/.test(p.name) && Math.abs(b.y0 - sy) < 0.6);
      const f = fronts.find((q) => q.b.y0 <= y && q.b.y1 >= y) ?? fronts.find((q) => q.b.y0 <= y + 14.5 && q.b.y1 >= y + 14.5);
      if (!f || !bot || !bk) { unsupported.push(`ящик СТАРТ на ${r1(y)}: нет фасада/дна/задней стенки`); continue; }
      const prev = owners.get(f), inner = prev !== undefined && front > 0.05;
      if (!inner) { owners.set(f, kd.length); drawerPanels.push(f); }
      drawerPanels.push(bot, bk);
      const backH = r1(bk.b.y1 - bk.b.y0), rys = ref.hardware.filter((h) => /^Рейлинг продольный.*СТАРТ/.test(h.name) && Math.abs(h.pos[0] - x - 15.5) < 1 && h.pos[1] > y + 150 && h.pos[1] < y + 320).map((h) => r1(h.pos[1] - y)).sort((a, c) => a - c), rail = rys.length > 0;
      const rh = ref.hardware.find((h) => /^Держатель рейлинга СТАРТ/.test(h.name) && Math.abs(h.pos[0] - x - 52.5) < 1 && h.pos[1] > y && h.pos[1] < y + 300);
      const def = { SB08: 84, SB19: 118, SB20: 220 }[sb];
      // кромка дна и задней стенки — как в проекте (у k17 дно по кругу, у k27 SB19 задняя только ±y)
      const eSides = (q: typeof bot) => ((q.p as unknown as { edges?: { side: string; thick: number }[] }).edges ?? []).filter((e) => e.thick > 0).map((e) => e.side);
      const be = eSides(bot), ke = new Set(eSides(bk)), backAll = ke.has("+x") || ke.has("-x"), edge: { bottom?: boolean; back?: "y" | "all" } = {};
      if (be.length) edge.bottom = true;
      if (backAll !== (sb !== "SB08")) edge.back = backAll ? "all" : "y";
      kd.push({ system: "start-sc", y0: r1(f.b.y0), y1: r1(f.b.y1), runnerY: r1(y), len, sb, ...(rail ? { rail: true } : {}), ...(rail && JSON.stringify(rys) !== "[206.5]" ? { railYs: rys } : {}), ...(rh && Math.abs(rh.pos[1] - y - 201.4) > 0.05 ? { railDy: r1(rh.pos[1] - y) } : {}),
        ...(backH !== def ? { backH } : {}), ...(front > 0.05 ? { front } : {}), ...(inner ? { inner: true } : {}), ...(edge.bottom || edge.back ? { edge } : {}) });
    }
    if (kd.length) m.kdrawers = axisRuns.length && m.kdrawers?.length ? [...m.kdrawers, ...kd].sort((a, c) => a.runnerY - c.runnerY) : kd;
  }
  // ящики Versalite Light H45: короб ЛДСП 16 по левой боковине ящика, левая направляющая — на внутренней грани левой боковины корпуса
  const vlRuns = ref.hardware.filter((h) => h.category === "направляющая" && /Versalite Light H45/.test(h.name));
  if (vlRuns.length && !axisRuns.length && !fxRuns.length) {
    const lefts = P.filter(({ p, b }) => /^Боковина ящика лев/i.test(p.name) && b.x0 < W / 2).sort((a, c) => a.b.y0 - c.b.y0);
    const kd: KDrawer[] = [];
    lefts.forEach((s) => {
      const b = s.b, inBox = (q: { b: typeof b }) => q.b.y0 >= b.y0 - 0.5 && q.b.y1 <= b.y1 + 0.5 && q.b.x0 >= b.x1 - 0.5 && q.b.x0 < b.x1 + 30 && q.b.z0 >= b.z0 - 0.5 && q.b.z1 <= b.z1 + 0.5;
      // цокольный ящик под дном корпуса (k07 m01/m04: короб с 10, фасад утоплен в цоколь) — в студии такого ящика нет: честно
      // «не поддержано», а не ящик внутри корпуса с чужим фасадом и ошибкой «уходит в дно»
      const ov = (q: { b: typeof b }) => Math.min(q.b.y1, b.y1) - Math.max(q.b.y0, b.y0);
      const f = [...fronts].sort((a, c) => ov(c) - ov(a))[0];
      if (f && ov(f) <= 0) { unsupported.push(`ящик Versalite на ${r1(b.y0)}: своего фасада в ряду фасадов нет (цокольный ящик под дном корпуса) — пока не поддержан`); return; }
      const run = vlRuns.find((h) => Math.abs(h.pos[0] - left.b.x1) < 0.6 && h.pos[1] > b.y0 - 0.5 && h.pos[1] < b.y1 + 0.5);
      const rs = P.find(({ p, b: q }) => /^Боковина ящика прав/i.test(p.name) && Math.abs(q.y0 - b.y0) < 0.6 && Math.abs(q.z0 - b.z0) < 0.6 && q.x0 > W / 2);
      const bot = P.find((q) => /^Дно ящика/i.test(q.p.name) && inBox(q)), bk = P.find((q) => /^Задн/i.test(q.p.name) && /ящика/i.test(q.p.name) && inBox(q) && q.b.z0 < b.z0 + 1), fal = P.find((q) => /^Фальш/i.test(q.p.name) && inBox(q));
      if (!f || !bot || !bk || !run) { unsupported.push(`ящик Versalite на ${r1(b.y0)}: нет фасада/дна/задней стенки/направляющей у левой боковины корпуса`); return; }
      for (const q of [f, s, rs, bot, bk, fal]) if (q && !drawerPanels.includes(q)) drawerPanels.push(q);
      const len = Number(/(\d+)\s*$/.exec(run.name)?.[1] ?? 500) as VersaliteLen;
      const box: FirmaxBox = { y: r1(b.y0), h: r1(b.y1 - b.y0), len: r1(b.z1 - b.z0) };
      const gap = r1(b.x0 - left.b.x1), front = r1(sideZ1 - b.z1), bu = r1(bot.b.y0 - b.y0);
      if (gap !== VERSALITE.gap) box.gap = gap;
      if (Math.abs(front) > 0.05) box.front = front;
      if (bu !== VERSALITE.bottomUp) box.bottomUp = bu;
      const confs = ref.hardware.filter((h) => /онфирмат/.test(h.name));
      const side = confs.filter((h) => Math.abs(h.pos[0] - b.x0) < 0.6);
      const cb = side.filter((h) => Math.abs(h.pos[2] - (bk.b.z0 + 8)) < 1 && h.pos[1] > bk.b.y0 - 1 && h.pos[1] < bk.b.y1 + 1).map((h) => r1(h.pos[1] - bk.b.y0)).sort((a, c) => a - c);
      if (cb.length && JSON.stringify(cb) !== JSON.stringify(firmaxConf(r1(bk.b.y1 - bk.b.y0)))) box.conf = cb;
      const cz = side.filter((h) => Math.abs(h.pos[1] - (bot.b.y0 + 8)) < 1).map((h) => r1(h.pos[2] - b.z0)).sort((a, c) => a - c);
      if (cz.length && cz[0] !== VERSALITE.confBottom) box.confBottom = cz[0];
      const cu = confs.filter((h) => Math.abs(h.pos[1] - bot.b.y0) < 0.3 && h.pos[0] > b.x1 && h.pos[0] < bot.b.x1 && h.pos[2] > b.z0 && h.pos[2] < b.z1).map((h) => r1(h.pos[0] - b.x1)).sort((a, c) => a - c);
      if (cu.length && cu[0] !== VERSALITE.confUnder) box.confUnder = cu[0];
      kd.push({ system: "versalite-h45", y0: r1(f.b.y0), y1: r1(f.b.y1), runnerY: r1(run.pos[1]), len, box });
    });
    if (kd.length) m.kdrawers = kd;
  }
  // фасады (одна строка распашных; ящики — выше)
  const doors = fronts.filter((f) => hw("петля").length);
  if (fronts.length) {
    const f0 = fronts[0];
    if (f0.p.kind === "other" || f0.p.kind === "mdf") m.facadeMaterial = "external";
    const fEdge = (f0.p as unknown as { edges?: { thick: number }[] }).edges?.find((e) => e.thick > 0)?.thick;
    if (m.facadeMaterial === "external" && fEdge) m.facadeEdge = fEdge; // фасадный материал с кромкой «фасадная 1×22»
    m.facadeT = r1(f0.b.z1 - f0.b.z0);
    m.faceAir = r1(f0.b.z0 - sideZ1);
    m.faceGap = fronts.length === 1 ? faceGapOf(f0.b, left.b.x0, right.b.x1, top) : r1(f0.b.x0 - left.b.x0);
    // зазор между фасадами: сосед в том же ряду (по x); если рядов несколько, а в ряду один фасад — зазор между рядами (по y)
    const sameRow = fronts.find((q) => q !== f0 && Math.abs(q.b.y0 - f0.b.y0) < 1 && q.b.x0 > f0.b.x1 - 1);
    const above = fronts.filter((q) => q.b.y0 > f0.b.y1 - 1).sort((a, c) => a.b.y0 - c.b.y0)[0];
    m.faceGapBetween = m.kdrawers ? 3 : sameRow ? r1(sameRow.b.x0 - f0.b.x1) : above ? r1(above.b.y0 - f0.b.y1) : 3; // одиночный фасад: зазор по Базису 3 (при разделении на створки)
    const rows = new Set(fronts.map((f) => Math.round(f.b.y0)));
    // пенал: два ряда распашных (низ + верх, по одной или по две створки) = section.doorSplit студии (разрез фасадов по высоте)
    const rowYs = [...rows].sort((a, c) => a - c), inRow = (y: number) => fronts.filter((q) => Math.abs(Math.round(q.b.y0) - y) < 1);
    const lowRow = inRow(rowYs[0]), upRow = rowYs.length > 1 ? inRow(rowYs[1]) : [];
    const rowsGap = upRow.length && lowRow.length ? upRow[0].b.y0 - lowRow[0].b.y1 : 0;
    // только пенал (role tall) и только если верхний ряд в пределах корпуса: пенал из двух корпусов (k30 m05: боковины 850, фасады до 2469) — не разрез
    // навесной: два ряда распашных (нижний и верхний фасад, k23, k07, k04) — тот же разрез doorSplit
    // навесной — только распашные на боковых петлях: складной подъёмник (ФриФолд, k07 m08/m10) и петли на крыше — не разрез фасадов
    const wallSwing = role === "wall" && !ref.hardware.some((h) => /фри\s*фолд|free\s*fold|подъемник|подъёмник/i.test(h.name)) && hw("петля").every((h) => h.pos[0] <= left.b.x1 + 1 || h.pos[0] >= right.b.x0 - 1);
    // антресоль в два ряда подъёмных фасадов (k13 m02: все петли — на нижних плоскостях горизонталей) — тот же разрез фасадов по высоте,
    // что у пенала; два ряда распашных у антресоли (k27 m12) — по-прежнему «не поддержано»
    const liftQ = (h: { quat?: number[] }) => !!h.quat && Math.abs(h.quat[0]) < 0.1 && Math.abs(h.quat[2]) < 0.1 && Math.abs(Math.abs(h.quat[1]) - Math.SQRT1_2) < 0.05;
    const liftRows = role === "antresol" && hw("петля").length > 0 && hw("петля").every(liftQ);
    const tallRows = (role === "tall" || wallSwing || liftRows) && rowYs.length === 2 && !m.kdrawers;
    const upOver = tallRows && upRow.length ? r1(Math.max(...upRow.map((q) => q.b.y1)) - top) : 0;
    const rowsOk = tallRows && upOver <= 20 && lowRow.length === upRow.length && lowRow.length <= 2 && rowsGap > -0.5;
    const niche = rowsOk && role === "tall" && rowsGap > 10 ? nicheFromRows(lowRow.map((q) => q.b), upRow.map((q) => q.b)) : undefined;
    const split = rowsOk && rowsGap <= 10;
    // 3+ ряда распашных у пенала: все фасады — двери (на петлях), верхний ряд в пределах корпуса
    const allRows = rowYs.map(inRow), topOver = fronts.length ? r1(Math.max(...fronts.map((q) => q.b.y1)) - top) : 0;
    const multi = role === "tall" && rowYs.length >= 3 && rowYs.length <= 5 && !m.kdrawers && topOver <= 20 && hw("петля").length > 0 && !hw("направляющая").length && !fronts.some((q) => /^Фронтал/i.test(q.p.name)) ? doorRowsFromFronts(allRows.map((r) => r.map((q) => q.b))) : undefined;
    if (niche) {
      // ниша под технику (духовка/СВЧ) между рядами распашных: нижний ряд — doorSplit, ниша — doorNiche, зазор створок — faceGapBetween
      m.faceGapBetween = niche.gap;
      m.sections[0].doorSplit = niche.split;
      m.sections[0].doorNiche = niche.niche;
      notes.push(`ниша под технику ${niche.niche} мм между рядами фасадов`);
    } else if (tallRows && upOver > 20) unsupported.push(`фасады пенала выше боковин на ${upOver} мм (пенал из нескольких корпусов) — пока не поддержано`);
    else if (tallRows && rowsGap > 10) unsupported.push(`ниша под технику между фасадами ${r1(rowsGap)} мм (пенал под духовку/СВЧ), ряды фасадов разные — пока не поддержано`);
    else if (split) {
      const gapY = r1(upRow[0].b.y0 - lowRow[0].b.y1);
      m.sections[0].doorSplit = r1(lowRow[0].b.y1 + gapY / 2 - lowRow[0].b.y0); // от низа нижнего фасада до середины зазора между рядами
      if (lowRow.length === 1) m.faceGapBetween = gapY;
    } else if (multi) {
      // пенал в 3+ ряда распашных: нижний — doorSplit, средние — doorRows, верхний — до верха; ниша над нижним — doorNiche
      m.faceGapBetween = multi.gap;
      m.sections[0].doorSplit = multi.split;
      if (multi.niche !== undefined) m.sections[0].doorNiche = multi.niche;
      m.sections[0].doorRows = multi.rows;
      notes.push(`фасады в ${rowYs.length} ряда: средние ${multi.rows.join(", ")}${multi.niche !== undefined ? `, ниша ${multi.niche}` : ""}`);
    } else if (role === "base" && ffFlat && rows.size === 1) {
      m.kitchen.faceFiller = { side: ffFlat.side, width: ffFlat.width, ...(ffFlat.strip ? { strip: ffFlat.strip } : {}), ...(ffFlat.stripFull ? { stripFull: true } : {}), ...(ffFlat.conf ? { conf: ffFlat.conf } : {}) };
      // зазор фасадов — от дальнего края модуля (у фальша свой отступ)
      m.faceGap = ffFlat.side === "left" ? r1(right.b.x1 - Math.max(...fronts.map((q) => q.b.x1))) : r1(Math.min(...fronts.map((q) => q.b.x0)) - left.b.x0);
      notes.push(`угловая мойка: фальш ${ffFlat.width}${ffFlat.strip ? ` + планка из фасада ${ffFlat.strip}` : ""} ${ffFlat.side === "left" ? "слева" : "справа"}, петли под фальшпанель — как в Базисе`);
    } else if (role === "base" && cornerFillerSink(ref)) unsupported.push("угловая мойка с фальшпанелью (петли под фальшпанель, фальш в плоскости фасадов) — пока не поддержано");
    else if (rows.size > 1 && !m.kdrawers) unsupported.push(`фасады в ${rows.size} ряда (ящики/антресоль) — распознаватель пока только для одного ряда распашных`);
    const perRow = split || niche || multi ? lowRow.length : fronts.length;
    // пенал без петель в Базисе, но с дверями (k23 «Пустой»): двери есть, петель нет — не добавляем их (hingeless)
    const bareDoors = role === "tall" && !doors.length && !m.kdrawers && !hw("направляющая").length && fronts.every((q) => /^Дверь/i.test(q.p.name));
    m.doors = doors.length > 0 || bareDoors;
    // корпус без опор: низ распашных фасадов — как в Базисе, если правило шкафов (у пола) даёт другое
    // (над нишей под техникой — от дна: k30 m02 1815,5, k18 m21 2031,5; k13 m05 — 361,5)
    // только фасады в габарите корпуса (у k18 m09 в модуле лежит чужая «Фронтальная» на −1520) и не «Фронтальная»
    const own = fronts.filter((q) => q.b.x0 >= -1 && q.b.x1 <= W + 1 && q.b.y0 >= -0.5 && q.b.y1 <= top + 20 && !/^Фронтал/i.test(q.p.name));
    if (m.doors && !m.feet && !m.kdrawers && own.length) { const fy = r1(Math.min(...own.map((q) => q.b.y0))); if (Math.abs(fy - facadeBottom(m)) > 0.5 && fy < H - 100) m.kitchen.faceBottom = fy; }
    if (role === "tall" && m.doors) {
      // ряды фасадов Базиса = ряды створок студии (doorRowCount): иначе номера створок не те
      const rowsB = (m.sections[0].doorSplit !== undefined ? rowYs.map(inRow) : [fronts]).map((r) => r.map((q) => q.b));
      const hl = rowsB.length === doorRowCount(m, m.sections[0]) ? hingelessDoors(rowsB, hw("петля"), perRow >= 2 ? 2 : 1, fronts.length) : [];
      if (hl.length) { m.sections[0].hingeless = hl; notes.push(`фасады без петель (как в Базисе): ${hl.join(", ")}`); }
    }
    m.sections[0].doorLeaves = (perRow >= 2 ? 2 : 1) as 1 | 2; // число створок — как в Базисе («авто» студии делит 630 на две)
    // подъёмный фасад: «Петля накладная» на нижней плоскости крыши (кватернион Базиса [0,−0,71,0,0,71]), выше середины фасада
    const topHinge = (h: { pos: number[]; quat?: number[] }) => !!h.quat && Math.abs(h.quat[0]) < 0.1 && Math.abs(h.quat[2]) < 0.1 && Math.abs(Math.abs(h.quat[1]) - Math.SQRT1_2) < 0.05 && h.pos[1] > (f0.b.y0 + f0.b.y1) / 2;
    if (fronts.length === 1 && hw("петля").length && hw("петля").every(topHinge)) {
      m.sections[0].doorHinges = ["top"];
      // газлифт PD-G-N02 Базиса (шток, газблок, фиксаторы) — комплект на боковину
      if (hw("газлифт").some((h) => /PD-G-N02/.test(h.name))) m.kitchenLift = { system: "pd-g-n02" };
      if (hw("газлифт").some((h) => !/PD-G-N02/.test(h.name))) unsupported.push(`газлифт ${hw("газлифт").find((h) => !/PD-G-N02/.test(h.name))!.name}`);
      const xs = hw("петля").map((h) => r1(h.pos[0] - f0.b.x0)).sort((a, c) => a - c), dw = r1(f0.b.x1 - f0.b.x0);
      const hx = liftHingeX(xs, dw, r1(f0.b.y1 - f0.b.y0));
      if (hx) { m.sections[0].hingeX = hx; m.sections[0].hingeXFor = dw; notes.push(`петли подъёмного фасада не по правилу 100 мм от кромок: ${xs.join(", ")} — как в проекте`); }
    } else if (split && role === "antresol" && hw("петля").length && hw("петля").every(topHinge)) {
      // антресоль в два ряда подъёмных фасадов (k13 m02): каждый ряд — на петлях по своей горизонтали (полка, крыша)
      m.sections[0].doorHinges = Array.from({ length: 4 }, () => "top" as const);
      if (hw("газлифт").length) unsupported.push(`газлифт у двух рядов подъёмных фасадов — пока не поддержано`);
    } else if (perRow === 1) {
      const hinges = hw("петля"), onLeft = hinges.filter((h) => h.pos[0] < W / 2).length, onRight = hinges.length - onLeft;
      m.sections[0].hingeSide = onRight > onLeft ? "right" : "left";
      // угловая мойка: одна дверь висит на петлях под фальшпанель — со стороны фальша (k01 m03: петли на 502 из 950)
      if (m.kitchen.faceFiller) m.sections[0].hingeSide = m.kitchen.faceFiller.side;
    }
    if (perRow > 2 && !m.kdrawers) unsupported.push(`${fronts.length} фасадов в ряду`);
  } else m.doors = false;
  // высоты петель (от низа фасада) — как в проекте, если отличаются от правила 100 мм от краёв
  if (fronts.length && doors.length && !m.sections[0].doorHinges?.includes("top")) {
    const twoRows = m.sections[0].doorSplit !== undefined; // два ряда (пенал): петли нижнего фасада — hingeY, верхнего — hingeYUp
    const rowHinges = (f: (typeof fronts)[number]) => {
      // дубль петли Базиса в той же точке (k01 m09) — одна высота, иначе студия поставит лишнюю петлю на каждую створку
      const ys = hw("петля").filter((h, k, all) => !all.slice(0, k).some((o) => o.pos.every((v, i) => Math.abs(v - h.pos[i]) < 0.6)))
        .filter((h) => h.pos[0] >= f.b.x0 - 30 && h.pos[0] <= f.b.x1 + 30 && (!twoRows || (h.pos[1] >= f.b.y0 && h.pos[1] <= f.b.y1))).map((h) => r1(h.pos[1] - f.b.y0)).sort((a, c) => a - c);
      const def = (() => { const n = ys.length, dh = f.b.y1 - f.b.y0, off = Math.min(100, Math.max(40, dh / 4)); return Array.from({ length: n }, (_, k) => n === 1 ? dh / 2 : off + (dh - 2 * off) * k / (n - 1)); })();
      // число петель по правилу кухни — по высоте фасада; если в проекте другое число или другие высоты — берём высоты проекта
      const n0 = (f.b.y1 - f.b.y0) <= 900 ? 2 : (f.b.y1 - f.b.y0) <= 1300 ? 3 : (f.b.y1 - f.b.y0) <= 1700 ? 4 : (f.b.y1 - f.b.y0) <= 2100 ? 5 : 6;
      return { ys, custom: ys.length > 0 && (ys.length !== n0 || ys.some((y, k) => Math.abs(y - def[k]) > 0.5)), dh: r1(f.b.y1 - f.b.y0) };
    };
    const lo = rowHinges(fronts[0]);
    if (lo.custom) { m.sections[0].hingeY = lo.ys; m.sections[0].hingeYFor = lo.dh; }
    if (twoRows) {
      // ряды снизу вверх (левая створка ряда): верхний — hingeYUp, средние (doorRows) — hingeYMid, если не по правилу
      const ysR = [...new Set(fronts.map((f) => Math.round(f.b.y0)))].sort((a, c) => a - c);
      const rowF = (y: number) => fronts.filter((q) => Math.abs(Math.round(q.b.y0) - y) < 1).sort((a, c) => a.b.x0 - c.b.x0)[0];
      const fu = rowF(ysR[ysR.length - 1]), up = rowHinges(fu);
      const midN = m.sections[0].doorRows?.length ?? 0;
      if (midN && ysR.length === midN + 2) {
        const mids = ysR.slice(1, -1).map((y) => rowHinges(rowF(y)));
        if (mids.some((r) => r.custom)) { m.sections[0].hingeYMid = mids.map((r) => (r.custom ? r.ys : [])); m.sections[0].hingeYMidFor = mids.map((r) => r.dh); }
      }
      // верхний ряд: свои высоты, если не совпадают с тем, что студия дала бы сама (правило или масштаб нижних)
      const scaled = lo.custom ? scaleHingeY(lo.ys, lo.dh, up.dh) : null;
      if (up.custom || (scaled && (scaled.length !== up.ys.length || scaled.some((y, k) => Math.abs(y - up.ys[k]) > 0.5)))) { m.sections[0].hingeYUp = up.ys; m.sections[0].hingeYUpFor = up.dh; }
    }
  }
  // полки (ЛДСП и стекло)
  const glassSh = P.filter(({ p }) => p.axis === "y" && p.kind === "glass");
  const innerBottom = bottom ? bottom.b.y1 : 0, innerTop = topPanel ? topPanel.b.y0 : top;
  const sh = [...shelves, ...glassSh].sort((a, c) => a.b.y0 - c.b.y0), looseBare: number[] = [];
  m.sections[0].shelves = sh.map((s) => (s.b.y0 + s.b.y1) / 2).map((cy) => (cy - innerBottom) / (innerTop - innerBottom));
  const gl = sh.map((s, j) => (glassSh.includes(s) ? j : -1)).filter((j) => j >= 0);
  if (gl.length) { m.sections[0].glassShelves = gl; m.glassT = r1(glassSh[0].b.y1 - glassSh[0].b.y0); m.glassGap = r1(glassSh[0].b.x0 - left.b.x1); }
  if (sh.length) {
    const s0 = sh[0], rear = m.backType === "groove" ? (m.grooveInset ?? 16) + 3 + 1 : 0;
    m.sections[0].shelfDepth = r1(s0.b.z1 - s0.b.z0);
    m.shelfRear = r1(s0.b.z0 - sideZ0 - rear);
    const pins = hw("полкодержатель").filter((h) => Math.abs(h.pos[1] - s0.b.y0) < 2);
    if (pins.length) m.shelfPinInset = r1(Math.min(...pins.map((h) => h.pos[2] - s0.b.z0)));
    const noPins = sh.map((s, j) => (hw("полкодержатель").some((h) => Math.abs(h.pos[1] - s.b.y0) < 2) ? -1 : j)).filter((j) => j >= 0);
    // полка с зазорами у стоек (как съёмная), но без полкодержателей и крепежа в Базисе (k23 «Пустой») — съёмная без фурнитуры, не жёсткая
    looseBare.push(...noPins.filter((j) => !glassSh.includes(sh[j]) && sh[j].b.x0 - left.b.x1 >= 0.9 && right.b.x0 - sh[j].b.x1 >= 0.9 && bareShelvesFromEtalon(ref, sh.map((q) => q.b), [j]).length > 0));
    const fixed = noPins.filter((j) => !looseBare.includes(j));
    if (fixed.length) m.sections[0].fixed = fixed;
  }
  // крепёж по стыкам: эксцентрик (+шкант) или конфирмат — по фурнитуре у каждой стороны дна/крыши
  const ecc = hw("эксцентрик"), dow = hw("шкант");
  // в проекте нет крепежа корпуса вовсе (k32: ни фурнитуры, ни присадки) — студия его не добавляет
  if (!ecc.length && !dow.length && !hw("конфирмат").length) m.kitchen.noFasteners = true;
  for (const [id, q] of [["bottom", bottom], ["top", topPanel]] as const) {
    if (!q) continue;
    for (const [side, sx] of [["left", left.b.x1], ["right", right.b.x0]] as const) {
      const near = (h: { pos: number[] }) => Math.abs(h.pos[0] - sx) < 1 && h.pos[1] >= q.b.y0 - 1 && h.pos[1] <= q.b.y1 + 1;
      if (ecc.some(near)) { (m.jointFastening ??= {})[`${id}:${side}`] = "eccentric"; }
    }
  }
  // фиксированные полки пенала (ниши под технику, разрез фасадов): эксцентрик + шкант, как у крыши — по фурнитуре Базиса у каждой стороны
  for (const j of m.sections[0].fixed ?? []) {
    const q = sh[j];
    if (!q) continue;
    for (const [side, sx] of [["left", left.b.x1], ["right", right.b.x0]] as const)
      if (ecc.some((h) => Math.abs(h.pos[0] - sx) < 1 && h.pos[1] >= q.b.y0 - 1 && h.pos[1] <= q.b.y1 + 1)) (m.jointFastening ??= {})[`${m.sections[0].id}:shelf:${j}:${side}`] = "eccentric";
  }
  // рафиксы жёстких полок (Базис): сетка по полкам; жёсткие полки на конфирматах при этом — явно в jointFastening
  const rfx = rafixFromEtalon(ref, sh.map((q) => q.b), m.sections[0].fixed ?? []);
  if (rfx.rafix) {
    m.kitchen.rafix = rfx.rafix;
    for (const j of rfx.confirmat) for (const side of ["left", "right"] as const) {
      const key = `${m.sections[0].id}:shelf:${j}:${side}`;
      if (!m.jointFastening?.[key]) (m.jointFastening ??= {})[key] = "confirmat";
    }
  }
  notes.push(...rfx.notes);
  // жёсткие полки без крепежа в Базисе — студия его не добавляет
  const bare = [...bareShelvesFromEtalon(ref, sh.map((q) => q.b), m.sections[0].fixed ?? []), ...looseBare].sort((a, c) => a - c);
  if (bare.length) { m.kitchen.bareShelves = bare; notes.push(`жёсткие полки без крепежа (как в Базисе): ${bare.map((j) => j + 1).join(", ")}`); }
  if (m.jointFastening && dow.length && ecc.length) {
    const e0 = ecc[0], d0 = dow.filter((d) => Math.abs(d.pos[1] - e0.pos[1]) < 10).sort((a, c) => Math.abs(a.pos[2] - e0.pos[2]) - Math.abs(c.pos[2] - e0.pos[2]))[0];
    if (d0) m.dowels = { offset: r1(Math.abs(d0.pos[2] - e0.pos[2])) };
  }
  // боковины на дне на эксцентриках (дно под боковинами)
  const ue = bottom && m.bottomUnder ? underEccFromEtalon(ref.hardware, bottom.b, left.b, right.b) : null;
  if (ue) {
    m.kitchen.underEcc = ue.at;
    for (const s of ue.sides) (m.jointFastening ??= {})[`bottom:${s}`] = "eccentric";
    if (ue.dowel !== undefined && !m.dowels) m.dowels = { offset: ue.dowel };
  }
  // крепёж дна/крыши: отступ конфирматов от концов стыка (снизу через дно — у дна под боковинами; через боковину — в пределах толщины дна/крыши)
  const conf = [...hw("конфирмат"), ...ref.hardware.filter(isEuro6), ...ecc].filter((h) => [bottom, topPanel].some((q) => q && (Math.abs(h.pos[1] - q.b.y0) < 1 || (h.pos[1] > q.b.y0 && h.pos[1] < q.b.y1))));
  const host0 = bottom ?? topPanel;
  if (conf.length && host0) m.confirmatInset = r1(Math.min(...conf.map((h) => h.pos[2] - host0.b.z0)));
  // навесные: у каждого стыка дна/крыши свои отступы крепежа, если они не совпадают с общим
  if ((role === "wall" || role === "antresol") && m.confirmatInset !== undefined) {
    // жёсткие полки (k05 m10/m11: полка над сушкой на конфирматах 53/52 при общем 63) — тоже свои отступы
    const fixedJ = (m.sections[0].fixed ?? []).map((j) => [`${m.sections[0].id}:shelf:${j}`, sh[j]] as [string, (typeof sh)[number] | undefined]);
    const jz = wallJointZ(ref.hardware, [["bottom", bottom], ["top", topPanel], ...fixedJ], left, right, m.confirmatInset);
    if (Object.keys(jz).length) m.kitchen.jointZ = jz;
    // жёсткая полка без крепежа в проекте (k21 m05: полка над сушкой на 724 — в Базисе ни конфирматов, ни эксцентриков) — студия его не добавляет
    const jn = wallJointNone(ref.hardware, [["bottom", bottom], ["top", topPanel], ...fixedJ], left, right);
    if (jn.length) m.kitchen.jointNone = jn;
    // дно под боковинами на эксцентриках (k30, k31): шкант на нижней пласти дна — своё смещение от эксцентрика
    if (m.bottomUnder && bottom && !m.dowels && (m.jointFastening?.["bottom:left"] === "eccentric" || m.jointFastening?.["bottom:right"] === "eccentric")) {
      const off = bottomUnderDowelOffset(ref.hardware, bottom);
      if (off !== null) m.dowels = { offset: off };
    }
  }
  // нижние: свои отступы конфирматов дна по сторонам, если в Базисе они не по общему отступу (k28 m17: справа 252/52 при 56) — n4-base
  else if (role === "base" && m.confirmatInset !== undefined && m.bottomUnder) {
    const jz = wallJointZ(ref.hardware, [["bottom", bottom]], left, right, m.confirmatInset);
    if (Object.keys(jz).length) m.kitchen.jointZ = jz;
  }
  // точек крепежа на стык дна/крыши (2 или 3) — своё число, если не совпадает с правилом kitchenJointPoints
  const jp = jointPointsFromEtalon(ref, [bottom?.b, topPanel?.b], left.b, right.b);
  if (jp && jp !== jointPointsRule(d)) m.kitchen.jointPoints = jp;
  // дно/крыша без крепежа к стойкам в Базисе (k32 m01/m02 — корпус под холодильник без фурнитуры): студия крепёж не добавляет
  const bareJ = (["bottom", "top"] as const).filter((k) => { const q = k === "bottom" ? bottom : topPanel; return !!q && bareJointFromEtalon(ref, q.b); });
  if (bareJ.length) m.kitchen.bareJoints = [...bareJ];
  // своя сетка крепежа у стыков, где Базис поставил его иначе, чем у модуля (k23: крыша 104,5/64,5 при 64,5/64,5 у дна)
  if (m.confirmatInset !== undefined) {
    const nDef = jp ?? jointPointsRule(d), ins = m.confirmatInset, hosts: [string, B][] = [];
    if (bottom) hosts.push(["bottom", bottom.b]);
    if (topPanel) hosts.push(["top", topPanel.b]);
    for (const j of m.sections[0].fixed ?? []) if (sh[j] && !m.kitchen.bareShelves?.includes(j) && !(m.kitchen.rafix && !rfx.confirmat.includes(j))) hosts.push([`shelf:${j}`, sh[j].b]);
    const grids = jointGridsFromEtalon(ref, hosts, left.b, right.b);
    // у стыка уже есть свои отступы по сторонам (kitchen.jointZ навесных, n3-wall) — они точнее: сетка снята с одной стороны
    // (k24 m10: слева эксцентрики 82/62, справа конфирматы по правилу 56/56) и другой стороне не подходит
    const zHost = (k: string) => (k.startsWith("shelf:") ? `${m.sections[0].id}:${k}` : k);
    const hasZ = (k: string) => !!m.kitchen?.jointZ && (`${zHost(k)}:left` in m.kitchen.jointZ || `${zHost(k)}:right` in m.kitchen.jointZ);
    const own = Object.entries(grids).filter(([k, g]) => !hasZ(k) && (Math.abs(g.rear - ins) > 0.6 || Math.abs(g.front - ins) > 0.6 || g.n !== (k.startsWith("shelf:") ? 2 : nDef)));
    if (own.length) m.kitchen.joints = Object.fromEntries(own);
  }
  // кромка: толщина — по кромке боковины (Базис: 1 или 0,5 мм на открытых торцах, скрытые — без кромки)
  const et = (left.p as unknown as { edges?: { thick: number }[] }).edges?.find((e) => e.thick > 0)?.thick;
  if (et) m.edgeScheme = { t: et, ...edgeFlags(left.p, bottom?.p, topPanel?.p, !!m.bottomUnder, m.backType) };
  else if (noEdges(ref.panels)) { m.edgeScheme = { t: 0 }; notes.push("кромка в Базисе не заложена — студия не добавляет"); }
  // жёсткие полки не на эксцентриках без кромки по торцам у боковин (k13 m02 — на конфирматах, только перед и зад); на эксцентриках
  // «перед и зад» студия ставит и так (k12 m04)
  const eccShelf = (j: number) => (["left", "right"] as const).some((s) => m.jointFastening?.[`${m.sections[0].id}:shelf:${j}:${s}`] === "eccentric");
  const fixedSh = (m.sections[0].fixed ?? []).filter((j) => !eccShelf(j)).map((j) => sh[j]).filter((q) => !!q && !glassSh.includes(q));
  if (m.edgeScheme && m.edgeScheme.t > 0 && fixedSh.length && fixedSh.every((q) => { const e = ((q.p as unknown as { edges?: { side: string; thick: number }[] }).edges ?? []).filter((x) => x.thick > 0).map((x) => x.side); return e.length > 0 && !e.includes("+x") && !e.includes("-x"); })) m.edgeScheme.fixedEnds = false;
  // Gola: вырезы в переднем торце боковин — по контуру боковины Базиса (contourPlane yz, точки [y, z])
  if (role === "base") {
    const gc = golaFromContour(left.p as unknown as { contour?: [number, number][]; contourPlane?: string }, left.b.y1, left.b.z1);
    const fTop = fronts.length ? Math.max(...fronts.map((f) => f.b.y1)) : null;
    // кромка по самому вырезу: сумма кромки переднего торца у Базиса больше прямых участков
    const ze = ((left.p as unknown as { edges?: { side: string; thick: number; len?: number }[] }).edges ?? []).filter((e) => e.side === "+z" && e.thick > 0 && e.len !== undefined).reduce((s, e) => s + e.len!, 0);
    if (gc.length && ze > left.b.y1 - left.b.y0 - gc.reduce((s, c) => s + c.top1 - c.top0, 0) + 1) gc.forEach((c) => (c.edged = true));
    if (gc.length) { m.gola = { cuts: gc }; if (fTop !== null && gc.some((c) => c.top0 === 0)) m.gola.faceTop = r1(top - fTop); notes.push(`Gola: ${gc.length} выреза в боковинах (${gc.map((c) => `${c.top0}–${c.top1} от верха, глуб. ${c.depth}, R${c.r}`).join("; ")})`); }
  }
  // задняя царга заподлицо с задней кромкой боковин: у части кухонь её задний торец не кромится
  const rearRail = rails.find((r) => Math.abs(r.b.z0 - sideZ0) < 0.6), rre = (rearRail?.p as unknown as { edges?: { side: string; thick: number }[] } | undefined)?.edges;
  if (et && rre?.some((e) => e.thick > 0) && !rre.some((e) => e.side === "-z" && e.thick > 0)) m.edgeScheme = { t: et, railBack: false };
  // верх боковин низа без кромки (k03, k20, k23) — как в Базисе
  if (m.edgeScheme && role === "base" && !topPanel && !sideTopEdged(left.p as unknown as { edges?: { side: string; thick: number }[] })) m.edgeScheme.sideTop = false;
  // навесные: кромка съёмных полок — своя толщина (k10: 0,5 при корпусе 0,4) и свои торцы (k22: только перед) — по первой полке на полкодержателях
  if (et && m.edgeScheme && (role === "wall" || role === "antresol")) {
    Object.assign(m.edgeScheme, wallShelfEdges(shelves, hw("полкодержатель"), et));
    // торцы дна и крыши: правило студии (kitchenEdges) — перед и (при пазе/без задника) зад; дно под боковинами — ещё концы
    const rear: ("-z")[] = m.backType === "groove" || m.backType === "none" ? ["-z"] : [];
    const ends = wallEndEdges(bottom, topPanel, { bottom: m.bottomUnder ? ["+z", "+x", "-x", ...rear] : ["+z", ...rear], top: ["+z", ...rear] });
    if (Object.keys(ends).length) m.edgeScheme.ends = ends;
    const fx = m.sections[0].fixed?.length ? wallFixedShelfEdges(sh[m.sections[0].fixed[0]]) : undefined;
    if (fx) m.edgeScheme.fixedSides = fx;
  }
  // глубина присадки по проекту, если не типовая: D5 конфирмата в торец дна/крыши (типовая 35; k33/k34 «Евровинт 6х50» — 36), D5 полкодержателя (12; k33/k34 — 9)
  {
    const body = new Set([bottom, topPanel, left, right].filter(Boolean).map((x) => x!.p.i));
    const mode = (xs: number[]) => { const c = new Map<number, number>(); for (const x of xs) c.set(x, (c.get(x) ?? 0) + 1); return [...c].sort((a, b) => b[1] - a[1])[0]?.[0]; };
    const srcCat = (h: { src?: number | null }) => (h.src === null || h.src === undefined ? undefined : ref.hardware[h.src]?.category);
    const hs = ref.holes ?? [];
    const conf = mode(hs.filter((h) => h.d === 5 && srcCat(h) === "конфирмат" && body.has(h.panel)).map((h) => r1(h.depth)));
    const pin = mode(hs.filter((h) => h.d === 5 && srcCat(h) === "полкодержатель").map((h) => r1(h.depth)));
    const drill: NonNullable<NonNullable<Module["kitchen"]>["drill"]> = {};
    if (conf !== undefined && Math.abs(t - 16) < 0.1 && conf !== 35) drill.confirmat = conf;
    if (pin !== undefined && pin !== 12) drill.pin = pin;
    // эксцентрик со своей присадкой (k33/k34 «Стяжка Макмарт Ø15»): бочонок D15×13, шток D7×28, в стойку D5×9, шкант в стойку D8×11, бочонок дна снизу
    const eh = hs.filter((h) => srcCat(h) === "эксцентрик"), dh = hs.filter((h) => srcCat(h) === "шкант" && h.d === 8);
    if (eh.length && !m.bottomUnder) {
      const e: NonNullable<NonNullable<Module["kitchen"]>["ecc"]> = {};
      const barrel = mode(eh.filter((h) => h.d === 15).map((h) => r1(h.depth))), side = mode(eh.filter((h) => h.d === 5).map((h) => r1(h.depth)));
      const stems = eh.filter((h) => (h.d === 7 || h.d === 8) && h.depth > 20), stemD = mode(stems.map((h) => h.d)), stemL = mode(stems.map((h) => r1(h.depth)));
      const dSide = mode(dh.filter((h) => h.depth < 20).map((h) => r1(h.depth)));
      if (barrel !== undefined && barrel !== 12) e.barrel = barrel;
      if (stemD !== undefined && stemL !== undefined && (stemD !== 8 || stemL !== 34)) e.stem = [stemD, stemL];
      if (side !== undefined && side !== 12) e.side = side;
      if (dSide !== undefined && dSide !== 12) e.dowelSide = dSide;
      // бочонок дна снизу; под площадкой опоры (k22 m01) — не повторяем: это пересечение (n3-base, eccFromBelow «legs»)
      if (bottom && eh.some((h) => h.d === 15 && h.panel === bottom.p.i && h.face === "-y") && eccFromBelow(ref) !== "legs") e.bottomOut = true;
      // бочонок крыши сверху, с наружной пласти (k07: D15×12 «+y» крыши) — как в Базисе (n4-wall)
      if (topPanel && topPanel !== bottom && eh.some((h) => h.d === 15 && h.panel === topPanel.p.i && h.face === "+y")) e.topOut = true;
      if (Object.keys(e).length) { m.kitchen.ecc = e; notes.push(`эксцентрик по проекту: ${JSON.stringify(e)}`); }
    }
    if (Object.keys(drill).length) { m.kitchen.drill = drill; notes.push(`присадка по проекту: ${Object.entries(drill).map(([k, v]) => `${k === "pin" ? "полкодержатель" : "конфирмат"} D5×${v}`).join(", ")}`); }
  }
  // навесные/антресоли: вырез в заднем верхнем углу боковины (k32: 100×20, контур из 6 точек) — у каждой боковины свой (k32 m14: только у правой)
  if (role === "wall" || role === "antresol") {
    for (const [side, s] of [["left", left], ["right", right]] as const) {
      const n = rearNotchFromContour(s.p as unknown as { figure?: boolean; contour?: number[][]; contourPlane?: string });
      if (n) { (m.kitchen.sideNotch ??= {})[side] = n; notes.push(`вырез ${n.height}×${n.depth} в заднем верхнем углу боковины (${side === "left" ? "левой" : "правой"})`); }
    }
  }
  // навесы: в ранних кухнях (k01, k03) навешивание иначе — без навесов
  if (role === "wall" || role === "antresol") {
    const hg = hangersFromEtalon(ref.hardware, left.b.x1, right.b.x0, top, sideZ0);
    if (!hg) m.kitchen.hangers = false;
    else { if (hg.hangerAt) m.kitchen.hangerAt = hg.hangerAt; if (hg.note) notes.push(hg.note); }
  }
  // сушка навесного: элементы с сеткой Базиса — в точке и с поворотом проекта; без сетки — только заметка
  if (role === "wall") { const dr = wallDryer(ref.hardware, W, sideZ0); if (dr.dryer) m.kitchen.dryer = dr.dryer; notes.push(...dr.notes); }
  if (fastenersAbsent(ref)) { m.kitchen.noFasteners = true; notes.push("крепёж корпуса в Базисе не заложен — студия не добавляет"); }
  const cd = confDepthFromEtalon(ref);
  if (cd !== undefined) m.kitchen.confDepth = cd;
  // пазы (кроме паза под задник): проходы фрезы одного паза сливаем (2×10 внахлёст = паз 17)
  // пазы — относительно детали-носителя студии (идут за деталью при изменении размеров)
  const g = refGrooves(ref, back ? r1(back.b.z0) : null);
  if (g.length) {
    const ps = parts(m).filter((p) => p.material === "board"), out: Groove[] = [];
    for (const gr of g) {
      const bb = [gr.box[0], gr.box[1], gr.box[2] - sideZ0, gr.box[3], gr.box[4], gr.box[5] - sideZ0];
      const host = ps.find((p) => [0, 1, 2].every((i) => bb[i] >= p.position[i] - p.size[i] / 2 - 0.6 && bb[i + 3] <= p.position[i] + p.size[i] / 2 + 0.6));
      if (!host) { unsupported.push(`паз ${gr.name} без детали-носителя`); continue; }
      const ax = partAxes(host), lo = host.position.map((v, i) => v - host.size[i] / 2), hi = host.position.map((v, i) => v + host.size[i] / 2);
      const eg = endGroove(bb, ax, lo, hi, gr.name); // паз в торце (под LED-профиль в переднем торце дна)
      if (eg) { out.push({ host: host.id, ...eg }); continue; }
      const face = Math.abs(bb[ax.t + 3] - hi[ax.t]) < Math.abs(bb[ax.t] - lo[ax.t]) ? "+" : "-";
      out.push({ host: host.id, face, along: [r1(bb[ax.L] - lo[ax.L]), r1(hi[ax.L] - bb[ax.L + 3])], across: [r1(bb[ax.W] - lo[ax.W]), r1(bb[ax.W + 3] - lo[ax.W])], depth: r1(bb[ax.t + 3] - bb[ax.t]), name: gr.name });
    }
    if (out.length) m.grooves = out;
  }
  notes.push(...recognizeBaseExtras(ref, m, fronts.length)); // как в Базисе: без петель / опор / крепежа (recognize-base.ts)
  notes.push(...axisAsBazis(ref, m), ...firmaxAsBazis(ref, m)); // ящики Axis PRO и Firmax: ручная посадка как в проекте (recognize-drawers.ts)
  // панель у пола под дном — цоколь только у нижних и пеналов; у навесных/антресолей её берёт lowFront или wallRaise (wr.panel),
  // иначе она не распознана (k31 m20/m21: задняя вертикаль 568×537 под поднятым корпусом) — не терять молча
  const plinthUsed = role === "base" || role === "tall" ? plinthPanel : undefined;
  const known = [left, right, bottom, topPanel, back, ...rails, ...railsEdge, ...shelves, ...glassSh, ...fronts, ...(m.kitchen?.faceFiller ? ffFlat?.panels ?? [] : []), plinthUsed, lowFront, wr?.panel, ...drawerPanels];
  const other = ref.panels.length - P.filter((x) => known.includes(x)).length;
  // полка из фасадного материала внутри корпуса (k23 m07: «Горизонтальная» 19 мм, «Фасадный мат-л», без полкодержателей) — причина прямо
  const facShelf = P.find((x) => !known.includes(x) && x.p.axis === "y" && x.p.kind === "other" && x.b.x0 >= left.b.x1 - 0.6 && x.b.x1 <= right.b.x0 + 0.6 && x.b.z1 <= sideZ1 + 0.5);
  if (facShelf) unsupported.push(`полка из фасадного материала ${r1(facShelf.b.y1 - facShelf.b.y0)} мм на ${r1(facShelf.b.y0)} — пока не поддержано`);
  if (other) unsupported.push(`${other} панелей не распознано (перегородки, ящики, вставки)`);
  // кромка: торцы детали — как в проекте, если правило студии кромит иначе (k32 низ: боковины, дно и царги по кругу).
  // Деталь студии сопоставляется с панелью Базиса по габариту (±0,6); полки — своей схемой (shelfSides/shelfT), фасады — без кромки.
  if (m.edgeScheme) {
    const own: NonNullable<NonNullable<Module["edgeScheme"]>["parts"]> = {}, ownT: Record<string, number> = {};
    const dirs = ["+x", "-x", "+y", "-y", "+z", "-z"] as const;
    for (const sp of parts(m)) {
      if (sp.material !== "board" || sp.role === "door" || sp.role === "shelf" || sp.external || sp.id.endsWith(":facade") || sp.id.startsWith("kd:")) continue;
      const sb = [0, 1, 2].map((i) => sp.position[i] - sp.size[i] / 2).concat([0, 1, 2].map((i) => sp.position[i] + sp.size[i] / 2));
      const rp = P.find(({ p, b }) => board(p.kind) && [b.x0, b.y0, b.z0 - sideZ0, b.x1, b.y1, b.z1 - sideZ0].every((v, i) => Math.abs(v - sb[i]) <= 0.6))?.p as unknown as { edges?: { side: string; thick: number }[] } | undefined;
      if (!rp?.edges) continue;
      const ed = rp.edges.filter((e) => e.thick > 0), th = [...new Set(ed.map((e) => e.thick))];
      if (th.length > 1) continue; // разные толщины на одной детали — не трогаем
      // одна толщина, но не как у корпуса (k31 m07/m09: стяжка у задника 0,5 при корпусе 1) — своя толщина детали (partsT)
      const pt = th[0] ?? m.edgeScheme.t, thOwn = Math.abs(pt - m.edgeScheme.t) > 0.01;
      const want = dirs.filter((d) => ed.some((e) => e.side === d)), have = edgeByDir(sp);
      if (want.join() !== dirs.filter((d) => (have[d] ?? 0) > 0).join() || want.some((d) => Math.abs((have[d] ?? 0) - pt) > 0.01)) {
        own[sp.id] = [...want];
        if (thOwn) ownT[sp.id] = pt;
      }
    }
    if (Object.keys(own).length) { m.edgeScheme.parts = own; notes.push(`кромка по проекту: ${Object.entries(own).map(([k, v]) => `${k} ${v.join("")}${ownT[k] ? ` ${ownT[k]}` : ""}`).join("; ")}`); }
    if (Object.keys(ownT).length) m.edgeScheme.partsT = ownT;
  }
  // угловой навесной с диагональным фасадом — параметрики нет (см. wallCorner.ts), причина первой
  if (ref.archetype.startsWith("wall")) { const why = wallCornerRaw(ref); if (why) unsupported.unshift(why); }
  return { module: m, notes, unsupported };
}
