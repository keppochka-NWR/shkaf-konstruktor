import { VERNISSAGE_MILLINGS, VERNISSAGE_SERIES, openings, type VernissageMilling } from './facadesVernissage';
import type { VSeriesId } from './vernissageData';

/** Каталог плиток выбора фрезеровки Вернисаж для клиента (решение 16.10: вариант А макета milling-mockup — сразу все рисунки
 *  плитками с фото; группы по цене, внутри — стиль как фильтр). Данные — отдельно от горячих файлов (pricing/model/kitchen).
 *  Названия — короткие клиентские из макета, без номеров серий. Фото — уменьшенные снимки из тех. паспортов PDF Вернисажа
 *  (studio/public/vernissage/millings, ≤240 px, ≤40 КБ); без фото — наша схема по той же раскладке, что и 3D, с пометкой.
 *  Фрезеровки без фото и описания (тип рисунка в каталоге не определён) клиенту не показываются: HIDDEN_MILLINGS. */

export type MillStyle = 'smooth' | 'modern' | 'frame' | 'classic';
export const MILL_STYLES: { id: MillStyle; label: string; hint: string }[] = [
  { id: 'smooth', label: 'Гладкие', hint: 'Ровное полотно без рисунка' },
  { id: 'modern', label: 'Современные', hint: 'Рейки, полоски, ромбы, арки во всю высоту, тонкие линии' },
  { id: 'frame', label: 'Рамка', hint: 'Плоская рамка по краю — «шейкер» и его вариации' },
  { id: 'classic', label: 'Классика', hint: 'Арки, фигурные и выпуклые филёнки, ступенчатый профиль' },
];

/** id фрезеровки → [стиль, название для клиента]. Порядок внутри стиля — как в макете. */
const NAMES: Record<string, [MillStyle, string]> = {
  '15': ['smooth', 'Гладкий, мягкий край'], '113': ['smooth', 'Гладкий, скошенный край'], 'ПЭТ': ['smooth', 'Гладкий, плёнка ПЭТ'],
  V5: ['smooth', 'Встроенная ручка А'], V6: ['smooth', 'Встроенная ручка Б'], V7: ['smooth', 'Встроенная ручка В'],
  '1': ['modern', 'Контур'], '6': ['modern', 'Линии-шейкер'], W2: ['modern', 'Тонкий кант'], '114': ['modern', 'Контур скруглённый'],
  '18': ['modern', 'Линии в углу'], '89': ['modern', 'Вагонка'], '111': ['modern', 'Каннелюры широкие'], '78': ['modern', 'Рейки'],
  '79': ['modern', 'Рейки частые'], '80': ['modern', 'Рифление мелкое'], '84': ['modern', 'Полоски'], '85': ['modern', 'Полоски частые'],
  '78/1': ['modern', 'Рейки поперёк'], '79/1': ['modern', 'Рейки частые поперёк'], '86': ['modern', 'Каннелюры'],
  '83': ['modern', 'Ёлочка'], '88': ['modern', 'Диагональ'], '109': ['modern', 'Ромбы мелкие'], '110': ['modern', 'Ромбы крупные'],
  '98': ['modern', 'Арка'], '99': ['modern', 'Арка двойная'], '100': ['modern', 'Арка с полосками'],
  '74': ['frame', 'Рамка простая'], '73': ['frame', 'Рамка с кантом'], '94': ['frame', 'Шейкер узкий'], '96': ['frame', 'Шейкер'],
  '76': ['frame', 'Шейкер широкий'], W1: ['frame', 'Шейкер ступенчатый'], W3: ['frame', 'Рамка двойная'], W4: ['frame', 'Рамка двойная узкая'],
  W5: ['frame', 'Шейкер гладкий'], W6: ['frame', 'Шейкер с вагонкой'], W7: ['frame', 'Рамка тонкая'], '75': ['frame', 'Рамка узкая'],
  '77': ['frame', 'Рамка с рифлёной кромкой'], '41': ['frame', 'Рамка с двумя контурами'], '48': ['frame', 'Рамка ступенчатая'],
  '95': ['frame', 'Рамка с внутренним контуром'], '46': ['frame', 'Рамка с вагонкой'], '90': ['frame', 'Рамка с вагонкой широкая'],
  '112': ['frame', 'Рамка с рифлением внизу'], '50': ['frame', 'Рамка с тонким контуром'], '93': ['frame', 'Рамка с полосками'],
  '3': ['classic', 'Арка с плечиками'], '20': ['classic', 'Арка мягкая'], '25': ['classic', 'Фигурная филёнка'], '45': ['classic', 'Арка в рамке'],
  '47': ['classic', 'Арка с плечиками в рамке'], '43': ['classic', 'Арка с вагонкой'], '44': ['classic', 'Филёнка с уголками'], '53': ['classic', 'Тройной контур'],
  '59': ['classic', 'Филёнка с декором углов'], '62': ['classic', 'Арка, выпуклая филёнка'], '66': ['classic', 'Арка с кантом'], '67': ['classic', 'Выпуклая филёнка'],
  '91': ['classic', 'Классика ступенчатая'], '92': ['classic', 'Классика мягкая'],
  '40': ['classic', 'Арка с плечиками, рамка'], '40/1': ['classic', 'Арка с плечиками, рамка 2'],
  '51': ['classic', 'Двойной контур'], '63': ['classic', 'Двойной контур 2'], '68': ['classic', 'Двойной контур 3'], '70': ['classic', 'Двойной контур 4'],
  '52': ['classic', 'Выпуклая филёнка широкая'], '71': ['classic', 'Выпуклая филёнка, широкая рамка'], '72': ['classic', 'Выпуклая филёнка глубокая'],
  '54': ['classic', 'Классическая филёнка'], '55': ['classic', 'Классическая филёнка 2'], '56': ['classic', 'Классическая филёнка 3'],
  '57': ['classic', 'Классическая филёнка 4'], '69': ['classic', 'Классическая филёнка 5'], '58': ['classic', 'Арка с внешним контуром'], '61': ['classic', 'Арка в рамке 2'],
};
/** Фрезеровки с фото из паспорта PDF (файл: id с «/» → «-»). У №86 в паспорте фото другой фрезеровки — показываем схему. */
const PHOTOS = new Set(['3', '6', '15', '18', '20', '25', '41', '43', '44', '45', '46', '47', '48', '53', '59', '62', '66', '67', '73', '74', '75', '76', '77',
  '78', '78/1', '79', '79/1', '80', '83', '84', '85', '88', '89', '90', '91', '92', '94', '95', '96', '98', '99', '100', '109', '110', '111', '112', '113', '114',
  'W1', 'W2', 'W3', 'W4', 'W5', 'W6', 'W7']);
export const millingPhotoUrl = (id: string) => `vernissage/millings/${id.replace('/', '-')}.jpg`;

/** Ценовые группы для клиента — по прайсу серии: ориентир «от» = минимальная цена за м² в плёнке (ПВХ/ПЭТ) при базовой толщине
 *  (19 мм, у ПЭТ — 18) × коэффициент Вернисажа, с округлением до 100 ₽. Серия попадает в группу по своему ориентиру (порог — upTo). */
export const PRICE_TIERS = [
  { id: 'base', label: 'Базовые', upTo: 10000, hint: 'Простые рисунки, самые доступные' },
  { id: 'mid', label: 'Средние', upTo: 13000, hint: 'Большинство рамок, классики и реек' },
  { id: 'top', label: 'Премиальные', upTo: Infinity, hint: 'Сложный профиль и встроенная ручка' },
] as const;
export type PriceTierId = (typeof PRICE_TIERS)[number]['id'];

/** Ориентир цены серии за м² клиенту (₽, округлено до 100); null — в прайсе серии нет цены в плёнке. */
export function seriesFromPerM2(series: VSeriesId, markup: number): number | null {
  const s = VERNISSAGE_SERIES.find((x) => x.id === series);
  if (!s) return null;
  const row = s.prices['19'] ?? s.prices['18'] ?? s.prices['16'];
  const film = Object.entries(row ?? {}).filter(([k]) => /^pvc|^pet/.test(k)).map(([, v]) => v);
  return film.length ? Math.round((Math.min(...film) * markup) / 100) * 100 : null;
}
export function tierOfSeries(series: VSeriesId, markup: number): PriceTierId {
  const p = seriesFromPerM2(series, markup) ?? Infinity;
  return PRICE_TIERS.find((t) => p < t.upTo)?.id ?? 'top';
}

export type MillingTile = { id: string; milling: VernissageMilling; style: MillStyle; name: string; photo: string | null; glass: boolean };
export type TierGroup = { id: PriceTierId; label: string; hint: string; from: number; to: number; tiles: MillingTile[] };

const STYLE_ORDER = MILL_STYLES.map((s) => s.id);
const NAME_ORDER = Object.keys(NAMES);
/** Все плитки каталога (показываемые клиенту), в порядке: стиль, затем порядок макета. */
export const MILLING_TILES: MillingTile[] = VERNISSAGE_MILLINGS.filter((m) => NAMES[m.id])
  .map((m) => ({ id: m.id, milling: m, style: NAMES[m.id][0], name: NAMES[m.id][1], photo: PHOTOS.has(m.id) ? millingPhotoUrl(m.id) : null, glass: openings(m).length > 1 }))
  .sort((a, b) => STYLE_ORDER.indexOf(a.style) - STYLE_ORDER.indexOf(b.style) || NAME_ORDER.indexOf(a.id) - NAME_ORDER.indexOf(b.id));
/** Без фото и без описания рисунка — клиенту не показываем (менеджер видит в «Все настройки»). */
export const HIDDEN_MILLINGS: string[] = VERNISSAGE_MILLINGS.filter((m) => !NAMES[m.id]).map((m) => m.id);
export const tileOf = (id: string) => MILLING_TILES.find((t) => t.id === id);

/** Группы по цене (дешёвые сверху); в группе — плитки по стилю. Пустые группы не выводятся. */
export function tierGroups(markup: number): TierGroup[] {
  return PRICE_TIERS.map((t) => {
    const tiles = MILLING_TILES.filter((x) => tierOfSeries(x.milling.series, markup) === t.id);
    const prices = [...new Set(tiles.map((x) => x.milling.series))].map((s) => seriesFromPerM2(s, markup)).filter((p): p is number => p !== null);
    return { id: t.id, label: t.label, hint: t.hint, from: Math.min(...prices), to: Math.max(...prices), tiles };
  }).filter((g) => g.tiles.length);
}
