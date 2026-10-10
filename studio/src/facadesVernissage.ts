import { V_ADILET_FILMS, V_ADILET_MDF19, V_ADILET_PRICES, V_FILMS, V_MILLINGS, V_NOTES, V_PET_DECORS, V_SERIES, type VMillingRow, type VSeriesId } from './vernissageData';
import { layoutFacade, type FacadeLayout, type MillShape, type Opening } from './vernissageGeometry';

/** Фасады МДФ «Вернисаж» (г. Бор): каталог фрезеровок, плёнки, эмаль, цены по прайсу от 10.08.2026.
 *  Сторонний участок: фасады не идут в раскрой ЛДСП, цена — м² по серии, категории покрытия и толщине (примечания прайса — ниже).
 *  Кроме серий фрезеровок — фасады с интегрированной ручкой V5/V6/V7 (только 19 мм) и фасады ПЭТ на PUR-клее 18 мм (13 декоров). */
export type VernissageCover = 'film' | 'adilet' | 'enamel-matte' | 'enamel-gloss' | 'none' | 'pet';
export type VernissageFacade = {
  milling: string;
  cover: VernissageCover;
  /** Плёнка ПВХ (название из прайса, лист «Разделение плёнок по категориям»; для cover 'adilet' — лист «Плёнка Адилет»; для 'pet' — декор ПЭТ). */
  film?: string;
  /** Цвет эмали — подпись (RAL/NCS по заказу) и цвет в 3D. */
  enamelColor?: string;
  /** МДФ 16 или 19 мм по прайсу; 25 мм — «+40 % к 16 мм» (примечание 8 прайса); интегрированная ручка — 19, ПЭТ — 18. */
  thickness: 16 | 18 | 19 | 25;
  open?: Opening;
  patina?: boolean;
  /** Эмаль: покраска с двух сторон (+50 %), лак на матовую (+800 ₽/м²). */
  twoSided?: boolean;
  lacquer?: boolean;
};
export const DEFAULT_VERNISSAGE: VernissageFacade = { milling: '1', cover: 'film', film: 'Моно белый', thickness: 19 };
export const VERNISSAGE_SERIES = V_SERIES;
export const VERNISSAGE_FILMS = V_FILMS;
export const ADILET_FILMS = V_ADILET_FILMS;
export const VERNISSAGE_NOTES = V_NOTES;
export const PET_DECORS = V_PET_DECORS;
export const SERIES_LABEL: Record<VSeriesId, string> = { standart: 'Стандарт', optima: 'Оптима', prestige: 'Престиж', premium: 'Премиум', handle: 'Интегрированная ручка V5/V6/V7', pet: 'ПЭТ на PUR-клее 18 мм' };

/** УСЛОВНЫЕ размеры профилей. На сайте Вернисажа размеров нет ни у одной фрезеровки — они только в PDF «Техническая информация»
 *  каждой карточки (не скачаны без разрешения Макса). Тип рисунка — оценка по фото каталога. Числа ниже — наши рабочие значения,
 *  чтобы рисунок строился и растягивался по правилам; заменить по тех. PDF. */
export const PROVISIONAL = {
  source: 'условно: размеров на сайте нет, геометрия — в тех. PDF Вернисажа (не скачаны); тип рисунка — по фото каталога',
  edgeR: 2, grooveInset: 50, groove: { w: 8, d: 3 }, frame: 60, frameNarrow: 45, frameWide: 80,
  profile: { w: 9, d: 6 }, shaker: { w: 1, d: 4, step: true }, raised: { w: 25, h: 3.5 }, second: 22,
  slots: { pitch: 28, w: 8, d: 2.5 }, rails: { pitch: 30, w: 12, d: 3 }, railsFine: { pitch: 18, w: 7, d: 2.5 }, railsVeryFine: { pitch: 12, w: 5, d: 2 },
  flutes: { pitch: 48, w: 30, d: 4 }, diamond: { pitch: 70, w: 8, d: 3 }, archRise: 0.18, shoulder: 18,
  /** Интегрированная ручка V5/V6/V7: профиля на сайте нет — рисуем паз-выборку по верхнему краю на всю ширину: высота h от кромки,
   *  глубина d от лица, фаска ch по кромке выборки. Одинаково для V5/V6/V7, пока нет тех. информации Вернисажа. */
  handle: { h: 25, d: 10, ch: 2 },
} as const;

export type VernissageMilling = VMillingRow & { shape: MillShape; shapeNote: string };

/** Наша параметрическая трактовка рисунка по типу из каталога (фото каталога, оценка). */
export function millingShape(m: VMillingRow): { shape: MillShape; note: string } {
  const P = PROVISIONAL, inner = (m.inner ?? '').toLowerCase(), note = (m.note ?? '').toLowerCase();
  const top: MillShape['top'] = inner.includes('плечик') ? 'shoulders' : inner.includes('арк') ? 'arch' : 'rect';
  const base = { edgeR: P.edgeR, top, archRise: P.archRise, shoulder: P.shoulder };
  // №15 «мыло» (прайс) — гладкое полотно с крупным скруглением кромки по периметру (радиус условный)
  if (m.id === '15') return { shape: { kind: 'smooth', ...base, edgeR: 5 }, note: '«мыло» — гладкий, крупное скругление кромки' };
  // интегрированная ручка V5/V6/V7: профиль ручки на сайте не описан — паз-выборка по верхнему краю с условными размерами (PROVISIONAL.handle)
  if (m.series === 'handle') return { shape: { kind: 'handle', ...base, handle: { ...P.handle } }, note: `интегр. ручка — паз-выборка по верхнему краю ${P.handle.h}×${P.handle.d} мм, размеры условные` };
  if (m.series === 'pet') return { shape: { kind: 'smooth', ...base, edgeR: 1 }, note: 'ПЭТ на PUR-клее — гладкий' };
  if (m.type === 'гладкий') return { shape: { kind: 'smooth', ...base }, note: 'гладкий, скруглённая кромка' };
  if (!m.type) return { shape: { kind: 'smooth', ...base }, note: m.grafika ? 'Графика — рисунок не определён (нет карточки) — показан гладким' : 'рисунок не определён по каталогу — показан гладким' };
  if (m.type === 'фрезеровка по полотну') {
    const shape: MillShape = { kind: 'groove', ...base, inset: P.grooveInset, groove: { ...P.groove }, cornerR: note.includes('скруглён') ? 12 : 0 };
    if (m.id === '98' || m.id === '99' || m.id === '100') shape.inset = 35; // «Арка» во всю высоту
    if (inner.includes('второй') || note.includes('второй контур')) shape.second = P.second;
    if (inner.includes('вертикальные пазы')) shape.slots = { dir: 'v', ...P.slots, zone: 'all' };
    if (inner.includes('линейные пазы')) shape.slots = { dir: 'v', ...P.slots, zone: 'bottom' };
    return { shape, note: 'контурный паз по полотну' };
  }
  if (m.type === 'рамочная с филёнкой') {
    const narrow = note.includes('узкая'), wide = note.includes('широкая'), shaker = note.includes('шейкер') || note.includes('уступ');
    const shape: MillShape = { kind: 'frame', ...base, inset: narrow ? P.frameNarrow : wide ? P.frameWide : P.frame, profile: shaker ? { ...P.shaker } : { ...P.profile } };
    if (m.panel === 'выпуклая') shape.raised = { ...P.raised };
    if (inner.includes('второй')) shape.second = P.second;
    if (inner.includes('вертикальные пазы внизу')) shape.slots = { dir: 'v', ...P.slots, zone: 'bottom' };
    else if (inner.includes('вертикальные пазы') || m.panel === 'с пазами') shape.slots = { dir: 'v', ...P.slots, zone: 'all' };
    if (inner.includes('горизонтальные пазы')) shape.slots = { dir: 'h', ...P.slots, zone: 'ends' };
    // №59: «углы филёнки фигурные (вогнутые)» (фото каталога) — вогнутая четверть круга в углах проёма, радиус условный
    if (inner.includes('фигурные углы')) { shape.cornerR = 14; shape.cornerKind = note.includes('вогнут') ? 'concave' : 'round'; }
    const corners = shape.cornerKind === 'concave' ? ', вогнутые углы' : '';
    return { shape, note: (shaker ? 'рамка «шейкер» с прямым уступом' : m.panel === 'выпуклая' ? 'рамка с выпуклой филёнкой' : 'рамка с профилем и филёнкой') + corners };
  }
  if (m.type === 'рельеф по всему полотну') {
    if (inner.includes('ромб')) return { shape: { kind: 'relief', ...base, relief: { dir: 'diamond', ...P.diamond } }, note: 'рельеф ромбами' };
    const dir = inner.includes('горизонт') ? 'h' : 'v';
    const r = inner.includes('каннелюр') ? P.flutes : note.includes('очень частые') ? P.railsVeryFine : note.includes('частые') ? P.railsFine : P.rails;
    return { shape: { kind: 'relief', ...base, relief: { dir, ...r } }, note: inner.includes('волн') ? 'волна 83 упрощена до вертикальных пазов — ждём тех. PDF' : 'рейки/пазы по всему полотну' };
  }
  return { shape: { kind: 'smooth', ...base }, note: 'тип не распознан — гладкий' };
}

export const VERNISSAGE_MILLINGS: VernissageMilling[] = V_MILLINGS.map((m) => { const s = millingShape(m); return { ...m, shape: s.shape, shapeNote: s.note }; });
export function vernissageMilling(id: string | undefined): VernissageMilling | undefined { return VERNISSAGE_MILLINGS.find((m) => m.id === id); }
export function seriesOf(id: string) { const m = vernissageMilling(id); return V_SERIES.find((s) => s.id === (m?.series ?? 'standart'))!; }

/** Варианты исполнения фрезеровки (по подписям фото каталога): глухой всегда; под стекло и решётка — только у рамочных с проёмом. */
export function openings(m: VernissageMilling): Opening[] {
  const out: Opening[] = ['solid'];
  if (m.shape.kind === 'frame' && m.variants?.glass) out.push('glass');
  if (m.shape.kind === 'frame' && m.variants?.grille) out.push('grille');
  return out;
}

export function vernissageLayout(v: VernissageFacade, w: number, h: number, t: number = v.thickness): FacadeLayout {
  const m = vernissageMilling(v.milling) ?? VERNISSAGE_MILLINGS[0];
  return layoutFacade(w, h, t, m.shape, v.open && openings(m).includes(v.open) ? v.open : 'solid');
}

/** Колонка прайса для покрытия: категория плёнки → колонка серии (Стандарт делит 2 и 3, остальные — «2,3»). */
export function priceColumn(v: VernissageFacade): { key: string; label: string } | null {
  const s = seriesOf(v.milling);
  let key: string | null = null;
  if (v.cover === 'adilet') {
    const cat = V_ADILET_FILMS.find((f) => f.name === v.film)?.cat;
    return cat && V_ADILET_PRICES[s.id]?.['16']?.['cat' + cat] !== undefined ? { key: 'adilet:cat' + cat, label: `Плёнка Адилет, категория ${cat}` } : null;
  }
  if (v.cover === 'enamel-matte') key = 'enamel_matte';
  else if (v.cover === 'enamel-gloss') key = 'enamel_gloss';
  else if (v.cover === 'none') key = 'no_film';
  else if (v.cover === 'pet') key = PET_DECORS.includes(v.film ?? '') ? 'pet' : null;
  else {
    const cat = V_FILMS.find((f) => f.name === v.film)?.cat;
    // интегрированная ручка: колонки «2, 3 категория» и «5, 6 категория» (R47)
    if (s.id === 'handle') key = cat === '2' || cat === '3' ? 'pvc_cat2_3' : cat === '5' || cat === '6' ? 'pvc_cat5_6' : null;
    else if (cat === '2') key = s.id === 'standart' ? 'pvc_cat2_mono' : 'pvc_cat2_3';
    else if (cat === '3') key = s.id === 'standart' ? 'pvc_cat3' : 'pvc_cat2_3';
    else if (cat === '4' || cat === '5' || cat === '6') key = 'pvc_cat' + cat;
    else if (cat === 'Премиум') key = 'pvc_premium';
  }
  if (!key || !(key in s.columns)) return null;
  return { key, label: s.columns[key] };
}

/** Толщины МДФ, для которых в прайсе серии есть цена (25 мм — от цены 16 мм). */
export function thicknessesOf(milling: string): VernissageFacade['thickness'][] {
  const s = seriesOf(milling), out: VernissageFacade['thickness'][] = [];
  for (const t of [16, 18, 19] as const) if (s.prices[String(t) as '16' | '18' | '19']) out.push(t);
  if (s.prices['16']) out.push(25);
  return out;
}
/** Покрытия, у которых есть колонка в прайсе серии (и разрешение эмали у фрезеровки, R28/R39). */
export function coversOf(milling: string): VernissageCover[] {
  const m = vernissageMilling(milling), s = seriesOf(milling), c = s.columns, out: VernissageCover[] = [];
  if (Object.keys(c).some((k) => k.startsWith('pvc_'))) out.push('film');
  if (V_ADILET_PRICES[s.id]) out.push('adilet');
  if ('pet' in c) out.push('pet');
  if (m?.enamel !== 'none' && 'enamel_matte' in c) out.push('enamel-matte');
  if (m?.enamel === 'matte-gloss' && 'enamel_gloss' in c) out.push('enamel-gloss');
  if ('no_film' in c) out.push('none');
  return out;
}
/** Категории плёнок ПВХ, для которых у серии есть колонка (у Премиума нет категории 4, у интегр. ручки — 4 и Премиум). */
export function filmCatsOf(milling: string): string[] {
  return ['2', '3', '4', '5', '6', 'Премиум'].filter((cat) => { const f = V_FILMS.find((x) => x.cat === cat); return !!f && priceColumn({ milling, cover: 'film', film: f.name, thickness: 19 }) !== null; });
}
/** Приведение выбора к допустимому после смены серии/фрефеловки: покрытие, плёнка и толщина — из доступных по прайсу. */
export function normalizeVernissage(v: VernissageFacade): VernissageFacade {
  const out = { ...v }, covers = coversOf(v.milling), ths = thicknessesOf(v.milling);
  if (!covers.includes(out.cover)) out.cover = covers[0] ?? 'film';
  if (out.cover === 'film') { const cats = filmCatsOf(v.milling), f = V_FILMS.find((x) => x.name === out.film); if (!f || !cats.includes(f.cat)) out.film = V_FILMS.find((x) => x.cat === cats[0])?.name; }
  if (out.cover === 'adilet' && !V_ADILET_FILMS.some((f) => f.name === out.film)) out.film = V_ADILET_FILMS.find((f) => !f.out)!.name;
  if (out.cover === 'pet' && !PET_DECORS.includes(out.film ?? '')) out.film = PET_DECORS[0];
  if (!out.cover.startsWith('enamel')) { delete out.twoSided; delete out.lacquer; }
  if (out.cover !== 'enamel-matte') delete out.lacquer;
  if (!ths.includes(out.thickness)) out.thickness = ths.includes(19) ? 19 : ths[0];
  const m = vernissageMilling(v.milling);
  if (out.open && !(m && openings(m).includes(out.open))) delete out.open;
  return out;
}

export type VernissagePrice = { area: number; billArea: number; perM2: number | null; base: number | null; column: string | null; total: number | null; notes: string[]; warnings: string[] };
/** Цена одного фасада по прайсу: м² по серии/колонке/толщине; ПВХ меньше 0,3 м² — как 0,3; рамки и решётки +10 %;
 *  эмаль с двух сторон +50 % к прайсу; лак на матовую эмаль +800 ₽/м²; патина +2500 ₽/м². Присадка под петли — отдельной строкой. */
export function vernissageFacadePrice(v: VernissageFacade, wMm: number, hMm: number): VernissagePrice {
  const m = vernissageMilling(v.milling), s = seriesOf(v.milling), col = priceColumn(v), notes: string[] = [], warnings: string[] = [];
  // минимум 0,3 м² — только ПВХ (примечание 6): плёнка, Адилет, «без плёнки ПВХ» серий; не эмаль, не ПЭТ, не «без покрытия» интегр. ручки (эмалевый участок)
  const area = (wMm * hMm) / 1e6, pvc = v.cover === 'film' || v.cover === 'adilet' || (v.cover === 'none' && s.id !== 'handle');
  const billArea = pvc ? Math.max(area, V_NOTES.minAreaM2Pvc) : area;
  if (pvc && area < V_NOTES.minAreaM2Pvc) notes.push(`ПВХ меньше ${fmtRu(V_NOTES.minAreaM2Pvc)} м² — считается как ${fmtRu(V_NOTES.minAreaM2Pvc)} м²`);
  // R25–R26: МДФ 19 мм — для фасадов с петлями; без петель возможно 16 мм. Адилет (R27): к списку добавлен №109.
  if (v.thickness === 16 && (m?.mdf19Only || (v.cover === 'adilet' && V_ADILET_MDF19.includes(v.milling)))) warnings.push(`№${v.milling} — МДФ 19 мм, если на фасаде петли (16 мм — только без петель)`);
  if (v.cover === 'adilet') { notes.push('плёнка Адилет: срок +5 раб. дней'); if (V_ADILET_FILMS.find((f) => f.name === v.film)?.out) warnings.push(`Плёнка «${v.film}» выводится из ассортимента («[Выводим]» в прайсе)`); }
  if (v.cover.startsWith('enamel') && m && m.enamel === 'none') warnings.push(`№${v.milling} в эмали не исполняется по прайсу`);
  if (v.cover === 'enamel-gloss' && m?.enamel === 'matte') warnings.push(`№${v.milling} — эмаль только матовая`);
  // R28: «без решёток: №58, 40, 40-1», «без декора: №44»
  if (v.cover.startsWith('enamel') && m?.enamelNoGrille && v.open === 'grille') warnings.push(`№${v.milling} в эмали — без решёток (R28)`);
  if (v.cover.startsWith('enamel') && m?.enamelNoDecor) warnings.push(`№${v.milling} в эмали исполняется без декора (R28)`);
  const film = V_FILMS.find((f) => f.name === v.film);
  // R27: «в плёнках серии Лайн и Сиена не рекомендуются: …»; R38: вся серия Премиум
  if (v.cover === 'film' && (m?.lineSienaNo || s.id === 'premium') && /^(Лайн|Сиена)/.test(v.film ?? '')) warnings.push(`№${v.milling} не рекомендуется в плёнках Лайн и Сиена${s.id === 'premium' ? ' (вся серия Премиум)' : ''}`);
  // интегрированная ручка: колонка «V5» листа категорий — допустимость плёнки для V5; список для V6/V7 у производителя
  if (s.id === 'handle' && v.cover === 'film') {
    if (v.milling === 'V5' && film?.v5 === false) warnings.push(`Плёнка «${v.film}» не для интегрированной ручки V5 (колонка «V5» прайса)`);
    else if (v.milling === 'V5' && film && film.v5 !== true) notes.push('допустимость плёнки для V5 в прайсе не отмечена — уточнить');
    else if (v.milling !== 'V5') notes.push(`список плёнок для ${v.milling} — у производителя, уточнить`);
  }
  if (s.id === 'handle') notes.push('интегр. ручка: срок 20 раб. дней');
  if (v.cover === 'pet') notes.push('ПЭТ на PUR: срок 5–7 раб. дней');
  // МДФ 25 мм: прайсовая цена 16 мм + 40 % (примечание 8 прайса)
  const t = v.thickness === 25 ? '16' : (String(v.thickness) as '16' | '18' | '19');
  const raw = !col ? null : col.key.startsWith('adilet:') ? V_ADILET_PRICES[s.id]?.[t as '16' | '19']?.[col.key.slice(7)] ?? null : s.prices[t]?.[col.key] ?? null;
  const base = raw === null ? null : v.thickness === 25 ? Math.round(raw * (1 + V_NOTES.mdf25MarkupPctVs16 / 100) * 100) / 100 : raw;
  if (v.thickness === 25 && raw !== null) notes.push(`МДФ 25 мм: +${V_NOTES.mdf25MarkupPctVs16} % к 16 мм`);
  if (base === null) { warnings.push('Нет цены в прайсе для этого сочетания серии и покрытия'); return { area, billArea, perM2: null, base: null, column: col?.label ?? null, total: null, notes, warnings }; }
  let perM2 = base;
  const frame = v.open === 'glass' || v.open === 'grille';
  if (frame) { perM2 *= 1 + V_NOTES.framesAndGrillesMarkupPct / 100; notes.push(`рамка/решётка +${V_NOTES.framesAndGrillesMarkupPct} %`); }
  if (v.twoSided && v.cover.startsWith('enamel')) { perM2 *= 1 + V_NOTES.enamelTwoSidedMarkupPct / 100; notes.push(`покраска с 2 сторон +${V_NOTES.enamelTwoSidedMarkupPct} %`); }
  if (v.lacquer && v.cover === 'enamel-matte') { perM2 += V_NOTES.enamelMatteLacquerPerM2; notes.push(`лак +${V_NOTES.enamelMatteLacquerPerM2} ₽/м²`); }
  if (v.patina) {
    const ad = v.cover === 'adilet' ? V_ADILET_FILMS.find((f) => f.name === v.film) : undefined;
    if (ad && (/глян|софт|soft|металл/i.test(ad.name + ' ' + (ad.finish ?? '')))) warnings.push(`Плёнка «${v.film}» — софт/металлик/глянец не патинируются`);
    else if (v.cover === 'film' && film?.patina === false) warnings.push(`Плёнка «${v.film}» не патинируется`);
    else if (v.cover === 'pet') warnings.push('ПЭТ не патинируется (в прайсе патина — для ПВХ и эмали)');
    else { perM2 += V_NOTES.patinaPerM2; notes.push(`патина +${V_NOTES.patinaPerM2} ₽/м²`); }
  }
  perM2 = Math.round(perM2 * 100) / 100;
  return { area, billArea, perM2, base, column: col!.label, total: Math.round(perM2 * billArea * 100) / 100, notes, warnings };
}
/** Число с десятичной запятой (0,3). */
export function fmtRu(x: number): string { return String(x).replace('.', ','); }
/** Дата прайса по-русски: 2026-08-10 → 10.08.2026. */
export function priceDateRu(): string { const [y, mo, d] = String(V_NOTES.priceDate).split('-'); return d && mo && y ? `${d}.${mo}.${y}` : String(V_NOTES.priceDate); }

export function vernissageLabel(v: VernissageFacade): string {
  const m = vernissageMilling(v.milling), s = seriesOf(v.milling);
  const cover = v.cover === 'film' ? `плёнка ${v.film ?? '—'}` : v.cover === 'adilet' ? `плёнка Адилет ${v.film ?? '—'}` : v.cover === 'pet' ? `ПЭТ ${v.film ?? '—'}` : v.cover === 'enamel-matte' ? `эмаль мат${v.enamelColor ? ' ' + v.enamelColor : ''}` : v.cover === 'enamel-gloss' ? `эмаль глянец${v.enamelColor ? ' ' + v.enamelColor : ''}` : s.id === 'handle' ? 'без покрытия' : 'без плёнки';
  const open = v.open === 'glass' ? ', под стекло' : v.open === 'grille' ? ', решётка' : '';
  if (s.id === 'pet') return `Вернисаж ${s.name}, ${cover}, МДФ ${v.thickness}`;
  return `Вернисаж ${s.name} ${s.id === 'handle' ? '' : '№'}${m?.id ?? v.milling}${open}, ${cover}, МДФ ${v.thickness}`;
}

/** Цвет в 3D по названию плёнки/эмали — приблизительный (текстур плёнок производителя нет). */
export function vernissageColor(v: VernissageFacade): number {
  if (v.cover.startsWith('enamel') && v.enamelColor && /^#?[0-9a-f]{6}$/i.test(v.enamelColor)) return parseInt(v.enamelColor.replace('#', ''), 16);
  // частые RAL эмали — цвета по стандарту RAL (приблизительно для экрана)
  const ral = v.cover.startsWith('enamel') ? /RAL\s*(\d{4})/i.exec(v.enamelColor ?? '')?.[1] : undefined;
  const RAL: Record<string, number> = { '9001': 0xe9e0d2, '9002': 0xd7d5cb, '9003': 0xf4f4f4, '9005': 0x0a0a0d, '9010': 0xf1ece1, '9016': 0xf1f0ea, '9018': 0xcfd3cd, '1013': 0xe3d9c6, '1015': 0xe6d2b5, '7035': 0xcbd0cc, '7047': 0xd0d0d0, '7016': 0x383e42, '7024': 0x474a50, '7037': 0x7a7b7a, '6021': 0x89ac76, '5014': 0x606e8c };
  if (ral && RAL[ral] !== undefined) return RAL[ral];
  const n = (v.cover === 'film' || v.cover === 'adilet' ? v.film ?? '' : v.enamelColor ?? '').toLowerCase();
  const table: [RegExp, number][] = [[/графит|антрацит|чёрн|черн|венге|обсидиан/, 0x3d3f42], [/сер|грей|grey|бетон|маренго/, 0x9a9c99], [/мят|олив|фисташ|зел|грин|green|шалфей|эвкалипт|мирт|базилик|мелисс/, 0xa9b8a0],
    [/голуб|скай|синий|деним|азур|индиго|аквамарин|океан/, 0x93a7b8], [/лаванд|пудр|pink|розм|фламинго/, 0xc9b3b8], [/орех|тик|каштан|шоколад|кофе|мокко|трюфель|брауни|темн|тёмн/, 0x7a5a42],
    [/дуб|ясень|сосна|акаци|вяз|лиственниц|сандал|клен|клён|дерев/, 0xc9a982], [/беж|латте|капучино|крем|ваниль|карамель|песок|кашемир|миндаль|лён|лен|сафари|имбир/, 0xd9c9ad], [/бел|айс|милк|слонов|бьянк|магнол|фарфор|иней/, 0xf1efe9]];
  for (const [re, c] of table) if (re.test(n)) return c;
  return 0xe6e4dc;
}
export function vernissageGlossy(v: VernissageFacade): boolean { return v.cover === 'enamel-gloss' || ((v.cover === 'film' || v.cover === 'adilet') && /глянец|глянц|gloss|HG/i.test(v.film ?? '')); }
