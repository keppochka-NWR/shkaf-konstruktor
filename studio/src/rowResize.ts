// Ширина модуля в ряду (правило Макса 09.10.2026): расширяешь модуль — сужается рядом стоящий.
//  • Есть модуль справа вплотную — меняется правый (его левый край сдвигается); справа нет — меняется левый, сам модуль растёт влево.
//  • Модуль у стены (бок на стене помещения или на боку модуля, стоящего под 90°) — меняется строго в сторону от стены.
//  • Сужение — то же самое: сосед с той стороны расширяется на ту же величину.
//  «Справа/слева» — как смотрит человек на фасад: +u локальной оси ширины (localToRoom), для поворота 0 это +x.
//  «Ряд» — модули с тем же поворотом, перекрытые по высоте и по глубине, стоящие вплотную (±2 мм).
//  Столешница и объекты ряда Базиса (raw.row: цоколи, стеновые панели) соседями не считаются.
//  Сосед из Базиса (сырой raw), угловой и купе не меняются — ошибка, правка не применяется.
import { bounds, localToRoom, type PlacedModule, type Project } from "./project";
import { validate, RULES, type Module } from "./model";
import { KITCHEN } from "./kitchen";

const TOUCH = 2;
type Side = "left" | "right";
type Box = ReturnType<typeof bounds>;

/** Не участвует в ряду: столешница и объекты «Ряда» Базиса. */
const rowObject = (m: Module) => !!m.worktop || !!m.raw?.row;
/** Ширину самого модуля меняем по-старому (без соседей): угловой (ширина = глубина), купе, сырой из Базиса, объект ряда. */
const ownWidthOnly = (m: Module) => !!m.corner || !!m.kupe || !!m.raw || rowObject(m);
/** Почему соседа нельзя менять (или undefined, если можно). */
function locked(m: Module): string | undefined {
  if (m.raw) return "модуль из Базиса, его ширину студия не меняет";
  if (m.corner) return "угловой модуль, его ширина меняется только в его свойствах";
  if (m.kupe) return "двери купе";
  return undefined;
}
const minWidth = (m: Module) => (m.kitchen && !m.desk ? KITCHEN.minWidth : RULES.minW);
const r1 = (v: number) => Math.round(v * 10) / 10;
const quote = (m: Module) => "«" + m.name + "»";

/** Ось ширины модуля в координатах помещения: единичный вектор +u (вправо, если смотреть на фасад). */
function widthAxis(a: PlacedModule) {
  const o = localToRoom(a, 0, 0), e = localToRoom(a, 1, 0);
  return { x: Math.round(e.x - o.x), z: Math.round(e.z - o.z) };
}
/** Интервал коробки вдоль оси ряда (s растёт вправо) и поперёк неё. */
function along(b: Box, e: { x: number; z: number }) {
  if (e.x) return e.x > 0 ? { lo: b.x, hi: b.x + b.w } : { lo: -(b.x + b.w), hi: -b.x };
  return e.z > 0 ? { lo: b.z, hi: b.z + b.d } : { lo: -(b.z + b.d), hi: -b.z };
}
function across(b: Box, e: { x: number; z: number }) { return e.x ? { lo: b.z, hi: b.z + b.d } : { lo: b.x, hi: b.x + b.w }; }
const overlaps = (a: { lo: number; hi: number }, b: { lo: number; hi: number }) => Math.min(a.hi, b.hi) - Math.max(a.lo, b.lo) > 0.5;
const yRange = (b: Box) => ({ lo: b.y, hi: b.y + b.h });

/** Новая ширина с неподвижным левым (keep 'left') или правым краем корпуса — при любом повороте. */
export function setWidthKeeping(a: PlacedModule, width: number, keep: Side): PlacedModule {
  const W = a.module.width, before = localToRoom(a, keep === "left" ? 0 : W, 0);
  const n: PlacedModule = { ...a, module: { ...a.module, width } };
  const after = localToRoom(n, keep === "left" ? 0 : width, 0);
  n.x = r1(n.x + before.x - after.x); n.z = r1(n.z + before.z - after.z);
  return n;
}

/** Соседи и стены модуля в его ряду. */
export function rowContext(p: Project, a: PlacedModule) {
  const e = widthAxis(a), b = bounds(a), s = along(b, e), c = across(b, e), y = yRange(b);
  const L = e.x ? p.room.width : p.room.depth, room = e.x > 0 || e.z > 0 ? { lo: 0, hi: L } : { lo: -L, hi: 0 };
  const neighbor: Partial<Record<Side, PlacedModule>> = {}, wall: Partial<Record<Side, string>> = {};
  if (s.lo <= room.lo + TOUCH) wall.left = "стена";
  if (s.hi >= room.hi - TOUCH) wall.right = "стена";
  let best: Partial<Record<Side, number>> = {};
  for (const o of p.modules) {
    if (o.id === a.id || rowObject(o.module)) continue;
    const ob = bounds(o);
    if (!overlaps(y, yRange(ob))) continue;
    const oc = across(ob, e);
    if (!overlaps(c, oc)) continue;
    const os = along(ob, e), cover = Math.min(c.hi, oc.hi) - Math.max(c.lo, oc.lo);
    const sameRow = (o.rotation ?? 0) === (a.rotation ?? 0);
    for (const side of ["left", "right"] as const) {
      const touch = side === "right" ? Math.abs(os.lo - s.hi) <= TOUCH : Math.abs(os.hi - s.lo) <= TOUCH;
      if (!touch) continue;
      if (sameRow) { if ((best[side] ?? -1) < cover) { best = { ...best, [side]: cover }; neighbor[side] = o; } }
      else wall[side] = "бок модуля " + quote(o.module); // модуль под 90° — как стена
    }
  }
  return { e, s, c, y, room, neighbor, wall };
}

/** Столешница над нижним модулем и цоколь ряда Базиса вдоль него не должны начать висеть или торчать, когда меняется внешний край ряда. */
function rowObjectsCheck(p: Project, a: PlacedModule, ctx: ReturnType<typeof rowContext>, side: Side, delta: number) {
  const top = (a.y ?? 0) + a.module.height;
  for (const o of p.modules) {
    if (o.id === a.id) continue;
    const ob = bounds(o), os = along(ob, ctx.e), oc = across(ob, ctx.e);
    const worktop = (!!o.module.worktop || (!!o.module.raw?.row && /столешн/i.test(o.module.name))) && Math.abs(ob.y - top) <= 3;
    // цоколь «Ряда» Базиса — отдельный объект вдоль модулей (у своих кухонь цоколь — деталь модуля и идёт за его шириной)
    const plinth = !!o.module.raw?.row && /цокол/i.test(o.module.name) && os.hi - os.lo > oc.hi - oc.lo && overlaps(ctx.y, yRange(ob));
    if (!(worktop || plinth) || !overlaps(ctx.c, oc) || !overlaps(ctx.s, os)) continue;
    const what = worktop ? "столешниц" : "цокол";
    const edge = side === "right" ? ctx.s.hi : ctx.s.lo, end = side === "right" ? os.hi : os.lo;
    const out = side === "right" ? 1 : -1, moved = edge + out * delta;
    const inside = (v: number) => (side === "right" ? v <= end + TOUCH : v >= end - TOUCH);
    if (delta > 0 && inside(edge) && !inside(moved))
      throw Error(`${quote(a.module)} выйдет за край ${what}${worktop ? "ы" : "я"} ${quote(o.module)} на ${r1(Math.abs(moved - end))} мм (${worktop ? "выйдет из-под столешницы" : "цоколь Базиса не удлиняется"}). Сначала удлините ${worktop ? "столешницу" : "цоколь"} или поставьте модуль вплотную к соседу.`);
    if (delta < 0 && Math.abs(edge - end) <= TOUCH)
      throw Error(`${worktop ? "Столешница" : "Цоколь"} ${quote(o.module)} будет торчать за ${quote(a.module)} на ${r1(-delta)} мм. Сначала укоротите ${worktop ? "столешницу" : "цоколь"}.`);
  }
}

/**
 * Меняет ширину модуля placedId по правилу ряда. Возвращает новый проект; при невозможности бросает Error с понятным текстом
 * (ничего не применяется). Угловые, купе, сырые модули Базиса и объекты ряда меняются по-старому — только сам модуль.
 */
export function resizeInRow(p: Project, placedId: string, width: number): Project {
  const a = p.modules.find((x) => x.id === placedId);
  if (!a) throw Error("Модуль не найден.");
  const W = a.module.width, delta = r1(width - W);
  if (!Number.isFinite(width)) throw Error("Ширина: введите число.");
  if (Math.abs(delta) < 0.05 || ownWidthOnly(a.module))
    return { ...p, modules: p.modules.map((x) => (x.id === placedId ? { ...x, module: { ...x.module, width } } : x)) };
  const ctx = rowContext(p, a), { neighbor, wall } = ctx;
  // Сторона, которая двигается: от стены; без стен — к правому соседу, иначе к левому; одиночный — вправо.
  let side: Side;
  if (wall.left && wall.right) {
    if (delta > 0) throw Error(`${quote(a.module)} упирается в стену с обеих сторон (${wall.left} слева, ${wall.right} справа) — шире не станет.`);
    side = "right";
  } else if (wall.left) side = "right";
  else if (wall.right) side = "left";
  else if (neighbor.right) side = "right";
  else if (neighbor.left) side = "left";
  else side = "right";
  const keep: Side = side === "right" ? "left" : "right";
  const next = new Map<string, PlacedModule>([[a.id, setWidthKeeping(a, width, keep)]]);
  const n = neighbor[side];
  if (n) {
    const why = locked(n.module);
    if (why) throw Error(`${side === "right" ? "Справа" : "Слева"} вплотную ${quote(n.module)} — ${why}. Ширина ${quote(a.module)} не изменена.`);
    const nw = r1(n.module.width - delta), min = minWidth(n.module);
    if (nw < min) throw Error(`${quote(a.module)} шире на ${delta} мм не станет: сосед ${side === "right" ? "справа" : "слева"} ${quote(n.module)} сузится до ${nw} мм, а меньше ${min} мм нельзя.`);
    const moved = setWidthKeeping(n, nw, side === "right" ? "right" : "left");
    const before = new Set(validate(n.module)), fresh = validate(moved.module).find((x) => !before.has(x));
    if (fresh) throw Error(`Сосед ${quote(n.module)} при ширине ${nw} мм: ${fresh}`);
    next.set(n.id, moved);
  } else {
    // Внешний край ряда: в свободное место до стены; столешница сверху и цоколь ряда не должны повиснуть или торчать.
    const edge = side === "right" ? ctx.s.hi + delta : ctx.s.lo - delta;
    if (delta > 0 && (side === "right" ? edge > ctx.room.hi + 0.1 : edge < ctx.room.lo - 0.1))
      throw Error(`${quote(a.module)} упирается в стену: ${side === "right" ? "справа" : "слева"} свободно ${r1(Math.max(0, side === "right" ? ctx.room.hi - ctx.s.hi : ctx.s.lo - ctx.room.lo))} мм, а нужно ${delta}.`);
    rowObjectsCheck(p, a, ctx, side, delta);
  }
  return { ...p, modules: p.modules.map((x) => next.get(x.id) ?? x) };
}

/** Замена модуля целиком (правка из панели): если ширина изменилась — по правилу ряда, остальное — как есть. */
export function placeInRow(p: Project, placedId: string, module: Module): Project {
  const a = p.modules.find((x) => x.id === placedId);
  if (!a) throw Error("Модуль не найден.");
  const withModule = (w: number) => ({ ...p, modules: p.modules.map((x) => (x.id === placedId ? { ...x, module: { ...module, width: w } } : x)) });
  if (module.width === a.module.width || ownWidthOnly(module) || ownWidthOnly(a.module)) return withModule(module.width);
  return resizeInRow(withModule(a.module.width), placedId, module.width);
}
