/** Публичная сборка студии (сайт): в открытый JS не попадают слова закупки/себестоимости/наценки, названия поставщиков
 *  с закупочными ценами и пометки о решениях. Плагин Vite (только `vite build` без STUDIO_MANAGER=1) заменяет строковые
 *  литералы и шаблоны src/ с такими словами на ПУСТУЮ строку (не на «Цена салона»: в данных это закупочные источники,
 *  подпись «цена салона» к закупке вводила бы в заблуждение); ключи объектов и импорты не трогает. Видимые клиенту тексты
 *  с такими словами правятся в исходниках (условия Вернисажа, заголовки, CSV), пустая строка — только для источников данных.
 *  Цены в строках сметы публичной сборки — клиентские (src/clientPrices.ts). Страж publish.ps1 проверяет готовую сборку
 *  теми же словами (SENSITIVE_WORDS/NAMES ↔ publish.ps1 Step 4b) и числовыми ценами в коде (PRICE_LITERALS).
 *  Закупочные ЧИСЛА (price:445, markup:2.2, 23e3) запекает в розницу scripts/bake-prices.ts (плагин той же сборки, решение 16.10.2026);
 *  страж 4b проверяет и слова, и числа (scripts/price-guard.ts). */
import {parseAst} from 'rolldown/parseAst';

/** Слова, которых не должно быть в публичной сборке (без учёта регистра — слова; с учётом — аббревиатуры поставщиков). */
export const SENSITIVE_WORDS = /закуп|себестоим|наценк|решени[ея] макса/i;
export const SENSITIVE_NAMES = /(?<![А-Яа-яЁё])(СФЗ|ФАМ|ФАС|АТБ|МВМ|МДМ)(?![А-Яа-яЁё])|Побед[аыеу]|Мега-?[Тт]рейд|Мегатрейд|Древиз/;
/** Подписи источников цены с закупочными/ценовыми сведениями без слов «закупка» и имён поставщиков (критик 28.10.2026): «старый
 *  калькулятор 90 ₽», «Оценка по классу DTC/Unihopper (1000–1250)», «1729 ₽ (розница allpremial.ru …)», «в прайсе 9000 ₽ — цена
 *  продажи», «Интерполяция прайса …». Такие литералы — источники данных сметы, в публичной сборке они пустые; страж — price-guard.ts. */
export const SENSITIVE_SOURCES = /старый калькулятор|оценк[аи] по классу|цена продажи|розница [\w.-]+\.ru|интерполяция прайса|\d\s*₽ \(розница|в прайсе[^.;«»]{0,20}\d|\d[\d  ]*₽[^.;«»]{0,20}в прайсе/i;
export const isSensitive = (s: string) => SENSITIVE_WORDS.test(s) || SENSITIVE_NAMES.test(s) || SENSITIVE_SOURCES.test(s);
export const NEUTRAL = '';
/** Коэффициенты в собранном JS (ключи объектов минификатор не переименовывает): markup:2.2, vernissageMarkup:1.6 — после запекания
 *  (scripts/bake-prices.ts) их там быть не должно (0 и 1 — нейтральные). Цена листа 23 000 (sheetPrice??23e3) с 30.10.2026 — цена
 *  клиенту в публичной сборке: цена — только по листам (решение Макса 30.10.2026), без неё сайт не посчитает ни одного проекта;
 *  это розница, не закупка, и стражем больше не ищется. Цены строк (price:979) в публичной сборке — розница; закупочные значения
 *  ищет scripts/price-guard.ts по множеству исходных таблиц с ключом поля. Тот же шаблон — в publish.ps1 Step 4b ($guardNumbers).
 */
export const PRICE_LITERALS = /(?<![\w$])(markup|sheetPrice|vernissageMarkup)\s*:\s*(?![01](?![\d.e]))-?\.?\d/g;

type Node = { type: string; start: number; end: number; [k: string]: unknown };
type Edit = { start: number; end: number; text: string; was: string };

/** Правки модуля: строковые литералы/шаблоны с чувствительными словами → JSON-строка NEUTRAL. */
export function sanitizeEdits(code: string, filename = 'module.js'): Edit[] {
  const ast = parseAst(code, { lang: filename.endsWith('x') ? 'jsx' : 'js' }, filename) as unknown as Node;
  const edits: Edit[] = [];
  const visit = (n: unknown, parent: Node | null, key: string) => {
    if (!n || typeof n !== 'object') return;
    if (Array.isArray(n)) { for (const c of n) visit(c, parent, key); return; }
    const node = n as Node;
    if (typeof node.type !== 'string') return;
    // ключ объекта, источник импорта/экспорта — не трогаем (поиск по ключу и модули не должны ломаться)
    const isKey = parent && (parent.type === 'Property' || parent.type === 'MethodDefinition' || parent.type === 'PropertyDefinition') && key === 'key' && !parent.computed;
    const isModuleSource = parent && /Import|Export/.test(parent.type) && key === 'source';
    if (node.type === 'Literal' && typeof node.value === 'string' && !isKey && !isModuleSource) {
      if (isSensitive(node.value)) { edits.push({ start: node.start, end: node.end, text: JSON.stringify(NEUTRAL), was: node.value }); }
      return;
    }
    if (node.type === 'TemplateLiteral') {
      const quasis = node.quasis as { value: { cooked: string | null; raw: string } }[];
      const text = quasis.map(q => q.value.cooked ?? q.value.raw).join('${}');
      if (isSensitive(text) && !(parent && parent.type === 'TaggedTemplateExpression')) {
        edits.push({ start: node.start, end: node.end, text: JSON.stringify(NEUTRAL), was: text });
        return;
      }
    }
    if (node.type === 'JSXText' && typeof node.value === 'string' && isSensitive(node.value)) {
      edits.push({ start: node.start, end: node.end, text: NEUTRAL, was: node.value });
      return;
    }
    for (const k of Object.keys(node)) { if (k === 'type' || k === 'start' || k === 'end') continue; visit(node[k], node, k); }
  };
  visit(ast, null, '');
  return edits;
}

/** Применить правки (позиции — по UTF-16, как отдаёт парсер в JS). */
export function applyEdits(code: string, edits: Edit[]): string {
  let out = code;
  for (const e of [...edits].sort((a, b) => b.start - a.start)) out = out.slice(0, e.start) + e.text + out.slice(e.end);
  return out;
}

/** Плагин Vite: после компиляции TS/JSX (enforce: 'post') чистит модули studio/src. Журнал замен — в reports/public-build.txt. */
export function publicStringsPlugin(log: string[]) {
  return {
    name: 'public-strings',
    apply: 'build' as const,
    enforce: 'post' as const,
    transform(code: string, id: string) {
      const file = id.split('?')[0].replace(/\\/g, '/');
      if (!/\/studio\/src\/.*\.(t|j)sx?$/.test(file)) return null;
      if (!isSensitive(code)) return null;
      const edits = sanitizeEdits(code, file);
      for (const e of edits) log.push(file.replace(/^.*\/studio\//, '') + ': ' + e.was.replace(/\s+/g, ' ').slice(0, 160));
      return edits.length ? { code: applyEdits(code, edits), map: null } : null;
    },
  };
}
