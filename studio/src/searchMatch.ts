// Поиск по параметрам (Макс 31.10.2026: «по ключевым словам искать различные пункты редактирования»).
// Чистый подбор без React и DOM: нормализация, грубая основа слова (полка/полки/полку → «полк»), синонимы и опечатки.
// Реестр пунктов — searchRegistry.ts; переход к пункту — searchNav.ts.

export type SearchEntry = { id: string; title: string; where: string; keys: string[]; rank?: number };
export type SearchHit<T extends SearchEntry = SearchEntry> = { item: T; score: number };

/** Нижний регистр, ё → е, всё кроме букв и цифр — пробел (Макс 31.10: «петли», «Петли», «петли,» — одно и то же). */
export function norm(s: string): string { return s.toLocaleLowerCase("ru-RU").replace(/ё/g, "е").replace(/[^a-zа-я0-9+]+/g, " ").trim(); }

// окончания от длинных к коротким; основа не короче 3 букв (иначе «окно» → «ок» совпало бы со всем подряд)
const ENDINGS = ["иями","ями","ами","ого","его","ому","ему","ыми","ими","ой","ей","ий","ый","ая","яя","ое","ее","ую","юю","ов","ев","ах","ях","ам","ям","ом","ем","ия","ья","ие","ье","ию","ью","ии","а","я","о","е","ы","и","у","ю","ь","й"];
/** Грубая основа русского слова: «полки», «полку», «полка» → «полк»; «петли», «петля» → «петл». Латиница и числа — как есть. */
export function stem(w: string): string {
  if (!/[а-я]/.test(w) || w.length <= 3) return w;
  // «-ем/-ом» — только у длинных слов: «проём» не «про» (иначе совпадал с «проект», «прозрачный»; критик 31.10)
  for (const e of ENDINGS) if (w.endsWith(e) && w.length - e.length >= ((e === "ем" || e === "ом") ? 4 : 3)) return w.slice(0, -e.length);
  // беглая гласная родительного падежа: «полок» → «полк», «ручек» → «ручк», «розеток» → «розетк»
  if (w.length >= 5 && /[бвгджзклмнпрстфхцчшщ][ое]к$/.test(w)) return w.slice(0, -2) + "к";
  return w;
}
export const tokens = (s: string) => norm(s).split(" ").filter(Boolean).map(stem);

/** Расстояние Левенштейна с ранним выходом, когда больше max. */
export function lev(a: string, b: string, max = 2): number {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i]; let low = i;
    for (let j = 1; j <= b.length; j++) { cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)); low = Math.min(low, cur[j]); }
    if (low > max) return max + 1;
    prev = cur;
  }
  return prev[b.length];
}

// Синонимы — группы слов одного смысла (Макс 31.10: «цвет» = «декор», «цена» = «стоимость», «обучение» = «помощь»).
// Слова группы проходят через ту же основу, что и запрос.
const SYNONYMS: string[][] = [
  ["цвет","декор","материал","текстура","лдсп"],
  ["3d","3д","объемный"],
  ["стоимость","цена","смета","итог","рубль","сколько"],
  ["кп","коммерческое","предложение"],
  ["раскрой","лист","нестинг","деталировка"],
  // глоссарий ревизии структуры 31.10 (design-review-3110/ia.md): документы, фальшпанель (ФП), монтаж фасада, файл заказа, отменить, вариант
  ["документ","кп","спецификация","бирка","чертеж","выдать","печать","pdf"],
  ["обучение","тур","помощь","подсказка","инструкция","справка","научиться"],
  ["фальш","фальшпанель","добор","фп"],
  ["монтаж","накладной","вкладной"],
  ["файл","сохранить","скачать","открыть"],
  ["отменить","отмена","undo"],
  ["вариант","версия"],
  ["цоколь","основание","ножка","опора"],
  ["размер","габарит"],
  ["подсветка","свет","led","светодиод","светильник"],
  ["штанга","вешалка","плечики"],
  ["стекло","стеклянный"],
  ["ящик","выдвижной","комод"],
  ["розетка","электрика","выключатель","коммуникация","труба","радиатор","батарея"],
  ["ламинат","паркет","линолеум","плитка"],
  ["обои","покраска","отделка"],
  ["скос","мансарда","наклон","скат"],
  ["привязка","магнит","прилипание"],
  ["вырез","пропил","отверстие"],
  ["фасад","дверца","створка"],
  ["шкаф","корпус","модуль"],
  ["удалить","убрать","стереть"],
  ["копия","копировать","дублировать"],
];
const SYN = new Map<string, string[]>();
for (const g of SYNONYMS) { const st = g.map((w) => stem(norm(w))); for (const s of st) SYN.set(s, [...new Set([...(SYN.get(s) ?? []), ...st.filter((x) => x !== s)])]); }
/** Синонимы основы (без неё самой). */
export const synonyms = (st: string) => SYN.get(st) ?? [];

/** Насколько основа запроса q похожа на основу слова пункта t: 1 — то же, 0 — непохоже. */
export function wordMatch(q: string, t: string): number {
  if (q === t) return 1;
  // короткое слово запроса («q», «кп», «3d») — только точно или началом длинного слова
  if (q.length <= 2) return t.startsWith(q) && /[a-z0-9]/.test(q) ? 0.6 : t.startsWith(q) ? 0.5 : 0;
  // точное слово ключа весомее начала слова названия («пол» — отделка пола, а не «полки»)
  if (t.startsWith(q)) return 0.75;            // набирают: «пет» → «петл»
  if (q.startsWith(t) && t.length >= 4) return 0.7; // «фальшпанел» → «фальш»
  if (q.length >= 4 && t.length >= 4) { const d = lev(q, t, 2); if (d === 1) return 0.65; if (d === 2 && q.length >= 7) return 0.45; }
  return 0;
}

type Indexed<T extends SearchEntry> = { item: T; title: string[]; keys: string[]; where: string[]; phrases: string[] };
function index<T extends SearchEntry>(item: T): Indexed<T> {
  return { item, title: tokens(item.title), keys: item.keys.flatMap(tokens), where: tokens(item.where), phrases: [item.title, ...item.keys].map(norm) };
}
const cache = new WeakMap<object, Indexed<SearchEntry>[]>();

/** Лучшее совпадение основы запроса со словами пункта с учётом веса поля и синонимов. */
function tokenScore(q: string, e: Indexed<SearchEntry>): number {
  let best = 0;
  const fields: [string[], number][] = [[e.title, 3], [e.keys, 2.4], [e.where, 1]];
  for (const [list, w] of fields) for (const t of list) best = Math.max(best, wordMatch(q, t) * w);
  // синоним — только целым словом (короткий «пол» не должен цеплять «полки»)
  for (const s of synonyms(q)) for (const [list, w] of fields) for (const t of list) { const m = wordMatch(s, t); if (m === 1 || (s.length >= 4 && m >= 0.75)) best = Math.max(best, m * w * 0.75); }
  return best;
}
/** Доля слов названия, закрытых запросом: «Полки» на «полок» точнее, чем «Глубина полок». */
function coverage(q: string[], title: string[]): number {
  if (!title.length) return 0;
  // только точные слова: начало слова («пол» → «полки») покрытием не считается (критик 31.10)
  return title.reduce((s, t) => s + (q.some((w) => wordMatch(w, t) === 1) ? 1 : 0), 0) / title.length;
}

/** Пункты по запросу, лучшие сверху. Каждое слово запроса должно найтись (иначе пункт отсеян). */
export function searchItems<T extends SearchEntry>(items: readonly T[], query: string, limit = 12): SearchHit<T>[] {
  const q = tokens(query); if (!q.length) return [];
  let idx = cache.get(items) as Indexed<T>[] | undefined;
  if (!idx) { idx = items.map(index); cache.set(items, idx as Indexed<SearchEntry>[]); }
  const phrase = norm(query), hits: SearchHit<T>[] = [];
  for (const e of idx) {
    let score = 0, ok = true;
    for (const t of q) { const s = tokenScore(t, e as Indexed<SearchEntry>); if (!s) { ok = false; break; } score += s; }
    if (!ok) continue;
    score /= q.length;
    // целая фраза: «форма комнаты» в названии или ключе пункта весомее отдельных слов
    if (q.length > 1 && e.phrases.some((p) => p.includes(phrase))) score += 2;
    // начало названия — только целым первым словом: «пол» не поднимает «Полки» над «Отделка: пол» (критик 31.10)
    if (norm(e.item.title).startsWith(phrase) && e.title[0] === q[0]) score += 1;
    score += 0.6 * coverage(q, e.title);
    score += e.item.rank ?? 0;
    hits.push({ item: e.item, score });
  }
  return hits.sort((a, b) => b.score - a.score || a.item.title.localeCompare(b.item.title, "ru")).slice(0, limit);
}
