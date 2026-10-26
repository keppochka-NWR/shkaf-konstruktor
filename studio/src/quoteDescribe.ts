// Описание модуля для клиентских документов (КП, спецификация для клиента) — по ТИПУ модуля (аудит магазина 15.10.2026, Б3):
// шкаф — корпус и наполнение; двери купе — профиль и наполнение по полотнам; столешница — материал и толщина; кухонный модуль —
// тип, ящики фактическим числом, фасады фактическим материалом (Вернисаж — серия, фрезеровка, покрытие; алюминий — профиль, вставка).
// Нулевые позиции («пантографов: 0») не печатаются. Внутренних слов (раскрой, Базис, прайс, закупка) здесь нет.
import { parts, isDrawerFront, drawerConfig, facadeHandleId, type Module, type Part } from "./model";
import { HINGE_BRANDS, SLIDE_MOTIONS, slideSystem } from "./hardware";
import { handleById, DEFAULT_HANDLE } from "./handles";
import { kupeSystem, kupeColor, kupeDoorFill, kupeSections } from "./kupe";
import { worktopLabel } from "./kitchen";
import { aluProfile, aluColor, aluFill } from "./alu";
import { vernissageMilling, seriesOf, type VernissageFacade } from "./facadesVernissage";
import { plural } from "./ru";
import { rawKitchen } from "./rawModule";
import { lightSummary } from "./lights";

export type ModuleDescription = { kind: string; size: string; materials: string[]; filling: string[] };

const KITCHEN_ROLE: Record<string, string> = { base: "Кухонный нижний модуль", wall: "Кухонный навесной модуль", tall: "Кухонный пенал", antresol: "Кухонная антресоль" };
const APPLIANCE: Record<string, string> = { sink: "под мойку", oven: "под духовой шкаф", microwave: "под СВЧ", dishwasher: "под посудомоечную машину", hob: "под варочную панель", hood: "под вытяжку", fridge: "под холодильник" };

/** Покрытие фасада Вернисаж словами для клиента. */
function vernissageCover(v: VernissageFacade): string {
  switch (v.cover) {
    case "film": return "плёнка ПВХ" + (v.film ? " «" + v.film + "»" : "");
    case "adilet": return "плёнка Адилет" + (v.film ? " «" + v.film + "»" : "");
    case "pet": return "ПЭТ" + (v.film ? " «" + v.film + "»" : "");
    case "enamel-matte": return "эмаль матовая" + (v.enamelColor ? " " + v.enamelColor : "");
    case "enamel-gloss": return "эмаль глянцевая" + (v.enamelColor ? " " + v.enamelColor : "");
    default: return "без покрытия";
  }
}
/** Фасады Вернисаж: серия, фрезеровка, покрытие, толщина — без цен и служебных пометок. */
export function vernissageClientLabel(v: VernissageFacade): string {
  const s = seriesOf(v.milling), m = vernissageMilling(v.milling);
  const open = v.open === "glass" ? ", под стекло" : v.open === "grille" ? ", с решёткой" : "";
  const milling = s.id === "pet" ? "" : `, фрезеровка №${m?.id ?? v.milling}${open}`;
  return `МДФ «Вернисаж», серия «${s.name}»${milling}, ${vernissageCover(v)}, ${v.thickness} мм`;
}
/** Фасады в алюминиевой рамке: профиль, цвет профиля, вставка. */
export function aluClientLabel(m: Module): string {
  const a = m.alu!, p = aluProfile(a.profile), c = aluColor(a.profile, a.color), i = aluFill(a.insert);
  return `алюминиевая рамка, профиль ${p?.label ?? a.profile}, цвет ${c?.label ?? a.color}, вставка ${i?.label ?? a.insert}`;
}
/** Материал распашных фасадов модуля — фактический (Вернисаж, алюминий, ЛДСП/МДФ по декору). */
export function facadeMaterialLabel(m: Module): string {
  if (m.vernissage) return vernissageClientLabel(m.vernissage);
  if (m.alu) return aluClientLabel(m);
  return m.facadeMaterial === "external" ? m.facadeDecor : "ЛДСП " + m.facadeDecor;
}
/** Материал фасадов ящиков: Вернисаж — тот же, что у дверей; алюминий — по фактическим деталям (фасад ящика material 'alu'):
 *  вкладные ящики и ящики за дверью рамку не получают и остаются ЛДСП, даже при aluDrawers. */
function drawerFacadeLabel(m: Module, all: Part[]): string {
  if (m.vernissage) return vernissageClientLabel(m.vernissage);
  const d = m.drawerFacadeDecor ?? m.facadeDecor, plain = m.facadeMaterial === "external" ? d : "ЛДСП " + d;
  const fronts = all.filter(isDrawerFront), alu = fronts.filter((p) => p.material === "alu").length;
  if (!m.alu || !alu) return plain;
  return alu === fronts.length ? aluClientLabel(m) : `${aluClientLabel(m)}; вкладные и за дверью — ${plain}`;
}
/** Фактическое число ящиков: секции студии + ящики кухни (kdrawers) + ящики модуля Базиса (raw.counts). */
export function drawerCount(m: Module): number {
  return m.sections.reduce((n, s) => n + (s.drawers || 0), 0) + (m.kdrawers?.length ?? 0) + (m.raw?.counts?.drawers ?? 0);
}
/** Есть ли у модуля распашные фасады фактически (детали-двери в модели). */
function hasDoorParts(m: Module) { return parts(m).some((d) => d.role === "door"); }

function kupeDescription(m: Module): ModuleDescription {
  const k = m.kupe!, s = kupeSystem(k), c = kupeColor(k), sec = kupeSections(k);
  const fills = Array.from({ length: k.doors }, (_, i) => kupeDoorFill(k, i).n);
  const same = fills.every((f) => f === fills[0]);
  const materials = [`Профиль: ${s.system}, цвет ${c.name}`];
  if (same) materials.push(`Наполнение: ${fills[0]} — ${k.doors === 1 ? "полотно" : "все " + k.doors + " " + plural(k.doors, ["полотно", "полотна", "полотен"])}`);
  else fills.forEach((f, i) => materials.push(`Полотно ${i + 1}: ${f}`));
  const filling = [`${k.doors} ${plural(k.doors, ["полотно", "полотна", "полотен"])}`, `раскладка: ${sec.label}`];
  if (k.softClose) filling.push("доводчики");
  return { kind: "Двери купе", size: `${m.width} × ${m.height} (проём)`, materials, filling };
}
function worktopDescription(m: Module): ModuleDescription {
  const w = m.worktop!, sinks = w.cutouts.filter((c) => c.kind === "sink").length, hobs = w.cutouts.length - sinks;
  const filling: string[] = [];
  if (sinks) filling.push(`вырез под мойку${sinks > 1 ? " — " + sinks : ""}`);
  if (hobs) filling.push(`вырез под варочную панель${hobs > 1 ? " — " + hobs : ""}`);
  return { kind: "Столешница", size: `${m.width} × ${m.depth} × ${w.thickness}`, materials: [`Столешница: ${worktopLabel(w)}, ${w.thickness} мм`], filling };
}

/** «Что внутри и как открывается» простыми словами для КП (менеджеры 22.10.2026, п. 9): двери и петли, ручки или push-to-open,
 *  ящики и их направляющие. Только факты модели — без нагрузок и выдвижения, которых нет в каталоге. Купе и столешница — пусто
 *  (у них всё сказано в describeModule). */
export function plainFeatures(m: Module): string[] {
  if (m.kupe || m.worktop) return [];
  let all: Part[];
  try { all = parts(m); } catch { return []; }
  const out: string[] = [];
  const doors = all.filter((d) => d.role === "door" && d.id !== "slope-filler").length;
  const push = m.doorOpen === "push", hb = HINGE_BRANDS[m.hingeBrand ?? "gtv"] ?? HINGE_BRANDS.gtv;
  if (doors && m.kitchen?.hinges !== false) {
    const lift = all.some((d) => d.role === "door" && d.hinge === "top");
    out.push(`${doors} ${plural(doors, ["распашная дверь", "распашные двери", "распашных дверей"])}${m.doorMount === "inset" ? " (вкладные — внутри корпуса)" : ""}${lift ? ", есть подъёмная" : ""}`);
    out.push(push ? `открывание нажатием (push-to-open), без ручек: петли ${hb.label} без пружины и толкатели` : m.hingeSoft === false ? `петли ${hb.label} без доводчика (самозакрывающиеся)` : `петли ${hb.label} с доводчиком — двери закрываются плавно и тихо`);
  }
  // заказ 7441182: утопленный цоколь, посадочное место и щит над ним — строкой в КП
  if (m.plinthRecess !== undefined) out.push(`цоколь утоплен на ${m.plinthRecess} мм, двери над цоколем`);
  if (m.seatPanel) out.push(`щит ЛДСП 16 над сиденьем ${m.seatPanel.height} мм${m.seatPanel.decor && m.seatPanel.decor !== m.decor ? ", декор " + m.seatPanel.decor : ""}`);
  const handles = new Map<string, number>();
  for (const d of all) if (d.role === "handle") { const h = handleById(facadeHandleId(m, d.id) ?? DEFAULT_HANDLE); handles.set(h.label, (handles.get(h.label) ?? 0) + 1); }
  if (handles.size) out.push("ручки: " + [...handles].map(([l, n]) => `${l} — ${n} шт.`).join("; "));
  const systems = new Map<string, number>();
  for (const s of m.sections) for (let j = 0; j < (s.drawers || 0); j++) {
    const c = drawerConfig(m, s, j);
    if (c.mesh) { systems.set("выдвижная сетка", (systems.get("выдвижная сетка") ?? 0) + 1); continue; }
    const sys = slideSystem(c), kind = sys.slide === "ball" ? "шариковых направляющих" : "скрытых направляющих (под дном ящика, снаружи не видны)";
    const key = `на ${kind}, ${SLIDE_MOTIONS[sys.motion] === "push-to-open" ? "открывание нажатием" : SLIDE_MOTIONS[sys.motion]}`;
    systems.set(key, (systems.get(key) ?? 0) + 1);
  }
  for (const [k, n] of systems) out.push(k === "выдвижная сетка" ? `${n} ${plural(n, ["выдвижная сетка", "выдвижные сетки", "выдвижных сеток"])}` : `${n} ${plural(n, ["ящик", "ящика", "ящиков"])} ${k}`);
  return out;
}

/** Описание модуля для клиента по его типу. */
export function describeModule(m: Module): ModuleDescription {
  if (m.kupe) return kupeDescription(m);
  if (m.worktop) return worktopDescription(m);
  const size = `${m.width} × ${m.height} × ${m.depth}`;
  const drawers = drawerCount(m), all = parts(m), doors = m.raw ? hasDoorParts(m) : m.doors && all.some((d) => d.role === "door");
  const shelves = all.filter((d) => d.role === "shelf").length, rods = m.sections.filter((s) => s.rod).length;
  const pantographs = m.sections.filter((s) => s.pantograph).length, pullouts = m.sections.reduce((n, s) => n + (s.pullouts || 0), 0);
  const materials = [`Корпус: ЛДСП ${m.decor}`];
  if (doors) materials.push(`Фасады: ${facadeMaterialLabel(m)}`);
  if (drawers && !(m.vernissage && doors)) materials.push(`Фасады ящиков: ${drawerFacadeLabel(m, all)}`);
  const filling: string[] = [];
  if (shelves) filling.push(`${shelves} ${plural(shelves, ["полка", "полки", "полок"])}`);
  if (drawers) filling.push(`${drawers} ${plural(drawers, ["ящик", "ящика", "ящиков"])}`);
  if (rods) filling.push(`${rods} ${plural(rods, ["штанга", "штанги", "штанг"])}`);
  if (pantographs) filling.push(`${pantographs} ${plural(pantographs, ["пантограф", "пантографа", "пантографов"])}`);
  if (pullouts) filling.push(`${pullouts} ${plural(pullouts, ["выдвижной тремпель", "выдвижных тремпеля", "выдвижных тремпелей"])}`);
  // подсветка по деталям (20.10.2026): вертикали и горизонтали отдельно — штуки и длина LED-профиля, как в смете
  const led = lightSummary(m), meters = (v: number) => v.toLocaleString("ru-RU", { maximumFractionDigits: 2 }) + " пог. м";
  // тип и тон (задача 14, 22.10.2026) — в скобках, только если выбраны менеджером (старые КП — как раньше)
  const spec = (s: string) => (s ? ` (${s})` : "");
  if (led.vertical.count) filling.push(`подсветка в стойках: ${led.vertical.count} шт., ${meters(led.vertical.meters)}${spec(led.vertical.spec)}`);
  if (led.horizontal.count) filling.push(`подсветка ${led.horizontal.where}: ${led.horizontal.count} шт., ${meters(led.horizontal.meters)}${spec(led.horizontal.spec)}`);
  let kind = "Шкаф";
  if (m.kitchen) {
    kind = KITCHEN_ROLE[m.kitchen.role] ?? "Кухонный модуль";
    const app = m.kitchen.appliance && APPLIANCE[m.kitchen.appliance];
    if (app) kind += " " + app;
    // пенал под технику (K1/K2): ниши в мм; сама техника — клиента, в КП не входит (как у нижнего под духовку)
    const col = m.kitchen.column;
    if (col?.kind === "oven") { if (col.mwNiche > 0) kind += " и СВЧ"; filling.push(`ниша духовки ${col.ovenNiche} мм${col.mwNiche > 0 ? `, ниша СВЧ ${col.mwNiche} мм` : ""}`); }
    if (col?.kind === "fridge") filling.push(`ниша встраиваемого холодильника ${col.niche} мм, фасад на двери холодильника`);
    if (m.kitchen.premialPullout) filling.push("выдвижная бутылочница");
    // нижний угловой (kitchenCorner.ts): для клиента — что это угловой и где глухая часть, без служебных подробностей
    const ff = m.kitchen.faceFiller;
    if (ff?.facadeMat && m.kitchen.role === "base") { kind = "Кухонный нижний угловой модуль"; filling.push(`глухая часть ${ff.side === "left" ? "слева" : "справа"}: фальшпанель ${Math.round(ff.width)} мм из материала фасадов`); }
  } else if (m.raw) kind = m.raw.row ? "Столешница и панели" : rawKitchen(m.raw) ? "Кухонный модуль" : "Шкаф";
  else if (m.corner) kind = "Угловой шкаф";
  return { kind, size, materials, filling };
}
