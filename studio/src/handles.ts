// Каталог ручек: закупка цеха (счета ФАМ / Мега-Трейд 2026) и розница Лемана Про (артикулы настоящие,
// парсинг lemanapro.ru 01.09.2026 — клиент гипермаркета выбирает ручку там). Длина — межосевое, мм.
export type Handle = {
  id: string;
  label: string;
  len: number;
  price: number;
  source: string;
  vendor: "workshop" | "lemana";
  art?: string;
  /** розница Лемана как есть (ревью R5: модель «цена за лист» берёт её без коэффициента); в публичной сборке price запечён × коэффициент */
  shelf?: number;
  /** Габариты по паспорту, мм (если известны): общая длина, вынос от фасада, сечение. Без них — типовые по форме (handleSpec). */
  total?: number;
  projection?: number;
  section?: number;
  /** Счёта на ручку нет: в смете — позиция «после финального расчёта конструктором» (pendingPrices.ts), price не используется. */
  pending?: true;
};
/** Семейство формы ручки (место на фасаде: profile — на свободном краю). 3D-модель — handleShape/handleModels.ts. */
export type HandleKind = "bracket" | "rail" | "knob" | "profile";
export function handleKind(h: Pick<Handle, "label">): HandleKind {
  const l = h.label.toLocaleLowerCase("ru-RU");
  if (l.includes("рейлинг")) return "rail";
  if (l.includes("кнопка") || l.includes("knob")) return "knob";
  if (l.includes("торцев") || l.includes("профил") || l.includes("hexa l-")) return "profile";
  return "bracket";
}
/** Форма процедурной 3D-модели (handleModels.ts): торцевая отдельно от накладного профиля, дуговая (классическая) скоба отдельно от прямой. */
export type HandleShape = "bracket" | "arch" | "rail" | "knob" | "profile" | "edge";
export const HANDLE_SHAPE_LABELS: Record<HandleShape, string> = {
  bracket: "скоба", arch: "скоба дуговая", rail: "рейлинг", knob: "кнопка", profile: "профиль накладной", edge: "профиль торцевой",
};
/**
 * Как распознана форма ручки: keyword — по слову-типу в названии (скоба, рейлинг, профиль, торцевая, кнопка, HEXA L-);
 * series — по названию серии без слова-типа: у ручки две точки крепления (межосевое), это не рейлинг и не профиль → скоба;
 * default — не распознана (форма по умолчанию «скоба»). Паспортных чертежей ручек Лемана в репозитории нет — форма выведена из названия.
 */
export type HandleFormSource = "keyword" | "series" | "default";
/** Серии из каталога без слова-типа в названии (Лемана Про и цех): все — ручки-скобы на двух винтах. */
const BRACKET_SERIES = ["uz 819", "ritiro", "colaptes", "ajax", "rs006", "trodos", "brante", "ницца", "камо", "viverra", "нота", "виви", "jet", "softbrasket", "илим"];
export function handleFormSource(h: Pick<Handle, "label">): HandleFormSource {
  const l = h.label.toLocaleLowerCase("ru-RU");
  if (/рейлинг|кнопка|knob|торцев|профил|hexa|скоба/.test(l)) return "keyword";
  if (BRACKET_SERIES.some((s) => l.includes(s))) return "series";
  return "default";
}
/** Классическая отделка (старая/античная бронза, серия «Ницца») — дуговая скоба, как у классических ручек этой отделки. */
function classicBracket(l: string) {
  return /античн|стар[аоы][яей]? бронз|ницца/.test(l);
}
export type HandleFinish = "chrome" | "satin" | "aluminium" | "black" | "graphite" | "gold" | "bronze" | "wood" | "white";
/** Покрытие → металлический PBR (MeshStandardMaterial). Дерево и белая эмаль — не металл. */
export const HANDLE_FINISHES: Record<HandleFinish, { label: string; color: number; metalness: number; roughness: number }> = {
  chrome: { label: "хром", color: 0xeef0f2, metalness: 1, roughness: 0.12 },
  satin: { label: "сатин (матовый никель/хром)", color: 0xc5c9cd, metalness: 1, roughness: 0.38 },
  aluminium: { label: "алюминий", color: 0xc0c4c8, metalness: 0.9, roughness: 0.42 },
  black: { label: "чёрный матовый", color: 0x1d1e20, metalness: 0.55, roughness: 0.52 },
  graphite: { label: "графит", color: 0x45484c, metalness: 0.85, roughness: 0.42 },
  gold: { label: "золото", color: 0xd7b46a, metalness: 1, roughness: 0.3 },
  bronze: { label: "бронза", color: 0x7c5a3a, metalness: 1, roughness: 0.45 },
  wood: { label: "дерево", color: 0x9a6b3c, metalness: 0, roughness: 0.75 },
  white: { label: "белая эмаль", color: 0xf3f3f1, metalness: 0.05, roughness: 0.45 },
};
export function handleFinish(h: Pick<Handle, "label">): HandleFinish {
  const l = h.label.toLocaleLowerCase("ru-RU");
  if (l.includes("дерев")) return "wood";
  if (l.includes("бел")) return "white";
  if (l.includes("золот")) return "gold";
  if (l.includes("бронз")) return "bronze";
  if (l.includes("графит")) return "graphite";
  if (l.includes("чёрн") || l.includes("черн")) return "black";
  if (l.includes("мат") && (l.includes("никел") || l.includes("хром"))) return "satin";
  if (l.includes("алюмин")) return "aluminium";
  if (l.includes("хром") || l.includes("никел") || l.includes("серебр") || l.includes("сталь")) return "chrome";
  return "satin";
}
/**
 * Размеры модели ручки, мм. Межосевое (cc) — из каталога; общая длина, вынос и сечение у поставщиков в каталоге не записаны,
 * поэтому берутся консервативно по типу (estimated: true) — типовые значения скоб/рейлингов/профилей.
 */
export type HandleSpec = { shape: HandleShape; cc: number; total: number; projection: number; section: number; width: number; facets?: number; finish: HandleFinish;
  /** двухцветная (в названии «белая/хром», «чёрный/хром»): штанга — finish, ножки — legFinish */
  legFinish?: HandleFinish; estimated: boolean };
export function handleShape(h: Pick<Handle, "label">): HandleShape {
  const l = h.label.toLocaleLowerCase("ru-RU"), k = handleKind(h);
  if (k === "profile") return l.includes("торцев") || l.includes("hexa l-") ? "edge" : "profile";
  if (k === "bracket" && classicBracket(l)) return "arch";
  return k;
}
/** Второй цвет двухцветной ручки: «… · белая/хром» → ножки хром. */
function legFinish(l: string): HandleFinish | undefined {
  const m = /\/\s*(хром|никель|золот\S*|чёрн\S*|черн\S*)/.exec(l);
  if (!m) return undefined;
  return handleFinish({ label: m[1] });
}
export function handleSpec(h: Pick<Handle, "label" | "len"> & Partial<Pick<Handle, "total" | "projection" | "section">>): HandleSpec {
  const shape = handleShape(h), cc = h.len, finish = handleFinish(h), l = h.label.toLocaleLowerCase("ru-RU");
  const d = shape === "rail" ? { total: cc + 2 * Math.min(40, Math.max(20, Math.round(cc * 0.12))), projection: 35, section: 12, width: 12 }
    : shape === "knob" ? { total: 30, projection: 28, section: 10, width: 30 }
    : shape === "profile" ? { total: cc + 32, projection: 22, section: 2, width: 30 }
    : shape === "edge" ? { total: l.includes("hexa l-") ? cc : cc + 32, projection: 18, section: 2, width: 20 }
    // дуговая: труба Ø10 по дуге от розетки к розетке (розетки Ø14 → общая длина та же, что у прямой скобы: межосевое + 14)
    : shape === "arch" ? { total: cc + 14, projection: 30, section: 10, width: 14 }
    : { total: cc + 14, projection: 28, section: 10, width: 10 };
  const lf = shape === "bracket" || shape === "arch" ? legFinish(l) : undefined;
  return {
    shape, cc, finish,
    total: h.total ?? d.total, projection: h.projection ?? d.projection, section: h.section ?? d.section, width: d.width,
    ...(l.includes("hexa") && shape === "bracket" ? { facets: 6 } : {}),
    ...(lf && lf !== finish ? { legFinish: lf } : {}),
    estimated: h.total === undefined || h.projection === undefined || h.section === undefined,
  };
}
/** Длинная ручка (рейлинг/профиль 1200 и длиннее 1000 мм): ставится от пола — задаётся высота её низа. */
export const LONG_HANDLE = 1000;
const workshop = (id: string, label: string, len: number, price: number, source: string): Handle => ({ id, label, len, price, source, vendor: "workshop" });
const lemana = (art: string, label: string, len: number, price: number, shelf: number = price): Handle => ({ id: "lm" + art, art, label, len, price, shelf, source: "Лемана Про, розница 01.09.2026, арт. " + art, vendor: "lemana" });
export const HANDLES: Handle[] = [
  workshop("uz819-128", "UZ 819 · 128 · чёрный мат", 128, 100, "Счета ФАМ, 2026"),
  workshop("fp527-160", "Торцевая FP527 · 160 · чёрный мат", 160, 95, "Счета ФАМ, 2026"),
  workshop("hexa160b", "HEXA · 160 · чёрный мат", 160, 245, "Счета ФАМ, 2026"),
  workshop("hexa256a", "HEXA · 256 · алюминий", 256, 350, "Счета ФАМ, 2026"),
  workshop("hexa1200b", "HEXA L-1200 · чёрный мат", 1200, 1283, "Счёт Мега-Трейд 6271, 2026"),
  workshop("hexa1200a", "HEXA L-1200 · алюминий", 1200, 1263, "Счёт Мега-Трейд 6271, 2026"),
  // Заказ 7442203: торцевые ручки-профили под размер — вертикальная 600 на распашные двери и горизонтальная 350 на ящики пенала.
  // Счетов нет (в закупке только FP527 160) — цена после финального расчёта конструктором (pendingPrices.ts, «handle:edge»).
  { ...workshop("edge600b", "Торцевая · 600 · чёрный мат", 600, 0, "Торцевая ручка-профиль 600: счёта нет — цена после финального расчёта конструктором"), pending: true },
  { ...workshop("edge500b", "Торцевая · 500 · чёрный мат", 500, 0, "Торцевая ручка-профиль 500: счёта нет — цена после финального расчёта конструктором"), pending: true },
  { ...workshop("edge350b","Торцевая · 350 · чёрный мат", 350, 0, "Торцевая ручка-профиль 350: счёта нет — цена после финального расчёта конструктором"), pending: true },
  lemana("86728212", "Скоба C-7 · 96 · серебро", 96, 98),
  lemana("87377587", "Скоба L4.030 · 96 · никель", 96, 118),
  lemana("86899587", "Ritiro · 96 · матовое золото", 96, 170),
  lemana("86900231", "Colaptes · 96 · дерево", 96, 170),
  lemana("86471252", "Скоба C-29 · 128 · матовый чёрный", 128, 148),
  lemana("86923538", "Скоба 6902 · 128 · матовый чёрный", 128, 148),
  lemana("86923691", "Скоба 6902 · 128 · графит", 128, 148),
  lemana("86899315", "Ritiro · 128 · хром", 128, 228),
  lemana("86899588", "Ritiro · 128 · матовое золото", 128, 228),
  lemana("89408330", "Ajax MB-H-005 · 128 · чёрный", 128, 165),
  lemana("86923547", "Скоба 6902 · 160 · матовый чёрный", 160, 165),
  lemana("11592398", "RS006SN · 160 · матовый никель", 160, 248),
  lemana("91326129", "Trodos 2063 · 192 · хром мат", 192, 64),
  lemana("87376674", "Скоба L4.024 · 256 · чёрная", 256, 315),
  lemana("87376764", "Скоба L4.024 · 320 · чёрная", 320, 345),
  lemana("92155846", "Brante · 1200 · матовое золото", 1200, 1032),
  // Дополнение 06.09.2026: страница «Мебельные ручки» lemanapro.ru (Москва), скобы, рейлинги и профили с межосевым.
  lemana("18238447", "Эра Ницца · 96 · старая бронза", 96, 72),
  lemana("86924105", "Скоба 6802 · 96 · античная бронза", 96, 138),
  lemana("88660022", "Рейлинг Palladium PRZ · 96 · матовый никель", 96, 105),
  lemana("88950279", "Рейлинг Edson · 96 · матовый чёрный", 96, 105),
  lemana("83832489", "Рейлинг · 96 · матовый чёрный", 96, 148),
  lemana("86924092", "Рейлинг · 96 · античная бронза", 96, 148),
  lemana("89443704", "KONSENSA Камо · 96 · матовая чёрная", 96, 130),
  lemana("89449590", "Профиль KONSENSA Мура · 96 · бронза", 96, 125),
  lemana("89449591", "Профиль KONSENSA Мура · 96 · хром", 96, 125),
  lemana("86899665", "Рейлинг · 128 · никель", 128, 170),
  lemana("86923511", "Рейлинг · 128 · матовый чёрный", 128, 165),
  lemana("87376595", "Скоба L4.024 · 128 · чёрная", 128, 228),
  lemana("88660027", "Palladium Viverra · 128 · матовый чёрный", 128, 140),
  lemana("86924106", "Скоба 6802 · 128 · античная бронза", 128, 165),
  lemana("89443706", "KONSENSA Нота · 128 · матовая чёрная", 128, 321),
  lemana("89443707", "KONSENSA Нота · 128 · бронзовая", 128, 321),
  lemana("89443708", "KONSENSA Виви · 128 · белая/хром", 128, 240),
  lemana("89445010", "KONSENSA Виви · 128 · чёрный/хром", 128, 240),
  lemana("88660023", "Рейлинг Palladium PRZ · 160 · матовый никель", 160, 165),
  lemana("18239407", "Эра Jet · 160 · никель", 160, 140),
  lemana("82496944", "Softbrasket · 160 · никель", 160, 350),
  lemana("86923515", "Рейлинг · 160 · матовый чёрный", 160, 195),
  lemana("87685022", "Профиль Monblan · 160 · матовый хром", 160, 208),
  lemana("89445009", "KONSENSA Илим · 160 · чёрная матовая", 160, 95),
  lemana("90866420", "Профиль Найди · 200 · чёрный", 200, 180),
  lemana("88021705", "Профиль · 224 · матовый чёрный", 224, 406),
  lemana("88021709", "Профиль · 224 · матовый никель", 224, 406),
  lemana("88660024", "Рейлинг Palladium PRZ · 288 · матовый никель", 288, 185),
  lemana("86923519", "Рейлинг · 320 · матовый чёрный", 320, 288),
  lemana("89433452", "Рейлинг KONSENSA · 400 · чёрная", 400, 270),
  lemana("89433455", "Рейлинг KONSENSA · 400 · хром", 400, 261),
  lemana("89433456", "Рейлинг KONSENSA · 400 · никель", 400, 261),
  lemana("88021706", "Профиль · 512 · матовый чёрный", 512, 735),
  lemana("88021702", "Профиль · 600 · белый", 600, 453),
  lemana("89433451", "Рейлинг KONSENSA · 1200 · чёрная", 1200, 992),
  lemana("89433453", "Рейлинг KONSENSA · 1200 · хром", 1200, 992),
  lemana("89433454", "Рейлинг KONSENSA · 1200 · никель", 1200, 992),
  lemana("88021711", "Профиль · 1350 · матовый никель", 1350, 1564),
];
export const DEFAULT_HANDLE = "uz819-128";
export function handleById(id?: string): Handle {
  return HANDLES.find((h) => h.id === (id ?? DEFAULT_HANDLE)) ?? HANDLES[0];
}
/** Свободная длина под ручку: межосевое плюс по 20 мм на сторону от края фасада. */
export const HANDLE_MARGIN = 20;
