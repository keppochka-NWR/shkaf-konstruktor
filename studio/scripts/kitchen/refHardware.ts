// Категория фурнитуры эталона Базиса с поправкой на построитель эталона.
// Кухни\scripts\etalon.py (hw_category) относит к «прочему» всё, в имени чего есть «винт», — поэтому «Евровинт 6х50»
// (k33, k34) записан в «прочее», хотя это конфирмат: стоит в стыках дна/крыши с боковинами, присадка D8×16 + D5×36,
// как у «Конфирмат 7х50». Без поправки распознаватель решал, что крепежа корпуса в проекте нет, и снимал его.
const CONFIRMAT = /евровинт|конфирмат/i;

export function refCategory(h: { name: string; category: string }): string {
  if (h.category === "прочее" && CONFIRMAT.test(h.name ?? "")) return "конфирмат";
  // «Мебельная ручка рейлинг 128» (k09): «рейлинг» стоит в правиле ящик-системы раньше ручки — это ручка
  if (h.category === "ящик-система" && /^\s*(мебельная\s+)?ручк/i.test(h.name ?? "")) return "ручка";
  return h.category;
}

/** Имя крепежа корпуса в проекте, если это не типовой «Конфирмат 7х50» (k33/k34: «Евровинт 6х50») — для деталей и сметы. */
export function confirmatName(hw: { name: string; category: string }[]): string | undefined {
  const names = [...new Set(hw.filter((h) => refCategory(h) === "конфирмат").map((h) => (h.name ?? "").trim()).filter(Boolean))];
  return names.length === 1 && !/^конфирмат\s*7\s*[хx×]\s*50/i.test(names[0]) ? names[0] : undefined;
}

/** Фурнитура эталона с исправленными категориями (порядок и индексы сохраняются: отверстия ссылаются на src). */
export function normalizeRefHardware<T extends { name: string; category: string }>(hw: T[]): T[] {
  return hw.some((h) => refCategory(h) !== h.category) ? hw.map((h) => ({ ...h, category: refCategory(h) })) : hw;
}
