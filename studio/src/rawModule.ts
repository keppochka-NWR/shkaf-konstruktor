// «Сырой» модуль: детали проекта Базиса как есть (импорт кухонь и шкафов из базы заказов), для модулей, которые параметрика студии
// пока не воспроизводит деталь-в-деталь (угловые, скошенные, острова, нестандартные наполнения). Панели — коробки в осях модуля
// (X вправо, Y вверх, Z от стены к фасаду, начало — минимальный угол), фурнитура — сетки Базиса (TriData → GLB) по позиции и повороту.
// Раскрой и смета панелей работают как обычно; правила студии (петли, крепёж, полки) к сырому модулю не применяются.
import type { Module, Part } from "./model";

/** fm — деталь из фасадного материала Базиса («Фасадный мат-л N»): не раскрой ЛДСП корпуса, декор фасадов, в смете — фасады поставщика.
 *  edges — кромка Базиса [толщина, длина мм] (edges.len эталона).
 *  contour — фигурный контур Базиса в плоскости детали (plane: xz — горизонтальная, xy/yz — вертикальные), в координатах модуля.
 *  obb — деталь повёрнута не на 90°: размеры по своим осям и углы (R = Ry·Rz, как в сцене), box — её габарит в модуле.
 *  skew — повёрнута так, что поворот не выражается (нарисована габаритом); figure — фигурная, но контур не перенесён (габарит). */
export type RawPanel = { name: string; kind: string; box: [number, number, number, number, number, number]; facade?: boolean; decor?: string; fm?: boolean; edges?: [number, number][]; contour?: [number, number][]; plane?: "xz" | "xy" | "yz";
  obb?: { size: [number, number, number]; ry: number; rz: number }; skew?: boolean; figure?: boolean; mat?: string };

/** Размеры детали Базиса по её собственным осям: у повёрнутой — obb.size (габарит в модуле у наклонной полки — не толщина), иначе бокс. */
export function rawSize(p: Pick<RawPanel, "box" | "obb">): [number, number, number] {
  return p.obb ? [...p.obb.size] : [p.box[3] - p.box[0], p.box[4] - p.box[1], p.box[5] - p.box[2]];
}
/** Столешница — только то, что так названо в Базисе: имя детали или материал («Столешница 38 мм», «Столешница 600»).
 *  Толщина не признак: ЛДСП 25/32 мм, наклонная полка, объёмное тело — не столешница (правило Макса: не добавлять того, чего нет в Базисе). */
export const rawIsWorktop = (p: Pick<RawPanel, "name" | "mat">) => /столешн/i.test(p.name) || /столешн/i.test(p.mat ?? "");
/** Элемент помещения в модели Базиса (материал «Стена», «Пол», «Потолок», «Бетон»): не мебель — без раскроя и сметы, только вид. */
export const rawIsRoom = (p: Pick<RawPanel, "mat">) => /^\s*(стена|пол|потолок|бетон)(?![а-яё])/i.test(p.mat ?? "");
/** bbox — габарит сетки Базиса в её локальных осях [x0,y0,z0,x1,y1,z1] (hardware-lib manifest), для проверки пересечений. */
export type RawHardware = { name: string; category: string; mesh?: string | null; pos: [number, number, number]; quat: [number, number, number, number]; bbox?: number[] };
/** Профиль Базиса с однозначным сечением (труба Ø25): центр, ось (единичный вектор по осям модуля), длина. */
export type RawProfile = { name: string; len: number; d: number; pos: [number, number, number]; dir: [number, number, number] };
/** Счётчики фурнитуры Базиса для сметы (вся фурнитура модуля, в т.ч. не показанная в 3D): см. RAW_COUNT_KEYS. */
export type RawCounts = Partial<Record<(typeof RAW_COUNT_KEYS)[number], number>>;
export const RAW_COUNT_KEYS = ["legs", "clips", "hangers", "confirmats", "eccentrics", "shelfHolders", "dowels", "hinges", "lifts", "drawers"] as const;
/** row — объект «Ряд» (столешница, цоколь, панели): не корпус, без «мелочёвки корпуса». */
export type RawSpec = { panels: RawPanel[]; hardware: RawHardware[]; source?: string; counts?: RawCounts; row?: boolean; profiles?: RawProfile[] };

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

export function rawParts(m: Module): Part[] {
  const r = m.raw!, out: Part[] = [];
  r.panels.forEach((p, i) => {
    const [x0, y0, z0, x1, y1, z1] = p.box, size = rawSize(p);
    const dims = [...size].sort((a, b) => b - a), thin = size.indexOf(Math.min(...size));
    const material: Part["material"] = p.kind === "hdf" ? "hdf" : p.kind === "glass" || p.kind === "mirror" ? "glass" : "board";
    // Столешница (по имени/материалу Базиса) — стороннее изделие, не раскрой ЛДСП; деталь длиннее рабочей длины листа — на сращивание, вне карт.
    // Фасадный материал (fm) — изделие поставщика фасадов, не раскрой ЛДСП; декор — фасадов. Стена/пол помещения — не мебель.
    const worktop = rawIsWorktop(p), room = rawIsRoom(p), long = dims[0] > 2726;
    out.push({ id: `raw:p${i}`, name: p.name + (long && !worktop && !p.fm && !room ? " · длиннее листа — сращивание" : ""), ...(worktop || long || p.fm || room ? { external: true } : {}), size, position: [(x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2], length: dims[0], width: dims[1], thickness: rawThickness(dims[2]),
      // декор фасадов — у фасадного материала; ЛДСП корпуса спереди (фальшпанель ящика, планка) остаётся в декоре корпуса
      role: p.facade ? "door" : "body", material, decor: p.decor ?? (p.fm || (p.facade && p.kind !== "ldsp") ? m.facadeDecor : m.decor), grain: "length",
      grainAxis: (size.indexOf(dims[0]) === thin ? 1 : size.indexOf(dims[0])) as 0 | 1 | 2, edge: [0, 0, 0, 0] });
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

export function parseRaw(x: unknown): RawSpec | undefined {
  const r = x as RawSpec;
  if (!r || typeof r !== "object" || !Array.isArray(r.panels)) return undefined;
  return {
    panels: r.panels.map((p) => ({ name: String(p.name ?? "деталь"), kind: String(p.kind ?? "ldsp"), box: (p.box ?? []).map(Number) as RawPanel["box"], ...(p.facade ? { facade: true } : {}), ...(p.decor ? { decor: String(p.decor) } : {}), ...(p.fm ? { fm: true } : {}),
      ...(Array.isArray(p.edges) && p.edges.length ? { edges: p.edges.filter((e) => Array.isArray(e) && e.length === 2).map((e) => [Number(e[0]), Number(e[1])] as [number, number]).filter((e) => e.every(Number.isFinite)) } : {}),
      ...(Array.isArray(p.contour) && p.plane && ["xz", "xy", "yz"].includes(p.plane) ? { contour: p.contour.slice(0, 400).map((c) => [Number(c[0]), Number(c[1])] as [number, number]).filter((c) => c.every(Number.isFinite)), plane: p.plane } : {}),
      ...(p.obb && Array.isArray(p.obb.size) && p.obb.size.length === 3 && [...p.obb.size, p.obb.ry, p.obb.rz].map(Number).every(Number.isFinite) ? { obb: { size: p.obb.size.map(Number) as [number, number, number], ry: Number(p.obb.ry), rz: Number(p.obb.rz) } } : {}),
      ...(p.skew ? { skew: true } : {}), ...(p.figure ? { figure: true } : {}), ...(p.mat ? { mat: String(p.mat).slice(0, 60) } : {}) })),
    hardware: (Array.isArray(r.hardware) ? r.hardware : []).map((h) => ({ name: String(h.name ?? ""), category: String(h.category ?? ""), mesh: h.mesh ? String(h.mesh) : null, pos: (h.pos ?? [0, 0, 0]).map(Number) as RawHardware["pos"], quat: (h.quat ?? [1, 0, 0, 0]).map(Number) as RawHardware["quat"],
      ...(Array.isArray(h.bbox) && h.bbox.length === 6 && h.bbox.map(Number).every(Number.isFinite) ? { bbox: h.bbox.map(Number) } : {}) })),
    ...(Array.isArray(r.profiles) && r.profiles.length ? { profiles: r.profiles.slice(0, 200).map((q) => ({ name: String(q.name ?? "профиль"), len: Number(q.len), d: Number(q.d), pos: (q.pos ?? [0, 0, 0]).map(Number) as RawProfile["pos"], dir: (q.dir ?? [1, 0, 0]).map(Number) as RawProfile["dir"] }))
      .filter((q) => [q.len, q.d, ...q.pos, ...q.dir].every(Number.isFinite) && q.len > 0 && q.d > 0) } : {}),
    ...(r.source ? { source: String(r.source) } : {}),
    ...(r.counts && typeof r.counts === "object" ? { counts: Object.fromEntries(RAW_COUNT_KEYS.filter((k) => Number.isFinite(Number(r.counts![k])) && Number(r.counts![k]) > 0).map((k) => [k, Math.round(Number(r.counts![k]))])) as RawCounts } : {}),
    ...(r.row ? { row: true } : {}),
  };
}
