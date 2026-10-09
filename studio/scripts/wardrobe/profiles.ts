// Сечение профиля Базиса по имени — только когда оно однозначно (в корпусе у профиля есть лишь имя и длина, контура сечения нет).
// Труба/штанга D25 — круг Ø25. Где центр круга относительно начала координат профиля, корпус не говорит (смещение зависит от того,
// как сечение лежит в библиотеке профилей Базиса) — поэтому ось трубы ставится по её штангодержателям/фланцам (их сетки
// симметричны, центр — ось трубы): snapToHolders. Труба без держателей у концов не рисуется (не придумываем положение).
// Остальное (купе-рельсы, Gola, «Профиль», Logo, Hettich, шлегель…) — не рисуем, перечисляем в отчёте импорта.
export function profileSection(name: string): { d: number } | null {
  const n = (name || "").toLowerCase().replace(/\s+/g, " ").trim();
  if (/^труба\s*(д|d|ø)?\s*25(\s*мм)?$/.test(n)) return { d: 25 };
  return null;
}

type V3 = [number, number, number];
/** Ось трубы по держателям: держатели (центры габаритов их сеток) у концов трубы — не дальше 40 мм за торцом и 80 мм от оси.
 *  Возвращает новый центр (по оси — как у трубы, поперёк — среднее держателей) или null, если держателей нет. */
export function snapToHolders(pos: V3, dir: V3, len: number, holders: V3[]): V3 | null {
  const ax = dir.findIndex((v) => Math.abs(v) > 0.5);
  if (ax < 0) return null;
  const near = holders.filter((h) => Math.abs(Math.abs(h[ax] - pos[ax]) - len / 2) <= 40 && Math.hypot(...[0, 1, 2].filter((i) => i !== ax).map((i) => h[i] - pos[i])) <= 80);
  if (!near.length) return null;
  return [0, 1, 2].map((i) => (i === ax ? pos[i] : near.reduce((s, h) => s + h[i], 0) / near.length)) as V3;
}
