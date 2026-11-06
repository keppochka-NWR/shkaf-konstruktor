import type { Module, Part } from './model';

export type MetalFrameKind = 'u' | 'closed' | 'table';
export type MetalFrame = { kind: MetalFrameKind; tubeWidth: number; tubeDepth: number; tubeWall?: number; color: string; crossbars: number };
export const FRAME_LABEL: Record<MetalFrameKind, string> = { u: 'П-образная опора', closed: 'Замкнутая опора', table: 'Полный каркас стола' };
export const FRAME_COLORS = [{ value: '#f2f2f0', label: 'Белый' }, { value: '#252525', label: 'Чёрный' }, { value: '#858585', label: 'Серый' }];
export const DEFAULT_FRAME: MetalFrame = { kind: 'u', tubeWidth: 60, tubeDepth: 30, color: '#252525', crossbars: 0 };

/** Separate object, no tabletop. Size is the outside dimension of the steel frame. */
export function metalFrameModule(base: Module, width = 600, height = 870, depth = 30): Module {
  return { version: 1, name: 'Металлокаркас', width, height, depth, decor: base.decor, facadeDecor: base.facadeDecor,
    doors: false, backType: 'none', bottomType: 'none', plinthHeight: 0, autoFillersOff: true,
    sections: [{ id: 'frame', weight: 1, shelves: [], drawers: 0, rod: false }],
    metalFrame: { ...DEFAULT_FRAME, tubeDepth: depth, ...(depth > 120 ? { kind: 'table', tubeDepth: 30, crossbars: 1 } : {}) } };
}
export function parseMetalFrame(value: unknown): MetalFrame {
  if (!value || typeof value !== 'object') throw Error('Некорректные параметры металлокаркаса.');
  const v = value as Record<string, unknown>;
  return { kind: v.kind as MetalFrameKind, tubeWidth: v.tubeWidth as number, tubeDepth: v.tubeDepth as number, ...(v.tubeWall!==undefined?{tubeWall:v.tubeWall as number}:{}), color: v.color as string, crossbars: v.crossbars as number };
}
export function metalFrameErrors(m: Module): string[] {
  const f = m.metalFrame!, out: string[] = [];
  if (!Object.hasOwn(FRAME_LABEL, f.kind)) out.push('Выберите вид металлокаркаса.');
  for (const [key, label, lo, hi] of [['width', 'Ширина', 100, 2700], ['height', 'Высота', 100, 1500], ['depth', 'Глубина', 15, 2400]] as const)
    if (!Number.isFinite(m[key]) || m[key] < lo || m[key] > hi) out.push(`${label}: допустимо от ${lo} до ${hi} мм.`);
  if (![f.tubeWidth, f.tubeDepth].every(v => Number.isFinite(v) && v >= 15 && v <= 120)) out.push('Сечение трубы: каждая сторона от 15 до 120 мм.');
  if(f.tubeWall!==undefined&&(!Number.isFinite(f.tubeWall)||f.tubeWall<=0||2*f.tubeWall>=Math.min(f.tubeWidth,f.tubeDepth)))out.push('Толщина стенки трубы должна быть положительной и меньше половины меньшей стороны профиля.');
  if (m.width <= 2 * f.tubeWidth || m.height <= 2 * f.tubeWidth) out.push('Ширина и высота каркаса должны быть больше двух сторон профиля.');
  if (f.kind === 'table' ? m.depth <= 2 * f.tubeDepth : m.depth !== f.tubeDepth) out.push(f.kind === 'table' ? 'Глубина каркаса должна быть больше двух сторон профиля.' : 'У плоской опоры глубина равна толщине профиля.');
  if (!Number.isInteger(f.crossbars) || f.crossbars < 0 || f.crossbars > 5 || (f.kind !== 'table' && f.crossbars !== 0)) out.push('Поперечины: от 0 до 5, только у полного каркаса.');
  if (f.kind === 'table' && (m.width - f.tubeWidth) / (f.crossbars + 1) < f.tubeWidth) out.push('Поперечины не помещаются по ширине каркаса.');
  if (typeof f.color !== 'string' || !/^#[0-9a-fA-F]{6}$/.test(f.color)) out.push('Выберите цвет металлокаркаса.');
  if (m.doors || m.kitchen || m.raw || m.worktop || m.desk || m.kupe || m.corner || m.casework || m.cutouts?.length || m.feet || m.sidePanels || m.sections.some(s => s.drawers || s.rod || s.shelves.length)) out.push('Металлокаркас - отдельный объект без корпусного наполнения.');
  return out;
}
export function changeFrameKind(m: Module, kind: MetalFrameKind): void {
  const f = m.metalFrame!;
  m.metalFrame = { ...f, kind, crossbars: kind === 'table' ? 1 : 0 };
  m.depth = kind === 'table' ? Math.max(600, m.depth, 2 * f.tubeDepth + 1) : f.tubeDepth;
}
/** Butt joints: beams touch but do not intersect; profile lengths are geometric, no allowance for welding/cutting. */
export function metalFrameParts(m: Module): Part[] {
  const f = m.metalFrame!, W = m.width, H = m.height, D = m.depth, a = f.tubeWidth, b = f.tubeDepth, out: Part[] = [];
  const add = (id: string, name: string, size: Part['size'], position: Part['position'], length: number) => out.push({
    id: `metal-frame:${id}`, name, size, position, length, width: a, thickness: b, material: 'metal', role: 'body',
    decor: '', grain: 'length', grainAxis: 0, edge: [0, 0, 0, 0], external: true,
    look: { color: Number.parseInt(f.color.slice(1), 16), metalness: 0.35, roughness: 0.55 },
  });
  const zs = f.kind === 'table' ? [b / 2, D - b / 2] : [b / 2];
  const bottom = f.kind === 'closed' ? a : 0;
  for (const [i, z] of zs.entries()) {
    add(`top:${i}`, 'Верхняя перемычка', [W, a, b], [W / 2, H - a / 2, z], W);
    for (const [j, x] of [a / 2, W - a / 2].entries()) add(`leg:${i}:${j}`, 'Стойка металлокаркаса', [a, H - a - bottom, b], [x, bottom + (H - a - bottom) / 2, z], H - a - bottom);
  }
  if (f.kind === 'closed') add('bottom', 'Нижняя перемычка', [W, a, b], [W / 2, a / 2, b / 2], W);
  if (f.kind === 'table') {
    const xs = [a / 2, W - a / 2, ...Array.from({ length: f.crossbars }, (_, i) => a / 2 + (W - a) * (i + 1) / (f.crossbars + 1))];
    xs.forEach((x, i) => add(`rail:${i}`, i < 2 ? 'Боковая перемычка' : 'Верхняя поперечина', [a, a, D - 2 * b], [x, H - a / 2, D / 2], D - 2 * b));
  }
  return out;
}
export const metalFrameLength = (m: Module) => metalFrameParts(m).reduce((sum, p) => sum + p.length, 0) / 1000;
/** Configuration-specific price: changing size/profile must never reuse an old quotation. Retail, outside the board-sheet price. */
export function metalFramePriceKey(m: Module): string {
  const f = m.metalFrame!;
  return `metal-frame:${f.kind}:${m.width}x${m.height}x${m.depth}:${f.tubeWidth}x${f.tubeDepth}${f.tubeWall!==undefined?'x'+f.tubeWall:''}:${f.color.slice(1)}:${f.crossbars}`;
}
