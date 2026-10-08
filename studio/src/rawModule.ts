// «Сырой» модуль: детали проекта Базиса как есть (импорт кухонь и шкафов из базы заказов), для модулей, которые параметрика студии
// пока не воспроизводит деталь-в-деталь (угловые, скошенные, острова, нестандартные наполнения). Панели — коробки в осях модуля
// (X вправо, Y вверх, Z от стены к фасаду, начало — минимальный угол), фурнитура — сетки Базиса (TriData → GLB) по позиции и повороту.
// Раскрой и смета панелей работают как обычно; правила студии (петли, крепёж, полки) к сырому модулю не применяются.
import type { Module, Part } from "./model";

export type RawPanel = { name: string; kind: string; box: [number, number, number, number, number, number]; facade?: boolean; decor?: string };
export type RawHardware = { name: string; category: string; mesh?: string | null; pos: [number, number, number]; quat: [number, number, number, number] };
export type RawSpec = { panels: RawPanel[]; hardware: RawHardware[]; source?: string };

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
    const [x0, y0, z0, x1, y1, z1] = p.box, size: [number, number, number] = [x1 - x0, y1 - y0, z1 - z0];
    const dims = [...size].sort((a, b) => b - a), thin = size.indexOf(Math.min(...size));
    const material: Part["material"] = p.kind === "hdf" ? "hdf" : p.kind === "glass" || p.kind === "mirror" ? "glass" : "board";
    // Столешница (толщина ≥ 26) — стороннее изделие, не раскрой ЛДСП; деталь длиннее рабочей длины листа — на сращивание, вне карт.
    const worktop = /столешн/i.test(p.name) || dims[2] >= 26, long = dims[0] > 2726;
    out.push({ id: `raw:p${i}`, name: p.name + (long && !worktop ? " · длиннее листа — сращивание" : ""), ...(worktop || long ? { external: true } : {}), size, position: [(x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2], length: dims[0], width: dims[1], thickness: dims[2],
      role: p.facade ? "door" : "body", material, decor: p.decor ?? (p.facade ? m.facadeDecor : m.decor), grain: "length",
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
    panels: r.panels.map((p) => ({ name: String(p.name ?? "деталь"), kind: String(p.kind ?? "ldsp"), box: (p.box ?? []).map(Number) as RawPanel["box"], ...(p.facade ? { facade: true } : {}), ...(p.decor ? { decor: String(p.decor) } : {}) })),
    hardware: (Array.isArray(r.hardware) ? r.hardware : []).map((h) => ({ name: String(h.name ?? ""), category: String(h.category ?? ""), mesh: h.mesh ? String(h.mesh) : null, pos: (h.pos ?? [0, 0, 0]).map(Number) as RawHardware["pos"], quat: (h.quat ?? [1, 0, 0, 0]).map(Number) as RawHardware["quat"] })),
    ...(r.source ? { source: String(r.source) } : {}),
  };
}
