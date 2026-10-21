// Нижний угловой модуль кухни (запрос Макса 21.10.2026 «нужно добавить нижний угловой модуль»): прямой глухой угол — корпус как
// у нижнего под мойку (kitchenBase «sink»: дно под боковинами, без крыши и задника, царга на ребре спереди, царга-распорка сзади),
// по фасаду — одна дверь и фальш из фасадного материала в плоскости фасадов (kitchen.faceFiller.facadeMat); дверь у фальша висит
// на «Петля под фальшпанель» у своей кромки (model.ts, drilling.ts falsePanelHinge). Эталон — шаблон Базиса «НКПМ» (k02 m01),
// сверка scripts/kitchen/compare.ts → tests/kitchen-corner.test.ts. Ничего сверх проекта Базиса: крепёж фальша — как в шаблоне.
import { KITCHEN, kitchenBase } from "./kitchen";
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
  /** высоты петель от низа двери, если не по правилу студии (как в проекте Базиса) */
  hingeY?: number[];
};

/** Ширина дверной части по умолчанию: до 900 — половина модуля (k02 m01: 400 из 800), шире — фальш 512 (k27 m09: дверь до 578 из 1090). */
export function cornerDoorDefault(width: number): number { return width <= 900 ? Math.round(width / 2) : width - 512; }

/** Отступы крепежа фальша по шаблону «НКПМ» (k02 m01), от кромок фальша и низа дна — переживают смену ширины и высоты. */
export function cornerFillerConf(fw: number, inset: number, body: number, join: boolean): NonNullable<NonNullable<NonNullable<Module["kitchen"]>["faceFiller"]>["conf"]> {
  const r1 = (v: number) => Math.round(v * 10) / 10;
  const side = [82.5, r1((82.5 + body - 67.5) / 2), r1(body - 67.5)];
  return {
    bottom: [r1(inset + 55), r1(inset + fw - 55.5)],
    side,
    ...(join ? { back: [43, 281, r1(body - 43)].flatMap((y) => [[r1(inset + 117), y], [r1(inset + fw - 58), y]] as [number, number][]).sort((a, b) => a[0] - b[0] || a[1] - b[1]) } : {}),
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
  // царга-распорка сзади — опущена на 300 от верха (шаблон «НКПМ»: 362…462 при корпусе 100…762), конфирматы в 34 и 66 от её низа
  m.rails = [{ place: "front-top", height: 60 }, { place: "rear-top", height: 100, atTop: 300, confY: [34, 66] }];
  m.sections = [{ ...m.sections[0], shelves: [], drawers: 0, rod: false, shelfDepth: m.depth - 2.5, doorLeaves: 1, hingeSide: side, ...(o.hingeY ? { hingeY: o.hingeY, hingeYFor: body - 2 * gap } : {}) }];
  return m;
}

/** Параметры углового модуля из самого модуля (для меню и панели): сторона, ширина двери, ширина фальша. */
export function cornerOf(m: Module): { side: CornerSide; door: number; filler: number; inset: number } | undefined {
  const ff = m.kitchen?.faceFiller;
  if (!ff?.facadeMat || m.kitchen?.role !== "base") return undefined;
  const inset = ff.inset ?? 0;
  return { side: ff.side, door: Math.round((m.width - ff.width - inset) * 10) / 10, filler: ff.width, inset };
}

/** Перестроить угловой модуль с новыми стороной / шириной двери / шириной фальша — тем же генератором, материалы и размеры — свои. */
export function reshapeCorner(m: Module, change: { side?: CornerSide; door?: number; filler?: number }): Module {
  const c = cornerOf(m);
  if (!c) return m;
  const door = change.filler !== undefined ? m.width - change.filler - c.inset : change.door ?? c.door;
  const side = change.side ?? c.side, ff = m.kitchen!.faceFiller!;
  const fw = Math.round((m.width - door - c.inset) * 10) / 10, body = m.height - (m.feet?.height ?? 0);
  const join = !!ff.conf?.back?.length;
  const faceFiller = { ...ff, side, width: fw, ...(ff.conf ? { conf: cornerFillerConf(fw, c.inset, body, join) } : {}) };
  return { ...m, kitchen: { ...m.kitchen!, faceFiller }, sections: m.sections.map((s, i) => (i === 0 ? { ...s, hingeSide: side } : s)) };
}
