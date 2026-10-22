// Пенал под технику (запрос Макса 22.10, K1/K2): «Духовка + СВЧ в колонну» и «Пенал под встраиваемый холодильник» — шаблоны
// калькулятора по эталонам Базиса (архетипы tall-oven: k14 m08, k25 m11; tall-fridge: k25 m10). Конструкция эталонов:
// дно во всю ширину под боковинами, крыша между боковинами, дно и крыша короче сзади на 50 (вентканал за техникой), ХДФ в пазу 46
// только над техникой (backFromShelf) и за ящиком (backBelowShelf), ниши под технику без задника; полки ниш — жёсткие.
// Высоты ниш задаются в мм и переживают смену высоты/опор: configureColumn раскладывает полки заново (полки секции — доли проёма).
import type { Module, Part } from './model';
import { KITCHEN, kitchenBase } from './kitchen';
import { versaliteLayout } from './kitchenDrawers';
import { OVEN, OVEN_TOTAL_DEPTH } from './ovenDimensions';

export type TallColumn =
  | { kind: 'oven'; visible: boolean; /** верх опорной полки духовки от низа модуля (пола), мм */ support: number; ovenNiche: number; /** 0 — без СВЧ */ mwNiche: number }
  | { kind: 'fridge'; visible: boolean; /** высота ниши от дна до низа полки над холодильником, мм */ niche: number };

export const TALL_COLUMN = {
  depth: 560,          // боковина пенала эталонов (k14, k25): 560, фасад сверху
  groove: 46,          // паз ХДФ П46-4×8 (k14 m08, k25 m10/m11)
  vent: 50,            // дно и крыша короче сзади на 50 — канал за техникой (все 3 эталона)
  support: 479.5,      // верх опорной полки духовки: k14 m08 (ящик под духовкой 370)
  ovenNiche: 585,      // ниша духовки в колонне: k25 m11 585, k14 m08 584; паспорт Bosch для колонны 575–597 (OVEN.tallNiche)
  mwNiches: [380, 460] as const, // СВЧ 38 см (k14 372, k25 382) или компакт 45 см
  fridgeNiche: 1780,   // встраиваемый холодильник: ниша 1780 (APPLIANCES.fridge), k25 m10 — 1790
  mw: { width: 594, insertion: 300, fascia: 20, handle: 25 },
  fridge: { width: 540, depth: 545 },
} as const;
const T = 16;

/** Низ и верх проёма секции (над дном и под крышей). */
const inner = (m: Module) => ({ y0: (m.feet?.height ?? 0) + T, y1: m.height - (m.topType === 'none' ? 0 : T) });
/** Доля проёма для полки с центром на высоте cy от пола. */
const frac = (m: Module, cy: number) => { const { y0, y1 } = inner(m); return (cy - y0) / (y1 - y0); };

/** Жёсткие полки колонны: центры полок от пола, снизу вверх. */
export function columnShelves(m: Module): number[] {
  const c = m.kitchen?.column; if (!c) return [];
  if (c.kind === 'fridge') return [inner(m).y0 + c.niche + T / 2];
  const out = [c.support - T / 2, c.support + c.ovenNiche + T / 2];
  if (c.mwNiche > 0) out.push(out[1] + T / 2 + c.mwNiche + T / 2);
  return out;
}
/** Съёмные полки над техникой: зона до 500 — нет, до 900 — одна, выше — две (k25 m10: 492 — нет; k14 m08: 917 — две). */
const looseCount = (zone: number) => (zone < 500 ? 0 : zone < 900 ? 1 : 2);

/** Модуль ящика под духовкой (как ovenDrawerModule нижнего): корпус до низа опорной полки минус выступ духовки 8. */
export function columnDrawerModule(m: Module): Module {
  const c = m.kitchen!.column!; const s = c.kind === 'oven' ? c.support : 0;
  return { ...m, height: s - OVEN.frontBelowSupport, topType: 'panel', rails: [], gola: undefined, doors: false, kdrawers: undefined, sections: m.sections.map((x) => ({ ...x, shelves: [], fixed: [] })), kitchen: { ...m.kitchen!, column: undefined, faceBottom: undefined, role: 'base' } };
}

/** Раскладка колонны по её спецификации: жёсткие полки ниш, съёмные над техникой, фасады, ящик, задник. Идемпотентна. */
export function configureColumn(m: Module, patch: Partial<TallColumn> = {}) {
  const k = m.kitchen; if (!k?.column) throw Error('Это не пенал под технику.');
  k.column = { ...k.column, ...patch } as TallColumn;
  const c = k.column, fixedY = columnShelves(m), { y1 } = inner(m), s = m.sections[0];
  const top = fixedY[fixedY.length - 1] + T / 2, n = looseCount(y1 - top);
  const loose = Array.from({ length: n }, (_, i) => top + (y1 - top) * (i + 1) / (n + 1));
  const ys = [...fixedY, ...loose];
  m.sections = [{ ...s, shelves: ys.map((y) => frac(m, y)), fixed: fixedY.map((_, i) => i), drawers: 0, rod: false, shelfDepth: m.depth - TALL_COLUMN.vent }];
  const sec = m.sections[0];
  delete sec.doorSplit; delete sec.doorNiche; delete sec.doorRows; delete sec.hingeless; delete sec.hingeY; delete sec.hingeYFor; delete sec.hingeYUp; delete sec.hingeYUpFor;
  m.doors = true;
  k.backFromShelf = fixedY.length - 1;
  if (c.kind === 'oven') {
    // фасады — только над нишами: низ двери на зазор над серединой верхней жёсткой полки (k14 m08: дверь 1461,5 над полкой 1451,5…1467,5)
    k.faceBottom = fixedY[fixedY.length - 1] + (m.faceGapBetween ?? KITCHEN.faceGapBetween) / 2 - (m.feet?.height ?? 0);
    k.backBelowShelf = 0; // ХДФ за ящиком — до верха опорной полки (k14: 101…478,5)
    m.kdrawers = versaliteLayout(columnDrawerModule(m), 1);
  } else {
    // холодильник: нижний фасад — на двери техники, без петель; стык фасадов — по середине полки над нишей (k25 m10: 1912,5 | 1915,5)
    delete k.faceBottom; delete k.backBelowShelf; delete m.kdrawers;
    sec.doorSplit = fixedY[0] - ((m.feet?.height ?? 0) + (m.faceGap ?? KITCHEN.faceGap));
    sec.hingeless = [0];
  }
}

/** Пенал под технику по шаблону: от нижнего (опоры 100, цоколь, дно под боковинами), высота — как у пенала студии (верх вровень с навесными). */
export function kitchenTallColumn(base: Module, width: number, kind: 'oven' | 'fridge'): Module {
  const b = kitchenBase(base, width, 'doors');
  const height = KITCHEN.baseHeight + KITCHEN.worktopThickness + KITCHEN.wallGap + KITCHEN.wallHeight;
  const m: Module = { ...b, name: kind === 'oven' ? 'Пенал: духовка + СВЧ' : 'Пенал под холодильник', height, depth: TALL_COLUMN.depth, rails: [], shelfRear: 0, // полки от ХДФ до лица корпуса, как в эталонах (z 50…560)
    backType: 'groove', grooveInset: TALL_COLUMN.groove, grooveWidth: KITCHEN.groove.width, grooveDepth: KITCHEN.groove.depth, grooveClear: KITCHEN.groove.clear,
    kitchen: { role: 'tall', appliance: kind, bottomBack: TALL_COLUMN.vent, topBack: TALL_COLUMN.vent, backTopGap: 1,
      column: kind === 'oven' ? { kind, visible: true, support: TALL_COLUMN.support, ovenNiche: TALL_COLUMN.ovenNiche, mwNiche: TALL_COLUMN.mwNiches[0] } : { kind, visible: true, niche: TALL_COLUMN.fridgeNiche } } };
  delete m.topType;
  m.sections = [{ ...b.sections[0], shelves: [], drawers: 0, rod: false }];
  configureColumn(m);
  return m;
}

/** Проверки колонны: ниши по паспортам, полки ниш на местах, ниши свободны (без фасадов и задника). */
export function columnErrors(m: Module): string[] {
  const c = m.kitchen?.column; if (!c) return [];
  const e: string[] = [], s = m.sections[0], want = columnShelves(m);
  if (m.kitchen?.role !== 'tall') e.push('Пенал под технику: модуль должен быть пеналом.');
  const iw = m.width - 2 * T;
  if (c.kind === 'oven') {
    if (iw < OVEN.tallNiche.widthMin || iw > OVEN.tallNiche.widthMax) e.push(`Духовка в пенале: свободная ширина ниши ${OVEN.tallNiche.widthMin}–${OVEN.tallNiche.widthMax} мм (сейчас ${iw}).`);
    if (!(c.ovenNiche >= OVEN.tallNiche.heightMin && c.ovenNiche <= OVEN.tallNiche.heightMax)) e.push(`Высота ниши духовки в пенале: ${OVEN.tallNiche.heightMin}–${OVEN.tallNiche.heightMax} мм (Bosch HBF113BR0B, установка в колонну).`);
    if (!(c.mwNiche === 0 || (c.mwNiche >= 370 && c.mwNiche <= 390) || (c.mwNiche >= 450 && c.mwNiche <= 460))) e.push('Ниша СВЧ: 370–390 (СВЧ 38 см, k14 m08 — 372) или 450–460 мм (45 см), 0 — без СВЧ.');
    if (c.support - T < (m.feet?.height ?? 0) + T + 120) e.push('Под духовкой не помещается ящик: поднимите опорную полку.');
    if (m.depth < OVEN.tallNiche.depthMin) e.push(`Глубина ниши духовки — от ${OVEN.tallNiche.depthMin} мм.`);
  } else {
    if (iw < 560) e.push(`Холодильник: свободная ширина ниши от 560 мм (сейчас ${iw}).`);
    if (!(c.niche >= 1770 && c.niche <= 1800)) e.push('Высота ниши встраиваемого холодильника: 1770–1800 мм.');
    if (m.depth < 550) e.push('Глубина ниши холодильника — от 550 мм.');
  }
  const { y0, y1 } = inner(m), centers = s.shelves.map((f) => y0 + f * (y1 - y0));
  if (want.some((y, i) => Math.abs((centers[i] ?? -1e9) - y) > 0.6 || !s.fixed?.includes(i)) || want[want.length - 1] + T / 2 > y1 - 200)
    e.push('Пенал под технику: полки ниш сдвинуты или не помещаются по высоте — пересоберите пенал (высота модуля, ниши).');
  return e;
}

/** Техника колонны моделями компоновки (не в смете): духовка на опорной полке, СВЧ в своей нише, холодильник на дне. */
export function columnParts(m: Module): Part[] {
  const c = m.kitchen?.column; if (!c?.visible) return [];
  const part = (id: string, name: string, size: [number, number, number], position: [number, number, number]): Part =>
    ({ id, name, role: 'fastener', material: 'metal', decor: '', size, position, length: size[1], width: size[0], thickness: size[2], grain: 'length', grainAxis: 0, edge: [0, 0, 0, 0], external: true });
  const sh = columnShelves(m), out: Part[] = [];
  if (c.kind === 'oven') {
    const y = c.support;
    const oven = part('layout-oven', 'Духовка Bosch HBF113BR0B · компоновка, ручка по максимальному выступу', [OVEN.width, OVEN.height, OVEN_TOTAL_DEPTH], [m.width / 2, y - OVEN.frontBelowSupport + OVEN.height / 2, m.depth - OVEN.insertionDepth + OVEN_TOTAL_DEPTH / 2]);
    oven.collide = [{ size: [550, Math.min(570, c.ovenNiche - 2), OVEN.insertionDepth], position: [m.width / 2, y + Math.min(570, c.ovenNiche - 2) / 2, m.depth - OVEN.insertionDepth / 2] }, { size: [OVEN.width, OVEN.height, OVEN.metalFasciaDepth], position: [m.width / 2, y - OVEN.frontBelowSupport + OVEN.height / 2, m.depth + OVEN.metalFasciaDepth / 2] }];
    out.push(oven);
    if (c.mwNiche > 0) {
      const W = TALL_COLUMN.mw, y0 = sh[1] + T / 2, h = c.mwNiche + 2, d = W.insertion + W.fascia + W.handle;
      const mw = part('layout-microwave', `Встраиваемая СВЧ ${c.mwNiche >= 450 ? 45 : 38} см · компоновка (ниша ${c.mwNiche})`, [W.width, h, d], [m.width / 2, y0 + c.mwNiche / 2, m.depth - W.insertion + d / 2]);
      mw.collide = [{ size: [m.width - 2 * T - 10, c.mwNiche - 2, W.insertion], position: [m.width / 2, y0 + c.mwNiche / 2, m.depth - W.insertion / 2] }, { size: [W.width, h, W.fascia], position: [m.width / 2, y0 + c.mwNiche / 2, m.depth + W.fascia / 2] }];
      out.push(mw);
    }
  } else {
    const F = TALL_COLUMN.fridge, y0 = inner(m).y0, h = c.niche - 8;
    out.push(part('layout-fridge', `Холодильник встраиваемый · компоновка (ниша ${c.niche})`, [F.width, h, F.depth], [m.width / 2, y0 + h / 2, m.depth - 4 - F.depth / 2]));
  }
  return out;
}
