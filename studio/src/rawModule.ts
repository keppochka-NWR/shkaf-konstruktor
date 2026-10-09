// «Сырой» модуль: детали проекта Базиса как есть (импорт кухонь и шкафов из базы заказов), для модулей, которые параметрика студии
// пока не воспроизводит деталь-в-деталь (угловые, скошенные, острова, нестандартные наполнения). Панели — коробки в осях модуля
// (X вправо, Y вверх, Z от стены к фасаду, начало — минимальный угол), фурнитура — сетки Базиса (TriData → GLB) по позиции и повороту.
// Раскрой и смета панелей работают как обычно; правила студии (петли, крепёж, полки) к сырому модулю не применяются.
import type { Module, Part } from "./model";

/** fm — деталь из фасадного материала Базиса («Фасадный мат-л N»): не раскрой ЛДСП корпуса, декор фасадов, в смете — фасады поставщика.
 *  edges — кромка Базиса [толщина, длина мм] (edges.len эталона). */
/** thick — толщина детали по Базису, если габарит её не показывает (деталь под углом: угловая дверь 261×917×261 при 18 мм);
 *  room — геометрия помещения из проекта Базиса («Бетон»: стены, колонны k08, k19) — не мебель: вне раскроя и сметы. */
export type RawPanel = { name: string; kind: string; box: [number, number, number, number, number, number]; facade?: boolean; decor?: string; fm?: boolean; edges?: [number, number][]; thick?: number; room?: true };
export type RawHardware = { name: string; category: string; mesh?: string | null; pos: [number, number, number]; quat: [number, number, number, number] };
/** Счётчики фурнитуры Базиса для сметы (вся фурнитура модуля, в т.ч. не показанная в 3D): см. RAW_COUNT_KEYS. */
export type RawCounts = Partial<Record<(typeof RAW_COUNT_KEYS)[number], number>>;
export const RAW_COUNT_KEYS = ["legs", "clips", "hangers", "confirmats", "eccentrics", "shelfHolders", "dowels", "hinges", "lifts", "drawers"] as const;
/** row — объект «Ряд» (столешница, цоколь, панели): не корпус, без «мелочёвки корпуса». */
export type RawSpec = { panels: RawPanel[]; hardware: RawHardware[]; source?: string; counts?: RawCounts; row?: boolean };

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

/** Размеры детали сырого модуля для раскроя и сметы: длина, ширина, толщина по Базису. Деталь под углом в плане (повёрнута вокруг
 *  вертикали: угловые двери и фасады k03, k07, k09) — ширина из габарита и толщины: a = w·cos + t·sin, b = w·sin + t·cos.
 *  worktop — столешница (по имени или толщине ≥ 26 по Базису, не по габариту: габарит угловой двери 261 — не столешница 261 мм). */
export function rawPanelDims(p: RawPanel): { length: number; width: number; thick: number; worktop: boolean; angled: boolean } {
  const size = [p.box[3] - p.box[0], p.box[4] - p.box[1], p.box[5] - p.box[2]], dims = [...size].sort((a, b) => b - a);
  const t = p.thick ?? dims[2], a = size[0], b = size[2];
  const angled = p.thick !== undefined && a > t + 0.5 && b > t + 0.5;
  let length = dims[0], width = dims[1];
  if (angled) {
    // ((a+b)/(w+t))² + ((a−b)/(w−t))² = 2 — бисекция по w в (t, a+b): левая часть убывает с ростом w
    const f = (w: number) => ((a + b) / (w + t)) ** 2 + ((a - b) / (w - t)) ** 2 - 2;
    let lo = t + 1e-6, hi = a + b;
    for (let k = 0; k < 60; k++) { const mid = (lo + hi) / 2; if (f(mid) > 0) lo = mid; else hi = mid; }
    const w = Math.round(((lo + hi) / 2) * 10) / 10, H = size[1];
    length = Math.max(w, H); width = Math.min(w, H);
  }
  return { length, width, thick: t, worktop: /столешн/i.test(p.name) || (!p.room && t >= 26), angled };
}

export function rawParts(m: Module): Part[] {
  const r = m.raw!, out: Part[] = [];
  r.panels.forEach((p, i) => {
    const [x0, y0, z0, x1, y1, z1] = p.box, size: [number, number, number] = [x1 - x0, y1 - y0, z1 - z0];
    const dims = [...size].sort((a, b) => b - a), thin = size.indexOf(Math.min(...size));
    const material: Part["material"] = p.kind === "hdf" ? "hdf" : p.kind === "glass" || p.kind === "mirror" ? "glass" : "board";
    // Столешница (толщина ≥ 26 по Базису) — стороннее изделие, не раскрой ЛДСП; деталь длиннее рабочей длины листа — на сращивание, вне карт.
    // Фасадный материал (fm) — изделие поставщика фасадов, не раскрой ЛДСП; декор — фасадов. Помещение («Бетон») — не мебель, вне раскроя.
    const pd = rawPanelDims(p), worktop = pd.worktop, long = pd.length > 2726;
    out.push({ id: `raw:p${i}`, name: p.name + (p.room ? " · помещение (не мебель)" : long && !worktop && !p.fm ? " · длиннее листа — сращивание" : ""), ...(worktop || long || p.fm || p.room ? { external: true } : {}), size, position: [(x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2], length: pd.length, width: pd.width, thickness: rawThickness(pd.thick),
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
      ...(Number.isFinite(Number(p.thick)) && Number(p.thick) > 0 ? { thick: Number(p.thick) } : {}), ...(p.room ? { room: true as const } : {}),
      ...(Array.isArray(p.edges) && p.edges.length ? { edges: p.edges.filter((e) => Array.isArray(e) && e.length === 2).map((e) => [Number(e[0]), Number(e[1])] as [number, number]).filter((e) => e.every(Number.isFinite)) } : {}) })),
    hardware: (Array.isArray(r.hardware) ? r.hardware : []).map((h) => ({ name: String(h.name ?? ""), category: String(h.category ?? ""), mesh: h.mesh ? String(h.mesh) : null, pos: (h.pos ?? [0, 0, 0]).map(Number) as RawHardware["pos"], quat: (h.quat ?? [1, 0, 0, 0]).map(Number) as RawHardware["quat"] })),
    ...(r.source ? { source: String(r.source) } : {}),
    ...(r.counts && typeof r.counts === "object" ? { counts: Object.fromEntries(RAW_COUNT_KEYS.filter((k) => Number.isFinite(Number(r.counts![k])) && Number(r.counts![k]) > 0).map((k) => [k, Math.round(Number(r.counts![k]))])) as RawCounts } : {}),
    ...(r.row ? { row: true } : {}),
  };
}
