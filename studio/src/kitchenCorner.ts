// Нижний угловой модуль кухни (запрос Макса 21.10.2026 «нужно добавить нижний угловой модуль»): прямой глухой угол — корпус как
// у нижнего под мойку (kitchenBase «sink»: дно под боковинами, без крыши и задника, царга на ребре спереди, царга-распорка сзади),
// по фасаду — одна дверь и фальш из фасадного материала в плоскости фасадов (kitchen.faceFiller.facadeMat); дверь у фальша висит
// на «Петля под фальшпанель» у своей кромки (model.ts, drilling.ts falsePanelHinge). Эталон — шаблон Базиса «НКПМ» (k02 m01),
// сверка scripts/kitchen/compare.ts → tests/kitchen-corner.test.ts. Ничего сверх проекта Базиса: крепёж фальша — как в шаблоне.
import { KITCHEN, kitchenBase, kitchenWall } from "./kitchen";
import type { Module } from "./model";

export type CornerSide = "left" | "right";
export type KitchenCornerOptions = {
  width: number;
  /** высота модуля с опорами; по умолчанию — как у нижних (KITCHEN.baseHeight) */
  height?: number;
  /** глубина корпуса; по умолчанию — как у нижних */
  depth?: number;
  /** сторона глухой части (фальша); дверь — с другой стороны */
  side?: CornerSide;
  /** ширина дверной части: от края модуля со стороны двери до фальша, мм (дверь = door − зазоры) */
  door?: number;
  /** отступ фальша от края модуля со стороны глухой части; по умолчанию — зазор фасадов faceGap */
  inset?: number;
  /** крепёж фальша по шаблону Базиса: в дно и боковину; join — ещё стяжка с соседним модулем, вставшим торцом к фальшу */
  conf?: boolean; join?: boolean;
  /** стойка-упор за фальшем (k27 m09); по умолчанию — у модулей шире 900, как в эталонах */
  stop?: boolean;
  /** высоты петель от низа двери, если не по правилу студии (как в проекте Базиса) */
  hingeY?: number[];
};

/** Ширина дверной части по умолчанию: до 900 — половина модуля (k02 m01: 400 из 800), шире — фальш 512 (k27 m09: дверь до 578 из 1090). */
export function cornerDoorDefault(width: number): number { return width <= 900 ? Math.round(width / 2) : width - 512; }

/** Отступы крепежа фальша по шаблону «НКПМ» (k02 m01), от кромок фальша и низа дна — переживают смену ширины и высоты. */
export function cornerFillerConf(fw: number, inset: number, body: number, join: boolean): NonNullable<NonNullable<NonNullable<Module["kitchen"]>["faceFiller"]>["conf"]> {
  const r1 = (v: number) => Math.round(v * 10) / 10;
  // высоты от низа дна; отрицательные — от верха корпуса (model.ts), выше середины крепёж идёт за высотой модуля
  const mid = r1((82.5 + body - 67.5) / 2), side = mid > body / 2 ? [82.5, r1(mid - body), -67.5] : [82.5, mid, -67.5];
  return {
    bottom: [r1(inset + 55), r1(inset + fw - 55.5)],
    side,
    ...(join ? { back: [43, 281, -43].flatMap((y) => [[r1(inset + 117), y], [r1(inset + fw - 58), y]] as [number, number][]).sort((a, b) => a[0] - b[0] || a[1] - b[1]) } : {}),
  };
}

/** Нижний угловой (прямой, с фальшпанелью). base — модуль-источник материалов (декоры, фасадный материал, кромка). */
export function kitchenBaseCorner(base: Module, o: KitchenCornerOptions): Module {
  const m = kitchenBase(base, o.width, "sink");
  delete m.kitchen!.appliance;
  m.name = "Нижний угловой";
  if (o.height) m.height = o.height;
  if (o.depth) m.depth = o.depth;
  const side = o.side ?? "right", gap = m.faceGap ?? KITCHEN.faceGap, inset = o.inset ?? gap;
  const door = Math.min(Math.max(o.door ?? cornerDoorDefault(o.width), 250), o.width - 150);
  const fw = Math.round((o.width - door - inset) * 10) / 10, body = m.height - (m.feet?.height ?? 0);
  const conf = o.conf ?? true, join = o.join ?? true;
  m.kitchen!.faceFiller = { side, width: fw, facadeMat: true, ...(inset ? { inset } : {}), ...(conf ? { conf: cornerFillerConf(fw, inset, body, join), confDepth: 33 } : {}) };
  const wide = o.width > 900, stop = o.stop ?? wide;
  // до 900 (шаблон «НКПМ», k02 m01): царга на ребре спереди и царга-распорка сзади, опущенная на 300 от верха (362…462 при корпусе
  // 100…762), конфирматы в 34 и 66 от её низа. Шире (k27 m09 «НМУ»): две царги лёжа, как у нижних, и стойка-упор за фальшем
  m.rails = wide ? [{ place: "front-top", height: KITCHEN.railWidth, lay: "flat" }, { place: "rear-top", height: KITCHEN.railWidth, lay: "flat" }]
    : [{ place: "front-top", height: 60 }, { place: "rear-top", height: 100, atTop: 300, confY: [34, 66] }];
  if (stop) m.kitchen!.cornerStop = { x: 71.5, depth: 101.5 };
  m.sections = [{ ...m.sections[0], shelves: [], drawers: 0, rod: false, shelfDepth: m.depth - 2.5, doorLeaves: 1, hingeSide: side, ...(o.hingeY ? { hingeY: o.hingeY, hingeYFor: body - 2 * gap } : {}) }];
  return m;
}

/** Навесной угловой (прямой) — решение Макса 23.10.2026 «навесной угловой прямой точно нужен» (Г- и П-образные кухни). Эталон
 *  Базиса k25 m18 «ВМУгловой» 1071×930×336: корпус навесного студии (kitchenWall: крыша и дно между боковинами, ХДФ в паз П16-4×8,
 *  навесы на боковинах, полки), у края со стороны угла — глухая часть: фальш ЛДСП корпуса в плоскости фасадов от низа дна до верха
 *  крыши (k25: 320 = глубина корпуса — на неё встаёт крыло) и рядом планка из фасадного материала 59 по высоте фасадов; фасады —
 *  на остальной ширине (шире 600 — две двери), дверь у планки на «Петля под фальшпанель». Крепёж фальша — как в шаблоне: конфирматы
 *  с лица фальша в торцы дна и крыши (в 72 от края и в 56 от планки) и в торец боковины (81 от низа, середина, 81 от верха).
 *  Сверка — tests/kitchen-corner.test.ts (k25 m18). Ничего сверх проекта Базиса. */
export type WallCornerOptions = { width: number; height?: number; depth?: number; side?: CornerSide;
  /** ширина глухого фальша ЛДСП; по умолчанию — глубина корпуса (на него встаёт навесной второго крыла) */ filler?: number;
  /** планка из фасада между фальшем и дверью; по умолчанию 59 (k25 m18) */ strip?: number;
  /** крепёж фальша по шаблону; по умолчанию да */ conf?: boolean };
export const WALL_CORNER_STRIP = 59;
export function wallCornerConf(fw: number, height: number): NonNullable<NonNullable<NonNullable<Module["kitchen"]>["faceFiller"]>["conf"]> {
  const r1 = (v: number) => Math.round(v * 10) / 10, x = [r1(fw - 56), 72].filter((v, i, a) => v > 20 && a.indexOf(v) === i).sort((a, b) => b - a);
  return { bottom: x, top: x, side: [81, r1(height / 2), r1(height - 81)] };
}
export function kitchenWallCorner(base: Module, o: WallCornerOptions): Module {
  const m = kitchenWall(base, o.width);
  m.name = "Навесной угловой";
  if (o.height) m.height = o.height;
  if (o.depth) m.depth = o.depth;
  const side = o.side ?? "right", fw = o.filler ?? m.depth, strip = o.strip ?? WALL_CORNER_STRIP, conf = o.conf ?? true;
  m.kitchen = { ...m.kitchen!, faceFiller: { side, width: fw, strip, ...(conf ? { conf: wallCornerConf(fw, m.height) } : {}) } };
  const doorPart = o.width - fw - strip;
  if (doorPart < 250) throw Error(`Навесной угловой ${o.width}: на двери остаётся ${Math.round(doorPart)} мм — нужно от 250. Увеличьте ширину или уменьшите фальш.`);
  m.sections = [{ ...m.sections[0], shelfDepth: m.depth - 22, doorLeaves: doorPart > 600 ? 2 : 1, hingeSide: side }];
  return m;
}

/** Параметры углового модуля из самого модуля (для меню и панели): сторона, ширина двери, ширина фальша. */
export function cornerOf(m: Module): { side: CornerSide; door: number; filler: number; inset: number; strip?: number; wall?: true } | undefined {
  const ff = m.kitchen?.faceFiller;
  if (m.kitchen?.role === "wall" && ff && !ff.facadeMat && ff.strip) {
    const inset = ff.inset ?? 0;
    return { side: ff.side, door: Math.round((m.width - ff.width - ff.strip - inset) * 10) / 10, filler: ff.width, inset, strip: ff.strip, wall: true };
  }
  if (!ff?.facadeMat || m.kitchen?.role !== "base") return undefined;
  const inset = ff.inset ?? 0;
  return { side: ff.side, door: Math.round((m.width - ff.width - inset) * 10) / 10, filler: ff.width, inset };
}

/** Перестроить угловой модуль с новыми стороной / шириной двери / шириной фальша — тем же генератором, материалы и размеры — свои. */
export function reshapeCorner(m: Module, change: { side?: CornerSide; door?: number; filler?: number }): Module {
  const c = cornerOf(m);
  if (!c) return m;
  const strip = c.strip ?? 0;
  const door = change.filler !== undefined ? m.width - change.filler - strip - c.inset : change.door ?? c.door;
  const side = change.side ?? c.side, ff = m.kitchen!.faceFiller!;
  const fw = Math.round((m.width - door - strip - c.inset) * 10) / 10, body = m.height - (m.feet?.height ?? 0);
  if (c.wall) {
    if (door < 250 || fw < 50) throw Error(`Навесной угловой: дверь от 250 мм и фальш от 50 мм (ширина ${m.width}, планка ${strip}).`);
    const faceFiller = { ...ff, side, width: fw, ...(ff.conf ? { conf: wallCornerConf(fw, m.height) } : {}) };
    return { ...m, kitchen: { ...m.kitchen!, faceFiller }, sections: m.sections.map((s, i) => (i === 0 ? { ...s, hingeSide: side, doorLeaves: door > 600 ? 2 : 1 } : s)) };
  }
  const join = !!ff.conf?.back?.length;
  const faceFiller = { ...ff, side, width: fw, ...(ff.conf ? { conf: cornerFillerConf(fw, c.inset, body, join) } : {}) };
  return { ...m, kitchen: { ...m.kitchen!, faceFiller }, sections: m.sections.map((s, i) => (i === 0 ? { ...s, hingeSide: side } : s)) };
}
