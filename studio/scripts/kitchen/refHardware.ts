// Категория фурнитуры эталона Базиса с поправкой на построитель эталона.
// Кухни\scripts\etalon.py (hw_category) относит к «прочему» всё, в имени чего есть «винт», — поэтому «Евровинт 6х50»
// (k33, k34) записан в «прочее», хотя это конфирмат: стоит в стыках дна/крыши с боковинами, присадка D8×16 + D5×36,
// как у «Конфирмат 7х50». Без поправки распознаватель решал, что крепежа корпуса в проекте нет, и снимал его.
const CONFIRMAT = /евровинт|конфирмат/i;

export function refCategory(h: { name: string; category: string }): string {
  if (h.category === "прочее" && CONFIRMAT.test(h.name ?? "")) return "конфирмат";
  // Axis PRO: передняя панель внутреннего ящика и «Logo» на царге — в проектах Базиса то «ящик-система»/«заглушка», то «прочее»
  // (k25); сверяем одной категорией: панель — ящик-система (7 из 8), Logo — заглушка
  if (/^Передняя панель внутр/.test(h.name ?? "")) return "ящик-система";
  if ((h.name ?? "").trim() === "Logo") return "заглушка";
  // «Мебельная ручка рейлинг 128» (k09): «рейлинг» стоит в правиле ящик-системы раньше ручки — это ручка
  if (h.category === "ящик-система" && /^\s*(мебельная\s+)?ручк/i.test(h.name ?? "")) return "ручка";
  return h.category;
}

/** Имя крепежа корпуса в проекте, если это не типовой «Конфирмат 7х50» (k33/k34: «Евровинт 6х50») — для деталей и сметы. */
export function confirmatName(hw: { name: string; category: string }[]): string | undefined {
  const names = [...new Set(hw.filter((h) => refCategory(h) === "конфирмат").map((h) => (h.name ?? "").trim()).filter(Boolean))];
  return names.length === 1 && !/^конфирмат\s*7\s*[хx×]\s*50/i.test(names[0]) ? names[0] : undefined;
}

/** Вложенный комплект направляющих: в списке фурнитуры Базиса одна направляющая записана дважды — членом комплекта ящика
 *  (точка — якорь комплекта, одна на все ящики модуля) и элементом своего вложенного комплекта (точка направляющей).
 *  Член комплекта — запись комплекта K из m ≥ 2 направляющих, если сразу за ним (kitId K+1…K+m) есть одиночный комплект с направляющей
 *  того же имени (её элемент). По всей базе (09.10.2026) — 52 записи: Firmax k30 (18), k31 (12), MODERN SLIDE k09 (8), Versalite k01, k02
 *  (14); у Axis PRO, Indigo, СТАРТ, у пар Firmax k14/k19/k22 (обе записи в одной точке) вложенности нет. */
export function kitHeaderIdx(hw: { name: string; category: string; kitId?: number | null }[]): Set<number> {
  const out = new Set<number>(), runs = hw.map((h, i) => ({ h, i })).filter(({ h }) => h.category === "направляющая" && h.kitId != null);
  const n = new Map<number, number>();
  for (const { h } of runs) n.set(h.kitId!, (n.get(h.kitId!) ?? 0) + 1);
  for (const { h, i } of runs) {
    const K = h.kitId!, m = n.get(K) ?? 0;
    if (m >= 2 && runs.some(({ h: q }) => q.name === h.name && q.kitId! > K && q.kitId! <= K + m && n.get(q.kitId!) === 1)) out.add(i);
  }
  return out;
}

/** Фурнитура эталона с исправленными категориями (порядок и индексы сохраняются: отверстия ссылаются на src).
 *  Член вложенного комплекта направляющих (kitHeaderIdx) — «комплект», служебная запись: не изделие и не точка направляющей. */
export function normalizeRefHardware<T extends { name: string; category: string }>(hw: T[]): T[] {
  const kh = kitHeaderIdx(hw as unknown as { name: string; category: string; kitId?: number | null }[]);
  return hw.some((h) => refCategory(h) !== h.category) || kh.size ? hw.map((h, i) => (kh.has(i) ? { ...h, category: "комплект", service: true, kitHeader: true } : { ...h, category: refCategory(h) })) : hw;
}
