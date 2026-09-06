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
};
/** Семейство формы ручки для 3D-модели (Blender → GLB в public/models/handles). */
export type HandleKind = "bracket" | "rail" | "knob" | "profile";
export function handleKind(h: Pick<Handle, "label">): HandleKind {
  const l = h.label.toLocaleLowerCase("ru-RU");
  if (l.includes("рейлинг")) return "rail";
  if (l.includes("кнопка") || l.includes("knob")) return "knob";
  if (l.includes("торцев") || l.includes("профил") || l.includes("hexa l-")) return "profile";
  return "bracket";
}
/** Цвет металла по подписи ручки (для сцены). */
export function handleColour(h: Pick<Handle, "label">): number {
  const l = h.label.toLocaleLowerCase("ru-RU");
  if (l.includes("золот")) return 0xc9a44a;
  if (l.includes("бронз")) return 0x6b4a2e;
  if (l.includes("дерев")) return 0x9a6b3c;
  if (l.includes("чёрн") || l.includes("черн") || l.includes("графит")) return 0x25272a;
  if (l.includes("алюмин")) return 0xb9bcc0;
  if (l.includes("никел") || l.includes("хром") || l.includes("серебр") || l.includes("сталь")) return 0xc8ccd0;
  return 0x8d949a;
}
/** Файл модели для ручки: скобы/рейлинги/профили — по межосевому, кнопка одна. */
export function handleModelFile(h: Pick<Handle, "label" | "len">): string {
  const k = handleKind(h);
  return k === "knob" ? "knob.glb" : `${k}_${h.len}.glb`;
}
const workshop = (id: string, label: string, len: number, price: number, source: string): Handle => ({ id, label, len, price, source, vendor: "workshop" });
const lemana = (art: string, label: string, len: number, price: number): Handle => ({ id: "lm" + art, art, label, len, price, source: "Лемана Про, розница 01.09.2026, арт. " + art, vendor: "lemana" });
export const HANDLES: Handle[] = [
  workshop("uz819-128", "UZ 819 · 128 · чёрный мат", 128, 100, "Счета ФАМ, 2026"),
  workshop("fp527-160", "Торцевая FP527 · 160 · чёрный мат", 160, 95, "Счета ФАМ, 2026"),
  workshop("hexa160b", "HEXA · 160 · чёрный мат", 160, 245, "Счета ФАМ, 2026"),
  workshop("hexa256a", "HEXA · 256 · алюминий", 256, 350, "Счета ФАМ, 2026"),
  workshop("hexa1200b", "HEXA L-1200 · чёрный мат", 1200, 1283, "Счёт Мега-Трейд 6271, 2026"),
  workshop("hexa1200a", "HEXA L-1200 · алюминий", 1200, 1263, "Счёт Мега-Трейд 6271, 2026"),
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
