// Сцены Базиса из нескольких изделий шире 20 м (025/029/074): модули (сборки верхнего уровня) раскладываются рядами
// в пределах помещения 20 000 мм — геометрия каждого модуля не меняется, меняется только место модуля в сцене.
export type PackItem = { w: number; h: number; d: number; y: number };
export type PackOut = { pos: { x: number; y: number; z: number }[]; room: { width: number; depth: number; height: number } } | null;

/** ряды вдоль X с зазором gap, следующий ряд — глубже по Z; y сохраняется, если модуль помещается под 2600, иначе на пол.
 *  null — если один модуль сам шире/глубже лимита (тогда сцену не раскладываем). */
export function packRows(items: PackItem[], limit = 20000, margin = 300, gap = 300): PackOut {
  const maxW = limit - 2 * margin;
  if (items.some((it) => it.w > maxW || it.d > maxW || it.h > limit - 100)) return null;
  const pos: { x: number; y: number; z: number }[] = [];
  let x = margin, z = margin, rowD = 0, right = 0, top = 0;
  for (const it of items) {
    if (x > margin && x + it.w > limit - margin) { z += rowD + gap; x = margin; rowD = 0; }
    const y = it.y + it.h <= 2600 ? it.y : 0;
    pos.push({ x, y, z });
    right = Math.max(right, x + it.w); top = Math.max(top, y + it.h); rowD = Math.max(rowD, it.d);
    x += it.w + gap;
  }
  const room = { width: Math.ceil(right + margin), depth: Math.ceil(z + rowD + margin), height: Math.max(2700, Math.ceil(top + 100)) };
  if (room.depth > limit) return null;
  return { pos, room };
}
