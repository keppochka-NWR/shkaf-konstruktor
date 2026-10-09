// Категория фурнитуры эталона Базиса с поправкой на построитель эталона.
// Кухни\scripts\etalon.py (hw_category) относит к «прочему» всё, в имени чего есть «винт», — поэтому «Евровинт 6х50»
// (k33, k34) записан в «прочее», хотя это конфирмат: стоит в стыках дна/крыши с боковинами, присадка D8×16 + D5×36,
// как у «Конфирмат 7х50». Без поправки распознаватель решал, что крепежа корпуса в проекте нет, и снимал его.
const CONFIRMAT = /евровинт|конфирмат/i;

export function refCategory(h: { name: string; category: string }): string {
  if (h.category === "прочее" && CONFIRMAT.test(h.name ?? "")) return "конфирмат";
  return h.category;
}

/** Фурнитура эталона с исправленными категориями (порядок и индексы сохраняются: отверстия ссылаются на src). */
export function normalizeRefHardware<T extends { name: string; category: string }>(hw: T[]): T[] {
  return hw.some((h) => refCategory(h) !== h.category) ? hw.map((h) => ({ ...h, category: refCategory(h) })) : hw;
}
