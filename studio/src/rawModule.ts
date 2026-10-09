// «Сырой» модуль: детали проекта Базиса как есть (импорт кухонь и шкафов из базы заказов), для модулей, которые параметрика студии
// пока не воспроизводит деталь-в-деталь (угловые, скошенные, острова, нестандартные наполнения). Панели — коробки в осях модуля
// (X вправо, Y вверх, Z от стены к фасаду, начало — минимальный угол), фурнитура — сетки Базиса (TriData → GLB) по позиции и повороту.
// Раскрой и смета панелей работают как обычно; правила студии (петли, крепёж, полки) к сырому модулю не применяются.
import type { BazisItem, Module, Part } from "./model";

/** fm — деталь из фасадного материала Базиса («Фасадный мат-л N»): не раскрой ЛДСП корпуса, декор фасадов, в смете — фасады поставщика.
 *  edges — кромка Базиса [толщина, длина мм] (edges.len эталона).
 *  kind 'mdf' — плита МДФ Базиса (IDM ETERNO, Evogloss, МДФ ламинированный), kind 'other' без fm — стеновая панель, пластик и т.п.:
 *  не раскрой ЛДСП Lamarty; mat — материал Базиса (смета rawOwnMaterial; столешница и элементы помещения узнаются по нему).
 *  wall — стеновая панель (фартук) Базиса из материала «Стеновая панель» в «Ряду» кухни: изделие поставщика, не лист ЛДСП.
 *  t, lw — собственные толщина и длина×ширина повёрнутой не по осям панели кухни (rawDims).
 *  contour — фигурный контур Базиса в плоскости детали (plane: xz — горизонтальная, xy/yz — вертикальные), в координатах модуля.
 *  obb — деталь повёрнута не на 90°: размеры по своим осям и углы (R = Ry·Rz, как в сцене), box — её габарит в модуле.
 *  skew — повёрнута так, что поворот не выражается (нарисована габаритом); figure — фигурная, но контур не перенесён (габарит)
 *  или перенесён без внутренних вырезов (есть contour).
 *  room — геометрия помещения из проекта Базиса («Бетон»: стены, колонны k08, k19) — не мебель: вне раскроя и сметы (n3-base). */
export type RawPanel = { name: string; kind: string; box: [number, number, number, number, number, number]; facade?: boolean; decor?: string; fm?: boolean; wall?: boolean; edges?: [number, number][]; mat?: string;
  /** толщина материала Базиса, когда габарит детали толще (деталь чуть повёрнута) — раскрой по ней, без отдельного листа «16,7» */
  thick?: number; t?: number; lw?: [number, number];
  contour?: [number, number][]; plane?: "xz" | "xy" | "yz"; obb?: { size: [number, number, number]; ry: number; rz: number }; skew?: boolean; figure?: boolean; room?: true };

/** Размеры детали Базиса по её собственным осям: у повёрнутой — obb.size (габарит в модуле у наклонной полки — не толщина), иначе бокс. */
export function rawSize(p: Pick<RawPanel, "box" | "obb">): [number, number, number] {
  return p.obb ? [...p.obb.size] : [p.box[3] - p.box[0], p.box[4] - p.box[1], p.box[5] - p.box[2]];
}
/** Столешница — только то, что так названо в Базисе: имя детали или материал («Столешница 38 мм», «Столешница 600»).
 *  Толщина не признак: ЛДСП 25/32 мм, наклонная полка, объёмное тело — не столешница (правило Макса: не добавлять того, чего нет в Базисе). */
export const rawIsWorktop = (p: Pick<RawPanel, "name" | "mat">) => /столешн/i.test(p.name) || /столешн/i.test(p.mat ?? "");
/** Элемент помещения в модели Базиса (материал «Стена», «Пол», «Потолок», «Бетон»): не мебель — без раскроя и сметы, только вид. */
export const rawIsRoom = (p: Pick<RawPanel, "mat" | "room">) => !!p.room || /^\s*(стена|пол|потолок|бетон)(?![а-яё])/i.test(p.mat ?? "");
/** Деталь Базиса больше рабочего поля листа (RULES: ЛДСП 2750×1830, ХДФ 2800×2070, поле 10 мм; длина ЛДСП — до 2726, как у гильотины):
 *  в раскрой не идёт (раскрой упал бы целиком — 010, 136, 149, 159, 166), в смете — строка «больше листа» без цены, решение технолога. */
export function rawOversize(p: Pick<RawPanel, "box" | "obb" | "kind" | "t" | "lw">): boolean {
  const s = rawDims(p), hdf = p.kind === "hdf";
  return s[0] > (hdf ? 2780 : 2726) || s[1] > (hdf ? 2050 : 1810);
}
/** Не плитный материал Базиса (пластик, хром, стеновая панель, металл): не раскрой ЛДСП — строка сметы по материалу Базиса, м². */
export const rawIsNonBoard = (p: Pick<RawPanel, "kind" | "fm" | "mat">) => p.kind === "other" && !p.fm && /пластик|хром|[сc]тенов|металл|алюмин/i.test(p.mat ?? "");
/** bbox — габарит сетки Базиса в её локальных осях [x0,y0,z0,x1,y1,z1] (hardware-lib manifest), для проверки пересечений. */
export type RawHardware = { name: string; category: string; mesh?: string | null; pos: [number, number, number]; quat: [number, number, number, number]; bbox?: number[] };
/** Профиль Базиса с однозначным сечением (труба Ø25): центр, ось (единичный вектор по осям модуля), длина. */
export type RawProfile = { name: string; len: number; d: number; pos: [number, number, number]; dir: [number, number, number] };
/** Счётчики фурнитуры Базиса для сметы (вся фурнитура модуля, в т.ч. не показанная в 3D): см. RAW_COUNT_KEYS. */
export type RawCounts = Partial<Record<(typeof RAW_COUNT_KEYS)[number], number>>;
export const RAW_COUNT_KEYS = ["legs", "clips", "hangers", "confirmats", "eccentrics", "shelfHolders", "dowels", "hinges", "lifts", "drawers"] as const;
/** row — объект «Ряд» (столешница, цоколь, панели): не корпус, без «мелочёвки корпуса».
 *  items — фурнитура Базиса, которой нет в counts (направляющие Firmax/Indigo, РАФИКС, сушка, профили, штанга…): строки сметы как в Базисе.
 *  names — названия петель и полкодержателей Базиса с количеством (тип петли и артикул полкодержателя в смете — как в Базисе).
 *  profiles — профили Базиса с однозначным сечением (штанга Ø25 шкафов). */
export type RawSpec = { panels: RawPanel[]; hardware: RawHardware[]; source?: string; counts?: RawCounts; row?: boolean; items?: BazisItem[];
  names?: BazisNames; profiles?: RawProfile[];
  /** Имя крепежа корпуса Базиса, если это не «Конфирмат 7х50» (k33/k34: «Евровинт 6х50») — строка сметы под этим именем (n3-wall). */
  confirmatName?: string };
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
 *  собственным длине/ширине/толщине (t, lw эталона): габарит такой двери 947×261×261 — не «столешница 261 мм»; наклонная полка шкафа —
 *  по obb (rawSize). Без lw, но с толщиной Базиса (thick), деталь под углом в плане (повёрнута вокруг вертикали: угловые двери
 *  и фасады k03, k07, k09) — ширина из габарита и толщины: a = w·cos + t·sin, b = w·sin + t·cos (n3-base). */
export function rawDims(p: Pick<RawPanel, "box" | "obb" | "t" | "lw" | "thick">): [number, number, number] {
  if (p.t && p.lw && p.lw.every((v) => v > 0)) return [Math.max(...p.lw), Math.min(...p.lw), p.t];
  const size = rawSize(p), s = [...size].sort((a, b) => b - a), t = p.thick;
  if (!p.obb && t !== undefined && size[0] > t + 0.5 && size[2] > t + 0.5) {
    // ((a+b)/(w+t))² + ((a−b)/(w−t))² = 2 — бисекция по w в (t, a+b): левая часть убывает с ростом w
    const a = size[0], b = size[2], f = (w: number) => ((a + b) / (w + t)) ** 2 + ((a - b) / (w - t)) ** 2 - 2;
    let lo = t + 1e-6, hi = a + b;
    for (let k = 0; k < 60; k++) { const mid = (lo + hi) / 2; if (f(mid) > 0) lo = mid; else hi = mid; }
    const w = Math.round(((lo + hi) / 2) * 10) / 10, H = size[1];
    return [Math.max(w, H), Math.min(w, H), t];
  }
  return [s[0], s[1], t ?? s[2]];
}
/** Размеры детали сырого модуля для раскроя и сметы (n3-base): длина, ширина, толщина по Базису (rawDims); angled — деталь под углом
 *  в плане; worktop — столешница по имени или толщине Базиса ≥ 26 (не по габариту: габарит угловой двери 261 — не столешница 261 мм),
 *  без контекста модуля — для старых файлов без материала; в смете — rawWorktop. */
export function rawPanelDims(p: RawPanel): { length: number; width: number; thick: number; worktop: boolean; angled: boolean } {
  const [length, width, thick] = rawDims(p), size = rawSize(p);
  const angled = !p.obb && !(p.t && p.lw) && p.thick !== undefined && size[0] > p.thick + 0.5 && size[2] > p.thick + 0.5;
  return { length, width, thick, worktop: rawIsWorktop(p) || (!rawIsRoom(p) && !p.mat && thick >= 26), angled };
}
/** Столешница сырого модуля: названная так в Базисе (имя или материал, rawIsWorktop). У старых файлов кухни Базиса без материала
 *  (импорт до пометки source 'bazis-kitchen') — прежнее правило: толщина ≥ 26. Сырые шкафы и новые кухни — только по имени/материалу. */
export function rawWorktop(p: RawPanel, r: RawSpec, dims = rawDims(p)): boolean {
  return rawIsWorktop(p) || (rawKitchen(r) && r.source !== "bazis-kitchen" && !p.mat && !rawIsRoom(p) && dims[2] >= 26);
}

export function rawParts(m: Module): Part[] {
  const r = m.raw!, out: Part[] = [], kitchenRaw = rawKitchen(r);
  r.panels.forEach((p, i) => {
    const [x0, y0, z0, x1, y1, z1] = p.box, size = rawSize(p);
    const dims = rawDims(p), thin = size.indexOf(Math.min(...size));
    const material: Part["material"] = p.kind === "hdf" ? "hdf" : p.kind === "glass" || p.kind === "mirror" ? "glass" : "board";
    // Столешница — по имени/материалу Базиса (у старых файлов кухни без материала — толщина ≥ 26): стороннее изделие, не раскрой ЛДСП;
    // деталь больше рабочего поля листа — на сращивание, вне карт.
    // Фасадный материал (fm) — изделие поставщика фасадов, не раскрой ЛДСП; декор — фасадов. Стеновая панель «Ряда» кухни (wall) —
    // изделие поставщика, не лист ЛДСП «6 мм» (k07, k15, k19, k21: раньше отдельный лист Lamarty 6 мм, которого в Базисе нет).
    // Деталь «Ряда» нулевой толщины (k33: «З/С AQ LineBox» без материала, толщина 0) — в раскрой Базиса не попадает: не лист «0 мм»;
    // кромка Базиса у неё остаётся в смете. Стена/пол помещения — не мебель.
    // Не плитные материалы Базиса (стеновая панель, пластик, хром…) — не лист ЛДСП Lamarty: вне раскроя (в смете — м² по деталям
    // Базиса). Плита МДФ кухни Базиса — в раскрое своей плитой: декор — из Базиса (импорт), без него — материал Базиса (mat),
    // а не «Белый/Слэйт» Lamarty. Сырые шкафы Базиса — по правилам шкафов.
    const worktop = rawWorktop(p, r, dims), long = material === "glass" ? dims[0] > 2726 : rawOversize(p), wall = !!(p.wall && r.row), flat = !!r.row && dims[2] < 0.5;
    const own = kitchenRaw && rawOwnMaterial(p), room = rawIsRoom(p) || rawIsNonBoard(p);
    out.push({ id: `raw:p${i}`, name: p.name + (rawIsRoom(p) ? " · помещение (не мебель)" : long && !worktop && !p.fm && !wall && !own && !room ? " · больше листа — сращивание" : ""), ...(worktop || long || p.fm || wall || flat || own || room ? { external: true } : {}), size, position: [(x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2], length: dims[0], width: dims[1], thickness: p.thick ?? rawThickness(dims[2]),
      // декор фасадов — у фасадного материала; ЛДСП корпуса спереди (фальшпанель ящика, планка) остаётся в декоре корпуса
      role: p.facade ? "door" : "body", material, decor: p.decor ?? (kitchenRaw && p.kind === "mdf" && p.mat ? p.mat : p.fm || (p.facade && p.kind !== "ldsp") ? m.facadeDecor : m.decor), grain: "length",
      grainAxis: (size.indexOf(Math.max(...size)) === thin ? 1 : size.indexOf(Math.max(...size))) as 0 | 1 | 2, edge: [0, 0, 0, 0] });
    // повёрнутая не на 90° деталь Базиса — ориентированный короб вокруг центра габарита
    if (p.obb) { const q = out[out.length - 1]; if (p.obb.ry) q.rotY = p.obb.ry; if (p.obb.rz) q.rotZ = p.obb.rz; }
    // фигурная деталь (П- и Г-образная столешница, стеновая панель с вырезом): контур Базиса от угла габарита
    else if (p.contour && p.contour.length >= 3 && p.plane) {
      const q = out[out.length - 1], ax: Record<string, [number, number]> = { xz: [0, 2], xy: [0, 1], yz: [1, 2] }, [a, b] = ax[p.plane];
      const rel = p.contour.map(([u, v]) => [u - p.box[a], v - p.box[b]] as [number, number]);
      if (p.plane === "xz" && thin === 1) q.planContour = rel;
      else if ((p.plane === "xy" && thin === 2) || (p.plane === "yz" && thin === 0)) q.faceContour = rel;
    }
  });
  r.hardware.forEach((h, i) => {
    const mesh = h.mesh ?? RAW_FALLBACK_MESH[h.category];
    if (!mesh) return;
    // габарит сетки Базиса по позиции и повороту — для проверки пересечений (без него — точка 10 мм у начала координат сетки)
    const bb = Array.isArray(h.bbox) && h.bbox.length === 6 ? rotatedBox(h.bbox, h.quat, h.pos) : undefined;
    out.push({ id: `raw:h${i}`, name: h.name, size: [10, 10, 10], position: h.pos, length: 10, width: 10, thickness: 10, role: h.category === "петля" ? "hinge" : "fastener", material: "metal", decor: "", grain: "length", grainAxis: 0, edge: [0, 0, 0, 0],
      ...(bb ? { collide: [{ position: [(bb[0] + bb[3]) / 2, (bb[1] + bb[4]) / 2, (bb[2] + bb[5]) / 2] as [number, number, number], size: [bb[3] - bb[0], bb[4] - bb[1], bb[5] - bb[2]] as [number, number, number] }] } : {}),
      model: { file: `hardware/bazis/${mesh}.glb`, length: "y", native: true, origin: h.pos, quat: h.quat } });
  });
  // профили Базиса с однозначным сечением (труба Ø25 — штанга): цилиндр вдоль своей оси; в смете — как штанга D25 студии
  (r.profiles ?? []).forEach((q, i) => {
    const ax = q.dir.findIndex((v) => Math.abs(v) > 0.5);
    if (ax < 0) return;
    out.push({ id: `raw:r${i}`, name: q.name, size: [q.len, q.d, q.d], position: q.pos, length: q.len, width: q.d, thickness: q.d, role: "rod", material: "metal", decor: "", grain: "length", grainAxis: 0, edge: [0, 0, 0, 0],
      // цилиндр сцены лежит вдоль X; вдоль Z — поворот вокруг Y; вертикальный — габарит [d, len, d], сцена ставит его осью Y (rodCylinder)
      ...(ax === 2 ? { rotY: 90 } : ax === 1 ? { size: [q.d, q.len, q.d] as [number, number, number] } : {}) });
  });
  return out;
}

/** Цилиндр штанги/фланца для сцены: студийные лежат вдоль X (size[0] — длина, size[1] — диаметр); вертикальная труба Базиса
 *  (длинная ось — Y) — вдоль Y: радиус size[0]/2, высота size[1]. Иначе труба 1849 мм рисовалась диском Ø1849 (критик 09.10.2026). */
export function rodCylinder(size: [number, number, number]): { r: number; h: number; vertical: boolean } {
  const vertical = size[1] > size[0] && size[1] > size[2];
  return vertical ? { r: size[0] / 2, h: size[1], vertical } : { r: size[1] / 2, h: size[0], vertical };
}

/** Габарит локального бокса [x0,y0,z0,x1,y1,z1] после поворота кватернионом [w,x,y,z] и сдвига. */
function rotatedBox(b: number[], [w, x, y, z]: number[], t: number[]): number[] {
  const R = [1 - 2 * (y * y + z * z), 2 * (x * y - z * w), 2 * (x * z + y * w), 2 * (x * y + z * w), 1 - 2 * (x * x + z * z), 2 * (y * z - x * w), 2 * (x * z - y * w), 2 * (y * z + x * w), 1 - 2 * (x * x + y * y)];
  const mn = [Infinity, Infinity, Infinity], mx = [-Infinity, -Infinity, -Infinity];
  for (const px of [b[0], b[3]]) for (const py of [b[1], b[4]]) for (const pz of [b[2], b[5]]) for (let i = 0; i < 3; i++) {
    const v = R[i * 3] * px + R[i * 3 + 1] * py + R[i * 3 + 2] * pz + t[i]; mn[i] = Math.min(mn[i], v); mx[i] = Math.max(mx[i], v);
  }
  return [...mn, ...mx];
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
      ...(Number(p.t) > 0 && Array.isArray(p.lw) && p.lw.length === 2 && p.lw.every((v) => Number(v) > 0) ? { t: Number(p.t), lw: [Number(p.lw[0]), Number(p.lw[1])] as [number, number] } : {}),
      ...(Array.isArray(p.contour) && p.plane && ["xz", "xy", "yz"].includes(p.plane) ? { contour: p.contour.slice(0, 400).map((c) => [Number(c[0]), Number(c[1])] as [number, number]).filter((c) => c.every(Number.isFinite)), plane: p.plane } : {}),
      ...(p.obb && Array.isArray(p.obb.size) && p.obb.size.length === 3 && [...p.obb.size, p.obb.ry, p.obb.rz].map(Number).every(Number.isFinite) ? { obb: { size: p.obb.size.map(Number) as [number, number, number], ry: Number(p.obb.ry), rz: Number(p.obb.rz) } } : {}),
      ...(p.skew ? { skew: true } : {}), ...(p.figure ? { figure: true } : {}), ...(p.room ? { room: true as const } : {}) })),
    hardware: (Array.isArray(r.hardware) ? r.hardware : []).map((h) => ({ name: String(h.name ?? ""), category: String(h.category ?? ""), mesh: h.mesh ? String(h.mesh) : null, pos: (h.pos ?? [0, 0, 0]).map(Number) as RawHardware["pos"], quat: (h.quat ?? [1, 0, 0, 0]).map(Number) as RawHardware["quat"],
      ...(Array.isArray(h.bbox) && h.bbox.length === 6 && h.bbox.map(Number).every(Number.isFinite) ? { bbox: h.bbox.map(Number) } : {}) })),
    ...(Array.isArray(r.profiles) && r.profiles.length ? { profiles: r.profiles.slice(0, 200).map((q) => ({ name: String(q.name ?? "профиль"), len: Number(q.len), d: Number(q.d), pos: (q.pos ?? [0, 0, 0]).map(Number) as RawProfile["pos"], dir: (q.dir ?? [1, 0, 0]).map(Number) as RawProfile["dir"] }))
      .filter((q) => [q.len, q.d, ...q.pos, ...q.dir].every(Number.isFinite) && q.len > 0 && q.d > 0) } : {}),
    ...(r.source ? { source: String(r.source) } : {}),
    ...(r.counts && typeof r.counts === "object" ? { counts: Object.fromEntries(RAW_COUNT_KEYS.filter((k) => Number.isFinite(Number(r.counts![k])) && Number(r.counts![k]) > 0).map((k) => [k, Math.round(Number(r.counts![k]))])) as RawCounts } : {}),
    ...(r.row ? { row: true } : {}),
    ...(Array.isArray(r.items) ? { items: parseItems(r.items) } : {}),
    ...(r.names && typeof r.names === "object" ? { names: Object.fromEntries((["hinges", "shelfHolders", "slides", "legs"] as const).filter((k) => r.names![k] && typeof r.names![k] === "object")
      .map((k) => [k, Object.fromEntries(Object.entries(r.names![k]!).filter(([, v]) => Number.isFinite(Number(v)) && Number(v) > 0).slice(0, 50).map(([n, v]) => [String(n).slice(0, 200), Math.round(Number(v))]))])) } : {}),
    ...(typeof r.confirmatName === "string" && r.confirmatName.trim() ? { confirmatName: r.confirmatName.trim().slice(0, 80) } : {}),
  };
}
