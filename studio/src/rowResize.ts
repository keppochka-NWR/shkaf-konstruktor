// Ширина модуля в ряду (правило Макса 09.10.2026): расширяешь модуль — сужается рядом стоящий.
//  • Есть модуль справа вплотную — меняется правый (его левый край сдвигается); справа нет — меняется левый, сам модуль растёт влево.
//  • Модуль у стены (бок на стене помещения или на боку модуля, стоящего под 90°) — меняется строго в сторону от стены.
//  • Сужение — то же самое: сосед с той стороны расширяется на ту же величину.
//  «Справа/слева» — как смотрит человек на фасад: +u локальной оси ширины (localToRoom), для поворота 0 это +x.
//  «Ряд» — модули с тем же поворотом, перекрытые по высоте и по глубине, стоящие вплотную (±2 мм).
//  Нижние и навесные не путаются: стык, к которому примыкают модули разных уровней (пенал рядом с нижним и навесным),
//  или стык, где кончается столешница (цоколь «Ряда» Базиса), считается боком — как стена, модуль меняется от него.
//  Столешница и объекты ряда Базиса (raw.row: цоколи, стеновые панели) соседями не считаются.
//  Сосед из Базиса (сырой raw), угловой и купе не меняются — ошибка, правка не применяется.
import { bounds, localToRoom, type PlacedModule, type Project } from "./project";
import { validate, RULES, type Module } from "./model";
import { KITCHEN, APPLIANCES } from "./kitchen";

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
const maxWidth = (m: Module) => (m.kitchen && !m.desk ? KITCHEN.maxWidth : RULES.maxW);
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
  const rot = a.rotation ?? 0, touching: Record<Side, PlacedModule[]> = { left: [], right: [] };
  for (const o of p.modules) {
    if (o.id === a.id || rowObject(o.module)) continue;
    const ob = bounds(o);
    if (!overlaps(y, yRange(ob))) continue;
    const oc = across(ob, e);
    if (!overlaps(c, oc)) continue;
    const os = along(ob, e);
    for (const side of ["left", "right"] as const) {
      const touch = side === "right" ? Math.abs(os.lo - s.hi) <= TOUCH : Math.abs(os.hi - s.lo) <= TOUCH;
      if (!touch) continue;
      if ((o.rotation ?? 0) === rot) touching[side].push(o);
      else wall[side] = "бок модуля " + quote(o.module); // модуль под 90° — как стена
    }
  }
  // Сосед — только из своего уровня (нижние и навесные не путаются). Стык считается боком (как стена), если правка соседа
  // задела бы другой уровень: к стыку примыкают модули разных уровней (пенал рядом с нижним и навесным) или кончается столешница.
  for (const side of ["left", "right"] as const) {
    const list = touching[side];
    if (!list.length || wall[side]) continue;
    const E = side === "right" ? s.hi : s.lo;
    const n = list.reduce((m, o) => (cover(c, across(bounds(o), e)) > cover(c, across(bounds(m), e)) ? o : m));
    const other = list.find((o) => !overlaps(yRange(bounds(o)), yRange(bounds(n))));
    if (other) { wall[side] = `бок, к которому примыкают ${quote(n.module)} и ${quote(other.module)} разных уровней`; continue; }
    const nb = bounds(n), ny = yRange(nb);
    const shared = p.modules.find((o) => {
      if (o.id === a.id || o.id === n.id || rowObject(o.module) || (o.rotation ?? 0) !== rot) return false;
      const ob = bounds(o), os = along(ob, e);
      return overlaps(ny, yRange(ob)) && !overlaps(y, yRange(ob)) && overlaps(across(nb, e), across(ob, e)) && Math.abs((side === "right" ? os.hi : os.lo) - E) <= TOUCH;
    });
    if (shared) { wall[side] = `бок ${quote(n.module)}, к которому примыкает и ${quote(shared.module)} другого уровня`; continue; }
    const end = rowObjectEnd(p, [a, n], c, e, E);
    if (end) { wall[side] = end; continue; }
    neighbor[side] = n;
  }
  return { e, s, c, y, room, neighbor, wall };
}
const cover = (a: { lo: number; hi: number }, b: { lo: number; hi: number }) => Math.min(a.hi, b.hi) - Math.max(a.lo, b.lo);
const isWorktop = (m: Module) => !!m.worktop || (!!m.raw?.row && /столешн/i.test(m.name));
const isRowPlinth = (m: Module) => !!m.raw?.row && /цокол/i.test(m.name);
/** Кончается ли на стыке E столешница (над любым из модулей стыка) или цоколь «Ряда» Базиса — тогда стык не двигаем. */
function rowObjectEnd(p: Project, mods: PlacedModule[], c: { lo: number; hi: number }, e: { x: number; z: number }, E: number) {
  for (const o of p.modules) {
    const ob = bounds(o), os = along(ob, e);
    if (!overlaps(c, across(ob, e)) || (Math.abs(os.lo - E) > TOUCH && Math.abs(os.hi - E) > TOUCH)) continue;
    const top = (m: PlacedModule) => (m.y ?? 0) + m.module.height;
    if (isWorktop(o.module) && mods.some((m) => Math.abs(ob.y - top(m)) <= 3)) return `край столешницы ${quote(o.module)}`;
    if (isRowPlinth(o.module) && mods.some((m) => overlaps(yRange(bounds(m)), yRange(ob)))) return `край цоколя ${quote(o.module)}`;
  }
  return undefined;
}

/** Столешница над нижним модулем и цоколь ряда Базиса вдоль него не должны начать висеть или торчать, когда меняется внешний край ряда. */
function rowObjectsCheck(p: Project, a: PlacedModule, ctx: ReturnType<typeof rowContext>, side: Side, delta: number) {
  const top = (a.y ?? 0) + a.module.height;
  for (const o of p.modules) {
    if (o.id === a.id) continue;
    const ob = bounds(o), os = along(ob, ctx.e), oc = across(ob, ctx.e);
    const worktop = isWorktop(o.module) && Math.abs(ob.y - top) <= 3;
    // цоколь «Ряда» Базиса — отдельный объект вдоль модулей (у своих кухонь цоколь — деталь модуля и идёт за его шириной)
    const plinth = isRowPlinth(o.module) && os.hi - os.lo > oc.hi - oc.lo && overlaps(ctx.y, yRange(ob));
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
    const nw = r1(n.module.width - delta), min = minWidth(n.module), max = maxWidth(n.module), where = side === "right" ? "справа" : "слева";
    if (nw < min) throw Error(`${quote(a.module)} шире на ${delta} мм не станет: сосед ${where} ${quote(n.module)} сузится до ${nw} мм, а меньше ${min} мм нельзя.`);
    if (nw > max) throw Error(`${quote(a.module)} уже на ${-delta} мм не станет: сосед ${where} ${quote(n.module)} расширится до ${nw} мм, а больше ${max} мм нельзя.`);
    // под технику (мойка, духовка, посудомойка) — только ширины ниш из APPLIANCES: сосед молча не уходит в ширину, куда техника не встанет
    const tech = n.module.kitchen?.appliance && APPLIANCES[n.module.kitchen.appliance];
    if (tech && !tech.widths.includes(nw)) throw Error(`Сосед ${where} ${quote(n.module)} — под технику («${tech.label}»): ширина ${tech.widths.join(" или ")} мм, а стала бы ${nw}. Сначала измените ширину соседа сами.`);
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
