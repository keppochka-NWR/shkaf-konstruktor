import { V_ADILET_FILMS, V_ADILET_PRICES, V_FILMS, V_MILLINGS, V_NOTES, V_SERIES, type VMillingRow, type VSeriesId } from './vernissageData';
import { layoutFacade, type FacadeLayout, type MillShape, type Opening } from './vernissageGeometry';

/** Фасады МДФ «Вернисаж» (г. Бор): каталог фрезеровок, плёнки, эмаль, цены по прайсу от 10.08.2026.
 *  Сторонний участок: фасады не идут в раскрой ЛДСП, цена — м² по серии, категории покрытия и толщине (примечания прайса — ниже). */
export type VernissageCover = 'film' | 'adilet' | 'enamel-matte' | 'enamel-gloss' | 'none';
export type VernissageFacade = {
  milling: string;
  cover: VernissageCover;
  /** Плёнка ПВХ (название из прайса, лист «Разделение плёнок по категориям»; для cover 'adilet' — лист «Плёнка Адилет»). */
  film?: string;
  /** Цвет эмали — подпись (RAL/NCS по заказу) и цвет в 3D. */
  enamelColor?: string;
  /** МДФ 16 или 19 мм по прайсу; 25 мм — «+40 % к 16 мм» (примечание 8 прайса). */
  thickness: 16 | 19 | 25;
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
export const SERIES_LABEL: Record<VSeriesId, string> = { standart: 'Стандарт', optima: 'Оптима', prestige: 'Престиж', premium: 'Премиум' };

/** УСЛОВНЫЕ размеры профилей. На сайте Вернисажа размеров нет ни у одной фрезеровки — они только в PDF «Техническая информация»
 *  каждой карточки (не скачаны без разрешения Макса). Тип рисунка — оценка по фото каталога. Числа ниже — наши рабочие значения,
 *  чтобы рисунок строился и растягивался по правилам; заменить по тех. PDF. */
export const PROVISIONAL = {
  source: 'условно: размеров на сайте нет, геометрия — в тех. PDF Вернисажа (не скачаны); тип рисунка — по фото каталога',
  edgeR: 2, grooveInset: 50, groove: { w: 8, d: 3 }, frame: 60, frameNarrow: 45, frameWide: 80,
  profile: { w: 9, d: 6 }, shaker: { w: 1, d: 4, step: true }, raised: { w: 25, h: 3.5 }, second: 22,
  slots: { pitch: 28, w: 8, d: 2.5 }, rails: { pitch: 30, w: 12, d: 3 }, railsFine: { pitch: 18, w: 7, d: 2.5 }, railsVeryFine: { pitch: 12, w: 5, d: 2 },
  flutes: { pitch: 48, w: 30, d: 4 }, diamond: { pitch: 70, w: 8, d: 3 }, archRise: 0.18, shoulder: 18,
} as const;

export type VernissageMilling = VMillingRow & { shape: MillShape; shapeNote: string };

/** Наша параметрическая трактовка рисунка по типу из каталога (фото каталога, оценка). */
export function millingShape(m: VMillingRow): { shape: MillShape; note: string } {
  const P = PROVISIONAL, inner = (m.inner ?? '').toLowerCase(), note = (m.note ?? '').toLowerCase();
  const top: MillShape['top'] = inner.includes('плечик') ? 'shoulders' : inner.includes('арк') ? 'arch' : 'rect';
  const base = { edgeR: P.edgeR, top, archRise: P.archRise, shoulder: P.shoulder };
  // №15 «мыло» (прайс) — гладкое полотно с крупным скруглением кромки по периметру (радиус условный)
  if (m.id === '15') return { shape: { kind: 'smooth', ...base, edgeR: 5 }, note: '«мыло» — гладкий, крупное скругление кромки' };
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
  else {
    const cat = V_FILMS.find((f) => f.name === v.film)?.cat;
    if (cat === '2') key = s.id === 'standart' ? 'pvc_cat2_mono' : 'pvc_cat2_3';
    else if (cat === '3') key = s.id === 'standart' ? 'pvc_cat3' : 'pvc_cat2_3';
    else if (cat === '4' || cat === '5' || cat === '6') key = 'pvc_cat' + cat;
    else if (cat === 'Премиум') key = 'pvc_premium';
  }
  if (!key || !(key in s.columns)) return null;
  return { key, label: s.columns[key] };
}

export type VernissagePrice = { area: number; billArea: number; perM2: number | null; base: number | null; column: string | null; total: number | null; notes: string[]; warnings: string[] };
/** Цена одного фасада по прайсу: м² по серии/колонке/толщине; ПВХ меньше 0,3 м² — как 0,3; рамки и решётки +10 %;
 *  эмаль с двух сторон +50 % к прайсу; лак на матовую эмаль +800 ₽/м²; патина +2500 ₽/м². Присадка под петли — отдельной строкой. */
export function vernissageFacadePrice(v: VernissageFacade, wMm: number, hMm: number): VernissagePrice {
  const m = vernissageMilling(v.milling), s = seriesOf(v.milling), col = priceColumn(v), notes: string[] = [], warnings: string[] = [];
  const area = (wMm * hMm) / 1e6, pvc = v.cover === 'film' || v.cover === 'adilet' || v.cover === 'none';
  const billArea = pvc ? Math.max(area, V_NOTES.minAreaM2Pvc) : area;
  if (pvc && area < V_NOTES.minAreaM2Pvc) notes.push(`меньше ${V_NOTES.minAreaM2Pvc} м² — считается как ${V_NOTES.minAreaM2Pvc}`);
  if (m?.mdf19Only && v.thickness === 16) warnings.push(`№${v.milling} — только МДФ 19 мм (с петлями)`);
  if (v.cover === 'adilet') { notes.push('плёнка Адилет: срок +5 раб. дней'); if (V_ADILET_FILMS.find((f) => f.name === v.film)?.out) warnings.push(`Плёнка «${v.film}» выводится из ассортимента («[Выводим]» в прайсе)`); }
  if (v.cover.startsWith('enamel') && m && m.enamel === 'none') warnings.push(`№${v.milling} в эмали не исполняется по прайсу`);
  if (v.cover === 'enamel-gloss' && m?.enamel === 'matte') warnings.push(`№${v.milling} — эмаль только матовая`);
  const film = V_FILMS.find((f) => f.name === v.film);
  if (v.cover === 'film' && m?.lineSienaNo && /^(Лайн|Сиена)/.test(v.film ?? '')) warnings.push(`№${v.milling} не рекомендуется в плёнках Лайн и Сиена`);
  // МДФ 25 мм: прайсовая цена 16 мм + 40 % (примечание 8 прайса)
  const t = v.thickness === 25 ? '16' : (String(v.thickness) as '16' | '19');
  const raw = !col ? null : col.key.startsWith('adilet:') ? V_ADILET_PRICES[s.id]?.[t]?.[col.key.slice(7)] ?? null : s.prices[t]?.[col.key] ?? null;
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
    else { perM2 += V_NOTES.patinaPerM2; notes.push(`патина +${V_NOTES.patinaPerM2} ₽/м²`); }
  }
  perM2 = Math.round(perM2 * 100) / 100;
  return { area, billArea, perM2, base, column: col!.label, total: Math.round(perM2 * billArea * 100) / 100, notes, warnings };
}

export function vernissageLabel(v: VernissageFacade): string {
  const m = vernissageMilling(v.milling), s = seriesOf(v.milling);
  const cover = v.cover === 'film' ? `плёнка ${v.film ?? '—'}` : v.cover === 'adilet' ? `плёнка Адилет ${v.film ?? '—'}` : v.cover === 'enamel-matte' ? `эмаль мат${v.enamelColor ? ' ' + v.enamelColor : ''}` : v.cover === 'enamel-gloss' ? `эмаль глянец${v.enamelColor ? ' ' + v.enamelColor : ''}` : 'без плёнки';
  const open = v.open === 'glass' ? ', под стекло' : v.open === 'grille' ? ', решётка' : '';
  return `Вернисаж ${s.name} №${m?.id ?? v.milling}${open}, ${cover}, МДФ ${v.thickness}`;
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
