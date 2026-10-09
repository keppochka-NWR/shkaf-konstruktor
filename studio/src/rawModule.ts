// «Сырой» модуль: детали проекта Базиса как есть (импорт кухонь и шкафов из базы заказов), для модулей, которые параметрика студии
// пока не воспроизводит деталь-в-деталь (угловые, скошенные, острова, нестандартные наполнения). Панели — коробки в осях модуля
// (X вправо, Y вверх, Z от стены к фасаду, начало — минимальный угол), фурнитура — сетки Базиса (TriData → GLB) по позиции и повороту.
// Раскрой и смета панелей работают как обычно; правила студии (петли, крепёж, полки) к сырому модулю не применяются.
import type { Module, Part } from "./model";

/** fm — деталь из фасадного материала Базиса («Фасадный мат-л N»): не раскрой ЛДСП корпуса, декор фасадов, в смете — фасады поставщика.
 *  edges — кромка Базиса [толщина, длина мм] (edges.len эталона).
 *  kind 'mdf' — плита МДФ Базиса (IDM ETERNO, Evogloss, МДФ ламинированный), kind 'other' без fm — стеновая панель, пластик и т.п.:
 *  не раскрой ЛДСП Lamarty; mat — материал Базиса для сметы (rawOwnMaterial). */
export type RawPanel = { name: string; kind: string; box: [number, number, number, number, number, number]; facade?: boolean; decor?: string; fm?: boolean; edges?: [number, number][]; mat?: string;
  /** толщина материала Базиса, когда габарит детали толще (деталь чуть повёрнута) — раскрой по ней, без отдельного листа «16,7» */
  thick?: number };
export type RawHardware = { name: string; category: string; mesh?: string | null; pos: [number, number, number]; quat: [number, number, number, number] };
/** Счётчики фурнитуры Базиса для сметы (вся фурнитура модуля, в т.ч. не показанная в 3D): см. RAW_COUNT_KEYS. */
export type RawCounts = Partial<Record<(typeof RAW_COUNT_KEYS)[number], number>>;
export const RAW_COUNT_KEYS = ["legs", "clips", "hangers", "confirmats", "eccentrics", "shelfHolders", "dowels", "hinges", "lifts", "drawers"] as const;
/** row — объект «Ряд» (столешница, цоколь, панели): не корпус, без «мелочёвки корпуса».
 *  items — прочая фурнитура Базиса, которой нет в counts (rawItems): ключ «компл:<комплект>», «шт:<наименование>», «м:<профиль>». */
export type RawSpec = { panels: RawPanel[]; hardware: RawHardware[]; source?: string; counts?: RawCounts; row?: boolean; items?: Record<string, number> };

/** Сырой модуль КУХНИ Базиса (scripts/kitchen/import.ts): у него есть счётчики фурнитуры Базиса (counts) или это объект «Ряд».
 *  Шкафы из корпуса Базиса (scripts/wardrobe/import.ts, source 'bazis-corpus', без counts) — не кухня: смета и фальши по правилам шкафов. */
export function rawKitchen(r: RawSpec | undefined): boolean {
  return !!r && r.source !== "bazis-corpus" && (!!r.row || r.counts !== undefined);
}
/** Деталь кухни Базиса из своего материала — не ЛДСП Lamarty и не фасадный материал: плита МДФ (kind 'mdf') и прочее (kind 'other'
 *  без «Фасадный мат-л»: стеновая панель, пластик, хром). В раскрой ЛДСП не идёт; в смете — м² материала Базиса (mat). */
export function rawOwnMaterial(p: RawPanel): boolean {
  return p.kind === "mdf" || (p.kind === "other" && !p.fm);
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

/** Прочая фурнитура Базиса для сметы сырого модуля кухни — всё, что не посчитано в rawCounts и не служебное (отверстия, зазоры):
 *  рафиксы, заглушки навесов, ящики и направляющие не Axis PRO (Indigo, Firmax, СТАРТ…), газлифты PD-G, сушки, профили, шурупы.
 *  Считаются физические объекты модели Базиса по наименованию (шт; профиль с длиной — м): в списке эталона деталь вложенного комплекта
 *  повторяется на каждом уровне комплекта — один объект = одно наименование в одной точке (pos). Комплекты Базиса строкой не идут
 *  (вложенность в эталоне не сохранена, «комплект» дал бы двойной счёт) — кроме изделий из безымянных тел моделирования
 *  («Тело по траектории», «Вращение», «Основа»: сушка и т.п.) — они по имени комплекта, один на kitId.
 *  Не входят: служебные (отверстия, зазоры), категории counts, «Петля …», детали ФриФолд (lifts), Axis PRO (drawers — комплект на ящик)
 *  и модели окружения (духовка, розетка, счётчик и т.п. — не фурнитура). */
export function rawItems(hw: { name: string; category: string; kit?: string | null; kitId?: number | null; service?: boolean; length?: number | null; pos?: number[] }[]): Record<string, number> {
  const COUNTED = new Set(["опора", "клипса", "навес", "конфирмат", "эксцентрик", "полкодержатель", "шкант"]);
  const ENV = /^(духовк|розетк|сч[её]тчик|холодильник|варочн|посудомо|вытяжк|микроволн|свч|мойка\b)/i;
  // тела моделирования Базиса без своего наименования (части модели сушки, ручки…): изделие — по имени комплекта, один на kitId
  const BODY = /^(тело по траектории|вращение|выталкивание\s*\d*|основа)$/i;
  const out: Record<string, number> = {}, seen = new Set<string>(), kits = new Map<string, Set<number | string>>();
  hw.forEach((h, i) => {
    const n = (h.name ?? "").trim(), cat = h.category;
    if (h.service || !n || COUNTED.has(cat) || ENV.test(n)) return;
    if ((cat === "петля" || cat === "подъёмник" || cat === "газлифт") && /^петля/i.test(n)) return;
    if (/фрифолд|freefold|axis\s*pro/i.test(n) || /axis\s*pro/i.test(h.kit ?? "")) return;
    if (Array.isArray(h.pos)) { const key = n + "@" + h.pos.map((v) => Math.round(Number(v) * 10) / 10).join(","); if (seen.has(key)) return; seen.add(key); }
    if (BODY.test(n)) { if (h.kit && !ENV.test(h.kit) && !BODY.test(h.kit.trim())) { const s = kits.get(h.kit) ?? new Set(); s.add(h.kitId ?? i); kits.set(h.kit, s); } return; }
    if (cat === "профиль" && Number(h.length) > 0) { out["м:" + n] = Math.round(((out["м:" + n] ?? 0) + Number(h.length) / 1000) * 1000) / 1000; return; }
    out["шт:" + n] = (out["шт:" + n] ?? 0) + 1;
  });
  for (const [k, s] of kits) if (!out["шт:" + k]) out["компл:" + k] = s.size;
  return out;
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

export function rawParts(m: Module): Part[] {
  const r = m.raw!, out: Part[] = [], kitchenRaw = rawKitchen(r);
  r.panels.forEach((p, i) => {
    const [x0, y0, z0, x1, y1, z1] = p.box, size: [number, number, number] = [x1 - x0, y1 - y0, z1 - z0];
    const dims = [...size].sort((a, b) => b - a), thin = size.indexOf(Math.min(...size));
    const material: Part["material"] = p.kind === "hdf" ? "hdf" : p.kind === "glass" || p.kind === "mirror" ? "glass" : "board";
    // Столешница (толщина ≥ 26) — стороннее изделие, не раскрой ЛДСП; деталь длиннее рабочей длины листа — на сращивание, вне карт.
    // Фасадный материал (fm) — изделие поставщика фасадов, не раскрой ЛДСП; декор — фасадов.
    // Плита МДФ и прочие материалы кухни Базиса (стеновая панель, пластик, хром…) — не лист ЛДСП Lamarty: вне раскроя ЛДСП
    // (в смете — м² по деталям Базиса, rawOwnMaterial). Сырые шкафы Базиса — как было (правила шкафов не меняются).
    const worktop = /столешн/i.test(p.name) || dims[2] >= 26, long = dims[0] > 2726, mdf = kitchenRaw && rawOwnMaterial(p);
    out.push({ id: `raw:p${i}`, name: p.name + (long && !worktop && !p.fm && !mdf ? " · длиннее листа — сращивание" : ""), ...(worktop || long || p.fm || mdf ? { external: true } : {}), size, position: [(x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2], length: dims[0], width: dims[1], thickness: p.thick ?? rawThickness(dims[2]),
      // декор фасадов — у фасадного материала; ЛДСП корпуса спереди (фальшпанель ящика, планка) остаётся в декоре корпуса
      role: p.facade ? "door" : "body", material, decor: p.decor ?? (p.fm || (p.facade && p.kind !== "ldsp") ? m.facadeDecor : m.decor), grain: "length",
      grainAxis: (size.indexOf(dims[0]) === thin ? 1 : size.indexOf(dims[0])) as 0 | 1 | 2, edge: [0, 0, 0, 0] });
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

export function parseRaw(x: unknown): RawSpec | undefined {
  const r = x as RawSpec;
  if (!r || typeof r !== "object" || !Array.isArray(r.panels)) return undefined;
  return {
    panels: r.panels.map((p) => ({ name: String(p.name ?? "деталь"), kind: String(p.kind ?? "ldsp"), box: (p.box ?? []).map(Number) as RawPanel["box"], ...(p.facade ? { facade: true } : {}), ...(p.decor ? { decor: String(p.decor) } : {}), ...(p.fm ? { fm: true } : {}),
      ...(Array.isArray(p.edges) && p.edges.length ? { edges: p.edges.filter((e) => Array.isArray(e) && e.length === 2).map((e) => [Number(e[0]), Number(e[1])] as [number, number]).filter((e) => e.every(Number.isFinite)) } : {}),
      ...(p.mat ? { mat: String(p.mat).slice(0, 120) } : {}), ...(Number(p.thick) > 0 ? { thick: Number(p.thick) } : {}) })),
    hardware: (Array.isArray(r.hardware) ? r.hardware : []).map((h) => ({ name: String(h.name ?? ""), category: String(h.category ?? ""), mesh: h.mesh ? String(h.mesh) : null, pos: (h.pos ?? [0, 0, 0]).map(Number) as RawHardware["pos"], quat: (h.quat ?? [1, 0, 0, 0]).map(Number) as RawHardware["quat"] })),
    ...(r.source ? { source: String(r.source) } : {}),
    ...(r.counts && typeof r.counts === "object" ? { counts: Object.fromEntries(RAW_COUNT_KEYS.filter((k) => Number.isFinite(Number(r.counts![k])) && Number(r.counts![k]) > 0).map((k) => [k, Math.round(Number(r.counts![k]))])) as RawCounts } : {}),
    ...(r.row ? { row: true } : {}),
    ...(r.items && typeof r.items === "object" ? { items: Object.fromEntries(Object.entries(r.items).slice(0, 300).filter(([k, v]) => /^(компл|шт|м):/.test(k) && Number.isFinite(Number(v)) && Number(v) > 0).map(([k, v]) => [k.slice(0, 200), Number(v)])) } : {}),
  };
}
