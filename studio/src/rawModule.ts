// «Сырой» модуль: детали проекта Базиса как есть (импорт кухонь и шкафов из базы заказов), для модулей, которые параметрика студии
// пока не воспроизводит деталь-в-деталь (угловые, скошенные, острова, нестандартные наполнения). Панели — коробки в осях модуля
// (X вправо, Y вверх, Z от стены к фасаду, начало — минимальный угол), фурнитура — сетки Базиса (TriData → GLB) по позиции и повороту.
// Раскрой и смета панелей работают как обычно; правила студии (петли, крепёж, полки) к сырому модулю не применяются.
import type { BazisItem, Module, Part } from "./model";

/** fm — деталь из фасадного материала Базиса («Фасадный мат-л N»): не раскрой ЛДСП корпуса, декор фасадов, в смете — фасады поставщика.
 *  edges — кромка Базиса [толщина, длина мм] (edges.len эталона).
 *  kind 'mdf' — плита МДФ Базиса (IDM ETERNO, Evogloss, МДФ ламинированный), kind 'other' без fm — стеновая панель, пластик и т.п.:
 *  не раскрой ЛДСП Lamarty; mat — материал Базиса для сметы (rawOwnMaterial).
 *  wall — стеновая панель (фартук) Базиса из материала «Стеновая панель» в «Ряду» кухни: изделие поставщика, не лист ЛДСП.
 *  t, lw — собственные толщина и длина×ширина повёрнутой не по осям панели (rawDims). */
export type RawPanel = { name: string; kind: string; box: [number, number, number, number, number, number]; facade?: boolean; decor?: string; fm?: boolean; wall?: boolean; edges?: [number, number][]; mat?: string;
  /** толщина материала Базиса, когда габарит детали толще (деталь чуть повёрнута) — раскрой по ней, без отдельного листа «16,7» */
  thick?: number; t?: number; lw?: [number, number] };
export type RawHardware = { name: string; category: string; mesh?: string | null; pos: [number, number, number]; quat: [number, number, number, number] };
/** Счётчики фурнитуры Базиса для сметы (вся фурнитура модуля, в т.ч. не показанная в 3D): см. RAW_COUNT_KEYS. */
export type RawCounts = Partial<Record<(typeof RAW_COUNT_KEYS)[number], number>>;
export const RAW_COUNT_KEYS = ["legs", "clips", "hangers", "confirmats", "eccentrics", "shelfHolders", "dowels", "hinges", "lifts", "drawers"] as const;
/** row — объект «Ряд» (столешница, цоколь, панели): не корпус, без «мелочёвки корпуса».
 *  items — фурнитура Базиса, которой нет в counts (направляющие Firmax/Indigo, РАФИКС, сушка, профили, штанга…): строки сметы как в Базисе.
 *  names — названия петель и полкодержателей Базиса с количеством (тип петли и артикул полкодержателя в смете — как в Базисе). */
export type RawSpec = { panels: RawPanel[]; hardware: RawHardware[]; source?: string; counts?: RawCounts; row?: boolean; items?: BazisItem[];
  names?: BazisNames };
/** Названия Базиса с количеством: петли, полкодержатели, направляющие Firmax (артикул «L - 500» — длина направляющей, не короба). */
export type BazisNames = { hinges?: Record<string, number>; shelfHolders?: Record<string, number>; slides?: Record<string, number>; legs?: Record<string, number> };

/** Сырой модуль КУХНИ Базиса (scripts/kitchen/import.ts): помечен source 'bazis-kitchen', у него есть счётчики фурнитуры Базиса
 *  (counts — ранние импорты без пометки) или это объект «Ряд».
 *  Шкафы из корпуса Базиса (scripts/wardrobe/import.ts, source 'bazis-corpus', без counts) — не кухня: смета и фальши по правилам шкафов. */
export function rawKitchen(r: RawSpec | undefined): boolean {
  return !!r && r.source !== "bazis-corpus" && (r.source === "bazis-kitchen" || !!r.row || r.counts !== undefined);
}
/** Деталь кухни Базиса из своего не плитного материала — не ЛДСП/МДФ и не фасадный материал: kind 'other' без «Фасадный мат-л»
 *  (стеновая панель, пластик, хром). В раскрой не идёт; в смете — м² материала Базиса (mat).
 *  Плита МДФ (kind 'mdf') — в раскрое своей плитой с декором/материалом Базиса («Плита 18 мм · IDM ETERNO Libra»), не лист Lamarty. */
export function rawOwnMaterial(p: RawPanel): boolean {
  return p.kind === "other" && !p.fm;
}

/** Служебные объекты Базиса без изделия (отверстия, тела, зазоры, счётчики, розетки, стена, логотипы) и безымянные размеры («3x3», «8»). */
const NOT_PRODUCT = /^(отверстие|тело по траектории|зазор|сч[её]тчик|розетка|стена|logo|выталкивание|вращение|духовка|передняя панель|основа$|профиль\d*$)/i;
const DIMS_ONLY = /^[\d\s.,xх×]*$/i;
/** Модели окружения в списке фурнитуры Базиса (техника, мойка) — не фурнитура. */
const ENV = /^(духовк|розетк|сч[её]тчик|холодильник|варочн|посудомо|вытяжк|микроволн|свч|мойка\b)/i;
/** Тела моделирования Базиса без своего наименования (части модели сушки, ручки…): изделие — по имени комплекта, один на kitId. */
const BODY = /^(тело по траектории|вращение|выталкивание\s*\d*|основа)$/i;
/** Категории, которые смета считает отдельно (counts / параметрика): опоры, клипсы, навесы, конфирматы, эксцентрики, полкодержатели,
 *  шканты, петли и детали ФриФолд (комплект подъёмника). */
const COUNTED = new Set(["опора", "клипса", "навес", "конфирмат", "эксцентрик", "полкодержатель", "шкант", "петля"]);
/** Фурнитура Базиса для сметы по названию, кроме посчитанной отдельно: skip — что ещё покрыто (Axis PRO, Firmax, газлифт параметрики).
 *  Изделие из безымянных тел моделирования («Вращение», «Тело по траектории»: сушка k08 и т. п.) — по имени комплекта, одно на kitId,
 *  если изделия с таким наименованием в списке нет. Детали ФриФолд (lifts) и модели окружения (техника, мойка) — не фурнитура. */
export function bazisItems(hw: { name: string; category: string; length?: number | null; mat?: string | null; kit?: string | null; kitId?: number | null; service?: boolean }[], skip: (h: { name: string; category: string }) => boolean = () => false): BazisItem[] {
  const out = new Map<string, BazisItem>(), kits = new Map<string, { category: string; ids: Set<number | string> }>();
  hw.forEach((h, i) => {
    const own = (h.name ?? "").trim();
    if (BODY.test(own)) {
      const kit = (h.kit ?? "").trim();
      if (kit && !ENV.test(kit) && !BODY.test(kit) && !NOT_PRODUCT.test(kit) && !/фрифолд|freefold|axis\s*pro/i.test(kit) && !skip({ name: kit, category: h.category })) {
        const k = kits.get(kit) ?? { category: /сушк/i.test(kit) ? "сушка" : h.category ?? "", ids: new Set() }; k.ids.add(h.kitId ?? i); kits.set(kit, k);
      }
      return;
    }
    // «Профиль»/«Профиль1» — имя элемента Базиса, изделие — в материале («Профиль врезной для верхних баз…», «KB 91 MODUS»);
    // с материалом-цветом («Хром», «Белый», «Пластик…») — это части моделей техники (вытяжка, холодильник), не фурнитура
    const generic = /^профиль\d*$/i.test(own), mat = (h.mat ?? "").trim();
    const name = generic && /профиль/i.test(mat) ? mat : own, cat = h.category ?? "";
    if (h.service || !name || COUNTED.has(cat) || NOT_PRODUCT.test(name) || DIMS_ONLY.test(name) || ENV.test(name) || /фрифолд|freefold/i.test(name) || skip(h)) return;
    const key = cat + "|" + name, it = out.get(key) ?? { name, category: cat, n: 0 };
    it.n++;
    // длина — только у профилей и трубы-штанги (у направляющих «length» Базиса — не погонаж, считаем штуками)
    if ((cat === "профиль" || /труба/i.test(name)) && Number.isFinite(h.length) && (h.length ?? 0) > 0) it.len = Math.round(((it.len ?? 0) + h.length!) * 10) / 10;
    out.set(key, it);
  });
  for (const [kit, k] of kits) if (![...out.values()].some((it) => it.name === kit)) out.set(k.category + "|" + kit, { name: kit, category: k.category, n: k.ids.size });
  return [...out.values()];
}
/** Названия петель («Петля …») и полкодержателей Базиса с количеством. */
export function bazisNames(hw: { name: string; category: string }[]): BazisNames {
  const hinges: Record<string, number> = {}, shelfHolders: Record<string, number> = {}, slides: Record<string, number> = {}, legs: Record<string, number> = {};
  for (const h of hw) {
    const n = (h.name ?? "").trim();
    if (h.category === "опора" && n) legs[n] = (legs[n] ?? 0) + 1;
    if ((h.category === "петля" || h.category === "подъёмник" || h.category === "газлифт") && /^петля/i.test(n)) hinges[n] = (hinges[n] ?? 0) + 1;
    if (h.category === "полкодержатель") shelfHolders[n || "Полкодержатель"] = (shelfHolders[n || "Полкодержатель"] ?? 0) + 1;
    if (h.category === "направляющая" && /firmax/i.test(n)) slides[n] = (slides[n] ?? 0) + 1;
  }
  return { ...(Object.keys(hinges).length ? { hinges } : {}), ...(Object.keys(shelfHolders).length ? { shelfHolders } : {}), ...(Object.keys(slides).length ? { slides } : {}), ...(Object.keys(legs).length ? { legs } : {}) };
}

/** Счётчики фурнитуры по списку Базиса: петли — только «Петля …» (детали ФриФолд в Базисе тоже в категории «петля»),
 *  подъёмник — пара механизмов ФриФолд/подъёмника на комплект, ящик Axis PRO — пара держателей фасада на ящик. */
export function rawCounts(hw: { name: string; category: string }[]): RawCounts {
  const c: Record<string, number> = {};
  const inc = (k: string, n = 1) => { c[k] = (c[k] ?? 0) + n; };
  let mech = 0, holders = 0;
  for (const h of hw) {
    const cat = h.category, n = h.name;
    if (cat === "опора") inc("legs");
    else if (cat === "клипса") inc("clips");
    else if (cat === "навес") inc("hangers");
    else if (cat === "конфирмат") inc("confirmats");
    else if (cat === "эксцентрик") inc("eccentrics");
    else if (cat === "полкодержатель") inc("shelfHolders");
    else if (cat === "шкант") inc("dowels");
    if ((cat === "петля" || cat === "подъёмник" || cat === "газлифт") && /^петля/i.test(n.trim())) inc("hinges");
    if ((cat === "петля" || cat === "подъёмник" || cat === "газлифт") && /механизм/i.test(n) && /фрифолд|freefold|подъ|lift/i.test(n)) mech++;
    if (/axis\s*pro/i.test(n) && /держ\.?\s*фасада/i.test(n)) holders++;
  }
  if (mech) c.lifts = Math.ceil(mech / 2);
  if (holders) c.drawers = Math.ceil(holders / 2);
  return c as RawCounts;
}

/** Толщина детали Базиса: дробные хвосты бокса (16.0999999) — целые мм, иначе раскрой заводит отдельный лист «16.1». */
export function rawThickness(t: number): number {
  return Math.abs(t - Math.round(t)) <= 0.2 ? Math.round(t) : Math.round(t * 10) / 10;
}

/** Сетки фурнитуры, которые есть в studio/public/models/hardware/bazis (заполняется при импорте: rawMeshes.json). */
export const RAW_FALLBACK_MESH: Record<string, string> = {
  петля: "d7e1d3957ebe", // у базовой «Петли накладной» Базиса сетки нет — плечо GTV ECHC в тех же осях
  конфирмат: "f660d89fba1a",
  полкодержатель: "4b95caf1da2f",
  опора: "ac675db9fc57",
  клипса: "0d12888fb9df",
};

/** Размеры детали [длина, ширина, толщина] по убыванию. Повёрнутая не по осям панель Базиса (угловая дверь под 45°) — по её
 *  собственным длине/ширине/толщине (t, lw эталона): габарит такой двери 947×261×261 — не «столешница 261 мм». */
export function rawDims(p: RawPanel): [number, number, number] {
  if (p.t && p.lw && p.lw.every((v) => v > 0)) return [Math.max(...p.lw), Math.min(...p.lw), p.t];
  const s = [p.box[3] - p.box[0], p.box[4] - p.box[1], p.box[5] - p.box[2]].sort((a, b) => b - a);
  return [s[0], s[1], s[2]];
}

export function rawParts(m: Module): Part[] {
  const r = m.raw!, out: Part[] = [], kitchenRaw = rawKitchen(r);
  r.panels.forEach((p, i) => {
    const [x0, y0, z0, x1, y1, z1] = p.box, size: [number, number, number] = [x1 - x0, y1 - y0, z1 - z0];
    const dims = rawDims(p), thin = size.indexOf(Math.min(...size));
    const material: Part["material"] = p.kind === "hdf" ? "hdf" : p.kind === "glass" || p.kind === "mirror" ? "glass" : "board";
    // Столешница (толщина ≥ 26) — стороннее изделие, не раскрой ЛДСП; деталь длиннее рабочей длины листа — на сращивание, вне карт.
    // Фасадный материал (fm) — изделие поставщика фасадов, не раскрой ЛДСП; декор — фасадов. Стеновая панель «Ряда» кухни (wall) —
    // изделие поставщика, не лист ЛДСП «6 мм» (k07, k15, k19, k21: раньше отдельный лист Lamarty 6 мм, которого в Базисе нет).
    // Деталь «Ряда» нулевой толщины (k33: «З/С AQ LineBox» без материала, толщина 0) — в раскрой Базиса не попадает: не лист «0 мм»;
    // кромка Базиса у неё остаётся в смете.
    // Не плитные материалы кухни Базиса (стеновая панель, пластик, хром…) — не лист ЛДСП Lamarty: вне раскроя (в смете — м² по деталям
    // Базиса, rawOwnMaterial). Плита МДФ кухни Базиса — в раскрое своей плитой: декор — из Базиса (импорт), без него — материал Базиса
    // (mat), а не «Белый/Слэйт» Lamarty. Сырые шкафы Базиса — как было (правила шкафов не меняются).
    const worktop = /столешн/i.test(p.name) || dims[2] >= 26, long = dims[0] > 2726, wall = !!(p.wall && r.row), flat = !!r.row && dims[2] < 0.5, own = kitchenRaw && rawOwnMaterial(p);
    out.push({ id: `raw:p${i}`, name: p.name + (long && !worktop && !p.fm && !wall && !own ? " · длиннее листа — сращивание" : ""), ...(worktop || long || p.fm || wall || flat || own ? { external: true } : {}), size, position: [(x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2], length: dims[0], width: dims[1], thickness: p.thick ?? rawThickness(dims[2]),
      // декор фасадов — у фасадного материала; ЛДСП корпуса спереди (фальшпанель ящика, планка) остаётся в декоре корпуса
      role: p.facade ? "door" : "body", material, decor: p.decor ?? (kitchenRaw && p.kind === "mdf" && p.mat ? p.mat : p.fm || (p.facade && p.kind !== "ldsp") ? m.facadeDecor : m.decor), grain: "length",
      grainAxis: (size.indexOf(Math.max(...size)) === thin ? 1 : size.indexOf(Math.max(...size))) as 0 | 1 | 2, edge: [0, 0, 0, 0] });
  });
  r.hardware.forEach((h, i) => {
    const mesh = h.mesh ?? RAW_FALLBACK_MESH[h.category];
    if (!mesh) return;
    out.push({ id: `raw:h${i}`, name: h.name, size: [10, 10, 10], position: h.pos, length: 10, width: 10, thickness: 10, role: h.category === "петля" ? "hinge" : "fastener", material: "metal", decor: "", grain: "length", grainAxis: 0, edge: [0, 0, 0, 0],
      model: { file: `hardware/bazis/${mesh}.glb`, length: "y", native: true, origin: h.pos, quat: h.quat } });
  });
  return out;
}

export function rawErrors(m: Module): string[] {
  const r = m.raw;
  if (!r || !Array.isArray(r.panels) || !Array.isArray(r.hardware)) return ["Сырой модуль: нет списка деталей."];
  if (r.panels.length > 600) return ["Сырой модуль: больше 600 панелей."];
  for (const p of r.panels) if (!Array.isArray(p.box) || p.box.length !== 6 || p.box.some((v) => !Number.isFinite(v)) || p.box[3] < p.box[0] || p.box[4] < p.box[1] || p.box[5] < p.box[2]) return [`Сырой модуль: неверная деталь «${p.name}».`];
  return [];
}

export function parseItems(x: unknown): BazisItem[] {
  if (!Array.isArray(x)) return [];
  return x.slice(0, 400).filter((i) => i && typeof i === "object" && typeof i.name === "string" && Number.isFinite(Number(i.n)) && Number(i.n) > 0)
    .map((i) => ({ name: String(i.name).slice(0, 200), category: String(i.category ?? ""), n: Math.round(Number(i.n)), ...(Number.isFinite(Number(i.len)) && Number(i.len) > 0 ? { len: Number(i.len) } : {}) }));
}
export function parseRaw(x: unknown): RawSpec | undefined {
  const r = x as RawSpec;
  if (!r || typeof r !== "object" || !Array.isArray(r.panels)) return undefined;
  return {
    panels: r.panels.map((p) => ({ name: String(p.name ?? "деталь"), kind: String(p.kind ?? "ldsp"), box: (p.box ?? []).map(Number) as RawPanel["box"], ...(p.facade ? { facade: true } : {}), ...(p.decor ? { decor: String(p.decor) } : {}), ...(p.fm ? { fm: true } : {}), ...(p.wall ? { wall: true } : {}),
      ...(Array.isArray(p.edges) && p.edges.length ? { edges: p.edges.filter((e) => Array.isArray(e) && e.length === 2).map((e) => [Number(e[0]), Number(e[1])] as [number, number]).filter((e) => e.every(Number.isFinite)) } : {}),
      ...(p.mat ? { mat: String(p.mat).slice(0, 120) } : {}), ...(Number(p.thick) > 0 ? { thick: Number(p.thick) } : {}),
      ...(Number(p.t) > 0 && Array.isArray(p.lw) && p.lw.length === 2 && p.lw.every((v) => Number(v) > 0) ? { t: Number(p.t), lw: [Number(p.lw[0]), Number(p.lw[1])] as [number, number] } : {}) })),
    hardware: (Array.isArray(r.hardware) ? r.hardware : []).map((h) => ({ name: String(h.name ?? ""), category: String(h.category ?? ""), mesh: h.mesh ? String(h.mesh) : null, pos: (h.pos ?? [0, 0, 0]).map(Number) as RawHardware["pos"], quat: (h.quat ?? [1, 0, 0, 0]).map(Number) as RawHardware["quat"] })),
    ...(r.source ? { source: String(r.source) } : {}),
    ...(r.counts && typeof r.counts === "object" ? { counts: Object.fromEntries(RAW_COUNT_KEYS.filter((k) => Number.isFinite(Number(r.counts![k])) && Number(r.counts![k]) > 0).map((k) => [k, Math.round(Number(r.counts![k]))])) as RawCounts } : {}),
    ...(r.row ? { row: true } : {}),
    ...(Array.isArray(r.items) ? { items: parseItems(r.items) } : {}),
    ...(r.names && typeof r.names === "object" ? { names: Object.fromEntries((["hinges", "shelfHolders", "slides", "legs"] as const).filter((k) => r.names![k] && typeof r.names![k] === "object")
      .map((k) => [k, Object.fromEntries(Object.entries(r.names![k]!).filter(([, v]) => Number.isFinite(Number(v)) && Number(v) > 0).slice(0, 50).map(([n, v]) => [String(n).slice(0, 200), Math.round(Number(v))]))])) } : {}),
  };
}
