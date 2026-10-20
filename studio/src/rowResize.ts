// Ширина модуля в ряду (правило Макса 09.10.2026, уточнение 20.10.2026): расширяешь модуль — сужается рядом стоящий.
//  • Есть модуль справа вплотную — меняется правый (его левый край сдвигается).
//  • Справа свободно (сосед не вплотную или его нет) — модуль меняется вправо: растёт в свободное место до ближайшего
//    препятствия справа (модуль любого уровня, объект замера, стена), соседи не меняются; места мало — понятная ошибка
//    «справа свободно N мм» с подсказкой «Дотянуть». Левый сосед меняется, только если справа стена или бок (у правой стены).
//    Кухня: на свободном правом краю кончается столешница (цоколь ряда Базиса) — это бок, как раньше меняется левый сосед.
//  • Модуль у стены (бок на стене помещения или на боку модуля, стоящего под 90°) — меняется строго в сторону от стены.
//  • Сужение — то же самое: сосед с той стороны расширяется на ту же величину.
//  «Справа/слева» — как смотрит человек на фасад: +u локальной оси ширины (localToRoom), для поворота 0 это +x.
//  «Ряд» — модули с тем же поворотом, перекрытые по высоте и по глубине, стоящие вплотную (±2 мм).
//  Нижние и навесные не путаются: стык, к которому примыкают модули разных уровней (пенал рядом с нижним и навесным),
//  или стык, где кончается столешница (цоколь «Ряда» Базиса), считается боком — как стена, модуль меняется от него.
//  Столешница и объекты ряда Базиса (raw.row: цоколи, стеновые панели) соседями не считаются.
//  Сосед из Базиса (сырой raw), угловой и купе не меняются — ошибка, правка не применяется.
import { applyAutoFillers, bounds, localToRoom, obstacleBounds, type PlacedModule, type Project } from "./project";
import { validate, RULES, type Module } from "./model";
import { KITCHEN, APPLIANCES } from "./kitchen";

const TOUCH = 2;
type Side = "left" | "right";
type Box = ReturnType<typeof bounds>;

/** Не участвует в ряду: столешница и объекты «Ряда» Базиса. */
const rowObject = (m: Module) => !!m.worktop || !!m.raw?.row;
/** Ширину самого модуля меняем по-старому (без соседей): угловой (ширина = глубина), купе, сырой из Базиса, объект ряда. */
const ownWidthOnly = (m: Module) => !!m.ownWidthOnly || !!m.corner || !!m.kupe || !!m.raw || rowObject(m);
/** Почему соседа нельзя менять (или undefined, если можно). */
function locked(m: Module): string | undefined {
  if (m.raw) return "модуль из Базиса, его ширину студия не меняет";
  if (m.corner) return "угловой модуль, его ширина меняется только в его свойствах";
  if (m.kupe) return "двери купе";
  return undefined;
}
const minWidth = (m: Module) => (m.kitchen && !m.desk ? KITCHEN.minWidth : RULES.minW);
// предел ширины кухонного соседа — как у проверки и поля «Ширина» (KITCHEN.maxModuleWidth 1650: самый широкий модуль базы 1649),
// а не предел автораскладки фасадов KITCHEN.maxWidth 1200: сосед при сужении модуля растёт, пока вручную допустимо
const maxWidth = (m: Module) => (m.kitchen && !m.desk ? KITCHEN.maxModuleWidth : RULES.maxW);
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
  // Граница свободного места с каждой стороны: стена помещения или ближайший объект замера (колонна, короб, радиатор…) на высоте модуля.
  const limit: Record<Side, { at: number; what: string }> = { left: { at: room.lo, what: "стена" }, right: { at: room.hi, what: "стена" } };
  for (const o of p.room.obstacles ?? []) {
    const ob = obstacleBounds(o);
    if (!overlaps(y, yRange(ob)) || !overlaps(c, across(ob, e))) continue;
    const os = along(ob, e), what = "объект замера «" + o.name + "»";
    if (os.lo >= s.hi - TOUCH && os.lo < limit.right.at) limit.right = { at: os.lo, what };
    if (os.hi <= s.lo + TOUCH && os.hi > limit.left.at) limit.left = { at: os.hi, what };
  }
  // «У стены» — с тем же допуском, что фальш к стене в applyAutoFillers (RULES.wallSnap; bounds уже с вылетом фальши)
  if (s.lo <= limit.left.at + RULES.wallSnap) wall.left = limit.left.what;
  if (s.hi >= limit.right.at - RULES.wallSnap) wall.right = limit.right.what;
  const rot = a.rotation ?? 0, touching: Record<Side, PlacedModule[]> = { left: [], right: [] };
  for (const o of p.modules) {
    if (o.id === a.id || rowObject(o.module)) continue;
    const ob = bounds(o);
    if (!overlaps(y, yRange(ob))) continue;
    const oc = across(ob, e);
    if (!overlaps(c, oc)) continue;
    const os = along(ob, e);
    const sameRow = (o.rotation ?? 0) === rot;
    for (const side of ["left", "right"] as const) {
      const gap = side === "right" ? os.lo - s.hi : s.lo - os.hi;
      // сосед ряда — вплотную (±2 мм); модуль под 90° — стык с тем же допуском, что угловая фальш (RULES.cornerSnap)
      if (sameRow ? Math.abs(gap) > TOUCH : gap < -TOUCH || gap > RULES.cornerSnap) continue;
      if (sameRow) touching[side].push(o);
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
  return { e, s, c, y, limit, neighbor, wall };
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
  // справа свободно, но там кончается столешница или цоколь ряда Базиса (кухня), а слева сосед вплотную — край ряда как бок:
  // модуль растёт влево за счёт левого соседа и не выходит из-под столешницы (как до уточнения 20.10)
  else if (!neighbor.right && neighbor.left && rowObjectEnd(p, [a], ctx.c, ctx.e, ctx.s.hi)) side = "left";
  // сосед справа вплотную — меняется он; справа свободно — модуль растёт вправо в свободное место (решение Макса 20.10)
  else side = "right";
  const keep: Side = side === "right" ? "left" : "right";
  const next = new Map<string, PlacedModule>([[a.id, setWidthKeeping(a, width, keep)]]);
  const n = neighbor[side];
  if (n) next.set(n.id, neighborResized(a, n, side, delta));
  else {
    // Внешний край ряда: в свободное место до ближайшего препятствия (модуль любого уровня, объект замера, стена);
    // столешница сверху и цоколь ряда не должны повиснуть или торчать.
    const g = freeSpace(p, a)[side];
    if (delta > 0 && g.gap < delta - 0.1) {
      const where = side === "right" ? "справа" : "слева";
      const hint = g.gap >= 1 ? ` Можно «Дотянуть до ${g.to}» (+${g.gap} мм) — по плашке зазора или правой кнопкой › Размеры.` : "";
      throw Error(`${quote(a.module)} упирается в ${g.what === "стена" ? "стену" : g.what}: ${where} свободно ${g.gap} мм, а нужно ${delta}.${hint}`);
    }
    rowObjectsCheck(p, a, ctx, side, delta);
  }
  return { ...p, modules: p.modules.map((x) => next.get(x.id) ?? x) };
}

/** Сосед вплотную со стороны side меняется на −delta (его дальний край на месте); нельзя — Error с понятным текстом. */
function neighborResized(a: PlacedModule, n: PlacedModule, side: Side, delta: number): PlacedModule {
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
  return moved;
}

// ── Зазоры, «Дотянуть», «Вплотную», растяжение мышью (запрос Макса 20.10.2026) ─────────────────────────────────────────

/** Зазор с одной стороны модуля по оси его ширины. gap — мм до препятствия (0 — вплотную); what — 'стена', '«Имя модуля»'
 *  или 'объект замера «…»'; to — то же после «до» («стены», «объекта замера …»); fillWidth — ширина, если дотянуть край
 *  до препятствия; moveTo — положение модуля (x, z), если придвинуть его вплотную (ширина та же). */
export type GapSide = { gap: number; what: string; to: string; id?: string; fillWidth: number; moveTo: { x: number; z: number } };
const genitive = (what: string) => (what === "стена" ? "стены" : what.startsWith("объект замера") ? what.replace("объект замера", "объекта замера") : what);

/** Ближайшее препятствие с каждой стороны: модуль любого уровня (перекрытый по высоте и поперёк ряда), объект замера, стена. */
function freeSpace(p: Project, a: PlacedModule): Record<Side, GapSide> {
  const e = widthAxis(a), b = bounds(a), s = along(b, e), c = across(b, e), y = yRange(b);
  const L = e.x ? p.room.width : p.room.depth, room = e.x > 0 || e.z > 0 ? { lo: 0, hi: L } : { lo: -L, hi: 0 };
  const hit: Record<Side, { at: number; what: string; id?: string }> = { left: { at: room.lo, what: "стена" }, right: { at: room.hi, what: "стена" } };
  const consider = (os: { lo: number; hi: number }, what: string, id?: string) => {
    if (os.lo >= s.hi - TOUCH && os.lo < hit.right.at) hit.right = { at: os.lo, what, id };
    if (os.hi <= s.lo + TOUCH && os.hi > hit.left.at) hit.left = { at: os.hi, what, id };
  };
  for (const o of p.room.obstacles ?? []) {
    const ob = obstacleBounds(o);
    if (overlaps(y, yRange(ob)) && overlaps(c, across(ob, e))) consider(along(ob, e), "объект замера «" + o.name + "»");
  }
  for (const o of p.modules) {
    if (o.id === a.id || rowObject(o.module)) continue;
    const ob = bounds(o);
    if (overlaps(y, yRange(ob)) && overlaps(c, across(ob, e))) consider(along(ob, e), quote(o.module), o.id);
  }
  const shift = (d: number) => { const o = localToRoom(a, 0, 0), t = localToRoom(a, d, 0); return { x: r1(a.x + t.x - o.x), z: r1(a.z + t.z - o.z) }; };
  const one = (side: Side): GapSide => {
    const raw = side === "right" ? hit.right.at - s.hi : s.lo - hit.left.at, h = hit[side];
    const gap = raw <= TOUCH ? 0 : r1(raw);
    return { gap, what: h.what, to: genitive(h.what), id: h.id, fillWidth: r1(a.module.width + gap), moveTo: shift(side === "right" ? gap : -gap) };
  };
  return { left: one("left"), right: one("right") };
}

/** Зазоры слева и справа от модуля по оси его ширины (любой поворот): до соседа любого уровня, объекта замера или стены. */
export function gaps(p: Project, id: string): Record<Side, GapSide> {
  const a = p.modules.find((x) => x.id === id);
  if (!a) throw Error("Модуль не найден.");
  return freeSpace(p, a);
}

/** Почему ширину самого модуля нельзя менять краем (или undefined). */
function ownLocked(m: Module): string | undefined {
  if (rowObject(m)) return "столешница и объекты ряда Базиса меняются в своих свойствах";
  return locked(m);
}
/** Ширина самого модуля w допустима: пределы, ниша техники, новая ошибка проверки модуля. */
function checkOwnWidth(a: PlacedModule, w: number) {
  const m = a.module, min = minWidth(m), max = maxWidth(m);
  if (w < min) throw Error(`${quote(m)}: ширина стала бы ${w} мм, а меньше ${min} мм нельзя.`);
  if (w > max) throw Error(`${quote(m)}: ширина стала бы ${w} мм, а больше ${max} мм нельзя.`);
  const tech = m.kitchen?.appliance && APPLIANCES[m.kitchen.appliance];
  if (tech && !tech.widths.includes(w)) throw Error(`${quote(m)} — под технику («${tech.label}»): ширина ${tech.widths.join(" или ")} мм, а стала бы ${w}.`);
  const before = new Set(validate(m)), fresh = validate({ ...m, width: w }).find((x) => !before.has(x));
  if (fresh) throw Error(`${quote(m)} при ширине ${w} мм: ${fresh}`);
}
const replace = (p: Project, list: PlacedModule[]): Project => { const by = new Map(list.map((x) => [x.id, x])); return { ...p, modules: p.modules.map((x) => by.get(x.id) ?? x) }; };
/** Автофальшь у стены (планка торцом) появляется или пропадает и сдвигает корпус — неподвижный край не должен уехать:
 *  поправка ширины на этот сдвиг (один шаг; остальное проверит проект при сохранении). */
function settle(p: Project, next: Project, id: string, keep: Side): Project {
  const a0 = p.modules.find((x) => x.id === id)!, e = widthAxis(a0), k = keep === "left" ? "lo" : "hi";
  const a1 = applyAutoFillers(next).modules.find((x) => x.id === id);
  if (!a1) return next;
  // drift > 0 — неподвижный край уехал наружу (корпус сдвинут от препятствия на вылет фальши): ширину уменьшаем на столько же
  const drift = keep === "left" ? along(bounds(a0), e)[k] - along(bounds(a1), e)[k] : along(bounds(a1), e)[k] - along(bounds(a0), e)[k];
  if (Math.abs(drift) < 0.5) return next;
  const cur = next.modules.find((x) => x.id === id)!;
  return replace(next, [setWidthKeeping(cur, r1(cur.module.width - drift), keep)]);
}
/** Край side уходит наружу на d мм (d < 0 — внутрь), противоположный край на месте, соседи не меняются. */
function moveFreeEdge(p: Project, a: PlacedModule, side: Side, d: number): Project {
  const why = ownLocked(a.module);
  if (why) throw Error(`${quote(a.module)}: ${why}.`);
  const w = r1(a.module.width + d), keep: Side = side === "right" ? "left" : "right";
  checkOwnWidth(a, w);
  if (d > 0.05) {
    const g = freeSpace(p, a)[side];
    if (g.gap < d - 0.1) throw Error(`${quote(a.module)} упирается в ${g.what === "стена" ? "стену" : g.what}: ${side === "right" ? "справа" : "слева"} свободно ${g.gap} мм, а нужно ${r1(d)}.`);
  }
  rowObjectsCheck(p, a, rowContext(p, a), side, d);
  return settle(p, replace(p, [setWidthKeeping(a, w, keep)]), a.id, keep);
}
/** Стык с соседом вплотную уходит на d мм наружу: модуль шире на d, сосед уже на d (его дальний край на месте). */
function moveJoint(p: Project, a: PlacedModule, n: PlacedModule, side: Side, d: number): Project {
  const why = ownLocked(a.module);
  if (why) throw Error(`${quote(a.module)}: ${why}.`);
  const w = r1(a.module.width + d);
  checkOwnWidth(a, w);
  return replace(p, [setWidthKeeping(a, w, side === "right" ? "left" : "right"), neighborResized(a, n, side, r1(d))]);
}

/** «Дотянуть»: край side доходит до препятствия (соседа, объекта замера, стены), противоположный край на месте. */
export function fillGap(p: Project, id: string, side: Side): Project {
  const a = p.modules.find((x) => x.id === id);
  if (!a) throw Error("Модуль не найден.");
  const g = freeSpace(p, a)[side];
  if (g.gap < 0.5) throw Error(`${quote(a.module)} ${side === "right" ? "справа" : "слева"} уже вплотную к ${g.what === "стена" ? "стене" : g.what} — дотягивать нечего.`);
  return moveFreeEdge(p, a, side, g.gap);
}

/** «Вплотную»: модуль придвигается к препятствию со стороны side (ширина та же); gap — оставить зазор, мм (по умолчанию 0). */
export function flush(p: Project, id: string, side: Side, gap = 0): Project {
  const a = p.modules.find((x) => x.id === id);
  if (!a) throw Error("Модуль не найден.");
  if (!Number.isFinite(gap) || gap < 0) throw Error("Зазор: введите число не меньше 0.");
  const g = freeSpace(p, a), other: Side = side === "right" ? "left" : "right", shift = r1(g[side].gap - gap);
  if (Math.abs(shift) < 0.05) return p;
  // отодвинуть дальше, чем свободно с другой стороны, нельзя
  if (shift < 0 && -shift > g[other].gap + 0.1) throw Error(`${quote(a.module)}: чтобы зазор ${side === "right" ? "справа" : "слева"} стал ${gap} мм, модуль надо сдвинуть на ${-shift} мм, а ${other === "right" ? "справа" : "слева"} свободно только ${g[other].gap} мм (до ${g[other].to}).`);
  const o = localToRoom(a, 0, 0), t = localToRoom(a, side === "right" ? shift : -shift, 0);
  return replace(p, [{ ...a, x: r1(a.x + t.x - o.x), z: r1(a.z + t.z - o.z) }]);
}

/** План растяжения мышью: край side уходит наружу на raw мм (по курсору). snap — ширина к 10 мм и край к препятствию
 *  или к краю модуля любого уровня в той же линии в пределах 30 мм (Alt — без привязки). Свободный край — меняется только
 *  модуль (не заходит в соседа); край вплотную к соседу ряда — двигается стык (модуль и сосед вместе, с пределами соседа).
 *  project — результат (если можно), problem — почему нельзя. */
export type StretchPlan = { mode: "free" | "joint"; width: number; delta: number; gap: number; neighbor?: { id: string; name: string; width: number }; project?: Project; problem?: string };
export const STRETCH_SNAP = 30;
export function planStretch(p: Project, id: string, side: Side, raw: number, snap = true): StretchPlan {
  const a = p.modules.find((x) => x.id === id);
  if (!a) throw Error("Модуль не найден.");
  const ctx = rowContext(p, a), g = freeSpace(p, a)[side], n = ctx.neighbor[side], W = a.module.width;
  const joint = !!n && g.gap === 0 && !locked(n.module);
  let lo = minWidth(a.module) - W, hi = maxWidth(a.module) - W;
  if (joint) { lo = Math.max(lo, n!.module.width - maxWidth(n!.module)); hi = Math.min(hi, n!.module.width - minWidth(n!.module)); }
  else hi = Math.min(hi, g.gap);
  let d = raw;
  if (snap) {
    d = Math.round((W + raw) / 10) * 10 - W;
    // края в пределах 30 мм: препятствие (дотянуть) и края модулей любого уровня в той же линии (навесной по нижнему)
    const e = ctx.e, edge = side === "right" ? ctx.s.hi : ctx.s.lo, out = side === "right" ? 1 : -1;
    const targets: number[] = joint ? [] : [g.gap];
    for (const o of p.modules) {
      if (o.id === a.id || (joint && o.id === n!.id) || rowObject(o.module)) continue;
      const ob = bounds(o);
      if (!overlaps(ctx.c, across(ob, e))) continue;
      const os = along(ob, e);
      for (const t of [os.lo, os.hi]) targets.push(r1((t - edge) * out));
    }
    let best = STRETCH_SNAP + 0.01;
    for (const t of targets) if (Math.abs(t - raw) < best && t >= lo - 0.1 && t <= hi + 0.1) { best = Math.abs(t - raw); d = t; }
  } else d = Math.round(raw);
  d = hi < lo ? 0 : r1(Math.min(Math.max(d, lo), hi));
  const plan: StretchPlan = { mode: joint ? "joint" : "free", width: r1(W + d), delta: d, gap: joint ? 0 : r1(Math.max(0, g.gap - d)) };
  if (joint) plan.neighbor = { id: n!.id, name: n!.module.name, width: r1(n!.module.width - d) };
  if (Math.abs(d) < 0.05) return plan;
  try { plan.project = joint ? moveJoint(p, a, n!, side, d) : moveFreeEdge(p, a, side, d); }
  catch (err) { plan.problem = (err as Error).message; }
  return plan;
}

/** Замена модуля целиком (правка из панели): если ширина изменилась — по правилу ряда, остальное — как есть. */
export function placeInRow(p: Project, placedId: string, module: Module): Project {
  const a = p.modules.find((x) => x.id === placedId);
  if (!a) throw Error("Модуль не найден.");
  const withModule = (w: number) => ({ ...p, modules: p.modules.map((x) => (x.id === placedId ? { ...x, module: { ...module, width: w } } : x)) });
  if (module.width === a.module.width || ownWidthOnly(module) || ownWidthOnly(a.module)) return withModule(module.width);
  return resizeInRow(withModule(a.module.width), placedId, module.width);
}
