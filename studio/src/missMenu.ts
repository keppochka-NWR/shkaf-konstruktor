// Запасное меню правой кнопки на промахе мимо деталей (замечание критика 20.10, п.2).
// Открываем меню выбранного корпуса только если клик внутри экранной рамки корпуса (проекция его габарита);
// секция и высота для «Наполнение ›» — по точке клика, а не первая секция / середина высоты.
import { boxes, type Module } from "./model";

export type ScreenRect = { left: number; top: number; right: number; bottom: number };

/** Экранная рамка по проекциям 8 углов габарита (точки за камерой — null — пропускаются). */
export function screenRect(points: ({ x: number; y: number } | null)[]): ScreenRect | null {
  const ok = points.filter((p): p is { x: number; y: number } => !!p && Number.isFinite(p.x) && Number.isFinite(p.y));
  if (!ok.length) return null;
  return { left: Math.min(...ok.map((p) => p.x)), right: Math.max(...ok.map((p) => p.x)), top: Math.min(...ok.map((p) => p.y)), bottom: Math.max(...ok.map((p) => p.y)) };
}

export const insideRect = (r: ScreenRect | null, x: number, y: number) => !!r && x >= r.left && x <= r.right && y >= r.top && y <= r.bottom;

/** Секция по x в координатах корпуса: та, в чей проём попали; иначе ближайшая по x (щель у стойки, боковина). */
export function sectionAtX(m: Module, localX: number): string {
  const bs = boxes(m);
  if (!bs.length) return m.sections[0].id;
  const inside = bs.find((b) => localX >= b.x && localX <= b.x + b.width);
  if (inside) return inside.id;
  const dist = (b: { x: number; width: number }) => Math.min(Math.abs(localX - b.x), Math.abs(localX - b.x - b.width));
  return bs.reduce((best, b) => (dist(b) < dist(best) ? b : best)).id;
}

/**
 * Цель запасного меню: null — клик вне рамки корпуса (меню не открываем).
 * local — точка клика в координатах корпуса (пересечение луча с плоскостью фасада), null — луч параллелен плоскости.
 * fromLabel — правый клик по плашке размера выбранного корпуса (плашка — часть корпуса, хоть и вне рамки): меню открываем.
 */
export function missMenuTarget(m: Module, rect: ScreenRect | null, click: { x: number; y: number }, local: { x: number; y: number } | null, fromLabel = false): { sid: string; localY: number } | null {
  if ((!fromLabel && !insideRect(rect, click.x, click.y)) || !m.sections.length) return null;
  if (!local) return { sid: m.sections[0].id, localY: m.height / 2 };
  return { sid: sectionAtX(m, local.x), localY: Math.min(m.height, Math.max(0, local.y)) };
}
