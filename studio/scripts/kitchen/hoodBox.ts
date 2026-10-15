// Короб под вытяжку в навесном из Базиса (разбор 09.10.2026: 7 модулей wall-hood с П-вырезом в горизонталях — k05 m08, k06 m09,
// k15 m08, k18 m12, k25 m16, k27 m04, k28 m01; тот же короб по геометрии ещё у k16 m11, k22 m10, k24 m09, k30 m09, k31 m08, k32 m13).
// Короб — две стенки ЛДСП (ось x) внутри корпуса, не у боковин, и фронт короба (ось z) между ними вровень с их передней кромкой;
// имена в Базисе разные («Вертикальная»/«Фронтальная» у k28 наоборот), поэтому только по геометрии. Дно/крыша с П-вырезом под короб,
// полки слева и справа от короба трапециями, ХДФ у части модулей двумя кусками по сторонам короба (k05, k15, k27), у k27 — два короба.
// Разброс большой (стенки 150–540 от левой боковины, глубина 200–234, вырез есть не во всех горизонталях), параметрики короба в студии
// пока нет — модуль честно сырой, причина в сверке называется прямо, а не «панели не распознаны».
import type { RefModule } from "./compare";
import type { KitchenSpec } from "../../src/kitchen";

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

/** Короб под вытяжку как его строит Базис — разбор для будущей параметрики (kitchen.hoodBox), n6-hood 10.10.2026.
 *  Статистика по всей базе (34 кухни): 15 навесных, 19 коробов (k27 m04 — 2 друг над другом, k32 m13 — 3 по полкам).
 *  1) Стенки — ЛДСП 16 по оси x между горизонталями (дно/полка снизу и крыша/полка сверху), от лицевой плоскости ХДФ (z 20, у k05 — 59)
 *     до фронта короба (k24 — 21). Короб по центру модуля в 12 из 15 (смещён: k16 — секция у перегородки, k25 −10,5, k27 −100).
 *     Ширина по стенкам 212–300 (чаще 232 и 272), глубина до лица фронта 200–271 (216 — 6 коробов из 19).
 *  2) Фронт короба — ЛДСП 16 по оси z: накладной на торцы стенок в 12 модулях (свес за стенки 0–2 мм, одинаковый с двух сторон,
 *     кроме k25 2/0 и k27 1,5/1), вкладной между стенками заподлицо с их торцами — в 3 (k06 m09, k17 m07, k21 m07).
 *  3) Вырез под воздуховод — П-вырез в горизонтали под коробом (12 из 15) и/или над ним (9 из 15): ровно внутренность короба —
 *     по внутренним граням стенок и до тыльной грани фронта, от задней кромки детали; у k32 m13 вырез круглый (дуга, 17 точек).
 *     Нет выреза: k16 m11, k17 m07, k21 m07 (дна под коробом нет — короб от дна модуля), у k06/k15/k31 — только снизу.
 *  4) Полки по сторонам короба — две полки на уровень, трапецией в плане (4 точки) в 11 из 12 модулей с полками: у боковины —
 *     на всю глубину полки, у стенки короба — до лица фронта короба минус 0–3 мм (k18 — 18, у k21 полка на 8 мм дальше фронта);
 *     зазоры до боковины и до стенки 1–3,5, сзади 1–2 от ХДФ. Прямоугольные — только k28 m01 (полки мельче фронта короба).
 *  5) ХДФ двумя кусками по сторонам короба — 4 из 15 (k05, k15, k22, k27): за коробом задника нет.
 *  6) Крепёж короба: конфирматы через дно/крышу в торцы стенок (по 2 на стык), фронт к стенкам — эксцентрик + шкант
 *     (по 2–3 на сторону), полкодержатели полок в стенках короба. */
export type HoodBoxSpec = HoodBox & {
  wallZ: [number, number];
  front: { mount: "overlay" | "inset"; z0: number; over: [number, number] };
  cut: { below: boolean; above: boolean; round: boolean };
  shelves: { side: "left" | "right"; y: number; trapezoid: boolean; apexGap: number }[];
  hdfSplit: boolean;
};

/** Параметры коробов модуля по проекту Базиса (см. правила выше); пусто — короба нет. */
export function hoodBoxSpecs(ref: RefModule): HoodBoxSpec[] {
  const board = ref.panels.filter((p) => p.kind === "ldsp" || p.kind === "mdf").map((p) => ({ p, b: bx(p.box) }));
  const W = ref.size[0];
  const hdf = ref.panels.filter((p) => p.kind === "hdf").map((p) => bx(p.box));
  return hoodBoxes(ref).map((h) => {
    const wall = board.find(({ p, b }) => p.axis === "x" && Math.abs(b.x0 - h.x0) < 0.6 && Math.abs(b.y0 - h.y0) < 1)!.b;
    const fr = board.find(({ p, b }) => p.axis === "z" && Math.abs(b.z1 - h.depth) < 0.6 && b.x0 <= h.x0 + 20 && b.x1 >= h.x1 - 20 && b.y1 - b.y0 > 200)!.b;
    const overlay = fr.x0 <= h.x0 + 0.6;
    const inX0 = h.x0 + 16, inX1 = h.x1 - 16, inZ = fr.z0;
    // горизонталь во всю ширину корпуса впритык к коробу снизу/сверху; вырез — точки контура внутри детали на внутренних гранях стенок
    const cutIn = (y: number) => board.some(({ p, b }) => {
      if (p.axis !== "y" || b.x1 - b.x0 < W - 40 || Math.abs((Math.abs(b.y1 - y) < 1 ? b.y1 : b.y0) - y) > 1) return false;
      const c = (p as { contour?: number[][] }).contour;
      return !!c && c.length >= 8 && c.some((q) => Math.abs(q[0] - inX0) < 2 || Math.abs(q[1] - inZ) < 2 || (q[0] > inX0 && q[0] < inX1 && q[1] > b.z0 + 1 && q[1] < b.z1 - 1));
    });
    const roundCut = board.some(({ p, b }) => p.axis === "y" && (Math.abs(b.y1 - h.y0) < 1 || Math.abs(b.y0 - h.y1) < 1) && ((p as { contour?: number[][] }).contour?.length ?? 0) > 8);
    const shelves = board.filter(({ p, b }) => p.axis === "y" && b.y0 > h.y0 && b.y1 < h.y1 && (b.x1 <= h.x0 + 1 && h.x0 - b.x1 <= 5 || b.x0 >= h.x1 - 1 && b.x0 - h.x1 <= 5)).map(({ p, b }) => {
      const left = b.x1 <= h.x0 + 1, xw = left ? b.x1 : b.x0, c = (p as { contour?: number[][] }).contour;
      const apex = c ? Math.max(...c.filter((q) => Math.abs(q[0] - xw) < 0.6).map((q) => q[1])) : b.z1;
      return { side: (left ? "left" : "right") as "left" | "right", y: r1(b.y0), trapezoid: !!c && c.length === 4 && apex < b.z1 - 1, apexGap: r1(h.depth - apex) };
    }).sort((a, c) => a.y - c.y || a.side.localeCompare(c.side));
    const hdfSplit = hdf.length > 1 && hdf.some((q) => q.x1 <= h.x0 + 20) && hdf.some((q) => q.x0 >= h.x1 - 20);
    return { ...h, wallZ: [r1(wall.z0), r1(wall.z1)] as [number, number], front: { mount: overlay ? "overlay" as const : "inset" as const, z0: r1(fr.z0), over: [r1(h.x0 - fr.x0), r1(fr.x1 - h.x1)] as [number, number] },
      cut: { below: cutIn(h.y0), above: cutIn(h.y1), round: roundCut }, shelves, hdfSplit };
  });
}

/** Короб, который студия уже строит сама (kitchen.hoodBox, pkg1): один короб без полок по сторонам, без ХДФ двумя кусками и без круглого
 *  выреза (П-вырез горизонталей — planContours). Иначе null — модуль честно «не поддержано» (hoodBoxReason). */
export function hoodBoxSimple(ref: RefModule): HoodBoxSpec | null {
  const hs = hoodBoxSpecs(ref);
  return hs.length === 1 && !hs[0].shelves.length && !hs[0].hdfSplit && !hs[0].cut.round && frontOnConfirmats(ref, hs[0]) ? hs[0] : null;
}
/** Фронт короба крепится к стенкам конфирматами с лица (k24 m09); на эксцентриках и шкантах (k25 m16) параметрика пока не строит. */
export function frontOnConfirmats(ref: RefModule, h: HoodBoxSpec): boolean {
  return ref.hardware.some((q) => q.category === "конфирмат" && Math.abs(q.pos[2] - h.depth) < 0.6 && q.pos[0] > h.x0 - 1 && q.pos[0] < h.x1 + 1 && q.pos[1] > h.y0 && q.pos[1] < h.y1);
}

/** Поле kitchen.hoodBox из разбора Базиса — правилами, не координатами (пакет 0): ширина по стенкам и смещение от центра модуля (x),
 *  полка под/над коробом по номеру в секции и зазор до её поверхности (y; нет полки — дно/крыша: innerBottom/innerTop), z — от задней кромки
 *  боковин sideZ0. Конфирматы короба по проекту: с лица фронта в торцы стенок (от низа стенки), снизу из горизонтали и сверху в торцы стенок
 *  (от задней кромки стенки). */
export function hoodBoxField(h: HoodBoxSpec, ref: RefModule, sideZ0: number, geo: { width: number; shelves: { y0: number; y1: number }[]; innerBottom: number; innerTop: number }): NonNullable<KitchenSpec["hoodBox"]> {
  const conf = ref.hardware.filter((q) => q.category === "конфирмат" && q.pos[0] > h.x0 - 1 && q.pos[0] < h.x1 + 1);
  const uniq = (v: number[]) => [...new Set(v.map(r1))].sort((a, b) => a - b);
  const front = uniq(conf.filter((q) => Math.abs(q.pos[2] - h.depth) < 0.6 && q.pos[1] > h.y0 && q.pos[1] < h.y1).map((q) => q.pos[1] - h.y0));
  const below = uniq(conf.filter((q) => Math.abs(q.pos[1] - (h.y0 - 16)) < 0.6).map((q) => q.pos[2] - h.wallZ[0]));
  const above = uniq(conf.filter((q) => Math.abs(q.pos[1] - (h.y1 + 16)) < 0.6).map((q) => q.pos[2] - h.wallZ[0]));
  const over = h.front.over.some((v) => Math.abs(v) > 0.05) ? { over: h.front.over } : {};
  const c = { ...(front.length ? { front } : {}), ...(below.length ? { below } : {}), ...(above.length ? { above } : {}) };
  const dx = r1((h.x0 + h.x1) / 2 - geo.width / 2);
  // полка, на которой короб стоит (её верх у низа стенок) и полка над ним (её низ у верха стенок) — иначе дно и крыша
  const on = geo.shelves.findIndex((s) => Math.abs(s.y1 - h.y0) <= 5 && s.y1 <= h.y0 + 0.5), under = geo.shelves.findIndex((s) => Math.abs(s.y0 - h.y1) <= 5 && s.y0 >= h.y1 - 0.5);
  const gapBelow = r1(h.y0 - (on >= 0 ? geo.shelves[on].y1 : geo.innerBottom)), gapAbove = r1((under >= 0 ? geo.shelves[under].y0 : geo.innerTop) - h.y1);
  return { w: r1(h.x1 - h.x0), ...(dx ? { dx } : {}), ...(on >= 0 ? { on } : {}), ...(under >= 0 ? { under } : {}), gapBelow, gapAbove, z0: r1(h.wallZ[0] - sideZ0), z1: r1(h.wallZ[1] - sideZ0), front: { mount: h.front.mount, ...over }, ...(Object.keys(c).length ? { conf: c } : {}) };
}

/** Панели короба в эталоне (стенки и фронт) — чтобы распознаватель не считал их «не распознанными». */
export function hoodBoxPanels(ref: RefModule, h: HoodBoxSpec): RefModule["panels"] {
  return ref.panels.filter((p) => (p.kind === "ldsp" || p.kind === "mdf") && ((p.axis === "x" && (Math.abs(p.box[0] - h.x0) < 0.6 || Math.abs(p.box[3] - h.x1) < 0.6) && Math.abs(p.box[1] - h.y0) < 1)
    || (p.axis === "z" && Math.abs(p.box[5] - h.depth) < 0.6 && p.box[0] <= h.x0 + 20 && p.box[3] >= h.x1 - 20 && p.box[4] - p.box[1] > 200)));
}

/** Причина «не поддержано» для навесного с коробом под вытяжку или null: что именно в коробе Базиса (фронт, вырез, полки, ХДФ). */
export function hoodBoxReason(ref: RefModule): string | null {
  const hs = hoodBoxSpecs(ref);
  if (!hs.length) return null;
  const b = hs[0], cut = [b.cut.below ? "под коробом" : "", b.cut.above ? "над коробом" : ""].filter(Boolean);
  const tr = hs.flatMap((h) => h.shelves).filter((s) => s.trapezoid).length;
  return `короб под вытяжку${hs.length > 1 ? ` ×${hs.length}` : ""} (стенки ${b.x0}–${b.x1} мм, фронт ${b.front.mount === "overlay" ? "накладной" : "вкладной"} в ${b.depth} от задней кромки`
    + `${cut.length ? `, вырез ${b.cut.round ? "круглый" : "П"} ${cut.join(" и ")}` : ", без выреза"}${tr ? `, полок трапецией ${tr}` : ""}${b.hdfSplit ? ", ХДФ двумя кусками" : ""}${frontOnConfirmats(ref, b) ? "" : ", фронт на эксцентриках"}) — пока не поддержано`;
}
