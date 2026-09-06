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
];
export const DEFAULT_HANDLE = "uz819-128";
export function handleById(id?: string): Handle {
  return HANDLES.find((h) => h.id === (id ?? DEFAULT_HANDLE)) ?? HANDLES[0];
}
/** Свободная длина под ручку: межосевое плюс по 20 мм на сторону от края фасада. */
export const HANDLE_MARGIN = 20;
