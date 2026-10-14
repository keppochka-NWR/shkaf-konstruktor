import type { Module, Part } from './model';

export const ALLEGRO_SOURCE = 'https://premial-furniture.ru/wp-content/uploads/2026/07/Инструкция-Бутылочница-Brioso-в-базу-150-200-300-мм.pdf';
/** Official BRIOSO (current catalogue ALLEGRO) PDF p.104: base width is NOT the mechanism width.
 * Basket wire diameters and slide cross sections are visual approximations;
 * this module does not generate manufacturing drillings. */
export const ALLEGRO = [
  { article: '060500', base: 150, width: 95, side: 'left' },
  { article: '060501', base: 150, width: 95, side: 'right' },
  { article: '060502', base: 200, width: 145, side: 'left' },
  { article: '060503', base: 200, width: 145, side: 'right' },
] as const;
export type PremialPullout = { article: string };
export const allegroById = (id: string) => ALLEGRO.find(p => p.article === id);

export function allegroErrors(m: Module): string[] {
  const selected = m.kitchen?.premialPullout;
  if (!selected) return [];
  const item = allegroById(selected.article);
  if (!item) return ['Бутылочница: неизвестный артикул Premial.'];
  const errors: string[] = [];
  if (m.kitchen?.role !== 'base' || m.kitchen.appliance || m.corner || m.raw) errors.push('Бутылочница АЛЛЕГРО предназначена для отдельной нижней тумбы без техники.');
  if (Math.abs(m.width - item.base) > 0.1) errors.push(`АЛЛЕГРО ${item.article}: нужна тумба шириной ${item.base} мм.`);
  const bottom = (m.feet?.height ?? m.plinthHeight ?? 0) + 16;
  const upper = m.topType === 'none' ? m.height : m.height - 16;
  // 8 mm free above the mechanism is a design reserve. The drawing's 26 mm
  // dimension locates a runner screw, NOT the front of the whole mechanism.
  const rear = m.backType === 'groove' ? (m.grooveInset ?? 16) + 4 : m.backType === 'board' ? 17 : 0;
  if (m.depth - rear < 457) errors.push('АЛЛЕГРО: механизм глубиной 457 мм не помещается между задней стенкой и фасадом.');
  if (upper - bottom < 548) errors.push('АЛЛЕГРО: требуется свободная высота не менее 548 мм.');
  if (m.sections.length !== 1 || m.kdrawers?.length || m.sections.some(s => s.shelves.length || s.drawers || s.rod || s.pantograph || s.pullouts)) errors.push('Для бутылочницы освободите единственную секцию: уберите полки, ящики и гардеробное наполнение.');
  if (m.sections.some(s => s.doorSplit !== undefined || s.doorRows?.length || (s.doorLeaves ?? 1) > 1)) errors.push('Для бутылочницы нужен один цельный фасад.');
  if (!m.doors) errors.push('Включите фасад для крепления бутылочницы.');
  const mechanismBottom = bottom + 4, mechanismTop = mechanismBottom + 540;
  for (const rail of m.rails ?? []) {
    const h = rail.lay === 'flat' ? 16 : rail.height;
    const y0 = rail.place.endsWith('top') ? m.height - h : bottom;
    if (y0 < mechanismTop && y0 + h > mechanismBottom) errors.push('Царга перекрывает высоту бутылочницы. Переместите царгу или увеличьте высоту корпуса.');
  }
  return [...new Set(errors)];
}

/** Read only the supported article; unknown data remains an explicit validation error. */
export function parsePremialPullout(value: unknown): PremialPullout {
  const v = value as Record<string, unknown> | null;
  return { article: typeof v?.article === 'string' ? v.article.slice(0, 30) : '' };
}

export function applyAllegroParts(m: Module, out: Part[]) {
  const selected = m.kitchen?.premialPullout;
  const item = selected && allegroById(selected.article);
  if (!item) return;
  // Pull-out fronts have no door hinges. Removing the item restores ordinary hinges.
  for (let i = out.length - 1; i >= 0; i--) if (out[i].role === 'hinge') out.splice(i, 1);
  // Do not incorrectly swing this front when the scene opens hinged doors.
  // Stroke simulation is separate from the simplified closed layout; travel is not verified.
  for (const p of out) if (p.role === 'door' || p.role === 'handle') { p.openShift = 0; if (p.role === 'door') p.hingeless = true; }
  const width = item.width, height = 540, depth = 457;
  const x = item.side === 'left' ? 16 + width / 2 : m.width - 16 - width / 2;
  const y = (m.feet?.height ?? m.plinthHeight ?? 0) + 16 + 4 + height / 2;
  out.push({ id: `premial-allegro:${item.article}`, name: `Бутылочница Premial АЛЛЕГРО ${item.article} · ${item.side === 'left' ? 'левая' : 'правая'}`,
    size: [width, height, depth], position: [x, y, m.depth + (m.faceAir ?? 2) - depth / 2],
    length: depth, width, thickness: height, material: 'metal', decor: '', role: 'fastener',
    grain: 'length', grainAxis: 2, edge: [0, 0, 0, 0], external: true });
}
